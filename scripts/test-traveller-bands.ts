/**
 * Pure-unit tests for the two package-builder bugs fixed together:
 *
 *   1. traveller age bands — who is an infant/child/adult is per package, and
 *      beds and paying heads follow the AGE, not the box someone was typed in.
 *   2. mattresses — one stay carries one setup across its nights, and a count
 *      the hotel data can't honour is named rather than silently priced at ₹0.
 *
 * Run:  npm run test:bands
 */
import {
  normalizeAgeBands, bandOf, classifyTravellers, pricingPartyOf, payingPaxOf,
  travellersMissingAges, missingTravellerAgesError, bandMismatchLines,
  ageBandsLine, resizeAges, parseAgeInput, ageInputValue, AGE_UNSET,
  DEFAULT_AGE_BANDS,
} from "../app/(dashboard)/dashboard/(builder)/package-builder/traveller-ages";
import {
  staySpecOf, staySpecForRoom, applyStaySpec, staySpecsDiffer, inconsistentStayNights,
  addExtraRoom, applyHotelRoomSelection,
} from "../app/(dashboard)/dashboard/(builder)/package-builder/[packageId]/day-mutations";
import {
  stayMattressIssues, effectiveMattressCount, effectiveMattressRate, hotelGapLabel,
  blockingStayIssuesError,
} from "../app/(dashboard)/dashboard/(builder)/package-builder/stay-diagnostics";
import {
  extraRoomsPricingKey, extraCabsPricingKey,
} from "../app/(dashboard)/dashboard/(builder)/package-builder/room-cab-selections";
import { planRoomOccupancy } from "../app/lib/room-capacity";
import type { DayItinerary, HotelRoomResult } from "../app/(dashboard)/dashboard/(builder)/package-builder/action";

let passed = 0;
const failures: string[] = [];
function check(name: string, cond: boolean) {
  if (cond) passed++;
  else { failures.push(name); console.error(`  ✗ ${name}`); }
}

// ─────────────────────────────────────────────────────────────────────────────
console.log("Age bands:");

check("defaults are the industry 2 / 12",
  DEFAULT_AGE_BANDS.infantMaxAge === 2 && DEFAULT_AGE_BANDS.childMaxAge === 12);
check("an absent pair normalises to the defaults",
  normalizeAgeBands(null).infantMaxAge === 2 && normalizeAgeBands(null).childMaxAge === 12);
check("nulls on an old row normalise to the defaults",
  normalizeAgeBands({ infantMaxAge: null, childMaxAge: null }).childMaxAge === 12);
check("a hotel treating under-5s as infants is accepted",
  normalizeAgeBands({ infantMaxAge: 5, childMaxAge: 12 }).infantMaxAge === 5);
check("crossed bounds can't produce an empty child band",
  normalizeAgeBands({ infantMaxAge: 5, childMaxAge: 3 }).childMaxAge > 5);
check("an out-of-range infant bound is clamped, not accepted",
  normalizeAgeBands({ infantMaxAge: 40, childMaxAge: 12 }).infantMaxAge === 5);
check("bands read as a sentence",
  ageBandsLine({ infantMaxAge: 2, childMaxAge: 12 }) === "Infants 0–2 · Children 3–12 · Adults 13+");

const std = { infantMaxAge: 2, childMaxAge: 12 };
check("0 is an infant", bandOf(0, std) === "infant");
check("2 is an infant (inclusive upper bound)", bandOf(2, std) === "infant");
check("3 is a child", bandOf(3, std) === "child");
check("12 is a child (inclusive upper bound)", bandOf(12, std) === "child");
check("13 is an adult", bandOf(13, std) === "adult");
check("an unset age has no band", bandOf(AGE_UNSET, std) === null);
check("a 4-year-old is a child on the default band", bandOf(4, std) === "child");
check("a 4-year-old is an infant where the hotel says under-5",
  bandOf(4, { infantMaxAge: 5, childMaxAge: 12 }) === "infant");

