/**
 * One-off: put a price back on nights the hotel team filled but costing values at ₹0.
 *
 * Costing prices a package from its stay options (custom_itinerary_stays), while
 * fillPendingHotel only ever wrote the day rows (custom_itineraries). The two
 * only converged when an exec happened to re-save the package in the builder,
 * which is precisely what a fill that auto-advances to costing skips — so a
 * filled night could reach the costing manager with no rate, no manual price and
 * no override, and be added up as nothing.
 *
 * fillPendingHotel now syncs on the way out. This repairs what it wrote before
 * that, by copying the day row's hotel columns onto the recommended option's
 * stay row — the same direction, and the same STAY_FIELDS list,
 * syncRecommendedStayFromDays uses.
 *
 * Scope is deliberately narrow: only stay rows on the recommended option, only
 * where the day was actually filled by the hotel team (hotelFilledAt set), and
 * only where the stay row has NO price of any kind. A stay row carrying its own
 * price is an exec's deliberate choice for that option and is never touched.
 *
 * Usage:
 *   npx tsx --env-file=.env.development.local scripts/repair-unsynced-stays.ts
 *   npx tsx --env-file=.env.development.local scripts/repair-unsynced-stays.ts --apply
 *   npx tsx --env-file=.env.production.local  scripts/repair-unsynced-stays.ts --apply
 */
import dns from "dns";
import net from "net";
dns.setDefaultResultOrder("ipv4first");
net.setDefaultAutoSelectFamily(false);
import pg from "pg";
import { writeFileSync } from "fs";
import { join } from "path";

const APPLY = process.argv.includes("--apply");

/** Mirrors STAY_FIELDS in package-builder/stay-options.sync.ts. */
const STAY_FIELDS = [
  "accommodation", "accommodationPhoto", "accommodationRoomPhotos", "accommodationLocation",
  "accommodationRoomSpecs", "accommodationStarRating", "accommodationRoomCapacity",
  "accommodationMaxAdults", "accommodationMaxChildren", "accommodationExtraBedCapacity",
  "roomPricingId", "roomsCount", "extraRooms", "hotelCheckIn", "hotelCheckOut", "hotelMealPlan",
  "manualHotelPricePerNight", "manualExtraBeds", "manualExtraBedRate", "hotelPriceOverride",
  "hotelPending", "hotelPendingNote",
];

const url = new URL(process.env.DATABASE_URL!);
const tag = url.hostname.split(".")[0];
const pool = new pg.Pool({
  host: url.hostname,
  port: parseInt(url.port) || 5432,
  database: url.pathname.slice(1),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  ssl: { rejectUnauthorized: false, servername: url.hostname },
});

const TARGET = `
  FROM custom_itinerary_stays s
  JOIN custom_package_stay_options so ON so.id = s."stayOptionId" AND so."isRecommended" = true
  JOIN custom_itineraries ci ON ci.id = s."itineraryId"
  JOIN custom_packages cp ON cp.id = ci."customPackageId"
  WHERE ci."hotelFilledAt" IS NOT NULL
    AND s."roomPricingId" IS NULL
    AND s."manualHotelPricePerNight" IS NULL
    AND s."hotelPriceOverride" IS NULL
    AND (ci."roomPricingId" IS NOT NULL OR ci."manualHotelPricePerNight" IS NOT NULL)`;

async function main() {
  console.log(`\n  DB:   ${tag}`);
  console.log(`  Mode: ${APPLY ? "APPLY" : "DRY RUN"}\n`);

  const { rows: affected } = await pool.query(`
    SELECT s.id AS stay_id, ci.id AS day_id, ci.day, cp.title, cp.id AS package_id,
           ci.accommodation, ci."manualHotelPricePerNight" AS price, ci."roomPricingId" AS rate
    ${TARGET}
    ORDER BY cp.title, ci.day`);

  if (affected.length === 0) {
    console.log("  Nothing to repair — every filled night already carries a price.\n");
    return;
  }

  console.log(`  ${affected.length} night(s) filled by the hotel team but priced at ₹0 in costing:\n`);
  console.table(affected.map((r) => ({
    package: String(r.title).slice(0, 30), day: r.day,
    hotel: String(r.accommodation ?? "").slice(0, 28),
    day_price: r.price, day_rate: r.rate,
  })));

  const snapPath = join(process.cwd(), `unsynced-stays-rollback.${tag}.json`);
  writeFileSync(snapPath, JSON.stringify({ db: tag, at: new Date().toISOString(), rows: affected }, null, 2));
  console.log(`\n  Rollback snapshot -> ${snapPath}`);

  if (!APPLY) {
    console.log("\n  Dry run — nothing written. Re-run with --apply.\n");
    return;
  }

  const sets = STAY_FIELDS.map((f) => `"${f}" = ci."${f}"`).join(", ");
  const res = await pool.query(`
    UPDATE custom_itinerary_stays s
    SET ${sets}
    FROM custom_itineraries ci, custom_package_stay_options so
    WHERE ci.id = s."itineraryId"
      AND so.id = s."stayOptionId" AND so."isRecommended" = true
      AND ci."hotelFilledAt" IS NOT NULL
      AND s."roomPricingId" IS NULL
      AND s."manualHotelPricePerNight" IS NULL
      AND s."hotelPriceOverride" IS NULL
      AND (ci."roomPricingId" IS NOT NULL OR ci."manualHotelPricePerNight" IS NOT NULL)`);
  console.log(`\n  Repaired ${res.rowCount} stay row(s).`);

  const { rows: left } = await pool.query(`SELECT COUNT(*)::int n ${TARGET}`);
  console.log(`  Still unpriced after the repair: ${left[0].n}\n`);
}

main()
  .catch((e) => { console.error("FAILED:", e.message); process.exitCode = 1; })
  .finally(() => pool.end());
