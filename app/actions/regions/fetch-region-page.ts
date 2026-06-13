"use server";

import { db } from "@/app/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";
import {
  imgUrl,
  PACKAGE_CARD_SELECT,
  shapePackageCards,
  type PackageCardItem,
  type PackageCardRow,
} from "@/app/lib/packages/cardShaper";

// ── Types ────────────────────────────────────────────────────────────────────

export type RegionMeta = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  coverImage: string;
  thumbnail: string;
  metaTitle: string | null;
  metaDesc: string | null;
};

export type RegionPackageItem = PackageCardItem;

export type RegionPackagesPage = {
  items: RegionPackageItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

// ── Region meta ────────────────────────────────────────────────────────────

export async function fetchRegionBySlug(slug: string): Promise<RegionMeta | null> {
  const region = await db.custom_regions.findFirst({
    where: { slug, is_active: true, is_deleted: false },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      cover_image: true,
      thumbnail: true,
      meta_title: true,
      meta_desc: true,
    },
  });

  if (!region) return null;

  const thumbnail = imgUrl(region.thumbnail);
  return {
    id: region.id,
    name: region.name,
    slug: region.slug,
    description: region.description,
    // Cover for the hero banner; fall back to thumbnail when no cover is set
    coverImage: imgUrl(region.cover_image) || thumbnail,
    thumbnail,
    metaTitle: region.meta_title,
    metaDesc: region.meta_desc,
  };
}

// ── All regions listing page ──────────────────────────────────────────────────

export type RegionListItem = {
  id: number;
  name: string;
  slug: string;
  image: string;
  packageCount: number;
  country: string;
};

export type RegionFilters = { countries: string[] };

export type RegionListPage = {
  items: RegionListItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

export type RegionSidebarData = {
  countries: { name: string; count: number }[];
  total: number;
};

export async function fetchRegionsPage(
  filters: RegionFilters = { countries: [] },
  page = 1,
  pageSize = 12,
): Promise<RegionListPage> {
  const safePage = Math.max(1, Math.floor(page));
  const safeSize = Math.min(48, Math.max(1, Math.floor(pageSize)));
  const skip = (safePage - 1) * safeSize;

  const where: Prisma.custom_regionsWhereInput = {
    is_active: true,
    is_deleted: false,
    destinations: { some: { is_deleted: false, packages: { some: { is_active: true } } } },
    ...(filters.countries.length > 0 && { country: { in: filters.countries } }),
  };

  const [total, regions] = await Promise.all([
    db.custom_regions.count({ where }),
    db.custom_regions.findMany({
      where,
      skip,
      take: safeSize,
      select: { id: true, name: true, slug: true, thumbnail: true, country: true },
      orderBy: [{ country: "asc" }, { name: "asc" }],
    }),
  ]);

  if (regions.length === 0) {
    return { items: [], total, page: safePage, pageSize: safeSize, hasMore: false };
  }

  const regionIds = regions.map((r) => r.id);

  const dests = await db.destinations.findMany({
    where: { region_id: { in: regionIds }, is_deleted: false },
    select: {
      region_id: true,
      _count: { select: { packages: { where: { is_active: true } } } },
    },
  });

  const countMap: Record<number, number> = {};
  for (const d of dests) {
    countMap[d.region_id] = (countMap[d.region_id] ?? 0) + d._count.packages;
  }

  const items = regions
    .map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      image: imgUrl(r.thumbnail),
      packageCount: countMap[r.id] ?? 0,
      country: r.country,
    }))
    .filter((r) => r.image);

  return {
    items,
    total,
    page: safePage,
    pageSize: safeSize,
    hasMore: skip + regions.length < total,
  };
}

export async function fetchRegionSidebarData(): Promise<RegionSidebarData> {
  const rows = await db.custom_regions.findMany({
    where: {
      is_active: true,
      is_deleted: false,
      destinations: { some: { is_deleted: false, packages: { some: { is_active: true } } } },
    },
    select: { country: true },
  });

  const map = new Map<string, number>();
  for (const r of rows) map.set(r.country, (map.get(r.country) ?? 0) + 1);

  return {
    countries: Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    total: rows.length,
  };
}

// ── Active regions for the home page ─────────────────────────────────────────

export type ActiveRegionItem = {
  id: number;
  name: string;
  slug: string;
  image: string;
  packageCount: number;
};

export async function fetchActiveRegions(
  country = "India",
  limit = 12,
): Promise<ActiveRegionItem[]> {
  const regions = await db.custom_regions.findMany({
    where: {
      is_active: true,
      is_deleted: false,
      country,
      destinations: { some: { is_deleted: false, packages: { some: { is_active: true } } } },
    },
    select: { id: true, name: true, slug: true, thumbnail: true },
    take: limit,
    orderBy: { created_at: "asc" },
  });

  if (regions.length === 0) return [];

  const regionIds = regions.map((r) => r.id);

  const dests = await db.destinations.findMany({
    where: { region_id: { in: regionIds }, is_deleted: false },
    select: {
      region_id: true,
      _count: { select: { packages: { where: { is_active: true } } } },
    },
  });

  const countMap: Record<number, number> = {};
  for (const d of dests) {
    countMap[d.region_id] = (countMap[d.region_id] ?? 0) + d._count.packages;
  }

  return regions.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    image: imgUrl(r.thumbnail),
    packageCount: countMap[r.id] ?? 0,
  }));
}

// ── Paginated package listing for a region ──────────────────────────────────

const DEFAULT_PAGE_SIZE = 9;

/**
 * Fetch one page of active packages within a region (offset pagination, used by
 * the region page's infinite-scroll list). Page is 1-based.
 */
export async function getAllRegionSlugs(): Promise<string[]> {
  const rows = await db.custom_regions.findMany({
    where: { is_active: true, is_deleted: false },
    select: { slug: true },
  });
  return rows.map((r) => r.slug);
}

export async function fetchRegionPackages(
  regionId: number,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<RegionPackagesPage> {
  const safePage = Math.max(1, Math.floor(page));
  const safeSize = Math.min(48, Math.max(1, Math.floor(pageSize)));
  const skip = (safePage - 1) * safeSize;

  const where: Prisma.packagesWhereInput = {
    is_active: true,
    destination: { region_id: regionId },
  };

  const [total, rows] = await Promise.all([
    db.packages.count({ where }),
    db.packages.findMany({
      where,
      skip,
      take: safeSize,
      orderBy: { created_at: "desc" },
      select: PACKAGE_CARD_SELECT,
    }) as Promise<PackageCardRow[]>,
  ]);

  const items = await shapePackageCards(rows);

  return {
    items,
    total,
    page: safePage,
    pageSize: safeSize,
    hasMore: skip + rows.length < total,
  };
}
