// ─────────────────────────────────────────────────────────────────────────────
// The calendar date a given day of the trip falls on — as the hotel catalog
// needs it.
//
// Shared by both builders, because the rule it serves is the same in both: a
// room whose seasons do not reach the night being booked must not be offered.
// That check can only run if the search is told which night it is, and every
// picker that forgot to say silently fell back to listing base rates — which
// is how an exec picked a room at last year's price and only found out at
// Mark Ready, after the whole package was built.
//
// Lives here rather than in either builder's ItineraryDocument so there is one
// answer to "what date is day 4", reachable from both.
// ─────────────────────────────────────────────────────────────────────────────

/** Day N's calendar date. Day 1 is the travel date itself. Null when there is
 * no travel date to anchor to yet — the caller then has no night to filter by
 * and the catalog shows everything, which is correct: nothing is known to be
 * out of season. */
export function dayCalendarDate(travelDate: string | null | undefined, dayNumber: number): Date | null {
  if (!travelDate) return null;
  const base = new Date(travelDate);
  if (Number.isNaN(base.getTime())) return null;
  return new Date(base.getTime() + (dayNumber - 1) * 24 * 60 * 60 * 1000);
}

/** The same date as `YYYY-MM-DD`, which is what searchHotelRoomsForBuilder
 * matches seasons against.
 *
 * Built from the local parts, never toISOString(): that converts to UTC and
 * hands the search the night before for anyone east of Greenwich — which is
 * everyone using this. A season starting on the 4th would then miss a booking
 * made for the 4th. */
export function nightISOForDay(travelDate: string | null | undefined, dayNumber: number): string | null {
  const d = dayCalendarDate(travelDate, dayNumber);
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
