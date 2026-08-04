/**
 * Remove the ₹1 test SKUs created by seed-test-payment-skus.ts.
 *
 * Unlike the deep clone (scripts/teardown-test-clone.ts) these need no manifest:
 * the seed script writes them at two fixed, reserved slugs — `test-payment-
 * property` and `test-payment-package` — that no real hotel or package will ever
 * hold. Matching on those literals is therefore safe in a way that matching a
 * clone's slug is not, since a clone is deliberately indistinguishable from real
 * inventory.
 *
 * Children are deleted before parents. Most of the tree cascades from `hotels`
 * and `packages`, but several relations are restrict-on-delete — the itinerary
 * stay, package pricing, durations/routes/stay categories, room rates and hotel
 * images among them — so those are removed explicitly here.
 *
 * Refuses if any booking references either SKU: a booking carries its own price
 * snapshot but still points at the package and hotel rows, and removing them
 * would leave that history dangling. Purge the bookings first (npm run
 * purge:bookings) if you genuinely want the SKUs gone.
 *
 * Run:  npm run teardown:test-skus              (dry run)
 *       npm run teardown:test-skus -- --commit
 */
import { db, dbTarget } from "./_db";

const COMMIT = process.argv.includes("--commit");

const HOTEL_SLUG = "test-payment-property";
const PACKAGE_SLUG = "test-payment-package";

async function main() {
    console.log(
        COMMIT
            ? "\n▸ Removing ₹1 test SKUs (COMMIT — deleting rows)"
            : "\n▸ Removing ₹1 test SKUs (DRY RUN — pass --commit to delete)",
    );
    console.log(`  target: ${dbTarget}`);

    const pkg = await db.packages.findUnique({
        where: { slug: PACKAGE_SLUG },
        select: {
            id: true, title: true,
            durations: { select: { id: true } },
            stay_categories: { select: { id: true } },
        },
    });
    const hotel = await db.hotels.findUnique({
        where: { slug: HOTEL_SLUG },
        select: { id: true, name: true, hotelRooms: { select: { id: true } } },
    });

    if (!pkg && !hotel) { console.log("\n  Neither SKU is present — nothing to do.\n"); return; }
    if (pkg) console.log(`\n  package #${pkg.id}  ${pkg.title}`);
    if (hotel) console.log(`  hotel   #${hotel.id}  ${hotel.name}`);

    // ── Refuse while bookings still point at either SKU ──────────────────────
    const [pkgBookings, hotelLegs, pkgHotelLegs] = await Promise.all([
        pkg ? db.booking.count({ where: { packageId: pkg.id } }) : 0,
        hotel ? db.bookingHotel.count({ where: { hotelId: hotel.id } }) : 0,
        hotel ? db.packageBookingHotel.count({ where: { hotelId: hotel.id } }) : 0,
    ]);
    if (pkgBookings || hotelLegs || pkgHotelLegs) {
        console.error(`\n  Refusing to delete — bookings still reference these SKUs:`);
        console.error(`    ${pkgBookings} booking(s) on the test package`);
        console.error(`    ${hotelLegs + pkgHotelLegs} hotel leg(s) on the test property`);
        console.error(`\n  Run purge:bookings on those first.\n`);
        process.exit(1);
    }

    const durationIds = pkg?.durations.map((d) => d.id) ?? [];
    const roomIds = hotel?.hotelRooms.map((r) => r.id) ?? [];

    const itineraryIds = pkg
        ? (await db.package_itineraries.findMany({ where: { package_id: pkg.id }, select: { id: true } })).map((i) => i.id)
        : [];
    const ratePlanIds = hotel
        ? (await db.hotel_room_pricing.findMany({ where: { hotel_id: hotel.id }, select: { id: true } })).map((r) => r.id)
        : [];

    if (!COMMIT) {
        console.log(`\n  Would delete:`);
        if (pkg) console.log(`    ${itineraryIds.length} itinerary/-ies, ${pkg.durations.length} duration(s), ${pkg.stay_categories.length} stay categor(y/ies), pricing, routes, then the package`);
        if (hotel) console.log(`    ${ratePlanIds.length} rate plan(s), ${roomIds.length} room(s), images, availability, then the hotel`);
        console.log("\n  Re-run with --commit to delete.\n");
        return;
    }

    // ── Package tree ─────────────────────────────────────────────────────────
    // itinerary_stays points at BOTH the itinerary and the hotel's room rate, so
    // it has to go before either side is touched.
    if (pkg) {
        await db.$transaction([
            db.itinerary_stays.deleteMany({ where: { itinerary_id: { in: itineraryIds } } }),
            db.package_itineraries.deleteMany({ where: { package_id: pkg.id } }),
            db.package_pricing.deleteMany({ where: { package_id: pkg.id } }),
            db.package_stay_categories.deleteMany({ where: { package_id: pkg.id } }),
            db.package_routes.deleteMany({ where: { OR: [{ duration_id: { in: durationIds } }, { packagesId: pkg.id }] } }),
            db.package_durations.deleteMany({ where: { package_id: pkg.id } }),
            db.package_images.deleteMany({ where: { package_id: pkg.id } }),
            db.package_tags.deleteMany({ where: { package_id: pkg.id } }),
            db.package_categories.deleteMany({ where: { package_id: pkg.id } }),
            db.package_cab_options.deleteMany({ where: { package_id: pkg.id } }),
            db.package_policy_map.deleteMany({ where: { package_id: pkg.id } }),
            db.packages.delete({ where: { id: pkg.id } }),
        ]);
        console.log(`  ✓ package #${pkg.id} removed`);
    }

    // ── Hotel tree ───────────────────────────────────────────────────────────
    if (hotel) {
        await db.$transaction([
            db.hotel_image_categories.deleteMany({ where: { hotel_id: hotel.id } }),
            db.hotel_images.deleteMany({ where: { hotel_id: hotel.id } }),
            db.hotel_room_images.deleteMany({ where: { room_id: { in: roomIds } } }),
            db.hotel_room_pricing.deleteMany({ where: { hotel_id: hotel.id } }),
            db.hotel_rooms.deleteMany({ where: { hotel_id: hotel.id } }),
            db.hotelOwnerNotification.deleteMany({ where: { hotel_id: hotel.id } }),
            db.hotels.delete({ where: { id: hotel.id } }),
        ]);
        console.log(`  ✓ hotel #${hotel.id} removed`);
    }

    console.log("\n  Test SKUs removed. Re-create any time with npm run seed:test-skus.\n");
}

main()
    .catch((e) => { console.error("\nteardown-test-payment-skus failed:", e); process.exit(1); })
    .finally(() => db.$disconnect());
