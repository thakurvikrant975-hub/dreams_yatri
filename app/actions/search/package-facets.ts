"use server";

import { db } from "@/app/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";
import { matchDestinationIds } from "@/app/lib/packages/destinationMatch";
import {
  BUDGET_BUCKETS,
  DURATION_BUCKETS,
  STAY_TIERS,
  THEME_RULES,
  durationBucketForNights,
  stayTierForLabel,
  themesForNames,
} from "@/app/lib/packages/packageFacets";
import { cached, CACHE_TTL, CACHE_KEYS } from "@/app/lib/cache";

// ── Types ────────────────────────────────────────────────────────────────────

export type FacetOption = { slug: string; label: string; hint?: string; count: number };
export type DestinationFacet = { id: number; name: string; count: number };

export type PackageSearchFacets = {
  destinations: DestinationFacet[];
  themes: FacetOption[];
  stayTiers: FacetOption[];
  durations: FacetOption[];
  /** Budget has no count: a package's price is computed per traveller mix, not
   *  stored, so any number here would be a guess. */
  budgets: { slug: string; label: string }[];
  /** Active packages in scope — the denominator the counts are drawn from. */
  total: number;
};

const EMPTY_FACETS: PackageSearchFacets = {
  destinations: [], themes: [], stayTiers: [], durations: [],
  budgets: BUDGET_BUCKETS.map((b) => ({ slug: b.slug, label: b.label })),
  total: 0,
};

/** Roll a package_id → slug[] mapping up into per-slug package counts, ordered
 *  by the curated vocabulary rather than by count, so the sidebar's rows don't
 *  reshuffle every time a filter narrows the set. */
function countBySlug<T extends { slug: string; label: string; hint?: string }>(
  vocabulary: readonly T[],
  packageSlugs: Map<number, Set<string>>,
): FacetOption[] {
  const counts = new Map<string, number>();
  for (const slugs of packageSlugs.values()) {
    for (const slug of slugs) counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }
  return vocabulary
    .map((v) => ({
      slug: v.slug,
      label: v.label,
      ...(v.hint ? { hint: v.hint } : {}),
      count: counts.get(v.slug) ?? 0,
    }))
    .filter((o) => o.count > 0);
}

// ── Facets ───────────────────────────────────────────────────────────────────

/**
 * Filter options + counts for the /packages sidebar, scoped to the searched
 * destination (or to every active package when nothing is searched).
 *
 * Counts are deliberately independent of the user's current selection — each
 * row answers "how many packages carry this attribute", which is what makes a
 * count useful while choosing. That matches the destinations sidebar.
 */
export async function fetchPackageSearchFacets(
  toLocationId?: string,
): Promise<PackageSearchFacets> {
  return cached(
    `${CACHE_KEYS.packageFacets}:${toLocationId || "all"}`,
    () => fetchPackageSearchFacetsUncached(toLocationId),
    CACHE_TTL.short,
  );
}

async function fetchPackageSearchFacetsUncached(
  toLocationId?: string,
): Promise<PackageSearchFacets> {
  let scope: Prisma.packagesWhereInput = { is_active: true };

  if (toLocationId) {
    const destinationIds = await matchDestinationIds(toLocationId);
    if (destinationIds.length === 0) return EMPTY_FACETS;
    scope = { is_active: true, destination_id: { in: destinationIds } };
  }

  const [total, destRows, categoryRows, tagRows, stayRows, durationRows] = await Promise.all([
    db.packages.count({ where: scope }),
    db.packages.groupBy({
      by: ["destination_id"],
      where: scope,
      _count: { _all: true },
    }),
    db.package_categories.findMany({
      where: { package: scope },
      select: { package_id: true, category: { select: { name: true } } },
    }),
    db.package_tags.findMany({
      where: { package: scope },
      select: { package_id: true, tag: { select: { name: true } } },
    }),
    db.package_stay_categories.findMany({
      where: { is_active: true, package: scope },
      select: { package_id: true, label: true },
    }),
    db.package_durations.findMany({
      where: { is_active: true, package: scope },
      select: { package_id: true, nights: true },
    }),
  ]);

  if (total === 0) return EMPTY_FACETS;

  // Destinations — names for the ids that actually carry packages in scope.
  const destCounts = new Map(destRows.map((d) => [d.destination_id, d._count._all]));
  const destNames = await db.destinations.findMany({
    where: { id: { in: [...destCounts.keys()] }, is_active: true, is_deleted: false },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const destinations = destNames
    .map((d) => ({ id: d.id, name: d.name, count: destCounts.get(d.id) ?? 0 }))
    .filter((d) => d.count > 0);

  // Themes — a package's categories AND tags both feed the keyword match, so a
  // package tagged only "#RomanticGetaway" still shows up under Honeymoon.
  const namesByPackage = new Map<number, string[]>();
  for (const row of [
    ...categoryRows.map((r) => ({ package_id: r.package_id, name: r.category.name })),
    ...tagRows.map((r) => ({ package_id: r.package_id, name: r.tag.name })),
  ]) {
    const list = namesByPackage.get(row.package_id) ?? [];
    list.push(row.name);
    namesByPackage.set(row.package_id, list);
  }
  const themesByPackage = new Map<number, Set<string>>();
  for (const [packageId, names] of namesByPackage) {
    themesByPackage.set(packageId, new Set(themesForNames(names)));
  }

  const staysByPackage = new Map<number, Set<string>>();
  for (const row of stayRows) {
    const tier = stayTierForLabel(row.label);
    if (!tier) continue;
    const set = staysByPackage.get(row.package_id) ?? new Set<string>();
    set.add(tier);
    staysByPackage.set(row.package_id, set);
  }

  const durationsByPackage = new Map<number, Set<string>>();
  for (const row of durationRows) {
    const bucket = durationBucketForNights(row.nights);
    if (!bucket) continue;
    const set = durationsByPackage.get(row.package_id) ?? new Set<string>();
    set.add(bucket);
    durationsByPackage.set(row.package_id, set);
  }

  return {
    destinations,
    themes: countBySlug(THEME_RULES, themesByPackage),
    stayTiers: countBySlug(STAY_TIERS, staysByPackage),
    durations: countBySlug(DURATION_BUCKETS, durationsByPackage),
    budgets: BUDGET_BUCKETS.map((b) => ({ slug: b.slug, label: b.label })),
    total,
  };
}
