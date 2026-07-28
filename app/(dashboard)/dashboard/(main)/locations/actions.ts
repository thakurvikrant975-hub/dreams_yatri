"use server";

import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { LocationSchema, type LocationTypeValue } from "@/app/lib/validators/locations";
import { createLog } from "../lib/logger";
import { actionError } from "@/app/lib/action-error";
import type { Prisma } from "@/app/generated/prisma";

// ── Auth helper ───────────────────────────────────────────────────────────────

async function requireActor(): Promise<string | null> {
  const session = await dashboardAuth();
  if (!session?.user?.email) return null;
  return session.user.name ?? session.user.email;
}

export type LocationFormState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
};

// A location counts as "in use" once it's referenced by real content —
// hotels, activities, package route stops, or cab transfer pickup/drop points —
// OR it was added manually through this admin page (metadata.source: "manual").
// Without that second branch, a location you just created here would vanish
// from the default view until someone separately links it to a hotel/activity.
const USED_FILTER: Prisma.LocationWhereInput = {
  OR: [
    { hotels: { some: {} } },
    { activities: { some: {} } },
    { route_stops: { some: {} } },
    { pickup_routes: { some: {} } },
    { drop_routes: { some: {} } },
    { metadata: { path: ["source"], equals: "manual" } },
  ],
};

const RECENT_DAYS = 7;

function serialize<T extends { id: bigint; latitude: Prisma.Decimal | null; longitude: Prisma.Decimal | null }>(
  loc: T,
): Omit<T, "id" | "latitude" | "longitude"> & { id: string; latitude: number | null; longitude: number | null } {
  return {
    ...loc,
    id: loc.id.toString(),
    latitude: loc.latitude != null ? Number(loc.latitude) : null,
    longitude: loc.longitude != null ? Number(loc.longitude) : null,
  };
}

// Lightweight ref used to hydrate the Parent/Country/State/City pickers —
// mirrors the LocationValue shape the LocationSearchSelect component expects.
export type LocationRef = { id: string; name: string; type: string; breadcrumb: string; slug: string };

function toRef(loc: { id: bigint; name: string; type: string; slug: string } | null): LocationRef | null {
  if (!loc) return null;
  return { id: loc.id.toString(), name: loc.name, type: loc.type, breadcrumb: loc.name, slug: loc.slug };
}

// Batch-resolve parent/country/state/city display refs for a page of rows —
// avoids an N+1 query per row.
async function attachHierarchyRefs<T extends {
  parent_id: bigint | null; country_id: bigint | null; state_id: bigint | null; city_id: bigint | null;
}>(rows: T[]): Promise<(T & { parent: LocationRef | null; country: LocationRef | null; state: LocationRef | null; city: LocationRef | null })[]> {
  const ids = new Set<bigint>();
  for (const r of rows) {
    if (r.parent_id) ids.add(r.parent_id);
    if (r.country_id) ids.add(r.country_id);
    if (r.state_id) ids.add(r.state_id);
    if (r.city_id) ids.add(r.city_id);
  }
  const refs = ids.size > 0
    ? await db.location.findMany({
        where: { id: { in: [...ids] } },
        select: { id: true, name: true, type: true, slug: true },
      })
    : [];
  const map = new Map(refs.map((r) => [r.id.toString(), r]));
  return rows.map((r) => ({
    ...r,
    parent: toRef(r.parent_id ? (map.get(r.parent_id.toString()) ?? null) : null),
    country: toRef(r.country_id ? (map.get(r.country_id.toString()) ?? null) : null),
    state: toRef(r.state_id ? (map.get(r.state_id.toString()) ?? null) : null),
    city: toRef(r.city_id ? (map.get(r.city_id.toString()) ?? null) : null),
  }));
}

