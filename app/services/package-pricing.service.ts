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
  cab_type_id?: number | null;   // if null → use is_default cab type for duration
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
  hotel: DayHotelLine | null;
  activities: DayActivityLine[];
  transfers: DayTransferLine[];
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

/** Resolve the effective cab price for a segment given a travel date. */
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
  travelDate: Date | null,
): { price: number; is_seasonal: boolean; pricing_type: "PER_DAY" | "PER_KM" } {
  const basePrice = Number(basePricing.price);
  const basePricingType = basePricing.pricing_type as "PER_DAY" | "PER_KM";

  if (!travelDate) {
    return { price: basePrice, is_seasonal: false, pricing_type: basePricingType };
  }

  const activeSeason = basePricing.seasons.find((s) => {
    if (!s.is_active) return false;
    const from = new Date(s.valid_from);
    const to = new Date(s.valid_to);
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    return travelDate >= from && travelDate <= to;
  });

  if (!activeSeason) {
    return { price: basePrice, is_seasonal: false, pricing_type: basePricingType };
  }

  // Sat=6, Sun=0 in JS
  const dayOfWeek = travelDate.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const price = isWeekend ? Number(activeSeason.weekend_price) : Number(activeSeason.weekday_price);
  const pricingType = activeSeason.pricing_type as "PER_DAY" | "PER_KM";

  return { price, is_seasonal: true, pricing_type: pricingType };
}

// ── Core calculator ────────────────────────────────────────────────────────

export async function computePackagePrice(
  input: PricingInput,
): Promise<FullPricingBreakdown> {
  const {
    package_id, duration_id, route_id, stay_category_id,
    adults, children, infants, child_ages,
    cab_type_id, travel_date,
  } = input;

  const travelDateObj = travel_date ? new Date(travel_date) : null;

  const [itineraries, pricingConfig, duration, stayCategory, cabTypeData] = await Promise.all([
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
    // Load selected cab type or the default one for this package+duration
    cab_type_id != null
      ? db.package_cab_types.findUnique({
          where: { id: cab_type_id },
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
        })
      : db.package_cab_types.findFirst({
          where: { package_id, duration_id, is_default: true, is_active: true },
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
  };
  const fallbackVariantMap = new Map<number, FallbackVariant>();
  if (noVariantActivityIds.length > 0) {
    const fallbacks = await db.activity_variants.findMany({
      where: { activity_id: { in: noVariantActivityIds }, is_active: true },
      orderBy: { sort_order: "asc" },
      include: { pricing: { where: { is_active: true }, orderBy: { sort_order: "asc" } } },
    });
    for (const v of fallbacks) {
      if (!fallbackVariantMap.has(v.activity_id) && v.pricing.length > 0) {
        fallbackVariantMap.set(v.activity_id, v);
      }
    }
  }

  let hotel_subtotal = 0;
  let activity_subtotal = 0;

  const days: DayPricingBreakdown[] = itineraries.map((itin) => {

    // ── Hotel ────────────────────────────────────────────────────────────────
    const stay = itin.itineraryStays[0] ?? null;
    let hotel: DayHotelLine | null = null;

    if (stay) {
      const maxOccupancy = stay.room_pricing.room?.max_occupancy || 2;
      const roomsNeeded = Math.ceil(Math.max(adults, 1) / maxOccupancy);

      const typicalOccupancy = Math.min(adults, maxOccupancy);
      const basePrice = Number(stay.room_pricing.price_per_night);
      let pricePerRoom = basePrice;
      const occPrices = stay.room_pricing.occupancy_prices ?? [];
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
      const pricingTiers =
        ia.variant?.pricing?.length
          ? ia.variant.pricing
          : (fallbackVariantMap.get(ia.activity.id)?.pricing ?? []);

      const pricingType =
        (ia.variant?.pricing_type ??
          fallbackVariantMap.get(ia.activity.id)?.pricing_type ??
          "PER_PERSON") as string;

      let adult_price = 0;
      let child_price = 0;
      let infant_price = 0;
      let total = 0;

      if (pricingTiers.length > 0) {
        if (pricingType === "PER_GROUP") {
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

    const day_total =
      (hotel?.total ?? 0) +
      activities.filter((a) => !a.is_optional).reduce((s, a) => s + a.total, 0);
    // Note: cab cost is not per-day; it's captured in cab_subtotal

    return { day: itin.day, day_title: itin.title, hotel, activities, transfers, day_total };
  });

  // ── Cab cost computation ──────────────────────────────────────────────────
  const cab_type_label = cabTypeData?.label ?? cabTypeData?.vehicle?.name ?? null;
  const cab_segments: CabSegmentBreakdown[] = [];
  let cab_subtotal = 0;

  if (cabTypeData && cabTypeData.segments.length > 0) {
    const vehicleCapacity = Math.max(cabTypeData.vehicle.passenger_capacity, 1);
    const numVehicles = Math.ceil(Math.max(adults + children, 1) / vehicleCapacity);

    for (const seg of cabTypeData.segments) {
      const resolved = resolveCabPrice(
        {
          pricing_type: seg.cab_pricing.pricing_type,
          price: seg.cab_pricing.price,
          seasons: seg.cab_pricing.seasons,
        },
        travelDateObj,
      );

      const segDays = seg.day_to - seg.day_from + 1;

      // Sum km from all itinerary days within [day_from, day_to]
      let segKm = 0;
      for (let d = seg.day_from; d <= seg.day_to; d++) {
        segKm += dayKmMap.get(d) ?? 0;
      }

      let segTotal = 0;
      if (resolved.pricing_type === "PER_DAY") {
        segTotal = resolved.price * segDays * numVehicles;
      } else {
        segTotal = resolved.price * segKm * numVehicles;
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
        price_used: resolved.price,
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