// ─────────────────────────────────────────────────────────────────────────────
console.log("Classification:");

// The reported case: a 14-year-old typed under Children needs an adult bed.
const teen = { adults: 2, children: 1, infants: 0, childrenAges: [14], infantAges: [], ...std };
check("a 14-year-old in the children box is priced as an adult",
  classifyTravellers(teen).adults === 3 && classifyTravellers(teen).children === 0);
check("...and is reported rather than silently moved",
  bandMismatchLines(teen).length === 1 && bandMismatchLines(teen)[0].includes("priced as an adult"));
// ...but not an extra head to divide the total by. The per-person figure is
// split across the ADULTS ENTERED and nothing else — see payingPaxOf, which
// says so in its own words. The band still decides what this traveller costs
// (an adult bed, an adult's occupancy tier); it no longer decides the divisor.
check("...without changing how many heads the price is divided by",
  payingPaxOf(teen) === 2);

// The band moving is what changes the cost, not the divisor.
const under5 = { adults: 2, children: 1, infants: 0, childrenAges: [4], infantAges: [] };
check("a child is never a head in the per-person divisor, on any band",
  payingPaxOf({ ...under5, ...std }) === 2
  && payingPaxOf({ ...under5, infantMaxAge: 5, childMaxAge: 12 }) === 2);
check("...but the band still decides whether they take a bed",
  pricingPartyOf({ ...under5, ...std }).children === 1
  && pricingPartyOf({ ...under5, infantMaxAge: 5, childMaxAge: 12 }).children === 0);

const babyInChildBox = { adults: 2, children: 1, infants: 0, childrenAges: [1], infantAges: [], ...std };
check("a 1-year-old typed under Children is priced as an infant",
  classifyTravellers(babyInChildBox).infants === 1);
check("...and is not a paying head", payingPaxOf(babyInChildBox) === 2);

const bigInfant = { adults: 2, children: 0, infants: 1, childrenAges: [], infantAges: [4], ...std };
check("a 4-year-old typed under Infants is priced as a child",
  classifyTravellers(bigInfant).children === 1);
check("...and takes a child's bed", pricingPartyOf(bigInfant).children === 1);
check("...still without adding a head to the divisor", payingPaxOf(bigInfant) === 2);

const unanswered = { adults: 2, children: 1, infants: 0, childrenAges: [AGE_UNSET], infantAges: [], ...std };
check("an unanswered age stays in the box it was entered in",
  classifyTravellers(unanswered).children === 1);
check("...and raises no mismatch, because nothing is known yet",
  bandMismatchLines(unanswered).length === 0);
check("adults-only parties classify unchanged",
  payingPaxOf({ adults: 4, children: 0, infants: 0, childrenAges: [], infantAges: [], ...std }) === 4);
check("a package with no ages at all still prices",
  payingPaxOf({ adults: 2, children: 1 }) === 2);

// ─────────────────────────────────────────────────────────────────────────────
console.log("Age entry:");

// An age is optional now: entering one feeds the traveller line and the band
// classification, and leaving it out no longer stops a package reaching
// costing (see travellersMissingAges, which returns nothing by design).
check("an unanswered age is not reported as missing", travellersMissingAges(unanswered).length === 0);
check("an out-of-band age is NOT reported as missing — it is answered",
  travellersMissingAges(teen).length === 0);
check("an unanswered age does not block the submit", missingTravellerAgesError(unanswered) === null);
check("nothing missing means nothing blocks", missingTravellerAgesError(teen) === null);
check("a new age slot is unset, not zero", resizeAges([], 2)[0] === AGE_UNSET);
check("an emptied box returns to unset", parseAgeInput("") === AGE_UNSET);
check("an unset age shows as an empty box", ageInputValue(AGE_UNSET) === "");
check("zero is a real answer and shows as one", ageInputValue(0) === "0");

