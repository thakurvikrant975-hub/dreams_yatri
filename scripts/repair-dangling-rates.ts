/**
 * One-off: clear roomPricingId values pointing at rates that no longer exist.
 *
 * custom_itineraries.roomPricingId and custom_itinerary_stays.roomPricingId
 * reference hotel_room_pricing with no foreign key behind them, so deleting a
 * rate leaves the id sitting on the day and nothing objects. Pricing then looked
 * the id up, found nothing, and — before the fix in package-pricing.service.ts —
 * pushed no line at all: the night silently cost ₹0 and did not appear in the
 * breakdown, on packages already READY and SENT.
 *
 * The code now falls through to the day's manual price, or to a visible ₹0 gap
 * line when there isn't one. This makes the stored row agree with that: a
 * pointer to nothing becomes null, so the fallback is what the data says rather
 * than something the reader has to infer.
 *
 * It does NOT guess a replacement rate. The hotel name on the day is a snapshot
 * and several hotels carry more than one rate; picking one would be inventing a
 * price. Nights left with no price at all are listed at the end for a human.
 *
 * Usage:
 *   npx tsx --env-file=.env.development.local scripts/repair-dangling-rates.ts
 *   npx tsx --env-file=.env.production.local  scripts/repair-dangling-rates.ts --apply
 */
import dns from "dns";
import net from "net";
dns.setDefaultResultOrder("ipv4first");
net.setDefaultAutoSelectFamily(false);
import pg from "pg";
import { writeFileSync } from "fs";
import { join } from "path";

const APPLY = process.argv.includes("--apply");
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

const DANGLING_DAYS = `
  FROM custom_itineraries ci
  WHERE ci."roomPricingId" IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM hotel_room_pricing r WHERE r.id = ci."roomPricingId")`;
const DANGLING_STAYS = `
  FROM custom_itinerary_stays s
  WHERE s."roomPricingId" IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM hotel_room_pricing r WHERE r.id = s."roomPricingId")`;

async function main() {
  console.log(`\n  DB:   ${tag}`);
  console.log(`  Mode: ${APPLY ? "APPLY" : "DRY RUN"}\n`);

  const { rows: days } = await pool.query(`
    SELECT ci.id, ci.day, ci."roomPricingId" AS rate, ci."manualHotelPricePerNight" AS manual,
           left(ci.accommodation, 30) AS hotel, cp.title, cp.status::text AS status
    ${DANGLING_DAYS.replace("FROM custom_itineraries ci", "FROM custom_itineraries ci JOIN custom_packages cp ON cp.id = ci.\"customPackageId\"")}
    ORDER BY cp."updatedAt" DESC`);
  const { rows: stays } = await pool.query(`SELECT s.id, s."roomPricingId" AS rate ${DANGLING_STAYS}`);

  if (days.length === 0 && stays.length === 0) {
    console.log("  Nothing to repair — every stored rate id resolves.\n");
    return;
  }

  console.log(`  ${days.length} day row(s) and ${stays.length} stay row(s) point at a rate that is gone.\n`);
  console.table(days.slice(0, 12).map((r) => ({
    package: String(r.title).slice(0, 28), status: r.status, day: r.day,
    missing_rate: r.rate, hotel: r.hotel,
    after: r.manual != null ? `prices at ₹${r.manual}` : "shows as an unpriced night",
  })));
  if (days.length > 12) console.log(`  …and ${days.length - 12} more.`);

  const recovered = days.filter((r) => r.manual != null).length;
  console.log(`\n  ${recovered} night(s) recover a real price from their manual rate; ${days.length - recovered} become visibly unpriced instead of silently ₹0.`);

  const snapPath = join(process.cwd(), `dangling-rates-rollback.${tag}.json`);
  writeFileSync(snapPath, JSON.stringify({ db: tag, at: new Date().toISOString(), days, stays }, null, 2));
  console.log(`  Rollback snapshot -> ${snapPath}`);

  if (!APPLY) {
    console.log("\n  Dry run — nothing written. Re-run with --apply.\n");
    return;
  }

  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const d = await c.query(`UPDATE custom_itineraries ci SET "roomPricingId" = NULL ${DANGLING_DAYS.replace("FROM custom_itineraries ci\n  WHERE", "WHERE")}`);
    const s = await c.query(`UPDATE custom_itinerary_stays s SET "roomPricingId" = NULL ${DANGLING_STAYS.replace("FROM custom_itinerary_stays s\n  WHERE", "WHERE")}`);
    await c.query("COMMIT");
    console.log(`\n  Cleared ${d.rowCount} day row(s) and ${s.rowCount} stay row(s).`);
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }

  const { rows: left } = await pool.query(`SELECT COUNT(*)::int n ${DANGLING_DAYS}`);
  console.log(`  Day rows still dangling: ${left[0].n}\n`);
}

main()
  .catch((e) => { console.error("FAILED:", e.message); process.exitCode = 1; })
  .finally(() => pool.end());
