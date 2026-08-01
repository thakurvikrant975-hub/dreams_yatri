"use server";

import { db } from "@/app/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";
import {
  STAR_OPTIONS, PRICE_BUCKETS, ROOM_TYPES, PROPERTY_TYPES, MEAL_PLANS, AMENITY_OPTIONS,
  starLabel,
} from "@/app/lib/hotels/hotelFacets";
import { hotelSearchScopeWhere, starRatingWhere, type HotelSearchScope } from "./[slug]/booking-data";

export type FacetOption<T = string> = { value: T; label: string; hint?: string; count: number };

export type HotelSearchFacets = {
  total: number;
  stars: FacetOption<number>[];
  price: FacetOption[];
  roomTypes: FacetOption[];
  propertyTypes: FacetOption[];
  mealPlans: FacetOption[];
  amenities: FacetOption[];
};

/**
 * Facet counts for the current search scope (place, not sidebar selections).
 *
 * Counts are deliberately scope-only rather than cross-filtered: each option
 * answers "how many properties here have this", so the numbers stay put as
 * boxes are ticked instead of collapsing toward zero and re-ordering the list
 * under the guest's cursor. Options that would return nothing are dropped by
 * the sidebar rather than shown as dead "(0)" rows.
 */
export async function fetchHotelSearchFacets(scope: HotelSearchScope): Promise<HotelSearchFacets> {
  const base = hotelSearchScopeWhere(scope);

  const countWhere = (extra: Prisma.hotelsWhereInput) =>
    db.hotels.count({ where: { ...base, AND: [extra] } });

  const roomSome = (where: Prisma.hotel_roomsWhereInput): Prisma.hotelsWhereInput => ({
    hotelRooms: { some: { is_active: true, ...where } },
  });

  const [total, stars, price, roomTypes, propertyTypes, mealPlans, amenities] = await Promise.all([
    db.hotels.count({ where: base }),

    Promise.all(
      STAR_OPTIONS.map(async (n) => ({
        value: n,
        label: starLabel(n),
        count: await countWhere(starRatingWhere(n)),
      })),
    ),

    Promise.all(
      PRICE_BUCKETS.map(async (b) => ({
        value: b.slug,
        label: b.label,
        count: await countWhere(
          roomSome({
            pricing: {
              some: {
                is_active: true,
                price_per_night: { gte: b.min, ...(Number.isFinite(b.max) ? { lt: b.max } : {}) },
              },
            },
          }),
        ),
      })),
    ),

    Promise.all(
      ROOM_TYPES.map(async (r) => ({
        value: r.slug,
        label: r.label,
        count: await countWhere(
          roomSome({ OR: r.keywords.map((kw) => ({ name: { contains: kw, mode: "insensitive" as const } })) }),
        ),
      })),
    ),

    Promise.all(
      PROPERTY_TYPES.map(async (p) => ({
        value: p.slug,
        label: p.label,
        count: await countWhere({ category: { in: p.categories } }),
      })),
    ),

    Promise.all(
      MEAL_PLANS.map(async (m) => ({
        value: m.slug,
        label: m.label,
        hint: m.hint,
        count: await countWhere({
          room_pricing: {
            some: {
              is_active: true,
              OR: m.keywords.map((kw) => ({
                meal_type: { name: { contains: kw, mode: "insensitive" as const } },
              })),
            },
          },
        }),
      })),
    ),

    Promise.all(
      AMENITY_OPTIONS.map(async (a) => ({
        value: a,
        label: a,
        count: await countWhere(roomSome({ amenities: { array_contains: [a] } })),
      })),
    ),
  ]);

  return { total, stars, price, roomTypes, propertyTypes, mealPlans, amenities };
}
