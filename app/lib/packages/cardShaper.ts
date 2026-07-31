import type { Prisma } from "@/app/generated/prisma/client";
import { getCardImage } from "@/app/lib/imageUrl";
import { computeCardPricingBatch, CARD_PRICING_ADULTS, type CardInclusions } from "./cardPricing";
import { referencePriceFor, resolveBadge, type BadgeColor } from "./packageOffer";
import { themesForNames } from "./packageFacets";

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
  /** Per-adult price at the card occupancy (CARD_PRICING_ADULTS). This is the
   *  real payable figure — the same one the package page and checkout use. */
  discountedPrice: number;
  /** Display-only reference ("was") price behind the standing offer; 0 hides
   *  the savings row. Never charged — see packageOffer.ts. */
  originalPrice: number;
  /** Full trip total at the card occupancy — shown under the per-adult figure. */
  totalPrice: number;
  /** How many adults the two figures above are quoted for. */
  pricedForAdults: number;
  /** Which inclusion icons to light up, derived from the priced itinerary. */
  inclusions: ('hotel' | 'meals' | 'cab' | 'activities')[];
  /** Short MMT-style inclusion lines, e.g. "2 Nights Stay", "3 Activities". */
  highlights: string[];
  /** Curated category badge for the image corner, when one matches. */
  badge?: string;
  badgeColor?: BadgeColor;
  /** Every THEME_RULES slug this package matches — lets a surface group cards
   *  by theme (the home page's tabs) without re-querying per tab. */
  themes: string[];
};

/** Turn the priced inclusion flags into the icon keys the card renders. */
export function inclusionKeys(inc: CardInclusions): ('hotel' | 'meals' | 'cab' | 'activities')[] {
  const keys: ('hotel' | 'meals' | 'cab' | 'activities')[] = [];
  if (inc.hotel) keys.push('hotel');
  if (inc.meals) keys.push('meals');
  if (inc.cab) keys.push('cab');
  if (inc.activities) keys.push('activities');
  return keys;
}

/** Short, scannable inclusion lines — the bit that makes a card feel concrete
 *  rather than "just a price". Only facts the itinerary actually supports.
 *
 *  Capped at MAX_HIGHLIGHTS and ordered by how much each one actually sways a
 *  booking decision (stay > meals > activities > transfers), so every card
 *  stays a single line and the grid can't go ragged. The full inclusion list
 *  still lives on the package page. */
const MAX_HIGHLIGHTS = 3;

export function buildHighlights(inc: CardInclusions): string[] {
  const out: string[] = [];
  if (inc.hotel && inc.nights > 0) out.push(`${inc.nights} Night${inc.nights !== 1 ? 's' : ''} Stay`);
  else if (inc.hotel) out.push('Hotel Stay');
  if (inc.meals) out.push('Meals Included');
  if (inc.activityCount > 0) out.push(`${inc.activityCount} Activit${inc.activityCount !== 1 ? 'ies' : 'y'}`);
  if (inc.cab && inc.transferCount > 0) out.push(`${inc.transferCount} Transfer${inc.transferCount !== 1 ? 's' : ''}`);
  else if (inc.cab) out.push('Private Cab');
  return out.slice(0, MAX_HIGHLIGHTS);
}

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
  // Drives the curated card badge (see packageOffer.resolveBadge) and the
  // theme tabs on the home page. Category/tag names in the DB are noisy, so
  // they're matched by keyword rather than shown verbatim — a package matching
  // none simply gets no badge.
  categories: { select: { category: { select: { name: true } } } },
  tags: { select: { tag: { select: { name: true } } } },
} satisfies Prisma.packagesSelect;

export type PackageCardRow = {
  id: number;
  title: string;
  slug: string;
  thumbnail: string | null;
  images: { url: string | null }[];
  categories?: { category: { name: string } }[];
  tags?: { tag: { name: string } }[];
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

      const facetNames = [
        ...(pkg.categories ?? []).map((c) => c.category.name),
        ...(pkg.tags ?? []).map((t) => t.tag.name),
      ];
      // The badge picks ONE headline theme; `themes` keeps every match, since a
      // package can legitimately belong under several tabs.
      const badge = resolveBadge(facetNames);
      const themes = themesForNames(facetNames);

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
        // Display-only reference price for the standing offer — grossed up
        // from the real payable figure so the two can never disagree, and 0
        // (which hides the savings row) whenever there's no real price.
        originalPrice: referencePriceFor(pricing.perAdult),
        totalPrice: pricing.total,
        pricedForAdults: CARD_PRICING_ADULTS,
        inclusions: inclusionKeys(pricing.inclusions),
        highlights: buildHighlights(pricing.inclusions),
        ...(badge ? { badge: badge.label, badgeColor: badge.color } : {}),
        themes,
      };
    })
    .filter((p): p is PackageCardItem => p !== null);
}
