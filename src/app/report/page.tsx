"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Neuro } from "@/components/neuro";
import { Icon } from "@/components/icons";
import { ClientGate, Splash, TopNav, Badge } from "@/components/ui";
import { LineChart, BarList, RadarChart } from "@/components/charts";
import { computeMetrics, generateFullReport } from "@/lib/analysis";
import { completedDays, getCurrentUserId, getSessions, getUser, latestReport, listCerts, saveCert, saveReport, rid } from "@/lib/db";
import { DSession, User } from "@/lib/types";

export default function ReportPage() {
  return <div className="flex-1"><TopNav /><ClientGate><ReportBody /></ClientGate></div>;
}

function ReportBody() {
  const nav = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<DSession[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = getCurrentUserId();
    if (!id) { nav.replace("/onboarding"); return; }
    const u = getUser(id);
    if (!u) { nav.replace("/onboarding"); return; }
    setUser(u);
    setSessions(getSessions(id));
    setReady(true);
  }, []);

  if (!ready || !user) return <Splash />;
  const doneCount = completedDays(user.id).length;
  const existing = latestReport(user.id);

  if (doneCount < 7) {
    return (
      <main className="flex-1 max-w-xl mx-auto px-5 py-20 text-center">
        <div className="animate-floaty inline-block"><Neuro size={140} mood="sleep" blink={false} /></div>
        <div className="card p-8 mt-8 animate-pop-in text-left">
          <h1 className="font-display font-bold text-3xl text-navy-800 text-center">🔒 The Vault is still sealed</h1>
          <p className="text-ink-muted text-center mt-3 leading-relaxed">
            Your seven-day report is generated only from a complete journey — all seven days of honest answers.
            incomplete journeys don&apos;t get dramatized conclusions; they get imaginary ones. So we wait, patiently.
          </p>
          <div className="flex items-center justify-center gap-4 mt-6">
            <div className="text-center">
              <div className="font-display font-bold text-4xl text-navy-700">{doneCount}/7</div>
              <div className="text-[0.7rem] text-ink-faint font-medium uppercase tracking-wider">days completed</div>
            </div>
          </div>
          <div className="h-3 bg-lav-100 rounded-full mt-5 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-lav-400 via-lav-600 to-teal-500" style={{ width: `${(doneCount / 7) * 100}%` }} />
          </div>
          <Link href="/journey" className="btn btn-primary w-full mt-7">
            Continue the journey <Icon name="chevron-right" size={16} />
          </Link>
        </div>
      </main>
    );
  }

  /* if no report yet (e.g., user finished via an older build), generate now */
  let report = existing?.report ?? null;
  if (!report) {
    report = generateFullReport(user, sessions.filter((s) => s.completedAt));
    saveReport({ id: rid("rep"), userId: user.id, generatedAt: new Date().toISOString(), report });
    /* also ensure certificate record exists */
    const certs = listCerts();
    if (!certs.some((c) => c.userId === user.id)) {
      const id = `MT7-${rand4()}-${rand4()}`;
      saveCert({ id, userId: user.id, name: user.name, issuedAt: new Date().toISOString() });
    }
  }

  return <FullReportView user={user} report={report} sessions={sessions} />;
}

function rand4() {
  return Array.from(crypto.getRandomValues(new Uint8Array(2))).map((n) => (n % 16).toString(16) + Math.floor(Math.random() * 16).toString(16).slice(0, 1)).join("").slice(0, 4).toUpperCase();
}