// Location has no created_by/updated_by columns (unlike destinations), so
// attribution is derived from the ActivityLog audit trail this page already
// writes to. Bounded by the current page's ids — cheap, no N+1.
async function attachActors<T extends { id: bigint }>(
  rows: T[],
): Promise<(T & { createdByName: string | null; updatedByName: string | null })[]> {
  const ids = rows.map((r) => r.id.toString());
  const logs = ids.length > 0
    ? await db.activityLog.findMany({
        where: { entity: "Location", entityId: { in: ids }, action: { in: ["CREATE", "UPDATE"] } },
        orderBy: { actionAt: "desc" },
        select: { entityId: true, action: true, userName: true },
      })
    : [];

  const latestMap = new Map<string, string | null>();
  const createdMap = new Map<string, string | null>();
  for (const log of logs) {
    if (!log.entityId) continue;
    if (!latestMap.has(log.entityId)) latestMap.set(log.entityId, log.userName);
    if (log.action === "CREATE" && !createdMap.has(log.entityId)) createdMap.set(log.entityId, log.userName);
  }

  return rows.map((r) => {
    const id = r.id.toString();
    return {
      ...r,
      createdByName: createdMap.get(id) ?? null,
      updatedByName: latestMap.get(id) ?? null,
    };
  });
}

// ── Read ──────────────────────────────────────────────────────────────────────

export type GetLocationsParams = {
  page?: number;
  limit?: number;
  search?: string;
  type?: LocationTypeValue | "all";
  scope?: "used" | "all";
  status?: "active" | "inactive" | "all";
};

export async function getLocations(params: GetLocationsParams = {}) {
  const { page = 1, limit = 20, search = "", type, scope = "used", status = "all" } = params;
  const skip = (page - 1) * limit;

  const where: Prisma.LocationWhereInput = {
    ...(scope === "used" ? USED_FILTER : {}),
    ...(search ? {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { slug: { contains: search, mode: "insensitive" as const } },
        { official_name: { contains: search, mode: "insensitive" as const } },
      ],
    } : {}),
    ...(type && type !== "all" ? { type } : {}),
    ...(status === "active" ? { is_active: true } : {}),
    ...(status === "inactive" ? { is_active: false } : {}),
  };

  const recentSince = new Date();
  recentSince.setDate(recentSince.getDate() - RECENT_DAYS);

  const [rows, totalCount, totalAll, usedCount, activeCount, recentCount] = await Promise.all([
    db.location.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip,
      take: limit,
      include: {
        _count: {
          select: { hotels: true, activities: true, route_stops: true, pickup_routes: true, drop_routes: true },
        },
      },
    }),
    db.location.count({ where }),
    db.location.count(),
    db.location.count({ where: USED_FILTER }),
    db.location.count({ where: { ...USED_FILTER, is_active: true } }),
    db.location.count({ where: { ...USED_FILTER, created_at: { gte: recentSince } } }),
  ]);

  const withRefs = await attachHierarchyRefs(rows);
  const withActors = await attachActors(withRefs);

  return {
    locations: withActors.map((r) => ({
      ...serialize(r),
      linkedCount:
        r._count.hotels + r._count.activities + r._count.route_stops +
        r._count.pickup_routes + r._count.drop_routes,
    })),
    totalCount,
    stats: {
      total: totalAll,
      used: usedCount,
      active: activeCount,
      inactive: usedCount - activeCount,
      recent: recentCount,
    },
  };
}

export async function getLocationById(id: string) {
  let bigId: bigint;
  try {
    bigId = BigInt(id);
  } catch {
    return null;
  }
  const loc = await db.location.findUnique({ where: { id: bigId } });
  if (!loc) return null;
  const [withRefs] = await attachHierarchyRefs([loc]);
  const [withActor] = await attachActors([withRefs]);
  return serialize(withActor);
}

// ── Duplicate detection ───────────────────────────────────────────────────────

export type LocationDuplicateMatch = {
  id: string;
  name: string;
  slug: string;
  latitude: number | null;
  longitude: number | null;
  createdByName: string | null;
  created_at: Date;
};

