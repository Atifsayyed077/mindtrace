"use server";

/**
 * Journey + daily-session server actions.
 *
 * Security & integrity model:
 * · Every action re-derives identity server-side (`auth.getUser()` with token
 *   verification) and relies on RLS; cross-user reads return zero rows.
 * · Day gating is server-computed from the user's IANA timezone — a user
 *   cannot fast-forward progress by changing a device clock.
 * · Sessions are unique per (journey, day) by DB constraint; completion is
 *   order-enforced by a DB trigger (defense in depth).
 * · Failure output is short, safe tags; logs never contain answer content.
 */
import { createClient } from "@/utils/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { localDateInTz, openDayForDate, secondsUntilDate, dayDiff, addDaysYmd } from "@/lib/tz";
import type { ActionErr, ActionOk } from "./profile";

type Err = ActionErr;
export type ActionResult<T> = ActionOk<T> | Err;

export type JourneyRow = {
  id: string;
  timezone: string;
  start_date: string;
  status: "active" | "completed" | "abandoned";
  completed_at: string | null;
};

export type DailySessionDTO = {
  id: string;
  day: number;
  status: "pending" | "in-progress" | "complete";
  startedAt: string | null;
  completedAt: string | null;
  timeSpentSec: number;
  effectiveDate: string | null;
  qids: string[];
  skipped: string[];
};

export type JourneyState = {
  journey: JourneyRow | null;
  sessions: DailySessionDTO[];
  todayLocal: string;
  /** The day currently open; 0 when all seven are done (or none open). */
  openDay: number;
  currentSession: DailySessionDTO | null;
  /** null = available now; else literal reason tag + seconds remaining. */
  blocked: { reason: "journey_done" | "no_journey" | "none_open"; nextOpenInSec: number } | null;
  allDone: boolean;
};

function rowToSession(s: Record<string, unknown>): DailySessionDTO {
  return {
    id: String(s.id),
    day: Number(s.day),
    status: (s.status as DailySessionDTO["status"]) ?? "pending",
    startedAt: (s.started_at as string) ?? null,
    completedAt: (s.completed_at as string) ?? null,
    timeSpentSec: Number(s.time_spent_sec ?? 0),
    effectiveDate: (s.effective_date as string) ?? null,
    qids: Array.isArray(s.qids) ? (s.qids as string[]) : [],
    skipped: Array.isArray(s.skipped) ? (s.skipped as string[]) : [],
  };
}

function parseTz(tz: unknown): string {
  return typeof tz === "string" && tz.length <= 80 ? tz : "UTC";
}

/** Start (or idempotently fetch) this user's single active journey + 7 sessions. */
export async function startJourneyAction(tzArg: string): Promise<ActionResult<{ journey: JourneyRow; sessions: DailySessionDTO[]; todayLocal: string }>> {
  const deepParse = parseTz(tzArg);
  const supabase = await createClient();
  const { data: ud, error: aerr } = await supabase.auth.getUser();
  if (aerr || !ud.user?.id) return { ok: false, error: "AUTH_REQUIRED" };
  const uid = ud.user.id;

  const rl = rateLimit(`journey-start:${uid}`, 10, 60_000);
  if (!rl.ok) return { ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec };

  const todayLocal = localDateInTz(deepParse);

  // Existing active journey?
  const { data: existing, error: selErr } = await supabase
    .from("journeys")
    .select("*")
    .eq("user_id", uid)
    .eq("status", "active")
    .maybeSingle();

  if (selErr) {
    console.error("[startJourney] select error:", selErr.code ?? "unknown");
    return { ok: false, error: "DB" };
  }

  let journey = existing as JourneyRow | null;

  if (!journey) {
    const { data: inserted, error: insErr } = await supabase
      .from("journeys")
      .insert({ user_id: uid, timezone: deepParse, start_date: todayLocal, status: "active" })
      .select()
      .single();

    if (insErr) {
      // Unique-active-index race (double click): fetch the winner instead of failing.
      const { data: again, error: againErr } = await supabase
        .from("journeys")
        .select("*")
        .eq("user_id", uid)
        .eq("status", "active")
        .maybeSingle();
      if (againErr || !again) {
        console.error("[startJourney] insert error:", insErr.code ?? "unknown");
        return { ok: false, error: "DB" };
      }
      journey = again as JourneyRow;
    } else {
      journey = inserted as JourneyRow;
    }
  }

  // Ensure the 7 daily sessions exist (idempotent; unique (journey, day)).
  const { data: sess, error: sessErr } = await supabase
    .from("daily_sessions")
    .select("*")
    .eq("journey_id", journey.id)
    .order("day", { ascending: true });
  if (sessErr) {
    console.error("[startJourney] sessions select error:", sessErr.code ?? "unknown");
    return { ok: false, error: "DB" };
  }

  if (!sess || sess.length < 7) {
    const have = new Set((sess ?? []).map((s) => Number(s.day)));
    const missing = [1, 2, 3, 4, 5, 6, 7].filter((d) => !have.has(d));
    if (missing.length > 0) {
      const { error: mkErr } = await supabase
        .from("daily_sessions")
        .insert(missing.map((day) => ({ user_id: uid, journey_id: journey!.id, day, status: "pending" })));
      if (mkErr && mkErr.code !== "23505") {
        console.error("[startJourney] session bootstrap error:", mkErr.code ?? "unknown");
        return { ok: false, error: "DB" };
      }
      const { data: refreshed, error: refErr } = await supabase
        .from("daily_sessions")
        .select("*")
        .eq("journey_id", journey.id)
        .order("day", { ascending: true });
      if (refErr) return { ok: false, error: "DB" };
      return { ok: true, data: { journey, sessions: refreshed.map(rowToSession), todayLocal } };
    }
  }

  return { ok: true, data: { journey, sessions: (sess ?? []).map(rowToSession), todayLocal } };
}

