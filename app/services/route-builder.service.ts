"use server";

import { db } from "../lib/db";
import { deriveRouteName } from "../lib/route-builder-utils";

// ── Types ──────────────────────────────────────────────────────────────────

export type StopInput = {
  place_name: string;
  stay_days: number;
  location_id?: string | null;
};

export type RouteMeta = {
  name?: string;
  meta_title?: string | null;
  meta_desc?: string | null;
};

export type DurationMeta = {
  days?: number;          // override auto-calculated
  nights?: number;        // override auto-calculated
  label?: string;         // override auto-generated
  is_default?: boolean;
  is_active?: boolean;
  thumbnail_url?: string | null;
  sort_order?: number;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function slugify(str: string) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function findOrCreateDuration(packageId: number, days: number, nights: number) {
  const existing = await db.package_durations.findFirst({
    where: { package_id: packageId, days, nights },
  });
  if (existing) return existing;

  const base = `${days}d-${nights}n`;
  const [slugCount, hasDefault] = await Promise.all([
    db.package_durations.count({
      where: { package_id: packageId, slug: { startsWith: base } },
    }),
    db.package_durations.count({
      where: { package_id: packageId, is_default: true },
    }),
  ]);
  const slug = slugCount === 0 ? base : `${base}-${slugCount}`;

  return db.package_durations.create({
    data: {
      package_id: packageId,
      slug,
      label: `${days}D / ${nights}N`,
      days,
      nights,
      is_default: hasDefault === 0,
      sort_order: 0,
    },
  });
}

async function cleanOrphanDuration(durationId: number) {
  const remaining = await db.package_routes.count({ where: { duration_id: durationId } });
  if (remaining === 0) {
    await db.package_durations.delete({ where: { id: durationId } });
  }
}

async function uniqueRouteSlug(durationId: number, name: string, excludeRouteId?: number) {
  const base = slugify(name);
  const exists = await db.package_routes.findFirst({
    where: { duration_id: durationId, slug: base, NOT: excludeRouteId ? { id: excludeRouteId } : undefined },
  });
  if (!exists) return base;
  let i = 2;
  while (true) {
    const candidate = `${base}-${i}`;
    const conflict = await db.package_routes.findFirst({
      where: {
        duration_id: durationId,
        slug: candidate,
        NOT: excludeRouteId ? { id: excludeRouteId } : undefined,
      },
    });
    if (!conflict) return candidate;
    i++;
  }
}

// ── Queries ────────────────────────────────────────────────────────────────

export async function getPackageRouteData(packageId: number) {
  const data = await db.package_durations.findMany({
    where: { package_id: packageId },
    orderBy: { days: "asc" },
    include: {
      routes: {
        orderBy: { sort_order: "asc" },
        include: {
          stops: {
            orderBy: { sort_order: "asc" },
            select: {
              id: true,
              place_name: true,
              stay_days: true,
              sort_order: true,
              location_id: true,
              location: {
                select: { id: true, latitude: true, longitude: true, type: true, slug: true },
              },
            },
          },
        },
      },
    },
  });

  return data.map((d) => ({
    ...d,
    routes: d.routes.map((r) => ({
      ...r,
      stops: r.stops.map((s) => ({
        id: s.id,
        place_name: s.place_name,
        stay_days: s.stay_days,
        sort_order: s.sort_order,
        location_id: s.location_id ? String(s.location_id) : null,
        location: s.location ? {
          id: String(s.location.id),
          latitude: s.location.latitude != null ? Number(s.location.latitude) : null,
          longitude: s.location.longitude != null ? Number(s.location.longitude) : null,
          type: s.location.type,
          slug: s.location.slug,
        } : null,
      })),
    })),
  }));
}

// ── Mutations ──────────────────────────────────────────────────────────────

export async function upsertRouteVariant(
  packageId: number,
  stops: StopInput[],
  meta?: RouteMeta,
  durationMeta?: DurationMeta,
  routeId?: number,
) {
  if (!stops.length) throw new Error("At least one stop is required");

  const autoNights = stops.reduce((sum, s) => sum + s.stay_days, 0);
  const autoDays = autoNights + 1;
  const days = durationMeta?.days ?? autoDays;
  const nights = durationMeta?.nights ?? (days - 1);
  const autoName = deriveRouteName(stops);
  const name = meta?.name?.trim() || autoName;

  const duration = await findOrCreateDuration(packageId, days, nights);

  // Apply any admin overrides to the duration
  const durationUpdates: Record<string, unknown> = {};
  if (durationMeta?.label !== undefined) durationUpdates.label = durationMeta.label;
  if (durationMeta?.thumbnail_url !== undefined) durationUpdates.thumbnail_url = durationMeta.thumbnail_url;
  if (durationMeta?.sort_order !== undefined) durationUpdates.sort_order = durationMeta.sort_order;
  if (durationMeta?.is_active !== undefined) durationUpdates.is_active = durationMeta.is_active;
  if (durationMeta?.is_default !== undefined) {
    if (durationMeta.is_default) {
      await db.package_durations.updateMany({
        where: { package_id: packageId, NOT: { id: duration.id } },
        data: { is_default: false },
      });
    }
    durationUpdates.is_default = durationMeta.is_default;
  }
  if (Object.keys(durationUpdates).length > 0) {
    await db.package_durations.update({ where: { id: duration.id }, data: durationUpdates });
  }

  const slug = await uniqueRouteSlug(duration.id, name, routeId);

  const stopData = stops.map((s, i) => ({
    place_name: s.place_name,
    stay_days: s.stay_days,
    sort_order: i,
    location_id: s.location_id ? BigInt(s.location_id) : null,
  }));

  if (routeId) {
    const prev = await db.package_routes.findUnique({
      where: { id: routeId },
      select: { duration_id: true },
    });

    await db.route_stops.deleteMany({ where: { route_id: routeId } });
    await db.package_routes.update({
      where: { id: routeId },
      data: {
        duration_id: duration.id,
        name,
        slug,
        meta_title: meta?.meta_title ?? null,
        meta_desc: meta?.meta_desc ?? null,
        stops: { create: stopData },
      },
    });

    if (prev && prev.duration_id !== duration.id) {
      // Migrate itinerary rows to the new duration
      await db.package_itineraries.updateMany({
        where: { route_id: routeId, duration_id: prev.duration_id },
        data: { duration_id: duration.id },
      });

      // Delete empty itinerary rows beyond new total days
      await db.package_itineraries.deleteMany({
        where: {
          route_id: routeId,
          duration_id: duration.id,
          day: { gt: days },
          itinerary_activities: { none: {} },
          itinerary_transfers: { none: {} },
          itinerary_notes: { none: {} },
          itineraryStays: { none: {} },
          itinerary_attractions: { none: {} },
        },
      });

      await cleanOrphanDuration(prev.duration_id);
    }

    return { routeId, durationId: duration.id };
  }

  const route = await db.package_routes.create({
    data: {
      duration_id: duration.id,
      name,
      slug,
      meta_title: meta?.meta_title ?? null,
      meta_desc: meta?.meta_desc ?? null,
      sort_order: 0,
      stops: { create: stopData },
    },
  });

  return { routeId: route.id, durationId: duration.id };
}

export async function deleteRouteVariant(routeId: number) {
  const route = await db.package_routes.findUnique({
    where: { id: routeId },
    select: { duration_id: true, _count: { select: { itineraries: true } } },
  });
  if (!route) throw new Error("Route not found");

  if (route._count.itineraries > 0) {
    const n = route._count.itineraries;
    throw new Error(
      `Cannot delete — this route has ${n} built itinerary day${n !== 1 ? "s" : ""}. Clear the itinerary first.`,
    );
  }

  await db.package_routes.delete({ where: { id: routeId } });
  await cleanOrphanDuration(route.duration_id);
}

export async function updateRouteMeta(
  routeId: number,
  data: { name?: string; slug?: string; meta_title?: string | null; meta_desc?: string | null },
) {
  return db.package_routes.update({ where: { id: routeId }, data });
}

export async function updateDurationMeta(
  durationId: number,
  data: {
    is_default?: boolean;
    thumbnail_url?: string | null;
    sort_order?: number;
    is_active?: boolean;
    label?: string;
  },
) {
  if (data.is_default) {
    const dur = await db.package_durations.findUnique({
      where: { id: durationId },
      select: { package_id: true },
    });
    if (dur) {
      await db.package_durations.updateMany({
        where: { package_id: dur.package_id, NOT: { id: durationId } },
        data: { is_default: false },
      });
    }
  }
  return db.package_durations.update({ where: { id: durationId }, data });
}
