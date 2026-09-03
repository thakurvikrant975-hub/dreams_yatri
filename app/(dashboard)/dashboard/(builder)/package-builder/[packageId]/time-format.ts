// One pure time formatter, in its own module.
//
// It lived in ItineraryDocument.tsx, which is a 4,000-line client component
// that reaches server actions and therefore the database. day-mutations.ts —
// deliberately pure, "no React, no state, no I/O", so it can be unit-tested —
// imported it for this one function and pulled that whole graph in behind it,
// which is what made the mutations untestable in a plain node script.
//
// ItineraryDocument still re-exports it, so every existing import keeps working.

/** "14:30" (24h, as stored from <input type="time">) → "2:30 PM". */
export function formatTime12h(hhmm: string): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}
