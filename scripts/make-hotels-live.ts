/**
 * One-off: publish dashboard-created hotels to the frontend hotel engine.
 *
 * The engine's listing query (`searchHotels` in app/(website)/hotels/[slug]/booking-data.ts)
 * gates on `listing_status = 'LIVE'`. Every hotel created from /dashboard/hotels
 * defaults to DRAFT, so none of them ever appeared in search even though the
 * detail page, quoting, availability and reservation paths are all owner-agnostic
 * and already work for them.
 *
 * Scope — deliberately NOT "every row in the table":
 *   • owner_id IS NULL  → dashboard-created stock only. Hotels linked to a Hotel
 *     Connect owner keep their own submit/approve workflow; flipping those would
 *     publish properties whose owners never submitted them.
 *   • is_active = true  → is_active is the soft-delete flag; deleted hotels stay hidden.
 *
 * Writes a rollback snapshot (id + previous listing_status) next to the script
 * before touching anything. Re-running is a no-op for rows already LIVE.
 *
 * Usage:
 *   npx tsx --env-file=.env.development.local scripts/make-hotels-live.ts --dry-run
 *   npx tsx --env-file=.env.development.local scripts/make-hotels-live.ts --apply
 *   npx tsx --env-file=.env.production.local  scripts/make-hotels-live.ts --apply
 */
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

const TARGET = `owner_id IS NULL AND is_active = true AND listing_status <> 'LIVE'`;

async function main() {
  console.log(`\n  DB: ${tag}`);
  console.log(`  Mode: ${APPLY ? "APPLY" : "DRY RUN"}\n`);

  const { rows: before } = await pool.query(`
    SELECT COUNT(*)::int total,
      COUNT(*) FILTER (WHERE listing_status = 'LIVE')::int live,
      COUNT(*) FILTER (WHERE ${TARGET})::int to_flip
    FROM hotels`);
  console.log(`  Before:  ${before[0].total} hotels, ${before[0].live} LIVE`);
  console.log(`  Target:  ${before[0].to_flip} to flip -> LIVE\n`);

  if (before[0].to_flip === 0) {
    console.log("  Nothing to do.\n");
    return;
  }

  // Rollback snapshot — captured even on a dry run so the exact target set is
  // reviewable before applying.
  const { rows: snapshot } = await pool.query(
    `SELECT id, listing_status::text AS listing_status FROM hotels WHERE ${TARGET} ORDER BY id`,
  );
  const snapPath = join(process.cwd(), `hotel-live-rollback.${tag}.json`);
  writeFileSync(snapPath, JSON.stringify({ db: tag, at: new Date().toISOString(), rows: snapshot }, null, 2));
  console.log(`  Rollback snapshot -> ${snapPath} (${snapshot.length} rows)`);

  if (!APPLY) {
    console.log("\n  Dry run — no changes written. Re-run with --apply.\n");
    return;
  }

  // approved_at/submitted_at are backfilled so the row is internally consistent
  // with what LIVE means everywhere else that reads these columns.
  const res = await pool.query(`
    UPDATE hotels
    SET listing_status = 'LIVE',
        submitted_at = COALESCE(submitted_at, now()),
        approved_at  = COALESCE(approved_at,  now()),
        updated_at   = now()
    WHERE ${TARGET}`);
  console.log(`  Updated: ${res.rowCount} rows`);

  const { rows: after } = await pool.query(`
    SELECT COUNT(*)::int total,
      COUNT(*) FILTER (WHERE listing_status = 'LIVE')::int live,
      COUNT(*) FILTER (WHERE listing_status = 'LIVE' AND owner_id IS NULL)::int live_unowned
    FROM hotels`);
  console.log(`  After:   ${after[0].live} LIVE of ${after[0].total} (${after[0].live_unowned} dashboard-created)`);

  // How many of the now-live rows can actually be quoted end-to-end.
  const { rows: sellable } = await pool.query(`
    SELECT COUNT(*)::int n FROM hotels h
    WHERE h.listing_status = 'LIVE' AND h.owner_id IS NULL
      AND EXISTS (SELECT 1 FROM hotel_rooms r WHERE r.hotel_id = h.id AND r.is_active AND r.is_bookable)
      AND EXISTS (SELECT 1 FROM hotel_room_pricing p WHERE p.hotel_id = h.id AND p.is_active AND p.price_per_night > 0)`);
  console.log(`  Of those, ${sellable[0].n} have a bookable room with a live price.\n`);
}

main()
  .catch((e) => { console.error("FAILED:", e.message); process.exitCode = 1; })
  .finally(() => pool.end());
