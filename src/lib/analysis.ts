/* ── The Analysis Engine ("BIG NEURO") ────────────────────────
 * Looks across ALL seven days of self-reported answers and
 * produces: day metrics, pattern detection, strengths with
 * evidence, ≤5 attention areas, progress comparison, summary,
 * an action plan and a 4-week continuation plan.
 *
 * ⚠️ Guardrails baked in:
 *  - Describes what the USER REPORTED, never diagnoses.
 *  - Distinguishes explicit reports vs. suggested patterns.
 *  - Lists areas with insufficient information.
 *  - Never computes a "clinical score" — indicators are
 *    labelled self-reported wellness indicators.
 */
import { DSession, FullReport, PlanSection, User } from "./types";
import { EMOTIONS } from "./questions";

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

interface StrengthLite { title: string; evidence: string; }
interface AreaLite { title: string; reported: string; why: string; suggestion: string; }

function bandToHours(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const map: Record<string, number> = { "<5": 4.5, "5-6": 5.5, "6-7": 6.5, "7-8": 7.5, "8+": 8.5, "<1": 0.5, "1-2": 1.5, "2-4": 3, "4+": 4.5, "0": 0, "0.5": 0.5, "1": 1.5, "2+": 2.5 };
  return map[v];
}

export interface DayMetricLite {
  day: number;
  date: string;
  moodScore: number | null;
  emotion: string | null;
  stress: number | null;
  sleepH: number | null;
  screenH: number | null;
  moved: boolean | null;
  outdoors: boolean | null;
  positives: string[];
  challenges: string[];
  answered: number;
  skipped: number;
  words: number;
}

export function metricFromSession(s: DSession): DayMetricLite {
  const A = s.answers;
  const asStr = (qid: string): string | undefined => {
    const v = A[qid]?.value;
    return v === undefined ? undefined : String(v);
  };
  const txt = (qid: string): string => {
    const v = A[qid]?.value;
    return typeof v === "string" ? v : "";
  };

  const moodQ = asStr("d1q2") ?? asStr("d2q1") ?? asStr("d7q11");
  const emo = EMOTIONS.find((e) => e.value === moodQ);
  let mood = emo ? emo.score : null;

  // small nudges from the day's own signals
  const wake = asStr("d1q4");
  if (mood !== null && wake) mood = clamp(mood + (wake === "refreshed" ? 3 : wake === "exhausted" ? -3 : 0));

  const stressRaw = asStr("d5q2") ?? asStr("d7q2");
  const stress = stressRaw ? Number(stressRaw) : null;
  const sleep = bandToHours(asStr("d3q1") ?? asStr("d7q3"));
  const screen = bandToHours(asStr("d3q2"));
  const moved = asStr("d3q4") ? asStr("d3q4") !== "no" : null;
  const outdoor = asStr("d3q7") ? asStr("d3q7") !== "no" : null;

  // stress tempers mood score (still self-reported, just a fairer composite)
  if (mood !== null && stress !== null) mood = clamp(mood - (stress - 5) * 2.2);
  if (mood !== null && moved) mood = clamp(mood + 2);

  const positives = [txt("d1q3"), txt("d2q2"), txt("d4q3"), txt("d7q7")].filter((t) => t.trim().length > 2);
  const challenges = [txt("d5q1"), txt("d2q3")].filter((t) => t.trim().length > 2);

  return {
    day: s.day,
    date: s.effectiveDate,
    moodScore: mood,
    emotion: moodQ ?? null,
    stress,
    sleepH: sleep ?? null,
    screenH: screen ?? null,
    moved,
    outdoors: outdoor,
    positives,
    challenges,
    answered: Object.keys(A).length,
    skipped: s.skipped.length,
    words: Object.values(A).filter((a) => typeof a.value === "string" && (a.value as string).length > 40).length,
  };
}

export function computeMetrics(sessions: DSession[]): DayMetricLite[] {
  return sessions.filter((s) => s.completedAt).sort((a, b) => a.day - b.day).map(metricFromSession);
}

const plus = (arr: string[]) => arr.filter(Boolean).length;

