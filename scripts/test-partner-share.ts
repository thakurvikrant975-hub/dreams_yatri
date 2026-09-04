/**
 * How leads are chosen for a partner agency: which ones qualify, and where in
 * the day's traffic theirs land.
 */
import { leadQualifies, fallsOnThisLead } from "../app/lib/queries/partner-rules";
import type { QuerySource } from "../app/generated/prisma";

let failures = 0;
function check(what: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`  ${ok ? "✓" : "✗"} ${what}: ${JSON.stringify(got)}${ok ? "" : ` (expected ${JSON.stringify(want)})`}`);
}
const rule = (o: Partial<{ maxGroupSize: number | null; allowedDestinations: string[]; blockedSources: QuerySource[] }> = {}) => ({
  maxGroupSize: o.maxGroupSize ?? null,
  allowedDestinations: o.allowedDestinations ?? [],
  blockedSources: o.blockedSources ?? [],
});
// `in` rather than `??` so a case can say "this lead has no destination" and
// mean it — with ?? an explicit null quietly became the default.
const lead = (o: Partial<{ groupSize: number | null; destination: string | null; source: QuerySource }> = {}) => ({
  groupSize: "groupSize" in o ? o.groupSize ?? null : null,
  destination: "destination" in o ? o.destination ?? null : "Goa",
  source: (o.source ?? "WEBSITE_FORM") as QuerySource,
});

console.log("no restrictions set — the agency takes what it is given:");
check("a big Ladakh Meta lead passes", leadQualifies(lead({ groupSize: 40, destination: "Ladakh", source: "META" }), rule()), true);
check("so does one with no destination at all", leadQualifies(lead({ destination: null }), rule()), true);

console.log("\nup to 15 travellers, only Goa and Kerala, no Meta:");
const r = rule({ maxGroupSize: 15, allowedDestinations: ["Goa", "Kerala"], blockedSources: ["META"] });
check("a family of 4 to Goa from the website", leadQualifies(lead({ groupSize: 4, destination: "Goa" }), r), true);
check("Kerala is on the list too", leadQualifies(lead({ destination: "Kerala" }), r), true);
check("16 travellers is over the limit", leadQualifies(lead({ groupSize: 16 }), r), false);
check("15 exactly is within it", leadQualifies(lead({ groupSize: 15 }), r), true);
check("Ladakh is not on the list", leadQualifies(lead({ destination: "Ladakh" }), r), false);
check("case and spacing do not matter", leadQualifies(lead({ destination: " goa " }), r), true);
check("a Meta lead is held back", leadQualifies(lead({ source: "META" }), r), false);
check("a WhatsApp lead to Goa is not", leadQualifies(lead({ destination: "Goa", source: "WHATSAPP" }), r), true);
check("filters combine — Goa but Meta still fails", leadQualifies(lead({ destination: "Goa", source: "META" }), r), false);
// Most leads arrive with no group size; treating unknown as too big would
// starve the agency over a fact the customer never gave.
check("unknown group size passes a size limit", leadQualifies(lead({ groupSize: 4, destination: "Goa" }), r), true);
// But an allowlist is the other way round: a lead we cannot place has not
// been shown to be one we agreed to sell.
check("a lead with no destination is NOT sold under an allowlist", leadQualifies(lead({ destination: null }), r), false);
check("a new catalogue destination is not sold by accident", leadQualifies(lead({ destination: "Andaman Islands" }), r), false);

console.log("\nwhere their lead lands in a 7..14 window:");
check("too early at 6", fallsOnThisLead(6, 7, 14, 0.001), false);
check("never before the window, whatever the roll", fallsOnThisLead(1, 7, 14, 0), false);
check("one-in-eight at 7 — a low roll takes it", fallsOnThisLead(7, 7, 14, 0.12), true);
check("…and a high roll does not", fallsOnThisLead(7, 7, 14, 0.13), false);
check("certain at 14", fallsOnThisLead(14, 7, 14, 0.999), true);
check("still certain past 14", fallsOnThisLead(20, 7, 14, 0.999), true);

// The window should be walked uniformly: over many runs each position 7..14
// should take roughly an eighth of the leads, and every run must land.
console.log("\nspread over 80,000 runs:");
const counts = new Map<number, number>();
for (let i = 0; i < 80_000; i++) {
  for (let p = 7; p <= 14; p++) {
    if (fallsOnThisLead(p, 7, 14)) { counts.set(p, (counts.get(p) ?? 0) + 1); break; }
  }
}
const total = [...counts.values()].reduce((a, b) => a + b, 0);
check("every run lands somewhere in the window", total, 80_000);
const share = [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([p, n]) => [p, Math.round((n / total) * 1000) / 10]);
console.log("   position → % of runs:", share.map(([p, pct]) => `${p}:${pct}%`).join(" "));
const worst = Math.max(...share.map(([, pct]) => Math.abs((pct as number) - 12.5)));
check("each position within 1 point of an even eighth", worst < 1, true);

// A tight window and a single-lead window still behave.
console.log("\nedge windows:");
check("gapMin === gapMax lands exactly there", fallsOnThisLead(5, 5, 5, 0.99), true);
check("…and never before", fallsOnThisLead(4, 5, 5, 0), false);

console.log(failures === 0 ? "\nall good" : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
