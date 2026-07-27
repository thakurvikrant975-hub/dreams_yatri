import { db } from "@/app/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";
import { getCardImage } from "@/app/lib/imageUrl";

const R2 = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";

export const imgUrl = (key: string | null | undefined) =>
  !key ? "" : key.startsWith("http") ? key : `${R2}/${key}`;

// Card-sized (400x250, Cloudflare-transformed) variant — use this for
// PackageCardItem.images, not the raw imgUrl() above, so listing/homepage
// cards don't ship full-resolution originals.
const cardImgUrl = (key: string | null | undefined) =>
  !key ? "" : key.startsWith("http") ? key : getCardImage(key);

// ── Card item shape (matches what PackageCard expects) ───────────────────────

export type PackageCardItem = {
  id: number;
  title: string;
  slug: string;
  images: string[];
  duration: string;
  durationSlug: string;
  routeSlug: string;
  staySlug: string;
  itinerary: { days: number; place: string }[];
  discountedPrice: number;
  originalPrice: number;
};

// ── Shared Prisma select for a package card ──────────────────────────────────

export const PACKAGE_CARD_SELECT = {
  id: true,
  title: true,
  slug: true,
  thumbnail: true,
  images: { orderBy: { sort_order: "asc" }, take: 6, select: { url: true } },
  durations: {
    where: { is_active: true },
    orderBy: [{ is_default: "desc" }, { sort_order: "asc" }],
    take: 1,
    select: {
      id: true,
      slug: true,
      days: true,
      nights: true,
      routes: {
        where: { is_active: true },
        orderBy: { sort_order: "asc" },
        take: 1,
        select: {
          id: true,
          slug: true,
          stops: {
            orderBy: { sort_order: "asc" },
            select: { place_name: true, stay_days: true },
          },
        },
      },
    },
  },
  stay_categories: {
    where: { is_active: true },
    orderBy: [{ is_default: "desc" }, { sort_order: "asc" }],
    take: 1,
    select: { id: true, slug: true },
  },
} satisfies Prisma.packagesSelect;

export type PackageCardRow = {
  id: number;
  title: string;
  slug: string;
  thumbnail: string | null;
  images: { url: string | null }[];
  durations: {
    id: number;
    slug: string;
    days: number;
    nights: number;
    routes: {
      id: number;
      slug: string;
      stops: { place_name: string; stay_days: number }[];
    }[];
  }[];
  stay_categories: { id: number; slug: string }[];
};

// ── Shaping: rows → card items, with hotel pricing computed per package ──────

export async function shapePackageCards(rows: PackageCardRow[]): Promise<PackageCardItem[]> {
  if (rows.length === 0) return [];

  const pricingResults = await Promise.all(
    rows.map(async (pkg) => {
      const duration = pkg.durations[0];
      const route = duration?.routes[0];
      const stay = pkg.stay_categories[0];
      if (!duration || !route || !stay) return { id: pkg.id, discountedPrice: 0, originalPrice: 0 };

      const stays = await db.itinerary_stays.findMany({
        where: {
          stay_category_id: stay.id,
          itinerary: { package_id: pkg.id, duration_id: duration.id, route_id: route.id },
        },
        select: {
          num_nights: true,
          room_pricing: { select: { price_per_night: true, original_price: true } },
        },
      });

      const discountedPrice = stays.reduce(
        (sum, s) => sum + Number(s.room_pricing.price_per_night) * s.num_nights, 0,
      );
      const originalPrice = stays.reduce(
        (sum, s) => sum + Number(s.room_pricing.original_price ?? s.room_pricing.price_per_night) * s.num_nights, 0,
      );

      return { id: pkg.id, discountedPrice, originalPrice };
    }),
  );

  const pricingMap = new Map(pricingResults.map((p) => [p.id, p]));

  return rows
    .map((pkg): PackageCardItem | null => {
      const duration = pkg.durations[0];
      const route = duration?.routes[0];
      const stay = pkg.stay_categories[0];
      if (!duration || !route || !stay) return null;

      const images = [
        cardImgUrl(pkg.thumbnail),
        ...pkg.images.map((i) => cardImgUrl(i.url)),
      ].filter(Boolean) as string[];

      if (images.length === 0) return null;

      const pricing = pricingMap.get(pkg.id) ?? { discountedPrice: 0, originalPrice: 0 };

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
        discountedPrice: pricing.discountedPrice,
        originalPrice: pricing.originalPrice || pricing.discountedPrice,
      };
    })
    .filter((p): p is PackageCardItem => p !== null);
}
