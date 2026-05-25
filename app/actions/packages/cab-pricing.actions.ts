"use server";

import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";

// ── Types ──────────────────────────────────────────────────────────────────

export type CabSegmentInput = {
  day_from: number;
  day_to: number;
  cab_pricing_id: number;
  sort_order?: number;
};

export type CreateCabTypeInput = {
  package_id: number;
  duration_id: number;
  vehicle_id: number;
  label?: string | null;
  note?: string | null;
  is_default?: boolean;
  segments: CabSegmentInput[];
};

export type UpdateCabTypeInput = {
  label?: string | null;
  note?: string | null;
  is_active?: boolean;
  is_default?: boolean;
};

export type CabPricingOption = {
  cab_pricing_id: number;
  destination_id: number;
  destination_name: string;
  pricing_type: "PER_DAY" | "PER_KM";
  price: number;
  cost_price: number | null;
  seasons_count: number;
};

// ── Create cab type (with initial segments) ────────────────────────────────

export async function createCabType(data: CreateCabTypeInput) {
  try {
    const result = await db.$transaction(async (tx) => {
      // NOTE: we do NOT clear other defaults here.
      // Each group (unique day-range within a duration) manages its own default
      // independently. Clearing all defaults in the duration would wipe defaults
      // in other groups. Use setDefaultCabType() to move the default within a group.

      const cabType = await tx.package_cab_types.create({
        data: {
          package_id: data.package_id,
          duration_id: data.duration_id,
          vehicle_id: data.vehicle_id,
          label: data.label?.trim() || null,
          note: data.note?.trim() || null,
          is_default: data.is_default ?? false,
          is_active: true,
          sort_order: 0,
        },
      });

      if (data.segments.length > 0) {
        await tx.package_cab_segments.createMany({
          data: data.segments.map((s, i) => ({
            cab_type_id: cabType.id,
            day_from: s.day_from,
            day_to: s.day_to,
            cab_pricing_id: s.cab_pricing_id,
            sort_order: s.sort_order ?? i,
          })),
        });
      }

      return cabType;
    });

    revalidatePath(`/dashboard/packages/${data.package_id}`);
    return { success: true as const, id: result.id };
  } catch (e) {
    console.error("createCabType:", e);
    return { success: false as const, error: "Failed to create cab type" };
  }
}

// ── Update cab type metadata ───────────────────────────────────────────────

export async function updateCabType(
  id: number,
  packageId: number,
  data: UpdateCabTypeInput,
) {
  try {
    await db.$transaction(async (tx) => {
      // NOTE: is_default is updated as a plain field here with no side-effects.
      // Callers that want to "move the default" within a group should use
      // setDefaultCabType() instead, which is group-aware.
      await tx.package_cab_types.update({
        where: { id },
        data: {
          ...(data.label !== undefined && { label: data.label?.trim() || null }),
          ...(data.note !== undefined && { note: data.note?.trim() || null }),
          ...(data.is_active !== undefined && { is_active: data.is_active }),
          ...(data.is_default !== undefined && { is_default: data.is_default }),
        },
      });
    });

    revalidatePath(`/dashboard/packages/${packageId}`);
    return { success: true as const };
  } catch (e) {
    console.error("updateCabType:", e);
    return { success: false as const, error: "Failed to update cab type" };
  }
}

// ── Set default cab type within a group ───────────────────────────────────
// Only clears is_default for other cab types that share the same first-segment
// day range (i.e. the same group), leaving defaults in other groups untouched.

export async function setDefaultCabType(id: number, packageId: number) {
  try {
    await db.$transaction(async (tx) => {
      // Load the target's duration + first segment day range
      const target = await tx.package_cab_types.findUnique({
        where: { id },
        select: {
          duration_id: true,
          segments: {
            orderBy: { sort_order: "asc" },
            take: 1,
            select: { day_from: true, day_to: true },
          },
        },
      });
      if (!target) throw new Error("Cab type not found");

      const seg = target.segments[0];
      if (seg) {
        // Find all other cab types in the same group:
        // same package + duration + a segment with the matching day range
        const groupMembers = await tx.package_cab_types.findMany({
          where: {
            package_id: packageId,
            duration_id: target.duration_id,
            id: { not: id },
            segments: {
              some: { day_from: seg.day_from, day_to: seg.day_to },
            },
          },
          select: { id: true },
        });

        if (groupMembers.length > 0) {
          await tx.package_cab_types.updateMany({
            where: { id: { in: groupMembers.map((m) => m.id) } },
            data: { is_default: false },
          });
        }
      }

      // Set the target as default
      await tx.package_cab_types.update({
        where: { id },
        data: { is_default: true },
      });
    });

    revalidatePath(`/dashboard/packages/${packageId}`);
    return { success: true as const };
  } catch (e) {
    console.error("setDefaultCabType:", e);
    return { success: false as const, error: "Failed to set default" };
  }
}

// ── Delete cab type (cascades to segments) ─────────────────────────────────

export async function deleteCabType(id: number, packageId: number) {
  try {
    await db.package_cab_types.delete({ where: { id } });
    revalidatePath(`/dashboard/packages/${packageId}`);
    return { success: true as const };
  } catch (e) {
    console.error("deleteCabType:", e);
    return { success: false as const, error: "Failed to delete cab type" };
  }
}

// ── Upsert a single segment ────────────────────────────────────────────────

