import { db } from "@/app/lib/db";

/**
 * Matches destinations to a selected location by intersecting their
 * {id, state_id} key sets. This works in both directions and survives the
 * duplicate location rows in the imported dataset (e.g. selecting the city
 * "Manali" matches the state-level "Himachal" destination because both share
 * state_id = the canonical Himachal state). state_id is used (not parent_id /
 * country_id) so we never over-match across an entire country.
 *
 * Shared by the package search and its filter facets so the sidebar counts are
 * always scoped to exactly the same destination set the results come from.
 */
export async function matchDestinationIds(toLocationId: string): Promise<number[]> {
  let selId: bigint;
  try { selId = BigInt(toLocationId); } catch { return []; }

  const sel = await db.location.findUnique({
    where: { id: selId },
    select: { id: true, state_id: true },
  });

  const selKeys = new Set<string>([selId.toString()]);
  if (sel?.state_id) selKeys.add(sel.state_id.toString());

  const dests = await db.destinations.findMany({
    where: { is_active: true, is_deleted: false, location_id: { not: null } },
    select: { id: true, location_id: true },
  });
  if (dests.length === 0) return [];

  const locIds = [...new Set(dests.map((d) => d.location_id!).filter(Boolean))]
    .map((s) => { try { return BigInt(s); } catch { return null; } })
    .filter((v): v is bigint => v !== null);

  const locs = await db.location.findMany({
    where: { id: { in: locIds } },
    select: { id: true, state_id: true },
  });
  const locMap = new Map(locs.map((l) => [l.id.toString(), l]));

  const matches = (locId: string) => {
    const l = locMap.get(locId);
    if (!l) return false;
    if (selKeys.has(l.id.toString())) return true;
    if (l.state_id && selKeys.has(l.state_id.toString())) return true;
    return false;
  };

  return dests.filter((d) => d.location_id && matches(d.location_id)).map((d) => d.id);
}
