"use server";

import { db } from "../lib/db";
import type { Prisma } from "@/app/generated/prisma/client";

// ── Input / Output types ───────────────────────────────────────────────────

export type PricingInput = {
  package_id: number;
  duration_id: number;
  route_id: number;
  stay_category_id: number;
  adults: number;
  children: number;
  infants: number;
  child_ages?: number[];
  cab_type_ids?: number[] | null; // if null/empty → use is_default cab types for duration (one per group)
  travel_date?: string | null;   // ISO date "YYYY-MM-DD"; null = fall back to today for seasonal pricing
  /** Per-stay hotel/room override — swaps which hotel_room_pricing rates a given
   *  itinerary_stays row, in place of its DB-configured default. Unknown/inactive
   *  ids fall back silently to the original room_pricing. */
  room_pricing_overrides?: { itinerary_stay_id: number; room_pricing_id: number }[] | null;
};

export type DayHotelLine = {
  hotel_id: number;
  room_pricing_id: number;    // identifies the exact hotel+room+plan rate variant booked
  room_id: number | null;
  occupancy_selected: number; // occupancy tier the price was resolved at
  hotel_name: string;
  hotel_city: string | null;
  hotel_state: string | null;
  hotel_address: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  room_name: string | null;
  plan_name: string | null;
  bed_capacity: number;       // people who sleep on standard beds (max_occupancy)
  extra_bed_capacity: number; // additional mattresses allowed per room
  rooms_count: number;
  price_per_room: number;
  mattresses_count: number;   // total extra mattresses needed
  extra_bed_rate: number;     // price per mattress per night
  num_nights: number;
  total: number;
};

export type DayMealLine = {
  meal_type: string;          // e.g. "BREAKFAST"
  label: string;              // display name e.g. "Breakfast"
  hotel_name: string;
  price_per_person: number;   // effective price after weekend/season resolution
  persons: number;            // adults + children (no infants for meals)
  total: number;
};

export type DayActivityLine = {
  id: number;
  variant_id: number | null;  // the chosen pricing category/variant
  variant_label: string | null;
  name: string;
  is_optional: boolean;
  pricing_type: string;       // "PER_PERSON" | "PER_GROUP"
  adult_price: number;
  adult_count: number;
  child_price: number;
  child_count: number;
  infant_price: number;
  infant_count: number;
  total: number;
};

export type DayTransferLine = {
  id: number;
  route_id: number | null;
  vehicle_id: number | null;
  pickup_name: string | null;
  drop_name: string | null;
  vehicle_name: string | null;
  distance_km: number | null;
  km_override: number | null;
  km_used: number | null;        // km_override if set, else distance_km
  included_in_cab: true;         // transfers are always display-only; cost in cab_subtotal
  total: 0;
};

export type CabSegmentBreakdown = {
  day_from: number;
  day_to: number;
  days: number;
  km: number;
  cab_type_id: number;
  vehicle_id: number;
  vehicle_name: string;
  vehicle_capacity: number;
  destination_name: string;
  pricing_type: "PER_DAY" | "PER_KM";
  price_used: number;
  is_seasonal: boolean;
  num_vehicles: 1;                     // always 1 — upgrade instead of multiply
  upgraded: boolean;
  original_vehicle_name: string | null;
  total: number;
};

export type DayPricingBreakdown = {
  day: number;
  day_title: string;
  day_date: string | null;   // ISO "YYYY-MM-DD" for this specific day (start_date + day-1)
  hotel: DayHotelLine | null;
  meals: DayMealLine[];
  activities: DayActivityLine[];
  transfers: DayTransferLine[];
  cab_cost: number;          // per-day cab cost (sum of all segments covering this day)
  day_total: number;
};

export type FullPricingBreakdown = {
  duration_label: string;
  stay_category_label: string;
  adults: number;
  children: number;
  infants: number;
  days: DayPricingBreakdown[];
  hotel_subtotal: number;
  meal_subtotal: number;
  activity_subtotal: number;
  cab_type_label: string | null;
  cab_subtotal: number;
  cab_segments: CabSegmentBreakdown[];
  permit_subtotal: number;
  permits: { name: string; unit_price: number; price_type: string; quantity: number; total: number }[];
  base_cost: number;
  margin_percentage: number;
  margin_amount: number;
  gst_percentage: number;
  gst_amount: number;
  final_price: number;
  price_per_adult: number;
  missing_pricing_config: boolean;
};

// ── Hotel room-pricing select shape ─────────────────────────────────────────
// Shared between the itinerary's embedded default room_pricing and the
// override batch-fetch below, so both produce identical payload shapes and
// can be freely swapped for one another.
const STAY_ROOM_PRICING_SELECT = {
  id: true,
  plan_name: true,
  price_per_night: true,
  is_active: true,
  hotel: {
    select: {
      id: true,
      name: true,
      city: true,
      state: true,
      address: true,
      check_in_time: true,
      check_out_time: true,
    },
  },
  extra_bed_rate: true,
  weekend_extra_bed_rate: true,
  room: { select: { id: true, name: true, max_occupancy: true, extra_bed_capacity: true } },
  occupancy_prices: {
    orderBy: { occupancy: "asc" },
    select: { occupancy: true, price_per_night: true, weekend_price_per_night: true },
  },
  seasons: {
    where: { is_active: true },
    orderBy: { sort_order: "asc" },
    select: {
      valid_from: true,
      valid_to: true,
      price_per_night: true,
      weekend_price_per_night: true,
      extra_bed_rate: true,
      weekend_extra_bed_rate: true,
      occupancy_prices: {
        orderBy: { occupancy: "asc" },
        select: { occupancy: true, price_per_night: true, weekend_price_per_night: true },
      },
    },
  },
} satisfies Prisma.hotel_room_pricingSelect;

// ── Helpers ────────────────────────────────────────────────────────────────

function matchTier<T extends { label: string }>(
  tiers: T[],
  ...keywords: string[]
): T | null {
  return (
    tiers.find((t) => keywords.some((kw) => t.label.toLowerCase().includes(kw))) ?? null
  );
}

/** Resolve the effective cab price for a segment given a specific calendar date.
 *  Seasons are stored year-agnostically (year-2000 placeholder), so we normalise
 *  the query date to year 2000 before comparing — same pattern as hotel/activity seasons.
 */
