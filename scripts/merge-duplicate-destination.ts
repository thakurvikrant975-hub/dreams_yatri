/**
 * One-off: fold the misspelled "Uttrakhand" destination into "Uttarakhand".
 *
 * Production grew two rows for the same state, and both accumulated real data,
 * so neither can simply be dropped:
 *
 *   id 12  name "Uttrakhand"   slug uttrakhand   — all the editorial content
 *          (cover_image, thumbnail, description, meta_*), location_id 92552
 *          which is the genuine STATE row in `locations`. 251 hotels, 142 packages.
 *   id 33  name "uttarakhand"  slug uttarakhand  — no content at all, and
 *          location_id 92781, a parentless CITY row whose coordinates are the
 *          geographic centre of India (20.5937/78.9629 — a junk geocode).
 *          306 hotels, 12 packages, 8 cab pricings.
 *
 * id 33 survives because its slug is the correctly spelled one and /destination/[slug]
 * is built from it. But surviving on FK count alone would publish a destination page
 * with no cover image, no description and no meta tags, so this also moves id 12's
 * content onto it — and repairs the geocode while it is there.
 *
 * Three things happen, in one transaction:
 *   1. KEEP absorbs DROP's content. COALESCE only — an existing value on KEEP is
 *      never clobbered — except for the two fields deliberately overridden below
 *      (name casing, and the location/coordinates that are known-wrong on KEEP).
 *      "Uttrakhand" is spell-corrected inside any text carried across, so the
 *      typo does not survive in meta_title.
 *   2. Every FK pointing at DROP is repointed at KEEP. The referencing tables are
 *      discovered from pg_constraint rather than hardcoded, so a table added later
 *      is still caught, and unique constraints spanning the FK column are checked
 *      for collisions BEFORE any write.
 *   3. DROP is deleted, but only after a re-count proves nothing references it.
 *
 * Historical free text is left alone by default: package_queries.destination holds
 * "Uttrakhand" on 78 lead records and custom_packages.destination on 1. Those are
 * records of what was captured at the time, not foreign keys. Pass --fix-text to
 * rewrite them too (worth doing if leads are filtered by that string).
 *
 * A rollback snapshot — both full rows plus every id about to be repointed — is
 * written next to the script before anything is applied, and on a dry run too, so
 * the exact target set is reviewable first.
 *
 * Usage:
 *   npx tsx --env-file=.env.development.local scripts/merge-duplicate-destination.ts
 *   npx tsx --env-file=.env.production.local  scripts/merge-duplicate-destination.ts
 *   npx tsx --env-file=.env.production.local  scripts/merge-duplicate-destination.ts --apply
 *   ... --apply --fix-text     # also spell-correct the historical free-text rows
 */
import pg from "pg";
import { writeFileSync } from "fs";
import { join } from "path";

const APPLY = process.argv.includes("--apply");
const FIX_TEXT = process.argv.includes("--fix-text");

/** The row that survives: correctly spelled slug, already the canonical one. */
const KEEP_ID = 33;
/** The row that is absorbed and then deleted: the misspelling. */
const DROP_ID = 12;
/** KEEP's name is lowercase "uttarakhand"; the display name is title-cased here. */
const CANONICAL_NAME = "Uttarakhand";
/** The misspelling, and its correction, applied to any text copied from DROP. */
const TYPO = "Uttrakhand";
const FIXED = "Uttarakhand";

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

type Fk = { table: string; column: string };

/** Every FK in the database that points at destinations.id. */
async function referencingColumns(c: pg.PoolClient): Promise<Fk[]> {
  const { rows } = await c.query(`
    SELECT src.relname AS table, att.attname AS column
    FROM pg_constraint con
    JOIN pg_class src ON src.oid = con.conrelid
    JOIN pg_class tgt ON tgt.oid = con.confrelid
    JOIN unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
    JOIN pg_attribute att ON att.attrelid = src.oid AND att.attnum = k.attnum
    WHERE con.contype = 'f' AND tgt.relname = 'destinations'
    ORDER BY src.relname, att.attname`);
  return rows;
}

