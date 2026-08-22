"use server";

import { db } from "../lib/db";
import { upsertRouteVariant, type StopInput } from "./route-builder.service";

// ── Exported types ─────────────────────────────────────────────────────────

export type TransferInput = {
  pickup_name: string;
  pickup_location_id?: string | null;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  drop_name: string;
  drop_location_id?: string | null;
  drop_lat?: number | null;
  drop_lng?: number | null;
  vehicle_id?: number | null;
  num_vehicles?: number;
  notes?: string | null;
  km_override?: number | null;
};

export type NoteInput = {
  message: string;
  type?: string;
  position?: string;
  optional_link_text?: string | null;
  optional_link_url?: string | null;
};

export type ReorderItem =
  | { kind: "transfer" | "activity" | "note"; id: number; sort_order: number }
  | { kind: "stay"; itinerary_id: number; sort_order: number };

export type ActivityItem = {
  id: number;
  sort_order: number;
  is_optional: boolean;
  variant_id: number | null;
  variant: { id: number; name: string } | null;
  activity: { id: number; name: string; category: string | null; duration_hours: number | null; included_meals: string[] };
};

export type ActivityVariantOption = {
  id: number;
  name: string;
  pricingTiers: { id: number; label: string; price: number }[];
};

export type TransferItem = {
  id: number;
  itinerary_id: number;
  route_id: number | null;
  vehicle_id: number | null;
  num_vehicles: number;
  notes: string | null;
  sort_order: number;
  km_override: number | null;
  route: {
    id: number;
    pickup_name: string;
    pickup_location_id: string | null;   // BigInt serialised to string
    pickup_location_type: string | null;
    pickup_lat: number | null;
    pickup_lng: number | null;
    drop_name: string;
    drop_location_id: string | null;
    drop_location_type: string | null;
    drop_lat: number | null;
    drop_lng: number | null;
    distance_km: number | null;
    duration_min: number | null;
  } | null;
  vehicle: {
    id: number;
    name: string;
    type: string;
    passenger_capacity: number;
  } | null;
};

export type VehicleOption = {
  id: number;
  name: string;
  type: string;
  passenger_capacity: number;
  luggage_bags: number;
  has_ac: boolean;
};

export type NoteItem = {
  id: number;
  itinerary_id: number;
  message: string;
  type: string;
  position: string;
  optional_link_text: string | null;
  optional_link_url: string | null;
  sort_order: number;
};

export type StayItem = {
  id: number;
  stay_category_id: number;
  sort_order: number;
  num_nights: number;
  active_meals: string[];
  room_pricing: {
    id: number;
    plan_name: string | null;
    price_per_night: number;
    meal_type: { id: number; name: string; covered_meals: string[] } | null;
    hotel: { id: number; name: string; category: string | null; stay_type: string | null; thumbnail: string | null };
    room: { id: number; name: string; bed_type: string | null; images: { url: string; thumbnail: string | null }[] } | null;
  };
  stay_category: { id: number; label: string; slug: string };
};

export type AttractionItem = {
  id: number;
  itinerary_id: number;
  image_key: string;
  caption: string;
  sort_order: number;
};

export type DayData = {
  id: number | null;
  day: number;
  title: string;
  description: string | null;
  meals: string[];
  excluded_meals: string[];
  activities: ActivityItem[];
  transfers: TransferItem[];
  notes: NoteItem[];
  stays: StayItem[];
  attractions: AttractionItem[];
};

// ── Helpers ────────────────────────────────────────────────────────────────

async function nextSortOrder(itineraryId: number): Promise<number> {
  const [t, a, n] = await Promise.all([
    db.itinerary_transfers.aggregate({ where: { itinerary_id: itineraryId }, _max: { sort_order: true } }),
    db.itinerary_activities.aggregate({ where: { itinerary_id: itineraryId }, _max: { sort_order: true } }),
    db.itinerary_notes.aggregate({ where: { itinerary_id: itineraryId }, _max: { sort_order: true } }),
  ]);
  return Math.max(t._max.sort_order ?? -1, a._max.sort_order ?? -1, n._max.sort_order ?? -1) + 1;
}

// ── Read ───────────────────────────────────────────────────────────────────

export async function getItineraryData(
  packageId: number,
  durationId: number,
  routeId: number,
): Promise<DayData[]> {
  const duration = await db.package_durations.findUnique({
    where: { id: durationId },
    select: { days: true },
  });
  if (!duration) throw new Error("Duration not found");

  const records = await db.package_itineraries.findMany({
    where: { package_id: packageId, duration_id: durationId, route_id: routeId },
    orderBy: { day: "asc" },
    include: {
      itinerary_activities: {
        orderBy: { sort_order: "asc" },
        include: {
          activity: { select: { id: true, name: true, duration_hours: true, included_meals: true, category: { select: { name: true } } } },
          variant: { select: { id: true, name: true } },
        },
      },
      itinerary_transfers: {
          orderBy: { sort_order: "asc" },
          select: {
            id: true, itinerary_id: true, route_id: true, vehicle_id: true,
            num_vehicles: true, notes: true, sort_order: true, km_override: true,
            route: {
              select: {
                id: true,
                pickup_name: true,
                pickup_location_id: true,
                pickup_location: { select: { type: true } },
                pickup_lat: true, pickup_lng: true,
                drop_name: true,
                drop_location_id: true,
                drop_location: { select: { type: true } },
                drop_lat: true, drop_lng: true,
                distance_km: true, duration_min: true,
              },
            },
            vehicle: { select: { id: true, name: true, type: true, passenger_capacity: true } },
          },
        },
      itinerary_notes: { orderBy: { sort_order: "asc" } },
      itinerary_attractions: { orderBy: { sort_order: "asc" } },
      itineraryStays: {
        include: {
          room_pricing: {
            select: {
              id: true,
              plan_name: true,
              price_per_night: true,
              meal_type: { select: { id: true, name: true, covered_meals: true } },
              hotel: { select: { id: true, name: true, category: true, stay_type: true, thumbnail: true } },
              room: { select: { id: true, name: true, bed_type: true, images: { select: { url: true, thumbnail: true }, orderBy: { sort_order: "asc" }, take: 1 } } },
            },
          },
          stay_category: { select: { id: true, label: true, slug: true } },
        },
      },
    },
  });

  // Days can outlive the route's currently configured length (e.g. a route was
  // shortened in Route Builder after content was already added) — surface those
  // orphaned days too so they can be reviewed/cleared from the Itinerary Builder.
  const maxDay = records.reduce((m, r) => Math.max(m, r.day), duration.days);

  return Array.from({ length: maxDay }, (_, i): DayData => {
    const day = i + 1;
    const rec = records.find((r) => r.day === day);
    if (!rec) {
      return { id: null, day, title: `Day ${day}`, description: null, meals: [], excluded_meals: [], activities: [], transfers: [], notes: [], stays: [], attractions: [] };
    }
    return {
      id: rec.id,
      day,
      title: rec.title,
      description: rec.description,
      meals: rec.meals ?? [],
      excluded_meals: rec.excluded_meals ?? [],
      activities: rec.itinerary_activities.map((ia) => ({
        id: ia.id,
        sort_order: ia.sort_order,
        is_optional: ia.is_optional,
        variant_id: ia.variant_id,
        variant: ia.variant ?? null,
        activity: {
          id: ia.activity.id,
          name: ia.activity.name,
          category: ia.activity.category?.name ?? null,
          duration_hours: ia.activity.duration_hours != null ? Number(ia.activity.duration_hours) : null,
          included_meals: ia.activity.included_meals,
        },
      })),
      transfers: rec.itinerary_transfers.map((t) => ({
          id: t.id,
          itinerary_id: t.itinerary_id,
          route_id: t.route_id,
          vehicle_id: t.vehicle_id,
          num_vehicles: t.num_vehicles,
          notes: t.notes,
          sort_order: t.sort_order,
          km_override: t.km_override,
          route: t.route ? {
            id: t.route.id,
            pickup_name: t.route.pickup_name,
            pickup_location_id:   t.route.pickup_location_id?.toString() ?? null,
            pickup_location_type: t.route.pickup_location?.type ?? null,
            pickup_lat: t.route.pickup_lat != null ? Number(t.route.pickup_lat) : null,
            pickup_lng: t.route.pickup_lng != null ? Number(t.route.pickup_lng) : null,
            drop_name: t.route.drop_name,
            drop_location_id:   t.route.drop_location_id?.toString() ?? null,
            drop_location_type: t.route.drop_location?.type ?? null,
            drop_lat: t.route.drop_lat != null ? Number(t.route.drop_lat) : null,
            drop_lng: t.route.drop_lng != null ? Number(t.route.drop_lng) : null,
            distance_km: t.route.distance_km != null ? Number(t.route.distance_km) : null,
            duration_min: t.route.duration_min,
          } : null,
          vehicle: t.vehicle ? {
            id: t.vehicle.id,
            name: t.vehicle.name,
            type: t.vehicle.type,
            passenger_capacity: t.vehicle.passenger_capacity,
          } : null,
        })),
      notes: rec.itinerary_notes,
      stays: rec.itineraryStays.map((s) => ({
        id: s.id,
        stay_category_id: s.stay_category_id,
        sort_order: s.sort_order,
        num_nights: s.num_nights,
        active_meals: s.active_meals,
        room_pricing: {
          id: s.room_pricing.id,
          plan_name: s.room_pricing.plan_name,
          price_per_night: Number(s.room_pricing.price_per_night),
          meal_type: s.room_pricing.meal_type ?? null,
          hotel: s.room_pricing.hotel,
          room: s.room_pricing.room,
        },
        stay_category: s.stay_category,
      })),
      attractions: rec.itinerary_attractions,
    };
  });
}

