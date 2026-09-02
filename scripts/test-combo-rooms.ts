/**
 * End-to-end check that a combo night — several room types at one hotel, e.g.
 * 3 Deluxe + 2 Standard — reaches costing priced correctly.
 *
 * Runs against the real catalog and writes NOTHING: it prices synthetic day
 * rows through the same `computeBuilderHotelPricing` that the builder, the
 * costing panel, the verify screen and `sendPackageToClient` all call, using
 * two genuine rate rows picked out of the hotel catalog at runtime. The point
 * is to exercise the engine, not a fixture of it — a room's rate, its
 * occupancy tiers and its seasons all come from the catalog as they stand.
 *
 * Expectations are expressed as invariants rather than amounts, so the test
 * doesn't have to restate the pricing rules (and can't quietly agree with a
 * bug by copying it): the same day is priced twice, once with the combo and
 * once without, and the difference must be exactly the extra rooms.
 *
 * Running it needs one workaround, and not because of anything here: every
 * script in this repo that reaches the database currently dies before it
 * starts, on `app/lib/db.ts`'s top-level await (`export const db = await …`).
 * tsx picks its output format from the nearest package.json, this one declares
 * no `"type": "module"`, and esbuild cannot emit a top-level await into CJS —
 * so `npm run e2e:phase4` and the rest fail identically today. Production is
 * unaffected: the crons run as Next API routes, not through tsx. Until db.ts
 * or the package type changes, run this from a directory that IS a module:
 *
 *   D=$(mktemp -d) && cp -R app "$D/app" && mkdir "$D/scripts" \
 *     && cp scripts/test-combo-rooms.ts "$D/scripts/" \
 *     && ln -s "$PWD/node_modules" "$D/node_modules" \
 *     && echo '{"type":"module"}' > "$D/package.json" \
 *     && echo '{"compilerOptions":{"baseUrl":".","paths":{"@/*":["./*"]}}}' > "$D/tsconfig.json" \
 *     && (cd "$D" && DATABASE_URL="$(grep -h '^DATABASE_URL=' "$OLDPWD/.env.development.local" | cut -d= -f2- | tr -d '\"')" \
 *          npx tsx --conditions=react-server scripts/test-combo-rooms.ts)
 *
 * It is deliberately NOT in `npm test`: that chain is pure and needs no
 * database, and this one reads the live catalog.
 */
import { db } from "../app/lib/db";
import { computeBuilderHotelPricing } from "../app/services/package-pricing.service";

let passed = 0;
const failures: string[] = [];
function check(name: string, cond: boolean) {
  if (cond) passed++;
  else { failures.push(name); console.error(`  ✗ ${name}`); }
}

/** A rate id that cannot exist, standing in for the case the engine has to
 * survive: roomPricingId has no foreign key behind it, so deleting a rate
 * leaves the id on the day (production has 37 such rows). */
const DELETED_RATE_ID = -1;

