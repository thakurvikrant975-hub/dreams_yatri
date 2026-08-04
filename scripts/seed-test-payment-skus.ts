/**
 * Seed the ₹1 test SKUs used for live payment-gateway smoke testing.
 *
 * Creates one hidden hotel (+ room + rate) and one hidden holiday package that
 * both price out to exactly ₹1, so the REAL checkout flow — quote engine,
 * signing, booking creation, gateway order, webhook, finalize, reconcile — can
 * be exercised end-to-end against live Razorpay/PayU credentials without moving
 * real money.
 *
 * Visibility: both stay out of every listing, search result and sitemap while
 * remaining reachable by direct URL. That is deliberate — the point is to test
 * the real customer path, not a parallel one. The two use different mechanisms:
 *
 *   hotel   `listing_status = DRAFT` + `is_active = false`. The detail fetch
 *           keys on slug alone, so hiding it does not affect bookability.
 *   package `is_active` cannot be used — the quote page requires it — so the
 *           package stays active and is excluded from discovery surfaces by
 *           slug instead (app/lib/packages/internal-skus.ts).
 *
 * Idempotent — re-running updates the existing rows in place rather than
 * creating duplicates.
 *
 * Run:  npm run seed:test-skus            (dry run — prints the plan, writes nothing)
 *       npm run seed:test-skus -- --commit
 */
import { db, dbTarget } from "./_db";

const COMMIT = process.argv.includes("--commit");

const HOTEL_SLUG = "test-payment-property";
const ROOM_SLUG = "test-payment-room";
const PACKAGE_SLUG = "test-payment-package";
const DURATION_SLUG = "1n-2d";
const ROUTE_SLUG = "test-route";
const STAY_SLUG = "test-stay";

/** Loud enough that nobody mistakes these for real inventory in the dashboard. */
const HOTEL_NAME = "[TEST — DO NOT BOOK] Payment Gateway Test Property";
const PACKAGE_TITLE = "[TEST — DO NOT BOOK] Payment Gateway Test Package";

function step(msg: string) {
    console.log(`${COMMIT ? "  ✓" : "  ·"} ${msg}`);
}

