"use server";

import { db } from "@/app/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";
import {
  imgUrl, PACKAGE_CARD_SELECT, inclusionKeys, buildHighlights, type PackageCardRow,
} from "@/app/lib/packages/cardShaper";
import { computeCardPricingBatch } from "@/app/lib/packages/cardPricing";
import { referencePriceFor, resolveBadge, type BadgeColor } from "@/app/lib/packages/packageOffer";
import { matchDestinationIds } from "@/app/lib/packages/destinationMatch";
import { PUBLIC_PACKAGE } from "@/app/lib/packages/internal-skus";
import {
  DURATION_BUCKETS,
  EMPTY_PACKAGE_FILTERS,
  matchesBudget,
  packageFiltersKey,
  stayTierForLabel,
  themesForNames,
  type PackageFilters,
} from "@/app/lib/packages/packageFacets";
import { cached, CACHE_TTL, CACHE_KEYS } from "@/app/lib/cache";

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
  /** Display-only reference ("was") price behind the standing offer; 0 hides
   *  the savings row. Never charged — see lib/packages/packageOffer.ts. */
  originalPerPerson: number;
  /** Grand total for all travellers */
  total: number;
  /** Adults the two figures above are quoted for (search pax, or the 2-adult default). */
  pricedForAdults: number;
  missingPricing: boolean;
  /** Which inclusion icons to light up, derived from the priced itinerary. */
  inclusions: ('hotel' | 'meals' | 'cab' | 'activities')[];
  /** Short MMT-style inclusion lines, e.g. "2 Nights Stay". */
  highlights: string[];
  badge?: string;
  badgeColor?: BadgeColor;
};

export type SearchParams = {
  /** Empty/undefined → return all active packages (the /packages listing) */
  toLocationId?: string;
  adults: number;
  childAges: number[];
  travelDate?: string | null;
  limit?: number;
  /** Sidebar filters. Omitted → unfiltered. */
  filters?: PackageFilters;
};

export type SearchResult = {
  items: SearchPackageItem[];
  total: number;
  /** True when the budget filter had more candidates to price than the cap
   *  allows, i.e. the list may not be exhaustive. */
  capped: boolean;
};


// ── Sidebar filters → Prisma ───────────────────────────────────────────────
//
// Everything except budget is expressible as a WHERE clause. Budget is not:
// a package's price is computed per traveller mix by the pricing engine, never
// stored, so it can only be applied after the cards have been priced (below).

/** Category + tag ids whose (messy, free-text) names match any selected theme. */
async function resolveThemeIds(themes: string[]): Promise<{ categoryIds: number[]; tagIds: number[] }> {
  const selected = new Set(themes);
  const [categories, tags] = await Promise.all([
    db.categories.findMany({ where: { is_active: true }, select: { id: true, name: true } }),
    db.tags.findMany({ select: { id: true, name: true } }),
  ]);
  const hits = (name: string) => themesForNames([name]).some((slug) => selected.has(slug));
  return {
    categoryIds: categories.filter((c) => hits(c.name)).map((c) => c.id),
    tagIds: tags.filter((t) => hits(t.name)).map((t) => t.id),
  };
}

/** Raw stay-category labels that normalise onto any selected tier. */
async function resolveStayLabels(tiers: string[]): Promise<string[]> {
  const selected = new Set(tiers);
  const rows = await db.package_stay_categories.groupBy({
    by: ["label"],
    where: { is_active: true },
  });
  return rows
    .map((r) => r.label)
    .filter((label) => {
      const tier = stayTierForLabel(label);
      return tier !== null && selected.has(tier);
    });
}

/**
 * Extra WHERE conditions for the selected filters, or null when a filter is
 * selected that nothing in the DB can satisfy (→ the caller returns no results
 * rather than silently widening the search).
 */
async function buildFilterConditions(
  f: PackageFilters,
): Promise<Prisma.packagesWhereInput[] | null> {
  const conditions: Prisma.packagesWhereInput[] = [];

  if (f.destinationIds.length > 0) {
    conditions.push({ destination_id: { in: f.destinationIds } });
  }

  if (f.themes.length > 0) {
    const { categoryIds, tagIds } = await resolveThemeIds(f.themes);
    if (categoryIds.length === 0 && tagIds.length === 0) return null;
    conditions.push({
      OR: [
        ...(categoryIds.length > 0 ? [{ categories: { some: { category_id: { in: categoryIds } } } }] : []),
        ...(tagIds.length > 0 ? [{ tags: { some: { tag_id: { in: tagIds } } } }] : []),
      ],
    });
  }

  if (f.stayTiers.length > 0) {
    const labels = await resolveStayLabels(f.stayTiers);
    if (labels.length === 0) return null;
    conditions.push({ stay_categories: { some: { is_active: true, label: { in: labels } } } });
  }

  if (f.durations.length > 0) {
    const buckets = DURATION_BUCKETS.filter((b) => f.durations.includes(b.slug));
    if (buckets.length === 0) return null;
    conditions.push({
      OR: buckets.map((b) => ({
        durations: { some: { is_active: true, nights: { gte: b.minNights, lte: b.maxNights } } },
      })),
    });
  }

  return conditions;
}