async function main() {
  // A hotel that genuinely sells more than one room type — without that there
  // is no combo to price, and nothing to test.
  const hotel = await db.hotels.findFirst({
    where: { is_active: true, room_pricing: { some: { is_active: true } } },
    select: {
      id: true, name: true,
      room_pricing: {
        where: { is_active: true },
        select: { id: true, price_per_night: true, room: { select: { name: true, max_occupancy: true } } },
        orderBy: { id: "asc" },
        take: 2,
      },
    },
    orderBy: { id: "asc" },
  });
  const twoRoomHotel = hotel && hotel.room_pricing.length >= 2
    ? hotel
    : await db.hotels.findFirst({
      where: { is_active: true },
      select: {
        id: true, name: true,
        room_pricing: {
          where: { is_active: true },
          select: { id: true, price_per_night: true, room: { select: { name: true, max_occupancy: true } } },
          orderBy: { id: "asc" }, take: 2,
        },
      },
      orderBy: { room_pricing: { _count: "desc" } },
    });

  if (!twoRoomHotel || twoRoomHotel.room_pricing.length < 2) {
    console.error("No hotel in this catalog has two priced room types — nothing to price a combo from.");
    process.exit(1);
  }

  const [primary, second] = twoRoomHotel.room_pricing;
  console.log(`Catalog fixture: ${twoRoomHotel.name} — "${primary.room?.name}" (#${primary.id}) + "${second.room?.name}" (#${second.id})`);

  const party = { adults: 8, children: 2, childrenAges: [9, 11], infantAges: [] };
  const travelDate = "2026-11-14";
  const EXTRA_QTY = 2;

  // Day 1 and day 2 are set up identically; only day 2 carries the combo. Day 3
  // repeats the combo under a costing correction, day 4 points an extra room at
  // a rate that no longer exists.
  const base = { roomPricingId: primary.id, roomsCount: 3, manualExtraBeds: null, manualExtraBedRate: null };
  const comboRoom = {
    roomPricingId: second.id,
    quantity: EXTRA_QTY,
    label: `${twoRoomHotel.name} — ${second.room?.name ?? "Room"}`,
  };

  const result = await computeBuilderHotelPricing({
    travelDate, ...party,
    days: [
      { day: 1, ...base },
      { day: 2, ...base, extraRooms: [comboRoom] },
      { day: 3, ...base, extraRooms: [comboRoom], hotelPriceOverride: 12345 },
      { day: 4, ...base, extraRooms: [{ roomPricingId: DELETED_RATE_ID, quantity: 1, label: "Gone Hotel — Gone Room" }] },
    ],
  });

  const linesOn = (day: number) => result.days.filter((l) => l.day === day);
  const totalOn = (day: number) => linesOn(day).reduce((sum, l) => sum + l.total, 0);

  console.log("\nCombo pricing:");

  check("a plain night still prices as one line", linesOn(1).length === 1);
  check("a combo night reaches costing as two lines — one per room type", linesOn(2).length === 2);
  check("...naming the same hotel on both", linesOn(2).every((l) => l.hotelName === twoRoomHotel.name));
  check("...with the second room type's own name on its line",
    linesOn(2).some((l) => l.roomName === (second.room?.name ?? "Room")));
  check("...at the quantity the exec asked for",
    linesOn(2).some((l) => l.roomsNeeded === EXTRA_QTY && l.mattresses === 0));

  // The invariant that matters: extra rooms ADD, and change nothing about how
  // the primary room is priced (its occupancy tiers, its mattresses).
  const extraLine = linesOn(2).find((l) => l.roomsNeeded === EXTRA_QTY && l.mattresses === 0);
  check("the combo adds exactly its own rooms to the night",
    extraLine != null && totalOn(2) === totalOn(1) + extraLine.total);
  check("...priced at that room's own nightly rate × quantity",
    extraLine != null && extraLine.total === extraLine.pricePerRoom * EXTRA_QTY);
  // Same line, day number aside: the primary is priced identically whether or
  // not a second room type sits beside it.
  const withoutDay = (l: (typeof result.days)[number] | undefined) =>
    l && JSON.stringify({ ...l, day: 0 });
  check("the primary room's line is untouched by the combo",
    withoutDay(linesOn(1)[0]) === withoutDay(linesOn(2).find((l) => l.roomName === (primary.room?.name ?? "Room"))));

  console.log("\nAfter costing corrects a combo day:");

  check("a corrected day collapses to a single line", linesOn(3).length === 1);
  check("...at exactly the number costing set", totalOn(3) === 12345);
  check("...with the extra rooms NOT charged on top of it", totalOn(3) === 12345);
  check("...and marked as corrected for the reviewer", linesOn(3)[0].overridden === true);

  console.log("\nWhen an extra room's rate has been deleted:");

  check("the room is still shown to the reviewer rather than vanishing", linesOn(4).length === 2);
  const gone = linesOn(4).find((l) => l.gap === "no-room-price");
  check("...flagged as having no rate", gone != null);
  check("...costed at ₹0 rather than a guess", gone?.total === 0);
  check("...keeping the name it was picked under", gone?.roomName === "Gone Room");

  console.log("\nSubtotals:");

  const expectedSubtotal = totalOn(1) + totalOn(2) + totalOn(3) + totalOn(4);
  check("the hotel subtotal is the sum of every line, combo lines included",
    result.hotelSubtotal === expectedSubtotal);
  check("a combo counts as one night, not one per room type", result.nightsCounted === 4);

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) process.exit(1);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