/**
 * Unique constraints that span the FK column, as their plain column lists.
 * Moving rows onto KEEP can violate one of these (two rows colliding on the
 * same key once they share a destination_id), so they are checked up front —
 * a mid-transaction constraint error would be a rollback, not a diagnosis.
 * Expression and partial indexes can't be checked this way and are reported.
 */
async function uniqueKeys(c: pg.PoolClient, fk: Fk): Promise<string[][]> {
  const { rows } = await c.query(`
    SELECT pg_get_indexdef(ix.indexrelid) AS def,
           ARRAY(SELECT a.attname FROM unnest(ix.indkey) WITH ORDINALITY AS k(attnum, ord)
                 JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
                 ORDER BY k.ord) AS cols
    FROM pg_index ix
    JOIN pg_class t ON t.oid = ix.indrelid
    WHERE t.relname = $1 AND ix.indisunique`, [fk.table]);

  const keys: string[][] = [];
  for (const r of rows) {
    if (!r.cols.includes(fk.column)) continue;
    if (r.def.includes(" WHERE ") || r.cols.length === 0 || r.cols.includes(null)) {
      console.log(`  ! ${fk.table}: cannot pre-check ${r.def} — verify by hand`);
      continue;
    }
    keys.push(r.cols);
  }
  return keys;
}

const q = (s: string) => `"${s}"`;