// ── Content check ─────────────────────────────────────────────────────────

export async function checkItineraryDaysHaveContent(
  packageId: number,
  routeId: number,
  durationId: number,
  fromDay: number,
  toDay: number,
): Promise<boolean> {
  const count = await db.package_itineraries.count({
    where: {
      package_id: packageId,
      route_id: routeId,
      duration_id: durationId,
      day: { gte: fromDay, lte: toDay },
    },
  });
  return count > 0;
}

// Given a day number and a route's stops (in order), find the index of the stop
// that "owns" that day — mirroring the frontend's computeStopGroups: every stop
// owns its stay_days worth of days, and the last stop additionally owns the
// trailing departure day (its stay_days + 1).
function locateOwningStop(day: number, stops: { stay_days: number }[]): number {
  let cursor = 0;
  for (let i = 0; i < stops.length; i++) {
    const isLast = i === stops.length - 1;
    cursor += stops[i].stay_days + (isLast ? 1 : 0);
    if (day <= cursor) return i;
  }
  return stops.length - 1;
}

export async function deleteItineraryDay(
  packageId: number,
  durationId: number,
  routeId: number,
  day: number,
): Promise<{ routeId: number; durationId: number }> {
  const route = await db.package_routes.findUnique({
    where: { id: routeId },
    select: {
      name: true,
      meta_title: true,
      meta_desc: true,
      stops: { orderBy: { sort_order: "asc" }, select: { place_name: true, stay_days: true, location_id: true } },
      duration: { select: { is_default: true, is_active: true, sort_order: true, thumbnail_url: true } },
    },
  });
  if (!route) throw new Error("Route not found");
  if (route.stops.length === 0) throw new Error("Route has no stops");

  const ownerIndex = locateOwningStop(day, route.stops);
  if (route.stops[ownerIndex].stay_days <= 1) {
    throw new Error(
      `This is the only night at ${route.stops[ownerIndex].place_name}. Removing it would drop that stop from the route — edit the route in Route Builder instead.`,
    );
  }

  const newStops: StopInput[] = route.stops.map((s, i) => ({
    place_name: s.place_name,
    stay_days: i === ownerIndex ? s.stay_days - 1 : s.stay_days,
    location_id: s.location_id != null ? s.location_id.toString() : null,
  }));

  // 1) Compact the content: remove day N, shift every later day in this
  // route/duration back by one so there's no gap left behind.
  const laterOrEqual = await db.package_itineraries.findMany({
    where: { package_id: packageId, duration_id: durationId, route_id: routeId, day: { gte: day } },
    select: { id: true, day: true },
    orderBy: { day: "asc" },
  });

  await db.$transaction(async (tx) => {
    const target = laterOrEqual.find((r) => r.day === day);
    if (target) {
      // itinerary_stays has no onDelete: Cascade to package_itineraries — clear it manually.
      await tx.itinerary_stays.deleteMany({ where: { itinerary_id: target.id } });
      await tx.package_itineraries.delete({ where: { id: target.id } });
    }
    for (const rec of laterOrEqual) {
      if (rec.day > day) {
        await tx.package_itineraries.update({ where: { id: rec.id }, data: { day: rec.day - 1 } });
      }
    }
  });

  // 2) Persist the shrunk stop list — this finds/creates the matching duration
  // for the new day/night total and migrates the (already-compacted) itinerary
  // content over to it. The route may end up under a different duration_id.
  return upsertRouteVariant(
    packageId,
    newStops,
    { name: route.name, meta_title: route.meta_title, meta_desc: route.meta_desc },
    {
      is_default: route.duration.is_default,
      is_active: route.duration.is_active,
      sort_order: route.duration.sort_order,
      thumbnail_url: route.duration.thumbnail_url,
    },
    routeId,
  );
}

// ── Day meta ───────────────────────────────────────────────────────────────

export async function upsertDayMeta(
  packageId: number,
  durationId: number,
  routeId: number,
  day: number,
  data: { title: string; description?: string | null; meals?: string[]; excluded_meals?: string[] },
) {
  const existing = await db.package_itineraries.findFirst({
    where: { package_id: packageId, duration_id: durationId, route_id: routeId, day },
    select: { id: true },
  });
  if (existing) {
    return db.package_itineraries.update({
      where: { id: existing.id },
      data: { title: data.title, description: data.description ?? null, meals: data.meals ?? [], excluded_meals: data.excluded_meals ?? [] },
    });
  }
  return db.package_itineraries.create({
    data: {
      package_id: packageId,
      duration_id: durationId,
      route_id: routeId,
      day,
      title: data.title,
      description: data.description ?? null,
      meals: data.meals ?? [],
      excluded_meals: data.excluded_meals ?? [],
    },
  });
}

// ── Activities ─────────────────────────────────────────────────────────────

export async function getActivityVariants(activityId: number): Promise<ActivityVariantOption[]> {
  const variants = await db.activity_variants.findMany({
    where: { activity_id: activityId, is_active: true },
    orderBy: { sort_order: "asc" },
    include: {
      pricing: {
        where: { is_active: true },
        orderBy: { sort_order: "asc" },
        select: { id: true, label: true, price: true },
      },
      seasons: {
        where: { is_active: true },
        orderBy: { sort_order: "asc" },
        select: {
          id: true,
          pricing: {
            where: { is_active: true },
            orderBy: { sort_order: "asc" },
            select: { id: true, label: true, price: true },
          },
        },
      },
    },
  });
  return variants.map((v) => {
    // Use default pricing if available; otherwise fall back to the first active season's pricing
    const effectivePricing =
      v.pricing.length > 0
        ? v.pricing
        : (v.seasons.find((s) => s.pricing.length > 0)?.pricing ?? []);
    return {
      id: v.id,
      name: v.name,
      pricingTiers: effectivePricing.map((p) => ({ id: p.id, label: p.label, price: Number(p.price) })),
    };
  });
}

