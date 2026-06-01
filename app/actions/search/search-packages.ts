"use server";

import { db } from "@/app/lib/db";
import { computePackagePrice } from "@/app/services/package-pricing.service";
import { imgUrl, PACKAGE_CARD_SELECT, type PackageCardRow } from "@/app/lib/packages/cardShaper";

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
  /** Strikethrough "before" price (deterministic markup, matches PricingCard) */
  originalPerPerson: number;
  /** Grand total for all travellers */
  total: number;
  missingPricing: boolean;
};

export type SearchParams = {
  toLocationId: string;
  adults: number;
  childAges: number[];
  travelDate?: string | null;
  limit?: number;
};

export type SearchResult = {
  items: SearchPackageItem[];
  total: number;
};

// Deterministic fake MRP — mirrors PricingCard so the struck price is consistent.
function fakeOriginalPrice(price: number): number {
  if (price <= 0) return 0;
  const seed = (price % 97) / 97;
  const markup = 1.18 + seed * 0.26;
  return Math.ceil((price * markup) / 100) * 100 - 1;
}

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
  if (!toLocationId) return { items: [], total: 0 };

  const destinationIds = await matchDestinationIds(toLocationId);
  if (destinationIds.length === 0) return { items: [], total: 0 };

  const rows = (await db.packages.findMany({
    where: { is_active: true, destination_id: { in: destinationIds } },
    orderBy: { created_at: "desc" },
    take: limit,
    select: PACKAGE_CARD_SELECT,
  })) as PackageCardRow[];

  if (rows.length === 0) return { items: [], total: 0 };

  const children = childAges.length;

  const items = await Promise.all(
    rows.map(async (pkg): Promise<SearchPackageItem | null> => {
      const duration = pkg.durations[0];
      const route = duration?.routes[0];
      const stay = pkg.stay_categories[0];
      if (!duration || !route || !stay) return null;

      const images = [imgUrl(pkg.thumbnail), ...pkg.images.map((i) => imgUrl(i.url))]
        .filter(Boolean) as string[];
      if (images.length === 0) return null;

      let perPerson = 0;
      let total = 0;
      let missingPricing = false;
      try {
        const breakdown = await computePackagePrice({
          package_id: pkg.id,
          duration_id: duration.id,
          route_id: route.id,
          stay_category_id: stay.id,
          adults,
          children,
          infants: 0,
          child_ages: childAges,
          travel_date: travelDate ?? null,
        });
        perPerson = Math.round(breakdown.price_per_adult);
        total = Math.round(breakdown.final_price);
        missingPricing = breakdown.missing_pricing_config;
      } catch {
        missingPricing = true;
      }

      return {
        id: pkg.id,
        title: pkg.title,
        slug: pkg.slug,
        images,
        duration: `${duration.days}D/${duration.nights}N`,
        durationSlug: duration.slug,
        routeSlug: route.slug,
        staySlug: stay.slug,
        itinerary: route.stops.map((s) => ({ days: s.stay_days, place: s.place_name })),
        perPerson,
        originalPerPerson: fakeOriginalPrice(perPerson),
        total,
        missingPricing,
      };
    }),
  );

  const filtered = items.filter((p): p is SearchPackageItem => p !== null);
  return { items: filtered, total: filtered.length };
}
