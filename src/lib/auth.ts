/**
 * Client-side auth helpers for MindTrace.
 *
 * All credential handling is delegated to Supabase Auth — the app never
 * stores or transmits passwords anywhere else (also not into the profiles
 * table). Error copy is friendly and never leaks auth internals.
 */
import { createClient } from "@/utils/supabase/client";

/** Map Supabase Auth error codes to kind, human-safe copy. */
export function authErrorText(code?: string, rawMessage?: string): string {
  switch (code) {
    case "invalid_credentials":
      return "That email/password combination didn't match. Try again, or reset your password below.";
    case "email_not_confirmed":
      return "Please confirm your email address first — check your inbox (and spam) for the MindTrace link.";
    case "user_already_registered":
      return "An account with this email already exists. Log in instead, or use 'Forgot password' if you're locked out.";
    case "weak_password":
      return "That password is too weak. Aim for at least 8 characters with a mix of letters and numbers.";
    case "too_many_requests":
      return "Too many attempts — the auth service is cooling down for a moment. Please wait about a minute and retry.";
    case "email_address_invalid":
    case "validation_failed":
      return "That email address doesn't look valid. Double-check it for typos.";
    case "same_password":
      return "Your new password matches the old one. Choose something different this time.";
    case "user_not_found":
      return "No account found. Try signing up first — it takes two minutes.";
    default:
      if (rawMessage && /^[a-z0-9 _.-]+$/i.test(rawMessage) && rawMessage.length < 140) {
        return `Hmm, that didn't work: ${rawMessage}`;
      }
      return "Something went sideways. Please try again in a moment.";
  }
}

/** Extract (code, message) from a thrown/returned Supabase Auth error safely. */
export function authErrPayload(err: unknown): { code?: string; message?: string } {
  if (err && typeof err === "object") {
    const o = err as { code?: unknown; message?: unknown; error_code?: unknown };
    const code =
      typeof o.code === "string"
        ? o.code
        : typeof o.error_code === "string"
          ? o.error_code
          : undefined;
    const message = typeof o.message === "string" ? o.message : undefined;
    return { code, message };
  }
  return {};
}

/** Keep only same-app, absolute-path redirect targets. */
export function safeNext(next?: string | null, fallback = "/dashboard"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  if (/^\s+|\s+$/.test(next) || next.includes('"')) return fallback;
  return next;
}

/**
 * Clears the on-device draft mirror (localStorage). The database stays the
 * source of truth; this just tidies this browser.
 */
export function clearLocalMirror() {
  if (typeof window === "undefined") return;
  const uid = window.localStorage.getItem("mindtrace:current");
  const keys = ["mindtrace:current", "mindtrace:ob-draft", "mindtrace:users", "mindtrace:certs", "mindtrace:admin-last-login"];
  const scoped = [
    `mindtrace:sessions:${uid}`,
    `mindtrace:journal:${uid}`,
    `mindtrace:letter:${uid}`,
    `mindtrace:reports:${uid}`,
    `mindtrace:safety:${uid}`,
    `mindtrace:moments:${uid}`,
  ];
  for (const k of [...keys, ...(uid ? scoped : [])]) {
    try {
      window.localStorage.removeItem(k);
    } catch {
      /* storage unavailable — fine */
    }
  }
}
