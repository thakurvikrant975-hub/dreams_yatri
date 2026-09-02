/**
 * readRequirements against the shapes production actually stores.
 *
 * The bridge lead here is copied from the four leads that crashed Kundan's,
 * Kanchan's and Snehlata's queues on 2026-09-02 — `requirements` holding only
 * the landing page's own metadata. The rule being checked is that no caller
 * can reach a missing section: either the whole thing reads as "nothing filled
 * in", or every section is there.
 */
import { readRequirements, hasRequirements } from "../app/(dashboard)/dashboard/(main)/(sales)/sales-query/requirements";

let failures = 0;
function check(what: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`  ${ok ? "✓" : "✗"} ${what}: ${JSON.stringify(got)}${ok ? "" : ` (expected ${JSON.stringify(want)})`}`);
}

// The exact stored value on +917307041474, +919816770339, +917305955765, +919978516787.
const BRIDGE_LEAD = {
  leadMeta: {
    fbclid: "IwY2xjawA_abc", referrer: "https://www.facebook.com/",
    externalId: "dy-lp-8831", formGeneration: "v2", trafficChannel: "meta",
  },
};
// The same bridge, before the metadata was namespaced under leadMeta.
const OLD_BRIDGE_LEAD = { externalId: "dy-lp-8830", utm_source: "google" };

console.log("a lead from the .com landing-page bridge:");
check("has no requirements to show", hasRequirements(BRIDGE_LEAD), false);
check("reads as nothing filled in", readRequirements(BRIDGE_LEAD), null);
check("the older flat form too", readRequirements(OLD_BRIDGE_LEAD), null);

console.log("\nthe empty and the absent:");
check("null column", readRequirements(null), null);
check("empty object", readRequirements({}), null);
check("a string somehow", readRequirements("travellers"), null);
check("an array somehow", readRequirements([{ travellers: {} }]), null);

console.log("\na half-filled section from an older format:");
const partial = readRequirements({ travellers: { leadName: "Riya", adults: 4 } });
check("comes back non-null", partial !== null, true);
check("keeps what it had", [partial?.travellers.leadName, partial?.travellers.adults], ["Riya", 4]);
check("no undefined section is reachable",
  ["journey", "stay", "transport", "activities", "budget"].map((k) => typeof (partial as Record<string, unknown>)[k]),
  ["object", "object", "object", "object", "object"]);
check("the fields the summary reads are there",
  [partial?.journey.destinations.length, partial?.stay.types.length, partial?.activities.selected.length, partial?.journey.noOfDays],
  [0, 0, 0, 0]);
check("children/infants default to nobody", [partial?.travellers.children, partial?.travellers.infants], [0, 0]);

console.log("\na properly filled lead is left alone:");
const full = readRequirements({
  travellers: { leadName: "Amit", adults: 2, children: 1, infants: 0, tripType: "HONEYMOON" },
  journey: { departurePoints: ["Delhi"], pickupPoints: [], dateType: "FIXED", noOfDays: 5, noOfNights: 4, destinations: ["Manali", "Kasol"] },
  stay: { types: ["3 Star"], mealTypes: ["MAP"] },
  transport: { required: true, cabTypes: ["SUV"], includeFlights: true, includeTrain: false },
  activities: { selected: ["Paragliding"], custom: [] },
  budget: { type: "TOTAL", min: 50000, max: 80000, currency: "INR" },
});
check("its own travellers", [full?.travellers.adults, full?.travellers.tripType], [2, "HONEYMOON"]);
check("its own journey", [full?.journey.noOfDays, full?.journey.destinations], [5, ["Manali", "Kasol"]]);
check("its own budget", [full?.budget.min, full?.budget.type], [50000, "TOTAL"]);
check("its own stay and activities", [full?.stay.types, full?.activities.selected], [["3 Star"], ["Paragliding"]]);

// What the detail sheet does with each of these — the reads that threw.
console.log("\nthe summary block's own reads, on every shape:");
for (const [label, value] of [["bridge", BRIDGE_LEAD], ["partial", { travellers: { adults: 4 } }], ["full", {
  travellers: { leadName: "Amit", adults: 2, children: 0, infants: 0 },
  journey: { departurePoints: [], pickupPoints: [], dateType: "FIXED", noOfDays: 5, noOfNights: 4, destinations: ["Manali"] },
  stay: { types: [], mealTypes: [] }, transport: { required: true, cabTypes: [], includeFlights: false, includeTrain: false },
  activities: { selected: [], custom: [] }, budget: { type: "PER_PERSON", currency: "INR" },
}]] as const) {
  const reqs = readRequirements(value);
  let threw: string | null = null;
  try {
    if (reqs) {
      void reqs.travellers.tripType;
      void (reqs.travellers.adults + reqs.travellers.children + reqs.travellers.infants);
      void reqs.journey.noOfDays;
      void reqs.budget.min;
      void reqs.stay.types.length;
      void reqs.transport.includeFlights;
      void reqs.journey.destinations.length;
      void reqs.activities.selected.length;
    }
  } catch (e) {
    threw = (e as Error).message;
  }
  check(`${label} lead renders`, threw, null);
}

console.log(failures === 0 ? "\nall good" : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
