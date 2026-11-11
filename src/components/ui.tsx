"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Neuro, NEURO_QUOTES } from "./neuro";
import { Icon } from "./icons";
import { createClient } from "@/utils/supabase/client";

/* gate: waits for mount so localStorage reads never mismatch SSR */
export function ClientGate({ children, skeleton = true }: { children: React.ReactNode; skeleton?: boolean }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready && skeleton) return <Splash />;
  if (!ready) return null;
  return <>{children}</>;
}

export function Splash({ note = "Warming up your neurons…" }: { note?: string }) {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4 text-center px-6">
      <div className="animate-floaty"><Neuro size={110} mood="thinking" blink={false} /></div>
      <p className="text-ink-muted text-sm animate-pulse-soft">{note}</p>
    </div>
  );
}

export function TopNav() {
  /* Hydration-safe quote: SSR renders a fixed quote, then a fresh random one
     is swapped in after mount. (Math.random() during the SSR/hydration pass
     causes server/client text mismatches.) */
  const [quote, setQuote] = useState(NEURO_QUOTES[0] ?? "");
  /* Hydration-safe auth state: SSR renders the logged-out variant (Log in /
     Sign up); after mount the real session is checked and, if present, the
     app links + a first-name greeting (from auth metadata set at signup)
     replace it. Session persists across visits until explicit sign-out. */
  const [authed, setAuthed] = useState(false);
  const [firstName, setFirstName] = useState("");
  useEffect(() => {
    const next = NEURO_QUOTES[Math.floor(Math.random() * NEURO_QUOTES.length)] ?? NEURO_QUOTES[0];
    if (next) setQuote(next);
    let alive = true;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (!alive || !data?.user) return;
        setAuthed(true);
        /* Name source of truth: auth metadata (set at signup). Accounts created
           before that fix have empty metadata, so fall back to the profiles row. */
        let nm = String(data.user.user_metadata?.name ?? "").trim();
        if (!nm) {
          try {
            const { data: prof } = await supabase.from("profiles").select("full_name").maybeSingle();
            if (prof?.full_name) nm = String(prof.full_name).trim();
          } catch { /* schema not initialized yet — no greeting until profile is saved */ }
        }
        if (nm) setFirstName(nm.split(/\s+/)[0]);
      } catch { /* stay on logged-out variant */ }
    })();
    return () => { alive = false; };
  }, []);
  return (
    <header className="sticky top-0 z-50 backdrop-blur-lg bg-white/75 border-b border-lav-100 no-print">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="grid place-items-center w-10 h-10 rounded-2xl bg-navy-800 text-white shadow-card group-hover:rotate-6 transition-transform">
            <Icon name="brain" size={22} />
          </span>
          <span>
            <span className="font-bold tracking-tight leading-none text-[1.05rem]">MindTrace</span>
            <span className="block text-[0.66rem] text-ink-faint font-medium tracking-wide">7-DAY BRAIN SERIES</span>
          </span>
        </Link>
        <nav className="hidden sm:flex items-center gap-1 text-sm font-medium text-ink-muted">
          {authed ? (
            <>
              <Link href="/dashboard" className="px-3.5 py-2 rounded-full hover:bg-lav-100 transition-colors">Dashboard</Link>
              <Link href="/profile" className="px-3.5 py-2 rounded-full hover:bg-lav-100 transition-colors">Profile</Link>
              <Link href="/journey" className="px-3.5 py-2 rounded-full hover:bg-lav-100 transition-colors">Today</Link>
              <Link href="/report" className="px-3.5 py-2 rounded-full hover:bg-lav-100 transition-colors">Report</Link>
              <Link href="/verify" className="px-3.5 py-2 rounded-full hover:bg-lav-100 transition-colors">Verify</Link>
            </>
          ) : (
            <>
              <Link href="/login" className="px-3.5 py-2 rounded-full hover:bg-lav-100 transition-colors">Log in</Link>
              <Link href="/signup" className="px-3.5 py-2 rounded-full hover:bg-lav-100 transition-colors">Sign up</Link>
              <Link href="/verify" className="px-3.5 py-2 rounded-full hover:bg-lav-100 transition-colors">Verify</Link>
            </>
          )}
        </nav>
        <div className="flex items-center gap-2">
          <span className="hidden lg:block text-xs text-ink-faint max-w-[240px] truncate" title={quote}>{quote}</span>
          {authed ? (
            <>
              {firstName && (
                <span className="hidden md:block text-xs font-semibold text-navy-700 bg-lav-100 rounded-full px-3 py-1.5">
                  Hi, {firstName}
                </span>
              )}
              <Link href="/onboarding" className="btn btn-primary !py-2 !px-4 text-[0.85rem]">Start journey</Link>
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost !py-2 !px-4 text-[0.85rem]">Log in</Link>
              <Link href="/signup" className="btn btn-primary !py-2 !px-4 text-[0.85rem]">Sign up</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function ProgressRing({ pct, size = 108, label }: { pct: number; size?: number; label?: string }) {
  const r = 42, C = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 100 100" className="-rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#ece8fa" strokeWidth="9" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="url(#ring-g)" strokeWidth="9" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - clamped / 100)} style={{ transition: "stroke-dashoffset .8s cubic-bezier(.22,1,.36,1)" }} />
        <defs>
          <linearGradient id="ring-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a99bd6" /><stop offset="100%" stopColor="#35b0a8" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute text-center">
        <div className="text-xl font-bold tabular">{Math.round(clamped)}%</div>
        {label && <div className="text-[0.62rem] text-ink-faint font-medium uppercase tracking-wider mt-0.5">{label}</div>}
      </div>
    </div>
  );
}

export function Badge({ tone = "lav", children }: { tone?: "lav" | "teal" | "gold" | "danger" | "ok"; children: React.ReactNode }) {
  const map = {
    lav: "bg-lav-100 text-navy-700",
    teal: "bg-teal-100 text-teal-700",
    gold: "bg-gold-100 text-gold-600",
    danger: "bg-[#fbeaea] text-danger",
    ok: "bg-[#eaf6f1] text-ok",
  };
  return <span className={`chip ${map[tone]}`}>{children}</span>;
}

export function SectionTitle({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-bold flex items-center gap-2 text-ink">
        <span className="grid place-items-center w-8 h-8 rounded-xl bg-lav-100 text-navy-700">
          <Icon name={icon} size={16} />
        </span>
        {title}
      </h2>
      {sub && <p className="text-sm text-ink-muted mt-1 ml-[2.55rem]">{sub}</p>}
    </div>
  );
}

/* mini confetti burst (CSS-only) */
export function Confetti({ n = 42 }: { n?: number }) {
  const colors = ["#a99bd6", "#35b0a8", "#c9a24a", "#e8a0b4", "#8a76c9"];
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[800] h-0 overflow-visible">
      {Array.from({ length: n }).map((_, i) => (
        <span key={i}
          className="absolute top-0 block w-2 h-3 rounded-[2px] animate-confetti"
          style={{
            left: `${(i / n) * 100 + Math.random() * 2}%`,
            background: colors[i % colors.length],
            animationDelay: `${Math.random() * 0.5}s`,
            "--tx": `${(Math.random() - 0.5) * 240}px`,
            "--rot": `${Math.random() * 720 - 360}deg`,
          } as React.CSSProperties} />
      ))}
    </div>
  );
}
