"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthShell, AuthAlert } from "@/components/auth-shell";
import { createClient } from "@/utils/supabase/client";
import { authErrorText, authErrPayload } from "@/lib/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (error) {
        const p = authErrPayload(error);
        setError(authErrorText(p.code, p.message));
        setBusy(false);
        return;
      }
      // Deliberately identical output whether or not the account exists.
      setSent(true);
      setBusy(false);
    } catch {
      setError("Network trouble reaching the auth service. Please retry.");
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <AuthShell mood="thinking" title="Reset link on its way" sub="If that inbox belongs to an account, a reset link just landed in it.">
        <AuthAlert tone="info">The link opens the page where you choose a new password. It expires, so don't wait too long.</AuthAlert>
        <Link href="/login" className="btn btn-ghost w-full mt-5 text-center block">← Back to login</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell mood="sleep" title="Forgot your password?" sub="Happens to excellent brains. Enter your email and I'll send a reset link.">
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
        {error && <AuthAlert tone="error">{error}</AuthAlert>}
        <button type="submit" className="btn btn-primary w-full" disabled={busy}>
          {busy ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <p className="text-sm text-ink-muted mt-5 text-center">
        Remembered it after all?{" "}
        <Link href="/login" className="text-navy-700 underline hover:text-lav-500">Log in</Link>
      </p>
    </AuthShell>
  );
}
