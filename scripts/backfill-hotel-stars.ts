/**
 * One-off: populate `hotels.star_rating` from the legacy `stay_type` text.
 *
 * Dashboard-created hotels never filled the integer `star_rating` column — they
 * recorded the tier as free text in `stay_type` ("3 Star", "4 Star", …). The
 * guest-facing star badge, the listing's default sort and the search sidebar's
 * star filter all read `star_rating`, so without this they see NULL for the
 * entire catalogue.
 *
 * Only fills rows where `star_rating IS NULL` — a value someone set explicitly
 * always wins over the parsed text.
 *
 * Usage:
 *   npx tsx --env-file=.env.development.local scripts/backfill-hotel-stars.ts --dry-run
 *   npx tsx --env-file=.env.development.local scripts/backfill-hotel-stars.ts --apply
 *   npx tsx --env-file=.env.production.local  scripts/backfill-hotel-stars.ts --apply
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

// Leading digit of stay_type, accepted only in 1..5. Anything else (NULL,
// "Premium", junk) is left alone rather than guessed at.
const PARSED = `NULLIF(substring(stay_type from '^\\s*([1-5])'), '')::int`;
const TARGET = `star_rating IS NULL AND ${PARSED} IS NOT NULL`;

async function main() {
  console.log(`\n  DB: ${tag}`);
  console.log(`  Mode: ${APPLY ? "APPLY" : "DRY RUN"}\n`);

  const { rows: dist } = await pool.query(`
    SELECT COALESCE(stay_type, '(null)') stay_type, ${PARSED} AS parsed, COUNT(*)::int n
    FROM hotels WHERE star_rating IS NULL
    GROUP BY 1, 2 ORDER BY 3 DESC`);
  console.log("  stay_type -> star_rating mapping (rows with NULL star_rating):");
  for (const r of dist) {
    console.log(`    ${String(r.stay_type).padEnd(14)} -> ${r.parsed ?? "skip"}   ${r.n}`);
  }

  const { rows: before } = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE ${TARGET})::int to_fill,
            COUNT(*) FILTER (WHERE star_rating IS NOT NULL)::int already_set
     FROM hotels`);
  console.log(`\n  To fill: ${before[0].to_fill}   (already set, untouched: ${before[0].already_set})`);

  if (before[0].to_fill === 0) {
    console.log("  Nothing to do.\n");
    return;
  }

  const { rows: snapshot } = await pool.query(`SELECT id FROM hotels WHERE ${TARGET} ORDER BY id`);
  const snapPath = join(process.cwd(), `hotel-stars-rollback.${tag}.json`);
  writeFileSync(snapPath, JSON.stringify({ db: tag, at: new Date().toISOString(), ids: snapshot.map((r) => r.id) }, null, 2));
  console.log(`  Rollback snapshot -> ${snapPath} (${snapshot.length} ids, all previously NULL)`);

  if (!APPLY) {
    console.log("\n  Dry run — no changes written. Re-run with --apply.\n");
    return;
  }

  const res = await pool.query(
    `UPDATE hotels SET star_rating = ${PARSED}, updated_at = now() WHERE ${TARGET}`);
  console.log(`  Updated: ${res.rowCount} rows`);

  const { rows: after } = await pool.query(`
    SELECT star_rating, COUNT(*)::int n FROM hotels WHERE listing_status = 'LIVE'
    GROUP BY 1 ORDER BY 1 NULLS LAST`);
  console.log("\n  LIVE hotels by star rating:");
  for (const r of after) console.log(`    ${r.star_rating ?? "unrated"} star: ${r.n}`);
  console.log("");
}

main()
  .catch((e) => { console.error("FAILED:", e.message); process.exitCode = 1; })
  .finally(() => pool.end());
