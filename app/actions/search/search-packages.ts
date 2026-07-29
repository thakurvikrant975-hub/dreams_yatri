"use server";

import { db } from "@/app/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";
import { imgUrl, PACKAGE_CARD_SELECT, type PackageCardRow } from "@/app/lib/packages/cardShaper";
import { computeCardPricingBatch } from "@/app/lib/packages/cardPricing";

// ── Types ────────────────────────────────────────────────────────────────────

export type SearchPackageItem = {
  id: number;
  title: string;
  slug: string;
  images: string[];
  duration: string;
  durationSlug: string;
  routeSlug: string;
  staySlug: string;
  itinerary: { days: number; place: string }[];
  /** Per-adult price for the selected traveller mix */
  perPerson: number;
  /** Strikethrough "before" price — always 0; no honest list price exists for
   *  a computed package total, so the card hides the savings row. */
  originalPerPerson: number;
  /** Grand total for all travellers */
  total: number;
  /** Adults the two figures above are quoted for (search pax, or the 2-adult default). */
  pricedForAdults: number;
  missingPricing: boolean;
};

export type SearchParams = {
  /** Empty/undefined → return all active packages (the /packages listing) */
  toLocationId?: string;
  adults: number;
  childAges: number[];
  travelDate?: string | null;
  limit?: number;
};

export type SearchResult = {
  items: SearchPackageItem[];
  total: number;
};


// ── Destination matching ──────────────────────────────────────────────────
// Matches a destination to the selected location by intersecting their
// {id, state_id} key sets. This works in both directions and survives the
// duplicate location rows in the imported dataset (e.g. selecting the city
// "Manali" matches the state-level "Himachal" destination because both share
// state_id = the canonical Himachal state). state_id is used (not parent_id /
// country_id) so we never over-match across an entire country.
async function matchDestinationIds(toLocationId: string): Promise<number[]> {
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

// ── Main search ────────────────────────────────────────────────────────────
export async function searchPackages(params: SearchParams): Promise<SearchResult> {
  const { toLocationId, adults, childAges, travelDate, limit = 24 } = params;

  // With a destination → match by location hierarchy; without → list all packages.
  let where: Prisma.packagesWhereInput;
  if (toLocationId) {
    const destinationIds = await matchDestinationIds(toLocationId);
    if (destinationIds.length === 0) return { items: [], total: 0 };
    where = { is_active: true, destination_id: { in: destinationIds } };
  } else {
    where = { is_active: true };
  }

  const rows = (await db.packages.findMany({
    where,
    orderBy: { created_at: "desc" },
    take: limit,
    select: PACKAGE_CARD_SELECT,
  })) as PackageCardRow[];

  if (rows.length === 0) return { items: [], total: 0 };

  const children = childAges.length;
  const pricedForAdults = Math.max(1, adults);

  // Prices the CHEAPEST duration of each package (the "starting from" figure)
  // at the searcher's own traveller mix — and reports which combo that was, so
  // the card links to exactly what it just quoted.
  const pricingMap = await computeCardPricingBatch(
    rows.map((r) => r.id),
    { adults: pricedForAdults, children, childAges, travelDate: travelDate ?? null },
  );

  const items = rows.map((pkg): SearchPackageItem | null => {
    const pricing = pricingMap.get(pkg.id);
    if (!pricing) return null;

    const images = [imgUrl(pkg.thumbnail), ...pkg.images.map((i) => imgUrl(i.url))]
      .filter(Boolean) as string[];
    if (images.length === 0) return null;

    return {
      id: pkg.id,
      title: pkg.title,
      slug: pkg.slug,
      images,
      duration: `${pricing.days}D/${pricing.nights}N`,
      durationSlug: pricing.durationSlug,
      routeSlug: pricing.routeSlug,
      staySlug: pricing.staySlug,
      itinerary: pricing.stops.map((s) => ({ days: s.stay_days, place: s.place_name })),
      perPerson: pricing.perAdult,
      originalPerPerson: 0,
      total: pricing.total,
      pricedForAdults,
      missingPricing: pricing.missingPricing,
    };
  });

  const filtered = items.filter((p): p is SearchPackageItem => p !== null);
  return { items: filtered, total: filtered.length };
}
