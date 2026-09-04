/**
 * IST time helpers, shared by the report's server query, its page, and the
 * PDF builder.
 *
 * Deliberately its own module with no "server-only" marker and no imports:
 * the client needs these at runtime, and pulling them out of the server
 * action would drag the database client into the browser bundle.
 *
 * The report is read by a team in India and a window like "1pm to 3pm" means
 * IST wall-clock, so a server running in UTC must never be allowed to shift
 * it. IST is a fixed UTC+05:30 with no DST, which is why the offset can be a
 * constant and no timezone database lookup is needed to convert either way.
 */

const IST_OFFSET = "+05:30";
export const IST_TZ = "Asia/Kolkata";

/** Converts an IST wall-clock `datetime-local` string ("2026-08-27T13:00",
 * as produced by the pickers) into the absolute instant it names. Appending
 * the fixed offset lets the platform's own parser do the arithmetic, which is
 * why this never depends on the running machine's timezone. */
export function istLocalToDate(local: string): Date {
  const withSeconds = local.length === 16 ? `${local}:00` : local;
  return new Date(`${withSeconds}${IST_OFFSET}`);
}

/** The inverse — an instant rendered back as the `datetime-local` value that
 * names it in IST. */
export function dateToIstLocal(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  // en-CA gives 24-hour parts, but midnight can come back as "24" — the
  // datetime-local input rejects that, and it means hour 00 of the same day.
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

/** The IST calendar day an instant falls on, as YYYY-MM-DD. The payments list
 * is grouped by this: a report run from yesterday evening to this afternoon
 * has to separate last night's payments from today's, the way the
 * handwritten sheet always did. */
export function istDayKey(d: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(typeof d === "string" ? new Date(d) : d);
}

/** The IST calendar day `days` away from now, as YYYY-MM-DD. */
export function istDayOffset(days: number): string {
  return istDayKey(new Date(Date.now() + days * 24 * 3600 * 1000));
}

/** An instant as IST wall-clock, for reading rather than parsing: "3 Sep
 * 2026, 11:42 pm". Used wherever staff need to know exactly when a lead
 * arrived or was handed over — "2 hours ago" cannot be checked against a
 * call log, a WhatsApp thread or another screen, and after a night shift it
 * cannot even be read as a date. */
export function istDateTime(d: Date | string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TZ,
    day: "numeric", month: "short", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  }).format(typeof d === "string" ? new Date(d) : d);
}

/** An IST calendar day as a short, readable label: "3 Sep". For naming a day
 * out loud rather than saying "before that" — a manager reconciling this
 * against an inbox needs to know which day is meant. */
export function istShortDay(d: Date | string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TZ, day: "numeric", month: "short",
  }).format(typeof d === "string" ? new Date(d) : d);
}
