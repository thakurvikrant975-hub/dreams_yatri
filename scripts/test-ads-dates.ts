/**
 * The date arithmetic the ads sync windows run on. Day boundaries are where an
 * ads warehouse quietly goes wrong — a report a day off, a window that skips
 * or repeats a date — so every edge here is pinned.
 */
import { todayIn, addDays, windows, assertDate } from "../app/lib/ads/dates";

let failures = 0;
function check(what: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`  ${ok ? "✓" : "✗"} ${what}: ${JSON.stringify(got)}${ok ? "" : ` (expected ${JSON.stringify(want)})`}`);
}
const throws = (f: () => unknown) => { try { f(); return false; } catch { return true; } };

console.log("today, on the account's clock:");
// 20:00 UTC on the 10th is already 01:30 on the 11th in India.
check("late UTC evening is tomorrow in IST", todayIn("Asia/Calcutta", new Date("2026-09-10T20:00:00Z")), "2026-09-11");
check("…and still today in UTC", todayIn("UTC", new Date("2026-09-10T20:00:00Z")), "2026-09-10");
check("IST midnight exactly", todayIn("Asia/Calcutta", new Date("2026-09-10T18:30:00Z")), "2026-09-11");
check("one ms before it", todayIn("Asia/Calcutta", new Date("2026-09-10T18:29:59.999Z")), "2026-09-10");

console.log("\nadding days:");
check("across a month", addDays("2026-08-30", 3), "2026-09-02");
check("backwards across a year", addDays("2026-01-01", -1), "2025-12-31");
check("into a leap day", addDays("2028-02-28", 1), "2028-02-29");
check("30-day window ending today", addDays("2026-09-11", -29), "2026-08-13");

console.log("\nwindows:");
check("one short window", windows("2026-09-01", "2026-09-07", 31), [["2026-09-01", "2026-09-07"]]);
check("exactly one window's length", windows("2026-09-01", "2026-09-03", 3), [["2026-09-01", "2026-09-03"]]);
const w = windows("2025-08-29", "2026-09-11", 31);
check("a year cut into months: first", w[0], ["2025-08-29", "2025-09-28"]);
check("…last ends on the last day", w[w.length - 1][1], "2026-09-11");
check("…no gaps or overlaps", w.slice(1).every(([s], i) => s === addDays(w[i][1], 1)), true);
check("…every day counted once", w.reduce((n, [s, e]) => n + (Date.parse(e) - Date.parse(s)) / 864e5 + 1, 0), (Date.parse("2026-09-11") - Date.parse("2025-08-29")) / 864e5 + 1);
check("a single day", windows("2026-09-11", "2026-09-11", 31), [["2026-09-11", "2026-09-11"]]);

console.log("\nbad input is refused, not guessed at:");
check("from after to", throws(() => windows("2026-09-12", "2026-09-11", 31)), true);
check("not a date", throws(() => assertDate("11/09/2026")), true);
check("impossible date", throws(() => assertDate("2026-13-01")), true);
check("GAQL-breaking text", throws(() => assertDate("2026-09-11' OR '1'='1")), true);

console.log(failures === 0 ? "\nall good" : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
