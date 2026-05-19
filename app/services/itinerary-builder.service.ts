"use server";

import { db } from "../lib/db";

// ── Exported types ─────────────────────────────────────────────────────────

export type TransferInput = {
  pickup_name: string;
  pickup_place_id?: string | null;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  drop_name: string;
  drop_place_id?: string | null;
  drop_lat?: number | null;
  drop_lng?: number | null;
  vehicle_id?: number | null;
  num_vehicles?: number;
  notes?: string | null;
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
  activity: { id: number; name: string; category: string | null; duration_hours: number | null };
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
  route: {
    id: number;
    pickup_name: string;
    pickup_lat: number | null;
    pickup_lng: number | null;
    drop_name: string;
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
  room_pricing: {
    id: number;
    plan_name: string | null;
    price_per_night: number;
    hotel: { id: number; name: string };
    room: { id: number; name: string } | null;
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
          activity: { select: { id: true, name: true, duration_hours: true, category: { select: { name: true } } } },
          variant: { select: { id: true, name: true } },
        },
      },
      itinerary_transfers: {
          orderBy: { sort_order: "asc" },
          include: {
            route: { select: { id: true, pickup_name: true, pickup_lat: true, pickup_lng: true, drop_name: true, drop_lat: true, drop_lng: true, distance_km: true, duration_min: true } },
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
              hotel: { select: { id: true, name: true } },
              room: { select: { id: true, name: true } },
            },
          },
          stay_category: { select: { id: true, label: true, slug: true } },
        },
      },
    },
  });

  return Array.from({ length: duration.days }, (_, i): DayData => {
    const day = i + 1;
    const rec = records.find((r) => r.day === day);
    if (!rec) {
      return { id: null, day, title: `Day ${day}`, description: null, activities: [], transfers: [], notes: [], stays: [], attractions: [] };
    }
    return {
      id: rec.id,
      day,
      title: rec.title,
      description: rec.description,
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
          route: t.route ? {
            id: t.route.id,
            pickup_name: t.route.pickup_name,
            pickup_lat: t.route.pickup_lat != null ? Number(t.route.pickup_lat) : null,
            pickup_lng: t.route.pickup_lng != null ? Number(t.route.pickup_lng) : null,
            drop_name: t.route.drop_name,
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
        room_pricing: {
          id: s.room_pricing.id,
          plan_name: s.room_pricing.plan_name,
          price_per_night: Number(s.room_pricing.price_per_night),
          hotel: s.room_pricing.hotel,
          room: s.room_pricing.room,
        },
        stay_category: s.stay_category,
      })),
      attractions: rec.itinerary_attractions,
    };
  });
}

// ── Day meta ───────────────────────────────────────────────────────────────

export async function upsertDayMeta(
  packageId: number,
  durationId: number,
  routeId: number,
  day: number,
  data: { title: string; description?: string | null },
) {
  const existing = await db.package_itineraries.findFirst({
    where: { package_id: packageId, duration_id: durationId, route_id: routeId, day },
    select: { id: true },
  });
  if (existing) {
    return db.package_itineraries.update({
      where: { id: existing.id },
      data: { title: data.title, description: data.description ?? null },
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
    },
  });
  return variants.map((v) => ({
    id: v.id,
    name: v.name,
    pricingTiers: v.pricing.map((p) => ({ id: p.id, label: p.label, price: Number(p.price) })),
  }));
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

  // Try to find existing route by place IDs first
  if (data.pickup_place_id && data.drop_place_id) {
    const existing = await db.transfer_routes.findFirst({
      where: { pickup_place_id: data.pickup_place_id, drop_place_id: data.drop_place_id },
      select: { id: true },
    });
    if (existing) return existing.id;
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
      pickup_place_id: data.pickup_place_id ?? null,
      pickup_lat: data.pickup_lat ?? null,
      pickup_lng: data.pickup_lng ?? null,
      drop_name: data.drop_name,
      drop_place_id: data.drop_place_id ?? null,
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
  return db.itinerary_stays.create({
    data: { itinerary_id: itineraryId, stay_category_id: stayCategoryId, room_pricing_id: roomPricingId, sort_order: sortOrder, num_nights: numNights },
  });
}

export async function deleteItineraryStay(id: number) {
  return db.itinerary_stays.delete({ where: { id } });
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
      ...(query ? { name: { contains: query, mode: "insensitive" as const } } : {}),
    },
    select: { id: true, name: true, duration_hours: true, category: { select: { name: true } } },
    take: 20,
    orderBy: { name: "asc" },
  });
  return list.map((a) => ({
    id: a.id,
    name: a.name,
    category: a.category?.name ?? null,
    duration_hours: a.duration_hours != null ? Number(a.duration_hours) : null,
  }));
}

export async function searchRoomPricings(_destinationId: number, query: string) {
  const list = await db.hotel_room_pricing.findMany({
    where: {
      is_active: true,
      hotel: {
        is_active: true,
        ...(query ? { name: { contains: query, mode: "insensitive" as const } } : {}),
      },
    },
    select: {
      id: true,
      plan_name: true,
      price_per_night: true,
      hotel: { select: { id: true, name: true } },
      room: { select: { id: true, name: true } },
    },
    take: 50,
    orderBy: [{ hotel: { name: "asc" } }, { sort_order: "asc" }],
  });
  return list.map((p) => ({
    ...p,
    price_per_night: Number(p.price_per_night),
  }));
}

// ── Day source images (for attraction picker) ──────────────────────────────

export type AttractionSourceImage = {
  id: number;
  url: string;
  thumbnail: string | null;
  group_label: string;
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
        id: true, url: true, thumbnail: true,
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
    })),
  };
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
