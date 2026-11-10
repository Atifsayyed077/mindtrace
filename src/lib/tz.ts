/**
 * Timezone-aware date helpers (SERVER side).
 *
 * The user's local calendar date is computed here, on the server, from an
 * IANA timezone string. Client-supplied dates are never trusted, so
 * tampering with the device clock cannot open future journey days.
 */

/** yyyy-mm-dd in the given timezone (validated, falls back to UTC). */
export function localDateInTz(tz: string | null | undefined): string {
  const zone = tz && /^[A-Za-z0-9_+\-/.]{1,80}$/.test(tz) ? tz : "UTC";
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    // Invalid IANA zone → UTC calendar.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }
}

/** Whole calendar-day offset between two yyyy-mm-dd strings (UTC math). */
export function dayDiff(fromYmd: string, toYmd: string): number {
  const [fy, fm, fd] = fromYmd.split("-").map(Number);
  const [ty, tm, td] = toYmd.split("-").map(Number);
  if (![fy, fm, fd, ty, tm, td].every(Number.isFinite)) return 0;
  const a = Date.UTC(fy, fm - 1, fd);
  const b = Date.UTC(ty, tm - 1, td);
  return Math.round((b - a) / 86_400_000);
}

/** yyyy-mm-dd + offset days → yyyy-mm-dd. */
export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d) + days * 86_400_000);
  return dt.toISOString().slice(0, 10);
}

/**
 * Which journey day is open today? Day 1 opens on the start date; day N
 * opens N-1 calendar days after it. Days are never closed retroactively —
 * missed days stay catch-up-able, but can never open early.
 */
export function openDayForDate(startDateYmd: string, todayYmd: string): number {
  const elapsed = dayDiff(startDateYmd, todayYmd);
  return Math.max(0, Math.min(7, elapsed + 1));
}

/** Seconds until the given yyyy-mm-dd becomes "today" in the same tz. */
export function secondsUntilDate(ymd: string, tz: string | null | undefined): number {
  const [y, m, d] = ymd.split("-").map(Number);
  if (![y, m, d].every(Number.isFinite)) return 0;
  // Midnight local (approximate business rule: a day boundary).
  const target = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const diff = target.getTime() - Date.now();
  return diff > 0 ? Math.floor(diff / 1000) : 0;
}
