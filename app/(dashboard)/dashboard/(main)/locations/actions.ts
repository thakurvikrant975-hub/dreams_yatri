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

  return {
    locations: rows.map((r) => ({
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
  return serialize(loc);
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

    await db.location.update({
      where: { id: bigId },
      data: {
        ...parsed.data,
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
