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
