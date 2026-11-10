"use server";

/**
 * Response autosave + session lifecycle actions (phase 6 backend).
 *
 * · Autosave NEVER reports success before the database confirms it
 *   (the action returns the DB timestamp; UI copies that state).
 * · Empty answers are rejected: the DB trigger also refuses them, so a
 *   user can never accidentally wipe a stored answer with a blank one.
 * · Completion requires EVERY non-skipped planned question to have a
 *   stored response — verified server-side, not by the client.
 * · A session can only be worked on after its calendar window opened
 *   (server timezone math) and while status ≠ complete.
 */
import { createClient } from "@/utils/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { localDateInTz, openDayForDate } from "@/lib/tz";
import type { ActionErr } from "./profile";
import type { DailySessionDTO, JourneyRow } from "./journey";

type Err = ActionErr;
export type ActionResult<T> = { ok: true; data: T } | Err;

/* ── validate payloads ─────────────────────────────────────────── */

const QTYPES = ["emotion", "choice", "scale", "text", "time", "multi", "yes-no", "journal"] as const;
type QTypeLit = (typeof QTYPES)[number];

function validKey(k: unknown): k is string {
  return typeof k === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(k);
}

function validAnswer(a: unknown): boolean {
  if (typeof a === "string") return a.length > 0 && a.length <= 4000;
  if (typeof a === "number") return Number.isFinite(a) && Math.abs(a) <= 1_000_000;
  if (Array.isArray(a)) {
    return a.length > 0 && a.length <= 24 && a.every((s) => typeof s === "string" && s.length <= 240);
  }
  return false;
}

function validLabel(l: unknown): boolean {
  if (l === undefined || l === null) return true;
  if (Array.isArray(l)) {
    return l.length <= 24 && l.every((s) => typeof s === "string" && s.length <= 240);
  }
  return typeof l === "string" ? l.length <= 240 : false;
}

/* ── shared load helper ───────────────────────────────────────── */

type SessionCtx = { session: DailySessionDTO; journey: JourneyRow };

async function loadOwnSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  uid: string,
  sessionId: string,
): Promise<{ err: Err | null; ctx: SessionCtx | null }> {
  const { data, error } = await supabase
    .from("daily_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", uid)
    .maybeSingle();
  if (error || !data) {
    console.error("[responses] session load failed:", error?.code ?? "not-found");
    return { err: { ok: false, error: "SESSION_NOT_FOUND", detail: "That session doesn't exist for your account." }, ctx: null };
  }
  const { data: journey, error: jErr } = await supabase
    .from("journeys")
    .select("*")
    .eq("id", (data as { journey_id: string }).journey_id)
    .maybeSingle();
  if (jErr || !journey) return { err: { ok: false, error: "SESSION_NOT_FOUND" }, ctx: null };
  return {
    ctx: {
      session: {
        id: (data as { id: string }).id,
        day: Number((data as { day: number }).day),
        status: (data as { status: DailySessionDTO["status"] }).status,
        startedAt: (data as { started_at: string | null }).started_at ?? null,
        completedAt: (data as { completed_at: string | null }).completed_at ?? null,
        timeSpentSec: Number((data as { time_spent_sec: number }).time_spent_sec ?? 0),
        effectiveDate: (data as { effective_date: string | null }).effective_date ?? null,
        qids: (data as { qids: string[] }).qids ?? [],
        skipped: (data as { skipped: string[] }).skipped ?? [],
      },
      journey: journey as JourneyRow,
    },
    err: null,
  };
}

/* ── plan a session (question order), mark in-progress ────────── */

