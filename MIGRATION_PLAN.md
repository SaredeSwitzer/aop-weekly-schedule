# Migration Plan: AOP Shala NYC → Vercel + Supabase + Clerk

## Context

The current app is a single-file vanilla HTML/JS yoga class scheduler hosted on Netlify with Firebase Realtime Database. Key problems:
- Admin password is hardcoded in plaintext in client-side code
- Firebase has no enforced security rules (browser talks directly to DB)
- 1,153-line single HTML file is hard to maintain
- No real authentication

**Goal:** Migrate to Next.js (Vercel) + Supabase (Postgres + Realtime) + Clerk (auth), preserving all existing features and the same visual design.

---

## New Stack

| Layer | Technology |
|---|---|
| Frontend + API routes | Next.js (latest stable, App Router) on Vercel |
| Database | Supabase Postgres + Realtime |
| Auth (admin only) | Clerk — email/password + magic link |
| Email | Brevo (unchanged) via Next.js API route |
| Styling | Tailwind CSS + shadcn/ui components |

---

## Supabase Schema

### `classes` table (replaces Firebase `schedule/`)
```sql
create table classes (
  id          text primary key,          -- kept as timestamp string for data parity
  day         smallint not null,         -- 0=Mon … 6=Sun
  time        text not null,             -- "HH:MM"
  end_time    text,
  class_name  text not null,
  location    text,
  capacity    int not null default 10,
  created_at  timestamptz default now()
);
```

### `signups` table (replaces Firebase `signups/{weekKey}/{slotId}/{pushId}`)
```sql
create table signups (
  id          uuid primary key default gen_random_uuid(),
  week_key    text not null,             -- "YYYY-MM-DD" (Sunday of week)
  class_id    text references classes(id) on delete cascade,
  name        text not null,
  email       text not null,
  signed_up_at timestamptz default now()
);
create index on signups (week_key, class_id);
```

### `overrides` table (replaces Firebase `overrides/{weekKey}/{slotId}`)
```sql
create table overrides (
  id          uuid primary key default gen_random_uuid(),
  week_key    text not null,
  class_id    text references classes(id) on delete cascade,
  cancelled   boolean default false,
  time        text,
  end_time    text,
  class_name  text,
  location    text,
  capacity    int,
  unique (week_key, class_id)
);
```

### Row-Level Security
```sql
-- classes: public read, admin write
alter table classes enable row level security;
create policy "public read" on classes for select using (true);
create policy "admin write" on classes for all using (auth.role() = 'service_role');

-- signups: public insert (student signups), public delete own row by email, admin full access
alter table signups enable row level security;
create policy "public insert" on signups for insert with check (true);
create policy "public delete own" on signups for delete using (true); -- enforced in API route
create policy "admin full" on signups for all using (auth.role() = 'service_role');

-- overrides: public read, admin write
alter table overrides enable row level security;
create policy "public read" on overrides for select using (true);
create policy "admin write" on overrides for all using (auth.role() = 'service_role');
```
> Public reads use the anon key. Admin writes use the service role key, only accessible in API routes (never the browser).

---

## Next.js Project Structure

```
/app
  layout.tsx                  -- ClerkProvider wrapper + global styles
  page.tsx                    -- Schedule view (public)
  /admin
    layout.tsx                -- Clerk auth guard (redirects if not signed in)
    page.tsx                  -- Admin panel
  /api
    /classes
      route.ts                -- GET (public), POST/PUT/DELETE (admin, checks Clerk session)
    /signups
      route.ts                -- GET (public), POST (public signup), DELETE (by email match or admin)
    /overrides
      route.ts                -- GET (public), PUT/DELETE (admin)
    /send-email
      route.ts                -- Brevo proxy (same logic as current Netlify function)
    /students
      route.ts                -- GET all unique students ever (admin only)

/components
  /ui                         -- shadcn/ui primitives (Button, Input, Dialog, Tabs, Toast, etc.)
  Calendar.tsx                -- 7-day grid (extracted from current index.html)
  ClassBlock.tsx              -- Individual class card on the calendar
  SignupModal.tsx             -- Sign up / cancel modal (uses shadcn Dialog + Tabs)
  AdminPanel.tsx              -- Add/edit/delete classes, broadcast email (uses shadcn Sheet or Card)
  WeekNav.tsx                 -- Previous/next week navigation

/lib
  supabase.ts                 -- Supabase client (anon + service role)
  email.ts                    -- Brevo send helper (replaces current brevoSend())
  emailTemplates.ts           -- HTML email builders (replaces studentEmailHtml, adminEmailHtml, etc.)
  dates.ts                    -- getWeekKey, getWeekDates, fmtTime, fmtTimeRange (direct ports)

middleware.ts                 -- Clerk: protect /admin/* routes
```

