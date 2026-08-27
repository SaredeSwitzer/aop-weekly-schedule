-- Per-student, per-device Web Push subscriptions. A student can have more
-- than one device (phone + laptop), so this is keyed by endpoint, not email.
-- Mirrors the existing admin-only `push_subscriptions` table, but scoped to
-- a student email so notifyStudent() can target just that student's devices.

create table if not exists student_push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

create index if not exists student_push_subscriptions_email_idx
  on student_push_subscriptions (email);

-- No public policies: only the server-side service-role client
-- (supabaseAdmin()) reads/writes this table, same pattern as
-- student_preferences and blocked_emails.
alter table student_push_subscriptions enable row level security;