function resolveCabPrice(
  basePricing: {
    pricing_type: string;
    price: unknown;
    seasons: Array<{
      pricing_type: string;
      valid_from: Date;
      valid_to: Date;
      weekday_price: unknown;
      weekend_price: unknown;
      is_active: boolean;
    }>;
  },
  date: Date | null,
): { weekdayPrice: number; weekendPrice: number; is_seasonal: boolean; pricing_type: "PER_DAY" | "PER_KM" } {
  const basePrice = Number(basePricing.price);
  const basePricingType = basePricing.pricing_type as "PER_DAY" | "PER_KM";

  if (!date) {
    return { weekdayPrice: basePrice, weekendPrice: basePrice, is_seasonal: false, pricing_type: basePricingType };
  }

  // Normalise to year 2000 for year-agnostic season matching
  const normalised = new Date(2000, date.getMonth(), date.getDate());
  const activeSeason = basePricing.seasons.find((s) => {
    if (!s.is_active) return false;
    const from = new Date(s.valid_from);
    const to = new Date(s.valid_to);
    const normFrom = new Date(2000, from.getMonth(), from.getDate());
    const normTo = new Date(2000, to.getMonth(), to.getDate());
    if (normFrom <= normTo) {
      return normalised >= normFrom && normalised <= normTo;
    }
    // Cross-year range (e.g., Nov → Feb)
    return normalised >= normFrom || normalised <= normTo;
  });

  if (!activeSeason) {
    return { weekdayPrice: basePrice, weekendPrice: basePrice, is_seasonal: false, pricing_type: basePricingType };
  }

  const weekdayPrice = Number(activeSeason.weekday_price);
  const weekendPrice = activeSeason.weekend_price != null && Number(activeSeason.weekend_price) > 0
    ? Number(activeSeason.weekend_price)
    : weekdayPrice;
  const pricingType = activeSeason.pricing_type as "PER_DAY" | "PER_KM";

  return { weekdayPrice, weekendPrice, is_seasonal: true, pricing_type: pricingType };
}

/**
 * Resolve the effective hotel price_per_night, extra-bed (mattress) rate, and
 * occupancy_prices for a given travel date. Seasons are stored year-agnostically
 * (year-2000 placeholder). Returns the matched season's rates, or the base room
 * pricing rates if no season applies.
 *
 * Extra-bed rate resolution mirrors the room rate: a season's own weekday/weekend
 * extra-bed rate is used when set; if a season doesn't specify one, it falls back
 * to the base room's extra-bed rate — a season overriding just the room rate
 * shouldn't silently zero out the mattress charge. Weekend variants (room and
 * extra-bed) fall back to their own weekday value when not set, at both the base
 * and season level, matching the "not provided = same as weekday" convention
 * used throughout the Seasonal Rate Calendar.
 */
type OccupancyPriceRow = { occupancy: number; price_per_night: unknown; weekend_price_per_night?: unknown };

// Occupancy-tier prices (e.g. single occupancy) get the same weekday/weekend
// split as the room rate and extra-bed rate — a tier with no weekend price of
// its own just uses its own weekday price on weekends too.
function resolveOccupancyWeekend(entry: OccupancyPriceRow, isWeekend: boolean): { occupancy: number; price_per_night: unknown } {
  return {
    occupancy: entry.occupancy,
    price_per_night: (isWeekend && entry.weekend_price_per_night != null) ? entry.weekend_price_per_night : entry.price_per_night,
  };
}

function resolveHotelSeasonPricing(
  roomPricing: {
    price_per_night: unknown;
    extra_bed_rate: unknown;
    weekend_extra_bed_rate?: unknown;
    occupancy_prices: OccupancyPriceRow[];
    seasons: {
      valid_from: Date;
      valid_to: Date;
      price_per_night: unknown;
      weekend_price_per_night?: unknown;
      extra_bed_rate?: unknown;
      weekend_extra_bed_rate?: unknown;
      occupancy_prices?: OccupancyPriceRow[];
    }[];
  },
  travelDate: Date | null,
): { basePrice: number; extraBedRate: number; occPrices: { occupancy: number; price_per_night: unknown }[] } {
  const defaultBase = Number(roomPricing.price_per_night);
  const defaultExtraBedWeekday = roomPricing.extra_bed_rate != null ? Number(roomPricing.extra_bed_rate) : 0;
  const defaultExtraBedWeekend = roomPricing.weekend_extra_bed_rate != null
    ? Number(roomPricing.weekend_extra_bed_rate)
    : defaultExtraBedWeekday;

  const isWeekend = travelDate ? (travelDate.getDay() === 0 || travelDate.getDay() === 6) : false;
  const defaultExtraBedRate = isWeekend ? defaultExtraBedWeekend : defaultExtraBedWeekday;
  const defaultOcc = roomPricing.occupancy_prices.map((op) => resolveOccupancyWeekend(op, isWeekend));

  if (!travelDate || roomPricing.seasons.length === 0) {
    return { basePrice: defaultBase, extraBedRate: defaultExtraBedRate, occPrices: defaultOcc };
  }

  const normalised = new Date(2000, travelDate.getMonth(), travelDate.getDate());
  const matchedSeason = roomPricing.seasons.find((s) => {
    const from = new Date(s.valid_from);
    const to = new Date(s.valid_to);
    const normFrom = new Date(2000, from.getMonth(), from.getDate());
    const normTo = new Date(2000, to.getMonth(), to.getDate());
    if (normFrom <= normTo) {
      return normalised >= normFrom && normalised <= normTo;
    }
    return normalised >= normFrom || normalised <= normTo;
  });

  if (!matchedSeason) return { basePrice: defaultBase, extraBedRate: defaultExtraBedRate, occPrices: defaultOcc };

  // Use weekend price on Sat (6) or Sun (0) when configured
  const seasonBase = (isWeekend && matchedSeason.weekend_price_per_night != null)
    ? Number(matchedSeason.weekend_price_per_night)
    : Number(matchedSeason.price_per_night);

  const seasonExtraBedWeekday = matchedSeason.extra_bed_rate != null
    ? Number(matchedSeason.extra_bed_rate)
    : defaultExtraBedWeekday;
  const seasonExtraBedWeekend = matchedSeason.weekend_extra_bed_rate != null
    ? Number(matchedSeason.weekend_extra_bed_rate)
    : seasonExtraBedWeekday;
  const seasonExtraBedRate = isWeekend ? seasonExtraBedWeekend : seasonExtraBedWeekday;

  const seasonOcc = (matchedSeason.occupancy_prices ?? []).map((op) => resolveOccupancyWeekend(op, isWeekend));
  return {
    basePrice: seasonBase,
    extraBedRate: seasonExtraBedRate,
    occPrices: seasonOcc.length > 0 ? seasonOcc : defaultOcc,
  };
}

/**
 * Pick the effective pricing tiers for an activity variant given a travel date.
 * Seasons are stored year-agnostically (year 2000 placeholder). We normalise the
 * travel date to year 2000 before comparing so seasons like Apr–Sep apply to any year.
 * Falls back to the variant's default pricing when no season matches or no date given.
 */
function resolveActivityPricingTiers(
  variant: {
    pricing: { label: string; price: unknown; is_active: boolean; sort_order: number }[];
    seasons: {
      valid_from: Date;
      valid_to: Date;
      is_active: boolean;
      weekend_price: unknown;
      pricing: { label: string; price: unknown; is_active: boolean; sort_order: number }[];
    }[];
  },
  travelDate: Date | null,
): { label: string; price: unknown }[] {
  if (travelDate && variant.seasons.length > 0) {
    // Normalise travel date to year 2000 for year-agnostic comparison
    const normalised = new Date(2000, travelDate.getMonth(), travelDate.getDate());
    const matchedSeason = variant.seasons.find((s) => {
      if (!s.is_active || s.pricing.length === 0) return false;
      const from = new Date(s.valid_from);
      const to = new Date(s.valid_to);
      const normFrom = new Date(2000, from.getMonth(), from.getDate());
      const normTo = new Date(2000, to.getMonth(), to.getDate());
      if (normFrom <= normTo) {
        return normalised >= normFrom && normalised <= normTo;
      }
      return normalised >= normFrom || normalised <= normTo;
    });
    if (matchedSeason) {
      // On Sat (6) or Sun (0), use weekend_price when configured
      const isWeekend = travelDate.getDay() === 0 || travelDate.getDay() === 6;
      if (isWeekend && matchedSeason.weekend_price != null) {
        return matchedSeason.pricing.map((p) => ({ ...p, price: matchedSeason.weekend_price }));
      }
      return matchedSeason.pricing;
    }
  }
  // Default (non-seasonal) pricing
  return variant.pricing;
}

