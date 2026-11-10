"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Neuro, NEURO_QUOTES } from "@/components/neuro";
import { Icon } from "@/components/icons";
import { ClientGate, Confetti, Splash, TopNav } from "@/components/ui";
import { CrisisOverlay } from "@/components/crisis-overlay";
import { EMOTIONS, buildDaySession, qById, DAY_THEMES } from "@/lib/questions";
import { detectCrisis } from "@/lib/crisis";
import {
  completedDays, getLetter, getSession, getSessions, getCurrentUserId, getUser,
  saveLetter, saveSession, saveReport, rid, streak, todayStr, saveSafety, fmtTime,
} from "@/lib/db";
import { generateFullReport } from "@/lib/analysis";
import { Answer, DSession, Question, User } from "@/lib/types";

/* ═══ session screen ═══ */
export default function JourneyPage() {
  return (
    <div className="flex-1">
      <TopNav />
      <ClientGate>
        <JourneyBody />
      </ClientGate>
    </div>
  );
}

function JourneyBody() {
  const nav = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<DSession[]>([]);
  const [day, setDay] = useState<number | null>(null);
  const [qids, setQids] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [skipped, setSkipped] = useState<string[]>([]);
  const [startedAt, setStartedAt] = useState<string>("");
  const [spent, setSpent] = useState(0);
  const [crate, setCrate] = useState(false); // completion view
  const [crisis, setCrisis] = useState<{ day: number; qid?: string } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const id = getCurrentUserId();
    if (!id) { nav.replace("/onboarding"); return; }
    setUid(id);
    const u = getUser(id);
    if (!u) { nav.replace("/onboarding"); return; }
    setUser(u);

    /* pick lowest incomplete day */
    const done = new Set(completedDays(id));
    const inProg = getSessions(id).find((s) => !s.completedAt);
    if (inProg) {
      /* resume in-flight session */
      bootSession(u.id, inProg.day, inProg.qids, Object.keys(inProg.answers).length);
      setAnswers(inProg.answers);
      setSkipped(inProg.skipped);
      setStartedAt(inProg.startedAt);
      setSpent(inProg.timeSpentSec);
      setDay(inProg.day);
      return;
    }
    if (done.size >= 7) {
      setCrate(true);
      setDay(7);
      return;
    }
    let nextDay = 1;
    for (let d = 1; d <= 7; d++) if (!done.has(d)) { nextDay = d; break; }
    bootFresh(u, nextDay);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const bootFresh = (u: User, d: number) => {
    const qs = buildDaySession(u.profile, d, getSessions(u.id), usedFuns());
    const fun = qs.filter((q) => q.fun).map((q) => q.id);
    usedFunsAdd(fun);
    const s: DSession = {
      id: rid("ses"), userId: u.id, day: d, startedAt: new Date().toISOString(),
      timeSpentSec: 0, effectiveDate: todayStr(), qids: qs.map((q) => q.id), answers: {}, skipped: [],
    };
    saveSession(s);
    setSessions(getSessions(u.id));
    setQids(s.qids);
    setIdx(0);
    setDay(d);
    setAnswers({});
    setSkipped([]);
    setStartedAt(s.startedAt);
  };

  const bootSession = (id: string, d: number, qidsIn: string[], resumeIdx: number) => {
    void id;
    setQids(qidsIn);
    setIdx(Math.min(resumeIdx, Math.max(qidsIn.length - 1, 0)));
    setDay(d);
  };

  /* ticker */
  useEffect(() => {
    if (crate || !day || !startedAt) return;
    timerRef.current = setInterval(() => setSpent((s) => s + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [crate, day, startedAt]);

  const persist = useCallback((over: Partial<DSession> = {}) => {
    if (!user || !day) return;
    const s = getSession(user.id, day);
    if (!s) return;
    saveSession({
      ...s,
      answers, skipped,
      startedAt,
      timeSpentSec: spent,
      ...over,
    });
  }, [user, day, answers, skipped, startedAt, spent]);

  useEffect(() => { if (day && startedAt) persist(); }, [answers, skipped, idx]); // eslint-disable-line

  const q: Question | undefined = useMemo(() => qids[idx] ? qById(qids[idx]) : undefined, [qids, idx]);

  const answeredCount = Object.keys(answers).length;
  const theme = DAY_THEMES.find((t) => t.day === day);

  /* answer handler with crisis gate */
  const submitAnswer = (val: Answer["value"]) => {
    if (!q || !user) return;
    const a: Answer = { qid: q.id, value: val, ts: new Date().toISOString() };
    setAnswers((prev) => ({ ...prev, [q.id]: a }));

    if (q.type === "text") {
      const hit = detectCrisis(String(val));
      if (hit) {
        setCrisis({ day: day ?? 0, qid: q.id });
        saveSafety(user.id, { id: rid("safe"), ts: new Date().toISOString(), day: day ?? 0, qid: q.id, wordCount: 2, resourcesShown: ["Tele-MANAS 14416", "112"] });
        return;
      }
    }
    setIdx((i) => i + 1);
  };

  const skip = () => {
    if (!q) return;
    setSkipped((sk) => [...new Set([...sk, q.id])]);
    setIdx((i) => i + 1);
  };

  const back = () => setIdx((i) => Math.max(0, i - 1));

  const finish = useCallback(() => {
    if (!user || !day) return;
    const s = getSession(user.id, day);
    if (!s) return;
    saveSession({ ...s, answers, skipped, timeSpentSec: spent, completedAt: new Date().toISOString() });

    if (day === 1 && answers["d1q9"]?.value) {
      saveLetter(user.id, { id: rid("let"), text: String(answers["d1q9"].value), createdAt: new Date().toISOString() });
    }

    if (day === 7) {
      const all = getSessions(user.id);
      const report = generateFullReport(user, all);
      saveReport({ id: rid("rep"), userId: user.id, generatedAt: new Date().toISOString(), report });
    }
    setCrate(true);
    setSessions(getSessions(user.id));
  }, [user, day, answers, skipped, spent]);

  /* "end session early" event from crisis overlay */
  useEffect(() => {
    const h = () => finish();
    window.addEventListener("mindtrace:skip-remaining", h);
    return () => window.removeEventListener("mindtrace:skip-remaining", h);
  }, [finish]);

  const quote = useMemo(() => NEURO_QUOTES[Math.floor(Math.random() * NEURO_QUOTES.length)], [day]);

  if (!user) return <Splash note="Fetching your brain's file…" />;
  if (crate) return <CompletionView user={user} day={day!} answered={answeredCount} total={qids.length} time={spent} sessions={sessions} onNext={day! < 7 ? () => nav.push("/dashboard") : () => nav.push("/report")} />;

  return (
    <main className="flex-1">
      {crisis && <CrisisOverlay day={crisis.day} qid={crisis.qid} onClose={() => setCrisis(null)} />}
      <div className="max-w-2xl mx-auto px-5 pb-28 pt-8">
        {/* header row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <span className="grid place-items-center w-11 h-11 rounded-2xl bg-navy-800 text-white font-display font-bold">{day}</span>
            <div>
              <div className="font-bold text-navy-800 text-lg leading-none">{theme?.emoji} {theme?.title}</div>
              <div className="text-[0.78rem] text-ink-faint mt-1">Session {day}/7 · about five minutes, promise</div>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1.5 text-ink-faint text-[0.8rem] justify-end"><Icon name="clock" size={14} /> {fmtTime(spent)}</div>
            <div className="text-[0.78rem] text-ink-faint">streak {streak(user.id)} 🔥</div>
          </div>
        </div>

        {/* progress bar */}
        <div className="h-2.5 bg-lav-100 rounded-full overflow-hidden mt-3">
          <div className="h-full bg-gradient-to-r from-lav-400 via-lav-600 to-teal-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.round(((idx + (Object.keys(answers).length ? 1 : 0)) / Math.max(qids.length, 1)) * 100)}%` }} />
        </div>
        <div className="flex justify-between text-[0.75rem] text-ink-faint mt-1.5 mb-6">
          <span>{idx}/{qids.length} questions</span>
          <span className="italic text-lav-600">{quote}</span>
        </div>

        {/* question card */}
        {q && (
          <div key={q.id} className="card p-6 sm:p-8 animate-pop-in">
            {q.fun && (
              <span className="chip mb-4 bg-gold-100 text-gold-600">🎲 from Neuro&apos;s mystery jar</span>
            )}
            {q.optional && <span className="chip mb-4">optional · skip anytime</span>}
            <h2 className="font-display text-[1.5rem] font-semibold leading-snug text-navy-800">{q.text}</h2>
            {q.hint && <p className="text-sm text-ink-faint mt-1">{q.hint}</p>}

            <div className="mt-6">
              {q.type === "emotion" && <EmotionPicker value={String(answers[q.id]?.value ?? "")} onPick={(v) => submitAnswer(v)} />}
              {q.type === "choice" && <ChoicePicker options={q.options ?? []} value={answers[q.id]?.label ?? ""} onPick={(opt) => submitAnswer(opt.value)} />}
              {q.type === "scale" && <ScalePicker value={Number(answers[q.id]?.value ?? 0)} onSet={(n) => submitAnswer(n)} />}
              {q.type === "text" && <TextPicker value={String(answers[q.id]?.value ?? "")} onNext={() => submitAnswer(String(answers[q.id]?.value ?? ""))} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: { qid: q.id, value: v, ts: new Date().toISOString() } }))} />}
              {q.type === "time" && <ChoicePicker options={q.options ?? []} value={answers[q.id]?.label ?? ""} onPick={(opt) => submitAnswer(opt.value)} />}
              {q.type === "multi" && <MultiPicker options={q.options ?? []} onDone={(vals, labels) => submitAnswer(vals)} />}
            </div>

            {/* footer controls */}
            <div className="flex items-center justify-between mt-8 pt-4 border-t border-lav-100">
              <button onClick={back} disabled={idx === 0} className="btn btn-ghost !px-4">
                <Icon name="chevron-left" size={16} /> Back
              </button>
              <div className="flex items-center gap-2">
                <button onClick={skip} className="text-xs text-ink-faint hover:text-ink-muted underline underline-offset-2 px-3">
                  skip
                </button>
                {q.type === "text" ? (
                  <button onClick={() => submitAnswer(String(answers[q.id]?.value ?? ""))} className="btn btn-primary">
                    Next <Icon name="chevron-right" size={16} />
                  </button>
                ) : (
                  <span className="text-[0.72rem] text-ink-faint">pick to continue ✨</span>
                )}
              </div>
            </div>
          </div>
        )}

        {idx >= qids.length && (
          <div className="card p-8 text-center animate-pop-in mt-4">
            <div className="text-3xl mb-2">🏁</div>
            <h2 className="font-display font-bold text-2xl text-navy-800 mb-2">That&apos;s everything from today&apos;s set.</h2>
            <p className="text-sm text-ink-muted mb-5">Seal it with one click and Neuro will archive it with full honours.</p>
            <button onClick={finish} className="btn btn-primary px-8">Complete day {day} <Icon name="check" size={17} /></button>
            <button onClick={back} className="btn btn-ghost ml-2">review answers</button>
          </div>
        )}
      </div>

      {/* floating Neuro commentary */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 hidden md:flex items-center gap-3 card px-4 py-2.5 shadow-card">
        <Neuro size={38} mood={idx % 3 === 0 ? "thinking" : "happy"} blink={false} />
        <span className="text-[0.8rem] text-ink-muted pr-2">
          {idx >= qids.length ? "Ready when you are. No pressure. I'm literally sitting in a jar." :
            `Question ${idx + 1} of ${qids.length} — your pace is exactly right.`}
        </span>
      </div>
    </main>
  );
}

