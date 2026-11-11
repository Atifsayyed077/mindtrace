"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell, AuthAlert, ResendConfirmation } from "@/components/auth-shell";
import { createClient } from "@/utils/supabase/client";
import { authErrorText, authErrPayload } from "@/lib/auth";

const TAG_COPY: Record<string, string> = {
  link_problem: "That confirmation link looked invalid or has expired. Just log in below — or request a fresh link.",
  missing_code: "That link was incomplete. If your email is already confirmed, log in below.",
  email_not_confirmed: "Please confirm your email first — the link in your inbox (check spam too).",
  server_error: "The sign-in service hiccuped. Please try again in a moment.",
};

/**
 * Client login form. `next` and `tag` arrive as props from the server page
 * (which awaits searchParams) — this component deliberately does NOT call
 * useSearchParams, so the whole form is server-rendered into the HTML and
 * is visible before/despite any hydration issues. (The previous
 * Suspense-fallback={null} wrapper rendered a blank page in production.)
 */
export function LoginForm({ next, tag }: { next: string; tag: string }) {
  const nav = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>(tag && TAG_COPY[tag] ? TAG_COPY[tag] : "");
  const [showResend, setShowResend] = useState(false);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setError("");
    setShowResend(false);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error || !data.session) {
        const p = authErrPayload(error ?? undefined);
        if (p.code === "email_not_confirmed") {
          setError(TAG_COPY.email_not_confirmed);
          setShowResend(true); // offer the fresh link here
        } else {
          setShowResend(false);
          setError(authErrorText(p.code, p.message));
        }
        setBusy(false);
        return;
      }
      nav.replace(next);
    } catch {
      setError("Network trouble reaching the auth service. Please retry.");
      setBusy(false);
    }
  }

  return (
    <AuthShell
      mood="happy"
      title="Welcome back"
      sub="Pick up your journey exactly where your brain left it."
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="email" className="text-sm font-semibold text-ink">Email</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            className="field w-full mt-1.5"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="password" className="text-sm font-semibold text-ink">Password</label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            className="field w-full mt-1.5"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <AuthAlert tone="error">{error}</AuthAlert>}
        {showResend && (
          <div className="mt-4">
            <ResendConfirmation email={email.trim().toLowerCase()} />
          </div>
        )}
        <button type="submit" className="btn btn-primary w-full" disabled={busy}>
          {busy ? "Checking credentials…" : "Log in"}
        </button>
      </form>

      <div className="flex items-center justify-between mt-5 text-sm">
        <Link href="/forgot-password" className="text-navy-700 underline hover:text-lav-500">Forgot password?</Link>
        <Link href="/signup" className="text-navy-700 underline hover:text-lav-500">Create an account →</Link>
      </div>
    </AuthShell>
  );
}
