-- ------------------------------------------------------------------
-- MindTrace = FULL SETUP (one paste, one Run)
-- Paste this WHOLE file into: Supabase Dashboard > SQL Editor > New query > Run
-- Idempotent: safe to re-run. Never disables RLS. Created 2026-11-10
-- ------------------------------------------------------------------


-- --------------- 0001_core_schema.sql ---------------

-- ══════════════════════════════════════════════════════════════════
-- MindTrace · 0001 — core schema (tables, indexes, integrity triggers)
-- Idempotent: safe to re-run. Run in the Supabase SQL editor.
-- Tables match the user's brief: profiles, journeys, daily_sessions,
-- user_responses, journal_entries, wellness_reports, certificates.
-- ══════════════════════════════════════════════════════════════════

-- ── profiles ─────────────────────────────────────────────────────
-- One row per auth user; credentials never live here (Supabase Auth owns those).
create table if not exists public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  full_name          text        not null default '' check (char_length(full_name) <= 80),
  age_range          text,
  preferred_language text,
  timezone           text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Onboarding wizard context + consent state (structured, never credentials).
alter table public.profiles add column if not exists context jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists consent jsonb not null default '{}'::jsonb;

-- ── journeys ─────────────────────────────────────────────────────
create table if not exists public.journeys (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users (id) on delete cascade,
  timezone     text        not null default 'UTC',
  start_date   date        not null,                 -- local start date (user timezone)
  status       text        not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- At most ONE active journey per user (prevents duplicate program starts).
create unique index if not exists journeys_one_active_per_user
  on public.journeys (user_id) where status = 'active';
create index if not exists journeys_user_idx on public.journeys (user_id, created_at desc);

-- ── daily_sessions ───────────────────────────────────────────────
create table if not exists public.daily_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users (id) on delete cascade,
  journey_id      uuid        not null references public.journeys (id) on delete cascade,
  day             int         not null check (day between 1 and 7),
  status          text        not null default 'pending' check (status in ('pending', 'in-progress', 'complete')),
  started_at      timestamptz,
  completed_at    timestamptz,
  effective_date  date,                                 -- local date the session ran
  time_spent_sec  int         not null default 0        check (time_spent_sec >= 0 and time_spent_sec <= 86400),
  qids            jsonb       not null default '[]'::jsonb,   -- selected question order
  skipped         jsonb       not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Exactly one session per (journey, day) — no duplicate days.
create unique index if not exists daily_sessions_unique_day
  on public.daily_sessions (journey_id, day);
create index if not exists daily_sessions_user_idx on public.daily_sessions (user_id, day);
-- Composite key used by user_responses for ownership-consistent FK.
create unique index if not exists daily_sessions_id_user_uniq
  on public.daily_sessions (id, user_id);

-- ── user_responses ───────────────────────────────────────────────
create table if not exists public.user_responses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users (id) on delete cascade,
  session_id    uuid        not null references public.daily_sessions (id) on delete cascade,
  question_key  text        not null check (char_length(question_key) <= 64),
  question_text text        not null default '',        -- stable prompt snapshot
  question_type text        not null default 'text'
                check (question_type in ('emotion', 'choice', 'scale', 'text', 'time', 'multi', 'yes-no', 'journal')),
  answer        jsonb       not null,
  answer_label  jsonb,                                  -- optional display labels
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Autosave upsert target: one response per question per session.
create unique index if not exists user_responses_session_question_uniq
  on public.user_responses (session_id, question_key);
create index if not exists user_responses_user_idx on public.user_responses (user_id, created_at desc);

-- ── journal_entries ──────────────────────────────────────────────
-- Content is private to the author. ai_consent=false means "never analyzed".
create table if not exists public.journal_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  day        int check (day is null or day between 1 and 7),
  entry_date date        not null default (current_date),
  content    text        not null check (char_length(content) <= 20000),
  ai_consent boolean     not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists journal_entries_user_idx on public.journal_entries (user_id, created_at desc);

-- ── wellness_reports ─────────────────────────────────────────────
-- Structured JSON analysis; generated once per journey (unique index).
create table if not exists public.wellness_reports (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users (id) on delete cascade,
  journey_id  uuid        not null references public.journeys (id) on delete cascade,
  engine      text        not null default 'rule-based-v1',
  report      jsonb       not null,
  generated_at timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists wellness_reports_one_per_journey
  on public.wellness_reports (journey_id);
create index if not exists wellness_reports_user_idx on public.wellness_reports (user_id, created_at desc);

-- ── certificates ─────────────────────────────────────────────────
create table if not exists public.certificates (
  id            text primary key check (id ~ '^MT7-[A-Z0-9]{4}-[A-Z0-9]{4}$'),
  user_id       uuid        not null references auth.users (id) on delete cascade,
  journey_id    uuid        references public.journeys (id) on delete set null,
  full_name     text        not null check (char_length(full_name) <= 80),
  issued_at     timestamptz not null default now(),
  storage_bucket text       not null default 'certificates',
  storage_path  text        not null,
  file_size     int check (file_size is null or (file_size > 0 and file_size <= 5242880)),
  revoked       boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists certificates_user_idx on public.certificates (user_id, created_at desc);

-- ══════════════════════════════════════════════════════════════════
-- Integrity triggers
-- ══════════════════════════════════════════════════════════════════

-- shared updated_at touch
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'journeys', 'daily_sessions', 'user_responses',
                           'journal_entries', 'wellness_reports', 'certificates']
  loop
    execute format('drop trigger if exists tr_touch_updated_at on public.%I', t);
    execute format('create trigger tr_touch_updated_at before update on public.%I
                    for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- New auth users get a profile row automatically (idempotent).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Responses: never overwrite a stored non-empty answer with an empty one.
create or replace function public.guard_response_empty() returns trigger
language plpgsql set search_path = public as $$
declare blank_rows constant text[] := array['null', '"null"', '""', '[]', '{}', '[ "" ]'];
begin
  if new.answer is null or new.answer::text = any(blank_rows) then
    if tg_op = 'UPDATE' and not (old.answer is null or old.answer::text = any(blank_rows)) then
      new.answer := old.answer;   -- keep the previous value
    else
      raise exception 'RESPONSE_CANNOT_BE_EMPTY';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists tr_guard_response_empty on public.user_responses;
create trigger tr_guard_response_empty
  before insert or update on public.user_responses
  for each row execute function public.guard_response_empty();

-- Responses: the session must belong to the same user who writes the row.
create or replace function public.guard_response_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.daily_sessions s
    where s.id = new.session_id and s.user_id = new.user_id
  ) then
    raise exception 'RESPONSE_SESSION_MISMATCH';
  end if;
  return new;
end $$;

drop trigger if exists tr_guard_response_owner on public.user_responses;
create trigger tr_guard_response_owner
  before insert or update on public.user_responses
  for each row execute function public.guard_response_owner();

-- Sessions: must complete in day order; completion stamps the timestamp.
create or replace function public.guard_session_order() returns trigger
language plpgsql security definer set search_path = public as $$
declare prior_ok int;
begin
  if new.status = 'complete' and new.day > 1 then
    select count(*) into prior_ok
    from public.daily_sessions
    where journey_id = new.journey_id and day < new.day and status = 'complete';
    if prior_ok < new.day - 1 then
      raise exception 'SESSION_SEQUENCE_VIOLATION: day % cannot complete before earlier days', new.day;
    end if;
  end if;
  if new.status = 'complete' and new.completed_at is null then
    new.completed_at := now();
  end if;
  return new;
end $$;

drop trigger if exists tr_guard_session_order on public.daily_sessions;
create trigger tr_guard_session_order
  before insert or update on public.daily_sessions
  for each row execute function public.guard_session_order();

-- Journeys: completing requires ALL 7 sessions complete.
create or replace function public.guard_journey_completion() returns trigger
language plpgsql security definer set search_path = public as $$
declare done_days int;
begin
  if new.status = 'completed' then
    select count(*) into done_days
    from public.daily_sessions
    where journey_id = new.id and status = 'complete';
    if done_days < 7 then
      raise exception 'JOURNEY_INCOMPLETE: only % of 7 sessions done', done_days;
    end if;
    if new.completed_at is null then
      new.completed_at := now();
    end if;
  end if;
  return new;
end $$;

drop trigger if exists tr_guard_journey_completion on public.journeys;
create trigger tr_guard_journey_completion
  before update on public.journeys
  for each row execute function public.guard_journey_completion();



-- --------------- 0002_rls_policies.sql ---------------

-- ══════════════════════════════════════════════════════════════════
-- MindTrace · 0002 — Row Level Security + ownership policies
-- Idempotent. RLS is NEVER disabled anywhere in this project.
-- Every table is owner-scoped: auth.uid() must equal user_id / id.
-- Cross-user access therefore always resolves to zero rows.
-- ══════════════════════════════════════════════════════════════════

alter table public.profiles        enable row level security;
alter table public.journeys        enable row level security;
alter table public.daily_sessions  enable row level security;
alter table public.user_responses  enable row level security;
alter table public.journal_entries enable row level security;
alter table public.wellness_reports enable row level security;
alter table public.certificates    enable row level security;

-- Helper: create a policy only when missing (idempotency for PG without
-- "create policy if not exists").
create or replace function public.__policy_exists(p_table text, p_name text)
returns boolean language plpgsql set search_path = public as $$
begin
  return exists (select 1 from pg_policies where schemaname = 'public' and tablename = p_table and policyname = p_name);
end $$;

-- ── profiles ─────────────────────────────────────────────────────
do $$
begin
  if not public.__policy_exists('profiles', 'profiles_select_own')
    then create policy profiles_select_own on public.profiles for select using (id = auth.uid()); end if;
  if not public.__policy_exists('profiles', 'profiles_insert_own')
    then create policy profiles_insert_own on public.profiles for insert with check (id = auth.uid()); end if;
  if not public.__policy_exists('profiles', 'profiles_update_own')
    then create policy profiles_update_own on public.profiles for update using (id = auth.uid()) with check (id = auth.uid()); end if;
  if not public.__policy_exists('profiles', 'profiles_delete_own')
    then create policy profiles_delete_own on public.profiles for delete using (id = auth.uid()); end if;
end $$;

-- ── journeys ─────────────────────────────────────────────────────
do $$
begin
  if not public.__policy_exists('journeys', 'journeys_select_own')
    then create policy journeys_select_own on public.journeys for select using (user_id = auth.uid()); end if;
  if not public.__policy_exists('journeys', 'journeys_insert_own')
    then create policy journeys_insert_own on public.journeys for insert with check (user_id = auth.uid()); end if;
  if not public.__policy_exists('journeys', 'journeys_update_own')
    then create policy journeys_update_own on public.journeys for update using (user_id = auth.uid()) with check (user_id = auth.uid()); end if;
  if not public.__policy_exists('journeys', 'journeys_delete_own')
    then create policy journeys_delete_own on public.journeys for delete using (user_id = auth.uid()); end if;
end $$;

-- ── daily_sessions ───────────────────────────────────────────────
do $$
begin
  if not public.__policy_exists('daily_sessions', 'sessions_select_own')
    then create policy sessions_select_own on public.daily_sessions for select using (user_id = auth.uid()); end if;
  if not public.__policy_exists('daily_sessions', 'sessions_insert_own')
    then create policy sessions_insert_own on public.daily_sessions for insert with check (user_id = auth.uid()); end if;
  if not public.__policy_exists('daily_sessions', 'sessions_update_own')
    then create policy sessions_update_own on public.daily_sessions for update using (user_id = auth.uid()) with check (user_id = auth.uid()); end if;
  if not public.__policy_exists('daily_sessions', 'sessions_delete_own')
    then create policy sessions_delete_own on public.daily_sessions for delete using (user_id = auth.uid()); end if;
end $$;

-- ── user_responses ───────────────────────────────────────────────
do $$
begin
  if not public.__policy_exists('user_responses', 'responses_select_own')
    then create policy responses_select_own on public.user_responses for select using (user_id = auth.uid()); end if;
  if not public.__policy_exists('user_responses', 'responses_insert_own')
    then create policy responses_insert_own on public.user_responses for insert with check (user_id = auth.uid()); end if;
  if not public.__policy_exists('user_responses', 'responses_update_own')
    then create policy responses_update_own on public.user_responses for update using (user_id = auth.uid()) with check (user_id = auth.uid()); end if;
  if not public.__policy_exists('user_responses', 'responses_delete_own')
    then create policy responses_delete_own on public.user_responses for delete using (user_id = auth.uid()); end if;
end $$;

-- ── journal_entries ──────────────────────────────────────────────
-- Private by design: journal content is readable/writable ONLY by its author.
-- No aggregate or "reader" policy exists. AI processing requires ai_consent.
do $$
begin
  if not public.__policy_exists('journal_entries', 'journal_select_own')
    then create policy journal_select_own on public.journal_entries for select using (user_id = auth.uid()); end if;
  if not public.__policy_exists('journal_entries', 'journal_insert_own')
    then create policy journal_insert_own on public.journal_entries for insert with check (user_id = auth.uid()); end if;
  if not public.__policy_exists('journal_entries', 'journal_update_own')
    then create policy journal_update_own on public.journal_entries for update using (user_id = auth.uid()) with check (user_id = auth.uid()); end if;
  if not public.__policy_exists('journal_entries', 'journal_delete_own')
    then create policy journal_delete_own on public.journal_entries for delete using (user_id = auth.uid()); end if;
end $$;

-- ── wellness_reports ─────────────────────────────────────────────
do $$
begin
  if not public.__policy_exists('wellness_reports', 'reports_select_own')
    then create policy reports_select_own on public.wellness_reports for select using (user_id = auth.uid()); end if;
  if not public.__policy_exists('wellness_reports', 'reports_insert_own')
    then create policy reports_insert_own on public.wellness_reports for insert with check (user_id = auth.uid()); end if;
  if not public.__policy_exists('wellness_reports', 'reports_update_own')
    then create policy reports_update_own on public.wellness_reports for update using (user_id = auth.uid()) with check (user_id = auth.uid()); end if;
  if not public.__policy_exists('wellness_reports', 'reports_delete_own')
    then create policy reports_delete_own on public.wellness_reports for delete using (user_id = auth.uid()); end if;
end $$;

-- ── certificates ─────────────────────────────────────────────────
do $$
begin
  if not public.__policy_exists('certificates', 'certs_select_own')
    then create policy certs_select_own on public.certificates for select using (user_id = auth.uid()); end if;
  if not public.__policy_exists('certificates', 'certs_insert_own')
    then create policy certs_insert_own on public.certificates for insert with check (user_id = auth.uid()); end if;
  if not public.__policy_exists('certificates', 'certs_update_own')
    then create policy certs_update_own on public.certificates for update using (user_id = auth.uid()) with check (user_id = auth.uid()); end if;
  if not public.__policy_exists('certificates', 'certs_delete_own')
    then create policy certs_delete_own on public.certificates for delete using (user_id = auth.uid()); end if;
end $$;



-- --------------- 0003_storage.sql ---------------

-- ══════════════════════════════════════════════════════════════════
-- MindTrace · 0003 — private certificate storage
-- Idempotent. The "certificates" bucket is PRIVATE; every object lives
-- under "<user-id>/" and only that owner can read, write, or delete it.
-- ══════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'certificates',
  'certificates',
  false,
  5242880,  -- 5 MB
  array['application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = 5242880,
      allowed_mime_types = array['application/pdf'];

-- Owner-scoped access: first path segment must equal the user's id.
-- (create policy if not exists is unavailable; guard each manually.)

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'certs_owner_read'
  ) then
    create policy certs_owner_read on storage.objects for select to authenticated
    using (
      bucket_id = 'certificates'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'certs_owner_insert'
  ) then
    create policy certs_owner_insert on storage.objects for insert to authenticated
    with check (
      bucket_id = 'certificates'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'certs_owner_update'
  ) then
    create policy certs_owner_update on storage.objects for update to authenticated
    using (
      bucket_id = 'certificates'
      and (storage.foldername(name))[1] = auth.uid()::text
    )
    with check (
      bucket_id = 'certificates'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'certs_owner_delete'
  ) then
    create policy certs_owner_delete on storage.objects for delete to authenticated
    using (
      bucket_id = 'certificates'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
  end if;
end $$;



-- --------------- 0004_functions_rpcs.sql ---------------

-- ══════════════════════════════════════════════════════════════════
-- MindTrace · 0004 — SECURITY DEFINER functions (minimal, purpose-scoped)
-- Idempotent. Functions never return personal content:
--   · get_cert_verification  → public, verify a certificate ID (no PII beyond name)
--   · admin_aggregates       → authenticated only, aggregate counts only
--   · enforce_report_gate    → internal guard (not executable by clients)
-- ══════════════════════════════════════════════════════════════════

-- ── certificate verification (public lookup by exact ID) ─────────
create or replace function public.get_cert_verification(p_cert_id text)
returns table (
  cert_id     text,
  full_name   text,
  issued_at   timestamptz,
  program     text,
  valid       boolean,
  revoked     boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.full_name,
    c.issued_at,
    'MindTrace — Seven Days. A Better Understanding of Yourself.'::text,
    c.revoked = false,
    c.revoked
  from public.certificates c
  where c.id = upper(btrim(coalesce(p_cert_id, '')))
$$;

revoke all on function public.get_cert_verification(text) from anon, authenticated, public;
grant execute on function public.get_cert_verification(text) to anon, authenticated;

-- ── admin aggregates (counts only — no journals, answers, names) ─
create or replace function public.admin_aggregates()
returns table (
  total_users          bigint,
  total_journeys       bigint,
  active_journeys      bigint,
  completed_journeys   bigint,
  total_sessions       bigint,
  completed_sessions   bigint,
  answers_stored       bigint,
  journal_entries      bigint,
  reports_generated    bigint,
  certificates_issued  bigint,
  revoked_certificates bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.profiles)::bigint,
    (select count(*) from public.journeys)::bigint,
    (select count(*) from public.journeys where status = 'active')::bigint,
    (select count(*) from public.journeys where status = 'completed')::bigint,
    (select count(*) from public.daily_sessions)::bigint,
    (select count(*) from public.daily_sessions where status = 'complete')::bigint,
    (select count(*) from public.user_responses)::bigint,
    (select count(*) from public.journal_entries)::bigint,
    (select count(*) from public.wellness_reports)::bigint,
    (select count(*) from public.certificates)::bigint,
    (select count(*) from public.certificates where revoked)::bigint
$$;

revoke all on function public.admin_aggregates() from anon, public;
grant execute on function public.admin_aggregates() to authenticated;

-- ── internal defense: reports only for fully completed journeys ──
create or replace function public.enforce_report_gate() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare done_days int;
begin
  select count(*) into done_days
  from public.daily_sessions
  where user_id = new.user_id and journey_id = new.journey_id and status = 'complete';

  if done_days < 7 then
    raise exception 'JOURNEY_INCOMPLETE: % of 7 sessions completed — report generation is blocked', done_days;
  end if;
  return new;
end $$;

drop trigger if exists tr_enforce_report_gate on public.wellness_reports;
create trigger tr_enforce_report_gate
  before insert or update on public.wellness_reports
  for each row execute function public.enforce_report_gate();

-- ── internal defense: certificates require a completed journey ───
create or replace function public.enforce_cert_gate() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare done_days int;
begin
  if new.journey_id is not null then
    select count(*) into done_days
    from public.daily_sessions
    where user_id = new.user_id and journey_id = new.journey_id and status = 'complete';
    if done_days < 7 then
      raise exception 'JOURNEY_INCOMPLETE: certificates require 7 completed sessions';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists tr_enforce_cert_gate on public.certificates;
create trigger tr_enforce_cert_gate
  before insert or update on public.certificates
  for each row execute function public.enforce_cert_gate();