// ─────────────────────────────────────────────────────────────────────────────
console.log("Mattresses — one stay, one setup:");

const room = {
  accommodation: "Snow Valley — Deluxe",
  accommodationRoomCapacity: 2,
  accommodationExtraBedCapacity: 1,
  accommodationExtraBedRate: 500,
  accommodationMaxAdults: 3,
  accommodationMaxChildren: 1,
  roomPricingId: 42,
  hotelPending: false,
};
const night = (day: number, over: Partial<DayItinerary> = {}) =>
  ({ day, ...room, roomsCount: null, manualExtraBeds: null, manualExtraBedRate: null, ...over }) as unknown as DayItinerary;

// The reported bug: the same hotel and party, different mattress counts per
// night, because each night derived its own from its own roomsCount.
const drifted = [
  night(1, { manualExtraBeds: 2 }),
  night(2, { manualExtraBeds: 1 }),
  night(3, { manualExtraBeds: 2 }),
];
check("a run whose nights disagree is detected",
  inconsistentStayNights(drifted, 1).join(",") === "2");
check("...from whichever night of the run is open",
  inconsistentStayNights(drifted, 3).join(",") === "2");

const aligned = drifted.map((d) => applyStaySpec(d, staySpecOf(drifted[0])));
check("aligning the run leaves nothing disagreeing",
  inconsistentStayNights(aligned, 1).length === 0);
check("...by copying the first night's count onto every night",
  aligned.every((d) => d.manualExtraBeds === 2));

check("a consistent run reports nothing",
  inconsistentStayNights([night(1, { manualExtraBeds: 2 }), night(2, { manualExtraBeds: 2 })], 1).length === 0);
check("a single-night stay has nothing to disagree with",
  inconsistentStayNights([night(1, { manualExtraBeds: 2 })], 1).length === 0);
check("nights of DIFFERENT hotels are not one run",
  inconsistentStayNights(
    [night(1, { manualExtraBeds: 2 }), night(2, { roomPricingId: 99, manualExtraBeds: 1 })], 1,
  ).length === 0);

const spec = staySpecOf(night(1, { roomsCount: 2, manualExtraBeds: 2, manualExtraBedRate: 400 }));
check("a spec carries rooms, mattresses and the rate",
  spec.roomsCount === 2 && spec.manualExtraBeds === 2 && spec.manualExtraBedRate === 400);
check("two identical specs don't differ", !staySpecsDiffer(spec, { ...spec }));
check("a different mattress count differs",
  staySpecsDiffer(spec, { ...spec, manualExtraBeds: 1 }));
check("a different room count differs too — it is what derives the mattresses",
  staySpecsDiffer(spec, { ...spec, roomsCount: 3 }));

// ─────────────────────────────────────────────────────────────────────────────
console.log("Combo nights — several room types at one hotel:");

/** Only the fields these functions actually read — a catalog room carries
 * thirty, and spelling them out here would test the fixture, not the code. */
const catalogRoom = (over: Partial<HotelRoomResult>) => ({
  thumbnail: null, roomSpecs: null, coveredMeals: [], roomPhotos: [], ...over,
}) as unknown as HotelRoomResult;
const deluxe = catalogRoom({ id: 10, hotelId: 7, hotelName: "Hotel Pinegrove", roomName: "Deluxe", roomCapacity: 3 });
const standard = catalogRoom({ id: 11, hotelId: 7, hotelName: "Hotel Pinegrove", roomName: "Standard", roomCapacity: 2 });
/** A room at a DIFFERENT property — what a combo must never end up holding. */
const elsewhere = catalogRoom({ id: 20, hotelId: 9, hotelName: "Cedar Lodge", roomName: "Standard", roomCapacity: 2 });

const combo = addExtraRoom(night(1, { roomsCount: 3 }), standard, 3);
check("an extra room type records the hotel it belongs to",
  (combo.extraRooms ?? [])[0].hotelId === 7);
