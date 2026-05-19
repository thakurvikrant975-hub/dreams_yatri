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
  vehicle_id_override?: number | null;
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
  vehicle_capacity: number | null;
  configured_vehicles: number;
  actual_vehicles: number;    // ceil(total_pax / capacity) or configured_vehicles if no vehicle
  per_vehicle_price: number;
  distance_km: number | null;
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
  transfer_subtotal: number;
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

// ── Core calculator ────────────────────────────────────────────────────────

export async function computePackagePrice(
  input: PricingInput,
): Promise<FullPricingBreakdown> {
  const { package_id, duration_id, route_id, stay_category_id, adults, children, infants, child_ages, vehicle_id_override } = input;

  const [itineraries, pricingConfig, duration, stayCategory, cabPricings] = await Promise.all([
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
            vehicle: { select: { name: true, type: true, passenger_capacity: true } },
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
    db.package_cab_pricings.findMany({
      where: { package_id, route_id, is_active: true },
      select: { vehicle_id: true, sell_price: true, vehicle: { select: { passenger_capacity: true } } },
    }),
  ]);

  const cabPriceMap = new Map(cabPricings.map((c) => [c.vehicle_id, Number(c.sell_price)]));
  const cabCapacityMap = new Map(cabPricings.map((c) => [c.vehicle_id, c.vehicle?.passenger_capacity ?? null]));

  const margin_percentage = Number(pricingConfig?.margin_percentage ?? 10);
  const gst_percentage = Number(pricingConfig?.gst_percentage ?? 5);

  // Fallback variants for activities saved without a variant_id
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
  let transfer_subtotal = 0;

  const days: DayPricingBreakdown[] = itineraries.map((itin) => {

    // ── Hotel ────────────────────────────────────────────────────────────────
    const stay = itin.itineraryStays[0] ?? null;
    let hotel: DayHotelLine | null = null;

    if (stay) {
      const maxOccupancy = stay.room_pricing.room?.max_occupancy || 2;
      const roomsNeeded = Math.ceil(Math.max(adults, 1) / maxOccupancy);

      // Occupancy-based price: find the entry with occupancy closest to (but not exceeding)
      // the typical people-per-room. Sort desc and take the first <= typicalOccupancy.
      const typicalOccupancy = Math.min(adults, maxOccupancy);
      const basePrice = Number(stay.room_pricing.price_per_night);
      let pricePerRoom = basePrice;
      const occPrices = stay.room_pricing.occupancy_prices ?? [];
      if (occPrices.length > 0) {
        const sorted = [...occPrices].sort((a, b) => b.occupancy - a.occupancy);
        const match = sorted.find((op) => op.occupancy <= typicalOccupancy) ?? sorted[sorted.length - 1];
        pricePerRoom = Number(match.price_per_night);
      }

      // Child charges from hotel_child_policies
      let childCharge = 0;
      const childPolicies = stay.room_pricing.hotel?.childPolicies ?? [];
      if (children > 0 && childPolicies.length > 0) {
        if (child_ages && child_ages.length === children) {
          // Age-based: match each child to their correct policy bracket
          for (const age of child_ages) {
            const policy = childPolicies.find(p => age >= p.age_from && age <= p.age_to);
            if (policy) {
              const pp = Number(policy.price ?? 0);
              const ct = policy.charge_type.toUpperCase();
              if (ct === "FIXED_PRICE" || ct === "FIXED") childCharge += pp;
              else if (ct === "PERCENTAGE") childCharge += (pricePerRoom * pp) / 100;
              // FREE → 0
            }
          }
        } else {
          // Fallback: apply first policy uniformly (legacy behaviour)
          const policy = childPolicies[0];
          const pp = Number(policy.price ?? 0);
          const ct = policy.charge_type.toUpperCase();
          if (ct === "FIXED_PRICE" || ct === "FIXED") childCharge = pp * children;
          else if (ct === "PERCENTAGE") childCharge = (pricePerRoom * pp) / 100 * children;
        }
      }

      // Infants are typically free at hotels
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
          // One flat price for the whole group — use first tier
          adult_price = Number(pricingTiers[0].price);
          total = ia.is_optional ? 0 : adult_price;
        } else {
          // PER_PERSON — match tiers by label
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

    // ── Transfers ────────────────────────────────────────────────────────────
    const effectiveVehicleId = vehicle_id_override ?? null;
    const transfers: DayTransferLine[] = itin.itinerary_transfers.map((tr) => {
      const lookupVehicleId = effectiveVehicleId ?? tr.vehicle_id;
      const configuredVehicles = Math.max(tr.num_vehicles, 1);
      const perVehiclePrice = lookupVehicleId != null ? (cabPriceMap.get(lookupVehicleId) ?? 0) : 0;

      const vehicleCapacity = effectiveVehicleId != null
        ? (cabCapacityMap.get(effectiveVehicleId) ?? null)
        : (tr.vehicle?.passenger_capacity ?? null);
      let actualVehicles = configuredVehicles;
      if (vehicleCapacity && vehicleCapacity > 0) {
        const totalPax = adults + children;
        actualVehicles = Math.ceil(Math.max(totalPax, 1) / vehicleCapacity);
      }

      const total = actualVehicles * perVehiclePrice;
      transfer_subtotal += total;

      return {
        id: tr.id,
        pickup_name: tr.route?.pickup_name ?? null,
        drop_name: tr.route?.drop_name ?? null,
        vehicle_name: tr.vehicle?.name ?? null,
        vehicle_capacity: vehicleCapacity,
        configured_vehicles: configuredVehicles,
        actual_vehicles: actualVehicles,
        per_vehicle_price: perVehiclePrice,
        distance_km: tr.route?.distance_km ? Number(tr.route.distance_km) : null,
        total,
      };
    });

    const day_total =
      (hotel?.total ?? 0) +
      activities.filter((a) => !a.is_optional).reduce((s, a) => s + a.total, 0) +
      transfers.reduce((s, t) => s + t.total, 0);

    return { day: itin.day, day_title: itin.title, hotel, activities, transfers, day_total };
  });

  const base_cost = hotel_subtotal + activity_subtotal + transfer_subtotal;
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
    transfer_subtotal,
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
