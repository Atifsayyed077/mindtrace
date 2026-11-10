"use client";

import { useEffect, useMemo, useState } from "react";
import { Neuro } from "@/components/neuro";
import { Icon } from "@/components/icons";
import { TopNav, Badge, ProgressRing } from "@/components/ui";
import {
  completedDays, getSessions, listCerts, listJournal, listMoments, listSafety,
  listUsers, lastAdminLogin, setAdminLogin, getUser, fmtDate,
} from "@/lib/db";

/* ── Local administrative console ──────────────────────────────
 * Aggregate statistics only. There is deliberately NO pathway to
 * journal entries, letters or reflection answers — privacy by
 * construction, not by policy.
 */

const ADMIN_CODE = "MINDTRACE-2026";

export default function AdminPage() {
  return <div className="flex-1"><TopNav /><AdminBody /></div>;
}

function AdminBody() {
  const [unlocked, setUnlocked] = useState(false);
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  /* persist last successful login */
  useEffect(() => {
    if (unlocked) setAdminLogins(new Date().toISOString());
  }, [unlocked]);

  const submit = () => {
    if (pw.toUpperCase() === ADMIN_CODE) { setUnlocked(true); setError(""); }
    else setError("That code didn't match. (Hint for the demo: MINDTRACE-2026)");
  };

  if (!unlocked) {
    return (
      <main className="flex-1 max-w-md mx-auto w-full px-5 py-20">
        <div className="card p-7 text-center animate-pop-in">
          <div className="animate-floaty inline-block"><Neuro size={96} mood="thinking" blink={false} /></div>
          <h1 className="font-display font-bold text-2xl text-navy-800 mt-4">Admin Console 🔐</h1>
          <p className="text-sm text-ink-muted mt-2">
            Aggregate statistics only — reflections, journals and letters are structurally invisible here.
          </p>
          <div className="mt-6 flex gap-2">
            <input
              type="password"
              className="field"
              placeholder="Admin code"
              value={pw}
              onChange={(e) => { setPw(e.target.value); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            />
            <button onClick={submit} className="btn btn-primary shrink-0 !px-5" data-testid="admin-login">Unlock</button>
          </div>
          {error && <p className="text-danger text-sm mt-3" data-testid="admin-error">{error}</p>}
        </div>
      </main>
    );
  }

  /* aggregate snapshot (client-side, all from localStorage) */
  const users = listUsers();
  const sessions = users.flatMap((u) => getSessions(u.id) ?? []);
  const completedCount = sessions.filter((s) => s.completedAt).length;
  const inProgCount = sessions.length - completedCount;
  const byDay = [1, 2, 3, 4, 5, 6, 7].map((d) => sessions.filter((s) => s.day === d && s.completedAt).length);
  const skippedTotal = sessions.reduce((a, s) => a + s.skipped.length, 0);
  const answeredTotal = sessions.reduce((a, s) => Object.keys(s.answers).length, 0);
  const formsTotal = answeredTotal + sessions.reduce((a, s) => a + s.skipped.length * 0 + (s.completedAt ? (s.qids.length - Object.keys(s.answers).length - s.skipped.length) : 0), 0);
  const safetyTotal = users.reduce((a, u) => a + listSafety(u.id).length, 0);
  const certTotal = listCerts().length;
  const journalTotal = users.reduce((a, u) => a + listJournal(u.id).length, 0);
  const momentsTotal = users.reduce((a, u) => a + listMoments(u.id).length, 0);
  const finishers = users.filter((u) => completedDays(u.id).length >= 7).length;
  const avgMinutes = completedCount ? Math.round(sessions.filter((s) => s.completedAt).reduce((a, s) => a + s.timeSpentSec, 0) / completedCount / 60) : 0;

  const storage = useMemo(() => {
    if (typeof window === "undefined") return { bytes: 0, kb: "0 KB" };
    let bytes = 0;
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith("mindtrace:")) bytes += (window.localStorage.getItem(k)?.length ?? 0) + k.length;
    }
    return { bytes, kb: `${(bytes / 1024).toFixed(1)} KB` };
  }, [tick]);

  const completionRate = users.length ? Math.round((finishers / users.length) * 100) : 0;
  void formsTotal;

  return (
    <main className="flex-1 max-w-5xl mx-auto w-full px-5 pb-24">
      <section className="pt-10 pb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="chip bg-lav-100">aggregate statistics · cleared of any personal content</div>
          <h1 className="font-display font-bold text-3xl text-navy-800 mt-2">Admin Console</h1>
          <p className="text-sm text-ink-faint mt-1">Last unlock: {lastAdminLogin() === "never" ? "—" : new Date(lastAdminLogin()).toLocaleString()}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTick((t) => t + 1)} className="btn btn-ghost !py-2 text-sm"><Icon name="refresh" size={15} /> Refresh</button>
          <button onClick={() => setUnlocked(false)} className="btn btn-ghost !py-2 text-sm"><Icon name="logout" size={15} /> Lock</button>
        </div>
      </section>

      {/* headline stats */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {[
          { v: users.length, l: "local profiles", i: "user" },
          { v: `${completionRate}%`, l: "7-day completion rate", i: "chart" },
          { v: `${completedCount}/${sessions.length}`, l: "sessions completed", i: "check" },
          { v: avgMinutes, l: "avg minutes per session", i: "clock" },
        ].map((x) => (
          <div key={x.l} className="card p-5 card-lift">
            <span className="grid place-items-center w-9 h-9 rounded-xl bg-lav-100 text-navy-700 mb-3"><Icon name={x.i} size={17} /></span>
            <div className="font-display font-bold text-3xl text-navy-800 tabular">{x.v}</div>
            <div className="text-[0.72rem] text-ink-faint mt-1 font-medium uppercase tracking-wider">{x.l}</div>
          </div>
        ))}
      </section>

      {/* day funnel */}
      <section className="card p-5 mt-4">
        <div className="font-bold text-ink mb-4 flex items-center gap-2"><Icon name="chart" size={17} /> Retention by journey day</div>
        <div className="space-y-2.5">
          {byDay.map((n, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-12 text-xs font-semibold text-ink-muted">Day {i + 1}</span>
              <div className="flex-1 h-6 bg-lav-50 rounded-lg overflow-hidden">
                <div className="h-full rounded-lg bg-gradient-to-r from-lav-400 to-teal-500/90 transition-all duration-700"
                  style={{ width: `${Math.max(2, (byDay[0] ? (n / Math.max(1, byDay[0])) * 100 : 2))}%` }} />
              </div>
              <span className="w-12 text-right text-xs font-bold tabular">{n}/{byDay[0] || 0}</span>
            </div>
          ))}
        </div>
      </section>

      {/* aggregates grid */}
      <section className="grid lg:grid-cols-2 gap-4 mt-4">
        <div className="card p-5">
          <div className="font-bold text-ink mb-3 flex items-center gap-2"><Icon name="search" size={16} /> Engagement details</div>
          <ul className="space-y-2.5 text-sm">
            {[
              ["In-progress sessions (abandoned/expired)", inProgCount],
              ["Answers submitted", answeredTotal],
              ["Skipped questions (boundaries respected)", skippedTotal],
              ["Journal entries created", journalTotal],
              ["30-day continuation moments", momentsTotal],
              ["Certificates issued", certTotal],
            ].map(([k, v]) => (
              <li key={String(k)} className="flex justify-between gap-3 bg-lav-50 rounded-xl px-4 py-2.5">
                <span className="text-ink-muted">{k}</span>
                <span className="font-bold tabular text-navy-800">{v}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <div className="font-bold text-ink mb-2 flex items-center gap-2"><Icon name="heart" size={16} /> Safety events</div>
            <p className="text-sm text-ink-muted leading-relaxed">
              Times the crisis-flow pause appeared because written answers contained distress language: <strong>{safetyTotal}</strong> across all local profiles.
            </p>
            <p className="text-xs text-ink-faint mt-2 leading-relaxed">
              Records store timestamps and which resource numbers were shown — never the words that triggered them.
            </p>
          </div>

          <div className="card p-5">
            <div className="font-bold text-ink mb-2 flex items-center gap-2"><Icon name="settings" size={16} /> Storage health</div>
            <div className="flex items-center gap-5">
              <ProgressRing pct={Math.min(100, (storage.bytes / (5 * 1024 * 1024)) * 100)} size={86} label="contested" />
              <div>
                <div className="font-bold text-navy-800">{storage.kb}</div>
                <div className="text-xs text-ink-faint">used across {users.length} profile{users.length === 1 ? "" : "s"} by keys named <code className="font-mono">mindtrace:*</code></div>
                <Badge tone={storage.bytes > 4 * 1024 * 1024 ? "danger" : "ok"}>
                  {storage.bytes > 4 * 1024 * 1024 ? "approaching 5 MB browser quota" : "well within quota"}
                </Badge>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="font-bold text-ink mb-2 flex items-center gap-2"><Icon name="user" size={16} /> Profile list</div>
            {users.length === 0 ? <p className="text-sm text-ink-faint">No local profiles yet.</p> : (
              <div className="flex flex-wrap gap-2">
                {users.map((u) => (
                  <span key={u.id} className="chip">
                    {u.name} · {completedDays(u.id).length}/7 · {fmtDate(new Date(u.createdAt))}
                  </span>
                ))}
              </div>
            )}
            <p className="text-[0.7rem] text-ink-faint mt-3">
              Visible on purpose: first name, completion count, created date. Everything emotionally sensitive stays structurally out of admin reach.
            </p>
          </div>
        </div>
      </section>

      <div className="card p-5 mt-4 bg-lav-50">
        <div className="flex gap-3">
          <span className="grid place-items-center w-9 h-9 rounded-xl bg-lav-100 text-navy-700 shrink-0"><Icon name="shield" size={16} /></span>
          <p className="text-[0.8rem] text-ink-muted leading-relaxed">
            This console runs entirely in the administrator&apos;s own browser and reads the same localStorage that holds reflections —
            but it surfaces only aggregates. There is no code path in this page that can print or export any journal, letter or answer text.
          </p>
        </div>
      </div>
    </main>
  );
}

function setAdminLogins(ts: string) {
  // thin wrapper to keep naming tidy (delegates to db helper)
  setAdminLogin(ts);
}
