/**
 * Day, week and month boundaries in IST, for the figures staff read.
 *
 * The server runs in UTC, so `setHours(0,0,0,0)` gives midnight UTC — half
 * past five in the morning in the office. Every lead that arrived between IST
 * midnight and 5:30am therefore counted as the previous day's, which is
 * exactly the window landing-page leads arrive in. IST is a fixed +05:30 with
 * no DST, so the arithmetic needs no timezone database.
 *
 * The lead report has its own IST helpers for the wall-clock strings its
 * pickers produce; these are the instant-boundary equivalents the dashboards
 * need.
 */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** The IST calendar date of an instant, as YYYY-MM-DD. */
function istDateParts(at: Date): { y: number; m: number; d: number } {
    const shifted = new Date(at.getTime() + IST_OFFSET_MS);
    return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth(), d: shifted.getUTCDate() };
}

/** The instant IST midnight of a given IST calendar date falls on. */
function istMidnight(y: number, m: number, d: number): Date {
    return new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - IST_OFFSET_MS);
}

/** Start and end of the IST day an instant falls in. */
export function istDayBounds(at: Date = new Date()): { start: Date; end: Date } {
    const { y, m, d } = istDateParts(at);
    const start = istMidnight(y, m, d);
    return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1) };
}

/** Monday 00:00 IST of the week an instant falls in. */
export function istWeekStart(at: Date = new Date()): Date {
    const { y, m, d } = istDateParts(at);
    const shifted = new Date(at.getTime() + IST_OFFSET_MS);
    // getUTCDay on the shifted clock is the IST weekday; Sunday counts as the
    // seventh day of the week that is ending, not the first of a new one.
    const weekday = shifted.getUTCDay();
    const backToMonday = weekday === 0 ? 6 : weekday - 1;
    return istMidnight(y, m, d - backToMonday);
}

/** First and last instant of the IST calendar month an instant falls in. */
export function istMonthBounds(at: Date = new Date()): { start: Date; end: Date } {
    const { y, m } = istDateParts(at);
    return { start: istMidnight(y, m, 1), end: new Date(istMidnight(y, m + 1, 1).getTime() - 1) };
}
