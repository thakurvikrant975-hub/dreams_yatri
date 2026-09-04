/**
 * Turns one SENT custom package into a three-standard, discounted quote, for
 * looking at the client's published page in the states a single-stay
 * undiscounted package never reaches: the stay columns, the "Recommended"
 * badge, the option chips and the struck-through price on the booking bar.
 *
 * Deliberately does NOT hand-type the option prices. Every stay row carries a
 * real hotel_room_pricing id, and the options are left unpriced, so
 * getStayOptionsForDocument prices them live through computeStayOptionPricing
 * — the same engine, against the same catalog, net of the same discount. A
 * fixture with typed prices would look right and be untestable.
 *
 * Re-runnable: the two added standards are dropped and rebuilt each time, and
 * the discount is set to the same value rather than compounded.
 *
 *   npx tsx --env-file=.env --env-file=.env.development.local \
 *     scripts/_seed-multistay-discount.ts [packageId] [--undo]
 */
import { db, dbTarget } from "./_db";
import { applyDiscount } from "../app/(dashboard)/dashboard/(builder)/package-builder/discount";

const R2 = "https://pub-2eaea619c591446aa791cb2e0d5e22e8.r2.dev/";
const PACKAGE_ID = process.argv[2]?.startsWith("--")
  ? "ef2dd522-9f51-49dd-a585-6a400c9dd82f"
  : process.argv[2] ?? "ef2dd522-9f51-49dd-a585-6a400c9dd82f";
const UNDO = process.argv.includes("--undo");

const DISCOUNT = { type: "PERCENT" as const, value: 10 };

/** The two standards added on top of whatever the package already quotes.
 *  Real Bikaner properties and real rooms — the roomPricingIds are live
 *  hotel_room_pricing rows, which is what lets the columns price themselves. */
const ADDED = [
  {
    label: "Deluxe",
    stay: {
      accommodation: "Hotel Marudhar Palace — Super Deluxe AC Room",
      accommodationPhoto: `${R2}hotels/ahrptwnng7asubsst5xir-rkj1o72k9r-1784277868065.jpg`,
      accommodationRoomPhotos: [`${R2}hotels/ahrptwkjvgayffpi3azlniez8wa3yvfv-1784276398613.jpg`],
      accommodationLocation: "Bikaner, Rajasthan",
      accommodationRoomSpecs: "1 Double Bed | No View | 3 Star | Sleeps 2 | +1 extra bed",
      accommodationStarRating: "3 Star",
      accommodationRoomCapacity: 2,
      accommodationMaxAdults: 3,
      accommodationMaxChildren: 1,
      accommodationExtraBedCapacity: 1,
      accommodationExtraBedRate: 1100,
      // The AP board, not the B&D one. On the B&D plans this 3-star property
      // prices BELOW the 2-star the package already quotes (3,000/3,500
      // against 3,800/4,000), so the ladder read backwards — "Deluxe" cheaper
      // than "Standard". Full board is both a real catalog row and the honest
      // reason a higher standard costs more.
      roomPricingId: 3518,
      // Seven rooms, the same as the standard this package already quotes.
      // The party does not change between columns, so neither can the number
      // of rooms it is given — and a column that quietly books five while its
      // neighbour books seven is cheaper for a reason the client cannot see.
      roomsCount: 4,
      // A second room type, so one column exercises the "+ 3× …" lines and
      // the others do not.
      extraRooms: [{
        label: "Hotel Marudhar Palace — Deluxe AC Room",
        hotelId: 749,
        quantity: 3,
        roomSpecs: "1 Double Bed | No View | 3 Star | Sleeps 2 | +1 extra bed",
        thumbnail: `${R2}hotels/ahrptwngbyvdtd725prsbwjowfnc76rp-1784276191105.jpg`,
        roomCapacity: null,
        roomPricingId: 3517,
      }],
      hotelCheckIn: "12:00 PM",
      hotelCheckOut: "11:00 AM",
      hotelMealPlan: "AP (Breakfast + Lunch + Dinner)",
    },
  },
  {
    label: "Premium",
    stay: {
      accommodation: "Heritage Resort Bikaner — Deluxe room",
      accommodationPhoto: `${R2}hotels/99-1784278032211.webp`,
      accommodationRoomPhotos: [`${R2}hotels/r4-1784278291167.webp`],
      accommodationLocation: "Bikaner, Rajasthan",
      accommodationRoomSpecs: "1 King Bed | Garden View | 4 Star | Sleeps 2 | +1 extra bed",
      accommodationStarRating: "4 Star",
      accommodationRoomCapacity: 2,
      accommodationMaxAdults: 3,
      accommodationMaxChildren: 1,
      accommodationExtraBedCapacity: 1,
      accommodationExtraBedRate: 2000,
      roomPricingId: 3478,
      // Heritage lists one room type, so all seven are that one.
      roomsCount: 7,
      extraRooms: [],
      hotelCheckIn: "12:00 PM",
      hotelCheckOut: "11:00 AM",
      hotelMealPlan: "MAP (Breakfast + Dinner)",
    },
  },
];