export async function upsertCabSegment(data: {
  id?: number;
  cab_type_id: number;
  package_id: number;
  day_from: number;
  day_to: number;
  cab_pricing_id: number;
  sort_order?: number;
}) {
  try {
    let result;
    if (data.id) {
      result = await db.package_cab_segments.update({
        where: { id: data.id },
        data: {
          day_from: data.day_from,
          day_to: data.day_to,
          cab_pricing_id: data.cab_pricing_id,
          sort_order: data.sort_order ?? 0,
        },
      });
    } else {
      result = await db.package_cab_segments.create({
        data: {
          cab_type_id: data.cab_type_id,
          day_from: data.day_from,
          day_to: data.day_to,
          cab_pricing_id: data.cab_pricing_id,
          sort_order: data.sort_order ?? 0,
        },
      });
    }

    revalidatePath(`/dashboard/packages/${data.package_id}`);
    return { success: true as const, id: result.id };
  } catch (e) {
    console.error("upsertCabSegment:", e);
    return { success: false as const, error: "Failed to save segment" };
  }
}

// ── Delete a single segment ────────────────────────────────────────────────

export async function deleteCabSegment(id: number, packageId: number) {
  try {
    await db.package_cab_segments.delete({ where: { id } });
    revalidatePath(`/dashboard/packages/${packageId}`);
    return { success: true as const };
  } catch (e) {
    console.error("deleteCabSegment:", e);
    return { success: false as const, error: "Failed to delete segment" };
  }
}

// ── Load cab_pricing options for a vehicle (for segment selector) ──────────

export async function getCabPricingOptionsForVehicle(
  vehicleId: number,
): Promise<{ success: true; data: CabPricingOption[] } | { success: false; error: string }> {
  try {
    const rows = await db.cab_pricing.findMany({
      where: { vehicle_id: vehicleId, is_active: true },
      orderBy: { destination: { name: "asc" } },
      select: {
        id: true,
        destination_id: true,
        pricing_type: true,
        price: true,
        cost_price: true,
        destination: { select: { name: true } },
        _count: { select: { seasons: true } },
      },
    });

    return {
      success: true,
      data: rows.map((r) => ({
        cab_pricing_id: r.id,
        destination_id: r.destination_id,
        destination_name: r.destination.name,
        pricing_type: r.pricing_type as "PER_DAY" | "PER_KM",
        price: Number(r.price),
        cost_price: r.cost_price != null ? Number(r.cost_price) : null,
        seasons_count: r._count.seasons,
      })),
    };
  } catch (e) {
    console.error("getCabPricingOptionsForVehicle:", e);
    return { success: false, error: "Failed to load cab pricing options" };
  }
}

// ── Full cab pricing option (includes vehicle info) ────────────────────────

export type FullCabPricingOption = {
  cab_pricing_id: number;
  vehicle_id: number;
  vehicle_name: string;
  vehicle_type: string;
  passenger_capacity: number;
  has_ac: boolean;
  destination_id: number;
  destination_name: string;
  pricing_type: "PER_DAY" | "PER_KM";
  price: number;
  seasons_count: number;
};

// Haversine distance in km between two lat/lng points
function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Load ALL active cab_pricing records with vehicle info.
 * Results are sorted by proximity to the nearest stop coord (if provided),
 * then alphabetically by vehicle name + destination.
 * Pass excludeVehicleIds to filter out already-added vehicles for a duration.
 */
export async function getAllCabPricingOptions(opts: {
  stopCoords?: Array<{ lat: number; lng: number }>;
  excludeVehicleIds?: number[];
  query?: string;
} = {}): Promise<{ success: true; data: FullCabPricingOption[] } | { success: false; error: string }> {
  try {
    const { stopCoords = [], excludeVehicleIds = [], query } = opts;

    const rows = await db.cab_pricing.findMany({
      where: {
        is_active: true,
        ...(excludeVehicleIds.length > 0 ? { vehicle_id: { notIn: excludeVehicleIds } } : {}),
        ...(query
          ? {
              OR: [
                { vehicle: { name: { contains: query, mode: "insensitive" as const } } },
                { destination: { name: { contains: query, mode: "insensitive" as const } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        vehicle_id: true,
        pricing_type: true,
        price: true,
        destination_id: true,
        vehicle: {
          select: { name: true, type: true, passenger_capacity: true, has_ac: true },
        },
        destination: {
          select: { name: true, latitude: true, longitude: true },
        },
        _count: { select: { seasons: true } },
      },
      orderBy: [{ vehicle: { name: "asc" } }, { destination: { name: "asc" } }],
    });

    // Compute proximity distance for sorting
    const withDist = rows.map((r) => {
      let minDist = Infinity;
      if (
        stopCoords.length > 0 &&
        r.destination.latitude != null &&
        r.destination.longitude != null
      ) {
        const dLat = Number(r.destination.latitude);
        const dLng = Number(r.destination.longitude);
        for (const s of stopCoords) {
          const d = haversineKm(s.lat, s.lng, dLat, dLng);
          if (d < minDist) minDist = d;
        }
      }
      return { r, minDist };
    });

    // Sort: nearby first (< 200 km), then rest alphabetically
    withDist.sort((a, b) => {
      const aNearby = a.minDist < 200;
      const bNearby = b.minDist < 200;
      if (aNearby !== bNearby) return aNearby ? -1 : 1;
      if (a.minDist !== b.minDist) return a.minDist - b.minDist;
      return 0;
    });

    return {
      success: true,
      data: withDist.map(({ r }) => ({
        cab_pricing_id: r.id,
        vehicle_id: r.vehicle_id,
        vehicle_name: r.vehicle.name,
        vehicle_type: r.vehicle.type,
        passenger_capacity: r.vehicle.passenger_capacity,
        has_ac: r.vehicle.has_ac,
        destination_id: r.destination_id,
        destination_name: r.destination.name,
        pricing_type: r.pricing_type as "PER_DAY" | "PER_KM",
        price: Number(r.price),
        seasons_count: r._count.seasons,
      })),
    };
  } catch (e) {
    console.error("getAllCabPricingOptions:", e);
    return { success: false, error: "Failed to load cab pricing options" };
  }
}
