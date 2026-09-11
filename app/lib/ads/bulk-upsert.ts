import { Prisma } from "@/app/generated/prisma/client";

/**
 * INSERT … ON CONFLICT DO UPDATE for many rows at once.
 *
 * The ads sync writes thousands of rows a run — every campaign, ad group and ad
 * for each of 30 days, and every hour of those days — and a row-at-a-time
 * upsert is a network round trip each: minutes, where a scheduled function has
 * seconds. This is one statement per chunk.
 *
 * Table and column names come from our own code, never from input, and are
 * quoted into the SQL; every value is a bound parameter. Parameters go over
 * untyped, so Postgres coerces each to its target column — a "2026-09-11"
 * string lands in a date column as that date, and a bigint in a bigint.
 */

/** Anything that runs raw SQL: the app's client, the scripts' client, a transaction. */
export type RawExecutor = { $executeRaw(query: Prisma.Sql): Promise<number> };
/** The same, for reads. */
export type RawQuerier = { $queryRaw<T = unknown>(query: Prisma.Sql): PromiseLike<T> };

const q = (name: string) => `"${name.replace(/"/g, '""')}"`;

/** Postgres caps a statement at 65,535 parameters; stay well under it. */
const MAX_PARAMS = 30_000;

export async function bulkUpsert(
  db: RawExecutor,
  table: string,
  opts: {
    /** The conflict target — the table's primary key. */
    key: string[];
    rows: Record<string, unknown>[];
    /** Written on insert, left alone on conflict. */
    insertOnly?: string[];
  },
): Promise<number> {
  const { key, rows, insertOnly = [] } = opts;
  if (rows.length === 0) return 0;

  const cols = Object.keys(rows[0]);
  for (const r of rows) {
    // A row missing a column would silently shift every value after it.
    if (Object.keys(r).length !== cols.length || cols.some((c) => !(c in r))) {
      throw new Error(`bulkUpsert(${table}): rows don't share one set of columns`);
    }
  }
  const updates = cols.filter((c) => !key.includes(c) && !insertOnly.includes(c));
  const onConflict = updates.length
    ? `DO UPDATE SET ${updates.map((c) => `${q(c)} = EXCLUDED.${q(c)}`).join(", ")}`
    : "DO NOTHING";

  const perChunk = Math.max(1, Math.floor(MAX_PARAMS / cols.length));
  let written = 0;
  for (let i = 0; i < rows.length; i += perChunk) {
    const chunk = rows.slice(i, i + perChunk);
    const values = Prisma.join(chunk.map((r) => Prisma.sql`(${Prisma.join(cols.map((c) => r[c]))})`));
    written += await db.$executeRaw(Prisma.sql`INSERT INTO ${Prisma.raw(q(table))} (${Prisma.raw(cols.map(q).join(", "))})
      VALUES ${values}
      ON CONFLICT (${Prisma.raw(key.map(q).join(", "))}) ${Prisma.raw(onConflict)}`);
  }
  return written;
}
