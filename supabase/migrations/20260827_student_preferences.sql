-- Per-student notification preferences: phone number + opt-in for email/SMS.
-- Set once on a student's first signup, editable anytime at /preferences.
-- Missing row = defaults (email on, SMS off), matching pre-existing behavior.

create table if not exists student_preferences (
  email        text primary key,
  phone        text,
  email_opt_in boolean not null default true,
  sms_opt_in   boolean not null default false,
  updated_at   timestamptz not null default now()
);

-- No public policies: only the server-side service-role client
-- (supabaseAdmin()) reads/writes this table, so RLS with zero policies
-- blocks the anon/public key from ever seeing it over the REST API.
alter table student_preferences enable row level security;