check("...at one room until asked otherwise",
  (combo.extraRooms ?? [])[0].quantity === 1);

const autoSized = addExtraRoom(night(1), standard, 4);
check("starting a combo pins the primary's auto room count", autoSized.roomsCount === 4);
check("...and never overwrites a count the exec set",
  addExtraRoom(night(1, { roomsCount: 2 }), standard, 4).roomsCount === 2);

check("a combo travels with the stay",
  staySpecOf(combo).extraRooms.length === 1);
check("two nights differing only in their combo are detected",
  inconsistentStayNights([combo, night(2, { roomsCount: 3 })], 1).join(",") === "2");
check("...and aligning the run copies the combo onto every night",
  inconsistentStayNights(
    [combo, night(2, { roomsCount: 3 })].map((d) => applyStaySpec(d, staySpecOf(combo))), 1,
  ).length === 0);
check("the order rooms were added in is not a difference between nights",
  !staySpecsDiffer(
    staySpecOf(addExtraRoom(combo, deluxe, 3)),
    { ...staySpecOf(combo), extraRooms: [...staySpecOf(addExtraRoom(combo, deluxe, 3)).extraRooms].reverse() },
  ));

check("changing to another room at the SAME hotel keeps the combo",
  (applyHotelRoomSelection(combo, deluxe).extraRooms ?? []).length === 1);
check("changing hotel drops rooms the new property never had",
  (applyHotelRoomSelection(combo, elsewhere).extraRooms ?? []).length === 0);
check("a spec applied to a night being given another hotel carries no stale rooms",
  staySpecForRoom(combo, elsewhere).extraRooms.length === 0);
check("...and carries them when the hotel is the same",
  staySpecForRoom(combo, deluxe).extraRooms.length === 1);

// Packages built before a selection recorded its hotel: spreading the night's
// own room over more nights must not quietly delete the combo on it.
const legacy = {
  ...night(1, { roomsCount: 3 }),
  extraRooms: [{ roomPricingId: 11, label: "Hotel Pinegrove — Standard", quantity: 2 }],
} as unknown as DayItinerary;
const ownRoom = catalogRoom({ id: legacy.roomPricingId!, hotelId: 7, hotelName: "Hotel Pinegrove", roomName: "Deluxe", roomCapacity: 3 });
check("spreading a night's own room keeps a combo saved without a hotel id",
  staySpecForRoom(legacy, ownRoom).extraRooms.length === 1);
check("...while changing the room does drop it, since nothing says it belongs",
  staySpecForRoom(legacy, standard).extraRooms.length === 0);

// The party fits across BOTH room types — 3 deluxe (9 beds) + 2 standard (4)
// for a party of 12 — so nothing should be flagged.
const noBeds = { accommodationExtraBedCapacity: 0, accommodationRoomCapacity: 3, roomsCount: 3 };
const comboNight = {
  ...night(1, noBeds),
  extraRooms: [{ roomPricingId: 11, label: "Hotel Pinegrove — Standard", quantity: 2, hotelId: 7, roomCapacity: 2 }],
} as unknown as DayItinerary;
check("a party that fits across a combo raises nothing",
  stayMattressIssues(comboNight, { adults: 12, children: 0 })
    .every((i) => i.code !== "party-does-not-fit"));
check("a party that does not fit even across the combo is still flagged",
  stayMattressIssues(comboNight, { adults: 20, children: 0 })
    .some((i) => i.code === "party-does-not-fit"));

// ─────────────────────────────────────────────────────────────────────────────
console.log("Costing's per-day correction survives a save:");

