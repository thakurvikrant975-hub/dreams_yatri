/**
 * One-off: give every stored meal the one spelling the builder understands.
 *
 * The builder's meal chips write labels ("Breakfast"); catalog templates,
 * meal_types.covered_meals and itinerary_stays.active_meals all store lowercase
 * keys ("breakfast"). copyPackageIntoDraft copied a template's day across
 * unchanged whenever that day had no hotel to take meals from — usually the
 * departure day — so those days arrived lowercase.
 *
 * To an exec the day then printed the meal in the itinerary document but showed
 * the chip unticked, and ticking-then-unticking removed only the label, leaving
 * ["breakfast", "Breakfast"] and a meal that could not be switched off.
 *
 * The code now canonicalises on copy, on load and on save, so this is only for
 * rows written before that. Same rules as normalizeMealLabels: map the known
 * keys to labels, keep unknown values as they are, drop duplicates that differ
 * only by case, preserve order.
 *
 * Usage:
 *   npx tsx --env-file=.env.development.local scripts/repair-meal-casing.ts
 *   npx tsx --env-file=.env.development.local scripts/repair-meal-casing.ts --apply
 *   npx tsx --env-file=.env.production.local  scripts/repair-meal-casing.ts --apply
 */
import dns from "dns";
import net from "net";
dns.setDefaultResultOrder("ipv4first");
net.setDefaultAutoSelectFamily(false);
import pg from "pg";
import { writeFileSync } from "fs";
import { join } from "path";
import { normalizeMealLabels } from "../app/(dashboard)/dashboard/(builder)/package-builder/meals";

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

const same = (a: string[], b: string[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

async function main() {
  console.log(`\n  DB:   ${tag}`);
  console.log(`  Mode: ${APPLY ? "APPLY" : "DRY RUN"}\n`);

  // Every day, then filtered in JS against the very function the app now uses —
  // so the repair and the runtime can never disagree about what "correct" is.
  const { rows } = await pool.query(`
    SELECT ci.id, ci.day, ci.meals, cp.title, cp.id AS package_id
    FROM custom_itineraries ci
    JOIN custom_packages cp ON cp.id = ci."customPackageId"
    WHERE array_length(ci.meals, 1) > 0
    ORDER BY cp."updatedAt" DESC`);

  const broken = rows
    .map((r) => ({ ...r, fixed: normalizeMealLabels(r.meals as string[]) }))
    .filter((r) => !same(r.meals as string[], r.fixed));

  if (broken.length === 0) {
    console.log("  Nothing to repair — every stored meal already matches the chips.\n");
    return;
  }

  const unremovable = broken.filter((r) =>
    (r.meals as string[]).some((a, i) =>
      (r.meals as string[]).some((b, j) => i !== j && a !== b && a.toLowerCase() === b.toLowerCase())));

  console.log(`  ${broken.length} day(s) to repair, ${unremovable.length} of them with a meal that cannot currently be switched off:\n`);
  console.table(broken.slice(0, 15).map((r) => ({
    package: String(r.title).slice(0, 28),
    day: r.day,
    stored: (r.meals as string[]).join(", "),
    becomes: r.fixed.join(", "),
  })));
  if (broken.length > 15) console.log(`  …and ${broken.length - 15} more.`);

  const snapPath = join(process.cwd(), `meal-casing-rollback.${tag}.json`);
  writeFileSync(snapPath, JSON.stringify({
    db: tag, at: new Date().toISOString(),
    rows: broken.map((r) => ({ id: r.id, meals: r.meals })),
  }, null, 2));
  console.log(`\n  Rollback snapshot -> ${snapPath}`);

  if (!APPLY) {
    console.log("\n  Dry run — nothing written. Re-run with --apply.\n");
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const r of broken) {
      await client.query(`UPDATE custom_itineraries SET meals = $2 WHERE id = $1`, [r.id, r.fixed]);
    }
    await client.query("COMMIT");
    console.log(`\n  Repaired ${broken.length} day(s).`);
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }

  const { rows: after } = await pool.query(`
    SELECT COUNT(*)::int n FROM custom_itineraries ci
    WHERE EXISTS (SELECT 1 FROM unnest(ci.meals) m WHERE m = lower(m) AND m <> initcap(m))`);
  console.log(`  Days still holding a lowercase meal: ${after[0].n}\n`);
}

main()
  .catch((e) => { console.error("FAILED:", e.message); process.exitCode = 1; })
  .finally(() => pool.end());
