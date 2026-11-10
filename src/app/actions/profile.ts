"use server";

/**
 * Profile server actions.
 *
 * Every action: 1) validates with Zod, 2) rate-limits per user, 3) operates
 * strictly through the authenticated user's identity — RLS denies anything
 * else at the database level. Failures are logged without answer contents
 * (codes only) and returned as safe, short tags to the client.
 */
import { createClient } from "@/utils/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { saveProfileSchema, type SaveProfileInput } from "@/lib/validation";

export type ProfileRow = {
  id: string;
  full_name: string;
  age_range: string | null;
  preferred_language: string | null;
  timezone: string | null;
  context: Record<string, unknown>;
  consent: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ActionOk<T> = { ok: true; data: T };
export type ActionErr = { ok: false; error: string; retryAfterSec?: number; detail?: string };
export type ProfileActionResult = ActionOk<ProfileRow> | ActionErr;

async function requireAuthedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || !data.user.id) {
    return { supabase, user: null as null | { id: string; email?: string } };
  }
  return { supabase, user: { id: data.user.id, email: data.user.email ?? undefined } };
}

/** Create or update the caller's own profile row (idempotent upsert). */
export async function saveProfileAction(input: unknown): Promise<ProfileActionResult> {
  const parsed = saveProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "VALIDATION", detail: "Check the highlighted fields." };
  }

  const { supabase, user } = await requireAuthedClient();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const rl = rateLimit(`profile-save:${user.id}`, 30, 60_000);
  if (!rl.ok) return { ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec };

  const p = parsed.data;
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        full_name: p.full_name,
        age_range: p.age_range || null,
        preferred_language: p.preferred_language || null,
        timezone: p.timezone,
        context: p.context,
        consent: p.consent,
      },
      { onConflict: "id" },
    )
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST205" || /could not find the table/i.test(error.message)) {
      console.info("[saveProfile] backend tables not created yet — run supabase/MIGRATE.sql, then retry.");
      return { ok: false, error: "DB", detail: "schema-missing" };
    }
    console.error("[saveProfile] db error:", error.code, error.message ? "details withheld" : "");
    return { ok: false, error: "DB", detail: "Could not save your profile to the database. It may still exist offline — try again shortly." };
  }
  return { ok: true, data: data as ProfileRow };
}

/** Read the caller's own profile row (null if absent). */
export async function getMyProfileAction(): Promise<ActionOk<ProfileRow | null> | ActionErr> {
  const { supabase, user } = await requireAuthedClient();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST205" || /could not find the table/i.test(error.message)) {
      // Migrations haven't run yet — expected state, calm one-line info instead of a stack.
      console.info("[getProfile] backend tables not created yet — run supabase/MIGRATE.sql, then restart.");
      return { ok: false, error: "DB", detail: "schema-missing" };
    }
    console.error("[getProfile] db error:", error.code);
    return { ok: false, error: "DB" };
  }
  return { ok: true, data: (data as ProfileRow | null) ?? null };
}