/** Resolve the effective price for a hotel meal pricing given a travel date.
 *  Seasons use the same year-2000 placeholder pattern as activity/hotel seasons.
 */
function resolveMealPrice(
  meal: {
    price: number;
    weekend_price: number | null;
    seasons: { valid_from: Date; valid_to: Date; price: number; weekend_price: number | null; is_active: boolean }[];
  },
  travelDate: Date | null,
): number {
  const isWeekend = travelDate ? (travelDate.getDay() === 0 || travelDate.getDay() === 6) : false;
  if (travelDate && meal.seasons.length > 0) {
    const normalised = new Date(2000, travelDate.getMonth(), travelDate.getDate());
    const matched = meal.seasons.find((s) => {
      if (!s.is_active) return false;
      const from = new Date(2000, new Date(s.valid_from).getMonth(), new Date(s.valid_from).getDate());
      const to   = new Date(2000, new Date(s.valid_to).getMonth(),   new Date(s.valid_to).getDate());
      if (from <= to) return normalised >= from && normalised <= to;
      return normalised >= from || normalised <= to;
    });
    if (matched) {
      return (isWeekend && matched.weekend_price != null) ? matched.weekend_price : matched.price;
    }
  }
  return (isWeekend && meal.weekend_price != null) ? meal.weekend_price : meal.price;
}

// ── Core calculator ────────────────────────────────────────────────────────

