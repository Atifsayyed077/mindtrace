"use server";

/**
 * Account actions: full export + secure deletion.
 *
 * Deletion is performed through the user's own session and RLS — the
 * service-role key is never used. Order matters: storage objects, then
 * child rows, then profile. The auth.users record itself can only be
 * removed from the Supabase dashboard (needs elevated privileges, which
 * the application rightly does not hold).
 */
import { createClient } from "@/utils/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { ActionErr, ActionOk, ProfileRow } from "./profile";

type ExportPayload = {
  exportedAt: string;
  account: { id: string; email: string | null; created_at: string | null };
  profile: ProfileRow | null;
  journeys: unknown[];
  sessions: unknown[];
  responses: unknown[];
  journal_entries: unknown[];
  wellness_reports: unknown[];
  certificates: unknown[];
  note: string;
};

export async function getMyExportAction(): Promise<ActionOk<ExportPayload> | ActionErr> {
  const supabase = await createClient();
  const { data: ud, error } = await supabase.auth.getUser();
  if (error || !ud.user?.id) return { ok: false, error: "AUTH_REQUIRED" };
  const uid = ud.user.id;

  const rl = rateLimit(`export:${uid}`, 5, 60_000);
  if (!rl.ok) return { ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec };

  const [profile, journeys, sessions, responses, journal, reports, certs] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
    supabase.from("journeys").select("*").eq("user_id", uid).order("created_at", { ascending: true }),
    supabase.from("daily_sessions").select("*").eq("user_id", uid).order("day", { ascending: true }),
    supabase.from("user_responses").select("*").eq("user_id", uid).order("created_at", { ascending: true }),
    supabase.from("journal_entries").select("*").eq("user_id", uid).order("created_at", { ascending: true }),
    supabase.from("wellness_reports").select("*").eq("user_id", uid),
    supabase.from("certificates").select("id, full_name, issued_at, revoked, created_at").eq("user_id", uid),
  ]);

  if ([profile, journal, journeys, sessions, responses, reports, certs].some((r) => r.error)) {
    console.error("[export] db error during export (codes only)");
    return { ok: false, error: "DB" };
  }

  return {
    ok: true,
    data: {
      exportedAt: new Date().toISOString(),
      account: { id: uid, email: ud.user.email ?? null, created_at: ud.user.created_at ?? null },
      profile: (profile.data as ProfileRow) ?? null,
      journeys: journeys.data ?? [],
      sessions: sessions.data ?? [],
      responses: responses.data ?? [],
      journal_entries: journal.data ?? [],
      wellness_reports: reports.data ?? [],
      certificates: certs.data ?? [],
      note: "Full MindTrace account export. Contains sensitive reflections — store carefully and never share.",
    },
  };
}

/**
 * Deletes ALL data owned by the caller:
 * storage PDFs → responses → journal → reports → certificates →
 * sessions (cascades) → journeys → profile. Then revokes the session.
 */
export async function deleteMyAccountAction(): Promise<ActionOk<{ phase: "sessions-revoked" }> | ActionErr> {
  const supabase = await createClient();
  const { data: ud, error } = await supabase.auth.getUser();
  if (error || !ud.user?.id) return { ok: false, error: "AUTH_REQUIRED" };
  const uid = ud.user.id;

  const rl = rateLimit(`delete:${uid}`, 3, 10 * 60_000);
  if (!rl.ok) return { ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec };

  // 1) Storage: remove every file under the user's own folder.
  const { data: files, error: listErr } = await supabase.storage.from("certificates").list(uid, { limit: 100 });
  if (!listErr && files && files.length > 0) {
    const paths = files.map((f) => `${uid}/${f.name}`);
    const { error: rmErr } = await supabase.storage.from("certificates").remove(paths);
    if (rmErr) console.error("[delete-account] storage removal error:", (rmErr as { code?: string } | null)?.code ?? "unknown");
  }

  // 2..6) Owned rows. RLS deletes; explicit ordering for clarity. Responses
  // and sessions also cascade, but explicit deletes make the audit trail clear.
  const steps: Array<[string, "user_responses" | "journal_entries" | "wellness_reports" | "certificates" | "daily_sessions" | "journeys" | "profiles"]> = [
    ["responses", "user_responses"],
    ["journal", "journal_entries"],
    ["reports", "wellness_reports"],
    ["certificates", "certificates"],
    ["sessions", "daily_sessions"],
    ["journeys", "journeys"],
    ["profile", "profiles"],
  ];

  for (const [label, table] of steps) {
    const { error: delErr } = await supabase.from(table).delete().eq(
      table === "profiles" ? "id" : "user_id",
      uid,
    );
    if (delErr) {
      console.error("[delete-account] error deleting", label, delErr.code ?? "unknown");
      return { ok: false, error: "DB", detail: `Stopped safely while erasing ${label}. Try again later.` };
    }
  }

  // 7) Revoke the session so the browser forgets this identity.
  await supabase.auth.signOut();
  return { ok: true, data: { phase: "sessions-revoked" } };
}
