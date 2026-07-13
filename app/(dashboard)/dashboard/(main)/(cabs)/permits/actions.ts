"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/app/lib/db";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { getThumbnailImage } from "@/app/lib/imageUrl";
import { createLog } from "../../lib/logger";
import type {
  PermitCategory, PermitValidityType, PermitRow, PermitInput,
  CabPricingCityOption, VehicleCandidate,
} from "./permit.types";

const PATH = "/dashboard/permits";

/** Straight-line distance in km — good enough for "how far from the permit
 * location" context, not a driving distance. Mirrors the same helper used
 * for hotel/cab nearest-city search in the sales package builder. */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Helpers ────────────────────────────────────────────────────────────────

function mapRow(r: {
  id: number;
  name: string;
  category: string;
  custom_category: string | null;
  location_id: bigint | null;
  location: { name: string } | null;
  issuing_authority: string | null;
  vehicleRates: {
    vehicle_id: number;
    price_per_vehicle: { toNumber(): number };
    price_per_km: { toNumber(): number } | null;
    vehicle: {
      id: number; name: string; type: string;
      passenger_capacity: number; has_ac: boolean; image_key: string | null;
    };
  }[];
  validity_type: string;
  validity_days: number | null;
  notes: string | null;
  is_active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
}): PermitRow {
  return {
    id:                r.id,
    name:              r.name,
    category:          r.category as PermitCategory,
    custom_category:   r.custom_category,
    location_id:       r.location_id?.toString() ?? null,
    location_name:     r.location?.name ?? null,
    issuing_authority: r.issuing_authority,
    vehicle_rates:     r.vehicleRates.map((vr) => ({
      vehicle_id:         vr.vehicle.id,
      vehicle_name:       vr.vehicle.name,
      vehicle_type:       vr.vehicle.type,
      passenger_capacity: vr.vehicle.passenger_capacity,
      has_ac:             vr.vehicle.has_ac,
      thumbnail:          vr.vehicle.image_key ? getThumbnailImage(vr.vehicle.image_key) : null,
      price_per_vehicle:  vr.price_per_vehicle.toNumber(),
      price_per_km:       vr.price_per_km?.toNumber() ?? null,
    })),
    validity_type:     r.validity_type as PermitValidityType,
    validity_days:     r.validity_days,
    notes:             r.notes,
    is_active:         r.is_active,
    created_by:        r.created_by,
    updated_by:        r.updated_by,
    created_at:        r.created_at,
    updated_at:        r.updated_at,
  };
}

const INCLUDE = {
  location: { select: { name: true } },
  vehicleRates: {
    include: {
      vehicle: {
        select: {
          id: true, name: true, type: true,
          passenger_capacity: true, has_ac: true, image_key: true,
        },
      },
    },
    orderBy: { vehicle: { name: "asc" as const } },
  },
} as const;

// ── Read ───────────────────────────────────────────────────────────────────