async function main() {
  console.log(`[db] ${dbTarget}`);
  const pkg = await db.custom_packages.findUnique({
    where: { id: PACKAGE_ID },
    select: {
      id: true, title: true, status: true, currency: true, adults: true,
      totalPrice: true, pricePerPerson: true, pricingSnapshot: true,
      stayOptions: { select: { id: true, label: true, sortOrder: true, isRecommended: true } },
      itineraries: { orderBy: { day: "asc" }, select: { id: true, day: true } },
    },
  });
  if (!pkg) throw new Error(`No package ${PACKAGE_ID}`);
  console.log(`[pkg] ${pkg.title} (${pkg.status}) — ${pkg.itineraries.length} days, ` +
    `options: ${pkg.stayOptions.map((o) => o.label).join(", ") || "none"}`);

  const snap = (pkg.pricingSnapshot ?? {}) as Record<string, unknown>;
  // The pre-concession figure is the snapshot's own listPrice — the record of
  // what the trip priced at before anything came off it. Falling back to
  // totalPrice only covers a package sent before the snapshot carried one.
  const listPrice = typeof snap.listPrice === "number" ? snap.listPrice : (pkg.totalPrice ?? 0);

  if (UNDO) {
    const removed = await db.custom_package_stay_options.deleteMany({
      where: { customPackageId: PACKAGE_ID, label: { in: ADDED.map((a) => a.label) } },
    });
    await db.custom_packages.update({
      where: { id: PACKAGE_ID },
      data: {
        discountType: null, discountValue: null,
        totalPrice: listPrice, pricePerPerson: listPrice,
        pricingSnapshot: { ...snap, discountType: null, discountValue: null, discountAmount: 0,
          finalPrice: listPrice, pricePerPerson: listPrice } as never,
      },
    });
    console.log(`[undo] removed ${removed.count} stay options, discount cleared, total back to ${listPrice}`);
    return;
  }

  // ── The two extra standards ────────────────────────────────────────────────
  // Dropped first so a re-run rebuilds rather than collides with the
  // (customPackageId, label) unique index.
  await db.custom_package_stay_options.deleteMany({
    where: { customPackageId: PACKAGE_ID, label: { in: ADDED.map((a) => a.label) } },
  });
  const baseSort = pkg.stayOptions.reduce((max, o) => Math.max(max, o.sortOrder), -1);
  for (const [i, spec] of ADDED.entries()) {
    const option = await db.custom_package_stay_options.create({
      data: {
        customPackageId: PACKAGE_ID,
        label: spec.label,
        sortOrder: baseSort + 1 + i,
        // The package's existing standard keeps the badge, and with it the
        // day rows it is mirrored onto. Moving it here would leave every day
        // card describing a hotel the recommended column no longer names.
        isRecommended: false,
      },
      select: { id: true },
    });
    await db.custom_itinerary_stays.createMany({
      data: pkg.itineraries.map((it) => ({
        itineraryId: it.id,
        stayOptionId: option.id,
        ...spec.stay,
        extraRooms: spec.stay.extraRooms as never,
      })),
    });
    console.log(`[option] ${spec.label} — ${spec.stay.accommodation} on ${pkg.itineraries.length} nights`);
  }

  // ── The concession ─────────────────────────────────────────────────────────
  // Same helper every other surface uses, so the struck figure, the payable
  // one and the chip can't disagree with what checkout would charge.
  const discount = applyDiscount(listPrice, DISCOUNT);
  // payingPaxOf counts adults only — see traveller-ages.ts.
  const perPerson = pkg.adults > 0 ? Math.round(discount.finalPrice / pkg.adults) : discount.finalPrice;
  await db.custom_packages.update({
    where: { id: PACKAGE_ID },
    data: {
      discountType: DISCOUNT.type,
      discountValue: DISCOUNT.value,
      totalPrice: discount.finalPrice,
      pricePerPerson: perPerson,
      // Both sides frozen, exactly as sendPackageToClient freezes them: the
      // page prefers the snapshot over the row, so a row-only discount would
      // never reach the client.
      pricingSnapshot: {
        ...snap,
        listPrice,
        discountType: DISCOUNT.type,
        discountValue: DISCOUNT.value,
        discountAmount: discount.amount,
        finalPrice: discount.finalPrice,
        pricePerPerson: perPerson,
      } as never,
    },
  });
  console.log(`[discount] ${DISCOUNT.value}% — ${pkg.currency} ${listPrice.toLocaleString("en-IN")}` +
    ` → ${discount.finalPrice.toLocaleString("en-IN")} (${discount.amount.toLocaleString("en-IN")} off)`);
  console.log(`[done] /custom-package/${PACKAGE_ID}`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