export async function planSessionAction(
  sessionId: string,
  qids: unknown,
  tz: string,
): Promise<ActionResult<{ startedAt: string }>> {
  if (typeof sessionId !== "string" || sessionId.length !== 36) return { ok: false, error: "VALIDATION" };
  if (!Array.isArray(qids) || qids.length === 0 || qids.length > 40 || !qids.every(validKey)) {
    return { ok: false, error: "VALIDATION", detail: "bad qids" };
  }

  const supabase = await createClient();
  const { data: ud, error: aerr } = await supabase.auth.getUser();
  if (aerr || !ud.user?.id) return { ok: false, error: "AUTH_REQUIRED" };
  const uid = ud.user.id;

  const rl = rateLimit(`plan:${uid}`, 30, 60_000);
  if (!rl.ok) return { ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec };

  const ctx0 = await loadOwnSession(supabase, uid, sessionId);
  if (ctx0.err || !ctx0.ctx) return ctx0.err ?? { ok: false, error: "SESSION_NOT_FOUND" };
  const ctx = ctx0.ctx;

  if (ctx.session.status === "complete") return { ok: false, error: "SESSION_CLOSED" };

  // Calendar gate: this day must already be open in the user's timezone.
  const today = localDateInTz(tz);
  const openDay = openDayForDate(ctx.journey.start_date, today);
  if (ctx.session.day > openDay) {
    return { ok: false, error: "VALIDATION", detail: "day-not-open" };
  }

  const { error } = await supabase
    .from("daily_sessions")
    .update({
      qids,
      status: "in-progress",
      started_at: ctx.session.startedAt ?? new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("user_id", uid);

  if (error) {
    console.error("[planSession] db error:", error.code ?? "unknown");
    return { ok: false, error: "DB" };
  }
  return { ok: true, data: { startedAt: ctx.session.startedAt ?? new Date().toISOString() } };
}

/* ── autosave one response ────────────────────────────────────── */

export async function upsertResponseAction(input: {
  session_id: string;
  question_key: unknown;
  question_text: unknown;
  question_type: unknown;
  answer: unknown;
  answer_label?: unknown;
}): Promise<ActionResult<{ savedAt: string }>> {
  const p = input;
  if (typeof p?.session_id !== "string" || p.session_id.length !== 36) return { ok: false, error: "VALIDATION" };
  if (!validKey(p.question_key)) return { ok: false, error: "VALIDATION", detail: "bad key" };
  if (!validAnswer(p.answer)) return { ok: false, error: "EMPTY_ANSWER", detail: "Refusing to save an empty answer." };
  if (!validLabel(p.answer_label)) return { ok: false, error: "VALIDATION" };
  const qType = QTYPES.includes(p.question_type as QTypeLit) ? (p.question_type as QTypeLit) : "text";
  const qText = typeof p.question_text === "string" ? p.question_text.slice(0, 600) : "";

  const supabase = await createClient();
  const { data: ud, error: aerr } = await supabase.auth.getUser();
  if (aerr || !ud.user?.id) return { ok: false, error: "AUTH_REQUIRED" };
  const uid = ud.user.id;

  const rl = rateLimit(`save:${uid}`, 120, 60_000);
  if (!rl.ok) return { ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec };

  const ctx0 = await loadOwnSession(supabase, uid, p.session_id);
  if (ctx0.err || !ctx0.ctx) return ctx0.err ?? { ok: false, error: "SESSION_NOT_FOUND" };
  const ctx = ctx0.ctx;
  if (ctx.session.status === "complete") return { ok: false, error: "SESSION_CLOSED", detail: "This day is already complete." };

  const now = new Date().toISOString();
  const row = {
    user_id: uid,
    session_id: p.session_id,
    question_key: p.question_key as string,
    question_text: qText,
    question_type: qType,
    answer: p.answer,
    answer_label: p.answer_label ?? null,
    updated_at: now,
  };

  const { error } = await supabase
    .from("user_responses")
    .upsert(row, { onConflict: "session_id,question_key" });

  if (error) {
    console.error("[upsertResponse] db error:", error.code ?? "unknown");
    if (error.code === "23514" || /empty/i.test(error.message)) {
      return { ok: false, error: "EMPTY_ANSWER" };
    }
    return { ok: false, error: "DB", detail: "unsaved" };
  }
  return { ok: true, data: { savedAt: now } };
}

/* ── read responses for one session ───────────────────────────── */

export async function getResponsesAction(
  sessionId: string,
): Promise<ActionResult<Array<{ question_key: string; answer: unknown; answer_label: unknown; question_type: string; question_text: string }>>> {
  if (typeof sessionId !== "string" || sessionId.length !== 36) return { ok: false, error: "VALIDATION" };
  const supabase = await createClient();
  const { data: ud, error: aerr } = await supabase.auth.getUser();
  if (aerr || !ud.user?.id) return { ok: false, error: "AUTH_REQUIRED" };
  const uid = ud.user.id;

  const { data, error } = await supabase
    .from("user_responses")
    .select("question_key, answer, answer_label, question_type, question_text")
    .eq("user_id", uid)
    .eq("session_id", sessionId);

  if (error) {
    console.error("[getResponses] db error:", error.code ?? "unknown");
    return { ok: false, error: "DB" };
  }
  return { ok: true, data: (data ?? []) as Array<{ question_key: string; answer: unknown; answer_label: unknown; question_type: string; question_text: string }> };
}

/* ── complete a session (server-verified completeness) ────────── */

export async function completeSessionAction(input: { session_id: string; tz: string; time_spent_sec?: unknown }): Promise<ActionResult<{ effectiveDate: string; completedAll: boolean }>> {
  if (typeof input?.session_id !== "string" || input.session_id.length !== 36) return { ok: false, error: "VALIDATION" };
  const supabase = await createClient();
  const { data: ud, error: aerr } = await supabase.auth.getUser();
  if (aerr || !ud.user?.id) return { ok: false, error: "AUTH_REQUIRED" };
  const uid = ud.user.id;

  const rl = rateLimit(`complete:${uid}`, 20, 60_000);
  if (!rl.ok) return { ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec };

  const ctx0 = await loadOwnSession(supabase, uid, input.session_id);
  if (ctx0.err || !ctx0.ctx) return ctx0.err ?? { ok: false, error: "SESSION_NOT_FOUND" };
  const { session, journey } = ctx0.ctx;

  if (session.status === "complete") {
    return { ok: true, data: { effectiveDate: session.effectiveDate ?? localDateInTz(journey.timezone), completedAll: false } };
  }

  const today = localDateInTz(journey.timezone || input.tz);
  const openDay = openDayForDate(journey.start_date, today);
  if (session.day > openDay) {
    return { ok: false, error: "USER_TIMEZONE", detail: "This day isn't open yet — I double-checked against the server clock." };
  }

  // Server-verified completeness: every planned non-skipped qid must have a row.
  const { data: respKeys, error: rErr } = await supabase
    .from("user_responses")
    .select("question_key")
    .eq("user_id", uid)
    .eq("session_id", input.session_id);
  if (rErr) return { ok: false, error: "DB" };
  const have = new Set((respKeys ?? []).map((r) => (r as { question_key: string }).question_key));
  const plan = session.qids.length > 0 ? session.qids : Array.from(have);
  const skipped = new Set(session.skipped);
  const missing = plan.filter((q) => !skipped.has(q) && !have.has(q));
  if (missing.length > 0) {
    return { ok: false, error: "VALIDATION", detail: `missing:${missing.length}` };
  }

  const spent = Number.isFinite(input.time_spent_sec) ? Math.max(0, Math.min(86400, Math.floor(Number(input.time_spent_sec)))) : session.timeSpentSec;

  const { error: upErr } = await supabase
    .from("daily_sessions")
    .update({
      status: "complete",
      effective_date: today,
      time_spent_sec: spent,
      completed_at: new Date().toISOString(),
    })
    .eq("id", input.session_id)
    .eq("user_id", uid);
  if (upErr) {
    console.error("[completeSession] db error:", upErr.code ?? "unknown");
    if (/SESSION_SEQUENCE/i.test(upErr.message)) {
      return { ok: false, error: "DB", detail: "Earlier days must complete first." };
    }
    return { ok: false, error: "DB" };
  }

  // If this was day 7, close the journey.
  let completedAll = false;
  if (session.day === 7) {
    const { data: cnt, error: cntErr } = await supabase
      .from("daily_sessions")
      .select("id")
      .eq("journey_id", journey.id)
      .eq("status", "complete");
    completedAll = !cntErr && (cnt?.length ?? 0) === 7;
    if (completedAll) {
      const { error: jErr } = await supabase
        .from("journeys")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", journey.id)
        .eq("user_id", uid);
      if (jErr) console.error("[completeSession] journey close error:", jErr.code ?? "unknown");
    }
  }

  return { ok: true, data: { effectiveDate: today, completedAll } };
}
