# AOP Shala NYC — Weekly Schedule

A PWA for yoga class scheduling and student signups for AOP Shala NYC.

## Branches

| Branch | Status | Stack |
|--------|--------|-------|
| `main` | Live on Netlify + Firebase | Vanilla HTML/JS, single `index.html` |
| `beta` | Migration in progress — Vercel preview | Next.js + Supabase + Clerk |

**All development happens on `beta`. Never touch `main` during migration.**

---

## Beta Branch Stack

| Layer | Technology |
|---|---|
| Frontend + API routes | Next.js 16 (App Router) on Vercel |
| Database | Supabase Postgres + Realtime |
| Auth (admin only) | Clerk — email/password + magic link |
| Email | Brevo (unchanged) via Next.js API route |
| Styling | Tailwind CSS + shadcn/ui |
| PWA | `@ducanh2912/next-pwa` (auto-generates service worker) |

## Project Structure (beta)

```
app/
  layout.tsx              # ClerkProvider + DM Sans/DM Serif fonts + global styles
  page.tsx                # Schedule view (public)
  /admin/
    layout.tsx            # Clerk auth guard
    page.tsx              # Admin panel
  /api/
    /classes/route.ts     # GET public, POST/PUT/DELETE admin
    /signups/route.ts     # GET public, POST public, DELETE (email match or admin)
    /overrides/route.ts   # GET public, PUT/DELETE admin
    /send-email/route.ts  # Brevo proxy
    /students/route.ts    # GET all unique students (admin only)

components/
  /ui/                    # shadcn/ui primitives
  Calendar.tsx            # 7-day grid
  ClassBlock.tsx          # Individual class card
  SignupModal.tsx         # Sign up / cancel modal
  AdminPanel.tsx          # Add/edit/delete classes, broadcast email
  WeekNav.tsx             # Previous/next week navigation

lib/
  supabase.ts             # Supabase anon client + supabaseAdmin() (server-only)
  email.ts                # Brevo send helper
  emailTemplates.ts       # HTML email builders
  dates.ts                # getWeekKey, getWeekDates, fmtTime, fmtTimeRange

middleware.ts             # Clerk: protects /admin/* routes
public/
  manifest.json           # PWA manifest
  icon-192.png
  icon-512.png
```

## Environment Variables

Fill in `.env.local` for local dev. Mirror all in Vercel dashboard.

| Variable | Used by | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `lib/supabase.ts` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `lib/supabase.ts` | Supabase anon key (public reads) |
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase.ts` (server only) | Admin writes — never sent to browser |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk middleware + API routes | Clerk secret — server only |
| `BREVO_API_KEY` | `/api/send-email` | Brevo transactional email |
| `ADMIN_EMAIL_1` | email templates | intouchyoga@icloud.com |
| `ADMIN_EMAIL_2` | email templates | saredeswitzer@gmail.com |
| `SENDER_EMAIL` | email templates | saredeswitzer@gmail.com |

## Local Development

```bash
npm run dev    # starts at http://localhost:3000
```

`.env.local` is read automatically by Next.js. No CLI wrapper needed (unlike Netlify).

## Key Concepts

### Data model (Supabase Postgres)
- `classes` — recurring class definitions `{id, day, time, end_time, class_name, location, capacity}`
- `signups` — student signup entries `{id, week_key, class_id, name, email, signed_up_at}`
- `overrides` — per-week slot overrides `{id, week_key, class_id, cancelled, time, ...}`

### Week key
Weeks are keyed by the Sunday date of that week in `YYYY-MM-DD` format. `getWeekKey(date)` in `lib/dates.ts`.

### Auth
Admin-only via Clerk. Students are never authenticated — they sign up with name + email only. Clerk middleware in `middleware.ts` guards `/admin` and admin API routes. API routes verify the session with `auth()` from `@clerk/nextjs/server` before using the Supabase service role key.

### Email flow
All emails go through `/api/send-email` (Next.js API route). Sender is `saredeswitzer@gmail.com`, reply-to is `intouchyoga@icloud.com`.

### Location color coding
Four CSS classes map locations to colors:
- `loc-turtle` — Turtle Pond / Central Park
- `loc-westend` — 21 West End Ave
- `loc-80th` — 102 West 80th St
- `loc-other` — anything else

### Realtime
Supabase Realtime subscriptions in the Calendar component watch `signups` and `overrides` filtered by `week_key`. Channels are torn down and re-subscribed on week navigation.

## Migration Status

| Phase | Status | Description |
|---|---|---|
| Phase 0 — Branch Setup | **Done** | beta branch created, Next.js scaffolded |
| Phase 1 — Scaffold | Not started | Supabase schema, Clerk app, Vercel deploy |
| Phase 2 — Core Schedule | Not started | Calendar UI ported to React |
| Phase 3 — Signup / Cancel | Not started | SignupModal + email |
| Phase 4 — Admin Panel | Not started | Auth-protected admin |
| Phase 5 — Go-Live | Not started | Data migration + cutover |

See `MIGRATION_PLAN.md` for full details including schema SQL, RLS policies, and data migration script.
