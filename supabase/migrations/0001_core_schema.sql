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