/** Full journey state with server-side day gating. */
export async function getJourneyStateAction(tzArg: string): Promise<ActionResult<JourneyState>> {
  const tz = parseTz(tzArg);
  const supabase = await createClient();
  const { data: ud, error: aerr } = await supabase.auth.getUser();
  if (aerr || !ud.user?.id) return { ok: false, error: "AUTH_REQUIRED" };
  const uid = ud.user.id;

  const rl = rateLimit(`journey-state:${uid}`, 60, 60_000);
  if (!rl.ok) return { ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec };

  const todayLocal = localDateInTz(tz);

  const { data: journey, error: jErr } = await supabase
    .from("journeys")
    .select("*")
    .eq("user_id", uid)
    .eq("status", "active")
    .maybeSingle();

  if (jErr) {
    console.error("[journeyState] db error:", jErr.code ?? "unknown");
    return { ok: false, error: "DB" };
  }

  if (!journey) {
    return {
      ok: true,
      data: {
        journey: null,
        sessions: [],
        todayLocal,
        openDay: 0,
        currentSession: null,
        blocked: { reason: "no_journey", nextOpenInSec: 0 },
        allDone: false,
      },
    };
  }

  const { data: sessRows, error: sErr } = await supabase
    .from("daily_sessions")
    .select("*")
    .eq("journey_id", journey.id)
    .order("day", { ascending: true });

  if (sErr) {
    console.error("[journeyState] sessions error:", sErr.code ?? "unknown");
    return { ok: false, error: "DB" };
  }

  const sessions = (sessRows ?? []).map(rowToSession);
  const done = sessions.filter((s) => s.status === "complete");
  const scheduleOpenDay = openDayForDate(journey.start_date, todayLocal);

  // Next incomplete day in sequence (order enforced), only if its calendar
  // window has opened and all previous days are done.
  let openDay = 0;
  let blocked: JourneyState["blocked"] = null;
  let currentSession: DailySessionDTO | null = null;

  if (done.length === 7) {
    return {
      ok: true,
      data: {
        journey: journey as JourneyRow,
        sessions,
        todayLocal,
        openDay: 0,
        currentSession: null,
        blocked: { reason: "journey_done", nextOpenInSec: 0 },
        allDone: true,
      },
    };
  }

  const nextSeq = sessions.find((s) => s.status !== "complete");
  if (nextSeq) {
    const windowOpen = nextSeq.day <= scheduleOpenDay;
    const priorDone = done.length >= nextSeq.day - 1;
    if (windowOpen && priorDone) {
      openDay = nextSeq.day;
      currentSession = nextSeq;
    } else {
      const openDate = addDaysYmd(journey.start_date, nextSeq.day - 1);
      const sec = Math.max(0, secondsUntilDate(openDate, tz));
      blocked = {
        reason: priorDone ? "none_open" : "none_open",
        nextOpenInSec: priorDone ? sec : 0,
      };
    }
  }

  return {
    ok: true,
    data: {
      journey: journey as JourneyRow,
      sessions,
      todayLocal,
      openDay,
      currentSession,
      blocked,
      allDone: false,
    },
  };
}

/** Helpers exported for report/certificate actions (same trust model). */
export async function requireCompletedDaysAction(): Promise<
  ActionResult<{ journeyId: string; startDate: string; timezone: string; completed: DailySessionDTO[] }>
> {
  const supabase = await createClient();
  const { data: ud, error: aerr } = await supabase.auth.getUser();
  if (aerr || !ud.user?.id) return { ok: false, error: "AUTH_REQUIRED" };

  const { data: journey } = await supabase
    .from("journeys")
    .select("*")
    .eq("user_id", ud.user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!journey) return { ok: false, error: "DB", detail: "journey-not-found" };

  const { data: rows, error: sErr } = await supabase
    .from("daily_sessions")
    .select("*")
    .eq("journey_id", (journey as { id: string }).id)
    .order("day", { ascending: true });
  if (sErr) return { ok: false, error: "DB" };

  return {
    ok: true,
    data: {
      journeyId: (journey as { id: string }).id,
      startDate: (journey as { start_date: string }).start_date,
      timezone: (journey as { timezone: string }).timezone,
      completed: (rows ?? []).map(rowToSession).filter(Boolean).filter((s) => s.status === "complete"),
    },
  };
}

export { dayDiff };