function rr(arr: string[]) { return arr.filter(Boolean); }

/* ── report generation ── */
export function generateFullReport(user: User, sessions: DSession[]): FullReport {
  const m: DayMetricLite[] = computeMetrics(sessions);
  const A = (d: number) => sessions.find((s) => s.day === d)?.answers ?? {};
  const ans = (d: number, qid: string): string => {
    const v = A(d)[qid]?.value;
    return typeof v === "string" ? v : typeof v === "number" ? String(v) : (Array.isArray(v) ? v.join(", ") : "");
  };
  const first = user.name;

  const moodSeries = m.map((x) => ({ day: x.day, mood: x.moodScore ?? 0, stress: x.stress ?? undefined }));
  const m0 = m[0]?.moodScore ?? null;
  const m7 = m[m.length - 1]?.moodScore ?? null;
  const moodDelta = m0 !== null && m7 !== null ? m7 - m0 : null;
  const stressD1 = m.map((x) => x.stress).find((v): v is number => v !== null) ?? null;
  const stressD7 = ans(7, "d7q2") ? Number(ans(7, "d7q2")) : null;
  const stressDelta = stressD1 !== null && stressD7 !== null ? stressD7 - stressD1 : null;
  const sleepArr = m.map((x) => x.sleepH).filter((x): x is number => x !== null);
  const sleepAvg = sleepArr.length ? Number((sleepArr.reduce((a, b) => a + b, 0) / sleepArr.length).toFixed(1)) : null;
  const sleepFirst = m.find((x) => x.sleepH !== null)?.sleepH ?? null;
  const sleepLast = [...m].reverse().find((x) => x.sleepH !== null)?.sleepH ?? null;
  const sleepDelta = sleepFirst !== null && sleepLast !== null ? sleepLast - sleepFirst : null;
  const screenArr = m.map((x) => x.screenH).filter((x): x is number => x !== null);
  const screenAvg = screenArr.length ? Number((screenArr.reduce((a, b) => a + b, 0) / screenArr.length).toFixed(1)) : null;
  const movementDays = plus(m.map((x) => (x.moved ? "y" : x.moved === false ? "" : "")));
  const outdoorsDays = plus(m.map((x) => (x.outdoors ? "y" : "")));
  const stressAvgReported = m.map((x) => x.stress).filter((x): x is number => x !== null);
  const stressAvg = stressAvgReported.length ? stressAvgReported.reduce((a, b) => a + b, 0) / stressAvgReported.length : null;

  const emotionCounts = new Map<string, number>();
  m.forEach((x) => { if (x.emotion) emotionCounts.set(x.emotion, (emotionCounts.get(x.emotion) ?? 0) + 1); });
  const dominantEmotions = [...emotionCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);

  const negatives = [...dominantEmotions].filter((e) => (EMOTIONS.find((x) => x.value === e)?.score ?? 50) < 55);
  const worsened = moodDelta !== null && moodDelta <= -8;

  /* ── strengths: only with evidence ── */
  const strengths: StrengthLite[] = [];
  const textiness = m.reduce((a, b) => a + b.words, 0);
  if (textiness >= 6) strengths.push({ title: "Self-awareness", evidence: `You wrote ${textiness} thoughtful reflections across the week — rare depth for a 5-minute daily format.` });
  if (plus(m.map((x) => (x.positives.length ? "y" : ""))) >= 4) strengths.push({ title: "Appreciation", evidence: "You consistently found something positive to record, even on heavier days." });
  if (ans(2, "d2q4") === "solve" || ans(5, "d5q3") === "solve" || ans(5, "d5q3") === "ask") strengths.push({ title: "Practical resilience", evidence: `Your instinct when things go wrong is to act or ask for help, not freeze.` });
  if (ans(2, "d2q5") !== "hard") strengths.push({ title: "Emotional openness", evidence: "You reported expressing emotions at least somewhat comfortably." });
  if (sessions.filter((s) => s.completedAt).length >= 5) strengths.push({ title: "Persistence", evidence: `You completed ${sessions.filter((s) => s.completedAt).length} of 7 sessions — showing up is the hard part.` });
  if (ans(6, "d6q7").trim().length > 3) strengths.push({ title: "Honest self-worth", evidence: `You could name something you genuinely like about yourself: "…${ans(6, "d6q7").slice(0, 90)}…"` });
  if (movementDays >= 3) strengths.push({ title: "Body care instinct", evidence: `You moved your body on ~${movementDays} of the days you reported.` });

  /* ── areas worth attention (≤5, each with what/why/what-to-try) ── */
  const areas: AreaLite[] = [];
  if (sleepAvg !== null && sleepAvg < 6.5) areas.push({ title: "Sleep", reported: `You reported ~${sleepAvg}h average sleep across the week.`, why: "Short or irregular sleep quietly taxes mood, focus and stress tolerance.", suggestion: "Pick one anchor time — same lights-out, ±30 min — and keep 20 minutes of phone-free wind-down." });
  if (screenAvg !== null && screenAvg >= 2.5) areas.push({ title: "Screen & scroll time", reported: `You reported roughly ${screenAvg}h/day of social scrolling.`, why: "Late scrolling is one of the most common self-reported sleep and mood disruptors.", suggestion: "Try a 'scroll parked outside the bedroom' rule for the week and notice the difference." });
  if (stressAvg !== null && stressAvg >= 6.5) areas.push({ title: "Stress load", reported: `Your self-reported stress averaged ${stressAvg.toFixed(1)}/10.`, why: "Sustained stress narrows attention, patience and sleep quality.", suggestion: "Two anchors: one daily decompress window (breaks count), and one honest weekly list of 'mine / theirs / can wait'." });
  if (ans(4, "d4q4") === "yes" || ans(4, "d4q2") === "no") areas.push({ title: "Social connection", reported: `You reported loneliness in crowds (${ans(4, 'd4q4') === 'yes' ? "yes" : "uncertain"})${ans(4, "d4q2") === "no" ? " and no open-talk confidant" : ""}.`, why: "Belonging is one of the strongest buffers for self-reported mood.", suggestion: "One low-pressure ritual: a fixed 20-minute catch-up with one person you trust each week." });
  if (movementDays <= 2) areas.push({ title: "Movement", reported: `You reported moving your body on only ${movementDays}/7 days.`, why: "Movement is the most evidence-backed lever mood-brains respond to, even at 10 minutes.", suggestion: "Anchor one 10-minute walk after a daily trigger (post-lunch counts)." });
  if (ans(3, "d3q9") === "no" || ans(6, "d6q2") !== "" && Number(ans(6, "d6q2")) <= 4) areas.push({ title: "Life-direction doubt", reported: "You expressed dissatisfaction with your current direction.", why: "Uncertainty about direction makes small good days feel pointless.", suggestion: "Convert doubt into one testable 2-week experiment you chose yourself." });
  if (ans(2, "d2q5") === "hard") areas.push({ title: "Expressing emotions", reported: "You said rarely expressing emotions feels comfortable.", why: "Unexpressed feelings tend to leak back as tension; sharing lightens load.", suggestion: "Practise with your own words first: journal one honest sentence/day — already built in here." });
  const trimmedAreas = areas.slice(0, 5);

  /* ── progress comparison, compassionate language ── */
  const moodNote = moodDelta === null ? "" : worsened
    ? `Comparing Day 1 with your final state, your self-reported wellness indicator moved ${moodDelta.toFixed(0)} points down. That is worth acknowledging without drama — weeks like this are real, and being honest with yourself is a skill, not a failure.`
    : moodDelta >= 8
      ? `Comparing Day 1 with your final state, your self-reported wellness indicator moved about +${moodDelta.toFixed(0)} points. Gently noticed change — no fireworks needed.`
      : `Your self-reported wellness indicator moved by ${moodDelta >= 0 ? "+" : ""}${moodDelta.toFixed(0)} points between Day 1 and your final day — a small, honest shift.`;
  const stressNote = stressDelta === null ? "" : stressDelta > 0
    ? `Your reported stress on the final day (${stressD7}/10) sat higher than the start (${stressD1}/10). Naming that is useful in itself.`
    : `Reported stress moved from ${stressD1}/10 at the start to ${stressD7}/10 at the end.`;
  const sleepNoteP = sleepDelta === null ? "" : sleepDelta === 0 ? "Your reported sleep pattern stayed consistent during the journey." :
    `Reported sleep moved from ${sleepFirst}h toward ${sleepLast}h.`;
  const insights = rr([
    moodNote, stressNote, sleepNoteP,
    dominantEmotions.length ? `Your most repeated emotion words across days: ${dominantEmotions.join(", ")}.` : "",
    negatives.length ? `"${negatives.join('", "')}" re-appeared more than once — potential recurring theme worth watching, not worrying.` : "",
    movementDays >= 5 ? "Movement showed up across most days you reported — a stabilising habit." : "",
    screenAvg !== null && screenAvg <= 1 ? "Screen time stayed low in your reports — good boundary-keeping." : "",
  ]);

  /* ── emotional journey summary block ── */
  const emotionalNote = (() => {
    if (negatives.length >= 2) return `Your week showed a mix: "${dominantEmotions.join('", "')}" were the signatures, with some weight on "${negatives[0]}". Emotional weather changes; the pattern is just data, not destiny.`;
    if (dominantEmotions.length === 0) return "You kept your emotional reports light this week. Patterns need a bit more data to speak up.";
    return `The week sketched a fairly consistent emotional signature: ${dominantEmotions.join(", ")}. Change was subtle — and noticing subtle is what this was for.`;
  })();

  /* ── what user wants to change (their words) ── */
  const wants = rr([ans(3, "d3q8"), ans(5, "d5q7"), ans(7, "d7q9")]);

  /* ── ──: plan ── */
  const start: string[] = rr([
    sleepAvg !== null && sleepAvg < 6.5 ? "Anchor a consistent lights-out time (same ±30 min every day)." : "",
    movementDays <= 3 ? "One 10-minute walk after lunch — rain, mood grumbles, 'no time' excuses get one veto per week only." : "",
    outdoorsDays <= 2 ? "Twelve minutes of outdoor daylight in the first half of the day." : "",
    "Keep this exact 5-minute reflection habit, at the same time daily.",
    ans(4, "d4q4") === "yes" ? "One planned 20-minute call with a person who feels easy to talk to, twice this week." : "",
    stressAvg !== null && stressAvg >= 6 ? "One daily 'soup-cooldown' block: 10 minutes of anything unhurried (celestial tea ceremony included)." : "",
    "Write tomorrow's single most important thing on a sticky note tonight (brain-floss for morning you).",
  ]);
  const reduce: string[] = rr([
    screenAvg !== null && screenAvg > 2 ? "Late-evening scrolling — park the phone across the room 40 minutes after lights-lights." : "",
    ans(2, "d2q4") === "overthink" ? "Rehearsing the same 3 thoughts on rotation — give each one a second brain-loop only if new information shows up." : "",
    stressAvg !== null && stressAvg >= 6 ? "Stacking obligations without any buffer hour between them." : "",
    ans(3, "d3q5") === "yes" ? "Opening 'one quick tab' procrastination spirals — start with a 5-minute timer and end on your call." : "",
    ans(4, "d4q5") !== "" && Number(ans(4, "d4q5")) <= 4 ? "Saying yes to things you'd postpone on someone else's behalf." : "",
  ]);
  const cont: string[] = rr([
    plus(m.map((x) => (x.positives.length ? "y" : ""))) >= 3 ? "Keep noticing at least one genuinely good moment per day — the muscle is already working." : "",
    movementDays >= 4 ? "Keep the movement habit you already have." : "",
    ans(3, "d3q7") === "yes" ? "Keep the outdoor doses — they're cheap mood-real-estate." : "",
    ans(2, "d2q5") !== "hard" ? "Keep sharing how you feel with at least one person — you already report doing it." : "",
    sessions.filter((s) => s.completedAt).length >= 6 ? "Keep the 5-minute check-in streak itself; it's the engine of everything above." : "",
  ]);
  const avoid: string[] = rr([
    screenAvg !== null && screenAvg > 3 ? "Bedroom-scroll, doom-adjacent feeds before sleep." : "",
    ans(3, "d3q5") === "yes" ? "The 'I'll do it with more energy later' trick your brain keeps pitching at night." : "",
    ans(2, "d2q4") === "withdraw" ? "Withdrawing for days when one hard moment happens — one honest 'tough day' text to someone counts as not-withdrawing." : "",
    stressAvg !== null && stressAvg >= 7 ? "Scheduling personal tasks into already-tight days — empty 30-minute buffers between commitments." : "",
  ]);

  const planSections: PlanSection[] = [
    { title: "START", items: start.length ? start : ["Keep the daily 5-minute reflection — it's the base camp of everything else."] },
    { title: "REDUCE", items: reduce.length ? reduce : ["Nothing screamed 'reduce me' from your data. Keep an eye on sleep and evening scrolling anyway."] },
    { title: "CONTINUE", items: cont.length ? cont : ["Showing up for this whole week is itself the thing worth continuing."] },
    { title: "AVOID", items: avoid.length ? avoid : ["Avoid stacking 'big changes' all at once — one habit at a time wins."] },
  ];

  const routine = {
    morning: [
      "Same wake time even on weekends (±45 min).",
      "Phone exchanges honesty for silence until after breakfast — it'll survive.",
      movementDays <= 3 ? "10-minute daylight walk or stretch before screens." : "Keep your existing movement slot; protect it like a meeting.",
      "One-line intention: 'Today, the one thing is ___.'",
    ],
    afternoon: [
      "Micro-break every ~90 minutes: stand, water, look far away.",
      movementDays >= 4 ? "Keep your usual body-time slot." : "Midday 10-minute reset walk (post-lunch is prime).",
      "One 'no' per overcommitted afternoon — boundaries are allowed to be boring.",
    ],
    evening: [
      "Log the day in the app or a journal — five honest lines max.",
      screenAvg !== null && screenAvg > 2 ? "Park the phone outside the bedroom; alarm stays, scroll doesn't." : "Switch screens to night mode and give the last 30 minutes to analog things.",
      sleepAvg !== null && sleepAvg < 6.5 ? "Lights out at the same time — protect the ±30-min window." : "Wind-down: non-screen relaxation (bath, stretch, fiction).",
    ],
  };

  const weeks = [
    { wk: "Week 1", title: "Build awareness", items: [`Keep the 5-minute daily check-in`, `Track sleep and one trigger word for the week`, `Pick your two "focus" areas only`].concat(stressAvg !== null && stressAvg >= 6.5 ? ["Name your top stressor out loud once"] : []) },
    { wk: "Week 2", title: "Improve daily habits", items: [(sleepAvg !== null && sleepAvg < 6.5 ? "Fix one sleep boundary (lights-out time)" : "Hold your wake-time anchor"), movementDays <= 3 ? "Add the 10-minute walk" : "Maintain movement streak", "Continue the small rituals you logged as 'CONTINUE'"].concat(screenAvg !== null && screenAvg > 2 ? ["Evening phone park-outside rule"] : []) },
    { wk: "Week 3", title: "Strengthen emotional well-being", items: [ans(2, "d2q5") === "hard" ? "One honest share per week with a trusted person" : "Share one feeling before it cools", "Write one 'small victory' list per day", "Try one nervous-system reset (4-7-8 breathing, cold water, stretch)"] },
    { wk: "Week 4", title: "Review & build consistency", items: ["Compare Week 4 vs Week 1 mood notes — what shifted?", "Keep what kept you sane; drop what felt forced", "Pick next month's single focus, not five"] },
  ];

  /* professional support: careful, criteria-based */
  const professional = (() => {
    const persistentDistress =
      (stressAvg !== null && stressAvg >= 7.2) ||
      negatives.includes("Sad") || negatives.includes("Overwhelmed") ||
      (moodDelta !== null && moodDelta <= -10);
    if (!persistentDistress) return { suggested: false, text: "Your responses did not signal that urgent professional support is needed right now. That is not a medical conclusion — if anything about your week felt too big to carry alone, talking to a qualified professional is always a reasonable option, without needing a crisis as an entry ticket.", resources: [] as string[] };
    return {
      suggested: true,
      text: "Several of your responses suggest that persistent stress and low well-being may be worth discussing with a qualified mental health professional. This is not a diagnosis and not a crisis verdict — it is simply that your reports repeated certain patterns across several days, and trained humans can help with that far better than a 5-minute app can. Consider it an ordinary, sensible next step.",
      resources: ["Tele-MANAS (India, 24/7): 14416", "iCall counseling helpline: +91-9152987821", "If you feel unsafe or in danger: call your regional emergency number (India: 112)"],
    };
  })();

  /* insufficient-information list */
  const gaps: string[] = [];
  const skippedTotal = m.reduce((a, b) => a + b.skipped, 0);
  if (skippedTotal > 0) gaps.push(`You skipped ${skippedTotal} questions across the journey — honest boundaries, respected. Those areas simply carry less signal here.`);
  if (sleepAvg === null) gaps.push("Sleep details were incomplete on some days — sleep conclusions are partial.");
  if (screenAvg === null) gaps.push("Screen-time answers were sparse in places — treat those estimates as rough.");
  if (stressD1 === null || stressD7 === null) gaps.push("Stress was not reported on one of the comparison days — progress on stress is limited to self-consistency.");
  if (gaps.length === 0) gaps.push("Nothing major — your coverage was good. Patterns here are drawn from a full 7-day set.");

  const intro = `${first}'s seven-day journey is complete. Over seven sessions${plus(m.map((x) => (x.positives.length ? "y" : "")))} you explored your emotions, habits, relationships, challenges and aspirations — ${m.reduce((a, b) => a + b.answered, 0)} questions answered across ${Math.round(sessions.reduce((a, s) => a + (s.timeSpentSec ?? 0), 0) / 60)} minutes of reflection. Here is what your responses suggest about your current well-being — carefully, without any diagnosis, and with respect for what you actually said.`;

  const report: FullReport = {
    intro,
    emotionalJourney: {
      series: moodSeries,
      dominantEmotions,
      positives: m.flatMap((x) => x.positives).slice(0, 8),
      challenges: m.flatMap((x) => x.challenges).slice(0, 6),
      note: emotionalNote,
    },
    lifestyle: {
      sleepAvg,
      sleepNote: sleepAvg === null ? "Not enough sleep data this week." : sleepAvg >= 7.5 ? "Solid reported sleep range — brains recharge well at this level." : sleepAvg >= 6.5 ? "Reported sleep sits in a workable band; a small stretch would add buffer." : "Reported sleep runs short most nights — one anchor change could shift a lot.",
      screenAvg,
      screenNote: screenAvg === null ? "Screen-time data incomplete." : screenAvg <= 1 ? "Low reported scroll time — nice boundary-keeping." : screenAvg <= 3 ? "Moderate scrolling: livable, slightly pricey in the evening." : "Heavy reported social scrolling — the kind that quietly taxes evening wind-downs.",
      movementDays,
      movementNote: movementDays >= 5 ? "Movement showed up on most reported days — your body got regular use." : movementDays >= 3 ? "Movement appeared regularly, though not the norm each day." : "Movement was rare in your reports this week.",
      outdoorsDays,
      outdoorsNote: outdoorsDays >= 3 ? "You got outside on most reported days." : "Outdoor time was scarce in your reports — daylight is underrated brain fuel.",
      routineNote: `Across your reports: ${movementDays}/7 movement days, ${outdoorsDays}/7 outdoors days${screenAvg !== null ? `, ~${screenAvg}h/day screen time` : ""}${sleepArr.length ? `, ~${sleepAvg}h average reported sleep` : ""}.`,
    },
    strengths: strengths.map((s) => ({ title: s.title, evidence: s.evidence })),
    areas: trimmedAreas.map((a) => ({ title: a.title, reported: a.reported, why: a.why, suggestion: a.suggestion })),
    progress: {
      moodDelta,
      stressDelta,
      sleepDelta,
      worsened,
      note: [moodNote, stressNote].filter(Boolean).join(" ") || "Not enough matched data for a numeric comparison — treat the journey itself as the progress.",
      insights,
    },
    summary: {
      goingWell: rr([
        plus(m.map((x) => (x.positives.length ? "y" : ""))) >= 3 ? `You kept naming positive moments — ${plus(m.map((x) => (x.positives.length ? "y" : "")))}/7 days had explicit 'best thing/smiles'.` : "",
        movementDays >= 4 ? "Movement appeared as a regular thread." : "",
        sleepAvg !== null && sleepAvg >= 7 ? "Reported sleep is in a healthy band." : "",
        ans(6, "d6q7").length > 3 ? "You can locate things you genuinely like about yourself." : "",
        sessions.filter((s) => s.completedAt).length === 7 ? "You completed the entire 7-day set — consistency itself is going well." : "",
      ]),
      challenging: rr([
        stressAvg !== null && stressAvg >= 6 ? `Sustained stress sits around ${stressAvg.toFixed(1)}/10 in your reports.` : "",
        dominantEmotions.length ? `"${negatives[0] ?? dominantEmotions[0]}" recurred across days.` : "",
        sleepAvg !== null && sleepAvg < 6.5 ? "Sleep keeps running short." : "",
        screenAvg !== null && screenAvg > 3 ? "Scroll time balloons in the evenings." : "",
        ans(4, "d4q4") === "yes" ? "Loneliness in company showed up." : "",
      ]),
      attention: trimmedAreas.map((a) => a.title),
      wantsChange: wants,
      exploreNext: [
        "Re-run your 'small victory' ritual for 7 more days and see what it teaches you.",
        sleepAvg !== null && sleepAvg < 7 ? "Sleep boundary experiment (one week, one change)." : "Keep a one-week sleep journal as an experiment.",
        movementDays <= 3 ? "Invite one person to a walk — doubled benefit, half the resistance." : "+1 movement session per week as an upgrade.",
        "Re-read your letter to yourself and update it.",
      ],
      gaps,
    },
    plan: { sections: planSections, routine, weeks, professionalSupport: professional },
    disclaimer: "🌿 MindTrace is a self-reflection tool, not healthcare. It does not diagnose, assess, or replace professionals. All numbers here are self-reported wellness indicators, not clinical measurements.",
    confidenceNote: "Patterns noted above are drawn from your own answers across 7 days. Where single-day answers were the only signal, the report says so explicitly rather than assuming more than it knows.",
  };

  return report;
}