async function main() {
  const c = await pool.connect();
  console.log(`\n  DB:   ${tag}`);
  console.log(`  Mode: ${APPLY ? "APPLY" : "DRY RUN"}${FIX_TEXT ? " (+ free-text fix)" : ""}`);
  console.log(`  Merge: ${DROP_ID} -> ${KEEP_ID}\n`);

  try {
    await c.query("BEGIN");

    // Lock both rows for the duration: a concurrent write to either one would
    // otherwise land between the snapshot and the delete.
    const { rows: dests } = await c.query(
      `SELECT * FROM destinations WHERE id IN ($1, $2) ORDER BY id FOR UPDATE`, [KEEP_ID, DROP_ID]);
    const keep = dests.find((d) => d.id === KEEP_ID);
    const drop = dests.find((d) => d.id === DROP_ID);
    if (!keep || !drop) {
      console.log(`  Nothing to do — ${!keep ? `id ${KEEP_ID}` : `id ${DROP_ID}`} is not present.`);
      console.log("  (Already merged? Re-running after a successful apply is a no-op.)\n");
      await c.query("ROLLBACK");
      return;
    }
    console.log(`  KEEP  ${keep.id}  ${JSON.stringify(keep.name)}  slug=${keep.slug}`);
    console.log(`  DROP  ${drop.id}  ${JSON.stringify(drop.name)}  slug=${drop.slug}\n`);

    // ── What moves ───────────────────────────────────────────────────────────
    const fks = await referencingColumns(c);
    const moves: { table: string; column: string; ids: unknown[] }[] = [];
    let blocked = false;

    for (const fk of fks) {
      const { rows } = await c.query(
        `SELECT id FROM ${q(fk.table)} WHERE ${q(fk.column)} = $1 ORDER BY id`, [DROP_ID]);
      if (rows.length === 0) continue;
      moves.push({ table: fk.table, column: fk.column, ids: rows.map((r) => r.id) });

      for (const cols of await uniqueKeys(c, fk)) {
        const others = cols.filter((x) => x !== fk.column);
        // No other column means the FK column is unique on its own: one row per
        // destination, so KEEP already holding one is itself the collision.
        const join = others.length
          ? others.map((o) => `k.${q(o)} IS NOT DISTINCT FROM d.${q(o)}`).join(" AND ")
          : "true";
        const { rows: clash } = await c.query(`
          SELECT d.id AS drop_row, k.id AS keep_row
          FROM ${q(fk.table)} d JOIN ${q(fk.table)} k ON ${join}
          WHERE d.${q(fk.column)} = $1 AND k.${q(fk.column)} = $2`, [DROP_ID, KEEP_ID]);
        if (clash.length) {
          blocked = true;
          console.log(`  ✗ ${fk.table}: ${clash.length} row(s) would collide on unique (${cols.join(", ")})`);
          for (const x of clash.slice(0, 5)) console.log(`      drop row ${x.drop_row} vs keep row ${x.keep_row}`);
        }
      }
    }

    console.log("  Rows to repoint:");
    if (moves.length === 0) console.log("    (none)");
    for (const m of moves) console.log(`    ${m.table}.${m.column}  ${String(m.ids.length).padStart(4)}`);

    // ── Content KEEP will absorb ─────────────────────────────────────────────
    const COPY = ["description", "meta_title", "meta_desc", "cover_image", "thumbnail", "place_id"] as const;
    const filling = COPY.filter((f) => (keep[f] === null || keep[f] === "") && drop[f] !== null && drop[f] !== "");
    console.log("\n  Content to absorb from DROP (only where KEEP is empty):");
    if (filling.length === 0) console.log("    (nothing — KEEP already has every field)");
    for (const f of filling) console.log(`    ${f.padEnd(12)} <- ${String(drop[f]).slice(0, 64)}`);

    // Two deliberate overrides, because KEEP's existing values are wrong rather
    // than merely absent — see the header note on location 92781.
    const { rows: locRows } = await c.query(
      `SELECT id, name, type, latitude, longitude FROM locations WHERE id = $1`, [String(drop.location_id)]);
    const loc = locRows[0];
    console.log("\n  Overrides (KEEP's current value is wrong, not missing):");
    console.log(`    name         ${JSON.stringify(keep.name)} -> ${JSON.stringify(CANONICAL_NAME)}`);
    if (loc) {
      console.log(`    location_id  ${keep.location_id} -> ${drop.location_id} (${loc.type} ${JSON.stringify(loc.name)})`);
      console.log(`    latitude     ${keep.latitude} -> ${loc.latitude}`);
      console.log(`    longitude    ${keep.longitude} -> ${loc.longitude}`);
    } else {
      console.log(`    location_id  ${keep.location_id} -> ${drop.location_id} (no locations row; coordinates left as-is)`);
    }

    // ── Free text ────────────────────────────────────────────────────────────
    const { rows: textCols } = await c.query(`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name ILIKE '%destination%'
        AND data_type IN ('text', 'character varying') ORDER BY table_name`);
    const textHits: { table: string; column: string; n: number }[] = [];
    for (const t of textCols) {
      const { rows } = await c.query(
        `SELECT COUNT(*)::int n FROM ${q(t.table_name)} WHERE ${q(t.column_name)} ILIKE $1`, [`%${TYPO}%`]);
      if (rows[0].n > 0) textHits.push({ table: t.table_name, column: t.column_name, n: rows[0].n });
    }
    console.log(`\n  Free-text "${TYPO}" (${FIX_TEXT ? "will be corrected" : "left alone — pass --fix-text"}):`);
    if (textHits.length === 0) console.log("    (none)");
    for (const h of textHits) console.log(`    ${h.table}.${h.column}  ${String(h.n).padStart(4)}`);

    // ── Snapshot ─────────────────────────────────────────────────────────────
    const snapPath = join(process.cwd(), `destination-merge-rollback.${tag}.json`);
    writeFileSync(snapPath, JSON.stringify({
      db: tag, at: new Date().toISOString(), keep_id: KEEP_ID, drop_id: DROP_ID,
      keep_before: keep, drop_row: drop, moves, text_hits: textHits,
    }, null, 2));
    console.log(`\n  Rollback snapshot -> ${snapPath}`);

    if (blocked) {
      console.log("\n  ABORTED — unique-constraint collisions above must be resolved first.\n");
      await c.query("ROLLBACK");
      process.exitCode = 1;
      return;
    }
    if (!APPLY) {
      console.log("\n  Dry run — nothing written. Re-run with --apply.\n");
      await c.query("ROLLBACK");
      return;
    }

    // ── Apply ────────────────────────────────────────────────────────────────
    console.log("");
    // KEEP wins wherever it already has a value; DROP only fills blanks. The
    // three prose fields are spell-corrected on the way across so meta_title
    // does not arrive still reading "Uttrakhand".
    const take = (f: string) => `COALESCE(NULLIF(k.${f}, ''), NULLIF(d.${f}, ''))`;
    const takeFixed = (f: string) =>
      `COALESCE(NULLIF(k.${f}, ''), NULLIF(regexp_replace(d.${f}, $4, $5, 'gi'), ''))`;
    await c.query(`
      UPDATE destinations k
      SET name        = $3,
          description = ${takeFixed("description")},
          meta_title  = ${takeFixed("meta_title")},
          meta_desc   = ${takeFixed("meta_desc")},
          cover_image = ${take("cover_image")},
          thumbnail   = ${take("thumbnail")},
          place_id    = ${take("place_id")},
          -- Overrides, not fills: KEEP's location/coordinates are wrong.
          location_id = COALESCE(d.location_id, k.location_id),
          latitude    = COALESCE($6::decimal, k.latitude),
          longitude   = COALESCE($7::decimal, k.longitude),
          updated_at  = now()
      FROM destinations d
      WHERE k.id = $1 AND d.id = $2`,
      [KEEP_ID, DROP_ID, CANONICAL_NAME, TYPO, FIXED, loc?.latitude ?? null, loc?.longitude ?? null]);
    console.log(`  Merged content onto id ${KEEP_ID}`);

    for (const m of moves) {
      const r = await c.query(
        `UPDATE ${q(m.table)} SET ${q(m.column)} = $1 WHERE ${q(m.column)} = $2`, [KEEP_ID, DROP_ID]);
      console.log(`  Repointed ${m.table}.${m.column}: ${r.rowCount} rows`);
    }

    if (FIX_TEXT) {
      for (const h of textHits) {
        const r = await c.query(
          `UPDATE ${q(h.table)} SET ${q(h.column)} = regexp_replace(${q(h.column)}, $1, $2, 'gi')
           WHERE ${q(h.column)} ILIKE $3`, [TYPO, FIXED, `%${TYPO}%`]);
        console.log(`  Corrected ${h.table}.${h.column}: ${r.rowCount} rows`);
      }
    }

    // Re-count from scratch rather than trusting the UPDATE counts: the delete
    // below is the irreversible step, so it only runs against a proven-zero state.
    let remaining = 0;
    for (const fk of fks) {
      const { rows } = await c.query(
        `SELECT COUNT(*)::int n FROM ${q(fk.table)} WHERE ${q(fk.column)} = $1`, [DROP_ID]);
      if (rows[0].n > 0) {
        remaining += rows[0].n;
        console.log(`  ✗ ${fk.table}.${fk.column} still has ${rows[0].n} rows on ${DROP_ID}`);
      }
    }
    if (remaining > 0) {
      console.log("\n  ABORTED before delete — references remain. Transaction rolled back.\n");
      await c.query("ROLLBACK");
      process.exitCode = 1;
      return;
    }

    const del = await c.query(`DELETE FROM destinations WHERE id = $1`, [DROP_ID]);
    console.log(`  Deleted destination ${DROP_ID}: ${del.rowCount} row`);

    await c.query("COMMIT");

    // ── After ────────────────────────────────────────────────────────────────
    const { rows: after } = await c.query(`
      SELECT id, name, slug, location_id, latitude, longitude,
             (cover_image IS NOT NULL) AS has_cover, (thumbnail IS NOT NULL) AS has_thumb,
             (description IS NOT NULL) AS has_desc, meta_title
      FROM destinations WHERE id = $1`, [KEEP_ID]);
    console.log("\n  After:");
    console.table(after);
    const counts: Record<string, number> = {};
    for (const fk of fks) {
      const { rows } = await c.query(
        `SELECT COUNT(*)::int n FROM ${q(fk.table)} WHERE ${q(fk.column)} = $1`, [KEEP_ID]);
      counts[`${fk.table}.${fk.column}`] = rows[0].n;
    }
    console.table(counts);
    console.log(`  /destination/${drop.slug} no longer resolves — add a redirect to /destination/${keep.slug} if that URL is in circulation.\n`);
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