export async function checkLocationDuplicate(
  name: string,
  type: string,
  excludeId?: string,
): Promise<{ matches: LocationDuplicateMatch[] }> {
  if (!name || name.trim().length < 2) return { matches: [] };

  const rows = await db.location.findMany({
    where: {
      type: type as LocationTypeValue,
      name: { contains: name.trim(), mode: "insensitive" },
      ...(excludeId ? { NOT: { id: BigInt(excludeId) } } : {}),
    },
    select: { id: true, name: true, slug: true, latitude: true, longitude: true, created_at: true },
    take: 3,
    orderBy: { created_at: "desc" },
  });

  if (rows.length === 0) return { matches: [] };

  const ids = rows.map((r) => r.id.toString());
  const logs = await db.activityLog.findMany({
    where: { entity: "Location", entityId: { in: ids }, action: "CREATE" },
    select: { entityId: true, userName: true },
  });
  const creatorMap = new Map(logs.map((l) => [l.entityId, l.userName]));

  return {
    matches: rows.map((r) => ({
      id: r.id.toString(),
      name: r.name,
      slug: r.slug,
      latitude: r.latitude != null ? Number(r.latitude) : null,
      longitude: r.longitude != null ? Number(r.longitude) : null,
      createdByName: creatorMap.get(r.id.toString()) ?? null,
      created_at: r.created_at,
    })),
  };
}

// ── Merge search ──────────────────────────────────────────────────────────────
// Like checkLocationDuplicate, but for the "Merge Duplicates" picker rather
// than the create-form's "heads up" warning: no excludeId, a higher result
// cap, and a linked-item count per row (across every kind that references a
// Location — including cab_pricing/permits and the self-referential
// parent/city/state/country fields, which aren't part of the day-to-day
// Linked Items sheet but matter for an accurate merge preview).

export type LocationMergeCandidate = {
  id: string;
  name: string;
  slug: string;
  type: string;
  latitude: number | null;
  longitude: number | null;
  linkedCount: number;
};

export async function searchLocationsForMerge(
  name: string,
  type: LocationTypeValue,
): Promise<{ candidates: LocationMergeCandidate[] }> {
  if (!name || name.trim().length < 2) return { candidates: [] };

  const rows = await db.location.findMany({
    where: { type, name: { contains: name.trim(), mode: "insensitive" } },
    select: {
      id: true, name: true, slug: true, type: true, latitude: true, longitude: true,
      _count: {
        select: {
          hotels: true, activities: true, route_stops: true,
          pickup_routes: true, drop_routes: true, cabPricings: true, permits: true,
          children: true, city_children: true, state_children: true, country_children: true,
        },
      },
    },
    take: 20,
    orderBy: { created_at: "desc" },
  });

  return {
    candidates: rows.map((r) => ({
      id: r.id.toString(),
      name: r.name,
      slug: r.slug,
      type: r.type,
      latitude: r.latitude != null ? Number(r.latitude) : null,
      longitude: r.longitude != null ? Number(r.longitude) : null,
      linkedCount:
        r._count.hotels + r._count.activities + r._count.route_stops +
        r._count.pickup_routes + r._count.drop_routes + r._count.cabPricings + r._count.permits +
        r._count.children + r._count.city_children + r._count.state_children + r._count.country_children,
    })),
  };
}

// ── Slug availability check ───────────────────────────────────────────────────

export async function checkLocationSlug(
  slug: string,
  excludeId?: string,
): Promise<{ exists: boolean; suggestion: string }> {
  if (!slug) return { exists: false, suggestion: slug };

  const existing = await db.location.findFirst({
    where: { slug, ...(excludeId ? { NOT: { id: BigInt(excludeId) } } : {}) },
  });
  if (!existing) return { exists: false, suggestion: slug };

  let counter = 2;
  let candidate = `${slug}-${counter}`;
  while (counter < 100) {
    const conflict = await db.location.findFirst({ where: { slug: candidate } });
    if (!conflict) break;
    counter++;
    candidate = `${slug}-${counter}`;
  }

  return { exists: true, suggestion: candidate };
}

// ── Create ────────────────────────────────────────────────────────────────────

