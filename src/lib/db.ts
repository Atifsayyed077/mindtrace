/* ── MindTrace local data layer ───────────────────────────────
 * Everything lives on THIS device (localStorage). No servers,
 * no accounts, no shadows in the cloud. Your brain stays home. 🧠
 * Keys are namespaced `mindtrace:` so the app is easy to audit.
 */
import { DSession, JournalEntry, Letter, User, CertRecord, ReportRecord, SafetyEvent, Moment } from "./types";

const K = {
  users: "mindtrace:users",
  current: "mindtrace:current",
  sessions: (uid: string) => `mindtrace:sessions:${uid}`,
  journal: (uid: string) => `mindtrace:journal:${uid}`,
  letter: (uid: string) => `mindtrace:letter:${uid}`,
  certs: "mindtrace:certs",
  reports: (uid: string) => `mindtrace:reports:${uid}`,
  safety: (uid: string) => `mindtrace:safety:${uid}`,
  moments: (uid: string) => `mindtrace:moments:${uid}`,
  admin: "mindtrace:admin-last-login",
};

const hasLS = typeof window !== "undefined" && typeof window.localStorage !== "undefined";

function read<T>(key: string, fallback: T): T {
  if (!hasLS) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write<T>(key: string, val: T) {
  if (!hasLS) return;
  window.localStorage.setItem(key, JSON.stringify(val));
}

export function rid(prefix = "id"): string {
  const rnd = Array.from(crypto.getRandomValues(new Uint8Array(6))).map((n) => (n % 16).toString(16)).join("");
  return `${prefix}_${Date.now().toString(36)}${rnd}`;
}

/* ── users ── */
export function listUsers(): User[] { return read<User[]>(K.users, []); }
export function saveUser(u: User) {
  const all = listUsers();
  const i = all.findIndex((x) => x.id === u.id);
  if (i >= 0) all[i] = u; else all.push(u);
  write(K.users, all);
}
export function getUser(uid: string): User | null { return listUsers().find((u) => u.id === uid) ?? null; }
export function deleteUser(uid: string) {
  write(K.users, listUsers().filter((u) => u.id !== uid));
  if (getCurrentUserId() === uid) clearCurrentUser();
  window.localStorage.removeItem(K.sessions(uid));
  window.localStorage.removeItem(K.journal(uid));
  window.localStorage.removeItem(K.letter(uid));
  window.localStorage.removeItem(K.reports(uid));
  window.localStorage.removeItem(K.safety(uid));
  window.localStorage.removeItem(K.moments(uid));
  write(K.certs, listCerts().filter((c) => c.userId !== uid));
}
export function exportUserData(uid: string) {
  const data = {
    exportedAt: new Date().toISOString(),
    user: getUser(uid),
    sessions: getSessions(uid),
    journal: listJournal(uid),
    letter: getLetter(uid),
    moments: listMoments(uid),
    reports: listReports(uid),
    certificates: listCerts().filter((c) => c.userId === uid),
    note: "Full account export — generated locally by MindTrace. ⚠️ Contains sensitive reflections; store carefully.",
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `mindtrace-export-${getUser(uid)?.name.toLowerCase().replace(/\s+/g, "-") ?? uid}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* ── current user ── */
export function getCurrentUserId(): string | null { return read<string | null>(K.current, null); }
export function setCurrentUserId(uid: string | null) { write(K.current, uid); }
export function clearCurrentUser() { if (hasLS) window.localStorage.removeItem(K.current); }

/* ── sessions ── */
export function getSessions(uid: string): DSession[] {
  return read<DSession[]>(K.sessions(uid), []);
}
export function saveSession(s: DSession) {
  const all = getSessions(s.userId);
  const i = all.findIndex((x) => x.day === s.day);
  if (i >= 0) all[i] = s; else all.push(s);
  all.sort((a, b) => a.day - b.day);
  write(K.sessions(s.userId), all);
}
export function getSession(uid: string, day: number): DSession | undefined {
  return getSessions(uid).find((s) => s.day === day);
}
export function completedDays(uid: string): number[] {
  return getSessions(uid).filter((s) => s.completedAt).map((s) => s.day);
}

/** Consecutive streak, counting back from latest effective date (missed days break it, gently). */
export function streak(uid: string): number {
  const days = getSessions(uid)
    .filter((s) => s.completedAt)
    .map((s) => s.effectiveDate)
    .sort();
  if (days.length === 0) return 0;
  const today = todayStr();
  let streak = 0;
  let cursor = parseLocalDate(days[days.length - 1]);
  if (cursor.toDateString() !== new Date().toDateString()) {
    // grace: yesterday counts as "still on it"
    const yest = new Date(); yest.setDate(yest.getDate() - 1);
    if (days[days.length - 1] !== fmtDate(yest)) return 0;
  }
  const set = new Set(days);
  while (set.has(fmtDate(cursor))) {
    streak++;
    cursor = new Date(cursor.getTime() - 86400000);
  }
  void today;
  return streak;
}

/* ── journal / letter ── */
export function listJournal(uid: string) { return read<JournalEntry[]>(K.journal(uid), []); }
export function saveJournalEntry(uid: string, e: JournalEntry) {
  const all = listJournal(uid).filter((x) => x.id !== e.id);
  all.push(e);
  write(K.journal(uid), all);
}
export function deleteJournalEntry(uid: string, id: string) {
  write(K.journal(uid), listJournal(uid).filter((x) => x.id !== id));
}
export function getLetter(uid: string): Letter | null { return read<Letter | null>(K.letter(uid), null); }
export function saveLetter(uid: string, l: Letter) { write(K.letter(uid), l); }

/* ── certificates ── */
export function listCerts(): CertRecord[] { return read<CertRecord[]>(K.certs, []); }
export function saveCert(c: CertRecord) {
  write(K.certs, [...listCerts().filter((x) => x.id !== c.id), c]);
}
export function findCert(id: string): CertRecord | null {
  const q = id.trim().toUpperCase();
  return listCerts().find((c) => c.id.toUpperCase() === q) ?? null;
}
export function revokeCert(id: string) {
  write(K.certs, listCerts().map((c) => (c.id === id ? { ...c, revoked: true } : c)));
}

/* ── reports ── */
export function listReports(uid: string) { return read<ReportRecord[]>(K.reports(uid), []); }
export function latestReport(uid: string): ReportRecord | null {
  const r = listReports(uid);
  return r.length ? r[r.length - 1] : null;
}
export function saveReport(r: ReportRecord) { write(K.reports(r.userId), [...listReports(r.userId), r]); }

/* ── safety events ── */
export function listSafety(uid: string) { return read<SafetyEvent[]>(K.safety(uid), []); }
export function saveSafety(uid: string, e: SafetyEvent) { write(K.safety(uid), [...listSafety(uid), e]); }

/* ── 30-day continuation moments ── */
export function listMoments(uid: string) { return read<Moment[]>(K.moments(uid), []); }
export function saveMoment(uid: string, m: Moment) { write(K.moments(uid), [...listMoments(uid), m]); }

/* ── admin (local audit, no sensitive payloads) ── */
export function setAdminLogin(ts: string) { write(K.admin, ts); }
export function lastAdminLogin(): string { return read<string>(K.admin, "never"); }

/* ── dates ── */
export function pad(n: number) { return String(n).padStart(2, "0"); }
export function fmtDate(d: Date): string { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function todayStr(): string { return fmtDate(new Date()); }
export function parseLocalDate(s: string): Date { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
export function prettyDate(s: string): string {
  const d = parseLocalDate(s);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
export function prettyDateFull(s: string): string {
  const d = parseLocalDate(s);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}
export function fmtTime(sec: number): string {
  if (!sec || sec < 0) return "0s";
  if (sec < 60) return `${String(sec)}s`;
  return `${Math.floor(sec / 60)}m ${String(Math.floor(sec % 60)).padStart(2, "0")}s`;
}
