/**
 * Transactions are date-only (no time of day). We store each one as midnight UTC of that
 * calendar date, e.g. "2026-10-13" -> 2026-10-13T00:00:00Z. Doing everything in UTC means a
 * transaction never slides into the previous or next day because of the server's time zone.
 */

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidMonth(month: string): boolean {
  return MONTH_RE.test(month);
}

export function parseDate(date: string): Date | null {
  if (!DATE_RE.test(date)) return null;
  const d = new Date(`${date}T00:00:00Z`);
  // Rejects impossible dates like 2026-02-30, which JavaScript would silently roll over.
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== date ? null : d;
}

export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** "2026-10" -> [2026-10-01, 2026-11-01): start inclusive, end exclusive. */
export function monthRange(month: string): { start: Date; end: Date } {
  const [year, m] = month.split("-").map(Number);
  return { start: new Date(Date.UTC(year, m - 1, 1)), end: new Date(Date.UTC(year, m, 1)) };
}

/** Shifts a "YYYY-MM" month by `delta` months: ("2026-01", -1) -> "2025-12". */
export function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(year, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export function currentMonth(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}

/** Every date in a month as "YYYY-MM-DD", so charts show days with no spending as zero. */
export function daysInMonth(month: string): string[] {
  const { start, end } = monthRange(month);
  const days: string[] = [];
  for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) days.push(formatDate(d));
  return days;
}