/* ═══ question widgets ═══ */
function EmotionPicker({ value, onPick }: { value: string; onPick: (v: string) => void }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
      {EMOTIONS.map((e, i) => {
        const sel = value === e.value;
        return (
          <button key={e.value} onClick={() => onPick(e.value)}
            className={`group flex flex-col items-center gap-1.5 rounded-2xl border-2 py-3.5 px-2 transition-all duration-200 hover:-translate-y-1 ${sel ? "border-lav-600 bg-lav-100 shadow-card scale-[1.04]" : "border-lav-100 bg-white hover:border-lav-300"}`}
            style={{ animation: `pop-in .4s cubic-bezier(.22,1.4,.36,1) ${i * 25}ms both` }}>
            <span className={`text-3xl transition-transform group-hover:scale-125 ${sel ? "scale-125" : ""}`}>{e.emoji}</span>
            <span className={`text-[0.73rem] font-semibold ${sel ? "text-navy-800" : "text-ink-muted"}`}>{e.value}</span>
          </button>
        );
      })}
    </div>
  );
}

function ChoicePicker({ options, value, onPick }: { options: { label: string; value: string }[]; value: string; onPick: (o: { label: string; value: string }) => void }) {
  return (
    <div className="grid gap-2.5">
      {options?.map((o, i) => (
        <button key={o.value} onClick={() => onPick(o)}
          className={`text-left px-4 py-3.5 rounded-2xl border-2 transition-all duration-200 font-medium text-[0.93rem] animate-rise ${value === o.label ? "border-lav-600 bg-lav-100 text-navy-800 translate-x-1" : "border-lav-100 bg-white text-ink-muted hover:border-lav-400"}`}
          style={{ animationDelay: `${i * 40}ms` }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ScalePicker({ value, onSet }: { value: number; onSet: (n: number) => void }) {
  const [local, setLocal] = useState(value || 5);
  const labels = ["1 · calm", "", "", "", "", "", "", "", "", "10 · boiling"];
  const emoji = ["😌", "🙂", "🙂", "😐", "😐", "😨", "😧", "😰", "🥵", "🥵"];
  return (
    <div>
      <div className="text-center py-6">
        <div className={`text-6xl mb-2 transition-transform ${local <= 3 ? "animate-breathe" : "animate-wobble"}`}>{emoji[local - 1]}</div>
        <div className="font-display font-bold text-4xl text-navy-700 tabular">{local}</div>
        <div className="text-xs text-ink-faint">{local <= 3 ? labels[0] : local >= 10 ? labels[9] : "somewhere between"}</div>
      </div>
      <input type="range" min={1} max={10} value={local} className="w-full h-2 cursor-pointer"
        onChange={(e) => { const n = Number(e.target.value); setLocal(n); }} />
      <div className="flex justify-between text-[0.7rem] text-ink-faint mt-1"><span>1</span><span>10</span></div>
      <button onClick={() => onSet(local)} className="btn btn-primary w-full mt-5">Lock in {local}/10</button>
    </div>
  );
}

function TextPicker({ value, onNext, onChange }: { value: string; onNext: () => void; onChange: (v: string) => void }) {
  return (
    <div>
      <textarea className="field !min-h-[130px]" placeholder="Write it the way you'd say it…" value={value} onChange={(e) => onChange(e.target.value)} />
      <div className="flex items-center justify-between mt-3 text-[0.76rem] text-ink-faint">
        <span>{value.trim().length} chars · saved automatically on-device</span>
        <button onClick={onNext} className="btn btn-primary !py-2.5 !px-5 text-sm">Continue <Icon name="chevron-right" size={15} /></button>
      </div>
    </div>
  );
}

function MultiPicker({ options, onDone }: { options: { label: string; value: string }[]; onDone: (vals: string[], labels: string[]) => void }) {
  const [sel, setSel] = useState<string[]>([]);
  return (
    <div>
      <div className="grid gap-2.5">
        {options?.map((o) => {
          const on = sel.includes(o.value);
          return (
            <button key={o.value} onClick={() => setSel((s) => (on ? s.filter((x) => x !== o.value) : [...s, o.value]))}
              className={`text-left px-4 py-3.5 rounded-2xl border-2 transition-all font-medium text-[0.93rem] flex items-center justify-between ${on ? "border-teal-500 bg-teal-100 text-teal-700" : "border-lav-100 bg-white text-ink-muted hover:border-lav-400"}`}>
              {o.label}
              {on && <Icon name="check" size={16} />}
            </button>
          );
        })}
      </div>
      <button onClick={() => onDone(sel, options.filter((o) => sel.includes(o.value)).map((o) => o.label))} disabled={!sel.length} className="btn btn-primary w-full mt-5">
        {sel.length ? `Continue with ${sel.length} picked` : "Pick at least one"}
      </button>
    </div>
  );
}

/* ═══ completion ═══ */
function CompletionView({ user, day, answered, total, time, sessions, onNext }:
  { user: NonNullable<ReturnType<typeof getUser>>; day: number; answered: number; total: number; time: number; sessions: DSession[]; onNext: () => void }) {
  const done = new Set(completedDays(user.id)).size;
  const [confetti, setConfetti] = useState(false);
  useEffect(() => { setConfetti(true); const t = setTimeout(() => setConfetti(false), 2200); return () => clearTimeout(t); }, []);
  const streakNow = typeof window !== "undefined" ? streak(user.id) : 0;
  const letter = getLetter(user.id);
  const closing = [
    "You made time for yourself today. That matters. See you tomorrow.",
    "That's five minutes of listening to the person you spend every day with. See you tomorrow.",
    "Filed, archived, appreciated. Go do something unreasonably nice for yourself.",
    "Your brain did a tiramisu of feelings and you tasted every layer. Rest now. See you tomorrow.",
  ];
  return (
    <main className="flex-1 relative overflow-hidden">
      {confetti && <Confetti />}
      <div className="max-w-xl mx-auto px-5 py-16 text-center animate-pop-in">
        <div className="animate-floaty inline-block"><Neuro size={150} mood="proud" /></div>
        <div className="chip bg-teal-100 text-teal-700 mt-6">day {day} sealed ✓</div>
        <h1 className="font-display font-bold text-[2.2rem] leading-tight text-navy-800 mt-3">Today&apos;s reflection is complete.</h1>
        <p className="text-ink-muted mt-3">{closing[day % closing.length]}</p>

        <div className="grid grid-cols-3 gap-3 mt-8">
          {[
            { k: `Day ${day}`, v: "sealed", i: "calendar" },
            { k: `${answered}/${total}`, v: "questions answered", i: "check" },
            { k: fmtTime(time), v: "time spent", i: "clock" },
          ].map((s) => (
            <div key={s.v} className="card p-4">
              <Icon name={s.i} size={18} className="mx-auto text-lav-600" />
              <div className="font-bold tabular mt-1.5">{s.k}</div>
              <div className="text-[0.68rem] text-ink-faint mt-0.5">{s.v}</div>
            </div>
          ))}
        </div>

        <div className="card p-5 mt-4 text-left">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[0.72rem] font-bold uppercase tracking-wider text-ink-faint">Journey progress</div>
              <div className="font-bold text-lg">{done}/7 days completed {streakNow > 1 && `· streak ${streakNow} 🔥`}</div>
            </div>
            <div className="text-3xl">{done === 7 ? "🎓" : ["🌱", "🌱", "🌿", "🌿", "🌳", "🌳", "🌸"][done - 1]}</div>
          </div>
          <div className="h-2 bg-lav-100 rounded-full mt-3 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-lav-400 via-lav-600 to-teal-500 rounded-full" style={{ width: `${(done / 7) * 100}%`, transition: "width .8s cubic-bezier(.22,1,.36,1)" }} />
          </div>
          {completedDays(user.id).length === 7 && (
            <div className="mt-4 chip bg-gold-100 text-gold-600">🎓 journey complete — your report & certificate are unlocked</div>
          )}
          {day === 1 && letter && (
            <div className="mt-4 text-[0.82rem] text-ink-muted bg-lav-50 rounded-xl p-3.5">
              💌 Your letter to future-you is sealed in the vault. On Day 7, Neuro hands you the key.
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 mt-7">
          <button onClick={onNext} className="btn btn-primary w-full">
            {done === 7 ? "See my 7-day report 🎓" : "Back to dashboard"} <Icon name="chevron-right" size={16} />
          </button>
          <button onClick={() => onNext()} className="btn btn-ghost w-full text-sm">Take another look at the day&apos;s answers</button>
        </div>
        <p className="text-xs text-ink-faint mt-6">No reminders? Dashboard → set a nudging hour. Missed a day? Today&apos;s set takes you back gracefully.</p>
      </div>
    </main>
  );
}

/* helpers */
function usedFuns(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem("mindtrace:funused") || "[]") as string[]); }
  catch { return new Set(); }
}
function usedFunsAdd(ids: string[]) {
  try {
    const all = [...usedFuns(), ...ids];
    localStorage.setItem("mindtrace:funused", JSON.stringify(all));
  } catch { /* non-fatal */ }
}
