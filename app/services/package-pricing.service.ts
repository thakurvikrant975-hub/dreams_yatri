"use server";

import { db } from "../lib/db";

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
  travel_date?: string | null;   // ISO date "YYYY-MM-DD"; null = use base price
};

export type DayHotelLine = {
  hotel_name: string;
  room_name: string | null;
  plan_name: string | null;
  max_occupancy: number;
  rooms_count: number;        // ceil(adults / max_occupancy)
  price_per_room: number;     // occupancy-specific or base price_per_night
  child_charge: number;       // from hotel_child_policies
  infant_charge: number;      // typically 0
  total: number;
};

export type DayActivityLine = {
  id: number;
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
  pickup_name: string | null;
  drop_name: string | null;
  vehicle_name: string | null;
  distance_km: number | null;
  included_in_cab: true;      // transfers are always display-only; cost in cab_subtotal
  total: 0;
};

export type CabSegmentBreakdown = {
  day_from: number;
  day_to: number;
  days: number;
  km: number;
  vehicle_name: string;
  destination_name: string;
  pricing_type: "PER_DAY" | "PER_KM";
  price_used: number;         // effective price after seasonal resolution
  is_seasonal: boolean;
  num_vehicles: number;
  total: number;
};

export type DayPricingBreakdown = {
  day: number;
  day_title: string;
  day_date: string | null;   // ISO "YYYY-MM-DD" for this specific day (start_date + day-1)
  hotel: DayHotelLine | null;
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
  activity_subtotal: number;
  cab_type_label: string | null;
  cab_subtotal: number;
  cab_segments: CabSegmentBreakdown[];
  base_cost: number;
  margin_percentage: number;
  margin_amount: number;
  gst_percentage: number;
  gst_amount: number;
  final_price: number;
  price_per_adult: number;
  missing_pricing_config: boolean;
};

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
 * Resolve the effective hotel price_per_night and occupancy_prices for a given travel date.
 * Seasons are stored year-agnostically (year-2000 placeholder). Returns the matched
 * season's rates, or the base room pricing rates if no season applies.
 */
