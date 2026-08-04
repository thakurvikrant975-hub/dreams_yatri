/**
 * Verify the seeded ₹1 test SKUs are configured to price out at exactly ₹1.
 *
 * This checks every input the two pricing engines actually read, rather than
 * calling them directly — `computePackagePrice` and `getStayQuote` both import
 * `app/lib/db.ts`, which a tsx script can't load (see scripts/_db.ts). Each
 * assertion below names the engine behaviour it protects, so the checks stay
 * meaningful rather than just restating the seed.
 *
 * The authoritative confirmation is still the browser: load the two URLs printed
 * at the end and check the quoted price reads ₹1 before paying anything.
 *
 * Run:  npm run verify:test-skus
 */
import { db, dbTarget } from "./_db";
import { computePaymentSchedule } from "../app/services/payment-policy/engine";
import { rupeesToPaise } from "../app/lib/money";

const HOTEL_SLUG = "test-payment-property";
const PACKAGE_SLUG = "test-payment-package";
const DURATION_SLUG = "1n-2d";

let failures = 0;

function check(ok: boolean, label: string, detail = "") {
    if (!ok) failures++;
    console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? `  — ${detail}` : ""}`);
}

async function main() {
    console.log(`\n▸ Verifying ₹1 test SKUs\n  target: ${dbTarget}\n`);

    // ── Hotel: getStayQuote sums each night's rate with no margin/GST layer, so
    // all that matters is that the first active plan is ₹1/night and nothing
    // (season, occupancy tier, date override) can move it. ────────────────────
    const hotel = await db.hotels.findUnique({
        where: { slug: HOTEL_SLUG },
        select: {
            id: true, listing_status: true, is_active: true,
            meal_pricing: { where: { is_active: true }, select: { id: true } },
            hotelRooms: {
                select: {
                    id: true, is_active: true, is_bookable: true, num_rooms: true,
                    pricing: {
                        where: { is_active: true },
                        orderBy: { sort_order: "asc" },
                        select: {
                            id: true, price_per_night: true, extra_bed_rate: true,
                            occupancy_prices: { select: { id: true } },
                            seasons: { where: { is_active: true }, select: { id: true } },
                        },
                    },
                },
            },
        },
    });
    if (!hotel) throw new Error(`Hotel '${HOTEL_SLUG}' not found — run: npm run seed:test-skus -- --commit`);

    const room = hotel.hotelRooms[0];
    const rate = room?.pricing[0];
    if (!room || !rate) throw new Error("Test hotel has no active room + rate.");

    console.log("Hotel");
    check(Number(rate.price_per_night) === 1, "rate is ₹1/night", "getStayQuote sums nightly rates verbatim → 1 night = ₹1");
    check(rate.seasons.length === 0, "no seasonal rates", "a season would override the ₹1 base");
    check(rate.occupancy_prices.length === 0, "no occupancy tiers", "a tier would replace the base rate per headcount");
    check(Number(rate.extra_bed_rate ?? 0) === 0, "extra-bed rate is ₹0", "keeps the total independent of headcount");
    check(room.is_active && room.is_bookable, "room is active + bookable", "both checked by createHotelBooking");
    check(room.num_rooms >= 1, `num_rooms = ${room.num_rooms}`, "availability rows auto-provision from this");
    check(hotel.listing_status === "DRAFT" && !hotel.is_active, "hidden from search + listings", `listing_status=${hotel.listing_status}, is_active=${hotel.is_active}`);

    // A stale price_override on an availability row silently wins over the plan
    // rate (getRoomARI prefers any override > 0), so make sure none exist.
    const overrides = await db.hotel_room_availability.count({
        where: { room_id: room.id, price_override: { not: null } },
    });
    check(overrides === 0, "no per-date price overrides", "an override outranks the plan rate");

    // ── Package: final = ceil(base + margin) + gst, where base sums hotel +
    // meals + activities + cabs + permits. Everything but the ₹1 hotel night
    // must be zero, and margin/GST must be 0% or each rounds the total up. ────
    const pkg = await db.packages.findUnique({
        where: { slug: PACKAGE_SLUG },
        select: {
            id: true, is_active: true,
            durations: {
                where: { slug: DURATION_SLUG },
                select: {
                    id: true,
                    cabTypes: { where: { is_active: true }, select: { id: true } },
                    permits: { where: { is_included: true }, select: { id: true } },
                    routes: { where: { is_active: true }, select: { id: true } },
                },
            },
            stay_categories: { where: { is_active: true }, select: { id: true } },
            packagePricings: { select: { margin_percentage: true, gst_percentage: true } },
        },
    });
    if (!pkg) throw new Error(`Package '${PACKAGE_SLUG}' not found — run: npm run seed:test-skus -- --commit`);

    const duration = pkg.durations[0];
    const pricing = pkg.packagePricings[0];
    if (!duration) throw new Error(`Package has no active duration '${DURATION_SLUG}'.`);

    const itineraries = await db.package_itineraries.findMany({
        where: { package_id: pkg.id, duration_id: duration.id },
        select: {
            id: true,
            itinerary_activities: { select: { is_optional: true } },
            itineraryStays: { select: { room_pricing_id: true, num_nights: true, active_meals: true } },
        },
    });
    const stays = itineraries.flatMap((i) => i.itineraryStays);
    const mandatoryActivities = itineraries.reduce(
        (n, i) => n + i.itinerary_activities.filter((a) => !a.is_optional).length, 0,
    );
    const hotelNights = stays.reduce((n, s) => n + s.num_nights, 0);

    console.log("\nPackage");
    check(!!pricing, "package_pricing row exists", "missing ⇒ engine defaults to 10% margin + 5% GST");
    check(!!pricing && Number(pricing.margin_percentage) === 0, "margin = 0%", "any margin rounds ₹1 up by at least ₹1");
    check(!!pricing && Number(pricing.gst_percentage) === 0, "GST = 0%", "same rounding applies to GST");
    check(duration.routes.length > 0, "duration has an active route", "required to reach the quote page");
    check(pkg.stay_categories.length > 0, "package has an active stay category");
    check(stays.length === 1 && hotelNights === 1, "exactly one stay night", `found ${stays.length} stay(s), ${hotelNights} night(s)`);
    check(stays.every((s) => s.room_pricing_id === rate.id), "stay points at the ₹1 room rate");
    check(stays.every((s) => s.active_meals.length === 0), "no meals on the stay", "meals bill per person and would break ₹1");
    check(hotel.meal_pricing.length === 0, "test hotel has no meal pricing rows");
    check(mandatoryActivities === 0, "no mandatory activities");
    check(duration.cabTypes.length === 0, "no cab types", "cab cost is added per day");
    check(duration.permits.length === 0, "no included permits");
    check(!pkg.is_active, "hidden from listings", `is_active=${pkg.is_active}`);

    console.log(`\n  → package quote should read ₹${Math.ceil(1 * hotelNights)} (hotel-only base, 0% margin, 0% GST)`);

    // ── Payment schedule ─────────────────────────────────────────────────────
    const schedule = computePaymentSchedule({
        totalPaise: rupeesToPaise("1.00"),
        travelDate: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
    });
    console.log(`\nPayment schedule for ₹1 (travel 30 days out)`);
    console.log(`  plan=${schedule.plan}  reason=${schedule.reason}`);
    console.log(`  legs: ${schedule.installments.map((l) => `${l.type} ₹${l.amountPaise / 100}`).join(", ")}`);
    if (schedule.plan === "FULL") {
        console.log("\n  NOTE: the ₹10,000 minimum-deposit floor collapses a ₹1 total to one FULL");
        console.log("        leg, so these SKUs cannot exercise the DEPOSIT → balance-payment flow.");
    }

    console.log(`
  URLs to test (unlisted — direct access only):
    /hotels/${HOTEL_SLUG}
    /packages/${PACKAGE_SLUG}/${DURATION_SLUG}
`);
    console.log(failures === 0 ? "✓ All checks passed\n" : `✗ ${failures} check(s) FAILED\n`);
    if (failures > 0) process.exit(1);
}

main()
    .catch((e) => { console.error("\nverify-test-payment-skus failed:", e); process.exit(1); })
    .finally(() => db.$disconnect());
