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
