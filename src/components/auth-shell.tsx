"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Neuro } from "@/components/neuro";
import { createClient } from "@/utils/supabase/client";
import { authErrorText, authErrPayload } from "@/lib/auth";

/** Shared visual shell for auth pages — same calm card language as the rest of the app. */
export function AuthShell({
  mood,
  title,
  sub,
  children,
}: {
  mood: "happy" | "thinking" | "worried" | "proud" | "sleep" | "party" | "wave";
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-[80vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-5">
          <div className="inline-block animate-floaty">
            <Neuro size={104} mood={mood} />
          </div>
        </div>
        <div className="card p-7 sm:p-9 shadow-lift">
          <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
          <p className="text-sm text-ink-muted mt-1.5 mb-6 leading-relaxed">{sub}</p>
          {children}
        </div>
        <p className="text-center text-xs text-ink-faint mt-5">
          <Link href="/" className="underline hover:text-ink-muted">← Back to home</Link>
          <span className="mx-2">·</span>
          MindTrace keeps reflections private to you. Always.
        </p>
      </div>
    </main>
  );
}

/** Small inline alert used by auth forms. */
export function AuthAlert({ tone, children }: { tone: "error" | "ok" | "info"; children: React.ReactNode }) {
  const map = {
    error: "bg-[#fbeaea] text-danger border-[#f2caca]",
    ok: "bg-[#eaf6f1] text-ok border-[#c4e5d3]",
    info: "bg-lav-50 text-navy-700 border-lav-200",
  } as const;
  return (
    <div role="alert" className={`text-sm rounded-2xl border px-4 py-3 leading-relaxed ${map[tone]}`}>
      {children}
    </div>
  );
}

/**
 * Confirmation-email resend with a 60s cooldown.
 *
 * Important: Supabase Auth rate-limits signup/confirmation emails per IP.
 * When the limit trips (HTTP 429) NO email is sent at all — so this panel
 * waits out the quota instead of hammering the endpoint and making it worse.
 */
export function ResendConfirmation({ email }: { email: string }) {
  const [status, setStatus] = useState<"idle" | "busy" | "sent" | "err">("idle");
  const [msg, setMsg] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function resend() {
    if (cooldown > 0 || status === "busy") return;
    setStatus("busy");
    setMsg("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
        },
      });
      if (error) {
        const p = authErrPayload(error);
        if (p.code === "too_many_requests") {
          setMsg("The email quota is cooling down (each retry resets it). Wait a full minute, then resend once.");
        } else {
          setMsg(authErrorText(p.code, p.message));
        }
        setStatus("err");
        setCooldown(45);
        return;
      }
      setStatus("sent");
      setCooldown(60);
    } catch {
      setMsg("Network hiccup — try again in a moment.");
      setStatus("err");
      setCooldown(15);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={resend}
        disabled={status === "busy" || cooldown > 0}
        className="btn btn-teal w-full text-center"
      >
        {status === "busy"
          ? "Resending…"
          : cooldown > 0
            ? `Resend available in ${cooldown}s`
            : "Resend the confirmation link"}
      </button>
      {status === "sent" && <AuthAlert tone="ok">Fresh link sent — one click and your account is live.</AuthAlert>}
      {msg && <AuthAlert tone="error">{msg}</AuthAlert>}
      <p className="text-xs text-ink-faint leading-relaxed">
        Still nothing after a couple of minutes? Check spam, wait out the quota, or — during development — turn
        &ldquo;Confirm email&rdquo; off in the Supabase dashboard (Authentication → Providers → Email).
      </p>
    </div>
  );
}