function extractRaw(formData: FormData) {
  return {
    type: formData.get("type") as string,
    name: formData.get("name") as string,
    official_name: (formData.get("official_name") as string) || undefined,
    slug: formData.get("slug") as string,
    short_code: (formData.get("short_code") as string) || undefined,
    iso_code: (formData.get("iso_code") as string) || undefined,
    latitude: formData.get("latitude") ? Number(formData.get("latitude")) : null,
    longitude: formData.get("longitude") ? Number(formData.get("longitude")) : null,
    elevation_meters: formData.get("elevation_meters") ? Number(formData.get("elevation_meters")) : null,
    population: formData.get("population") ? Number(formData.get("population")) : null,
    timezone: (formData.get("timezone") as string) || undefined,
    description: (formData.get("description") as string) || undefined,
    is_featured: formData.get("is_featured") === "true",
    is_popular: formData.get("is_popular") === "true",
    is_searchable: formData.get("is_searchable") !== "false",
    is_active: formData.get("is_active") !== "false",
    parent_id: (formData.get("parent_id") as string) || undefined,
    country_id: (formData.get("country_id") as string) || undefined,
    state_id: (formData.get("state_id") as string) || undefined,
    city_id: (formData.get("city_id") as string) || undefined,
    seo_title: (formData.get("seo_title") as string) || undefined,
    seo_description: (formData.get("seo_description") as string) || undefined,
    hero_image: (formData.get("hero_image") as string) || undefined,
    geonames_id: formData.get("geonames_id") ? Number(formData.get("geonames_id")) : null,
    osm_id: (formData.get("osm_id") as string) || undefined,
    mapbox_id: (formData.get("mapbox_id") as string) || undefined,
  };
}

// Pulls the hierarchy/BigInt-FK fields out of a parsed LocationInput so they
// can be converted to BigInt (or null) separately from the rest of the data.
function buildHierarchyData(data: {
  parent_id?: string; country_id?: string; state_id?: string; city_id?: string;
}) {
  return {
    parent_id: data.parent_id ? BigInt(data.parent_id) : null,
    country_id: data.country_id ? BigInt(data.country_id) : null,
    state_id: data.state_id ? BigInt(data.state_id) : null,
    city_id: data.city_id ? BigInt(data.city_id) : null,
  };
}

