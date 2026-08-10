-- Emails an admin has flagged (typo'd / bouncing addresses, or students to
-- drop from the mailing list). Blocked emails cannot create new signups and
-- are skipped by admin broadcasts + weekly reminders. Run this once in the
-- Supabase SQL editor (Project → SQL Editor → New query → paste → Run).

create table if not exists blocked_emails (
  email      text primary key,
  name       text,
  reason     text,
  created_at timestamptz not null default now()
);

-- No public policies: only the server-side service-role client
-- (supabaseAdmin()) reads/writes this table, so RLS with zero policies
-- blocks the anon/public key from ever seeing it over the REST API.
alter table blocked_emails enable row level security;

-- Seed: Melanie Baker's email on file has a typo (verizon.MET instead of
-- verizon.NET) and keeps propagating through her remembered-signup flow.
insert into blocked_emails (email, name, reason)
values ('melvinpp@verizon.met', 'Melanie Baker', 'Email typo (.met instead of .net) — ask her to correct it before signing up again')
on conflict (email) do nothing;