export async function getPermits(opts: {
  page:     number;
  limit:    number;
  search:   string;
  category: string;
  status:   string;
}): Promise<{
  rows:        PermitRow[];
  memberNames: Record<string, string>;
  total:       number;
  totalPages:  number;
  stats: { total: number; active: number; inactive: number; withLocation: number };
}> {
  const { page, limit, search, category, status } = opts;

  const where = {
    ...(search
      ? {
          OR: [
            { name:              { contains: search, mode: "insensitive" as const } },
            { issuing_authority: { contains: search, mode: "insensitive" as const } },
            { location:          { name: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
    ...(category && category !== "all" ? { category: category as never } : {}),
    ...(status === "active"   ? { is_active: true  } :
        status === "inactive" ? { is_active: false } : {}),
  };

  const [rows, total, statsTotal, statsActive, statsWithLoc] = await Promise.all([
    db.permits.findMany({
      where,
      include: INCLUDE,
      orderBy: [{ is_active: "desc" }, { name: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.permits.count({ where }),
    db.permits.count(),
    db.permits.count({ where: { is_active: true } }),
    db.permits.count({ where: { location_id: { not: null } } }),
  ]);

  const mapped = rows.map(mapRow);
  const actorIds = [...new Set(mapped.flatMap((r) => [r.created_by, r.updated_by]).filter(Boolean) as string[])];
  const members = actorIds.length > 0
    ? await db.teamMember.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })
    : [];
  const memberNames: Record<string, string> = Object.fromEntries(members.map((m) => [m.id, m.name]));

  return {
    rows:       mapped,
    memberNames,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    stats: {
      total:        statsTotal,
      active:       statsActive,
      inactive:     statsTotal - statsActive,
      withLocation: statsWithLoc,
    },
  };
}

// ── Create ─────────────────────────────────────────────────────────────────

export async function createPermit(input: PermitInput) {
  const session = await dashboardAuth();
  const actor = session?.user?.id ?? null;

  try {
    const name = input.name.trim();
    if (!name) return { success: false as const, message: "Permit name is required" };

    const created = await db.permits.create({
      data: {
        name,
        category:          input.category,
        custom_category:   input.category === "OTHER" ? (input.custom_category?.trim() || null) : null,
        location_id:       input.location_id ? BigInt(input.location_id) : null,
        issuing_authority: input.issuing_authority?.trim() || null,
        validity_type:     input.validity_type,
        validity_days:     input.validity_type === "MULTI_DAY" ? (input.validity_days ?? null) : null,
        notes:             input.notes?.trim() || null,
        is_active:         true,
        created_by:        actor,
        updated_by:        actor,
        // price_per_vehicle/price_per_person intentionally omitted — this
        // form only manages per-vehicle rates now; the legacy columns keep
        // their schema default (0/null) for the older catalog pricing engine.
        vehicleRates: {
          create: input.vehicle_rates.map((v) => ({
            vehicle_id:        v.vehicle_id,
            price_per_vehicle: v.price_per_vehicle,
            price_per_km:      v.price_per_km,
          })),
        },
      },
      include: INCLUDE,
    });

    revalidatePath(PATH);
    await createLog({
      action:     "CREATE",
      entity:     "Permit",
      entityId:   String(created.id),
      entitySlug: created.name,
      newData:    { name: created.name, category: created.category },
    });

    return { success: true as const, data: mapRow(created) };
  } catch (e) {
    console.error("[createPermit]", e);
    return { success: false as const, message: "Failed to create permit" };
  }
}

// ── Update ─────────────────────────────────────────────────────────────────

export async function updatePermit(id: number, input: PermitInput) {
  const session = await dashboardAuth();
  const actor = session?.user?.id ?? null;

  try {
    const name = input.name.trim();
    if (!name) return { success: false as const, message: "Permit name is required" };

    const updated = await db.permits.update({
      where: { id },
      data: {
        name,
        category:          input.category,
        custom_category:   input.category === "OTHER" ? (input.custom_category?.trim() || null) : null,
        location_id:       input.location_id ? BigInt(input.location_id) : null,
        issuing_authority: input.issuing_authority?.trim() || null,
        validity_type:     input.validity_type,
        validity_days:     input.validity_type === "MULTI_DAY" ? (input.validity_days ?? null) : null,
        notes:             input.notes?.trim() || null,
        updated_by:        actor,
        // Full replace — the form always submits the complete current list.
        vehicleRates: {
          deleteMany: {},
          create: input.vehicle_rates.map((v) => ({
            vehicle_id:        v.vehicle_id,
            price_per_vehicle: v.price_per_vehicle,
            price_per_km:      v.price_per_km,
          })),
        },
      },
      include: INCLUDE,
    });

    revalidatePath(PATH);
    await createLog({
      action:     "UPDATE",
      entity:     "Permit",
      entityId:   String(updated.id),
      entitySlug: updated.name,
    });

    return { success: true as const, data: mapRow(updated) };
  } catch (e) {
    console.error("[updatePermit]", e);
    return { success: false as const, message: "Failed to update permit" };
  }
}

// ── History ────────────────────────────────────────────────────────────────

export async function getPermitHistory(id: number | string) {
  return db.activityLog.findMany({
    where:   { entity: "Permit", entityId: String(id) },
    orderBy: { actionAt: "desc" },
    select: {
      id:           true,
      action:       true,
      description:  true,
      userName:     true,
      userEmail:    true,
      previousData: true,
      newData:      true,
      metadata:     true,
      status:       true,
      actionAt:     true,
    },
    take: 50,
  });
}

// ── Toggle Active ──────────────────────────────────────────────────────────

export async function togglePermitActive(id: number, value: boolean) {
  try {
    await db.permits.update({ where: { id }, data: { is_active: value } });
    revalidatePath(PATH);
    return { success: true as const };
  } catch (e) {
    console.error("[togglePermitActive]", e);
    return { success: false as const, message: "Failed to update status" };
  }
}

// ── Delete ─────────────────────────────────────────────────────────────────

export async function deletePermit(id: number) {
  try {
    const deleted = await db.permits.delete({ where: { id } });
    revalidatePath(PATH);
    await createLog({
      action:     "DELETE",
      entity:     "Permit",
      entityId:   String(id),
      entitySlug: deleted.name,
    });
    return { success: true as const, message: "Permit deleted" };
  } catch (e) {
    console.error("[deletePermit]", e);
    return { success: false as const, message: "Failed to delete permit" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Vehicle picker for a permit — cab_pricing is the real, bookable source of
// "which vehicles exist for which city", so a permit's per-vehicle rates are
// populated by picking cities from there rather than the whole vehicle
// catalog. Cities are sorted by straight-line distance from the permit's own
// location so the nearest real pricing data surfaces first.
// ─────────────────────────────────────────────────────────────────────────────

const CITY_PAGE_SIZE = 10;

export async function getCabPricingCities(
  permitLocationId: string | null,
  page: number = 1,
): Promise<{ cities: CabPricingCityOption[]; hasMore: boolean }> {
  let refCoords: { lat: number; lng: number } | null = null;
  if (permitLocationId) {
    const loc = await db.location.findUnique({
      where:  { id: BigInt(permitLocationId) },
      select: { latitude: true, longitude: true },
    });
    if (loc?.latitude != null && loc?.longitude != null) {
      refCoords = { lat: Number(loc.latitude), lng: Number(loc.longitude) };
    }
  }

  const rows = await db.cab_pricing.findMany({
    where:  { is_active: true },
    select: {
      vehicle_id:  true,
      destination: { select: { id: true, name: true } },
      location: {
        select: {
          id: true, name: true, latitude: true, longitude: true,
          state: { select: { name: true } },
        },
      },
    },
  });

  type Group = { cityName: string; stateName: string | null; lat: number | null; lng: number | null; vehicleIds: Set<number> };
  const groups = new Map<string, Group>();

  for (const row of rows) {
    const cityKey = row.destination ? `dest:${row.destination.id}` : row.location ? `loc:${row.location.id}` : null;
    if (!cityKey) continue;

    let g = groups.get(cityKey);
    if (!g) {
      g = {
        cityName:  row.destination?.name ?? row.location?.name ?? "Unknown",
        stateName: row.location?.state?.name ?? null,
        lat:       row.location?.latitude != null ? Number(row.location.latitude) : null,
        lng:       row.location?.longitude != null ? Number(row.location.longitude) : null,
        vehicleIds: new Set(),
      };
      groups.set(cityKey, g);
    }
    g.vehicleIds.add(row.vehicle_id);
  }

  const list: CabPricingCityOption[] = Array.from(groups.entries()).map(([cityKey, g]) => ({
    cityKey,
    cityName:     g.cityName,
    stateName:    g.stateName,
    vehicleCount: g.vehicleIds.size,
    distanceKm:   (refCoords && g.lat != null && g.lng != null)
      ? Math.round(haversineKm(refCoords.lat, refCoords.lng, g.lat, g.lng) * 10) / 10
      : null,
  }));

  list.sort((a, b) => {
    if (a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm;
    if (a.distanceKm != null) return -1;
    if (b.distanceKm != null) return 1;
    return a.cityName.localeCompare(b.cityName);
  });

  const start = (Math.max(page, 1) - 1) * CITY_PAGE_SIZE;
  const cities = list.slice(start, start + CITY_PAGE_SIZE);
  return { cities, hasMore: start + CITY_PAGE_SIZE < list.length };
}

/** Given the cityKeys selected in the picker above, returns every distinct
 * vehicle priced in cab_pricing across those cities (deduped by vehicle). */
export async function getVehiclesForCabPricingCities(cityKeys: string[]): Promise<VehicleCandidate[]> {
  const destIds = cityKeys.filter((k) => k.startsWith("dest:")).map((k) => Number(k.slice(5)));
  const locIds  = cityKeys.filter((k) => k.startsWith("loc:")).map((k) => BigInt(k.slice(4)));
  if (destIds.length === 0 && locIds.length === 0) return [];

  const rows = await db.cab_pricing.findMany({
    where: {
      is_active: true,
      OR: [
        ...(destIds.length > 0 ? [{ destination_id: { in: destIds } }] : []),
        ...(locIds.length > 0 ? [{ location_id: { in: locIds } }] : []),
      ],
    },
    select: {
      vehicle: {
        select: {
          id: true, name: true, type: true,
          passenger_capacity: true, has_ac: true, image_key: true,
        },
      },
    },
    distinct: ["vehicle_id"],
  });

  return rows.map((r) => ({
    vehicle_id:         r.vehicle.id,
    vehicle_name:       r.vehicle.name,
    vehicle_type:       r.vehicle.type,
    passenger_capacity: r.vehicle.passenger_capacity,
    has_ac:             r.vehicle.has_ac,
    thumbnail:          r.vehicle.image_key ? getThumbnailImage(r.vehicle.image_key) : null,
  }));
}