async function main() {
    console.log(
        COMMIT
            ? "\n▸ Seeding ₹1 test SKUs (COMMIT — writing to the database)"
            : "\n▸ Seeding ₹1 test SKUs (DRY RUN — nothing will be written; pass --commit to apply)",
    );
    console.log(`  target: ${dbTarget}\n`);

    // ── The package needs a destination_id (non-null FK). Reuse an existing one
    // rather than inventing a test destination: the destination and region pages
    // filter their package lists and counts through PUBLIC_PACKAGE, which drops
    // this slug, so it never surfaces under whichever destination it borrows.
    const destination = await db.destinations.findFirst({
        where: { is_deleted: false },
        orderBy: { id: "asc" },
        select: { id: true, name: true },
    });
    if (!destination) throw new Error("No destination rows found — cannot attach the test package.");
    console.log(`  destination: #${destination.id} ${destination.name} (borrowed for the FK only)`);

    // A package with no imagery renders the quote page with empty/missing <Image>
    // src warnings, which is noise in exactly the console you'll be watching for
    // payment errors. Borrow a thumbnail key already in the catalogue rather than
    // hardcoding a URL — it resolves through the same R2 base as every other
    // package, so it can't rot independently.
    const donor = await db.packages.findFirst({
        where: { thumbnail: { not: null }, slug: { not: PACKAGE_SLUG } },
        orderBy: { id: "asc" },
        select: { thumbnail: true },
    });
    console.log(`  thumbnail:   ${donor?.thumbnail ? "borrowed from catalogue" : "none available (page will warn)"}\n`);

    if (!COMMIT) {
        console.log("  Would create/update:");
        step(`hotels           slug=${HOTEL_SLUG}   listing_status=DRAFT, is_active=false`);
        step(`hotel_rooms      slug=${ROOM_SLUG}    num_rooms=5, max_occupancy=2`);
        step(`hotel_room_pricing                    price_per_night=₹1, extra_bed_rate=₹0`);
        step(`packages         slug=${PACKAGE_SLUG} is_active=true (hidden via internal-skus)`);
        step(`package_durations slug=${DURATION_SLUG}  1N/2D, is_default=true`);
        step(`package_routes    slug=${ROUTE_SLUG}`);
        step(`package_stay_categories slug=${STAY_SLUG}  is_default=true`);
        step(`package_pricing                       margin=0%, gst=0%  → quote lands on ₹1`);
        step(`package_itineraries day 1 + itinerary_stays → the test room above (1 night, no meals)`);
        console.log("\n  Re-run with --commit to apply.\n");
        return;
    }

    // ── Hotel ────────────────────────────────────────────────────────────────
    const hotel = await db.hotels.upsert({
        where: { slug: HOTEL_SLUG },
        create: {
            name: HOTEL_NAME,
            slug: HOTEL_SLUG,
            city: "Test City",
            state: "Test State",
            address: "Internal payment-testing property — not a real hotel",
            check_in_time: "12:00",
            check_out_time: "11:00",
            star_rating: 3,
            // Hidden from search/listings (`listing_status: LIVE` is the gate) and
            // from facet queries (`is_active`), reachable only by direct slug URL.
            listing_status: "DRAFT",
            is_active: false,
            // Not used by the hotel-booking total (which sums nightly rates
            // directly), but zeroed so no display path can inflate the ₹1.
            margin_percentage: 0,
            gst_percentage: 0,
        },
        update: { name: HOTEL_NAME, listing_status: "DRAFT", is_active: false, margin_percentage: 0, gst_percentage: 0 },
        select: { id: true },
    });
    step(`hotels #${hotel.id}`);

    // hotel_rooms has no composite unique on (hotel_id, slug), so find-then-write.
    const existingRoom = await db.hotel_rooms.findFirst({
        where: { hotel_id: hotel.id, slug: ROOM_SLUG },
        select: { id: true },
    });
    const roomData = {
        name: "Test Room",
        // Availability rows are auto-provisioned from num_rooms on first quote
        // (see ensureAvailability), so no hotel_room_availability seeding needed.
        num_rooms: 5,
        max_occupancy: 2,
        max_adults: 2,
        max_children: 1,
        base_adults: 2,
        base_children: 0,
        // Zero extra beds keeps the quote at a flat ₹1 — a mattress top-up would
        // otherwise make the total depend on headcount.
        extra_bed_capacity: 0,
        is_active: true,
        is_bookable: true,
    };
    const room = existingRoom
        ? await db.hotel_rooms.update({ where: { id: existingRoom.id }, data: roomData, select: { id: true } })
        : await db.hotel_rooms.create({
              data: { ...roomData, hotel_id: hotel.id, slug: ROOM_SLUG },
              select: { id: true },
          });
    step(`hotel_rooms #${room.id}`);

    const existingRate = await db.hotel_room_pricing.findFirst({
        where: { room_id: room.id },
        select: { id: true },
    });
    const rateData = {
        plan_name: "Room Only (TEST)",
        // The hotel-booking total is the plain sum of nightly rates — no margin
        // or GST is applied at booking time — so ₹1/night ⇒ a ₹1 one-night stay.
        price_per_night: "1.00",
        extra_bed_rate: "0.00",
        margin_percentage: 0,
        gst_percentage: 0,
        is_active: true,
        sort_order: 0,
    };
    const rate = existingRate
        ? await db.hotel_room_pricing.update({ where: { id: existingRate.id }, data: rateData, select: { id: true } })
        : await db.hotel_room_pricing.create({
              data: { ...rateData, hotel_id: hotel.id, room_id: room.id },
              select: { id: true },
          });
    step(`hotel_room_pricing #${rate.id} @ ₹1/night`);

    // ── Package ──────────────────────────────────────────────────────────────
    const pkg = await db.packages.upsert({
        where: { slug: PACKAGE_SLUG },
        create: {
            title: PACKAGE_TITLE,
            slug: PACKAGE_SLUG,
            description: "Internal payment-gateway test package. Not for sale.",
            destination_id: destination.id,
            thumbnail: donor?.thumbnail ?? null,
            inclusions: ["Nothing — this is a payment test"],
            exclusions: ["Everything"],
            // MUST stay true: the quote page's own fetch (fetchPackagePageData)
            // filters on it, so is_active=false makes the package unbookable, not
            // merely unlisted. Discovery is suppressed separately, by slug — see
            // app/lib/packages/internal-skus.ts.
            is_active: true,
        },
        update: { title: PACKAGE_TITLE, is_active: true, thumbnail: donor?.thumbnail ?? null },
        select: { id: true },
    });
    step(`packages #${pkg.id}`);

    const duration = await db.package_durations.upsert({
        where: { package_id_slug: { package_id: pkg.id, slug: DURATION_SLUG } },
        create: { package_id: pkg.id, slug: DURATION_SLUG, label: "1 Night 2 Days", days: 2, nights: 1, is_default: true, is_active: true },
        update: { label: "1 Night 2 Days", days: 2, nights: 1, is_default: true, is_active: true },
        select: { id: true },
    });
    step(`package_durations #${duration.id}`);

    const route = await db.package_routes.upsert({
        where: { duration_id_slug: { duration_id: duration.id, slug: ROUTE_SLUG } },
        create: { duration_id: duration.id, slug: ROUTE_SLUG, name: "Test Route", is_active: true },
        update: { name: "Test Route", is_active: true },
        select: { id: true },
    });
    step(`package_routes #${route.id}`);

    const stayCategory = await db.package_stay_categories.upsert({
        where: { package_id_slug: { package_id: pkg.id, slug: STAY_SLUG } },
        create: { package_id: pkg.id, slug: STAY_SLUG, label: "Test Stay", is_default: true, is_active: true },
        update: { label: "Test Stay", is_default: true, is_active: true },
        select: { id: true },
    });
    step(`package_stay_categories #${stayCategory.id}`);

    // margin 0 / gst 0 is what pins the quote to exactly ₹1. Without this row the
    // engine falls back to its 10% margin + 5% GST defaults and a ₹1 base would
    // quote as ₹3 (each step rounds up to a whole rupee).
    await db.package_pricing.upsert({
        where: {
            package_id_duration_id_stay_category_id: {
                package_id: pkg.id, duration_id: duration.id, stay_category_id: stayCategory.id,
            },
        },
        create: { package_id: pkg.id, duration_id: duration.id, stay_category_id: stayCategory.id, margin_percentage: 0, gst_percentage: 0 },
        update: { margin_percentage: 0, gst_percentage: 0 },
    });
    step("package_pricing margin=0% gst=0%");

    const itinerary = await db.package_itineraries.upsert({
        where: {
            package_id_duration_id_route_id_day: {
                package_id: pkg.id, duration_id: duration.id, route_id: route.id, day: 1,
            },
        },
        create: {
            package_id: pkg.id, duration_id: duration.id, route_id: route.id, day: 1,
            title: "Test Day", description: "Payment gateway test itinerary.", meals: [],
        },
        update: { title: "Test Day" },
        select: { id: true },
    });
    step(`package_itineraries #${itinerary.id}`);

    // The stay points at the ₹1 hotel rate above, so the package's entire base
    // cost is that single ₹1 night. `active_meals: []` keeps meal cost at zero;
    // no cab types or permits are seeded, so those subtotals stay zero too.
    await db.itinerary_stays.upsert({
        where: { itinerary_id_stay_category_id: { itinerary_id: itinerary.id, stay_category_id: stayCategory.id } },
        create: {
            itinerary_id: itinerary.id, stay_category_id: stayCategory.id, room_pricing_id: rate.id,
            occupancy: 2, rooms_count: 1, num_nights: 1, active_meals: [],
        },
        update: { room_pricing_id: rate.id, num_nights: 1, active_meals: [] },
    });
    step("itinerary_stays → ₹1 room rate");

    console.log(`
  Done. Both SKUs are live but unlisted:

    Hotel    /hotels/${HOTEL_SLUG}
    Package  /packages/${PACKAGE_SLUG}/${DURATION_SLUG}

  Verify pricing with:  npm run verify:test-skus
`);
}

main()
    .catch((e) => { console.error("\nseed-test-payment-skus failed:", e); process.exit(1); })
    .finally(() => db.$disconnect());