export async function computePackagePrice(
  input: PricingInput,
): Promise<FullPricingBreakdown> {
  const {
    package_id, duration_id, route_id, stay_category_id,
    adults, children, infants, child_ages,
    cab_type_ids, travel_date, room_pricing_overrides,
  } = input;

  // When no travel date is provided, fall back to today so seasonal pricing is applied.
  const travelDateObj = travel_date ? new Date(travel_date) : new Date();

  const [itineraries, pricingConfig, duration, stayCategory, loadedCabTypes, includedPermits] = await Promise.all([
    db.package_itineraries.findMany({
      where: { package_id, duration_id, route_id },
      orderBy: { day: "asc" },
      include: {
        // ── Hotel stays ────────────────────────────────────────────────────
        itineraryStays: {
          where: { stay_category_id },
          include: {
            room_pricing: { select: STAY_ROOM_PRICING_SELECT },
          },
        },
        // ── Activities ─────────────────────────────────────────────────────
        itinerary_activities: {
          orderBy: { sort_order: "asc" },
          include: {
            activity: { select: { id: true, name: true } },
            variant: {
              include: {
                pricing: {
                  where: { is_active: true },
                  orderBy: { sort_order: "asc" },
                },
                seasons: {
                  where: { is_active: true },
                  orderBy: { sort_order: "asc" },
                  include: {
                    pricing: {
                      where: { is_active: true },
                      orderBy: { sort_order: "asc" },
                    },
                  },
                },
              },
            },
          },
        },
        // ── Transfers ──────────────────────────────────────────────────────
        itinerary_transfers: {
          orderBy: { sort_order: "asc" },
          select: {
            id: true, route_id: true, vehicle_id: true, km_override: true,
            route: { select: { pickup_name: true, drop_name: true, distance_km: true } },
            vehicle: { select: { id: true, name: true } },
          },
        },
      },
    }),
    db.package_pricing.findUnique({
      where: {
        package_id_duration_id_stay_category_id: { package_id, duration_id, stay_category_id },
      },
    }),
    db.package_durations.findUnique({ where: { id: duration_id }, select: { label: true } }),
    db.package_stay_categories.findUnique({ where: { id: stay_category_id }, select: { label: true } }),
    // Load ALL active cab types for the duration — upgrade logic selects the right one per group
    db.package_cab_types.findMany({
      where: { package_id, duration_id, is_active: true },
      include: {
        vehicle: { select: { name: true, passenger_capacity: true } },
        segments: {
          orderBy: { sort_order: "asc" },
          include: {
            cab_pricing: {
              select: {
                pricing_type: true,
                price: true,
                location:    { select: { name: true } },
                destination: { select: { name: true } },
                seasons: {
                  where: { is_active: true },
                  select: {
                    pricing_type: true,
                    valid_from: true,
                    valid_to: true,
                    weekday_price: true,
                    weekend_price: true,
                    is_active: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    // Permits included in the package price for this duration — permit_id/
    // cab_type_id (+ the joined vehicle rates) let a permit's real price track
    // whichever vehicle the matching cab type currently resolves to, instead
    // of the flat price/price_type fallback columns.
    db.package_permits.findMany({
      where: { package_id, duration_id, is_included: true },
      orderBy: { sort_order: "asc" },
      select: {
        name: true, price: true, price_type: true,
        permit_id: true, cab_type_id: true,
        permitRef: { select: { vehicleRates: { select: { vehicle_id: true, price_per_vehicle: true } } } },
      },
    }),
  ]);

  // ── Hotel/room override resolution ──────────────────────────────────────
  // Swaps in an alternate hotel_room_pricing row for specific itinerary_stays,
  // in place of their DB-configured default. Unknown or inactive override ids
  // fall back silently to the original room_pricing, never leaving a stay
  // unpriced. Applied once, up front, so every downstream usage of
  // `itineraries` for stay-related data (meal-hotel lookup, day costing) sees
  // the resolved selection.
  const overridesByStayId = new Map<number, number>(
    (room_pricing_overrides ?? []).map((o) => [o.itinerary_stay_id, o.room_pricing_id]),
  );
  const overrideRoomPricingIds = [...new Set(overridesByStayId.values())];
  const overrideRows = overrideRoomPricingIds.length > 0
    ? await db.hotel_room_pricing.findMany({
        where: { id: { in: overrideRoomPricingIds } },
        select: STAY_ROOM_PRICING_SELECT,
      })
    : [];
  const overrideRowsById = new Map(overrideRows.map((r) => [r.id, r]));

  const resolvedItineraries = itineraries.map((itin) => ({
    ...itin,
    itineraryStays: itin.itineraryStays.map((stay) => {
      const overrideId = overridesByStayId.get(stay.id);
      const overrideRow = overrideId != null ? overrideRowsById.get(overrideId) : undefined;
      if (!overrideRow || !overrideRow.is_active) return stay; // deleted/inactive → keep original
      return { ...stay, room_pricing_id: overrideRow.id, room_pricing: overrideRow };
    }),
  }));

  // ── Cab upgrade logic ──────────────────────────────────────────────────────
  // Group all cab types by their first segment's day range, then for each group
  // pick the preferred cab (from cab_type_ids / is_default). If it can't fit all
  // passengers (adults + children) in a single vehicle, upgrade to the smallest
  // cab in the group that can. Always 1 vehicle — never multiply.

  const allCabTypes = loadedCabTypes; // full list, all active

  // Preferred IDs: user-selected, or auto-select the smallest fitting cab per group
  const passengers_for_cab = Math.max(adults + children, 1);
  const preferredCabIds = new Set<number>(
    cab_type_ids && cab_type_ids.length > 0
      ? cab_type_ids
      : (() => {
          // Mirror the CRM logic: per day-range group, pick the smallest cab that fits
          const cabsByRangeForDefault = new Map<string, (typeof allCabTypes)[0][]>();
          for (const ct of allCabTypes) {
            const key = `${ct.segments[0]?.day_from}-${ct.segments[0]?.day_to}`;
            if (!cabsByRangeForDefault.has(key)) cabsByRangeForDefault.set(key, []);
            cabsByRangeForDefault.get(key)!.push(ct);
          }
          const ids: number[] = [];
          for (const cabs of cabsByRangeForDefault.values()) {
            const sorted = [...cabs].sort((a, b) => a.vehicle.passenger_capacity - b.vehicle.passenger_capacity);
            const optimal = sorted.find((ct) => ct.vehicle.passenger_capacity >= passengers_for_cab)
              ?? sorted[sorted.length - 1];
            if (optimal) ids.push(optimal.id);
          }
          return ids;
        })(),
  );

  type CabTypeRecord = (typeof allCabTypes)[0];
  type EffectiveCabEntry = {
    cab: CabTypeRecord;
    upgraded: boolean;
    originalVehicleName: string | null;
  };

  // Group all cabs by their first-segment day range
  const cabsByRange = new Map<string, CabTypeRecord[]>();
  for (const ct of allCabTypes) {
    const firstSeg = ct.segments[0];
    if (!firstSeg) continue;
    const key = `${firstSeg.day_from}-${firstSeg.day_to}`;
    if (!cabsByRange.has(key)) cabsByRange.set(key, []);
    cabsByRange.get(key)!.push(ct);
  }

  // For each group, pick effective cab (upgrade if needed)
  const passengers = Math.max(adults + children, 1);
  const effectiveCabMap = new Map<string, EffectiveCabEntry>();

  for (const [rangeKey, cabs] of cabsByRange) {
    const preferred = cabs.find((ct) => preferredCabIds.has(ct.id));
    if (!preferred) continue; // no preferred cab selected for this range — skip

    if (preferred.vehicle.passenger_capacity >= passengers) {
      effectiveCabMap.set(rangeKey, { cab: preferred, upgraded: false, originalVehicleName: null });
    } else {
      // Upgrade: find the smallest cab in this group that fits all passengers
      const sorted = [...cabs].sort((a, b) => a.vehicle.passenger_capacity - b.vehicle.passenger_capacity);
      const suitable = sorted.find((ct) => ct.vehicle.passenger_capacity >= passengers);
      const effective = suitable ?? sorted[sorted.length - 1]; // fall back to largest if none fits
      effectiveCabMap.set(rangeKey, {
        cab: effective,
        upgraded: effective.id !== preferred.id,
        originalVehicleName: effective.id !== preferred.id ? preferred.vehicle.name : null,
      });
    }
  }

  const margin_percentage = Number(pricingConfig?.margin_percentage ?? 10);
  const gst_percentage = Number(pricingConfig?.gst_percentage ?? 5);

  // ── Fetch hotel meal pricings for all hotels in stays ─────────────────────
  type MealPricingRow = {
    hotel_id: number; id: number; meal_type: string; label: string;
    price: number; weekend_price: number | null;
    seasons: { valid_from: Date; valid_to: Date; price: number; weekend_price: number | null; is_active: boolean }[];
  };

  const stayHotelIds = [
    ...new Set(
      resolvedItineraries.flatMap((itin) => itin.itineraryStays.map((s) => s.room_pricing.hotel.id)),
    ),
  ];

  const rawMealPricings = stayHotelIds.length > 0
    ? await db.hotel_meal_pricing.findMany({
        where: { hotel_id: { in: stayHotelIds }, is_active: true },
        orderBy: { sort_order: "asc" },
        select: {
          id: true, hotel_id: true, meal_type: true, label: true,
          price: true, weekend_price: true,
          seasons: {
            where: { is_active: true },
            orderBy: { sort_order: "asc" },
            select: { valid_from: true, valid_to: true, price: true, weekend_price: true, is_active: true },
          },
        },
      })
    : [];

  const mealsByHotelId = new Map<number, MealPricingRow[]>();
  for (const mp of rawMealPricings) {
    const row: MealPricingRow = {
      hotel_id: mp.hotel_id,
      id: mp.id,
      meal_type: mp.meal_type,
      label: mp.label,
      price: Number(mp.price),
      weekend_price: mp.weekend_price != null ? Number(mp.weekend_price) : null,
      seasons: mp.seasons.map((s) => ({
        valid_from: s.valid_from,
        valid_to: s.valid_to,
        price: Number(s.price),
        weekend_price: s.weekend_price != null ? Number(s.weekend_price) : null,
        is_active: s.is_active,
      })),
    };
    if (!mealsByHotelId.has(mp.hotel_id)) mealsByHotelId.set(mp.hotel_id, []);
    mealsByHotelId.get(mp.hotel_id)!.push(row);
  }

  // ── Build day → km map from itinerary_transfers ────────────────────────
  // km_override on the transfer takes priority over the auto road distance.
  const dayKmMap = new Map<number, number>();
  for (const itin of itineraries) {
    let dayKm = 0;
    for (const tr of itin.itinerary_transfers) {
      const km = tr.km_override ?? (tr.route?.distance_km ? Number(tr.route.distance_km) : 0);
      dayKm += km;
    }
    dayKmMap.set(itin.day, dayKm);
  }

  // ── Pre-compute per-day cab cost (uses effective/upgraded cabs, always 1 vehicle) ─────
  const dayCabCostMap = new Map<number, number>();
  for (const { cab: cabTypeData } of effectiveCabMap.values()) {
    if (!cabTypeData.segments.length) continue;

    for (const seg of cabTypeData.segments) {
      if (!seg.cab_pricing) continue; // orphaned FK — skip segment
      const segStartDate = travelDateObj
        ? new Date(travelDateObj.getTime() + (seg.day_from - 1) * 24 * 60 * 60 * 1000)
        : null;
      const resolved = resolveCabPrice(
        { pricing_type: seg.cab_pricing.pricing_type, price: seg.cab_pricing.price, seasons: seg.cab_pricing.seasons },
        segStartDate,
      );

      if (resolved.pricing_type === "PER_DAY") {
        for (let d = seg.day_from; d <= seg.day_to; d++) {
          const dayDate = travelDateObj
            ? new Date(travelDateObj.getTime() + (d - 1) * 24 * 60 * 60 * 1000)
            : null;
          const isWeekend = dayDate ? (dayDate.getDay() === 0 || dayDate.getDay() === 6) : false;
          const dayRate = isWeekend ? resolved.weekendPrice : resolved.weekdayPrice;
          dayCabCostMap.set(d, (dayCabCostMap.get(d) ?? 0) + dayRate); // ×1 vehicle
        }
      } else {
        const totalKm = (() => {
          let s = 0;
          for (let d = seg.day_from; d <= seg.day_to; d++) s += dayKmMap.get(d) ?? 0;
          return s;
        })();
        for (let d = seg.day_from; d <= seg.day_to; d++) {
          const dayKm = dayKmMap.get(d) ?? 0;
          if (totalKm > 0) {
            dayCabCostMap.set(d, (dayCabCostMap.get(d) ?? 0) + resolved.weekdayPrice * dayKm);
          }
        }
      }
    }
  }

  // ── Fallback variants for activities saved without a variant_id ────────
  const noVariantActivityIds = [
    ...new Set(
      itineraries.flatMap((itin) =>
        itin.itinerary_activities.filter((ia) => !ia.variant).map((ia) => ia.activity.id),
      ),
    ),
  ];
  type FallbackVariant = {
    id: number;
    name: string;
    activity_id: number;
    pricing_type: string;
    pricing: { label: string; price: unknown; is_active: boolean; sort_order: number }[];
    seasons: {
      valid_from: Date;
      valid_to: Date;
      is_active: boolean;
      weekend_price: unknown;
      pricing: { label: string; price: unknown; is_active: boolean; sort_order: number }[];
    }[];
  };
  const fallbackVariantMap = new Map<number, FallbackVariant>();
  if (noVariantActivityIds.length > 0) {
    const fallbacks = await db.activity_variants.findMany({
      where: { activity_id: { in: noVariantActivityIds }, is_active: true },
      orderBy: { sort_order: "asc" },
      include: {
        pricing: { where: { is_active: true }, orderBy: { sort_order: "asc" } },
        seasons: {
          where: { is_active: true },
          orderBy: { sort_order: "asc" },
          include: { pricing: { where: { is_active: true }, orderBy: { sort_order: "asc" } } },
        },
      },
    });
    for (const v of fallbacks) {
      const effectiveTiers = resolveActivityPricingTiers(v, travelDateObj);
      if (!fallbackVariantMap.has(v.activity_id) && effectiveTiers.length > 0) {
        fallbackVariantMap.set(v.activity_id, v);
      }
    }
  }

  // ── Build day → active stay map ───────────────────────────────────────────
  // A stay with check-in on Day D and num_nights=N is "active" on nights D, D+1 … D+N-1.
  // - Breakfast on Day N  = served by the hotel from stayByDay[N-1] (checkout morning)
  // - All other meals     = served by the hotel from stayByDay[N]   (arrival evening)
  type StayRecord = (typeof resolvedItineraries)[0]["itineraryStays"][0];
  const stayByDay = new Map<number, StayRecord>();
  for (const itin of resolvedItineraries) {
    for (const stay of itin.itineraryStays) {
      for (let d = itin.day; d < itin.day + stay.num_nights; d++) {
        stayByDay.set(d, stay);
      }
    }
  }

  let hotel_subtotal = 0;
  let meal_subtotal = 0;
  let activity_subtotal = 0;

  const days: DayPricingBreakdown[] = resolvedItineraries.map((itin) => {

    // Compute the actual calendar date for this specific day of the itinerary.
    // Day 1 = travelDate, Day 2 = travelDate + 1 day, etc.
    const dayDate = travelDateObj
      ? new Date(travelDateObj.getTime() + (itin.day - 1) * 24 * 60 * 60 * 1000)
      : null;
    const dayDateISO = dayDate ? dayDate.toISOString().slice(0, 10) : null;

    // ── Hotel ────────────────────────────────────────────────────────────────
    const stay = itin.itineraryStays[0] ?? null;
    let hotel: DayHotelLine | null = null;

    if (stay) {
      // ── Room & mattress capacity ──────────────────────────────────────────
      // bed_capacity  = people who sleep on standard beds (max_occupancy on the room)
      // extra_bed_cap = additional people on mattresses per room
      // effective_cap = bed_capacity + extra_bed_cap (total per room)
      // persons       = adults + children (infants excluded from room count)
      const bedCapacity   = stay.room_pricing.room?.max_occupancy ?? 2;
      const extraBedCap   = stay.room_pricing.room?.extra_bed_capacity ?? 1;
      const effectiveCap  = bedCapacity + extraBedCap;
      const persons       = Math.max(adults + children, 1);
      const roomsNeeded   = Math.ceil(persons / effectiveCap);
      const mattresses    = Math.max(0, persons - roomsNeeded * bedCapacity);
      const numNights     = stay.num_nights;
      const typicalOccupancy = Math.min(adults, bedCapacity);

      // A multi-night stay can cross a season boundary or a weekday→weekend
      // transition partway through, so every night is resolved (room rate,
      // extra-bed rate, occupancy tier) at ITS OWN date and summed — never
      // resolved once and flatly multiplied by num_nights.
      let roomCost = 0;
      let mattressCost = 0;
      let firstNightPricePerRoom = 0;
      let firstNightExtraBedRate = 0;
      for (let n = 0; n < numNights; n++) {
        const nightDate = travelDateObj
          ? new Date(travelDateObj.getTime() + (itin.day - 1 + n) * 24 * 60 * 60 * 1000)
          : null;
        const { basePrice, extraBedRate, occPrices } = resolveHotelSeasonPricing(stay.room_pricing, nightDate);
        let nightPricePerRoom = basePrice;
        if (occPrices.length > 0) {
          const sorted = [...occPrices].sort((a, b) => b.occupancy - a.occupancy);
          const match = sorted.find((op) => op.occupancy <= typicalOccupancy) ?? sorted[sorted.length - 1];
          nightPricePerRoom = Number(match.price_per_night);
        }
        roomCost += roomsNeeded * nightPricePerRoom;
        mattressCost += mattresses * extraBedRate;
        if (n === 0) {
          firstNightPricePerRoom = nightPricePerRoom;
          firstNightExtraBedRate = extraBedRate;
        }
      }
      const total = roomCost + mattressCost;

      hotel = {
        hotel_id: stay.room_pricing.hotel.id,
        room_pricing_id: stay.room_pricing_id,
        room_id: stay.room_pricing.room?.id ?? null,
        occupancy_selected: typicalOccupancy,
        hotel_name: stay.room_pricing.hotel.name,
        hotel_city: stay.room_pricing.hotel.city ?? null,
        hotel_state: stay.room_pricing.hotel.state ?? null,
        hotel_address: stay.room_pricing.hotel.address ?? null,
        check_in_time: stay.room_pricing.hotel.check_in_time ?? null,
        check_out_time: stay.room_pricing.hotel.check_out_time ?? null,
        room_name: stay.room_pricing.room?.name ?? null,
        plan_name: stay.room_pricing.plan_name,
        bed_capacity: bedCapacity,
        extra_bed_capacity: extraBedCap,
        rooms_count: roomsNeeded,
        // First-night rate — a simple "per night" headline; `total` below is
        // the true sum across all nights and is what actually gets charged.
        price_per_room: firstNightPricePerRoom,
        mattresses_count: mattresses,
        extra_bed_rate: firstNightExtraBedRate,
        num_nights: numNights,
        total,
      };
      hotel_subtotal += total;
    }

    // ── Meals (per-day logic) ─────────────────────────────────────────────────
    // Breakfast on this day comes from yesterday's hotel (checkout morning).
    // All other meals come from today's hotel (arrival evening).
    // Persons = adults + children only (no infants for meals).
    const meals: DayMealLine[] = [];
    const mealPersons = adults + children;
    const currDayStay = stayByDay.get(itin.day) ?? null;
    const prevDayStay = stayByDay.get(itin.day - 1) ?? null;

    const addMeal = (sourceStay: StayRecord, mealKey: string) => {
      const hotelId = sourceStay.room_pricing.hotel.id;
      const hotelMeals = mealsByHotelId.get(hotelId) ?? [];
      const mealPricing = hotelMeals.find((m) => m.meal_type.toLowerCase() === mealKey);
      if (!mealPricing) return;
      const price = resolveMealPrice(mealPricing, dayDate);
      const total = price * mealPersons;
      meals.push({
        meal_type: mealPricing.meal_type,
        label: mealPricing.label,
        hotel_name: sourceStay.room_pricing.hotel.name,
        price_per_person: price,
        persons: mealPersons,
        total,
      });
      meal_subtotal += total;
    };

    // Breakfast: from previous night's hotel
    if (prevDayStay && prevDayStay.active_meals.includes("breakfast")) {
      addMeal(prevDayStay, "breakfast");
    }
    // All non-breakfast meals: from today's hotel
    if (currDayStay) {
      for (const mealKey of currDayStay.active_meals) {
        if (mealKey === "breakfast") continue; // breakfast handled above
        addMeal(currDayStay, mealKey);
      }
    }

    // ── Activities ───────────────────────────────────────────────────────────
    const activities: DayActivityLine[] = itin.itinerary_activities.map((ia) => {
      const fallback = fallbackVariantMap.get(ia.activity.id);
      const pricingTiers = ia.variant
        ? resolveActivityPricingTiers(ia.variant, dayDate)
        : (fallback ? resolveActivityPricingTiers(fallback, dayDate) : []);

      const pricingType =
        (ia.variant?.pricing_type ??
          fallback?.pricing_type ??
          "PER_PERSON") as string;

      let adult_price = 0;
      let child_price = 0;
      let infant_price = 0;
      let total = 0;

      if (pricingTiers.length > 0) {
        if (pricingType === "PER_GROUP" || pricingType === "FLAT_RATE" || pricingType === "PER_VEHICLE") {
          adult_price = Number(pricingTiers[0].price);
          total = ia.is_optional ? 0 : adult_price;
        } else {
          const adultTier =
            matchTier(pricingTiers, "adult") ??
            pricingTiers.find(
              (t) =>
                !t.label.toLowerCase().includes("child") &&
                !t.label.toLowerCase().includes("infant") &&
                !t.label.toLowerCase().includes("baby"),
            ) ??
            pricingTiers[0];
          const childTier = matchTier(pricingTiers, "child", "children");
          const infantTier = matchTier(pricingTiers, "infant", "baby", "toddler");

          adult_price = adultTier ? Number(adultTier.price) : 0;
          child_price = childTier ? Number(childTier.price) : adult_price;
          infant_price = infantTier ? Number(infantTier.price) : 0;

          total = ia.is_optional
            ? 0
            : adult_price * adults + child_price * children + infant_price * infants;
        }
      }

      if (!ia.is_optional) activity_subtotal += total;

      return {
        id: ia.activity.id,
        variant_id: ia.variant ? ia.variant.id : (fallback?.id ?? null),
        variant_label: ia.variant ? ia.variant.name : (fallback?.name ?? null),
        name: ia.activity.name,
        is_optional: ia.is_optional,
        pricing_type: pricingType,
        adult_price,
        adult_count: adults,
        child_price,
        child_count: children,
        infant_price,
        infant_count: infants,
        total,
      };
    });

    // ── Transfers — display only, cost captured at segment level ─────────────
    const transfers: DayTransferLine[] = itin.itinerary_transfers.map((tr) => {
      const autoKm = tr.route?.distance_km ? Number(tr.route.distance_km) : null;
      const overrideKm = tr.km_override ?? null;
      return {
        id: tr.id,
        route_id: tr.route_id ?? null,
        vehicle_id: tr.vehicle_id ?? null,
        pickup_name: tr.route?.pickup_name ?? null,
        drop_name: tr.route?.drop_name ?? null,
        vehicle_name: tr.vehicle?.name ?? null,
        distance_km: autoKm,
        km_override: overrideKm,
        km_used: overrideKm ?? autoKm,
        included_in_cab: true,
        total: 0,
      };
    });

    const cab_cost = dayCabCostMap.get(itin.day) ?? 0;
    const day_total =
      (hotel?.total ?? 0) +
      meals.reduce((s, m) => s + m.total, 0) +
      activities.filter((a) => !a.is_optional).reduce((s, a) => s + a.total, 0) +
      cab_cost;

    return { day: itin.day, day_title: itin.title, day_date: dayDateISO, hotel, meals, activities, transfers, cab_cost, day_total };
  });

  // ── Cab cost computation (1 vehicle per segment — upgrade if needed) ──────
  const cab_type_label = effectiveCabMap.size > 0
    ? Array.from(effectiveCabMap.values())
        .map(({ cab, upgraded, originalVehicleName }) =>
          upgraded ? `${cab.vehicle.name} ↑` : cab.vehicle.name,
        )
        .join(" + ")
    : null;

  const cab_segments: CabSegmentBreakdown[] = [];
  let cab_subtotal = 0;

  for (const { cab: cabTypeData, upgraded, originalVehicleName } of effectiveCabMap.values()) {
    if (!cabTypeData.segments.length) continue;

    for (const seg of cabTypeData.segments) {
      if (!seg.cab_pricing) continue; // orphaned FK — skip segment
      const segDays = seg.day_to - seg.day_from + 1;
      const segStartDate = travelDateObj
        ? new Date(travelDateObj.getTime() + (seg.day_from - 1) * 24 * 60 * 60 * 1000)
        : null;

      const resolved = resolveCabPrice(
        { pricing_type: seg.cab_pricing.pricing_type, price: seg.cab_pricing.price, seasons: seg.cab_pricing.seasons },
        segStartDate,
      );

      let segKm = 0;
      for (let d = seg.day_from; d <= seg.day_to; d++) segKm += dayKmMap.get(d) ?? 0;

      let segTotal = 0;
      let price_used = resolved.weekdayPrice;

      if (resolved.pricing_type === "PER_DAY") {
        if (travelDateObj) {
          for (let d = seg.day_from; d <= seg.day_to; d++) {
            const dayDate = new Date(travelDateObj.getTime() + (d - 1) * 24 * 60 * 60 * 1000);
            const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
            segTotal += isWeekend ? resolved.weekendPrice : resolved.weekdayPrice;
          }
        } else {
          segTotal = resolved.weekdayPrice * segDays;
        }
        price_used = resolved.weekdayPrice;
      } else {
        segTotal = resolved.weekdayPrice * segKm;
        price_used = resolved.weekdayPrice;
      }

      cab_subtotal += segTotal;

      cab_segments.push({
        day_from: seg.day_from,
        day_to: seg.day_to,
        days: segDays,
        km: segKm,
        cab_type_id: cabTypeData.id,
        vehicle_id: cabTypeData.vehicle_id,
        vehicle_name: cabTypeData.vehicle.name,
        vehicle_capacity: cabTypeData.vehicle.passenger_capacity,
        destination_name: seg.cab_pricing.location?.name ?? seg.cab_pricing.destination?.name ?? "—",
        pricing_type: resolved.pricing_type,
        price_used,
        is_seasonal: resolved.is_seasonal,
        num_vehicles: 1,
        upgraded,
        original_vehicle_name: originalVehicleName,
        total: segTotal,
      });
    }
  }

  const pax_count = adults + children;
  const permits = includedPermits.map((p) => {
    let unit_price = Number(p.price);
    let price_type = (p.price_type ?? "FLAT") as string;

    // Linked to a catalog permit + a specific cab type — resolve the price
    // from that cab type's EFFECTIVE vehicle (post cab-upgrade logic above),
    // so it always tracks whichever vehicle actually ends up being used,
    // not just whatever was configured at add-time.
    if (p.permit_id != null && p.cab_type_id != null) {
      const configuredCab = loadedCabTypes.find((ct) => ct.id === p.cab_type_id);
      const firstSeg = configuredCab?.segments[0];
      const rangeKey = firstSeg ? `${firstSeg.day_from}-${firstSeg.day_to}` : null;
      const effectiveVehicleId = (rangeKey ? effectiveCabMap.get(rangeKey)?.cab.vehicle_id : null)
        ?? configuredCab?.vehicle_id
        ?? null;
      const rate = effectiveVehicleId != null
        ? p.permitRef?.vehicleRates.find((vr) => vr.vehicle_id === effectiveVehicleId)
        : undefined;
      if (rate) {
        unit_price = Number(rate.price_per_vehicle);
        price_type = "PER_VEHICLE";
      }
    }

    const quantity = price_type === "PER_PERSON" ? pax_count : 1;
    return { name: p.name, unit_price, price_type, quantity, total: unit_price * quantity };
  });
  const permit_subtotal = permits.reduce((sum, p) => sum + p.total, 0);

  // Round UP to a whole rupee at every additive step (not just at display
  // time) so the total we quote can never be a fractional rupee — the amount
  // shown to a customer must always match what the gateway actually charges.
  const base_cost = Math.ceil(hotel_subtotal + meal_subtotal + activity_subtotal + cab_subtotal + permit_subtotal);
  const margin_amount = Math.ceil((base_cost * margin_percentage) / 100);
  const taxable = base_cost + margin_amount;
  const gst_amount = Math.ceil((taxable * gst_percentage) / 100);
  const final_price = taxable + gst_amount;

  return {
    duration_label: duration?.label ?? "",
    stay_category_label: stayCategory?.label ?? "",
    adults,
    children,
    infants,
    days,
    hotel_subtotal,
    meal_subtotal,
    activity_subtotal,
    cab_type_label,
    cab_subtotal,
    cab_segments,
    permit_subtotal,
    permits,
    base_cost,
    margin_percentage,
    margin_amount,
    gst_percentage,
    gst_amount,
    final_price,
    price_per_adult: adults > 0 ? Math.ceil(final_price / adults) : final_price,
    missing_pricing_config: !pricingConfig,
  };
}

// ── Package Builder hotel pricing ───────────────────────────────────────────
// A builder itinerary is bespoke (no package_id/duration_id/stay_category_id
// to drive the full computePackagePrice engine above), but each day's hotel
// pick already references a real hotel_room_pricing row once selected via the
// builder's own search — so its date/occupancy-aware rate can still be priced
// exactly the same way a catalog stay is, just without the cab/activity/permit
// layers that only exist for catalog packages.

export type BuilderHotelDayLine = {
  day: number;
  hotelName: string;
  roomName: string;
  pricePerRoom: number;
  roomsNeeded: number;
  mattresses: number;
  extraBedRate: number;
  total: number;
};

export type BuilderHotelPricingResult = {
  days: BuilderHotelDayLine[];
  hotelSubtotal: number;
  nightsCounted: number;
};

export async function computeBuilderHotelPricing(input: {
  travelDate: string | null;
  adults: number;
  children: number;
  days: {
    day: number;
    roomPricingId: number | null;
    /** Overrides the auto-computed (occupancy ÷ capacity) room count for
     * roomPricingId — set when the exec explicitly says how many rooms of
     * that type are needed instead of letting occupancy drive it. When set,
     * the mattress/extra-bed top-up (which assumes the auto-computed
     * occupancy split) is skipped, since a manual room count means the
     * occupancy-per-room assumption no longer holds. */
    roomsCount?: number | null;
    /** Additional, different room types booked for the same night (e.g. one
     * couple in a Deluxe Room, another in a Suite) — each priced at
     * quantity × that room's own base per-night rate. No occupancy/mattress
     * logic applies here — quantity is exactly what the exec asked for. */
    extraRooms?: { roomPricingId: number; quantity: number }[];
  }[];
}): Promise<BuilderHotelPricingResult> {
  const { travelDate, adults, children, days } = input;
  const travelDateObj = travelDate ? new Date(travelDate) : null;

  const roomPricingIds = [
    ...new Set([
      ...days.map((d) => d.roomPricingId).filter((id): id is number => id != null),
      ...days.flatMap((d) => (d.extraRooms ?? []).map((r) => r.roomPricingId)),
    ]),
  ];
  if (roomPricingIds.length === 0) {
    return { days: [], hotelSubtotal: 0, nightsCounted: 0 };
  }

  const rows = await db.hotel_room_pricing.findMany({
    where: { id: { in: roomPricingIds } },
    select: {
      id: true,
      price_per_night: true,
      extra_bed_rate: true,
      hotel: { select: { name: true } },
      room: { select: { name: true, max_occupancy: true, extra_bed_capacity: true } },
      occupancy_prices: {
        orderBy: { occupancy: "asc" },
        select: { occupancy: true, price_per_night: true, weekend_price_per_night: true },
      },
      seasons: {
        where: { is_active: true },
        orderBy: { sort_order: "asc" },
        select: {
          valid_from: true, valid_to: true, price_per_night: true, weekend_price_per_night: true,
          occupancy_prices: { select: { occupancy: true, price_per_night: true, weekend_price_per_night: true } },
        },
      },
    },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));

  const persons = Math.max(adults + children, 1);
  const lines: BuilderHotelDayLine[] = [];
  let hotelSubtotal = 0;

  for (const d of days) {
    const dayDate = travelDateObj
      ? new Date(travelDateObj.getTime() + (d.day - 1) * 24 * 60 * 60 * 1000)
      : null;

    if (d.roomPricingId != null) {
      const rp = byId.get(d.roomPricingId);
      if (rp) {
        const bedCapacity = rp.room?.max_occupancy ?? 2;
        const extraBedCap = rp.room?.extra_bed_capacity ?? 1;
        const effectiveCap = bedCapacity + extraBedCap;
        const isManualCount = d.roomsCount != null && d.roomsCount > 0;
        const roomsNeeded = isManualCount ? d.roomsCount! : Math.ceil(persons / effectiveCap);
        const mattresses = isManualCount ? 0 : Math.max(0, persons - roomsNeeded * bedCapacity);
        const extraBedRate = rp.extra_bed_rate ? Number(rp.extra_bed_rate) : 0;

        const typicalOccupancy = Math.min(adults, bedCapacity);
        const { basePrice, occPrices } = resolveHotelSeasonPricing(rp, dayDate);
        let pricePerRoom = basePrice;
        if (occPrices.length > 0) {
          const sorted = [...occPrices].sort((a, b) => b.occupancy - a.occupancy);
          const match = sorted.find((op) => op.occupancy <= typicalOccupancy) ?? sorted[sorted.length - 1];
          pricePerRoom = Number(match.price_per_night);
        }

        const total = roomsNeeded * pricePerRoom + mattresses * extraBedRate;
        hotelSubtotal += total;

        lines.push({
          day: d.day,
          hotelName: rp.hotel.name,
          roomName: rp.room?.name ?? "Room",
          pricePerRoom,
          roomsNeeded,
          mattresses,
          extraBedRate,
          total,
        });
      }
    }

    for (const extra of d.extraRooms ?? []) {
      const rp = byId.get(extra.roomPricingId);
      if (!rp) continue;
      const quantity = Math.max(1, extra.quantity);
      const { basePrice } = resolveHotelSeasonPricing(rp, dayDate);
      const total = quantity * basePrice;
      hotelSubtotal += total;

      lines.push({
        day: d.day,
        hotelName: rp.hotel.name,
        roomName: rp.room?.name ?? "Room",
        pricePerRoom: basePrice,
        roomsNeeded: quantity,
        mattresses: 0,
        extraBedRate: 0,
        total,
      });
    }
  }

  const nightsCounted = new Set(lines.map((l) => l.day)).size;
  return { days: lines, hotelSubtotal, nightsCounted };
}

// ── Package Builder cab pricing ─────────────────────────────────────────────
// Mirrors computeBuilderHotelPricing above: each day's cab pick references a
// real cab_pricing row once selected via the builder's own city-scoped search
// (searchCabsForBuilder), so the same season/weekday-weekend resolution the
// catalog engine uses (resolveCabPrice) applies here too — one line per day,
// PER_DAY rows priced flat per day, PER_KM rows multiplied by that day's
// transportDistanceKm.

export type BuilderCabDayLine = {
  day: number;
  vehicleName: string;
  pricingType: "PER_DAY" | "PER_KM";
  isWeekend: boolean;
  rate: number;
  distanceKm: number | null;
  total: number;
};

export type BuilderCabPricingResult = {
  days: BuilderCabDayLine[];
  cabSubtotal: number;
  daysCounted: number;
};

export async function computeBuilderCabPricing(input: {
  travelDate: string | null;
  days: {
    day: number;
    cabPricingId: number | null;
    transportDistanceKm: number | null;
    /** Overrides the implicit quantity of 1 for cabPricingId — e.g. 2 of the
     * same Sedan for a large group. */
    cabQuantity?: number | null;
    /** Additional, different cabs for the same day (e.g. one Sedan + one
     * SUV) — each priced at quantity × that cab's own resolved rate, using
     * the same day's transportDistanceKm for any PER_KM cab. */
    extraCabs?: { cabPricingId: number | null; quantity: number }[];
  }[];
}): Promise<BuilderCabPricingResult> {
  const { travelDate, days } = input;
  const travelDateObj = travelDate ? new Date(travelDate) : null;

  const cabPricingIds = [
    ...new Set([
      ...days.map((d) => d.cabPricingId).filter((id): id is number => id != null),
      ...days.flatMap((d) => (d.extraCabs ?? []).map((c) => c.cabPricingId).filter((id): id is number => id != null)),
    ]),
  ];
  if (cabPricingIds.length === 0) {
    return { days: [], cabSubtotal: 0, daysCounted: 0 };
  }

  const rows = await db.cab_pricing.findMany({
    where: { id: { in: cabPricingIds } },
    select: {
      id: true,
      price: true,
      pricing_type: true,
      vehicle: { select: { name: true } },
      seasons: {
        where: { is_active: true },
        select: {
          pricing_type: true, valid_from: true, valid_to: true,
          weekday_price: true, weekend_price: true, is_active: true,
        },
      },
    },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));

  const lines: BuilderCabDayLine[] = [];
  let cabSubtotal = 0;

  for (const d of days) {
    const dayDate = travelDateObj
      ? new Date(travelDateObj.getTime() + (d.day - 1) * 24 * 60 * 60 * 1000)
      : null;
    const isWeekend = dayDate ? (dayDate.getDay() === 0 || dayDate.getDay() === 6) : false;

    if (d.cabPricingId != null) {
      const cp = byId.get(d.cabPricingId);
      if (cp) {
        const { weekdayPrice, weekendPrice, pricing_type } = resolveCabPrice(cp, dayDate);
        const rate = isWeekend ? weekendPrice : weekdayPrice;
        const quantity = Math.max(1, d.cabQuantity ?? 1);
        const total = (pricing_type === "PER_KM" ? rate * (d.transportDistanceKm ?? 0) : rate) * quantity;
        cabSubtotal += total;

        lines.push({
          day: d.day,
          vehicleName: quantity > 1 ? `${cp.vehicle.name} × ${quantity}` : cp.vehicle.name,
          pricingType: pricing_type,
          isWeekend,
          rate,
          distanceKm: d.transportDistanceKm,
          total,
        });
      }
    }

    for (const extra of d.extraCabs ?? []) {
      if (extra.cabPricingId == null) continue;
      const cp = byId.get(extra.cabPricingId);
      if (!cp) continue;
      const { weekdayPrice, weekendPrice, pricing_type } = resolveCabPrice(cp, dayDate);
      const rate = isWeekend ? weekendPrice : weekdayPrice;
      const quantity = Math.max(1, extra.quantity);
      const total = (pricing_type === "PER_KM" ? rate * (d.transportDistanceKm ?? 0) : rate) * quantity;
      cabSubtotal += total;

      lines.push({
        day: d.day,
        vehicleName: quantity > 1 ? `${cp.vehicle.name} × ${quantity}` : cp.vehicle.name,
        pricingType: pricing_type,
        isWeekend,
        rate,
        distanceKm: d.transportDistanceKm,
        total,
      });
    }
  }

  const daysCounted = new Set(lines.map((l) => l.day)).size;
  return { days: lines, cabSubtotal, daysCounted };
}
