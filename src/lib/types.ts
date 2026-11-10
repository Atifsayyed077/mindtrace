/* ── MindTrace domain types ─────────────────────────────────── */

export type AgeRange = "Under 18" | "18–25" | "26–35" | "36–45" | "46–55" | "56+";

export interface Consent {
  accepted: boolean;
  at: string; // ISO
  understoodNotMedical: boolean;
  understoodStorageLocal: boolean;
}

export interface UserProfile {
  ageRange: AgeRange | "";
  language: string;
  typicalDay: string;
  occupation: string;
  sleepSchedule: string;
  exercise: string;
  socialLife: string;
  stressed: "Yes" | "Not really" | "";
  motivation: string;
  previousSupport: "Yes" | "No" | "Prefer not to say" | "";
  concerns: string;
  accessibility: string;
  reminderTime: string; // "20:00"
}

export interface User {
  id: string;
  name: string;
  createdAt: string;
  consent: Consent;
  profile: UserProfile;
  councilLegend: boolean;
}

/* ── Questions ── */
export type QType =
  | "emotion"        // animated emotion grid (single pick)
  | "choice"         // single choice pills
  | "scale"          // 1–10 slider
  | "text"           // short paragraph
  | "time"           // hours-band choice
  | "multi";         // multi-select chips

export interface Question {
  id: string;
  day: number;
  type: QType;
  text: string;
  hint?: string;
  options?: { value: string; label: string; emoji?: string; score?: number }[];
  optional?: boolean;
  fun?: boolean;       // the unexpected one 🎲
  tags?: string[];     // evidence tags used by the analysis engine
  followedBy?: string; // conditional follow-up question id
}

export interface Answer {
  qid: string;
  value: string | number | string[];
  label?: string;       // display label for choices
  ts: string;
}

/* ── Sessions ── */
export type SessionStatus = "in-progress" | "complete";

export interface DSession {
  id: string;
  userId: string;
  day: number;                 // 1..7
  startedAt: string;
  completedAt?: string;
  timeSpentSec: number;
  effectiveDate: string;       // yyyy-mm-dd (local) used by calendar + streaks
  qids: string[];              // selected question order
  answers: Record<string, Answer>;
  skipped: string[];
}

export interface JournalEntry { id: string; date: string; day?: number; text: string; createdAt: string; }

export interface Letter { id: string; text: string; createdAt: string; revealHint?: boolean; }

export interface SafetyEvent { id: string; ts: string; day: number; qid?: string; wordCount: number; resourcesShown: string[]; }

export interface CertRecord {
  id: string;                // MT7-XXXX-XXXX
  userId: string;
  name: string;
  issuedAt: string;
  revoked?: boolean;
}

export interface ReportRecord {
  id: string;
  userId: string;
  generatedAt: string;
  report: FullReport;
}

/* ── Analysis / report ── */
export interface DayMetric {
  day: number;
  date: string;
  moodScore: number;      // 0–100 self-reported wellness indicator
  emotionLabel: string;   // primary emotion that day
  stress?: number;        // 1–10 (day5 (+day7 comparison))
  sleepH?: number;
  screenH?: number;
  moved?: boolean;
  outdoors?: boolean;
  positives: string[];
  challenges: string[];
}

export interface Strength { title: string; evidence: string; }
export interface AreaAttention {
  title: string;
  reported: string;
  why: string;
  suggestion: string;
}
export interface PlanSection { title: "START" | "REDUCE" | "CONTINUE" | "AVOID"; items: string[]; }

export interface FullReport {
  intro: string;
  emotionalJourney: {
    series: { day: number; mood: number; stress?: number }[];
    dominantEmotions: string[];
    positives: string[];
    challenges: string[];
    note: string;
  };
  lifestyle: {
    sleepAvg: number | null;
    sleepNote: string;
    screenAvg: number | null;
    screenNote: string;
    movementDays: number;
    movementNote: string;
    outdoorsDays: number;
    outdoorsNote: string;
    routineNote: string;
  };
  strengths: Strength[];
  areas: AreaAttention[];
  progress: {
    moodDelta: number | null;
    stressDelta: number | null;
    sleepDelta: number | null;
    worsened: boolean;
    note: string;
    insights: string[];
  };
  summary: {
    goingWell: string[];
    challenging: string[];
    attention: string[];
    wantsChange: string[];
    exploreNext: string[];
    gaps: string[];      // insufficient information areas
  };
  plan: { sections: PlanSection[]; routine: { morning: string[]; afternoon: string[]; evening: string[] }; weeks: { wk: string; title: string; items: string[] }[]; professionalSupport: { suggested: boolean; text: string; resources: string[] } };
  disclaimer: string;
  confidenceNote: string;
}

export interface Moment { day: number; date: string; mood: string; note: string; } // 30-day continuation

export interface HeroStat { label: string; value: string; }
