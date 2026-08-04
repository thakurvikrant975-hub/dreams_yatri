/**
 * Remove everything clone-test-skus.ts created.
 *
 * Deletes strictly what the manifest recorded, walked in reverse creation order
 * so children go before the parents they reference. It never matches on name or
 * slug: a good clone is indistinguishable from real inventory by design, so
 * pattern-matching is exactly how you would eventually delete a live package. No
 * manifest ⇒ refuse, don't guess.
 *
 * Bookings are never touched. If a test booking exists against the cloned
 * package or its hotels, teardown stops and says so — the booking history is the
 * point of the exercise, and cascading through it would destroy the evidence you
 * created the clone to gather. Cancel or reassign those bookings first.
 *
 * Run:  npm run teardown:test-clone              (dry run)
 *       npm run teardown:test-clone -- --commit
 */
import { db, dbTarget } from "./_db";
import { readManifest, manifestPath, type ClonedModel, type ClonedRow } from "./test-clone-registry";
import { writeFileSync } from "fs";

const COMMIT = process.argv.includes("--commit");

type Deleter = (id: string | number) => Promise<unknown>;

/** Explicit map rather than dynamic indexing, so an unknown model can't be executed. */
const DELETERS: Record<ClonedModel, Deleter> = {
    itinerary_transfers:          (id) => db.itinerary_transfers.delete({ where: { id: Number(id) } }),
    itinerary_attractions:        (id) => db.itinerary_attractions.delete({ where: { id: Number(id) } }),
    itinerary_activities:         (id) => db.itinerary_activities.delete({ where: { id: Number(id) } }),
    itinerary_stays:              (id) => db.itinerary_stays.delete({ where: { id: Number(id) } }),
    package_itineraries:          (id) => db.package_itineraries.delete({ where: { id: Number(id) } }),
    package_pricing:              (id) => db.package_pricing.delete({ where: { id: Number(id) } }),
    package_stay_categories:      (id) => db.package_stay_categories.delete({ where: { id: Number(id) } }),
    package_permits:              (id) => db.package_permits.delete({ where: { id: Number(id) } }),
    package_cab_segments:         (id) => db.package_cab_segments.delete({ where: { id: Number(id) } }),
    package_cab_types:            (id) => db.package_cab_types.delete({ where: { id: Number(id) } }),
    route_stops:                  (id) => db.route_stops.delete({ where: { id: Number(id) } }),
    package_routes:               (id) => db.package_routes.delete({ where: { id: Number(id) } }),
    package_durations:            (id) => db.package_durations.delete({ where: { id: Number(id) } }),
    package_gallery:              (id) => db.package_gallery.delete({ where: { id: Number(id) } }),
    package_images:               (id) => db.package_images.delete({ where: { id: Number(id) } }),
    packages:                     (id) => db.packages.delete({ where: { id: Number(id) } }),
    activity_variants:            (id) => db.activity_variants.delete({ where: { id: Number(id) } }),
    activities:                   (id) => db.activities.delete({ where: { id: Number(id) } }),
    cab_pricing:                  (id) => db.cab_pricing.delete({ where: { id: Number(id) } }),
    hotel_room_occupancy_prices:  (id) => db.hotel_room_occupancy_prices.delete({ where: { id: Number(id) } }),
    hotel_room_pricing:           (id) => db.hotel_room_pricing.delete({ where: { id: Number(id) } }),
    hotel_images:                 (id) => db.hotel_images.delete({ where: { id: Number(id) } }),
    hotel_meal_pricing:           (id) => db.hotel_meal_pricing.delete({ where: { id: Number(id) } }),
    hotel_rooms:                  (id) => db.hotel_rooms.delete({ where: { id: Number(id) } }),
    hotels:                       (id) => db.hotels.delete({ where: { id: Number(id) } }),
};

async function main() {
    console.log(
        COMMIT
            ? "\n▸ Removing test clone (COMMIT — deleting rows)"
            : "\n▸ Removing test clone (DRY RUN — pass --commit to delete)",
    );
    console.log(`  target: ${dbTarget}`);

    const manifest = readManifest();
    if (!manifest) {
        console.error(`\n  No manifest at ${manifestPath()} — nothing to remove.`);
        console.error("  Teardown only deletes rows it has a record of creating; it will not");
        console.error("  guess from slugs, since a clone looks exactly like real inventory.\n");
        process.exit(1);
    }

    const pkgIds = manifest.entries.filter((e) => e.model === "packages").map((e) => Number(e.id));
    const hotelIds = manifest.entries.filter((e) => e.model === "hotels").map((e) => Number(e.id));

    // ── Refuse if any booking references the clone ───────────────────────────
    const [pkgBookings, hotelBookings] = await Promise.all([
        pkgIds.length ? db.booking.count({ where: { packageId: { in: pkgIds } } }) : 0,
        hotelIds.length ? db.bookingHotel.count({ where: { hotelId: { in: hotelIds } } }) : 0,
    ]);

    if (pkgBookings > 0 || hotelBookings > 0) {
        console.error(`\n  Refusing to delete — bookings reference this clone:`);
        console.error(`    ${pkgBookings} booking(s) on the cloned package`);
        console.error(`    ${hotelBookings} hotel leg(s) on the cloned hotels`);
        console.error(`\n  Those bookings are the record of your test run. Deleting the clone`);
        console.error(`  would take their itinerary and pricing with it. Remove the bookings`);
        console.error(`  first if you genuinely want the clone gone.\n`);
        process.exit(1);
    }

    const byModel = manifest.entries.reduce<Record<string, number>>((acc, e) => {
        acc[e.model] = (acc[e.model] ?? 0) + 1;
        return acc;
    }, {});
    console.log(`\n  Manifest: ${manifest.entries.length} row(s), cloned from ${manifest.source.packageSlug ?? "?"} on ${manifest.createdAt.slice(0, 10)}`);
    for (const [model, n] of Object.entries(byModel).sort()) console.log(`    ${String(n).padStart(4)}  ${model}`);

    if (!COMMIT) {
        console.log("\n  Re-run with --commit to delete.\n");
        return;
    }

    // Reverse creation order: children before the parents they point at.
    let deleted = 0;
    let missing = 0;
    const failed: { row: ClonedRow; error: string }[] = [];

    for (const row of [...manifest.entries].reverse()) {
        const del = DELETERS[row.model];
        if (!del) { failed.push({ row, error: "no deleter registered" }); continue; }
        try {
            await del(row.id);
            deleted++;
        } catch (e) {
            // Already gone (P2025) is success — teardown must be re-runnable.
            if (typeof e === "object" && e !== null && (e as { code?: string }).code === "P2025") { missing++; continue; }
            failed.push({ row, error: e instanceof Error ? e.message.split("\n")[0] : String(e) });
        }
    }

    console.log(`\n  deleted: ${deleted}   already gone: ${missing}   failed: ${failed.length}`);
    if (failed.length) {
        for (const f of failed.slice(0, 10)) console.error(`    ✗ ${f.row.model} #${f.row.id} — ${f.error}`);
        console.error("\n  Manifest kept so the remaining rows can be retried.\n");
        process.exit(1);
    }

    // Only clear the manifest once everything in it is genuinely gone.
    writeFileSync(manifestPath(), JSON.stringify({ source: manifest.source, createdAt: manifest.createdAt, entries: [] }, null, 2) + "\n");
    console.log("  Manifest cleared — clone fully removed.\n");
}

main()
    .catch((e) => { console.error("\nteardown-test-clone failed:", e); process.exit(1); })
    .finally(() => db.$disconnect());