// EXACTLY what Postgres hands back for the list below — captured by round-
// tripping it through a real `::jsonb` cast. jsonb canonicalises key order (by
// key length, then bytewise), so the stored copy and the copy the builder
// sends are never string-equal however identical their contents. Comparing
// them with JSON.stringify — which is what the save used to do — reported a
// changed hotel selection on every save of a combo day and threw away the
// costing manager's correction for that day.
const asStored = [{
  label: "Hotel Pinegrove — Standard", hotelId: 7, quantity: 2, roomSpecs: null,
  thumbnail: null, roomCapacity: 2, roomPricingId: 812,
}];
const asSent = [{
  roomPricingId: 812, label: "Hotel Pinegrove — Standard", quantity: 2, hotelId: 7,
  thumbnail: null, roomCapacity: 2, roomSpecs: null,
}];
check("the naive comparison this replaced really did see a difference",
  JSON.stringify(asStored) !== JSON.stringify(asSent));
check("the stored row and the sent row price the same",
  extraRoomsPricingKey(asStored) === extraRoomsPricingKey(asSent));
check("...so an untouched combo day keeps costing's correction",
  extraRoomsPricingKey(asStored) === extraRoomsPricingKey(asSent));

check("a changed quantity is a repriced night",
  extraRoomsPricingKey(asSent) !== extraRoomsPricingKey([{ ...asSent[0], quantity: 3 }]));
check("a different room type is a repriced night",
  extraRoomsPricingKey(asSent) !== extraRoomsPricingKey([{ ...asSent[0], roomPricingId: 900 }]));
check("adding a room type is a repriced night",
  extraRoomsPricingKey(asSent) !== extraRoomsPricingKey([...asSent, { roomPricingId: 900, label: "x", quantity: 1 }]));
check("a re-typed label alone is not",
  extraRoomsPricingKey(asSent) === extraRoomsPricingKey([{ ...asSent[0], label: "Renamed" }]));
check("the order two room types were added in is not",
  extraRoomsPricingKey([{ roomPricingId: 1, label: "a", quantity: 1 }, { roomPricingId: 2, label: "b", quantity: 2 }])
  === extraRoomsPricingKey([{ roomPricingId: 2, label: "b", quantity: 2 }, { roomPricingId: 1, label: "a", quantity: 1 }]));
check("an unfinished row the exec never picked a room for is ignored",
  extraRoomsPricingKey([{ roomPricingId: 0, label: "", quantity: 1 }]) === "");
check("no extra rooms at all is a stable empty key",
  extraRoomsPricingKey(null) === "" && extraRoomsPricingKey([]) === "");

check("cabs get the same treatment",
  extraCabsPricingKey([{ label: "Innova", quantity: 1, cabPricingId: 5 }])
  === extraCabsPricingKey([{ cabPricingId: 5, quantity: 1, label: "Innova" }]));
check("...and an unpriced fleet vehicle is still told apart by its name",
  extraCabsPricingKey([{ cabPricingId: null, label: "Innova", quantity: 1 }])
  !== extraCabsPricingKey([{ cabPricingId: null, label: "Tempo", quantity: 1 }]));

// ─────────────────────────────────────────────────────────────────────────────
console.log("Mattresses — why the count didn't take:");

const party = { adults: 3, children: 0 };

check("a healthy night raises nothing",
  stayMattressIssues(night(1, { manualExtraBeds: 1 }), party).length === 0);

// The hotel team never enabled extra beds on the room.
const notEnabled = night(1, { accommodationExtraBedCapacity: 0, manualExtraBeds: 2 });
const notEnabledIssues = stayMattressIssues(notEnabled, party);
check("a room with no extra beds enabled is flagged",
  notEnabledIssues.some((i) => i.code === "mattresses-not-enabled"));
check("...as an error, because costing cannot cost it",
  notEnabledIssues[0].severity === "error");
check("...naming the field and who owns it",
  notEnabledIssues[0].fix.includes("hotel team") && notEnabledIssues[0].fix.includes("Extra bed"));

// More mattresses than the room physically has.
const over = night(1, { roomsCount: 1, manualExtraBeds: 3 });
check("more mattresses than the rooms can hold is flagged",
  stayMattressIssues(over, party).some((i) => i.code === "mattresses-over-capacity"));