---

## Auth Setup (Clerk)

1. Create Clerk app → enable **Email/Password** + **Magic Link** sign-in methods
2. Add `CLERK_SECRET_KEY` + `CLERK_PUBLISHABLE_KEY` to Vercel env vars
3. `middleware.ts` uses `clerkMiddleware()` to protect `/admin` routes
4. Admin panel API routes verify the Clerk session with `auth()` before using the Supabase service role key
5. Students are never authenticated — all their actions go through public API routes

---

## Realtime (replacing Firebase `onValue`)

Supabase Realtime subscriptions replace the two Firebase listeners:

```ts
// In Calendar component (client component)
supabase
  .channel('signups')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'signups',
      filter: `week_key=eq.${weekKey}` }, handleSignupChange)
  .subscribe()

supabase
  .channel('overrides')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'overrides',
      filter: `week_key=eq.${weekKey}` }, handleOverrideChange)
  .subscribe()
```

Both channels are torn down and re-subscribed when `weekKey` changes (same pattern as current `signupsUnsub` / `overridesUnsub`).

---

## API Routes

All data mutations that were direct Firebase calls become API route calls. Pattern:

| Current (Firebase direct) | New (API route) |
|---|---|
| `push(ref(db, 'signups/...'), entry)` | `POST /api/signups` |
| `remove(ref(db, 'signups/...'))` | `DELETE /api/signups?id=...` |
| `set(ref(db, 'schedule/...'), slot)` | `POST /api/classes` |
| `set(ref(db, 'overrides/...'), ov)` | `PUT /api/overrides` |
| `remove(ref(db, 'overrides/...'))` | `DELETE /api/overrides?...` |

Admin API routes check `auth()` from `@clerk/nextjs/server` and reject with 401 if no session.

---

## Email (Brevo — unchanged)

`/api/send-email/route.ts` is a direct port of `netlify/functions/send-email.js`. Same request/response shape. All email template functions move to `/lib/emailTemplates.ts` unchanged except for HTML-escaping user-supplied fields (name, email) to fix the XSS-in-email issue noted in the code review.

---

## Environment Variables

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server-only, never exposed to browser

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Brevo
BREVO_API_KEY=                      # server-only

# App config
ADMIN_EMAIL_1=intouchyoga@icloud.com
ADMIN_EMAIL_2=saredeswitzer@gmail.com
SENDER_EMAIL=saredeswitzer@gmail.com
```

---

## Data Migration

### What exists in Firebase
- **Classes** (`schedule/`): the recurring class definitions — a handful of entries
- **Signups** (`signups/{weekKey}/{slotId}/{pushId}`): every student name + email ever submitted, nested 3 levels deep
- **Overrides** (`overrides/{weekKey}/{slotId}`): per-week class modifications

Students do **not** have accounts — they are just `{name, email, timestamp}` entries inside the signups tree. There is nothing to migrate on the auth side for students. The admin gets a fresh Clerk account (created manually in the Clerk dashboard).

### Migration script (`scripts/migrate.ts`)

A one-time Node script run before go-live:

```
1. Download Firebase JSON export
   → Firebase console → Project Settings → Service accounts → Export database
   Output: firebase-export.json

