/**
 * The IST boundaries the staff dashboards count against.
 *
 * The bug these replace: setHours(0,0,0,0) on a UTC server is 5:30am IST, so
 * every lead that arrived overnight counted as the previous day's — and
 * overnight is exactly when landing-page leads arrive.
 */
import { istDayBounds, istWeekStart, istMonthBounds } from "../app/lib/ist-window";

let failures = 0;
function check(what: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`  ${ok ? "✓" : "✗"} ${what}: ${JSON.stringify(got)}${ok ? "" : ` (expected ${JSON.stringify(want)})`}`);
}
const iso = (d: Date) => d.toISOString();

// 2026-09-02 02:00 IST — before UTC midnight has even happened, and squarely
// inside the window the old code put in the day before.
const earlyMorningIST = new Date("2026-09-01T20:30:00Z");
console.log("a lead at 2am IST:");
check("day starts at IST midnight", iso(istDayBounds(earlyMorningIST).start), "2026-09-01T18:30:00.000Z");
check("day ends the instant before the next", iso(istDayBounds(earlyMorningIST).end), "2026-09-02T18:29:59.999Z");

// 11:20pm IST on the 2nd — the after-hours lead from the report.
const lateNightIST = new Date("2026-09-02T17:50:00Z");
console.log("\na lead at 11:20pm IST the same day:");
check("falls in the same IST day", iso(istDayBounds(lateNightIST).start), "2026-09-01T18:30:00.000Z");

// A minute later in IST terms is the next day.
console.log("\nthe boundary itself:");
check("18:30Z is the new day", iso(istDayBounds(new Date("2026-09-02T18:30:00Z")).start), "2026-09-02T18:30:00.000Z");
check("18:29:59Z is still the old one", iso(istDayBounds(new Date("2026-09-02T18:29:59Z")).start), "2026-09-01T18:30:00.000Z");

console.log("\nweeks start on Monday:");
// 2026-09-02 is a Wednesday in IST.
check("Wednesday looks back to Monday", iso(istWeekStart(new Date("2026-09-02T09:00:00Z"))), "2026-08-30T18:30:00.000Z");
// Sunday belongs to the week that is ending, not the one starting.
check("Sunday belongs to the ending week", iso(istWeekStart(new Date("2026-09-06T09:00:00Z"))), "2026-08-30T18:30:00.000Z");
check("Monday is its own start", iso(istWeekStart(new Date("2026-09-07T09:00:00Z"))), "2026-09-06T18:30:00.000Z");

console.log("\nmonths:");
check("September starts at IST midnight on the 1st", iso(istMonthBounds(new Date("2026-09-15T09:00:00Z")).start), "2026-08-31T18:30:00.000Z");
check("and ends as October begins", iso(istMonthBounds(new Date("2026-09-15T09:00:00Z")).end), "2026-09-30T18:29:59.999Z");
// A lead at 1am IST on 1 September is September's, though it is 31 August in UTC.
const firstOfMonthEarly = new Date("2026-08-31T19:30:00Z");
check("1am IST on the 1st is the new month", iso(istMonthBounds(firstOfMonthEarly).start), "2026-08-31T18:30:00.000Z");

console.log(failures === 0 ? "\nall good" : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
