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

export type DestinationMeta = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  coverImage: string;
  thumbnail: string;
  metaTitle: string | null;
  metaDesc: string | null;
  region: { name: string; slug: string } | null;
};

export type DestinationPackageItem = PackageCardItem;

export type DestinationPackagesPage = {
  items: DestinationPackageItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

// ── Active destinations for the home page (Beyond Borders) ───────────────────

export type ActiveDestinationItem = {
  id: number;
  name: string;
  slug: string;
  image: string;
  packageCount: number;
  country: string;
};

export async function fetchActiveDestinations(
  excludeCountry = "India",
  limit = 12,
): Promise<ActiveDestinationItem[]> {
  const dests = await db.destinations.findMany({
    where: {
      is_active: true,
      is_deleted: false,
      country: { not: excludeCountry },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      thumbnail: true,
      country: true,
      _count: { select: { packages: { where: { is_active: true } } } },
    },
    take: limit,
    orderBy: { created_at: "asc" },
  });

  return dests
    .map((d) => ({
      id: d.id,
      name: d.name,
      slug: d.slug,
      image: imgUrl(d.thumbnail),
      packageCount: d._count.packages,
      country: d.country,
    }))
    .filter((d) => d.image);
}

// ── Destination meta ─────────────────────────────────────────────────────────

export async function fetchDestinationBySlug(slug: string): Promise<DestinationMeta | null> {
  const dest = await db.destinations.findFirst({
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
      region: { select: { name: true, slug: true, is_active: true, is_deleted: true } },
    },
  });

  if (!dest) return null;

  const thumbnail = imgUrl(dest.thumbnail);
  const region =
    dest.region && dest.region.is_active && !dest.region.is_deleted
      ? { name: dest.region.name, slug: dest.region.slug }
      : null;

  return {
    id: dest.id,
    name: dest.name,
    slug: dest.slug,
    description: dest.description,
    // Cover for the hero banner; fall back to thumbnail when no cover is set
    coverImage: imgUrl(dest.cover_image) || thumbnail,
    thumbnail,
    metaTitle: dest.meta_title,
    metaDesc: dest.meta_desc,
    region,
  };
}

// ── Paginated package listing for a destination ──────────────────────────────

const DEFAULT_PAGE_SIZE = 9;

/**
 * Fetch one page of active packages for a destination (offset pagination, used
 * by the destination page's infinite-scroll list). Page is 1-based.
 */
export async function fetchDestinationPackages(
  destinationId: number,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<DestinationPackagesPage> {
  const safePage = Math.max(1, Math.floor(page));
  const safeSize = Math.min(48, Math.max(1, Math.floor(pageSize)));
  const skip = (safePage - 1) * safeSize;

  const where: Prisma.packagesWhereInput = {
    is_active: true,
    destination_id: destinationId,
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