2. Script reads firebase-export.json and:
   a. Iterates schedule/* → upserts into Supabase `classes` table
   b. Iterates signups/{weekKey}/{slotId}/{pushId} → flattens and inserts into
      Supabase `signups` (week_key, class_id, name, email, signed_up_at)
   c. Iterates overrides/{weekKey}/{slotId} → inserts into Supabase `overrides`

3. Script prints row counts for verification:
   "Migrated: X classes, Y signups, Z overrides"
```

### Student history preservation
- All historical signups (name + email) land in Supabase intact
- The "Email all students ever" feature continues to work — it queries the full `signups` table for unique emails
- Students don't need to do anything — next time they sign up they just type their name/email as before

### What is NOT migrated
- The admin password — replaced by Clerk account (set up separately)
- The Firebase `apiKey` / config — decommissioned after cutover

---

## Visual Design

The app's design (colors, fonts, calendar layout) is preserved exactly. CSS custom properties replace the hardcoded color values so they're defined once. DM Serif Display + DM Sans fonts remain (loaded via `next/font/google`).

---

## Branch Strategy

Work happens on a `beta` branch. `main` stays untouched and continues to serve the live Netlify site until you're ready to cut over.

```
main          ← current live site (Netlify, Firebase) — never touched during migration
beta          ← all migration work lands here
```

Vercel will auto-deploy the `beta` branch to a preview URL (e.g. `beta--aopweeklyschedule.vercel.app`) so you can test the new app side-by-side with the live one before switching.

**Cutover:** When ready, merge `beta` → `main`. Vercel takes over as the production host; Netlify and Firebase can be decommissioned.

---

## Migration Phases

### Phase 0 — Branch Setup
- Create `beta` branch from current `main`
- Initialize new Next.js project in the repo root on `beta`
- The existing `index.html`, `sw.js`, etc. are replaced by the Next.js project structure

### Phase 1 — Scaffold
- Init Next.js 14 project with Tailwind + Clerk + Supabase dependencies
- Set up Supabase project, run schema SQL, configure RLS
- Configure Clerk app (email/password + magic link), set up middleware
- Deploy skeleton to Vercel, confirm auth works

### Phase 2 — Core Schedule
- Port calendar rendering (`Calendar.tsx`, `ClassBlock.tsx`, `WeekNav.tsx`)
- Implement `GET /api/classes`, `GET /api/signups`, `GET /api/overrides`
- Wire Supabase Realtime for live spot counts

### Phase 3 — Signup / Cancel Flow
- Port `SignupModal.tsx` with sign up + cancel tabs
- Implement `POST /api/signups`, `DELETE /api/signups`
- Port email templates + Brevo API route

### Phase 4 — Admin Panel
- Port `AdminPanel.tsx` behind `/admin` (Clerk-protected)
- Implement admin API routes for class CRUD + override management
- Port broadcast email + weekly reminder + "email all ever" features

### Phase 5 — Migration & Go-Live
- Run data migration script against production
- Smoke test all features on Vercel preview URL
- Point domain / update Netlify redirect
- Decommission Firebase + Netlify

---

## PWA Support

The current app installs on phones as a standalone app (manifest + service worker). This is preserved in Next.js using the `next-pwa` package:

```ts
// next.config.ts
import withPWA from '@ducanh2912/next-pwa'; // maintained fork, works with latest Next.js
export default withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
})({});
```

- `manifest.json` moves to `public/manifest.json` (unchanged content)
- `icon-192.png` and `icon-512.png` move to `public/`
- `next-pwa` auto-generates the service worker — `sw.js` is deleted and not ported manually
- The stale `emailjs` bypass in the current `sw.js` is dropped naturally

---

## Vercel Configuration

No `vercel.json` needed — Next.js is auto-detected. The only Vercel-specific setup:

1. Connect GitHub repo to Vercel
2. Set **Production Branch** = `main`, which means `beta` gets a preview URL automatically
3. Add all environment variables (Supabase, Clerk, Brevo, admin emails) in Vercel dashboard
4. Vercel serverless functions handle `/api/*` routes — no separate functions directory needed (unlike Netlify)

---

## Clerk Setup Detail

1. Create app at clerk.com → name it "AOP Shala Admin"
2. Enable sign-in methods: **Email address + password** AND **Email magic link**
3. Disable social OAuth (not needed)
4. Copy `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` to `.env.local` and Vercel
5. In Clerk dashboard → Users → Create one user manually (the admin's email)
6. `middleware.ts` protects `/admin` and `/api/classes` (POST/DELETE), `/api/overrides`, `/api/students`:

```ts
// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
const isAdminRoute = createRouteMatcher(['/admin(.*)', '/api/admin(.*)']);
export default clerkMiddleware((auth, req) => {
  if (isAdminRoute(req)) auth().protect();
});
export const config = { matcher: ['/((?!_next|.*\\..*).*)'] };
```

7. Admin API routes verify session server-side with `auth()` before using the Supabase service role key — the service role key is never sent to the browser

---

## "Remember Me" Feature

No changes needed — this uses `localStorage` (`yoga_user` key) entirely client-side. It's ported as-is into `SignupModal.tsx`.

---

## Supabase Realtime Setup

Realtime must be enabled for the three tables in the Supabase dashboard:
- Dashboard → Database → Replication → enable `signups` and `overrides` tables

The `classes` table doesn't need realtime (schedule changes are infrequent and a page refresh is acceptable).

---

## Verification

- Admin can sign in with both email/password and magic link via Clerk
- Non-admin cannot access `/admin` (redirected to sign-in)
- Student can sign up for a class; spot count updates in real-time for all viewers
- Student can cancel their signup by email
- Admin can add, edit (this week), and permanently delete classes
- Admin can cancel a class for a specific week; signed-up students receive email
- Signup/cancellation confirmation emails arrive for student and admin
- Broadcast email sends to all students in a class
- "Email all students ever" fetches from full signups history and sends
- Weekly reminder sends to all unique students ever
- Data migration: row counts in Supabase match Firebase export