/** How many packages we're willing to price when a budget filter is on. Pricing
 *  runs the real engine once per duration per package, so this is the ceiling
 *  that keeps a broad "Under ₹15,000" search from pricing the whole catalogue.
 *  Without a budget filter we only ever price the page we're about to show. */
const BUDGET_CANDIDATE_CAP = 60;

// ── Main search ────────────────────────────────────────────────────────────
/**
 * Cache key for one search. Every input that changes the result is in here —
 * destination, traveller mix, travel date (it drives pricing), limit and the
 * sidebar filters — so two requests share an entry only when they'd have
 * produced identical output.
 */
function searchPackagesKey(p: SearchParams): string {
  return [
    CACHE_KEYS.packageSearch,
    p.toLocationId || "all",
    p.adults,
    p.childAges.join(",") || "-",
    p.travelDate || "-",
    p.limit ?? 24,
    packageFiltersKey(p.filters ?? EMPTY_PACKAGE_FILTERS),
  ].join(":");
}

/**
 * Cached wrapper. TTL is deliberately short: card pricing is derived from
 * rate/pricing tables an admin can edit at any time, and a 60s bound means a
 * price change is visible within a minute without needing every mutation path
 * to remember to invalidate. Redis being down degrades to a direct DB read
 * (see lib/cache.ts) rather than an error.
 */
export async function searchPackages(params: SearchParams): Promise<SearchResult> {
  return cached(searchPackagesKey(params), () => searchPackagesUncached(params), CACHE_TTL.short);
}

async function searchPackagesUncached(params: SearchParams): Promise<SearchResult> {
  const {
    toLocationId, adults, childAges, travelDate, limit = 24,
    filters = EMPTY_PACKAGE_FILTERS,
  } = params;

  // With a destination → match by location hierarchy; without → list all packages.
  let where: Prisma.packagesWhereInput;
  if (toLocationId) {
    const destinationIds = await matchDestinationIds(toLocationId);
    if (destinationIds.length === 0) return { items: [], total: 0, capped: false };
    where = { ...PUBLIC_PACKAGE, destination_id: { in: destinationIds } };
  } else {
    where = { ...PUBLIC_PACKAGE };
  }

  const conditions = await buildFilterConditions(filters);
  if (conditions === null) return { items: [], total: 0, capped: false };
  if (conditions.length > 0) where = { AND: [where, ...conditions] };

  // A budget filter can only be applied post-pricing, so pull a wider candidate
  // set and trim back to `limit` afterwards.
  const hasBudgetFilter = filters.budgets.length > 0;
  const take = hasBudgetFilter ? Math.max(limit, BUDGET_CANDIDATE_CAP) : limit;

  const rows = (await db.packages.findMany({
    where,
    orderBy: { created_at: "desc" },
    take,
    select: PACKAGE_CARD_SELECT,
  })) as PackageCardRow[];

  if (rows.length === 0) return { items: [], total: 0, capped: false };

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

    const badge = resolveBadge((pkg.categories ?? []).map((c) => c.category.name));

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
      originalPerPerson: referencePriceFor(pricing.perAdult),
      total: pricing.total,
      pricedForAdults,
      missingPricing: pricing.missingPricing,
      inclusions: inclusionKeys(pricing.inclusions),
      highlights: buildHighlights(pricing.inclusions),
      ...(badge ? { badge: badge.label, badgeColor: badge.color } : {}),
    };
  });

  const priced = items.filter((p): p is SearchPackageItem => p !== null);

  // Budget, finally — against the same per-adult figure the card advertises,
  // for this search's own traveller mix. Un-priceable packages drop out of a
  // budget search rather than pretending to be free.
  const filtered = hasBudgetFilter
    ? priced.filter((p) => !p.missingPricing && matchesBudget(p.perPerson, filters.budgets))
    : priced;

  return {
    items: filtered.slice(0, limit),
    total: Math.min(filtered.length, limit),
    capped: hasBudgetFilter && rows.length >= take,
  };
}
