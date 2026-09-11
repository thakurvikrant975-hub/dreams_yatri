/**
 * Report dates as plain "YYYY-MM-DD" strings, in the ad account's own timezone.
 *
 * Google reports a day in the account's zone (Asia/Calcutta for ours), and the
 * tables store that calendar date as-is. Strings, not Dates, until the moment
 * they are written: a JS Date is an instant, and turning one back into a
 * calendar day in the wrong zone is exactly the off-by-one-day bug. Arithmetic
 * is done at UTC midnight, where no zone can shift it. No imports — pure, and
 * shared by the sync and its tests.
 */

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function assertDate(d: string, label = "date"): string {
  if (!DATE.test(d) || Number.isNaN(Date.parse(`${d}T00:00:00Z`))) throw new Error(`${label} must be YYYY-MM-DD, got "${d}"`);
  return d;
}

/** Today's calendar date on the account's clock — Google's "today" for it. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${assertDate(date)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** [from, to] inclusive, cut into consecutive windows of at most `days` days. */
export function windows(from: string, to: string, days: number): [string, string][] {
  assertDate(from, "from"); assertDate(to, "to");
  if (from > to) throw new Error(`from (${from}) is after to (${to})`);
  const out: [string, string][] = [];
  for (let start = from; start <= to; start = addDays(start, days)) {
    const end = addDays(start, days - 1);
    out.push([start, end < to ? end : to]);
  }
  return out;
}
