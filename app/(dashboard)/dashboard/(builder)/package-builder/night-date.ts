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
//
// The actual date arithmetic is centralized in app/lib/dates/calendar-day.ts
// (see that file for why bare `new Date(dateString)` is unsafe) — re-exported
// here under this module's established names so no call site had to change.
// ─────────────────────────────────────────────────────────────────────────────

import { calendarDayOfTrip, formatCalendarDayISO } from "@/app/lib/dates/calendar-day";

/** Day N's calendar date. Day 1 is the travel date itself. Null when there is
 * no travel date to anchor to yet — the caller then has no night to filter by
 * and the catalog shows everything, which is correct: nothing is known to be
 * out of season. */
export function dayCalendarDate(travelDate: string | null | undefined, dayNumber: number): Date | null {
  return calendarDayOfTrip(travelDate, dayNumber);
}

/** The same date as `YYYY-MM-DD`, which is what searchHotelRoomsForBuilder
 * matches seasons against. */
export function nightISOForDay(travelDate: string | null | undefined, dayNumber: number): string | null {
  const d = dayCalendarDate(travelDate, dayNumber);
  return d ? formatCalendarDayISO(d) : null;
}
