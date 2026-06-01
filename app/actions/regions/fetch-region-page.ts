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

// ── Paginated package listing for a region ──────────────────────────────────

const DEFAULT_PAGE_SIZE = 9;

/**
 * Fetch one page of active packages within a region (offset pagination, used by
 * the region page's infinite-scroll list). Page is 1-based.
 */
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