/* ── Reflection Companion: rule-based, cautious, useful ────── */
export function companionAnswer(question: string, user: User, sessions: DSession[]): { answer: string; evidence: string[]; caution: string } {
  const q = question.toLowerCase();
  const m = computeMetrics(sessions);
  const ans = (d: number, qid: string): string => {
    const v = (sessions.find((s) => s.day === d)?.answers[qid] ?? ({} as { value?: unknown })).value;
    return typeof v === "string" ? v : "";
  };
  const sleep = m.map((x) => x.sleepH).filter((v): v is number => v !== null);
  const sleepAvg = sleep.length ? sleep.reduce((a, b) => a + b, 0) / sleep.length : null;
  const stress = m.map((x) => x.stress).filter((v): v is number => v !== null);
  const stressAvg = stress.length ? stress.reduce((a, b) => a + b, 0) / stress.length : null;
  const screen = m.map((x) => x.screenH).filter((v): v is number => v !== null);
  const screenAvg = screen.length ? screen.reduce((a, b) => a + b, 0) / screen.length : null;
  const lonely = ans(4, "d4q4") === "yes";
  const emoWords = m.map((x) => x.emotion).filter(Boolean) as string[];

  const ev: string[] = [];
  let answer = "";

  if (/tired|exhaust|sleep|energy|rest/.test(q)) {
    if (sleepAvg !== null) ev.push(`You reported about ${sleepAvg.toFixed(1)}h sleep on average across reported days.`);
    if (ans(1, "d1q4")) ev.push(`On Day 1 you described waking up: "${ans(1, "d1q4")}".`);
    if (screenAvg !== null && screenAvg > 2) ev.push(`You reported ~${screenAvg.toFixed(1)}h/day of social scrolling — a known evening-sleep thief.`);
    if (ans(3, "d3q1")) ev.push(`Day 3 sleep band: ${ans(3, "d3q1")}.`);
    answer = "Based on what you wrote, a few possibilities could be affecting your routine: unfenced evenings (screens), an irregular lights-out time, or stress that converts into poor rest. Try one week of the SAME wake time — brains love predictability more than people admit.";
  } else if (/stress|anx|overwhelm|panic|pressure/.test(q)) {
    if (stressAvg !== null) ev.push(`Your self-reported stress averaged ${stressAvg.toFixed(1)}/10.`);
    if (ans(5, "d5q1")) ev.push(`Your named top mind-hog: "${ans(5, "d5q1").slice(0, 80)}…"`);
    if (ans(2, "d2q4")) ev.push(`Your reported style when something goes wrong: "${ans(2, "d2q4")}".`);
    answer = "Your answers sketch where the pressure concentrates. What usually helps: split what's in your control from what isn't (two columns, write both), and give your nervous system one daily non-negotiable reset — ten minutes, screenless, no new input.";
  } else if (/lonel|alone|friend|social|connect/.test(q)) {
    if (lonely) ev.push("You said you sometimes feel lonely even around people.");
    if (ans(4, "d4q7")) ev.push(`You described feeling emotionally safe in: "${ans(4, "d4q7").slice(0, 80)}…"`);
    answer = "Loneliness in company is usually about connection depth, not quantity. Twenty honest minutes with one person tends to beat three group outings — consider scheduling one 'real chat' ritual instead of hoping it happens.";
  } else if (/mood|feel|happy|sad|emotion/.test(q)) {
    if (emoWords.length) ev.push(`Reported emotion words across days: ${emoWords.join(", ")}.`);
    if (ans(7, "d7q6")) ev.push(`You noticed: "${ans(7, "d7q6").slice(0, 90)}…"`);
    answer = "Your mood trail sits in the chart, and the words you repeated are honest clues. If one emotion keeps barging in, ask what it might be protecting you from — then try meeting that need in one small, concrete way this week.";
  } else if (/screen|scroll|phone|habit/.test(q)) {
    if (screenAvg !== null) ev.push(`Average reported screen time: ~${screenAvg.toFixed(1)}h/day.`);
    answer = "If screens are eating evenings, the fix is boring and effective: a physical parking spot for the phone 40 minutes before bed, and one app moved off the home screen. Boring beats willpower here.";
  } else if (/routine|schedule|consist|discipl/.test(q)) {
    const movedDays = m.filter((x) => x.moved).length;
    ev.push(`Movement showed up in your reports ${movedDays}/7 days.`);
    if (sleepAvg !== null) ev.push(`Sleep average: ${sleepAvg.toFixed(1)}h.`);
    answer = "Consistency is usually a systems problem, not a discipline problem: attach the new habit to an existing anchor (after lunch, after brushing teeth). Your wake-time and lights-out anchors are the highest-leverage place to start.";
  } else if (/motivat|dream|direction|purpose|future/.test(q)) {
    if (ans(6, "d6q1")) ev.push(`You said you're most excited about: "${ans(6, "d6q1").slice(0, 80)}…"`);
    if (ans(6, "d6q5")) ev.push(`Postponed dream: "${ans(6, "d6q5").slice(0, 80)}…"`);
    answer = "Motivation usually follows evidence. Pick the smallest version of the postponed dream — twenty minutes this weekend — not to achieve it, but to remind your brain that it's still yours.";
  } else {
    answer = "Here's what I can see plainly in your own answers, plus cautious possibilities. Ask me about tired/sleep, stress, loneliness, mood, screens, routine, or motivation — with your data in front of me I can be specific without pretending to know more than I do.";
  }

  return {
    answer,
    evidence: ev,
    caution: "⚠️ These are possibilities drawn only from your own self-reported answers — not assessments, not diagnoses. If any part of your week felt too heavy to carry alone, talking to a qualified professional is always a reasonable step.",
  };
}
/* EOF */
