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
// hotels, activities, package route stops, or cab transfer pickup/drop points.
const USED_FILTER: Prisma.LocationWhereInput = {
  OR: [
    { hotels: { some: {} } },
    { activities: { some: {} } },
    { route_stops: { some: {} } },
    { pickup_routes: { some: {} } },
    { drop_routes: { some: {} } },
  ],
};

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

  const [rows, totalCount, totalAll, usedCount, activeCount] = await Promise.all([
    db.location.findMany({
      where,
      orderBy: { updated_at: "desc" },
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
  ]);

  const withRefs = await attachHierarchyRefs(rows);

  return {
    locations: withRefs.map((r) => ({
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
  return serialize(withRefs);
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
