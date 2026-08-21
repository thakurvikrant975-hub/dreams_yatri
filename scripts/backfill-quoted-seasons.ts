/**
 * One-off: give quick-created rates the season their quoted window describes.
 *
 * A rate created from a hotel request carried only a base price, and
 * markPackageReady refuses any night priced off a base rate — see
 * baseRatePricingError. So the hotel team filled the request and the exec was
 * then blocked from submitting, by two of our own rules disagreeing.
 *
 * The fill already recorded the window it was quoted for, in
 * hotel_room_pricing.valid_from/valid_to and in the provenance note. This turns
 * that window into a season carrying the same price, which is what it always
 * described — nothing is invented. quickCreateHotelRate now does this at the
 * point of creation; this is for the rates written before it did.
 *
 * Only touches rates whose notes mark them as request-created, that carry both
 * dates, and that have no season yet.
 *
 * Usage:
 *   npx tsx --env-file=.env.production.local scripts/backfill-quoted-seasons.ts
 *   npx tsx --env-file=.env.production.local scripts/backfill-quoted-seasons.ts --apply
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
  host: url.hostname, port: parseInt(url.port) || 5432,
  database: url.pathname.slice(1), user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  ssl: { rejectUnauthorized: false, servername: url.hostname },
});

const TARGET = `
  FROM hotel_room_pricing rp
  WHERE rp.notes LIKE 'Added from a hotel request by%'
    AND rp.valid_from IS NOT NULL AND rp.valid_to IS NOT NULL
    AND rp.valid_to >= rp.valid_from
    AND rp.price_per_night > 0
    AND NOT EXISTS (SELECT 1 FROM hotel_room_pricing_seasons s
                    WHERE s.pricing_id = rp.id AND s.is_active)`;

async function main() {
  console.log(`\n  DB:   ${tag}`);
  console.log(`  Mode: ${APPLY ? "APPLY" : "DRY RUN"}\n`);

  const { rows } = await pool.query(`
    SELECT rp.id, rp.hotel_id, rp.price_per_night, rp.weekend_price_per_night,
           rp.extra_bed_rate, rp.valid_from::date AS vf, rp.valid_to::date AS vt,
           (SELECT name FROM hotels h WHERE h.id = rp.hotel_id) AS hotel
    ${TARGET} ORDER BY rp.id`);

  if (rows.length === 0) {
    console.log("  Nothing to backfill — every request-created rate already has a season.\n");
    return;
  }

  const iso = (d: Date) => new Date(d).toISOString().slice(0, 10);
  console.log(`  ${rows.length} rate(s) will gain the season their quoted window already describes:\n`);
  console.table(rows.map((r) => ({
    rate: r.id, hotel: String(r.hotel).slice(0, 28),
    price: r.price_per_night, season: `${iso(r.vf)} to ${iso(r.vt)}`,
  })));

  const snapPath = join(process.cwd(), `quoted-seasons-rollback.${tag}.json`);
  writeFileSync(snapPath, JSON.stringify({ db: tag, at: new Date().toISOString(), rateIds: rows.map((r) => r.id) }, null, 2));
  console.log(`\n  Rollback snapshot -> ${snapPath} (delete the seasons on these rate ids to undo)`);

  if (!APPLY) {
    console.log("\n  Dry run — nothing written. Re-run with --apply.\n");
    return;
  }

  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    for (const r of rows) {
      await c.query(`
        INSERT INTO hotel_room_pricing_seasons
          (pricing_id, season_name, valid_from, valid_to, price_per_night,
           weekend_price_per_night, extra_bed_rate, is_active, sort_order, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true, 0, now(), now())`,
        [r.id, `Quoted ${iso(r.vf)} to ${iso(r.vt)}`, r.vf, r.vt,
         r.price_per_night, r.weekend_price_per_night, r.extra_bed_rate]);
    }
    await c.query("COMMIT");
    console.log(`\n  Added a season to ${rows.length} rate(s).`);
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }

  const { rows: left } = await pool.query(`SELECT COUNT(*)::int n ${TARGET}`);
  console.log(`  Request-created rates still without a season: ${left[0].n}\n`);
}

main()
  .catch((e) => { console.error("FAILED:", e.message); process.exitCode = 1; })
  .finally(() => pool.end());
