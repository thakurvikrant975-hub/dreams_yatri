/**
 * Dev seed: put a handful of hotel requests in front of the hotel team.
 *
 * /dashboard/hotel-requests is the hotel team's queue, and it is driven off
 * `custom_itineraries.hotelPending = true AND hotelRejectedAt IS NULL` — a day
 * the sales exec flagged because nothing in the catalog fit. A fresh dev
 * database has no such days, so the screen renders empty and there is nothing
 * to click through.
 *
 * This flags days on packages that already exist rather than inventing new
 * ones, so each request carries a real client, destination, pax count and
 * travel date and the queue reads the way production would.
 *
 * The fields written are exactly the ones the real submit path writes (see the
 * hotelPending branch of saveBuilderPackage in package-builder/action.ts):
 * a pending day has no catalog room and no hotel name yet, so roomPricingId and
 * the accommodation snapshot are cleared, while roomsCount / manualExtraBeds /
 * hotelMealPlan carry what the exec asked for. Meal plans are real
 * `meal_types.name` values so the fill form pre-selects them.
 *
 * Request ages are deliberately spread from 40 minutes to 4 days so the
 * queue's ordering and any "waiting since" treatment have something to show.
 *
 * Writes a rollback snapshot of every row it touches before touching it, and
 * `--undo` puts them all back from that file.
 *
 * Usage:
 *   npx tsx --env-file=.env.development.local scripts/seed-hotel-requests.ts
 *   npx tsx --env-file=.env.development.local scripts/seed-hotel-requests.ts --apply
 *   npx tsx --env-file=.env.development.local scripts/seed-hotel-requests.ts --undo
 */
import pg from "pg";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";

const APPLY = process.argv.includes("--apply");
const UNDO = process.argv.includes("--undo");

/** The production endpoint. Seed data has no business there, and the guard is
 * explicit rather than "not localhost" because dev is itself a hosted Neon
 * branch, so there is no hostname shape that separates them by accident. */
const PRODUCTION_HOST_FRAGMENT = "ep-restless-pond";

const HOUR = 3600_000;
const ago = (ms: number) => new Date(Date.now() - ms);

