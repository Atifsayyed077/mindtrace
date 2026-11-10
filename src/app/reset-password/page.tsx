"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell, AuthAlert } from "@/components/auth-shell";
import { createClient } from "@/utils/supabase/client";
import { authErrorText, authErrPayload } from "@/lib/auth";
import { Splash } from "@/components/ui";

export default function ResetPasswordPage() {
  const nav = useRouter();
  const [checked, setChecked] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  /* The recovery link establishes a session (via /auth/callback), so a user
     must exist here. Otherwise send them to request a fresh link. */
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (!live) return;
        if (!data.user) {
          nav.replace("/forgot-password");
          return;
        }
        setChecked(true);
      } catch {
        if (live) nav.replace("/forgot-password");
      }
    })();
    return () => { live = false; };
  }, [nav]);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (password.length < 8 || !(/[a-z]/i.test(password) && /\d/.test(password))) {
      setError("8+ characters with at least one letter and one number.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        const p = authErrPayload(error);
        setError(authErrorText(p.code, p.message));
        setBusy(false);
        return;
      }
      setDone(true);
      // Drop the recovery session; user proceeds with a clean login.
      await supabase.auth.signOut();
      setTimeout(() => nav.replace("/login"), 1600);
    } catch {
      setError("Network trouble reaching the auth service. Please retry.");
      setBusy(false);
    }
  }

  if (done) {
    return (
      <AuthShell mood="happy" title="Password updated" sub="All set. Redirecting you to log in with the new password…">
        <AuthAlert tone="ok">Standby — gentle redirect in progress.</AuthAlert>
      </AuthShell>
    );
  }

  if (!checked) return <Splash note="Verifying your reset link…" />;

  return (
    <AuthShell mood="thinking" title="Choose a new password" sub="Your reflections stay untouched — only the key changes.">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="password" className="text-sm font-semibold text-ink">New password</label>
          <input
            id="password"
            type="password"
            required
            autoComplete="new-password"
            className="field w-full mt-1.5"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="confirm" className="text-sm font-semibold text-ink">Confirm new password</label>
          <input
            id="confirm"
            type="password"
            required
            autoComplete="new-password"
            className="field w-full mt-1.5"
            placeholder="••••••••"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {error && <AuthAlert tone="error">{error}</AuthAlert>}
        <button type="submit" className="btn btn-primary w-full" disabled={busy}>
          {busy ? "Updating…" : "Set new password"}
        </button>
      </form>
    </AuthShell>
  );
}
