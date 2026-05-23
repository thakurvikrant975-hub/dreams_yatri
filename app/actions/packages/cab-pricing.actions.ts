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
      // If this is set as default, clear other defaults for same package+duration
      if (data.is_default) {
        await tx.package_cab_types.updateMany({
          where: { package_id: data.package_id, duration_id: data.duration_id },
          data: { is_default: false },
        });
      }

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
      // If marking as default, clear others for same package+duration first
      if (data.is_default) {
        const current = await tx.package_cab_types.findUnique({
          where: { id },
          select: { duration_id: true },
        });
        if (current) {
          await tx.package_cab_types.updateMany({
            where: { package_id: packageId, duration_id: current.duration_id, id: { not: id } },
            data: { is_default: false },
          });
        }
      }
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
