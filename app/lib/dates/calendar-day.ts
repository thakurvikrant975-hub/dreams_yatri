// Canonical, timezone-safe handling for "YYYY-MM-DD" calendar-day strings —
// travel dates, trip days, hotel-season nights, etc.
//
// The bug this exists to kill for good: `new Date("2026-12-27")` parses a
// bare date-only string as UTC MIDNIGHT (per spec), not local midnight. Feed
// that into `.toLocaleDateString()` (which reads LOCAL time) on any runtime
// whose timezone sits behind UTC, and the printed date silently rolls back
// to the 26th — while the exact same code looks correct to anyone testing
// from IST (ahead of UTC) or a UTC-default server, which is exactly how this
// shipped unnoticed. `new Date("2026-12-27").toISOString().slice(0,10)` has
// the mirror-image bug: correct on UTC-behind runtimes, wrong on IST.
//
// The fix is to never let a calendar day touch UTC at all: parse the y/m/d
// digits directly into `new Date(y, m-1, d)` (LOCAL midnight — an entirely
// different, safe Date constructor overload), do all arithmetic in local
// time, and read results back with local getters. No UTC round-trip anywhere
// in the pipeline means no timezone can ever shift the day.
//
// package-builder, package-builder-v2, and night-date.ts each had their own
// copy of this logic (only night-date.ts's comment even mentioned the risk).
// This is now the one place it's written — everything else imports it.

/** "YYYY-MM-DD" → local midnight. Never hand a bare date string to `new
 * Date()` directly — parse the digits yourself. */
export function parseCalendarDay(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Adds N days in local time — `setDate` correctly rolls over month/year
 * boundaries (e.g. day 31 of a 28-day month), so this stays exact however
 * far past the day 1 anchor it's asked to go. */
export function addCalendarDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Day N's calendar date for a trip — day 1 is the travel date itself.
 * Replaces every builder/night-lookup's own `dayCalendarDate`. */
export function calendarDayOfTrip(
  travelDate: string | null | undefined,
  dayNumber: number,
): Date | null {
  const base = parseCalendarDay(travelDate);
  if (!base) return null;
  return addCalendarDays(base, dayNumber - 1);
}

/** Local y/m/d → "YYYY-MM-DD" — the inverse of parseCalendarDay. Use this
 * instead of `date.toISOString().slice(0, 10)`, which re-introduces the
 * exact UTC round-trip this file exists to avoid. */
export function formatCalendarDayISO(date: Date | null | undefined): string {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "Sat, 27 Dec" — safe because `date` is already local-anchored (from
 * parseCalendarDay/calendarDayOfTrip), so reading it back in local time
 * round-trips exactly regardless of which timezone the runtime is in. */
export function formatCalendarDayShort(date: Date | null | undefined): string {
  if (!date) return "";
  return date.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });
}

/** "27 Dec 2026" — same safety note as formatCalendarDayShort. */
export function formatCalendarDayLong(date: Date | null | undefined): string {
  if (!date) return "";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/** For a `Date` that came straight from a `DateTime` column saved via the
 * `new Date("YYYY-MM-DD")` convention (package-builder/action.ts's
 * saveCustomPackage, custom_packages.travelDate) — those are anchored at UTC
 * midnight, NOT local midnight, so formatting them needs `timeZone: "UTC"`
 * explicitly. Do not use this on a Date from parseCalendarDay/
 * calendarDayOfTrip above — those are local-anchored and want the plain
 * formatCalendarDayLong instead. Mixing the two up is exactly how this bug
 * class recurs, so keep values from the DB and values from date-only string
 * arithmetic in their own lane. */
export function formatStoredCalendarDayLong(date: Date | null | undefined): string {
  if (!date) return "";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}
