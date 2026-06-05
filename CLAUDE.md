# AOP Shala NYC — Weekly Schedule

A single-page PWA for yoga class scheduling and student signups for AOP Shala NYC.

## Stack

- **Frontend**: Vanilla HTML/CSS/JS (all in `index.html`) — no build step
- **Database**: Firebase Realtime Database (signups, schedule, weekly overrides)
- **Email**: Brevo transactional API via Netlify serverless function
- **Hosting**: Netlify (static site + functions)
- **PWA**: Service worker in `sw.js`, manifest in `manifest.json`

## Project Structure

```
index.html                    # Entire frontend (HTML + CSS + JS, ~1150 lines)
sw.js                         # Service worker — cache-first for assets, network-first otherwise
manifest.json                 # PWA manifest
netlify.toml                  # Netlify build config (functions dir, Node version)
netlify/functions/
  send-email.js               # Serverless function — proxies email sends to Brevo API
icon-192.png / icon-512.png   # PWA icons
```

## Environment Variables

Set in Netlify dashboard (Production) and `.env.local` (local dev via `netlify dev`).

| Variable        | Used by                          | Description                     |
|-----------------|----------------------------------|---------------------------------|
| `BREVO_API_KEY` | `netlify/functions/send-email.js`| Brevo transactional email API key|

## Local Development

Requires the Netlify CLI to run functions locally:

```bash
npm install -g netlify-cli
netlify dev
```

`netlify dev` reads `.env.local` automatically and serves the site at `http://localhost:8888`.

## Key Concepts

### Data model (Firebase Realtime Database)
- `schedule/` — array of class slot objects `{id, day, time, endTime, className, location, capacity}`
- `signups/{weekKey}/{slotId}/{pushId}` — student signup entries `{name, email, ts}`
- `overrides/{weekKey}/{slotId}` — per-week slot overrides `{cancelled, time, location, ...}`

### Week key
Weeks are keyed by the Sunday date of that week in `YYYY-MM-DD` format. `getWeekKey(date)` derives the key from any date.

### Admin panel
Protected by a plaintext password (`ADMIN_PASSWORD` in `index.html`). Admin can add/edit/cancel slots, remove signups, and send bulk email to enrolled students or all-time students.

### Email flow
All emails go through `/.netlify/functions/send-email` (never directly from the browser). The function uses `BREVO_API_KEY` from the environment. Sender is `saredeswitzer@gmail.com`, reply-to is `intouchyoga@icloud.com`.

### Location color coding
Four CSS classes map locations to colors:
- `loc-turtle` — Turtle Pond / Central Park
- `loc-westend` — 21 West End Ave
- `loc-80th` — 102 West 80th St
- `loc-other` — anything else

## Planned Migration

A full migration to Next.js + Supabase + Clerk + shadcn/ui is planned. See `MIGRATION_PLAN.md` in the repo root for the complete plan including schema, branch strategy, auth setup, data migration, and phased implementation steps.

Work happens on a `beta` branch — `main` stays live on Netlify/Firebase until cutover.

## Known Issues / Tech Debt

- Admin password is hardcoded in plaintext in `index.html` — visible in DevTools. Should move to Firebase Authentication.
- User-supplied fields (student name/email) are not HTML-escaped before being inserted into admin notification emails — low-severity XSS risk in email clients.
- `sw.js` references `emailjs` in a bypass check but EmailJS is no longer used (replaced by Brevo).
- All code lives in one file (`index.html`). Worth splitting into `app.js` + `styles.css` when making significant changes.
- Firebase database security rules should be audited to ensure they are not set to public read/write.