/** One request = one package with at least one pending day. */
const REQUESTS: {
  packageId: string;
  label: string;
  requestedAt: Date;
  days: {
    day: number;
    location: string;
    type: string;
    note: string;
    rooms: number;
    mattresses: number | null;
    mealPlan: string | null;
  }[];
}[] = [
  {
    packageId: "dbe379b9-33f0-46a6-a41c-a163ab0c9bca",
    label: "Kerala Tour Package (Ramlal, 3 adults)",
    requestedAt: ago(4 * 24 * HOUR),
    days: [
      { day: 1, location: "Munnar, Kerala", type: "STAR_5", rooms: 2, mattresses: 1,
        mealPlan: "MAP (Breakfast + Dinner)",
        note: "Client wants a tea-estate view property. Nothing 5-star in the catalog for Munnar on these dates." },
      { day: 2, location: "Thekkady, Kerala", type: "RESORT", rooms: 2, mattresses: null,
        mealPlan: "AP(Breakfast + Lunch + Dinner)",
        note: "Needs to be walking distance from the Periyar boat jetty. All-meals plan, group is vegetarian." },
      { day: 3, location: "Alleppey, Kerala", type: "BOUTIQUE", rooms: 2, mattresses: null,
        mealPlan: "AP(Breakfast + Lunch + Dinner)",
        note: "Premium houseboat, 2 bedrooms, upper deck. Catalog only has the shared-cruise operators." },
    ],
  },
  {
    packageId: "4c1706a9-3272-4043-8c3e-3b94b20937f9",
    label: "Sikkim Tour Package (Devs)",
    requestedAt: ago(2 * 24 * HOUR),
    days: [
      { day: 1, location: "Gangtok, Sikkim", type: "STAR_3", rooms: 1, mattresses: null,
        mealPlan: "CP(Breakfast only)",
        note: "Anything decent on or just off MG Marg. We have no Gangtok inventory at all yet." },
      { day: 2, location: "Pelling, Sikkim", type: "HOMESTAY", rooms: 1, mattresses: null,
        mealPlan: "MAP (Breakfast + Dinner)",
        note: "Client specifically asked for a family-run homestay with a Kanchenjunga view, not a hotel." },
    ],
  },
  {
    packageId: "0c307c69-3e8c-488b-ab20-0f4ddffee2a1",
    label: "Manali Tour Package (Devs)",
    requestedAt: ago(26 * HOUR),
    days: [
      { day: 1, location: "Manali, Himachal Pradesh", type: "STAR_4", rooms: 1, mattresses: null,
        mealPlan: "MAP (Breakfast + Dinner)",
        note: "Old Manali side preferred. Everything in the catalog is full for the 2nd week." },
      { day: 2, location: "Solang Valley, Himachal Pradesh", type: "CAMP", rooms: 1, mattresses: 1,
        mealPlan: "All Inclusive (3 Times Meals + Snacks + Beverages)",
        note: "Luxury tent with attached washroom and a heater — client was clear it must be heated." },
    ],
  },
  {
    packageId: "caeb5709-5201-47bb-b553-b537f00618ce",
    label: "Discover Monsoon Goa (Mayanti, Chirag)",
    requestedAt: ago(5 * HOUR),
    days: [
      { day: 2, location: "Calangute, North Goa", type: "RESORT", rooms: 1, mattresses: null,
        mealPlan: "MAP (Breakfast + Dinner)",
        note: "Client upgraded after seeing the quote — wants a beachfront resort with a pool for night 2 only." },
    ],
  },
  {
    packageId: "cmssqu4pc000t8irzi7m91mhd",
    label: "Munnar & Alleppey Escape — Sent (Sneha Iyer)",
    requestedAt: ago(40 * 60_000),
    days: [
      { day: 3, location: "Alleppey, Kerala", type: "HOMESTAY", rooms: 1, mattresses: null,
        mealPlan: "CP(Breakfast only)",
        note: "Couple, last night before the airport transfer. Backwater homestay rather than a houseboat." },
    ],
  },
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

const snapPath = join(process.cwd(), `hotel-requests-seed-rollback.${tag}.json`);

/** Every column the seed overwrites — snapshotted so --undo is exact. */
const TOUCHED = [
  "hotelPending", "hotelPendingNote", "hotelRequestType", "hotelRequestedAt",
  "roomsCount", "manualExtraBeds", "hotelMealPlan", "accommodationLocation",
  "accommodation", "accommodationPhoto", "accommodationRoomSpecs",
  "accommodationStarRating", "roomPricingId",
] as const;

async function undo() {
  if (!existsSync(snapPath)) {
    console.log(`\n  No snapshot at ${snapPath} — nothing to undo.\n`);
    return;
  }
  const snap = JSON.parse(readFileSync(snapPath, "utf8"));
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    for (const row of snap.days) {
      const sets = TOUCHED.map((col, i) => `"${col}" = $${i + 2}`).join(", ");
      await c.query(
        `UPDATE custom_itineraries SET ${sets} WHERE id = $1`,
        [row.id, ...TOUCHED.map((col) => row[col])],
      );
    }
    for (const p of snap.packages) {
      await c.query(`UPDATE custom_packages SET "updatedAt" = $2 WHERE id = $1`, [p.id, p.updatedAt]);
    }
    await c.query("COMMIT");
    console.log(`\n  Restored ${snap.days.length} day(s) and ${snap.packages.length} package timestamp(s).\n`);
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

async function main() {
  console.log(`\n  DB:   ${tag}`);
  console.log(`  Mode: ${UNDO ? "UNDO" : APPLY ? "APPLY" : "DRY RUN"}\n`);

  if (url.hostname.includes(PRODUCTION_HOST_FRAGMENT)) {
    console.log("  REFUSING — this is the production database. Seed data does not go there.\n");
    process.exitCode = 1;
    return;
  }
  if (UNDO) return undo();

  const c = await pool.connect();
  try {
    await c.query("BEGIN");

    const ids = REQUESTS.map((r) => r.packageId);
    const { rows: pkgs } = await c.query(
      `SELECT id, title, destination, "updatedAt" FROM custom_packages WHERE id = ANY($1)`, [ids]);
    const missing = ids.filter((id) => !pkgs.some((p) => p.id === id));
    if (missing.length) {
      console.log(`  Missing package(s) — this dev database doesn't have them:\n    ${missing.join("\n    ")}`);
      console.log("  Point the script at the packages this database does have, or reseed.\n");
      await c.query("ROLLBACK");
      process.exitCode = 1;
      return;
    }

    // Snapshot before anything changes, on a dry run too, so the target set is
    // reviewable and --undo works even if the apply is run later.
    const snapDays: Record<string, unknown>[] = [];
    for (const req of REQUESTS) {
      for (const d of req.days) {
        const { rows } = await c.query(
          `SELECT id, ${TOUCHED.map((t) => `"${t}"`).join(", ")}
           FROM custom_itineraries WHERE "customPackageId" = $1 AND day = $2`,
          [req.packageId, d.day]);
        if (rows.length === 0) {
          console.log(`  ! ${req.label}: day ${d.day} doesn't exist — skipping that day.`);
          continue;
        }
        snapDays.push(rows[0]);
      }
    }
    writeFileSync(snapPath, JSON.stringify({
      db: tag, at: new Date().toISOString(),
      days: snapDays,
      packages: pkgs.map((p) => ({ id: p.id, updatedAt: p.updatedAt })),
    }, null, 2));
    console.log(`  Rollback snapshot -> ${snapPath} (${snapDays.length} days)\n`);

    for (const req of REQUESTS) {
      console.log(`  ${req.label}`);
      console.log(`    requested ${req.requestedAt.toISOString()}`);
      for (const d of req.days) {
        console.log(`    day ${d.day}  ${d.type.padEnd(9)} ${d.rooms} room(s)${d.mattresses ? ` +${d.mattresses} mattress` : ""}  ${d.location}`);
      }
      console.log("");
    }

    if (!APPLY) {
      console.log("  Dry run — nothing written. Re-run with --apply.\n");
      await c.query("ROLLBACK");
      return;
    }

    let dayCount = 0;
    for (const req of REQUESTS) {
      for (const d of req.days) {
        const res = await c.query(
          `UPDATE custom_itineraries SET
             "hotelPending" = true,
             "hotelPendingNote" = $3,
             "hotelRequestType" = $4,
             "hotelRequestedAt" = $5,
             "roomsCount" = $6,
             "manualExtraBeds" = $7,
             "hotelMealPlan" = $8,
             "accommodationLocation" = $9,
             -- A pending day has nothing picked yet: the exec asked precisely
             -- because the catalog had no answer, so any earlier snapshot of a
             -- hotel would show the team a stay that was never chosen.
             "accommodation" = NULL,
             "accommodationPhoto" = NULL,
             "accommodationRoomSpecs" = NULL,
             "accommodationStarRating" = NULL,
             "roomPricingId" = NULL,
             -- Not a rejection and not a fill; this is a fresh cycle.
             "hotelFilledAt" = NULL, "hotelFilledById" = NULL, "hotelFilledByName" = NULL,
             "hotelFillNote" = NULL, "hotelFillNotifiedAt" = NULL,
             "hotelRejectedAt" = NULL, "hotelRejectedById" = NULL, "hotelRejectedByName" = NULL,
             "hotelRejectionNote" = NULL, "hotelRejectedNotifiedAt" = NULL
           WHERE "customPackageId" = $1 AND day = $2`,
          [req.packageId, d.day, d.note, d.type, req.requestedAt,
           d.rooms, d.mattresses, d.mealPlan, d.location]);
        dayCount += res.rowCount ?? 0;
      }
      // The queue orders by the package's updatedAt, so a request that has been
      // waiting four days shouldn't sit above one raised this morning.
      await c.query(`UPDATE custom_packages SET "updatedAt" = $2 WHERE id = $1`,
        [req.packageId, req.requestedAt]);
    }

    await c.query("COMMIT");
    console.log(`  Flagged ${dayCount} day(s) across ${REQUESTS.length} packages.`);

    const { rows: check } = await c.query(`
      SELECT cp.title, COUNT(*)::int pending_days, MIN(ci."hotelRequestedAt") oldest
      FROM custom_itineraries ci JOIN custom_packages cp ON cp.id = ci."customPackageId"
      WHERE ci."hotelPending" = true AND ci."hotelRejectedAt" IS NULL
      GROUP BY cp.id, cp.title ORDER BY oldest`);
    console.log("\n  The queue at /dashboard/hotel-requests now reads:");
    console.table(check);
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

main()
  .catch((e) => { console.error("FAILED:", e.message); process.exitCode = 1; })
  .finally(() => pool.end());