check("...and says what the most is",
  (stayMattressIssues(over, party)[0].fix ?? "").includes("1"));
check("exactly at capacity is fine",
  stayMattressIssues(night(1, { roomsCount: 2, manualExtraBeds: 2 }), party)
    .every((i) => i.code !== "mattresses-over-capacity"));

// The rate sheet prices no extra bed — the silent ₹0 case.
const unpriced = night(1, { accommodationExtraBedRate: null, manualExtraBeds: 1 });
check("mattresses with no rate behind them are flagged",
  stayMattressIssues(unpriced, party).some((i) => i.code === "no-mattress-rate"));
check("...as a warning, since complimentary mattresses are real",
  stayMattressIssues(unpriced, party).find((i) => i.code === "no-mattress-rate")!.severity === "warning");
check("...and the exec's own typed rate clears it",
  stayMattressIssues(night(1, { accommodationExtraBedRate: null, manualExtraBeds: 1, manualExtraBedRate: 400 }), party)
    .every((i) => i.code !== "no-mattress-rate"));

check("a night still with the hotel team is never badged",
  stayMattressIssues(night(1, { hotelPending: true, manualExtraBeds: 5 }), party).length === 0);
check("a night with no stay at all is never badged",
  stayMattressIssues(
    { day: 1, accommodation: "", roomPricingId: null, hotelPending: false } as unknown as DayItinerary,
    party,
  ).length === 0);

check("the exec's typed rate wins over the room's",
  effectiveMattressRate(night(1, { manualExtraBedRate: 400 })) === 400);
check("the room's own rate is used when nothing was typed",
  effectiveMattressRate(night(1)) === 500);
check("no rate anywhere reads as zero, not as undefined",
  effectiveMattressRate(night(1, { accommodationExtraBedRate: null })) === 0);

check("an explicit count wins over the derived one",
  effectiveMattressCount(night(1, { manualExtraBeds: 2 }), party) === 2);
check("the derived count matches the shared room plan",
  effectiveMattressCount(night(1), party)
    === planRoomOccupancy(3, 0, {
      max_occupancy: 2, extra_bed_capacity: 1, max_adults: 3, max_children: 1,
    }, null).mattresses);

// ─────────────────────────────────────────────────────────────────────────────
console.log("Submit guard and costing labels:");

check("an uncostable stay blocks Mark Ready",
  blockingStayIssuesError([notEnabled], party) !== null);
check("...naming the day", (blockingStayIssuesError([notEnabled], party) ?? "").startsWith("Day 1"));
check("a merely unpriced mattress does NOT block",
  blockingStayIssuesError([unpriced], party) === null);

// A room whose own catalog data contradicts itself: it claims to take 3 adults
// but has 2 beds and no mattresses. Worth shouting about, but the exec cannot
// edit the room — blocking would strand them behind the hotel team.
const contradictory = night(1, { accommodationExtraBedCapacity: 0, manualExtraBeds: null });
check("a room that can't seat the party is flagged",
  stayMattressIssues(contradictory, party).some((i) => i.code === "party-does-not-fit"));
check("...as an error, because it is one",
  stayMattressIssues(contradictory, party)[0].severity === "error");
check("...but does NOT block submit — only the hotel team can fix it",
  blockingStayIssuesError([contradictory], party) === null);
check("a room with capacity to spare raises nothing",
  stayMattressIssues(night(1), { adults: 2, children: 0 }).length === 0);
check("a healthy package doesn't block",
  blockingStayIssuesError([night(1, { manualExtraBeds: 1 })], party) === null);

check("every gap the engine emits has a costing label",
  ["no-room-price", "no-mattress-rate", "mattresses-not-enabled", "mattresses-over-capacity"]
    .every((g) => hotelGapLabel(g) != null));
check("an unknown gap from an old snapshot returns null rather than throwing",
  hotelGapLabel("something-a-future-build-added") === null);
check("no gap is no label", hotelGapLabel(undefined) === null);

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