function resolveHotelSeasonPricing(
  roomPricing: {
    price_per_night: unknown;
    occupancy_prices: { occupancy: number; price_per_night: unknown }[];
    seasons: {
      valid_from: Date;
      valid_to: Date;
      price_per_night: unknown;
      weekend_price_per_night?: unknown;
      occupancy_prices?: { occupancy: number; price_per_night: unknown }[];
    }[];
  },
  travelDate: Date | null,
): { basePrice: number; occPrices: { occupancy: number; price_per_night: unknown }[] } {
  const defaultBase = Number(roomPricing.price_per_night);
  const defaultOcc = roomPricing.occupancy_prices;

  if (!travelDate || roomPricing.seasons.length === 0) {
    return { basePrice: defaultBase, occPrices: defaultOcc };
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

  if (!matchedSeason) return { basePrice: defaultBase, occPrices: defaultOcc };

  // Use weekend price on Sat (6) or Sun (0) when configured
  const isWeekend = travelDate.getDay() === 0 || travelDate.getDay() === 6;
  const seasonBase = (isWeekend && matchedSeason.weekend_price_per_night != null)
    ? Number(matchedSeason.weekend_price_per_night)
    : Number(matchedSeason.price_per_night);

  const seasonOcc = matchedSeason.occupancy_prices ?? [];
  return {
    basePrice: seasonBase,
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

// ── Core calculator ────────────────────────────────────────────────────────

export async function computePackagePrice(
  input: PricingInput,
): Promise<FullPricingBreakdown> {
  const {
    package_id, duration_id, route_id, stay_category_id,
    adults, children, infants, child_ages,
    cab_type_ids, travel_date,
  } = input;

  const travelDateObj = travel_date ? new Date(travel_date) : null;

  const [itineraries, pricingConfig, duration, stayCategory, loadedCabTypes] = await Promise.all([
    db.package_itineraries.findMany({
      where: { package_id, duration_id, route_id },
      orderBy: { day: "asc" },
      include: {
        // ── Hotel stays ────────────────────────────────────────────────────
        itineraryStays: {
          where: { stay_category_id },
          include: {
            room_pricing: {
              select: {
                plan_name: true,
                price_per_night: true,
                hotel: {
                  select: {
                    name: true,
                    childPolicies: {
                      where: { is_active: true },
                      orderBy: { sort_order: "asc" },
                      select: { charge_type: true, price: true, age_from: true, age_to: true },
                    },
                  },
                },
                room: { select: { name: true, max_occupancy: true } },
                occupancy_prices: {
                  orderBy: { occupancy: "asc" },
                  select: { occupancy: true, price_per_night: true },
                },
                seasons: {
                  where: { is_active: true },
                  orderBy: { sort_order: "asc" },
                  select: {
                    valid_from: true,
                    valid_to: true,
                    price_per_night: true,
                    weekend_price_per_night: true,
                    occupancy_prices: {
                      orderBy: { occupancy: "asc" },
                      select: { occupancy: true, price_per_night: true },
                    },
                  },
                },
              },
            },
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
          include: {
            route: { select: { pickup_name: true, drop_name: true, distance_km: true } },
            vehicle: { select: { name: true } },
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
    // Load selected cab types or all is_default=true cabs for the duration (one per group)
    db.package_cab_types.findMany({
      where:
        cab_type_ids && cab_type_ids.length > 0
          ? { id: { in: cab_type_ids } }
          : { package_id, duration_id, is_default: true, is_active: true },
      include: {
        vehicle: { select: { name: true, passenger_capacity: true } },
        segments: {
          orderBy: { sort_order: "asc" },
          include: {
            cab_pricing: {
              select: {
                pricing_type: true,
                price: true,
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
  ]);

  const margin_percentage = Number(pricingConfig?.margin_percentage ?? 10);
  const gst_percentage = Number(pricingConfig?.gst_percentage ?? 5);

  // ── Build day → km map from itinerary_transfers ────────────────────────
  // Used for PER_KM segments: sum of transfer route distance_km per day
  const dayKmMap = new Map<number, number>();
  for (const itin of itineraries) {
    let dayKm = 0;
    for (const tr of itin.itinerary_transfers) {
      if (tr.route?.distance_km) dayKm += Number(tr.route.distance_km);
    }
    dayKmMap.set(itin.day, dayKm);
  }

  // ── Pre-compute per-day cab cost for display in day breakdown ────────────
  // Done before the days loop so each day's cab_cost is available when building DayPricingBreakdown.
  const dayCabCostMap = new Map<number, number>();
  for (const cabTypeData of loadedCabTypes) {
    if (!cabTypeData.segments.length) continue;
    const vehicleCapacity = Math.max(cabTypeData.vehicle.passenger_capacity, 1);
    const numVehiclesEst = Math.ceil(Math.max(adults + children, 1) / vehicleCapacity);

    for (const seg of cabTypeData.segments) {
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
          dayCabCostMap.set(d, (dayCabCostMap.get(d) ?? 0) + dayRate * numVehiclesEst);
        }
      } else {
        // PER_KM: distribute proportionally across days by each day's km share
        const totalKm = (() => {
          let s = 0;
          for (let d = seg.day_from; d <= seg.day_to; d++) s += dayKmMap.get(d) ?? 0;
          return s;
        })();
        for (let d = seg.day_from; d <= seg.day_to; d++) {
          const dayKm = dayKmMap.get(d) ?? 0;
          if (totalKm > 0) {
            dayCabCostMap.set(d, (dayCabCostMap.get(d) ?? 0) + resolved.weekdayPrice * dayKm * numVehiclesEst);
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

  let hotel_subtotal = 0;
  let activity_subtotal = 0;

  const days: DayPricingBreakdown[] = itineraries.map((itin) => {

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
      const maxOccupancy = stay.room_pricing.room?.max_occupancy || 2;
      const roomsNeeded = Math.ceil(Math.max(adults, 1) / maxOccupancy);

      const typicalOccupancy = Math.min(adults, maxOccupancy);
      // Use the actual date for this day so weekend/seasonal rates apply correctly
      const { basePrice, occPrices } = resolveHotelSeasonPricing(stay.room_pricing, dayDate);
      let pricePerRoom = basePrice;
      if (occPrices.length > 0) {
        const sorted = [...occPrices].sort((a, b) => b.occupancy - a.occupancy);
        const match = sorted.find((op) => op.occupancy <= typicalOccupancy) ?? sorted[sorted.length - 1];
        pricePerRoom = Number(match.price_per_night);
      }

      let childCharge = 0;
      const childPolicies = stay.room_pricing.hotel?.childPolicies ?? [];
      if (children > 0 && childPolicies.length > 0) {
        if (child_ages && child_ages.length === children) {
          for (const age of child_ages) {
            const policy = childPolicies.find(p => age >= p.age_from && age <= p.age_to);
            if (policy) {
              const pp = Number(policy.price ?? 0);
              const ct = policy.charge_type.toUpperCase();
              if (ct === "FIXED_PRICE" || ct === "FIXED") childCharge += pp;
              else if (ct === "PERCENTAGE") childCharge += (pricePerRoom * pp) / 100;
            }
          }
        } else {
          const policy = childPolicies[0];
          const pp = Number(policy.price ?? 0);
          const ct = policy.charge_type.toUpperCase();
          if (ct === "FIXED_PRICE" || ct === "FIXED") childCharge = pp * children;
          else if (ct === "PERCENTAGE") childCharge = (pricePerRoom * pp) / 100 * children;
        }
      }

      const infantCharge = 0;
      const total = roomsNeeded * pricePerRoom + childCharge + infantCharge;
      hotel = {
        hotel_name: stay.room_pricing.hotel.name,
        room_name: stay.room_pricing.room?.name ?? null,
        plan_name: stay.room_pricing.plan_name,
        max_occupancy: maxOccupancy,
        rooms_count: roomsNeeded,
        price_per_room: pricePerRoom,
        child_charge: childCharge,
        infant_charge: infantCharge,
        total,
      };
      hotel_subtotal += total;
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
    const transfers: DayTransferLine[] = itin.itinerary_transfers.map((tr) => ({
      id: tr.id,
      pickup_name: tr.route?.pickup_name ?? null,
      drop_name: tr.route?.drop_name ?? null,
      vehicle_name: tr.vehicle?.name ?? null,
      distance_km: tr.route?.distance_km ? Number(tr.route.distance_km) : null,
      included_in_cab: true,
      total: 0,
    }));

    const cab_cost = dayCabCostMap.get(itin.day) ?? 0;
    const day_total =
      (hotel?.total ?? 0) +
      activities.filter((a) => !a.is_optional).reduce((s, a) => s + a.total, 0) +
      cab_cost;

    return { day: itin.day, day_title: itin.title, day_date: dayDateISO, hotel, activities, transfers, cab_cost, day_total };
  });

  // ── Cab cost computation ──────────────────────────────────────────────────
  const cab_type_label =
    loadedCabTypes.length > 0
      ? loadedCabTypes.map((ct) => ct.label ?? ct.vehicle.name).join(" + ")
      : null;
  const cab_segments: CabSegmentBreakdown[] = [];
  let cab_subtotal = 0;

  for (const cabTypeData of loadedCabTypes) {
    if (!cabTypeData.segments.length) continue;

    const vehicleCapacity = Math.max(cabTypeData.vehicle.passenger_capacity, 1);
    const numVehicles = Math.ceil(Math.max(adults + children, 1) / vehicleCapacity);

    for (const seg of cabTypeData.segments) {
      const segDays = seg.day_to - seg.day_from + 1;

      // Use the first day's date to resolve season + pricing type (season valid for whole segment)
      const segStartDate = travelDateObj
        ? new Date(travelDateObj.getTime() + (seg.day_from - 1) * 24 * 60 * 60 * 1000)
        : null;

      const resolved = resolveCabPrice(
        {
          pricing_type: seg.cab_pricing.pricing_type,
          price: seg.cab_pricing.price,
          seasons: seg.cab_pricing.seasons,
        },
        segStartDate,
      );

      // Sum km from all itinerary days within [day_from, day_to]
      let segKm = 0;
      for (let d = seg.day_from; d <= seg.day_to; d++) {
        segKm += dayKmMap.get(d) ?? 0;
      }

      let segTotal = 0;
      let price_used = resolved.weekdayPrice;

      if (resolved.pricing_type === "PER_DAY") {
        // Compute per-day total so weekend days get the weekend rate
        if (travelDateObj) {
          for (let d = seg.day_from; d <= seg.day_to; d++) {
            const dayDate = new Date(travelDateObj.getTime() + (d - 1) * 24 * 60 * 60 * 1000);
            const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
            const dayRate = isWeekend ? resolved.weekendPrice : resolved.weekdayPrice;
            segTotal += dayRate * numVehicles;
          }
        } else {
          segTotal = resolved.weekdayPrice * segDays * numVehicles;
        }
        price_used = resolved.weekdayPrice; // show weekday rate as reference in breakdown
      } else {
        // PER_KM: use the rate for the segment start date
        segTotal = resolved.weekdayPrice * segKm * numVehicles;
        price_used = resolved.weekdayPrice;
      }

      cab_subtotal += segTotal;

      cab_segments.push({
        day_from: seg.day_from,
        day_to: seg.day_to,
        days: segDays,
        km: segKm,
        vehicle_name: cabTypeData.vehicle.name,
        destination_name: seg.cab_pricing.destination.name,
        pricing_type: resolved.pricing_type,
        price_used,
        is_seasonal: resolved.is_seasonal,
        num_vehicles: numVehicles,
        total: segTotal,
      });
    }
  }

  const base_cost = hotel_subtotal + activity_subtotal + cab_subtotal;
  const margin_amount = Math.round((base_cost * margin_percentage) / 100 * 100) / 100;
  const taxable = base_cost + margin_amount;
  const gst_amount = Math.round((taxable * gst_percentage) / 100 * 100) / 100;
  const final_price = taxable + gst_amount;

  return {
    duration_label: duration?.label ?? "",
    stay_category_label: stayCategory?.label ?? "",
    adults,
    children,
    infants,
    days,
    hotel_subtotal,
    activity_subtotal,
    cab_type_label,
    cab_subtotal,
    cab_segments,
    base_cost,
    margin_percentage,
    margin_amount,
    gst_percentage,
    gst_amount,
    final_price,
    price_per_adult: adults > 0 ? Math.round(final_price / adults) : final_price,
    missing_pricing_config: !pricingConfig,
  };
}
