"use server";

import { db } from "../lib/db";

// ── Exported types ─────────────────────────────────────────────────────────

export type TransferInput = {
  cab_type?: string | null;
  pickup_point?: string | null;
  drop_point?: string | null;
  duration_text?: string | null;
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
  activity: { id: number; name: string; category: string | null; duration_hours: number | null };
};

export type TransferItem = {
  id: number;
  itinerary_id: number;
  cab_type: string | null;
  pickup_point: string | null;
  drop_point: string | null;
  duration_text: string | null;
  sort_order: number;
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
  room_pricing: {
    id: number;
    plan_name: string | null;
    price_per_night: number;
    hotel: { id: number; name: string };
    room: { id: number; name: string } | null;
  };
  stay_category: { id: number; label: string; slug: string };
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
          activity: { select: { id: true, name: true, duration_hours: true, category: true } },
        },
      },
      itinerary_transfers: { orderBy: { sort_order: "asc" } },
      itinerary_notes: { orderBy: { sort_order: "asc" } },
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
      return { id: null, day, title: `Day ${day}`, description: null, activities: [], transfers: [], notes: [], stays: [] };
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
        activity: {
          id: ia.activity.id,
          name: ia.activity.name,
          category: ia.activity.category,
          duration_hours: ia.activity.duration_hours != null ? Number(ia.activity.duration_hours) : null,
        },
      })),
      transfers: rec.itinerary_transfers,
      notes: rec.itinerary_notes,
      stays: rec.itineraryStays.map((s) => ({
        id: s.id,
        stay_category_id: s.stay_category_id,
        sort_order: s.sort_order,
        room_pricing: {
          id: s.room_pricing.id,
          plan_name: s.room_pricing.plan_name,
          price_per_night: Number(s.room_pricing.price_per_night),
          hotel: s.room_pricing.hotel,
          room: s.room_pricing.room,
        },
        stay_category: s.stay_category,
      })),
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

export async function addItineraryActivity(itineraryId: number, activityId: number, isOptional = false) {
  const order = await nextSortOrder(itineraryId);
  return db.itinerary_activities.create({
    data: { itinerary_id: itineraryId, activity_id: activityId, is_optional: isOptional, sort_order: order },
  });
}

export async function updateItineraryActivity(id: number, data: { is_optional?: boolean; sort_order?: number }) {
  return db.itinerary_activities.update({ where: { id }, data });
}

export async function deleteItineraryActivity(id: number) {
  return db.itinerary_activities.delete({ where: { id } });
}

// ── Transfers ──────────────────────────────────────────────────────────────

export async function addItineraryTransfer(itineraryId: number, data: TransferInput) {
  const order = await nextSortOrder(itineraryId);
  return db.itinerary_transfers.create({
    data: {
      itinerary_id: itineraryId,
      cab_type: data.cab_type ?? null,
      pickup_point: data.pickup_point ?? null,
      drop_point: data.drop_point ?? null,
      duration_text: data.duration_text ?? null,
      sort_order: order,
    },
  });
}

export async function updateItineraryTransfer(id: number, data: TransferInput) {
  return db.itinerary_transfers.update({
    where: { id },
    data: {
      cab_type: data.cab_type ?? null,
      pickup_point: data.pickup_point ?? null,
      drop_point: data.drop_point ?? null,
      duration_text: data.duration_text ?? null,
    },
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
) {
  const existing = await db.itinerary_stays.findFirst({
    where: { itinerary_id: itineraryId, stay_category_id: stayCategoryId },
    select: { id: true },
  });
  if (existing) {
    return db.itinerary_stays.update({
      where: { id: existing.id },
      data: { room_pricing_id: roomPricingId, sort_order: sortOrder },
    });
  }
  return db.itinerary_stays.create({
    data: { itinerary_id: itineraryId, stay_category_id: stayCategoryId, room_pricing_id: roomPricingId, sort_order: sortOrder },
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
      // stay: update all stays for this itinerary to same sort_order
      return db.itinerary_stays.updateMany({
        where: { itinerary_id: u.itinerary_id },
        data: { sort_order: u.sort_order },
      });
    }),
  );
}

// ── Search ─────────────────────────────────────────────────────────────────

export async function searchActivities(destinationId: number, query: string) {
  const list = await db.activities.findMany({
    where: {
      destination_id: destinationId,
      is_active: true,
      ...(query ? { name: { contains: query, mode: "insensitive" as const } } : {}),
    },
    select: { id: true, name: true, duration_hours: true, category: true },
    take: 20,
    orderBy: { name: "asc" },
  });
  return list.map((a) => ({
    ...a,
    duration_hours: a.duration_hours != null ? Number(a.duration_hours) : null,
  }));
}

export async function searchRoomPricings(destinationId: number, query: string) {
  const list = await db.hotel_room_pricing.findMany({
    where: {
      is_active: true,
      hotel: {
        destination_id: destinationId,
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
    take: 30,
    orderBy: [{ hotel: { name: "asc" } }, { sort_order: "asc" }],
  });
  return list.map((p) => ({
    ...p,
    price_per_night: Number(p.price_per_night),
  }));
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
  if (data.is_default) {
    await db.package_stay_categories.updateMany({ where: { package_id: packageId }, data: { is_default: false } });
  }
  return db.package_stay_categories.create({
    data: {
      package_id: packageId,
      label: data.label,
      slug,
      description: data.description ?? null,
      min_duration_days: data.min_duration_days ?? null,
      is_default: data.is_default ?? false,
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