export async function createLocation(
  _prev: LocationFormState,
  formData: FormData,
): Promise<LocationFormState> {
  const actor = await requireActor();
  if (!actor) return { success: false, message: "Unauthorized" };

  const parsed = LocationSchema.safeParse(extractRaw(formData));
  if (!parsed.success) {
    return { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const existing = await db.location.findFirst({ where: { slug: parsed.data.slug } });
    if (existing) {
      return { success: false, message: "Slug already exists", errors: { slug: ["This slug is already taken"] } };
    }

    const created = await db.location.create({
      data: {
        ...parsed.data,
        ...buildHierarchyData(parsed.data),
        latitude: parsed.data.latitude != null ? String(parsed.data.latitude) : null,
        longitude: parsed.data.longitude != null ? String(parsed.data.longitude) : null,
        metadata: { source: "manual" },
      },
    });

    await createLog({
      action: "CREATE",
      entity: "Location",
      entityId: created.id.toString(),
      entitySlug: created.slug,
      newData: { name: created.name, slug: created.slug, type: created.type },
    });

    revalidatePath("/dashboard/locations");
    return { success: true, message: "Location created successfully" };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateLocation(
  id: string,
  _prev: LocationFormState,
  formData: FormData,
): Promise<LocationFormState> {
  const actor = await requireActor();
  if (!actor) return { success: false, message: "Unauthorized" };

  const bigId = BigInt(id);
  const current = await db.location.findUnique({ where: { id: bigId } });
  if (!current) return { success: false, message: "Location not found" };

  const parsed = LocationSchema.safeParse(extractRaw(formData));
  if (!parsed.success) {
    return { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const slugConflict = await db.location.findFirst({
      where: { slug: parsed.data.slug, NOT: { id: bigId } },
    });
    if (slugConflict) {
      return { success: false, message: "Slug already taken", errors: { slug: ["This slug is already taken"] } };
    }

    if ([parsed.data.parent_id, parsed.data.country_id, parsed.data.state_id, parsed.data.city_id].includes(id)) {
      return { success: false, message: "A location cannot be its own parent, country, state, or city" };
    }

    await db.location.update({
      where: { id: bigId },
      data: {
        ...parsed.data,
        ...buildHierarchyData(parsed.data),
        latitude: parsed.data.latitude != null ? String(parsed.data.latitude) : null,
        longitude: parsed.data.longitude != null ? String(parsed.data.longitude) : null,
      },
    });

    await createLog({
      action: "UPDATE",
      entity: "Location",
      entityId: id,
      entitySlug: parsed.data.slug,
      previousData: { name: current.name, type: current.type, is_active: current.is_active },
      newData: { name: parsed.data.name, type: parsed.data.type, is_active: parsed.data.is_active },
    });

    revalidatePath("/dashboard/locations");
    return { success: true, message: "Location updated successfully" };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteLocation(id: string): Promise<LocationFormState> {
  const actor = await requireActor();
  if (!actor) return { success: false, message: "Unauthorized" };

  try {
    const bigId = BigInt(id);
    const loc = await db.location.findUnique({
      where: { id: bigId },
      include: {
        _count: {
          select: {
            hotels: true, activities: true, route_stops: true,
            pickup_routes: true, drop_routes: true, children: true,
          },
        },
      },
    });

    if (!loc) return { success: false, message: "Location not found" };

    const linkedCount =
      loc._count.hotels + loc._count.activities + loc._count.route_stops +
      loc._count.pickup_routes + loc._count.drop_routes + loc._count.children;

    if (linkedCount > 0) {
      const parts: string[] = [];
      if (loc._count.hotels) parts.push(`${loc._count.hotels} hotel(s)`);
      if (loc._count.activities) parts.push(`${loc._count.activities} activity(ies)`);
      if (loc._count.route_stops) parts.push(`${loc._count.route_stops} route stop(s)`);
      if (loc._count.pickup_routes + loc._count.drop_routes) parts.push(`${loc._count.pickup_routes + loc._count.drop_routes} transfer route(s)`);
      if (loc._count.children) parts.push(`${loc._count.children} child location(s)`);
      return {
        success: false,
        message: `Cannot delete — linked to: ${parts.join(", ")}. Remove them first.`,
      };
    }

    await db.location.delete({ where: { id: bigId } });

    await createLog({
      action: "DELETE",
      entity: "Location",
      entityId: id,
      entitySlug: loc.slug,
      previousData: { name: loc.name, type: loc.type, slug: loc.slug },
    });

    revalidatePath("/dashboard/locations");
    return { success: true, message: "Location deleted successfully" };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

// ── Toggle Active ─────────────────────────────────────────────────────────────

export async function toggleLocationActive(
  id: string,
  is_active: boolean,
): Promise<LocationFormState> {
  const actor = await requireActor();
  if (!actor) return { success: false, message: "Unauthorized" };

  try {
    const bigId = BigInt(id);
    const row = await db.location.update({
      where: { id: bigId },
      data: { is_active },
      select: { slug: true },
    });

    await createLog({
      action: "UPDATE",
      entity: "Location",
      entityId: id,
      entitySlug: row.slug,
      newData: { is_active },
      metadata: { operation: "toggle_active" },
    });

    revalidatePath("/dashboard/locations");
    return { success: true, message: `Location ${is_active ? "activated" : "deactivated"}` };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

// ── History ───────────────────────────────────────────────────────────────────

export async function getLocationHistory(id: string) {
  return db.activityLog.findMany({
    where: { entity: "Location", entityId: id },
    orderBy: { actionAt: "desc" },
    select: {
      id: true, action: true, description: true, userName: true, userEmail: true,
      previousData: true, newData: true, metadata: true, status: true, actionAt: true,
    },
    take: 50,
  });
}

// ── Linked items ──────────────────────────────────────────────────────────────
// The "Linked" count on the table is just a number — this resolves it into the
// actual hotel/activity/route-stop/transfer records so a wrong link can be
// identified and fixed (either jump to the owning record's edit page, or
// unlink it directly when it was clearly a mistake).

export type LinkedItemKind = "hotel" | "activity" | "route_stop" | "transfer_pickup" | "transfer_drop";

export type LocationLinkedItem = {
  kind: LinkedItemKind;
  refId: number;
  label: string;
  context: string | null;
  editHref: string | null;
};

export async function getLocationLinkedItems(id: string): Promise<LocationLinkedItem[]> {
  const bigId = BigInt(id);

  const [hotels, activities, routeStops, transferRoutes] = await Promise.all([
    db.hotels.findMany({ where: { location_id: bigId }, select: { id: true, name: true } }),
    db.activities.findMany({ where: { location_id: bigId }, select: { id: true, name: true } }),
    db.route_stops.findMany({
      where: { location_id: bigId },
      select: {
        id: true, place_name: true,
        route: { select: { duration: { select: { package: { select: { id: true, title: true } } } } } },
      },
    }),
    db.transfer_routes.findMany({
      where: { OR: [{ pickup_location_id: bigId }, { drop_location_id: bigId }] },
      select: {
        id: true, pickup_name: true, drop_name: true, pickup_location_id: true, drop_location_id: true,
        transfers: {
          take: 1,
          select: { itinerary: { select: { package: { select: { id: true, title: true } } } } },
        },
      },
    }),
  ]);

  const items: LocationLinkedItem[] = [];

  for (const h of hotels) {
    items.push({ kind: "hotel", refId: h.id, label: h.name, context: null, editHref: `/dashboard/hotels/${h.id}` });
  }
  for (const a of activities) {
    items.push({ kind: "activity", refId: a.id, label: a.name, context: null, editHref: `/dashboard/activities/${a.id}` });
  }
  for (const rs of routeStops) {
    const pkg = rs.route.duration.package;
    items.push({
      kind: "route_stop", refId: rs.id, label: rs.place_name,
      context: `Route stop in "${pkg.title}"`, editHref: `/dashboard/packages/${pkg.id}`,
    });
  }
  for (const tr of transferRoutes) {
    const pkg = tr.transfers[0]?.itinerary?.package ?? null;
    const route = `${tr.pickup_name} → ${tr.drop_name}`;
    const editHref = pkg ? `/dashboard/packages/${pkg.id}` : null;
    const context = pkg ? `Transfer route in "${pkg.title}"` : "Transfer route (not yet used in an itinerary)";
    if (tr.pickup_location_id === bigId) {
      items.push({ kind: "transfer_pickup", refId: tr.id, label: `Pickup — ${route}`, context, editHref });
    }
    if (tr.drop_location_id === bigId) {
      items.push({ kind: "transfer_drop", refId: tr.id, label: `Drop — ${route}`, context, editHref });
    }
  }

  return items;
}

// ── Unlink ────────────────────────────────────────────────────────────────────
// Quick fix for "this got linked to the wrong location" — detaches the
// reference without touching the referencing record otherwise. Safe for all
// five kinds: none of them require a non-null location.

export async function unlinkLocationReference(
  kind: LinkedItemKind,
  refId: number,
): Promise<LocationFormState> {
  const actor = await requireActor();
  if (!actor) return { success: false, message: "Unauthorized" };

  try {
    switch (kind) {
      case "hotel": {
        const row = await db.hotels.update({ where: { id: refId }, data: { location_id: null }, select: { name: true } });
        await createLog({
          action: "UPDATE", entity: "Hotel", entityId: String(refId), entitySlug: row.name,
          newData: { location_id: null }, metadata: { operation: "unlink_location" },
        });
        revalidatePath("/dashboard/hotels");
        break;
      }
      case "activity": {
        const row = await db.activities.update({ where: { id: refId }, data: { location_id: null }, select: { name: true } });
        await createLog({
          action: "UPDATE", entity: "Activity", entityId: String(refId), entitySlug: row.name,
          newData: { location_id: null }, metadata: { operation: "unlink_location" },
        });
        revalidatePath("/dashboard/activities");
        break;
      }
      case "route_stop": {
        const row = await db.route_stops.update({ where: { id: refId }, data: { location_id: null }, select: { place_name: true } });
        await createLog({
          action: "UPDATE", entity: "RouteStop", entityId: String(refId), entitySlug: row.place_name,
          newData: { location_id: null }, metadata: { operation: "unlink_location" },
        });
        break;
      }
      case "transfer_pickup": {
        const row = await db.transfer_routes.update({ where: { id: refId }, data: { pickup_location_id: null }, select: { pickup_name: true } });
        await createLog({
          action: "UPDATE", entity: "TransferRoute", entityId: String(refId), entitySlug: row.pickup_name,
          newData: { pickup_location_id: null }, metadata: { operation: "unlink_pickup_location" },
        });
        break;
      }
      case "transfer_drop": {
        const row = await db.transfer_routes.update({ where: { id: refId }, data: { drop_location_id: null }, select: { drop_name: true } });
        await createLog({
          action: "UPDATE", entity: "TransferRoute", entityId: String(refId), entitySlug: row.drop_name,
          newData: { drop_location_id: null }, metadata: { operation: "unlink_drop_location" },
        });
        break;
      }
    }

    revalidatePath("/dashboard/locations");
    return { success: true, message: "Unlinked from this location" };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

// ── Relink (point at a different Location) ────────────────────────────────────
// Same correction as unlink, but re-pointed at a different Location instead of
// cleared — for when a hotel/activity/route was linked to the wrong place
// rather than one that shouldn't be linked at all.

export async function relinkLocationReference(
  kind: LinkedItemKind,
  refId: number,
  newLocationId: string,
): Promise<LocationFormState> {
  const actor = await requireActor();
  if (!actor) return { success: false, message: "Unauthorized" };

  let newBigId: bigint;
  try {
    newBigId = BigInt(newLocationId);
  } catch {
    return { success: false, message: "Invalid location" };
  }

  try {
    const target = await db.location.findUnique({ where: { id: newBigId }, select: { name: true } });
    if (!target) return { success: false, message: "That location no longer exists" };

    switch (kind) {
      case "hotel": {
        const row = await db.hotels.update({ where: { id: refId }, data: { location_id: newBigId }, select: { name: true } });
        await createLog({
          action: "UPDATE", entity: "Hotel", entityId: String(refId), entitySlug: row.name,
          newData: { location_id: newLocationId, location_name: target.name }, metadata: { operation: "relink_location" },
        });
        revalidatePath("/dashboard/hotels");
        break;
      }
      case "activity": {
        const row = await db.activities.update({ where: { id: refId }, data: { location_id: newBigId }, select: { name: true } });
        await createLog({
          action: "UPDATE", entity: "Activity", entityId: String(refId), entitySlug: row.name,
          newData: { location_id: newLocationId, location_name: target.name }, metadata: { operation: "relink_location" },
        });
        revalidatePath("/dashboard/activities");
        break;
      }
      case "route_stop": {
        const row = await db.route_stops.update({ where: { id: refId }, data: { location_id: newBigId }, select: { place_name: true } });
        await createLog({
          action: "UPDATE", entity: "RouteStop", entityId: String(refId), entitySlug: row.place_name,
          newData: { location_id: newLocationId, location_name: target.name }, metadata: { operation: "relink_location" },
        });
        break;
      }
      case "transfer_pickup": {
        const row = await db.transfer_routes.update({ where: { id: refId }, data: { pickup_location_id: newBigId }, select: { pickup_name: true } });
        await createLog({
          action: "UPDATE", entity: "TransferRoute", entityId: String(refId), entitySlug: row.pickup_name,
          newData: { pickup_location_id: newLocationId, location_name: target.name }, metadata: { operation: "relink_pickup_location" },
        });
        break;
      }
      case "transfer_drop": {
        const row = await db.transfer_routes.update({ where: { id: refId }, data: { drop_location_id: newBigId }, select: { drop_name: true } });
        await createLog({
          action: "UPDATE", entity: "TransferRoute", entityId: String(refId), entitySlug: row.drop_name,
          newData: { drop_location_id: newLocationId, location_name: target.name }, metadata: { operation: "relink_drop_location" },
        });
        break;
      }
    }

    revalidatePath("/dashboard/locations");
    return { success: true, message: `Relinked to ${target.name}` };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

// ── Merge ─────────────────────────────────────────────────────────────────────
// Bulk version of relinkLocationReference — repoints every reference held by
// each source location onto the target, then deletes the sources. Covers two
// categories the Linked Items sheet doesn't surface (cab_pricing/permits, and
// Location's own self-referential parent/city/state/country fields) because
// skipping them would either silently null out real data (cab_pricing/permits
// both use onDelete: SetNull) or block the delete outright (the self-ref
// fields default to onDelete: Restrict).

export type MergeLocationsResult = LocationFormState & {
  movedCounts?: Record<string, number>;
};

export async function mergeLocations(
  targetId: string,
  sourceIds: string[],
): Promise<MergeLocationsResult> {
  const actor = await requireActor();
  if (!actor) return { success: false, message: "Unauthorized" };

  const cleanSourceIds = [...new Set(sourceIds)].filter((id) => id !== targetId);
  if (cleanSourceIds.length === 0) {
    return { success: false, message: "Select at least one other location to merge in." };
  }

  let targetBigId: bigint;
  let sourceBigIds: bigint[];
  try {
    targetBigId = BigInt(targetId);
    sourceBigIds = cleanSourceIds.map((id) => BigInt(id));
  } catch {
    return { success: false, message: "Invalid location id" };
  }

  try {
    const [target, sources] = await Promise.all([
      db.location.findUnique({ where: { id: targetBigId }, select: { id: true, name: true, type: true, slug: true } }),
      db.location.findMany({ where: { id: { in: sourceBigIds } }, select: { id: true, name: true, type: true } }),
    ]);

    if (!target) return { success: false, message: "Target location not found" };
    if (sources.length !== sourceBigIds.length) return { success: false, message: "One or more source locations no longer exist" };
    if (sources.some((s) => s.type !== target.type)) {
      return { success: false, message: "All locations being merged must be the same type" };
    }

    const idsIn = { in: sourceBigIds };

    const [
      hotels, activities, routeStops, pickups, drops, cabPricings, permits,
      parents, cities, states, countries,
    ] = await db.$transaction([
      db.hotels.updateMany({ where: { location_id: idsIn }, data: { location_id: targetBigId } }),
      db.activities.updateMany({ where: { location_id: idsIn }, data: { location_id: targetBigId } }),
      db.route_stops.updateMany({ where: { location_id: idsIn }, data: { location_id: targetBigId } }),
      db.transfer_routes.updateMany({ where: { pickup_location_id: idsIn }, data: { pickup_location_id: targetBigId } }),
      db.transfer_routes.updateMany({ where: { drop_location_id: idsIn }, data: { drop_location_id: targetBigId } }),
      db.cab_pricing.updateMany({ where: { location_id: idsIn }, data: { location_id: targetBigId } }),
      db.permits.updateMany({ where: { location_id: idsIn }, data: { location_id: targetBigId } }),
      db.location.updateMany({ where: { parent_id: idsIn }, data: { parent_id: targetBigId } }),
      db.location.updateMany({ where: { city_id: idsIn }, data: { city_id: targetBigId } }),
      db.location.updateMany({ where: { state_id: idsIn }, data: { state_id: targetBigId } }),
      db.location.updateMany({ where: { country_id: idsIn }, data: { country_id: targetBigId } }),
      db.location.deleteMany({ where: { id: idsIn } }),
    ]);

    const movedCounts = {
      hotels: hotels.count, activities: activities.count, route_stops: routeStops.count,
      transfer_pickups: pickups.count, transfer_drops: drops.count,
      cab_pricing: cabPricings.count, permits: permits.count,
      child_locations: parents.count + cities.count + states.count + countries.count,
    };
    const totalMoved = Object.values(movedCounts).reduce((a, b) => a + b, 0);

    await createLog({
      action: "UPDATE",
      entity: "Location",
      entityId: target.id.toString(),
      entitySlug: target.slug,
      newData: { mergedFrom: sources.map((s) => ({ id: s.id.toString(), name: s.name })), movedCounts },
      metadata: { operation: "merge", sourceCount: sources.length, totalMoved },
    });

    revalidatePath("/dashboard/locations");
    revalidatePath("/dashboard/hotels");
    revalidatePath("/dashboard/activities");

    return {
      success: true,
      message: `Merged ${sources.length} location${sources.length === 1 ? "" : "s"} into "${target.name}" — ${totalMoved} link${totalMoved === 1 ? "" : "s"} moved.`,
      movedCounts,
    };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}