function FullReportView({ user, report, sessions }: { user: User; report: NonNullable<ReturnType<typeof latestReport>>["report"]; sessions: DSession[] }) {
  const cert = listCerts().find((c) => c.userId === user.id);
  const metrics = computeMetrics(sessions.filter((s) => s.completedAt));

  const radarAxes = ["Emotional", "Sleep & rest", "Low stress", "Connection", "Motivation", "Confidence", "Satisfaction", "Habit health"];
  const radarVals = [
    Math.round(report.emotionalJourney.series.reduce((a, s) => a + s.mood, 0) / Math.max(1, report.emotionalJourney.series.length)),
    Math.round((report.lifestyle.sleepAvg ?? 6.5) / 9 * 100),
    Math.round(100 - (report.lifestyle.screenAvg ?? 2) * 18 - ((metrics.reduce((a, m) => a + (m.stress ?? 5), 0) / Math.max(1, metrics.length)) * 4)),
    Math.round(report.summary.attention.includes("Social connection") ? 34 : 62),
    Math.round(62 + report.strengths.length * 6),
    Math.round(report.strengths.some((s) => s.title.includes("worth")) ? 72 : 55),
    Math.round(report.summary.goingWell.length * 14 + 24),
    Math.round((report.lifestyle.movementDays / 7) * 60 + (report.lifestyle.outdoorsDays / 7) * 40),
  ].map((v) => Math.max(6, Math.min(100, v)));

  return (
    <main className="flex-1 max-w-4xl mx-auto px-5 pb-24">
      {/* hero */}
      <section className="pt-10 pb-6 text-center relative">
        <div className="animate-floaty inline-block"><Neuro size={120} mood="proud" /></div>
        <div className="chip bg-teal-100 text-teal-700 mt-4">🎓 journey complete — report rendered on-device</div>
        <h1 className="font-display font-bold text-4xl text-navy-800 mt-3">Your Personal Wellness Report</h1>
        <p className="text-ink-muted mt-3 max-w-xl mx-auto">{report.intro}</p>
        <div className="flex gap-2 justify-center mt-5 no-print">
          <button onClick={() => window.print()} className="btn btn-ghost !py-2.5 text-sm"><Icon name="download" size={15} /> Print / save as PDF</button>
          <Link href="/certificate" className="btn btn-primary !py-2.5 text-sm"><Icon name="award" size={15} /> Get certificate</Link>
        </div>
      </section>

      {/* disclaimer ribbon */}
      <div className="card-lift card p-4 mb-6 flex gap-3 bg-lav-50">
        <span className="text-lav-600 mt-0.5"><Icon name="shield" size={18} /></span>
        <p className="text-[0.83rem] text-ink-muted leading-relaxed">{report.disclaimer}</p>
      </div>

      {/* B — emotional journey */}
      <Section n="B" title="Emotional Journey" icon="wave">
        <p className="text-ink-muted mb-4">{report.emotionalJourney.note}</p>
        <LineChart labels={report.emotionalJourney.series.map((s) => `D${s.day}`)}
          series={[
            { name: "Mood wellness indicator", color: "#8a76c9", fill: "true", values: report.emotionalJourney.series.map((s) => s.mood) },
            ...(report.emotionalJourney.series.some((s) => s.stress !== undefined) ? [{ name: "Reported stress ×10", color: "#e0a04b", values: report.emotionalJourney.series.map((s) => (s.stress ?? 0) * 10) as (number | null)[] }] : []),
          ]} />
        <div className="grid sm:grid-cols-2 gap-4 mt-5">
          <div>
            <h4 className="text-[0.7rem] font-bold uppercase tracking-wider text-ink-faint mb-2">Dominant day-words</h4>
            <div className="flex flex-wrap gap-2">
              {report.emotionalJourney.dominantEmotions.map((e) => <Badge key={e} tone="lav">{e}</Badge>)}
            </div>
          </div>
          <div>
            <h4 className="text-[0.7rem] font-bold uppercase tracking-wider text-ink-faint mb-2">Positive moments you named</h4>
            <ul className="space-y-1.5">
              {report.emotionalJourney.positives.slice(0, 4).map((p, i) => (
                <li key={i} className="text-[0.83rem] text-ink-muted bg-teal-100/60 rounded-xl px-3 py-1.5">✨ {p}</li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* A — personal introduction anchored after emotion per narrative flow */}
      <Section n="A" title="Personal Introduction" icon="user">
        <p className="text-ink-muted leading-relaxed">{report.intro}</p>
        <div className="flex flex-wrap gap-2 mt-4">
          <Badge tone="gold">{user.name}</Badge>
          <Badge tone="lav">{metrics.reduce((a, m) => a + m.answered, 0)} question answers</Badge>
          <Badge tone="teal">{Math.round(sessions.reduce((a, s) => a + s.timeSpentSec, 0) / 60) || 1} minutes of reflection</Badge>
        </div>
      </Section>

      {/* C — lifestyle */}
      <Section n="C" title="Your Lifestyle Analysis" icon="leaf">
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { i: "moon", t: "Sleep", v: report.lifestyle.sleepAvg !== null ? `~${report.lifestyle.sleepAvg} h avg` : "data partial", d: report.lifestyle.sleepNote },
            { i: "phone", t: "Screen time", v: report.lifestyle.screenAvg !== null ? `~${report.lifestyle.screenAvg} h/day` : "data partial", d: report.lifestyle.screenNote },
            { i: "sun", t: "Movement", v: `${report.lifestyle.movementDays}/7 days`, d: report.lifestyle.movementNote },
            { i: "leaf", t: "Outdoors", v: `${report.lifestyle.outdoorsDays}/7 days`, d: report.lifestyle.outdoorsNote },
          ].map((x) => (
            <div key={x.t} className="rounded-2xl border border-lav-100 p-4 flex gap-3.5">
              <span className="grid place-items-center w-10 h-10 rounded-xl bg-lav-100 text-navy-700 shrink-0"><Icon name={x.i} size={18} /></span>
              <div>
                <div className="font-semibold text-ink text-sm">{x.t} <span className="text-lav-600">· {x.v}</span></div>
                <p className="text-[0.8rem] text-ink-muted mt-1 leading-relaxed">{x.d}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5">
          <h4 className="text-[0.7rem] font-bold uppercase tracking-wider text-ink-faint mb-3">Routine texture across the week</h4>
          <p className="text-sm text-ink-muted leading-relaxed">{report.lifestyle.routineNote}</p>
          <div className="grid grid-cols-3 gap-3 mt-4">
            <MiniStat label="Movement days" value={`${report.lifestyle.movementDays}/7`} pct={(report.lifestyle.movementDays / 7) * 100} />
            <MiniStat label="Outdoors days" value={`${report.lifestyle.outdoorsDays}/7`} pct={(report.lifestyle.outdoorsDays / 7) * 100} />
            <MiniStat label="Sleep avg" value={report.lifestyle.sleepAvg ? `${report.lifestyle.sleepAvg}h` : "—"} pct={((report.lifestyle.sleepAvg ?? 0) / 9) * 100} />
          </div>
        </div>
      </Section>

      {/* D — strengths */}
      <Section n="D" title="Your Personal Strengths" icon="heart">
        {report.strengths.length === 0 ? (
          <p className="text-ink-muted">Not enough consistent signal this week to name strengths honestly. The absence of evidence isn&apos;t the absence of strength — it just means we keep watching, gently.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3.5">
            {report.strengths.map((s, i) => (
              <div key={i} className="rounded-2xl border border-teal-100 bg-teal-100/40 p-4">
                <div className="font-semibold text-ink text-sm flex items-center gap-2"><Icon name="check" size={15} className="text-teal-700" /> {s.title}</div>
                <p className="text-[0.8rem] text-ink-muted mt-1.5 leading-relaxed">Evidence: {s.evidence}</p>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* E — areas worth improving */}
      <Section n="E" title="Areas Worth Improving" icon="chart" sub="Maximum five — chosen only where your answers repeated a signal.">
        {report.areas.length === 0 ? (
          <p className="text-ink-muted">No heavy flags in your reports. Keep maintaining whatever you&apos;re doing — routine may be boring, but boring can be beautiful.</p>
        ) : report.areas.map((a, i) => (
          <div key={i} className="rounded-2xl border border-lav-100 p-4.5 mb-3 p-4">
            <div className="font-semibold text-ink flex items-center gap-2"><span className="grid place-items-center w-6 h-6 rounded-lg bg-lav-100 text-lav-600 text-xs font-bold">{i + 1}</span>{a.title}</div>
            <div className="grid sm:grid-cols-3 gap-3 mt-3 text-[0.82rem]">
              <div className="bg-white rounded-xl border border-lav-100 p-3"><div className="text-[0.66rem] font-bold uppercase text-ink-faint tracking-wide mb-1">What you reported</div><p className="text-ink-muted">{a.reported}</p></div>
              <div className="bg-white rounded-xl border border-lav-100 p-3"><div className="text-[0.66rem] font-bold uppercase text-ink-faint tracking-wide mb-1">Why it might matter</div><p className="text-ink-muted">{a.why}</p></div>
              <div className="bg-teal-100/60 rounded-xl border border-teal-100 p-3"><div className="text-[0.66rem] font-bold uppercase text-teal-700 tracking-wide mb-1">A practical suggestion</div><p className="text-ink-muted">{a.suggestion}</p></div>
            </div>
          </div>
        ))}
      </Section>

      {/* F — progress comparison */}
      <Section n="F" title="Seven-Day Progress Comparison" icon="chart">
        <p className="text-ink-muted leading-relaxed">{report.progress.note}</p>
        <div className="grid grid-cols-3 gap-3 mt-5">
          <DeltaCard label="Mood indicator" delta={report.progress.moodDelta} suffix="pts" lower={report.progress.worsened} />
          <DeltaCard label="Reported stress" delta={report.progress.stressDelta} suffix="/10" invert />
          <DeltaCard label="Sleep" delta={report.progress.sleepDelta} suffix="h" />
        </div>
        <div className="mt-5 space-y-2">
          {report.progress.insights.map((ins, i) => (
            <div key={i} className="bg-lav-50 rounded-xl px-4 py-2.5 text-[0.85rem] text-ink-muted">🧠 {ins}</div>
          ))}
        </div>
      </Section>

      {/* Wellness snapshot radar */}
      <Section n="✨" title="Wellness Snapshot" icon="chart">
        <p className="text-xs text-ink-faint mb-2 text-center">Self-reported wellness indicators (0–100). Not clinical measurements.</p>
        <RadarChart axes={radarAxes} values={radarVals} />
      </Section>

      {/* G — summary */}
      <Section n="G" title="Personal Wellness Summary" icon="book">
        <div className="grid sm:grid-cols-2 gap-3.5">
          <SummaryBox tone="teal" title="What appears to be going well" items={report.summary.goingWell} />
          <SummaryBox tone="gold" title="What may be challenging" items={report.summary.challenging} />
          <SummaryBox tone="lav" title="What deserves attention" items={report.summary.attention.map((a) => typeof a === "string" ? a : a)} />
          <SummaryBox tone="lav" title="What you want to change (your words)" items={report.summary.wantsChange} />
        </div>
        <div className="mt-4 rounded-xl bg-white border border-lav-100 p-4">
          <div className="text-[0.7rem] font-bold uppercase tracking-wider text-ink-faint mb-2">What to explore next</div>
          <ul className="space-y-1.5">{report.summary.exploreNext.map((x, i) => <li key={i} className="text-[0.85rem] text-ink-muted">→ {x}</li>)}</ul>
        </div>
        <div className="mt-4 rounded-xl bg-white border border-dashed border-lav-200 p-4">
          <div className="text-[0.7rem] font-bold uppercase tracking-wider text-ink-faint mb-2">Honesty corner — what we do NOT know</div>
          <ul className="space-y-1.5">{report.summary.gaps.map((x, i) => <li key={i} className="text-[0.83rem] text-ink-muted">┊ {x}</li>)}</ul>
        </div>
      </Section>

      {/* H — next steps: 30-day plan */}
      <Section n="H" title="Recommended Next Steps" icon="sun">
        <p className="text-sm text-ink-muted mb-4">A realistic four-week shape — pick ONE anchor per week. Superhero months fail; boring months win.</p>
        <div className="grid sm:grid-cols-2 gap-3.5">
          {report.plan.weeks.map((w) => (
            <div key={w.wk} className="rounded-2xl border border-lav-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="chip !py-0.5">{w.wk}</span>
                <span className="font-semibold text-ink text-sm">{w.title}</span>
              </div>
              <ul className="space-y-1.5">
                {w.items.map((it, i) => <li key={i} className="text-[0.83rem] text-ink-muted flex gap-2"><span className="text-lav-600">•</span>{it}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* action plan */}
      <Section n="🌿" title="Your Personal Wellness Action Plan" icon="leaf">
        <div className="grid sm:grid-cols-2 gap-3.5">
          {report.plan.sections.map((sec) => (
            <div key={sec.title} className={`rounded-2xl p-4 border ${sec.title === "START" ? "border-teal-100 bg-teal-100/40" : sec.title === "REDUCE" ? "border-[#f7e6cc] bg-[#fdf3e3]" : sec.title === "CONTINUE" ? "border-lav-100 bg-lav-100/60" : "border-[#f5d8da] bg-[#fdf0f1]"}`}>
              <div className="font-bold text-sm text-ink tracking-wide mb-2">{sec.title}</div>
              <ul className="space-y-2">
                {sec.items.map((it, i) => <li key={i} className="text-[0.85rem] text-ink-muted flex gap-2 leading-relaxed">
                  <span>{sec.title === "START" ? "🌱" : sec.title === "REDUCE" ? "🪫" : sec.title === "CONTINUE" ? "🔁" : "🚧"}</span>{it}
                </li>)}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-5 grid sm:grid-cols-3 gap-3">
          {[
            { t: "Morning", i: "sun", items: report.plan.routine.morning },
            { t: "Afternoon", i: "coffee", items: report.plan.routine.afternoon },
            { t: "Evening", i: "moon", items: report.plan.routine.evening },
          ].map((r) => (
            <div key={r.t} className="rounded-2xl border border-lav-100 p-4">
              <div className="font-semibold text-ink text-sm mb-2 flex items-center gap-2"><Icon name={r.i} size={15} /> {r.t}</div>
              <ul className="space-y-1.5">{r.items.map((it, i) => <li key={i} className="text-[0.78rem] text-ink-muted leading-relaxed">◦ {it}</li>)}</ul>
            </div>
          ))}
        </div>
      </Section>

      {/* professional support */}
      <div className={`card p-5 mt-6 ${report.plan.professionalSupport.suggested ? "border-2 border-[#f5c9cd] bg-[#fdf3f4]" : "bg-white"}`}>
        <div className="flex items-start gap-3.5">
          <span className="grid place-items-center w-10 h-10 rounded-xl bg-lav-100 text-navy-700 shrink-0"><Icon name="heart" size={18} /></span>
          <div>
            <div className="font-bold text-ink">Professional support check-in</div>
            <p className="text-[0.85rem] text-ink-muted mt-1.5 leading-relaxed">{report.plan.professionalSupport.text}</p>
            {report.plan.professionalSupport.suggested && (
              <div className="mt-3 space-y-2">
                {report.plan.professionalSupport.resources.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white rounded-xl px-3.5 py-2.5 border border-[#f5c9cd] text-sm">
                    <Icon name="phone" size={15} className="text-danger shrink-0" />
                    <span className="text-ink">{r}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="text-[0.78rem] text-ink-faint text-center mt-8">{report.confidenceNote}</p>
      <div className="flex gap-3 justify-center mt-6 no-print">
        <Link href="/certificate" className="btn btn-primary"><Icon name="award" size={16} /> Claim your certificate</Link>
        <Link href="/companion" className="btn btn-ghost"><Icon name="sparkles" size={16} /> Ask Neuro about it</Link>
      </div>
    </main>
  );
}

function Section({ n, title, icon, sub, children }: { n: string; title: string; icon: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="card p-6 mt-4 animate-rise">
      <div className="flex items-center gap-3 mb-4">
        <span className="grid place-items-center w-10 h-10 rounded-2xl bg-navy-800 text-white font-display font-bold text-sm shrink-0">{n}</span>
        <div>
          <h2 className="font-display font-bold text-[1.35rem] text-navy-800 leading-none">{title}</h2>
          {sub && <p className="text-[0.76rem] text-ink-faint mt-1">{sub}</p>}
        </div>
        <span className="ml-auto text-lav-400 hidden sm:block"><Icon name={icon} size={20} /></span>
      </div>
      {children}
    </section>
  );
}

function MiniStat({ label, value, pct }: { label: string; value: string; pct: number }) {
  return (
    <div className="rounded-xl bg-lav-50 p-3.5">
      <div className="text-[0.65rem] font-bold uppercase tracking-wider text-ink-faint">{label}</div>
      <div className="font-bold text-navy-800 mt-0.5">{value}</div>
      <div className="h-1.5 bg-white rounded-full mt-2 overflow-hidden"><div className="h-full bg-lav-400" style={{ width: `${Math.max(6, Math.min(100, pct || 6))}%` }} /></div>
    </div>
  );
}

function DeltaCard({ label, delta, suffix, invert, lower }: { label: string; delta: number | null; suffix: string; invert?: boolean; lower?: boolean }) {
  const good = delta === null ? null : invert !== undefined && invert ? delta <= 0 : lower || delta >= 0;
  return (
    <div className="rounded-2xl border border-lav-100 p-4 text-center">
      <div className="text-[0.65rem] font-bold uppercase tracking-wider text-ink-faint">{label}</div>
      <div className={`font-display font-bold text-2xl mt-1 ${good === null ? "text-ink-faint" : good ? "text-teal-700" : "text-warn"}`}>
        {delta === null ? "n/a" : `${delta >= 0 ? "+" : ""}${delta}${suffix}`}
      </div>
      <div className="text-[0.66rem] text-ink-faint mt-1">{delta === null ? "not enough matched data" : good ? "a small honest shift" : "worth noticing kindly"}</div>
    </div>
  );
}

function SummaryBox({ tone, title, items }: { tone: "teal" | "gold" | "lav"; title: string; items: string[] }) {
  const bg = tone === "teal" ? "bg-teal-100/40 border-teal-100" : tone === "gold" ? "bg-gold-100 border-gold-300" : "bg-lav-100/50 border-lav-100";
  return (
    <div className={`rounded-2xl border p-4 ${bg}`}>
      <div className="text-[0.7rem] font-bold uppercase tracking-wider text-ink-faint mb-2">{title}</div>
      {items.length === 0 ? <p className="text-[0.8rem] text-ink-faint italic">nothing to report — data too light</p> : (
        <ul className="space-y-1.5">{items.map((it, i) => <li key={i} className="text-[0.83rem] text-ink-muted leading-relaxed">{items.length > 1 ? "· " : ""}{it}</li>)}</ul>
      )}
    </div>
  );
}