export async function addItineraryActivity(
  itineraryId: number,
  activityId: number,
  isOptional = false,
  variantId?: number | null,
) {
  const order = await nextSortOrder(itineraryId);
  return db.itinerary_activities.create({
    data: {
      itinerary_id: itineraryId,
      activity_id: activityId,
      variant_id: variantId ?? null,
      is_optional: isOptional,
      sort_order: order,
    },
  });
}

export async function updateItineraryActivity(
  id: number,
  data: { is_optional?: boolean; sort_order?: number; variant_id?: number | null },
) {
  return db.itinerary_activities.update({ where: { id }, data });
}

export async function deleteItineraryActivity(id: number) {
  return db.itinerary_activities.delete({ where: { id } });
}

// ── Transfers ──────────────────────────────────────────────────────────────

async function findOrCreateRoute(data: TransferInput): Promise<number | null> {
  if (!data.pickup_name || !data.drop_name) return null;

  // Deduplicate by DB location IDs when available
  if (data.pickup_location_id && data.drop_location_id) {
    const existing = await db.transfer_routes.findFirst({
      where: {
        pickup_location_id: BigInt(data.pickup_location_id),
        drop_location_id: BigInt(data.drop_location_id),
      },
      select: { id: true, pickup_name: true, drop_name: true },
    });
    if (existing) {
      // The matched row may have been created under a stale display name for
      // this location (e.g. the location's catalog name changed, or an old
      // search-ranking bug meant the wrong suggestion got picked originally)
      // — re-attaching it must not keep re-serving that stale text forever.
      if (existing.pickup_name !== data.pickup_name || existing.drop_name !== data.drop_name) {
        await db.transfer_routes.update({
          where: { id: existing.id },
          data: { pickup_name: data.pickup_name, drop_name: data.drop_name },
        });
      }
      return existing.id;
    }
  }

  // Compute road distance from Mapbox Directions API
  let distance_km: number | null = null;
  let duration_min: number | null = null;
  if (data.pickup_lat && data.pickup_lng && data.drop_lat && data.drop_lng) {
    try {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      if (token) {
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${data.pickup_lng},${data.pickup_lat};${data.drop_lng},${data.drop_lat}?access_token=${token}&overview=false`;
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          const route = json.routes?.[0];
          if (route) {
            distance_km = Math.round((route.distance / 1000) * 10) / 10;
            duration_min = Math.round(route.duration / 60);
          }
        }
      }
    } catch {
      // distance will be null if Mapbox call fails
    }
  }

  const route = await db.transfer_routes.create({
    data: {
      pickup_name: data.pickup_name,
      pickup_location_id: data.pickup_location_id ? BigInt(data.pickup_location_id) : null,
      pickup_lat: data.pickup_lat ?? null,
      pickup_lng: data.pickup_lng ?? null,
      drop_name: data.drop_name,
      drop_location_id: data.drop_location_id ? BigInt(data.drop_location_id) : null,
      drop_lat: data.drop_lat ?? null,
      drop_lng: data.drop_lng ?? null,
      distance_km,
      duration_min,
    },
    select: { id: true },
  });
  return route.id;
}

export async function addItineraryTransfer(itineraryId: number, data: TransferInput) {
  const [order, routeId] = await Promise.all([
    nextSortOrder(itineraryId),
    findOrCreateRoute(data),
  ]);
  return db.itinerary_transfers.create({
    data: {
      itinerary_id: itineraryId,
      route_id: routeId,
      vehicle_id: data.vehicle_id ?? null,
      num_vehicles: data.num_vehicles ?? 1,
      notes: data.notes ?? null,
      sort_order: order,
      km_override: data.km_override ?? null,
    },
  });
}

export async function updateItineraryTransfer(id: number, data: TransferInput) {
  const routeId = await findOrCreateRoute(data);
  return db.itinerary_transfers.update({
    where: { id },
    data: {
      route_id: routeId,
      vehicle_id: data.vehicle_id ?? null,
      num_vehicles: data.num_vehicles ?? 1,
      notes: data.notes ?? null,
      km_override: data.km_override ?? null,
    },
  });
}

export async function getVehicles(): Promise<VehicleOption[]> {
  return db.vehicles.findMany({
    where: { is_active: true },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    select: { id: true, name: true, type: true, passenger_capacity: true, luggage_bags: true, has_ac: true },
  });
}

export async function deleteItineraryTransfer(id: number) {
  return db.itinerary_transfers.delete({ where: { id } });
}

// ── Notes ──────────────────────────────────────────────────────────────────

export async function addItineraryNote(itineraryId: number, data: NoteInput) {
  const order = await nextSortOrder(itineraryId);
  return db.itinerary_notes.create({
    data: {
      itinerary_id: itineraryId,
      message: data.message,
      type: data.type ?? "info",
      position: data.position ?? "bottom",
      optional_link_text: data.optional_link_text ?? null,
      optional_link_url: data.optional_link_url ?? null,
      sort_order: order,
    },
  });
}

export async function updateItineraryNote(id: number, data: NoteInput) {
  return db.itinerary_notes.update({
    where: { id },
    data: {
      message: data.message,
      type: data.type ?? "info",
      position: data.position ?? "bottom",
      optional_link_text: data.optional_link_text ?? null,
      optional_link_url: data.optional_link_url ?? null,
    },
  });
}

export async function deleteItineraryNote(id: number) {
  return db.itinerary_notes.delete({ where: { id } });
}

// ── Stays ──────────────────────────────────────────────────────────────────

/** "BREAKFAST" | "Morning Snacks" → "breakfast" | "morning_snacks" */
function normalizeMealKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "_");
}

export async function upsertItineraryStay(
  itineraryId: number,
  stayCategoryId: number,
  roomPricingId: number,
  sortOrder: number,
  numNights: number = 1,
) {
  const existing = await db.itinerary_stays.findFirst({
    where: { itinerary_id: itineraryId, stay_category_id: stayCategoryId },
    select: { id: true },
  });
  if (existing) {
    return db.itinerary_stays.update({
      where: { id: existing.id },
      data: { room_pricing_id: roomPricingId, sort_order: sortOrder, num_nights: numNights },
    });
  }
  // Seed active_meals from the room plan's covered meals so the meals editor
  // opens already reflecting what the rate bundles (admin only adjusts exceptions).
  const rp = await db.hotel_room_pricing.findUnique({
    where: { id: roomPricingId },
    select: { meal_type: { select: { covered_meals: true } } },
  });
  const seededMeals = (rp?.meal_type?.covered_meals ?? []).map(normalizeMealKey);
  return db.itinerary_stays.create({
    data: { itinerary_id: itineraryId, stay_category_id: stayCategoryId, room_pricing_id: roomPricingId, sort_order: sortOrder, num_nights: numNights, active_meals: seededMeals },
  });
}

export async function deleteItineraryStay(id: number) {
  return db.itinerary_stays.delete({ where: { id } });
}

export async function updateStayActiveMeals(id: number, activeMeals: string[]) {
  return db.itinerary_stays.update({ where: { id }, data: { active_meals: activeMeals } });
}

// ── Reorder ────────────────────────────────────────────────────────────────

export async function reorderDayItems(updates: ReorderItem[]) {
  await db.$transaction(
    updates.map((u) => {
      if (u.kind === "transfer")
        return db.itinerary_transfers.update({ where: { id: u.id }, data: { sort_order: u.sort_order } });
      if (u.kind === "activity")
        return db.itinerary_activities.update({ where: { id: u.id }, data: { sort_order: u.sort_order } });
      if (u.kind === "note")
        return db.itinerary_notes.update({ where: { id: u.id }, data: { sort_order: u.sort_order } });
      if (u.kind === "stay")                                      // ← add this guard
        return db.itinerary_stays.updateMany({
          where: { itinerary_id: u.itinerary_id },
          data:  { sort_order: u.sort_order },
        });
      throw new Error(`Unknown reorder kind: ${(u as any).kind}`);
    }),
  );
}

// ── Search ─────────────────────────────────────────────────────────────────

export async function searchActivities(destinationId: number, query: string) {
  const list = await db.activities.findMany({
    where: {
      is_active: true,
      OR: [{ destination_id: destinationId }, { destination_id: null }],
      ...(query ? { name: { contains: query, mode: "insensitive" as const } } : {}),
    },
    select: {
      id: true, name: true, duration_hours: true,
      category: { select: { name: true } },
      _count: { select: { variants: true } },
    },
    take: 21,
    orderBy: { name: "asc" },
  });
  const has_more = list.length > 20;
  return {
    items: list.slice(0, 20).map((a) => ({
      id: a.id,
      name: a.name,
      category: a.category?.name ?? null,
      duration_hours: a.duration_hours != null ? Number(a.duration_hours) : null,
      has_pricing: a._count.variants > 0,
    })),
    has_more,
  };
}

const HOTEL_SELECT = {
  id: true,
  plan_name: true,
  price_per_night: true,
  meal_type: { select: { id: true, name: true, covered_meals: true } },
  hotel: {
    select: {
      id: true, name: true, category: true, stay_type: true, thumbnail: true,
      city: true, state: true, country: true,
      location: { select: { latitude: true, longitude: true } },
    },
  },
  room: {
    select: {
      id: true, name: true, bed_type: true, bed_count: true,
      max_occupancy: true, max_adults: true, child_cot_available: true,
      images: { select: { url: true, thumbnail: true }, orderBy: { sort_order: "asc" as const }, take: 1 },
    },
  },
} as const;

function toItems(list: {
  id: number;
  plan_name: string | null;
  price_per_night: unknown;
  meal_type: { id: number; name: string; covered_meals: string[] } | null;
  hotel: {
    id: number; name: string; category: string | null; stay_type: string | null; thumbnail: string | null;
    city: string | null; state: string | null; country: string | null;
    location: { latitude: unknown; longitude: unknown } | null;
  };
  room: {
    id: number; name: string; bed_type: string | null; bed_count: number | null;
    max_occupancy: number | null; max_adults: number | null; child_cot_available: boolean | null;
    images: { url: string; thumbnail: string | null }[];
  } | null;
  /** Driving distance and time from the day's stop — see searchRoomPricings.
   * Null when there's no stop location to measure from, or when the routing
   * service didn't answer: a missing number is better than a misleading one. */
  roadKm?: number | null;
  roadMin?: number | null;
}[]) {
  return list.map((p) => ({ ...p, price_per_night: Number(p.price_per_night) }));
}

export async function getRoomPricingById(id: number) {
  const row = await db.hotel_room_pricing.findUnique({ where: { id }, select: HOTEL_SELECT });
  if (!row) return null;
  return { ...row, price_per_night: Number(row.price_per_night) };
}

const ROOM_SEARCH_PAGE_SIZE = 20;

/** How far out, as the crow flies, the picker looks for candidate hotels.
 *  Road distance is only ever longer, so this is a ceiling on road distance
 *  too — which is why a band reaching past it has to widen the net. */
const NEARBY_RADIUS_KM = 50;
/** Hard ceiling on that widening: past this a "stay near the stop" search
 *  stops being about the stop at all. */
const MAX_NEARBY_RADIUS_KM = 200;

export type RoomSearchSort = "distance" | "price_asc" | "price_desc" | "name";

/**
 * Road-distance bands for the picker's distance filter.
 *
 * Half-open [minKm, maxKm) on purpose: a hotel exactly 10.0 km out belongs to
 * "10 – 25 km" and nowhere else, so the bands partition the results instead of
 * double-counting the boundary. The last band is open-ended above.
 *
 * These are DRIVING kilometres, like the badge on each result — the whole point
 * of the filter is that a crow-flies band would lie in the hills, where the same
 * pairs run a median 2.5x longer by road (see roadDistances).
 */
export type DistanceBand = { slug: string; label: string; minKm: number; maxKm: number };

export const DISTANCE_BANDS: DistanceBand[] = [
  { slug: "0-5",   label: "0 – 5 km",   minKm: 0,  maxKm: 5 },
  { slug: "5-10",  label: "5 – 10 km",  minKm: 5,  maxKm: 10 },
  { slug: "10-25", label: "10 – 25 km", minKm: 10, maxKm: 25 },
  { slug: "25-50", label: "25 – 50 km", minKm: 25, maxKm: 50 },
  { slug: "50+",   label: "50+ km",     minKm: 50, maxKm: Number.POSITIVE_INFINITY },
];

function findDistanceBand(slug?: string | null): DistanceBand | null {
  if (!slug) return null;
  return DISTANCE_BANDS.find((b) => b.slug === slug) ?? null;
}

/** Great-circle distance in km — mirrors the raw-SQL haversine used to find
 * the nearby hotel ID set below, just run in JS once per already-fetched
 * item instead of a second DB round-trip. */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

/**
 * Real driving distance and time from one origin to many hotels, in a single
 * OSRM table call (same service the hotel-verification screen uses).
 *
 * The picker used to badge each stay with `haversineKm` straight from the
 * great-circle helper above, labelled only "km". On the plains that reads close
 * enough to the drive, which is why it went unnoticed while the catalog was
 * mostly southern; in the hills it is not close at all. Measured against this
 * very routing data, Uttarakhand stop→hotel pairs in the 15-40km band run a
 * median 2.5x and up to 5.3x longer by road — Uttarkashi to a hotel 27km away
 * as the crow flies is 124km of driving. A stay nobody could reach after a full
 * day's sightseeing looked like a short hop, which is exactly how one ends up
 * in a package.
 *
 * Keyed by hotel id, not room-pricing id: a hotel usually has several priced
 * rooms in the same result page and they all sit at the same coordinates, so
 * de-duplicating keeps one page comfortably inside OSRM's coordinate limit.
 *
 * Measures every hotel handed to it, in chunks, rather than the first 90 —
 * badging a page only ever needed the page, but FILTERING by road distance
 * needs the whole candidate set, since a hotel that never gets a number can
 * never be shown to be inside the band.
 */
const ROAD_MATRIX_LIMIT = 90; // OSRM public table service, minus the origin
/** Ceiling on one search's routing work. Beyond this the tail stays unmeasured
 *  (and so unbadged, and excluded from a band filter) rather than fanning out
 *  into an unbounded number of calls against a public service. */
const ROAD_MATRIX_MAX_HOTELS = ROAD_MATRIX_LIMIT * 5;

/** One OSRM table call: origin → up to ROAD_MATRIX_LIMIT hotels. */
async function roadDistanceChunk(
  originLat: number,
  originLng: number,
  hotels: { id: number; lat: number; lng: number }[],
  out: Map<number, { km: number; min: number }>,
): Promise<void> {
  const coords = [`${originLng},${originLat}`, ...hotels.map((h) => `${h.lng},${h.lat}`)].join(";");
  try {
    const res = await fetch(
      `https://router.project-osrm.org/table/v1/driving/${coords}?sources=0&annotations=distance,duration`,
      // Road geometry barely moves; a day of caching keeps repeated picker
      // opens off the public routing service entirely.
      { next: { revalidate: 86400 } },
    );
    if (!res.ok) return;
    const data = await res.json();
    if (data.code !== "Ok") return;
    const dist: (number | null)[] | undefined = data.distances?.[0];
    const dur: (number | null)[] | undefined = data.durations?.[0];
    if (!Array.isArray(dist)) return;
    hotels.forEach((h, i) => {
      const m = dist[i + 1];
      // OSRM returns null for a coordinate it cannot snap to the road network
      // (an island, a bad pin) — those stay unbadged rather than guessed at.
      if (m == null || m < 0) return;
      const secs = dur?.[i + 1];
      out.set(h.id, { km: Math.round((m / 1000) * 10) / 10, min: secs != null ? Math.round(secs / 60) : 0 });
    });
  } catch {
    // Network trouble leaves this chunk unmeasured and its badges hidden.
  }
}

async function roadDistances(
  originLat: number,
  originLng: number,
  hotels: { id: number; lat: number; lng: number }[],
): Promise<Map<number, { km: number; min: number }>> {
  const out = new Map<number, { km: number; min: number }>();
  if (hotels.length === 0) return out;
  const limited = hotels.slice(0, ROAD_MATRIX_MAX_HOTELS);
  // Sequential, not parallel: this is a free public routing service, and a
  // day-cached chunk returns without touching the network anyway.
  for (let i = 0; i < limited.length; i += ROAD_MATRIX_LIMIT) {
    await roadDistanceChunk(originLat, originLng, limited.slice(i, i + ROAD_MATRIX_LIMIT), out);
  }
  return out;
}

export async function searchRoomPricings(
  destinationId: number,
  query: string,
  itineraryId?: number,
  stayBlockOrder?: number,
  stopIndex?: number,
  page: number = 1,
  sortBy?: RoomSearchSort | null,
  /** hotels.stay_type exact match, e.g. "4 Star". */
  starFilter?: string | null,
  /** hotels.category exact match, e.g. "resort". */
  catFilter?: string | null,
  /** Lowercase meal keys ("breakfast"/"lunch"/"dinner") the room's plan
   * must cover ALL of — ignored when noMealsOnly is set. */
  mealFilter?: string[] | null,
  noMealsOnly?: boolean | null,
  /** A DISTANCE_BANDS slug, e.g. "10-25". Needs the stop's coordinates to mean
   *  anything, so it is ignored when the day's stop has none. */
  distanceBand?: string | null,
) {
  const lookupOrder = stopIndex ?? stayBlockOrder;
  const band = findDistanceBand(distanceBand);
  // The default radius already covers every band up to 50 km, since a road is
  // never shorter than the straight line it follows. Only the open-ended top
  // band reaches past it — and without widening here it could never find the
  // very hotels that define it, because the candidate query would have cut
  // them before road distance was ever measured.
  const searchRadiusKm = band
    ? Math.min(
        Math.max(NEARBY_RADIUS_KM, Number.isFinite(band.maxKm) ? band.maxKm : MAX_NEARBY_RADIUS_KM),
        MAX_NEARBY_RADIUS_KM,
      )
    : NEARBY_RADIUS_KM;

  // Resolve the current stop when we have itinerary context
  let stopPlaceName: string | null = null;
  let stopLat: number | null = null;
  let stopLng: number | null = null;

  if (itineraryId != null && lookupOrder != null) {
    const itinerary = await db.package_itineraries.findUnique({
      where: { id: itineraryId },
      select: { route_id: true },
    });
    if (itinerary) {
      const stop = await db.route_stops.findFirst({
        where: { route_id: itinerary.route_id, sort_order: lookupOrder },
        include: { location: { select: { latitude: true, longitude: true } } },
      });
      if (stop) {
        stopPlaceName = stop.place_name;
        stopLat = stop.location?.latitude != null ? Number(stop.location.latitude) : null;
        stopLng = stop.location?.longitude != null ? Number(stop.location.longitude) : null;
      }
    }
  }

  const hotelFilter = {
    is_active: true,
    ...(starFilter ? { stay_type: starFilter } : {}),
    ...(catFilter ? { category: catFilter } : {}),
  };
  const mealClause = noMealsOnly
    ? { OR: [{ meal_type_id: null }, { meal_type: { covered_meals: { isEmpty: true } } }] }
    : mealFilter && mealFilter.length > 0
      ? { meal_type: { covered_meals: { hasEvery: mealFilter } } }
      : {};

  /** Fetches every room_pricing row for these hotel IDs (uncapped — the
   * candidate hotel-ID set is already scoped to a real place, never the
   * whole catalog, so this stays small), then sorts/paginates the FULL set
   * in memory. Capping the DB fetch itself (the old `take: 51`) was the
   * actual bug: hotels sorted after whatever filled that cap — 45 real
   * hotels can exist within 50km of a stop, most of them past a 51-row
   * cut sorted by name — never had a way to appear, "search to refine"
   * notwithstanding, since the filter chips only ever ran on the already-
   * truncated list client-side. */
  async function fetchAndPage(hotelIds: number[] | null) {
    const rows = await db.hotel_room_pricing.findMany({
      where: {
        is_active: true,
        hotel: {
          ...hotelFilter,
          ...(hotelIds ? { id: { in: hotelIds } } : { destination_id: destinationId }),
          ...(query ? { name: { contains: query, mode: "insensitive" as const } } : {}),
        },
        ...mealClause,
      },
      select: HOTEL_SELECT,
    });

    // Great-circle distance still does the ordering and the paging: it needs no
    // network call and it is monotonic enough to decide which twenty hotels are
    // worth looking at. It is never shown — road distance below is what the
    // planner actually sees.
    const withDistance = rows.map((r) => ({
      row: r,
      crowKm: (stopLat != null && stopLng != null && r.hotel.location?.latitude != null && r.hotel.location?.longitude != null)
        ? haversineKm(stopLat, stopLng, Number(r.hotel.location.latitude), Number(r.hotel.location.longitude))
        : null,
    }));

    // ── Distance band ─────────────────────────────────────────────────────
    // Filtering by road distance has to happen BEFORE paging, which means
    // measuring every candidate rather than just the twenty about to render:
    // a hotel with no number can't be shown to be inside the band, and one
    // measured only after paging would be filtered out of a page it had
    // already displaced someone from.
    let candidates = withDistance;
    // Populated only on the band path; the default path still measures just
    // the page it is about to render, as it always has.
    let candidateRoad: Map<number, { km: number; min: number }> | null = null;

    if (band != null && stopLat != null && stopLng != null) {
      // A road can't be shorter than the straight line, so nothing further out
      // than the band's outer edge as the crow flies can land inside it by
      // road. Pruning on that keeps the routing matrix small without changing
      // a single result. (Open-ended bands have nothing to prune against.)
      const inRangeByCrow = Number.isFinite(band.maxKm)
        ? withDistance.filter((p) => p.crowKm != null && p.crowKm <= band.maxKm)
        : withDistance;

      // Nearest-first so that if the candidate set ever runs past the routing
      // ceiling, it's the far tail that goes unmeasured rather than an
      // arbitrary slice of it.
      const seen = new Set<number>();
      const targets: { id: number; lat: number; lng: number }[] = [];
      for (const p of [...inRangeByCrow].sort((a, b) => (a.crowKm ?? Infinity) - (b.crowKm ?? Infinity))) {
        const h = p.row.hotel;
        if (seen.has(h.id) || h.location?.latitude == null || h.location?.longitude == null) continue;
        seen.add(h.id);
        targets.push({ id: h.id, lat: Number(h.location.latitude), lng: Number(h.location.longitude) });
      }
      candidateRoad = await roadDistances(stopLat, stopLng, targets);

      const measured = candidateRoad;
      candidates = inRangeByCrow.filter((p) => {
        const km = measured.get(p.row.hotel.id)?.km;
        if (km == null) return false; // unroutable or past the ceiling
        return km >= band.minKm && km < band.maxKm;
      });
    }

    const effectiveSort = sortBy ?? (stopLat != null && stopLng != null ? "distance" : "name");
    candidates.sort((a, b) => {
      if (effectiveSort === "price_asc") return a.row.price_per_night.toString().localeCompare(b.row.price_per_night.toString(), undefined, { numeric: true }) || a.row.hotel.name.localeCompare(b.row.hotel.name);
      if (effectiveSort === "price_desc") return b.row.price_per_night.toString().localeCompare(a.row.price_per_night.toString(), undefined, { numeric: true }) || a.row.hotel.name.localeCompare(b.row.hotel.name);
      if (effectiveSort === "distance") {
        // On the band path every candidate already has a road number, so the
        // whole set can be ranked by the distance it will actually display —
        // no page-boundary straddling (see below).
        if (candidateRoad) {
          const ak = candidateRoad.get(a.row.hotel.id)?.km ?? Infinity;
          const bk = candidateRoad.get(b.row.hotel.id)?.km ?? Infinity;
          return ak - bk || a.row.hotel.name.localeCompare(b.row.hotel.name);
        }
        return (a.crowKm ?? Infinity) - (b.crowKm ?? Infinity) || a.row.hotel.name.localeCompare(b.row.hotel.name);
      }
      return a.row.hotel.name.localeCompare(b.row.hotel.name);
    });

    const start = (Math.max(page, 1) - 1) * ROOM_SEARCH_PAGE_SIZE;
    const pageSlice = candidates.slice(start, start + ROOM_SEARCH_PAGE_SIZE);

    // One routing call for the page that is about to be rendered, rather than
    // for the whole candidate set: the set can run to hundreds of rows, and
    // only these twenty carry a number the planner will read.
    let road = candidateRoad ?? new Map<number, { km: number; min: number }>();
    if (candidateRoad == null && stopLat != null && stopLng != null) {
      const seen = new Set<number>();
      const targets: { id: number; lat: number; lng: number }[] = [];
      for (const p of pageSlice) {
        const h = p.row.hotel;
        if (seen.has(h.id) || h.location?.latitude == null || h.location?.longitude == null) continue;
        seen.add(h.id);
        targets.push({ id: h.id, lat: Number(h.location.latitude), lng: Number(h.location.longitude) });
      }
      road = await roadDistances(stopLat, stopLng, targets);
    }

    const items = pageSlice.map((p) => {
      const r = road.get(p.row.hotel.id);
      return { ...p.row, roadKm: r?.km ?? null, roadMin: r?.min ?? null };
    });

    // Order the page by the number it displays. The candidate set was ranked by
    // great-circle above, so this only reshuffles within the page — two hotels
    // can still straddle a page boundary out of road order, which beats showing
    // a list sorted by one distance and labelled with another.
    if (effectiveSort === "distance" && candidateRoad == null) {
      items.sort((a, b) => (a.roadKm ?? Infinity) - (b.roadKm ?? Infinity) || a.hotel.name.localeCompare(b.hotel.name));
    }

    return {
      items: toItems(items),
      has_more: candidates.length > start + ROOM_SEARCH_PAGE_SIZE,
      total: candidates.length,
    };
  }

  // ── 1. Haversine proximity (requires coordinates) ──────────────────────
  if (stopLat != null && stopLng != null) {
    type HotelId = { id: number };
    const haversine = `6371 * acos(LEAST(1.0, cos(radians(${stopLat})) * cos(radians(l.latitude::float)) * cos(radians(l.longitude::float) - radians(${stopLng})) + sin(radians(${stopLat})) * sin(radians(l.latitude::float))))`;
    const nearby: HotelId[] = await db.$queryRawUnsafe<HotelId[]>(
      `SELECT h.id FROM hotels h JOIN locations l ON h.location_id = l.id WHERE h.is_active = true AND l.latitude IS NOT NULL AND l.longitude IS NOT NULL AND (${haversine}) <= ${searchRadiusKm}`,
    );
    const nearbyIds = nearby.map((r) => r.id);
    if (nearbyIds.length > 0) {
      const result = await fetchAndPage(nearbyIds);
      if (result.total > 0) return result;
    }
  }

  // ── 2. Place-name city match (when stop has no coords or Haversine empty) ─
  if (stopPlaceName) {
    const rows = await db.hotel_room_pricing.findMany({
      where: {
        is_active: true,
        hotel: {
          ...hotelFilter,
          OR: [
            { city: { contains: stopPlaceName, mode: "insensitive" as const } },
            { name: { contains: query || stopPlaceName, mode: "insensitive" as const } },
          ],
        },
        ...mealClause,
      },
      select: { id: true, hotel: { select: { id: true } } },
    });
    if (rows.length > 0) {
      const result = await fetchAndPage(rows.map((r) => r.hotel.id));
      if (result.total > 0) return result;
    }
  }

  // ── 3. Fallback: destination-wide search ───────────────────────────────
  return fetchAndPage(null);
}

// ── Day source images (for attraction picker) ──────────────────────────────

export type AttractionSourceImage = {
  id: number;
  url: string;
  thumbnail: string | null;
  group_label: string;
  // Pre-filled caption suggestion — set to the activity name for ACTIVITY tab images
  // so clicking an image auto-populates the caption input without a server round-trip.
  default_caption?: string;
};

export type AttractionSourceImages = {
  PACKAGE: AttractionSourceImage[];
  HOTEL: AttractionSourceImage[];
  ACTIVITY: AttractionSourceImage[];
};

export async function getDaySourceImages(
  itineraryId: number,
  packageId: number,
): Promise<AttractionSourceImages> {
  const [packageImgs, hotelImgs, activityImgs] = await Promise.all([
    db.package_images.findMany({
      where: { package_id: packageId },
      orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
      select: { id: true, url: true, thumbnail: true },
    }),
    db.hotel_images.findMany({
      where: {
        url: { not: null },
        hotel: {
          room_pricing: {
            some: { itineraryStays: { some: { itinerary_id: itineraryId } } },
          },
        },
      },
      select: {
        id: true, url: true, thumbnail: true,
        hotel: { select: { id: true, name: true } },
      },
      orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
    }),
    db.activity_images.findMany({
      where: {
        activity: {
          itinerary_activities: { some: { itinerary_id: itineraryId } },
        },
      },
      select: {
        id: true, url: true, thumbnail: true, alt: true, label: true,
        activity: { select: { id: true, name: true } },
      },
      orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
    }),
  ]);

  return {
    PACKAGE: packageImgs.map((img) => ({
      id: img.id, url: img.url, thumbnail: img.thumbnail,
      group_label: "Package Images",
    })),
    HOTEL: hotelImgs
      .filter((img) => img.url != null)
      .map((img) => ({
        id: img.id, url: img.url as string, thumbnail: img.thumbnail,
        group_label: img.hotel.name,
      })),
    ACTIVITY: activityImgs.map((img) => ({
      id: img.id, url: img.url, thumbnail: img.thumbnail,
      group_label: img.activity.name,
      default_caption: img.alt ?? img.label ?? img.activity.name,
    })),
  };
}

// ── Auto-image helper ──────────────────────────────────────────────────────

export async function getActivityPrimaryImage(activityId: number) {
  return db.activity_images.findFirst({
    where: { activity_id: activityId },
    orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
    select: { url: true, alt: true, label: true },
  });
}

// ── Attractions ────────────────────────────────────────────────────────────

export async function addItineraryAttraction(
  itineraryId: number,
  imageKey: string,
  caption: string,
): Promise<AttractionItem> {
  const max = await db.itinerary_attractions.aggregate({
    where: { itinerary_id: itineraryId },
    _max: { sort_order: true },
  });
  const order = (max._max.sort_order ?? -1) + 1;
  return db.itinerary_attractions.create({
    data: { itinerary_id: itineraryId, image_key: imageKey, caption, sort_order: order },
  });
}

export async function bulkAddItineraryAttractions(
  itineraryId: number,
  imageKeys: string[],
): Promise<AttractionItem[]> {
  if (imageKeys.length === 0) return [];
  const max = await db.itinerary_attractions.aggregate({
    where: { itinerary_id: itineraryId },
    _max: { sort_order: true },
  });
  const startOrder = (max._max.sort_order ?? -1) + 1;
  await db.itinerary_attractions.createMany({
    data: imageKeys.map((key, i) => ({
      itinerary_id: itineraryId,
      image_key: key,
      caption: "",
      sort_order: startOrder + i,
    })),
  });
  return db.itinerary_attractions.findMany({
    where: { itinerary_id: itineraryId, sort_order: { gte: startOrder } },
    orderBy: { sort_order: "asc" },
  });
}

export async function updateItineraryAttraction(id: number, caption: string): Promise<void> {
  await db.itinerary_attractions.update({ where: { id }, data: { caption } });
}

export async function deleteItineraryAttraction(id: number): Promise<void> {
  await db.itinerary_attractions.delete({ where: { id } });
}

export async function reorderItineraryAttractions(
  updates: { id: number; sort_order: number }[],
): Promise<void> {
  await db.$transaction(
    updates.map((u) =>
      db.itinerary_attractions.update({ where: { id: u.id }, data: { sort_order: u.sort_order } }),
    ),
  );
}

// ── Stay categories ────────────────────────────────────────────────────────

export type StayCategoryInput = {
  label: string;
  description?: string | null;
  min_duration_days?: number | null;
  is_default?: boolean;
  sort_order?: number;
  is_active?: boolean;
};

export type StayCategoryFull = {
  id: number;
  label: string;
  slug: string;
  description: string | null;
  min_duration_days: number | null;
  is_default: boolean;
  sort_order: number;
  is_active: boolean;
};

function slugifyTier(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tier";
}

async function uniqueTierSlug(packageId: number, label: string, excludeId?: number): Promise<string> {
  const base = slugifyTier(label);
  const cond = excludeId ? { NOT: { id: excludeId } } : {};
  const exists = await db.package_stay_categories.findFirst({ where: { package_id: packageId, slug: base, ...cond } });
  if (!exists) return base;
  let i = 2;
  while (true) {
    const cand = `${base}-${i}`;
    const conflict = await db.package_stay_categories.findFirst({ where: { package_id: packageId, slug: cand, ...cond } });
    if (!conflict) return cand;
    i++;
  }
}

const TIER_SELECT = {
  id: true, label: true, slug: true, description: true,
  min_duration_days: true, is_default: true, sort_order: true, is_active: true,
} as const;

export async function getStayCategories(packageId: number): Promise<StayCategoryFull[]> {
  return db.package_stay_categories.findMany({
    where: { package_id: packageId },
    orderBy: { sort_order: "asc" },
    select: TIER_SELECT,
  });
}

export async function createStayCategory(packageId: number, data: StayCategoryInput): Promise<StayCategoryFull> {
  const slug = await uniqueTierSlug(packageId, data.label);
  const count = await db.package_stay_categories.count({ where: { package_id: packageId } });
  // Auto-default when this is the first category, or when explicitly requested
  const shouldBeDefault = data.is_default || count === 0;
  if (shouldBeDefault) {
    await db.package_stay_categories.updateMany({ where: { package_id: packageId }, data: { is_default: false } });
  }
  return db.package_stay_categories.create({
    data: {
      package_id: packageId,
      label: data.label,
      slug,
      description: data.description ?? null,
      min_duration_days: data.min_duration_days ?? null,
      is_default: shouldBeDefault,
      sort_order: data.sort_order ?? count,
      is_active: data.is_active ?? true,
    },
    select: TIER_SELECT,
  });
}

export async function updateStayCategory(id: number, data: StayCategoryInput): Promise<StayCategoryFull> {
  const existing = await db.package_stay_categories.findUnique({ where: { id }, select: { label: true, package_id: true } });
  if (!existing) throw new Error("Stay category not found");

  const slug =
    existing.label !== data.label
      ? await uniqueTierSlug(existing.package_id, data.label, id)
      : undefined;

  if (data.is_default) {
    await db.package_stay_categories.updateMany({
      where: { package_id: existing.package_id, NOT: { id } },
      data: { is_default: false },
    });
  }

  return db.package_stay_categories.update({
    where: { id },
    data: {
      label: data.label,
      ...(slug ? { slug } : {}),
      description: data.description ?? null,
      min_duration_days: data.min_duration_days ?? null,
      is_default: data.is_default ?? false,
      ...(data.sort_order !== undefined ? { sort_order: data.sort_order } : {}),
      ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
    },
    select: TIER_SELECT,
  });
}

export async function deleteStayCategory(id: number): Promise<void> {
  await db.package_stay_categories.delete({ where: { id } });
}

export async function reorderStayCategories(updates: { id: number; sort_order: number }[]): Promise<void> {
  await db.$transaction(
    updates.map((u) => db.package_stay_categories.update({ where: { id: u.id }, data: { sort_order: u.sort_order } })),
  );
}

// ── Hotel meal pricings ────────────────────────────────────────────────────

export type HotelMealOption = {
  id: number;
  meal_type: string;
  label: string;
  price: number;
  weekend_price: number | null;
};

// ── Copy itinerary days ────────────────────────────────────────────────────

export type CopyDayMapping = {
  targetDay: number;
  sourceDays: number[]; // multiple source days can be merged into one target day
};

export type CopyFields = {
  title: boolean;
  description: boolean;
  activities: boolean;
  stays: boolean;
  notes: boolean;
  transfers: boolean;
  attractions: boolean;
};

export async function copyItineraryDays(
  sourcePackageId: number,
  sourceDurationId: number,
  sourceRouteId: number,
  targetPackageId: number,
  targetDurationId: number,
  targetRouteId: number,
  mappings: CopyDayMapping[],
  fields: CopyFields,
  mode: "replace" | "append",
): Promise<void> {
  const allSourceDayNums = [...new Set(mappings.flatMap((m) => m.sourceDays))];

  const sourceRecords = await db.package_itineraries.findMany({
    where: {
      package_id: sourcePackageId,
      duration_id: sourceDurationId,
      route_id: sourceRouteId,
      day: { in: allSourceDayNums },
    },
    include: {
      itinerary_activities:  { orderBy: { sort_order: "asc" } },
      itinerary_notes:       { orderBy: { sort_order: "asc" } },
      itinerary_attractions: { orderBy: { sort_order: "asc" } },
      itineraryStays:        { orderBy: { sort_order: "asc" }, include: { stay_category: { select: { label: true } } } },
      itinerary_transfers:   { orderBy: { sort_order: "asc" } },
    },
  });

  const srcMap = new Map(sourceRecords.map((r) => [r.day, r]));

  // package_stay_categories belong to a single package — when copying across
  // packages, remap by label (e.g. "Deluxe" → "Deluxe") since the source's
  // stay_category_id would otherwise point at the wrong package's tier.
  const crossPackage = sourcePackageId !== targetPackageId;
  const targetStayCatByLabel = crossPackage
    ? new Map(
        (await db.package_stay_categories.findMany({
          where: { package_id: targetPackageId },
          select: { id: true, label: true },
        })).map((c) => [c.label.trim().toLowerCase(), c.id]),
      )
    : null;

  for (const { targetDay, sourceDays } of mappings) {
    if (sourceDays.length === 0) continue;

    // Primary source = first available source day
    const primary = sourceDays.map((d) => srcMap.get(d)).find(Boolean);
    if (!primary) continue;

    // ── 1. Upsert the target itinerary record ────────────────────────────
    const existing = await db.package_itineraries.findFirst({
      where: { package_id: targetPackageId, duration_id: targetDurationId, route_id: targetRouteId, day: targetDay },
      select: { id: true },
    });

    let targetId: number;
    if (existing) {
      await db.package_itineraries.update({
        where: { id: existing.id },
        data: {
          ...(fields.title       && { title:       primary.title }),
          ...(fields.description && { description: primary.description }),
        },
      });
      targetId = existing.id;
    } else {
      const created = await db.package_itineraries.create({
        data: {
          package_id:    targetPackageId,
          duration_id:   targetDurationId,
          route_id:      targetRouteId,
          day:           targetDay,
          title:         fields.title ? primary.title : `Day ${targetDay}`,
          description:   fields.description ? primary.description : null,
          meals:         primary.meals ?? [],
          excluded_meals: primary.excluded_meals ?? [],
        },
      });
      targetId = created.id;
    }

    // ── 2. Activities ────────────────────────────────────────────────────
    if (fields.activities) {
      if (mode === "replace") {
        await db.itinerary_activities.deleteMany({ where: { itinerary_id: targetId } });
      }
      const currentMax = await db.itinerary_activities.aggregate({
        where: { itinerary_id: targetId }, _max: { sort_order: true },
      });
      let so = (currentMax._max.sort_order ?? -1) + 1;
      for (const srcDay of sourceDays) {
        const src = srcMap.get(srcDay);
        if (!src) continue;
        for (const act of src.itinerary_activities) {
          await db.itinerary_activities.create({
            data: { itinerary_id: targetId, activity_id: act.activity_id, sort_order: so++, is_optional: act.is_optional, variant_id: act.variant_id },
          });
        }
      }
    }

    // ── 3. Stays ─────────────────────────────────────────────────────────
    if (fields.stays) {
      if (mode === "replace") {
        await db.itinerary_stays.deleteMany({ where: { itinerary_id: targetId } });
      }
      for (const srcDay of sourceDays) {
        const src = srcMap.get(srcDay);
        if (!src) continue;
        for (const stay of src.itineraryStays) {
          let stayCategoryId = stay.stay_category_id;
          if (targetStayCatByLabel) {
            const matched = targetStayCatByLabel.get(stay.stay_category.label.trim().toLowerCase());
            if (!matched) continue; // target package has no equivalent stay tier — skip
            stayCategoryId = matched;
          }
          await db.itinerary_stays.upsert({
            where: { itinerary_id_stay_category_id: { itinerary_id: targetId, stay_category_id: stayCategoryId } },
            create: {
              itinerary_id: targetId, stay_category_id: stayCategoryId,
              room_pricing_id: stay.room_pricing_id, sort_order: stay.sort_order,
              occupancy: stay.occupancy, rooms_count: stay.rooms_count,
              num_nights: stay.num_nights, active_meals: stay.active_meals,
            },
            update: {
              room_pricing_id: stay.room_pricing_id, sort_order: stay.sort_order,
              occupancy: stay.occupancy, rooms_count: stay.rooms_count,
              num_nights: stay.num_nights, active_meals: stay.active_meals,
            },
          });
        }
      }
    }

    // ── 4. Notes ─────────────────────────────────────────────────────────
    if (fields.notes) {
      if (mode === "replace") {
        await db.itinerary_notes.deleteMany({ where: { itinerary_id: targetId } });
      }
      const currentMax = await db.itinerary_notes.aggregate({
        where: { itinerary_id: targetId }, _max: { sort_order: true },
      });
      let so = (currentMax._max.sort_order ?? -1) + 1;
      for (const srcDay of sourceDays) {
        const src = srcMap.get(srcDay);
        if (!src) continue;
        for (const note of src.itinerary_notes) {
          await db.itinerary_notes.create({
            data: {
              itinerary_id: targetId, message: note.message,
              type: note.type, position: note.position,
              optional_link_text: note.optional_link_text,
              optional_link_url:  note.optional_link_url,
              sort_order: so++,
            },
          });
        }
      }
    }

    // ── 5. Transfers ─────────────────────────────────────────────────────
    if (fields.transfers) {
      if (mode === "replace") {
        await db.itinerary_transfers.deleteMany({ where: { itinerary_id: targetId } });
      }
      const currentMax = await db.itinerary_transfers.aggregate({
        where: { itinerary_id: targetId }, _max: { sort_order: true },
      });
      let so = (currentMax._max.sort_order ?? -1) + 1;
      for (const srcDay of sourceDays) {
        const src = srcMap.get(srcDay);
        if (!src) continue;
        for (const t of src.itinerary_transfers) {
          await db.itinerary_transfers.create({
            data: {
              itinerary_id: targetId, route_id: t.route_id,
              vehicle_id: t.vehicle_id, num_vehicles: t.num_vehicles,
              notes: t.notes, sort_order: so++, km_override: t.km_override,
            },
          });
        }
      }
    }

    // ── 6. Attractions ───────────────────────────────────────────────────
    if (fields.attractions) {
      if (mode === "replace") {
        await db.itinerary_attractions.deleteMany({ where: { itinerary_id: targetId } });
      }
      const currentMax = await db.itinerary_attractions.aggregate({
        where: { itinerary_id: targetId }, _max: { sort_order: true },
      });
      let so = (currentMax._max.sort_order ?? -1) + 1;
      for (const srcDay of sourceDays) {
        const src = srcMap.get(srcDay);
        if (!src) continue;
        for (const attr of src.itinerary_attractions) {
          await db.itinerary_attractions.create({
            data: { itinerary_id: targetId, image_key: attr.image_key, caption: attr.caption, sort_order: so++ },
          });
        }
      }
    }
  }
}

// ── Cross-package copy helpers ─────────────────────────────────────────────

export type PackageForCopy = { id: number; title: string; destination: string };

export async function searchPackagesForCopy(
  query: string,
  destinationId?: number,
  excludePackageId?: number,
): Promise<PackageForCopy[]> {
  const rows = await db.packages.findMany({
    where: {
      ...(query.trim() ? { title: { contains: query.trim(), mode: "insensitive" } } : {}),
      ...(destinationId ? { destination_id: destinationId } : {}),
      ...(excludePackageId ? { id: { not: excludePackageId } } : {}),
    },
    select: { id: true, title: true, destination: { select: { name: true } } },
    orderBy: { created_at: "desc" },
    take: 20,
  });
  return rows.map((p) => ({ id: p.id, title: p.title ?? `Package ${p.id}`, destination: p.destination?.name ?? "" }));
}

export type DurationForCopy = {
  id: number;
  label: string;
  days: number;
  is_default: boolean;
  routes: { id: number; name: string }[];
};

export async function getPackageDurationsForCopy(packageId: number): Promise<DurationForCopy[]> {
  const rows = await db.package_durations.findMany({
    where: { package_id: packageId },
    orderBy: { days: "asc" },
    select: {
      id: true, label: true, days: true, is_default: true,
      routes: { orderBy: { sort_order: "asc" }, select: { id: true, name: true } },
    },
  });
  return rows;
}

export async function getHotelMealPricings(hotelId: number): Promise<HotelMealOption[]> {
  const rows = await db.hotel_meal_pricing.findMany({
    where: { hotel_id: hotelId, is_active: true },
    orderBy: { sort_order: "asc" },
    select: { id: true, meal_type: true, label: true, price: true, weekend_price: true },
  });
  return rows.map((r) => ({
    id: r.id,
    meal_type: r.meal_type,
    label: r.label,
    price: Number(r.price),
    weekend_price: r.weekend_price != null ? Number(r.weekend_price) : null,
  }));
}
