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
};

export type DayHotelLine = {
  hotel_name: string;
  room_name: string | null;
  plan_name: string | null;
  rooms_count: number;
  price_per_night: number;
  total: number;
};

export type DayActivityLine = {
  id: number;
  name: string;
  is_optional: boolean;
  adult_price: number;
  adult_count: number;
  child_price: number;
  child_count: number;
  total: number;
};

export type DayTransferLine = {
  id: number;
  pickup_name: string | null;
  drop_name: string | null;
  vehicle_name: string | null;
  num_vehicles: number;
  distance_km: number | null;
  sell_price: number | null;
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
};

// ── Core calculator ────────────────────────────────────────────────────────

export async function computePackagePrice(
  input: PricingInput
): Promise<FullPricingBreakdown> {
  const { package_id, duration_id, route_id, stay_category_id, adults, children } = input;

  const [itineraries, pricingConfig, duration, stayCategory] = await Promise.all([
    db.package_itineraries.findMany({
      where: { package_id, duration_id, route_id },
      orderBy: { day: "asc" },
      include: {
        itineraryStays: {
          where: { stay_category_id },
          include: {
            room_pricing: {
              select: {
                plan_name: true,
                price_per_night: true,
                hotel: { select: { name: true } },
                room: { select: { name: true } },
              },
            },
          },
        },
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
        itinerary_transfers: {
          orderBy: { sort_order: "asc" },
          include: {
            route: { select: { pickup_name: true, drop_name: true, distance_km: true } },
            vehicle: { select: { name: true, type: true } },
          },
        },
      },
    }),
    db.package_pricing.findUnique({
      where: {
        package_id_duration_id_stay_category_id: {
          package_id,
          duration_id,
          stay_category_id,
        },
      },
    }),
    db.package_durations.findUnique({
      where: { id: duration_id },
      select: { label: true },
    }),
    db.package_stay_categories.findUnique({
      where: { id: stay_category_id },
      select: { label: true },
    }),
  ]);

  const margin_percentage = Number(pricingConfig?.margin_percentage ?? 10);
  const gst_percentage = Number(pricingConfig?.gst_percentage ?? 5);

  let hotel_subtotal = 0;
  let activity_subtotal = 0;
  let transfer_subtotal = 0;

  const days: DayPricingBreakdown[] = itineraries.map((itin) => {
    // ── Hotel ──────────────────────────────────────────────────────────────
    const stay = itin.itineraryStays[0] ?? null;
    let hotel: DayHotelLine | null = null;
    if (stay) {
      const price = Number(stay.room_pricing.price_per_night);
      const total = price * stay.rooms_count;
      hotel = {
        hotel_name: stay.room_pricing.hotel.name,
        room_name: stay.room_pricing.room?.name ?? null,
        plan_name: stay.room_pricing.plan_name,
        rooms_count: stay.rooms_count,
        price_per_night: price,
        total,
      };
      hotel_subtotal += total;
    }

    // ── Activities ─────────────────────────────────────────────────────────
    const activities: DayActivityLine[] = itin.itinerary_activities.map((ia) => {
      let adult_price = 0;
      let child_price = 0;

      if (ia.variant?.pricing?.length) {
        const tiers = ia.variant.pricing;
        const adultTier =
          tiers.find((t) => t.label.toLowerCase().includes("adult")) ?? tiers[0];
        const childTier =
          tiers.find((t) => t.label.toLowerCase().includes("child")) ?? null;
        adult_price = Number(adultTier.price);
        child_price = childTier ? Number(childTier.price) : adult_price;
      }

      const total = ia.is_optional
        ? 0
        : adult_price * adults + child_price * children;
      if (!ia.is_optional) activity_subtotal += total;

      return {
        id: ia.activity.id,
        name: ia.activity.name,
        is_optional: ia.is_optional,
        adult_price,
        adult_count: adults,
        child_price,
        child_count: children,
        total,
      };
    });

    // ── Transfers ──────────────────────────────────────────────────────────
    const transfers: DayTransferLine[] = itin.itinerary_transfers.map((tr) => {
      const sell = tr.sell_price ? Number(tr.sell_price) : 0;
      transfer_subtotal += sell;
      return {
        id: tr.id,
        pickup_name: tr.route?.pickup_name ?? null,
        drop_name: tr.route?.drop_name ?? null,
        vehicle_name: tr.vehicle?.name ?? null,
        num_vehicles: tr.num_vehicles,
        distance_km: tr.route?.distance_km ? Number(tr.route.distance_km) : null,
        sell_price: tr.sell_price ? Number(tr.sell_price) : null,
        total: sell,
      };
    });

    const day_total =
      (hotel?.total ?? 0) +
      activities
        .filter((a) => !a.is_optional)
        .reduce((s, a) => s + a.total, 0) +
      transfers.reduce((s, t) => s + t.total, 0);

    return { day: itin.day, day_title: itin.title, hotel, activities, transfers, day_total };
  });

  const base_cost = hotel_subtotal + activity_subtotal + transfer_subtotal;
  const margin_amount =
    Math.round((base_cost * margin_percentage) / 100 * 100) / 100;
  const taxable = base_cost + margin_amount;
  const gst_amount =
    Math.round((taxable * gst_percentage) / 100 * 100) / 100;
  const final_price = taxable + gst_amount;

  return {
    duration_label: duration?.label ?? "",
    stay_category_label: stayCategory?.label ?? "",
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
  };
}
