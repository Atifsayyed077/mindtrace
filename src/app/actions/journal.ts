"use server";

/**
 * Journal actions (phase 6).
 *
 * · Content is strictly owner-private (RLS). No aggregate policy exists —
 *   journal text never enters analytics or AI processing; `ai_consent`
 *   stays false unless the user explicitly opts in.
 * · The Day-7 "letter to yourself" is stored as a journal entry with day=7
 *   so it survives journeys, reports and sessions uniformly.
 */
import { createClient } from "@/utils/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import type { ActionErr } from "./profile";

type Err = ActionErr;
export type ActionResult<T> = { ok: true; data: T } | Err;

export type JournalDTO = {
  id: string;
  day: number | null;
  entry_date: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type UpsertJournalInput = {
  id?: unknown;
  day?: unknown;
  entry_date?: unknown;
  content: unknown;
};

function ymd(v: unknown): string | null {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

/** Create or update an entry; keeps the caller-supplied id for app continuity. */
export async function upsertJournalEntryAction(input: UpsertJournalInput): Promise<ActionResult<JournalDTO>> {
  if (typeof input?.content !== "string" || input.content.trim().length === 0) {
    return { ok: false, error: "VALIDATION", detail: "Write something first." };
  }
  const content = input.content.trim().slice(0, 20000);
  const day = Number.isFinite(Number(input.day)) && Number(input.day) >= 1 && Number(input.day) <= 7 ? Number(input.day) : null;
  const entryDate = ymd(input.entry_date) ?? null;
  const id = typeof input.id === "string" && /^[a-zA-Z0-9_-]{6,64}$/.test(input.id) ? input.id : undefined;

  // day=7 entries (letters) keep their explicit entry_date.
  if (!entryDate) return { ok: false, error: "VALIDATION", detail: "bad date" };

  const supabase = await createClient();
  const { data: ud, error: aerr } = await supabase.auth.getUser();
  if (aerr || !ud.user?.id) return { ok: false, error: "AUTH_REQUIRED" };
  const uid = ud.user.id;

  const rl = rateLimit(`journal:${uid}`, 60, 60_000);
  if (!rl.ok) return { ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec };

  if (id) {
    const { data, error } = await supabase
      .from("journal_entries")
      .update({ content, day, entry_date: entryDate })
      .eq("id", id)
      .eq("user_id", uid)
      .select()
      .maybeSingle();
    if (error) {
      console.error("[journal] update error:", error.code ?? "unknown");
      return { ok: false, error: "DB" };
    }
    if (!data) return { ok: false, error: "DB", detail: "entry-not-found" };
    return { ok: true, data: data as JournalDTO };
  }

  const { data, error } = await supabase
    .from("journal_entries")
    .insert({ user_id: uid, content, day, entry_date: entryDate })
    .select()
    .single();
  if (error) {
    console.error("[journal] insert error:", error.code ?? "unknown");
    return { ok: false, error: "DB" };
  }
  return { ok: true, data: data as JournalDTO };
}

/** Update journal consent to allow (or revoke) AI processing of entries. */
export async function setJournalConsentAction(consent: boolean): Promise<ActionResult<{ ai_consent: boolean }>> {
  const supabase = await createClient();
  const { data: ud, error: aerr } = await supabase.auth.getUser();
  if (aerr || !ud.user?.id) return { ok: false, error: "AUTH_REQUIRED" };
  const { error } = await supabase.from("journal_entries").update({ ai_consent: !!consent }).eq("user_id", ud.user.id);
  if (error) {
    console.error("[journal-consent] db error:", error.code ?? "unknown");
    return { ok: false, error: "DB" };
  }
  return { ok: true, data: { ai_consent: !!consent } };
}

/** Recent entries (own only). `withLetter` includes the day-7 letter entry. */
export async function listJournalAction(limitArg = 50, withLetter = false): Promise<ActionResult<JournalDTO[]>> {
  const supabase = await createClient();
  const { data: ud, error: aerr } = await supabase.auth.getUser();
  if (aerr || !ud.user?.id) return { ok: false, error: "AUTH_REQUIRED" };
  const uid = ud.user.id;

  const limit = Math.max(1, Math.min(200, Math.floor(Number(limitArg) || 50)));
  let query = supabase.from("journal_entries").select("*").eq("user_id", uid);
  if (!withLetter) query = query.or("day.is.null,day.neq.7");
  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);

  if (error) {
    console.error("[journal-list] db error:", error.code ?? "unknown");
    return { ok: false, error: "DB" };
  }
  return { ok: true, data: (data ?? []) as JournalDTO[] };
}

/** The latest day-7 letter entry, if any. */
export async function getLetterAction(): Promise<ActionResult<JournalDTO | null>> {
  const supabase = await createClient();
  const { data: ud, error: aerr } = await supabase.auth.getUser();
  if (aerr || !ud.user?.id) return { ok: false, error: "AUTH_REQUIRED" };
  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("user_id", ud.user.id)
    .eq("day", 7)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[letter] db error:", error.code ?? "unknown");
    return { ok: false, error: "DB" };
  }
  return { ok: true, data: (data as JournalDTO) ?? null };
}

export async function deleteJournalEntryAction(id: string): Promise<ActionResult<{ deleted: true }>> {
  if (typeof id !== "string" || id.length < 6) return { ok: false, error: "VALIDATION" };
  const supabase = await createClient();
  const { data: ud, error: aerr } = await supabase.auth.getUser();
  if (aerr || !ud.user?.id) return { ok: false, error: "AUTH_REQUIRED" };

  const rl = rateLimit(`journal-del:${ud.user.id}`, 30, 60_000);
  if (!rl.ok) return { ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec };

  const { error } = await supabase.from("journal_entries").delete().eq("id", id).eq("user_id", ud.user.id);
  if (error) {
    console.error("[journal-del] db error:", error.code ?? "unknown");
    return { ok: false, error: "DB" };
  }
  return { ok: true, data: { deleted: true } };
}
