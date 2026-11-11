"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell, AuthAlert, ResendConfirmation } from "@/components/auth-shell";
import { createClient } from "@/utils/supabase/client";
import { authErrPayload } from "@/lib/auth";

function pwScore(pw: string): boolean {
  return pw.length >= 8 && /[a-z]/i.test(pw) && /\d/.test(pw);
}

const NEURO_PW_HINTS = [
  "8+ characters, one letter and one digit minimum. Brains love patterns; passwords love uniqueness.",
];

/**
 * Client signup form, rendered as-is from the server page (no
 * useSearchParams) so the whole form is in the server HTML.
 */
export function SignupForm() {
  const nav = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false); // "check your inbox" state
  const [already, setAlready] = useState(false); // this email has an account

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (name.trim().length < 2) {
      setError("I need something to call you — even 'Brainy McReflects' works.");
      return;
    }
    if (!pwScore(password)) {
      setError("Password needs love: 8+ characters with at least one letter and one number.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match — one more careful pass.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          // Profile creation happens at account creation: the DB trigger
          // handle_new_user reads this metadata and writes profiles.full_name.
          // (Nothing sensitive here — full_name only, never credentials.)
          data: { name: name.trim() },
        },
      });

      // Keep this small context locally so onboarding pre-fills the name.
      try {
        const draft = JSON.parse(window.localStorage.getItem("mindtrace:ob-draft") || "{}");
        draft.name = name.trim();
        window.localStorage.setItem("mindtrace:ob-draft", JSON.stringify(draft));
      } catch { /* fresh draft */ }

      if (error || !data.session) {
        const p = authErrPayload(error);
        if (p.code === "user_already_registered") {
          // Existing account: don't loop signup retries (that only trips the
          // email rate limit). Offer login + resend of the confirmation link.
          setAlready(true);
          setError("");
          setDone(true);
          setBusy(false);
          return;
        }
        if (p.code === "too_many_requests") {
          setError("The signup email quota is cooling down — each retry pushes it further out. Wait about a minute, then try once.");
          setBusy(false);
          return;
        }
        // No session usually means "check your inbox to confirm".
        setAlready(false);
        setError("");
        setDone(true);
        setBusy(false);
        return;
      }
      nav.replace("/onboarding");
    } catch {
      setError("Network trouble reaching the auth service. Please retry.");
      setBusy(false);
    }
  }

  if (done) {
    return (
      <AuthShell
        mood="thinking"
        title={already ? "You already have an account" : "Check your inbox"}
        sub={
          already
            ? `${email} is registered already. Log in instead — or resend the confirmation link if it never arrived.`
            : "One click left — a confirmation link is on its way to your email."
        }
      >
        <AuthAlert tone="info">
          The starter email service is rate-limited per attempt — pressing signup several times in a row gives 429s and
          NO email will arrive. Wait ~60 seconds, then use the resend button below (once).
        </AuthAlert>
        <div className="mt-5">
          <ResendConfirmation email={email.trim().toLowerCase()} />
        </div>
        <Link href="/login" className="btn btn-ghost w-full mt-5 text-center block">← Back to login</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      mood="wave"
      title="Create your MindTrace account"
      sub="Seven quiet minutes a day. Your reflections stay yours — stored in your private, protected space."
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="name" className="text-sm font-semibold text-ink">What should we call you?</label>
          <input
            id="name"
            type="text"
            required
            className="field w-full mt-1.5"
            placeholder="e.g. Sam"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
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
            autoComplete="new-password"
            className="field w-full mt-1.5"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="text-xs text-ink-faint mt-1">{NEURO_PW_HINTS[0]}</p>
        </div>
        <div>
          <label htmlFor="confirm" className="text-sm font-semibold text-ink">Confirm password</label>
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
          {busy ? "Warming up…" : "Sign up"}
        </button>
      </form>

      <p className="text-sm text-ink-muted mt-5 text-center">
        Already tracing?{" "}
        <Link href="/login" className="text-navy-700 underline hover:text-lav-500">Log in</Link>
      </p>
    </AuthShell>
  );
}
