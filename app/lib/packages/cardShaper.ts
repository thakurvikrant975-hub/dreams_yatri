import type { Prisma } from "@/app/generated/prisma/client";
import { getCardImage } from "@/app/lib/imageUrl";
import { computeCardPricingBatch, CARD_PRICING_ADULTS } from "./cardPricing";

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
  /** Per-adult price at the card occupancy (CARD_PRICING_ADULTS). */
  discountedPrice: number;
  originalPrice: number;
  /** Full trip total at the card occupancy — shown under the per-adult figure. */
  totalPrice: number;
  /** How many adults the two figures above are quoted for. */
  pricedForAdults: number;
};

// ── Shared Prisma select for a package card ──────────────────────────────────

// Duration / route / stay-category and the itinerary stops are NOT selected
// here any more — which combo a card represents is decided by pricing (the
// cheapest one, see cardPricing.ts), so resolving it here as well would just
// risk the two disagreeing.
export const PACKAGE_CARD_SELECT = {
  id: true,
  title: true,
  slug: true,
  thumbnail: true,
  images: { orderBy: { sort_order: "asc" }, take: 6, select: { url: true } },
} satisfies Prisma.packagesSelect;

export type PackageCardRow = {
  id: number;
  title: string;
  slug: string;
  thumbnail: string | null;
  images: { url: string | null }[];
};

// ── Shaping: rows → card items, with hotel pricing computed per package ──────

export async function shapePackageCards(rows: PackageCardRow[]): Promise<PackageCardItem[]> {
  if (rows.length === 0) return [];

  const pricingMap = await computeCardPricingBatch(rows.map((r) => r.id));

  return rows
    .map((pkg): PackageCardItem | null => {
      const pricing = pricingMap.get(pkg.id);
      if (!pricing) return null;

      const images = [
        cardImgUrl(pkg.thumbnail),
        ...pkg.images.map((i) => cardImgUrl(i.url)),
      ].filter(Boolean) as string[];

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
        discountedPrice: pricing.perAdult,
        // No honest "list price" exists for a computed package total (the old
        // strikethrough came from a flat room-rate sum that never matched the
        // real price anyway), so nothing is struck through — the card hides
        // the savings row when this is 0.
        originalPrice: 0,
        totalPrice: pricing.total,
        pricedForAdults: CARD_PRICING_ADULTS,
      };
    })
    .filter((p): p is PackageCardItem => p !== null);
}
