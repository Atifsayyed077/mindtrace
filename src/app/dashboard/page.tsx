"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Neuro } from "@/components/neuro";
import { Icon } from "@/components/icons";
import { ClientGate, Splash, TopNav, ProgressRing, Badge } from "@/components/ui";
import { LineChart, RadarChart } from "@/components/charts";
import { computeMetrics } from "@/lib/analysis";
import {
  completedDays, deleteJournalEntry, deleteUser, exportUserData, getCurrentUserId, getLetter,
  getSessions, getUser, listCerts, listJournal, listMoments, listUsers, latestReport, setCurrentUserId,
  streak, saveJournalEntry, saveUser, rid, saveLetter, saveMoment, fmtDate, prettyDate, fmtTime,
} from "@/lib/db";
import { qById } from "@/lib/questions";
import { DSession, Moment, User } from "@/lib/types";

export default function DashboardPage() {
  return <div className="flex-1"><TopNav /><ClientGate><DashBody /></ClientGate></div>;
}

function DashBody() {
  const nav = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<DSession[]>([]);
  const [jour, setJour] = useState<ReturnType<typeof listJournal>>([]);
  const [letter, setLetter] = useState<ReturnType<typeof getLetter>>(null);
  const [moms, setMoms] = useState<Moment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    const id = getCurrentUserId();
    if (!id) { nav.replace("/onboarding"); return; }
    const u = getUser(id);
    if (!u) { nav.replace("/onboarding"); return; }
    setUser(u);
    setSessions(getSessions(id));
    setJour(listJournal(id));
    setLetter(getLetter(id));
    setMoms(listMoments(id));
    setUsers(listUsers());
    setDataLoaded(true);
  }, []);

  if (!user) return <Splash note="Opening your dashboard…" />;

  const done = completedDays(user.id);
  const doneSet = new Set(done);
  const doneCount = done.length;
  const st = streak(user.id);
  let upcoming = 8;
  for (let d = 1; d <= 7; d++) if (!doneSet.has(d)) { upcoming = d; break; }
  const report = latestReport(user.id);
  const cert = listCerts().find((c) => c.userId === user.id);
  const metrics = computeMetrics(sessions);
  const pct = (doneCount / 7) * 100;

  /* emit refresh */
  const refresh = () => {
    setSessions(getSessions(user.id));
    setJour(listJournal(user.id));
    setLetter(getLetter(user.id));
    setMoms(listMoments(user.id));
  };

  return (
    <main className="flex-1 max-w-6xl w-full mx-auto px-5 pb-24">
      {/* hero */}
      <section className="pt-10 pb-6">
        <div className="flex flex-wrap items-center gap-5 justify-between">
          <div className="flex items-center gap-5">
            <div className="animate-floaty hidden sm:block"><Neuro size={96} mood={doneCount === 7 ? "proud" : "happy"} blink={false} /></div>
            <div>
              <h1 className="font-display font-bold text-3xl md:text-[2.6rem] text-navy-800 leading-tight">
                Hey, {user.name.split(" ")[0]} 👋
              </h1>
              <p className="text-ink-muted mt-1.5 max-w-lg">
                {doneCount === 0 ? "Nothing boosts a brain like a first breadcrumb. Five minutes, when you're ready."
                  : doneCount < 7 ? `${doneCount} of 7 days done${st > 1 ? ` — streak ${st} 🔥` : ""}. ${upcoming <= 7 ? `Day ${upcoming} is waiting, patiently.` : ""}`
                  : "All seven days sealed. Your report, certificate and 30-day doorways are open. 🎓"}
              </p>
            </div>
          </div>
          <ProgressRing pct={pct} label="journey" />
        </div>
      </section>

      {/* today + calendar */}
      <section className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card p-5 card-lift flex flex-col sm:flex-row sm:items-center gap-5 ornate">
          <div className="flex-1">
            <div className="text-[0.68rem] font-bold tracking-wider uppercase text-ink-faint">
              {upcoming > 7 ? "journey complete" : `today's questionnaire · day ${upcoming}`}
            </div>
            <h2 className="font-display font-bold text-2xl text-navy-800 mt-1.5">
              {upcoming > 7 ? "🎓 The whole journey is yours" : ["Meet Yourself 🤝", "Your Emotional World 🌦️", "Your Habits & Lifestyle 🌿", "Relationships & Connections 🫂", "Stress & Resilience 🛡️", "Dreams & Motivation 🚀", "Reflection & Discovery 🎓"][upcoming - 1]}
            </h2>
            <p className="text-sm text-ink-muted mt-1">
              {upcoming > 7 ? "Report unlocked · certificate ready · 30-day continuation open" : "~5 minutes · one mystery question included"}
            </p>
          </div>
          <Link href={upcoming > 7 ? "/report" : "/journey"} className="btn btn-primary shrink-0">
            {upcoming > 7 ? "Open report" : `Start Day ${upcoming}`} <Icon name="chevron-right" size={16} />
          </Link>
        </div>

        {/* streak + reminder */}
        <div className="card p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[0.68rem] font-bold tracking-wider uppercase text-ink-faint">daily streak</div>
              <div className="font-display font-bold text-3xl text-navy-800 mt-1">{st} <span className="text-lg">🔥</span></div>
            </div>
            <Badge tone={st >= 3 ? "ok" : "lav"}>{st === 0 ? "starts today" : st === 1 ? "nice" : "on fire"}</Badge>
          </div>
          <Raminder uid={user.id} />
        </div>
      </section>

      {/* calendar (7 slots) */}
      <section className="mt-4 card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="font-bold text-ink flex items-center gap-2"><Icon name="calendar" size={17} /> Your 7-day map</div>
          <div className="flex gap-3 text-[0.7rem] text-ink-faint">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-teal-500 inline-block" /> completed</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded border-2 border-lav-300 inline-block" /> pending</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-lav-200 inline-block" /> today</span>
          </div>
        </div>
        <div className="flex gap-2.5 flex-wrap">
          {Array.from({ length: 7 }).map((_, i) => {
            const d = i + 1;
            const state = doneSet.has(d) ? "done" : d === upcoming ? "today" : "pending";
            const s = sessions.find((x) => x.day === d && x.completedAt);
            return (
              <div key={d}
                className={`flex-1 min-w-[92px] rounded-2xl p-3.5 border-2 transition-all ${state === "done" ? "border-teal-500 bg-teal-100" : state === "today" ? "border-lav-400 bg-lav-100" : "border-lav-100 bg-white"}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[0.68rem] font-bold text-ink-faint">DAY {d}</span>
                  {state === "done" ? <span className="text-teal-700"><Icon name="check" size={14} /></span> : <span className="text-lav-400">•</span>}
                </div>
                <div className="font-semibold text-navy-800 text-[0.86rem] leading-snug mt-1">
                  {["Meet Yourself", "Emotional World", "Habits & Lifestyle", "Connections", "Stress & Grit", "Dreams & Identity", "Reflection"] [i]}
                </div>
                <div className="text-[0.68rem] text-ink-faint mt-0.5">{s ? prettyDate(s.effectiveDate) : state === "today" ? "today" : "ready whenever"}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* mood history + wellness indicators */}
      <section className="grid lg:grid-cols-5 gap-4 mt-4">
        <div className="lg:col-span-3 card p-5">
          <div className="font-bold text-ink mb-1 flex items-center gap-2"><Icon name="wave" size={17} /> Mood history</div>
          <p className="text-xs text-ink-faint mb-3">Self-reported wellness indicator (0–100) — not a clinical measurement.</p>
          {metrics.length ? (
            <LineChart height={220} labels={metrics.map((m) => `D${m.day}`)}
              series={[{ name: "Mood wellness indicator", color: "#8a76c9", fill: "true", values: metrics.map((m) => m.moodScore) }]} />
          ) : (
            <div className="text-sm text-ink-muted py-9 text-center">Charts light up after your first session. 🌱</div>
          )}
        </div>
        <div className="lg:col-span-2 card p-5">
          <div className="font-bold text-ink mb-2 flex items-center gap-2"><Icon name="chart" size={17} /> Wellness snapshot</div>
          {metrics.length ? (
            <RadarChart size={260}
              axes={["Emotional", "Sleep", "Stress ↓", "Social", "Movement", "Outdoors", "Positives", "Reflection"]}
              values={[
                Math.round(metrics.reduce((a, m) => a + (m.moodScore ?? 0), 0) / Math.max(1, metrics.filter((m) => m.moodScore !== null).length)),
                Math.round(((metrics.reduce((a, m) => a + (m.sleepH ?? 0), 0) / Math.max(1, metrics.filter((m) => m.sleepH !== null).length)) / 9) * 100),
                Math.round(100 - (metrics.reduce((a, m) => a + (m.stress ?? 5), 0) / Math.max(1, metrics.filter((m) => m.stress !== null).length)) * 10),
                Math.round((doneSet.has(4) ? 70 : 40) + (metrics.filter((m) => (m.moodScore ?? 0) > 70).length * 6)),
                Math.round((metrics.filter((m) => m.moved).length / 7) * 100),
                Math.round((metrics.filter((m) => m.outdoors).length / 7) * 100),
                Math.round((metrics.filter((m) => m.positives.length).length / 7) * 100),
                Math.round((metrics.reduce((a, m) => a + m.words, 0) / 14) * 100),
              ].map((v) => Math.max(6, Math.min(100, v)))} />
          ) : (
            <div className="text-sm text-ink-muted py-9 text-center">Snapshot appears once data lands. ✨</div>
          )}
        </div>
      </section>

      {/* letter vault + journal */}
      <section className="grid lg:grid-cols-2 gap-4 mt-4">
        <LetterCard letter={letter} day={doneCount} userId={user.id} onSaved={() => refresh()} />
        <JournalCard entries={jour} onSave={(t) => { saveJournalEntry(user.id, { id: rid("j"), text: t, date: fmtDate(new Date()), createdAt: new Date().toISOString() }); refresh(); }}
          onDelete={(id) => { deleteJournalEntry(user.id, id); refresh(); }} />
      </section>

      {/* previous responses */}
      <section className="mt-4">
        <ResponsesAccordion sessions={sessions} />
      </section>

      {/* report + certificate status */}
      <section className="grid md:grid-cols-3 gap-4 mt-4">
        <div className="card p-5 card-lift">
          <div className="flex items-center gap-2 font-bold text-ink"><Icon name="lock" size={16} /> Final report</div>
          <p className="text-sm text-ink-muted mt-2 leading-relaxed">
            {report ? "Generated — drawn from all seven days of your answers." : doneCount === 7 ? "Ready tonight — unlock by opening the report page." : `Unlocks after Day 7. ${7 - doneCount} reflection(s) to go.`}
          </p>
          <Link href="/report" className={`btn ${report || doneCount === 7 ? "btn-primary" : "btn-ghost"} w-full mt-4 !py-2.5 text-sm`}>
            {report ? "View report" : "Preview status"} <Icon name="chevron-right" size={15} />
          </Link>
        </div>
        <div className="card p-5 card-lift">
          <div className="flex items-center gap-2 font-bold text-ink"><Icon name="award" size={16} /> Certificate</div>
          <p className="text-sm text-ink-muted mt-2 leading-relaxed">
            {cert ? `Issued ${prettyDate(cert.issuedAt)} · ID ${cert.id}` : "A premium PDF with QR verification waits at the finish line."}
          </p>
          <Link href="/certificate" className={`btn ${cert ? "btn-teal" : "btn-ghost"} w-full mt-4 !py-2.5 text-sm`}>
            {cert ? "Download / verify" : "Preview"} <Icon name="chevron-right" size={15} />
          </Link>
        </div>
        <div className="card p-5 card-lift">
          <div className="flex items-center gap-2 font-bold text-ink"><Icon name="settings" size={16} /> Data controls</div>
          <p className="text-sm text-ink-muted mt-2 leading-relaxed">
            Everything lives in this browser. Export a copy or erase it all — instantly, no guilt-trips.
          </p>
          <div className="flex gap-2 mt-4">
            <button onClick={() => exportUserData(user.id)} className="btn btn-ghost !py-2.5 !px-3.5 text-xs flex-1"><Icon name="download" size={14} /> Export</button>
            <button onClick={() => {
              if (confirm("Delete your account and ALL reflections from this device? This can't be undone — like a TikTok you didn't screenshot.")) {
                deleteUser(user.id); nav.replace("/");
              }
            }} className="btn btn-ghost !py-2.5 !px-3.5 text-xs flex-1 text-danger"><Icon name="trash" size={14} /> Delete</button>
          </div>
        </div>
      </section>

      {/* 30-day continuation */}
      {doneCount === 7 && (
        <section className="mt-4">
          <ContinuationCard moments={moms} userId={user.id} onSaved={() => refresh()} />
        </section>
      )}

      {/* switch user (multi-profile local demo) */}
      {users.length > 1 && (
        <section className="mt-4 card p-5">
          <div className="font-bold text-ink mb-2">Local profiles on this device ({users.length})</div>
          <div className="flex flex-wrap gap-2">
            {users.map((u) => (
              <button key={u.id} onClick={() => { setCurrentUserId(u.id); nav.push("/dashboard"); }}
                className={`chip ${u.id === user.id ? "bg-navy-800 text-white" : ""}`}>{u.name}</button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

/* ── reminder setting (client-side, no sensitive text in prompts) ── */
function Raminder({ uid }: { uid: string }) {
  const user = getUser(uid);
  const [t, setT] = useState(user?.profile.reminderTime ?? "20:00");
  const [nudged, setNudged] = useState(false);
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => { /* denied is fine */ });
    }
  }, []);
  useEffect(() => {
    const u = getUser(uid);
    if (u) { saveUser({ ...u, profile: { ...u.profile, reminderTime: t } }); }
  }, [t, uid]);
  useEffect(() => {
    const iv = setInterval(() => {
      const now = new Date();
      const cur = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const doneAuth = completedDays(uid).length >= 7 || getSessions(uid).some((s) => s.completedAt && s.effectiveDate === fmtDate(new Date()));
      if (!doneAuth && cur === t && !nudged) {
        setNudged(true);
        try {
          new Notification("MindTrace", { body: "Your five-minute reflection is ready. Take a little time for yourself today. 🧠" });
        } catch { /* denied — no harm */ }
      }
    }, 30000);
    return () => clearInterval(iv);
  }, [t, uid, nudged]);
  return (
    <div className="mt-3.5 flex items-center gap-2 text-xs text-ink-muted">
      <Icon name="clock" size={14} /> Nudge me at
      <input type="time" value={t} onChange={(e) => setT(e.target.value)}
        className="field !py-1 !px-2 !w-[104px] text-xs" />
      {doneUser(uid)}
    </div>
  );
}
function doneUser(uid: string) {
  void uid;
  return null;
}

function LetterCard({ letter, day, userId, onSaved }: { letter: ReturnType<typeof getLetter>; day: number; userId: string; onSaved: () => void }) {
  const [txt, setTxt] = useState(letter?.text ?? "");
  const reveal = day >= 7 || !!letter;
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-1">
        <div className="font-bold text-ink flex items-center gap-2"><Icon name="pen" size={16} /> Letter to your future self</div>
        {letter ? <Badge tone="teal">sealed 💌</Badge> : day >= 1 ? <Badge tone="lav">write below</Badge> : <Badge tone="lav">opens Day 1</Badge>}
      </div>
      <p className="text-xs text-ink-faint mb-3">Written once during Day 1 reflection; re-read it on Day 7. It stays private on this device.</p>
      <textarea className="field !min-h-[120px]" placeholder="Dear future…" value={txt} onChange={(e) => setTxt(e.target.value)} />
      <div className="flex items-center justify-between mt-3">
        <span className="text-[0.7rem] text-ink-faint">{letter ? "From your first day. You've grown since." : "Tip: mention what you hope is different in 7 days."}</span>
        {!letter && (
          <button
            onClick={() => {
              if (!txt.trim()) return;
              saveLetter(userId, { id: rid("let"), text: txt.trim(), createdAt: new Date().toISOString() });
              onSaved();
            }}
            className="btn btn-primary !py-2 text-sm">Seal letter</button>
        )}
      </div>
      {letter && reveal && <p className="mt-3 text-sm italic text-ink-muted bg-lav-50 rounded-xl p-3.5">“{letter.text.slice(0, 400)}{letter.text.length > 400 ? "…" : ""}”</p>}
    </div>
  );
}

function JournalCard({ entries, onSave, onDelete }:
  { entries: ReturnType<typeof listJournal>; onSave: (t: string) => void; onDelete: (id: string) => void }) {
  const [txt, setTxt] = useState("");
  return (
    <div className="card p-5">
      <div className="font-bold text-ink flex items-center gap-2 mb-1"><Icon name="book" size={16} /> Personal journal</div>
      <p className="text-xs text-ink-faint mb-3">A private drawer for thoughts that don't fit into questions. Thought-bubble energy allowed.</p>
      <div className="flex gap-2">
        <input className="field" placeholder="One thought, however tiny… (thought bubble 🫧)" value={txt} onChange={(e) => setTxt(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && txt.trim()) { onSave(txt.trim()); setTxt(""); } }} />
        <button onClick={() => { if (txt.trim()) { onSave(txt.trim()); setTxt(""); } }} className="btn btn-primary !px-4"><Icon name="plus" size={16} /></button>
      </div>
      <div className="mt-3 space-y-2 max-h-52 overflow-y-auto pr-1">
        {entries.length === 0 && <div className="text-xs text-ink-faint py-3 text-center">Empty and waiting. Journals are judgment-free zones.</div>}
        {[...entries].reverse().map((e) => (
          <div key={e.id} className="flex items-start gap-2 group bg-lav-50 rounded-xl px-3.5 py-2.5">
            <div className="flex-1">
              <p className="text-[0.86rem] text-ink">{e.text}</p>
              <p className="text-[0.66rem] text-ink-faint mt-0.5">{e.date}</p>
            </div>
            <button onClick={() => onDelete(e.id)} className="opacity-0 group-hover:opacity-100 text-ink-faint hover:text-danger transition-opacity"><Icon name="trash" size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResponsesAccordion({ sessions }: { sessions: DSession[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const doneSessions = sessions.filter((s) => s.completedAt);
  return (
    <div className="card p-5">
      <div className="font-bold text-ink flex items-center gap-2 mb-1"><Icon name="clock" size={16} /> Previous responses</div>
      <p className="text-xs text-ink-faint mb-3">Everything you chose to share, revisitable.</p>
      {doneSessions.length === 0 && <div className="text-sm text-ink-muted py-4 text-center">No sessions yet — the archive is cozy and empty. 🌙</div>}
      <div className="space-y-2">
        {doneSessions.map((s) => {
          const theme = ["Meet Yourself", "Your Emotional World", "Your Habits & Lifestyle", "Relationships & Connections", "Stress & Resilience", "Dreams & Motivation", "Reflection & Discovery"][s.day - 1];
          const answered = Object.keys(s.answers).length;
          return (
            <div key={s.id} className="border border-lav-100 rounded-2xl overflow-hidden">
              <button onClick={() => setOpen(open === s.id ? null : s.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-lav-50 transition-colors">
                <div className="text-left">
                  <div className="font-semibold text-sm text-navy-800">Day {s.day} · {theme}</div>
                  <div className="text-[0.68rem] text-ink-faint">{s.completedAt ? prettyDate(s.effectiveDate) : "in progress"} · {answered} answered · {fmtTime(s.timeSpentSec)}</div>
                </div>
                <Icon name={open === s.id ? "chevron-down" : "chevron-right"} size={16} />
              </button>
              {open === s.id && (
                <div className="px-4 pb-4 space-y-2.5 animate-fade">
                  {s.qids.map((qid) => {
                    const info = Lispa(qid);
                    const a = s.answers[qid];
                    return (
                      <div key={qid} className="bg-lav-50/60 rounded-xl px-3.5 py-2.5">
                        <div className="text-[0.72rem] font-semibold text-navy-700">{info}</div>
                        <div className="text-sm text-ink-muted mt-0.5">
                          {a ? (Array.isArray(a.value) ? a.value.join(" · ") : typeof a.value === "number" ? String(a.value) + "/10" : String(a.value).slice(0, 200)) :
                            s.skipped.includes(qid) ? <span className="italic text-ink-faint">skipped — boundary respected</span> : <span className="italic text-ink-faint">not answered</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* question text lookup by id */
function Lispa(qid: string): string {
  return QUEST_TEXT[qid] ?? qById(qid)?.text ?? qid;
}
const QUEST_TEXT: Record<string, string> = {
  d1q1: "Movie title", d1q2: "Feeling today", d1q3: "Best thing today", d1q4: "Waking state", d1q5: "Enjoyment time",
  d1q6: "Meaningful conversation", d1q2b: "What made it meaningful", d1q7: "One change about today", d1q8: "One thing to understand",
  d1q9: "Letter to future self", d2q1: "Frequent emotion", d2q2: "What made you smile", d2q3: "Unexpected hurt",
  d2q3b: "How you handled it", d2q4: "First reaction to trouble", d2q5: "Comfort expressing emotions", d2q6: "Last time genuinely proud",
  d2q7: "Kept inside", d2q8: "Emotions' message", d3q1: "Sleep hours", d3q2: "Scroll time", d3q3: "Nutrition & water",
  d3q4: "Body moved", d3q5: "Procrasated?", d3q6: "Biggest distraction", d3q7: "Outdoors", d3q8: "Habit to change",
  d3q9: "Routine for a year?", d4q1: "Felt connected", d4q2: "Open-talk person", d4q3: "Someone made day better",
  d4q4: "Lonely in crowds", d4q4b: "What makes it stronger", d4q5: "Saying NO comfort", d4q6: "Enough appreciation time",
  d4q7: "Emotionally safe relationship", d4q8: "Honest message", d5q1: "Mind-hog", d5q2: "Stress 1–10", d5q3: "When problems hit",
  d5q4: "Future-worrying", d5q5: "Relaxation today", d5q6: "Responsibilities manageable", d5q6b: "Heaviest responsibility",
  d5q7: "Drop self-pressure", d5q8: "Advice to friend in your shoes", d6q1: "Excitement about the future", d6q2: "Direction satisfaction",
  d6q3: "What makes you feel alive", d6q4: "Whose expectations", d6q5: "Postponed dream", d6q6: "Most confident when",
  d6q7: "One thing you like about yourself", d6q8: "Thanks from 5-year-later you", d7q1: "Compared to Day 1",
  d7q2: "Current stress 1–10", d7q3: "Last-night sleep", d7q4: "Discovery this week", d7q5: "Thinking-most day",
  d7q6: "Repeated patterns", d7q7: "Happiest moment", d7q8: "Habit lesson", d7q9: "Next 30 days wish",
  d7q10: "One sentence of advice", d7q11: "Current emotional state", d7q12: "Grateful for",
};

function ContinuationCard({ moments, userId, onSaved }: { moments: Moment[]; userId: string; onSaved: () => void }) {
  const [note, setNote] = useState("");
  const [mood, setMood] = useState("");
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-1">
        <div className="font-bold text-ink flex items-center gap-2"><Icon name="refresh" size={16} /> 30-day continuation</div>
        <Badge tone="gold">optional</Badge>
      </div>
      <p className="text-xs text-ink-faint mb-3">A featherweight daily pulse after the journey — one mood, one line. Day {Math.min(30, moments.length + 1)} of 30.</p>
      <div className="flex flex-wrap gap-2">
        {["😄", "🙂", "😐", "🫤", "😢", "🤩"].map((e) => (
          <button key={e} onClick={() => setMood(e)} className={`w-11 h-11 rounded-2xl border-2 text-xl transition-all ${mood === e ? "border-lav-600 bg-lav-100 scale-110" : "border-lav-100 hover:border-lav-300"}`}>{e}</button>
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <input className="field" placeholder="One line about today…" value={note} onChange={(e) => setNote(e.target.value)} />
        <button onClick={() => {
          if (!mood) return;
          saveMoment(userId, { day: moments.length + 1, date: fmtDate(new Date()), mood, note: note.trim() });
          setNote(""); setMood("");
          setTimeout(onSaved, 120);
        }} disabled={!mood} className="btn btn-primary !px-4"><Icon name="check" size={16} /></button>
      </div>
      {moments.length > 0 && (
        <div className="mt-4">
          <MiniMoments moments={moments} />
        </div>
      )}
    </div>
  );
}

function MiniMoments({ moments }: { moments: Moment[] }) {
  const map = { "😄": 90, "🙂": 75, "😐": 55, "🫤": 42, "😢": 30, "🤩": 95 };
  const vals = moments.slice(-30).map((m) => map[m.mood as keyof typeof map] ?? 55);
  return <LineChart height={140} labels={moments.slice(-30).map((m) => `${m.day}`)}
    series={[{ name: "30-day pulse", color: "#35b0a8", fill: "true", values: Object.values(vals).length ? vals : [] }]} />;
}
