"use server";

import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";
import type { PermitOption, PermitPriceType, PackagePermit } from "./permit.types";

// ── Permit library lookup (for package builder dropdown) ──────────────────

export async function getPermitOptions(query?: string): Promise<{
  success: true; data: PermitOption[];
} | { success: false }> {
  try {
    const permits = await db.permits.findMany({
      where: {
        is_active: true,
        ...(query
          ? {
              OR: [
                { name:     { contains: query, mode: "insensitive" as const } },
                { location: { name: { contains: query, mode: "insensitive" as const } } },
              ],
            }
          : {}),
      },
      include: {
        location:     { select: { name: true } },
        vehicleRates: { select: { vehicle_id: true, price_per_vehicle: true } },
      },
      orderBy: { name: "asc" },
      take: 60,
    });
    return {
      success: true,
      data: permits.map((p) => ({
        id:                p.id,
        name:              p.name,
        price_per_vehicle: Number(p.price_per_vehicle),
        price_per_person:  Number(p.price_per_person ?? 0),
        location_name:     p.location?.name ?? null,
        category:          p.category,
        custom_category:   p.custom_category,
        vehicle_rates:     p.vehicleRates.map((vr) => ({
          vehicle_id:        vr.vehicle_id,
          price_per_vehicle: Number(vr.price_per_vehicle),
        })),
      })),
    };
  } catch (e) {
    console.error("getPermitOptions:", e);
    return { success: false };
  }
}

// ── Vehicle-rate resolution ──────────────────────────────────────────────────

/** Resolves the live per-vehicle price for a permit+cab-type pair — the cab
 * type's CURRENT vehicle, matched against the catalog permit's rates. Used
 * both when creating/updating (for an immediate UI reflect) and could be
 * re-run any time the underlying cab type's vehicle changes, since nothing
 * about the resolution is cached. */
async function resolvePermitVehiclePrice(
  permitId: number | null,
  cabTypeId: number | null,
): Promise<{ resolved_price: number | null; resolved_vehicle_name: string | null }> {
  if (permitId == null || cabTypeId == null) return { resolved_price: null, resolved_vehicle_name: null };

  const cabType = await db.package_cab_types.findUnique({
    where:  { id: cabTypeId },
    select: { vehicle: { select: { id: true, name: true } } },
  });
  if (!cabType) return { resolved_price: null, resolved_vehicle_name: null };

  const rate = await db.permit_vehicle_rates.findUnique({
    where: { permit_id_vehicle_id: { permit_id: permitId, vehicle_id: cabType.vehicle.id } },
    select: { price_per_vehicle: true },
  });

  return {
    resolved_price:        rate ? Number(rate.price_per_vehicle) : null,
    resolved_vehicle_name: cabType.vehicle.name,
  };
}

// ── Create ─────────────────────────────────────────────────────────────────

export async function createPackagePermit(input: {
  package_id:   number;
  duration_id:  number;
  name:         string;
  price:        number;
  price_type?:  PermitPriceType;
  is_included?: boolean;
  permit_id?:   number | null;
  cab_type_id?: number | null;
}) {
  try {
    const name = input.name.trim();
    if (!name) return { success: false as const, error: "Permit name is required" };
    if (isNaN(input.price) || input.price < 0) {
      return { success: false as const, error: "Enter a valid non-negative price" };
    }

    const sort_order = await db.package_permits.count({
      where: { duration_id: input.duration_id },
    });

    const permit = await db.package_permits.create({
      data: {
        package_id:  input.package_id,
        duration_id: input.duration_id,
        name,
        price:       input.price,
        price_type:  input.price_type ?? "FLAT",
        is_included: input.is_included ?? true,
        sort_order,
        permit_id:   input.permit_id ?? null,
        cab_type_id: input.cab_type_id ?? null,
      },
    });

    const { resolved_price, resolved_vehicle_name } = await resolvePermitVehiclePrice(
      permit.permit_id, permit.cab_type_id,
    );

    revalidatePath(`/dashboard/packages/${input.package_id}`);
    return {
      success: true as const,
      data: {
        id:          permit.id,
        duration_id: permit.duration_id,
        name:        permit.name,
        price:       Number(permit.price),
        price_type:  (permit.price_type ?? "FLAT") as PermitPriceType,
        is_included: permit.is_included,
        sort_order:  permit.sort_order,
        permit_id:   permit.permit_id,
        cab_type_id: permit.cab_type_id,
        resolved_price,
        resolved_vehicle_name,
      } satisfies PackagePermit,
    };
  } catch (e) {
    console.error("createPackagePermit:", e);
    return { success: false as const, error: "Failed to add permit" };
  }
}

// ── Update ─────────────────────────────────────────────────────────────────

export async function updatePackagePermit(
  id: number,
  packageId: number,
  data: {
    name?: string; price?: number; price_type?: PermitPriceType; is_included?: boolean;
    permit_id?: number | null; cab_type_id?: number | null;
  },
) {
  try {
    if (data.name !== undefined && !data.name.trim()) {
      return { success: false as const, error: "Permit name is required" };
    }
    if (data.price !== undefined && (isNaN(data.price) || data.price < 0)) {
      return { success: false as const, error: "Enter a valid non-negative price" };
    }

    const updated = await db.package_permits.update({
      where: { id },
      data: {
        ...(data.name        !== undefined && { name:        data.name.trim() }),
        ...(data.price       !== undefined && { price:       data.price }),
        ...(data.price_type  !== undefined && { price_type:  data.price_type }),
        ...(data.is_included !== undefined && { is_included: data.is_included }),
        ...(data.permit_id   !== undefined && { permit_id:   data.permit_id }),
        ...(data.cab_type_id !== undefined && { cab_type_id: data.cab_type_id }),
      },
      select: { permit_id: true, cab_type_id: true },
    });

    const resolved = await resolvePermitVehiclePrice(updated.permit_id, updated.cab_type_id);

    revalidatePath(`/dashboard/packages/${packageId}`);
    return { success: true as const, data: resolved };
  } catch (e) {
    console.error("updatePackagePermit:", e);
    return { success: false as const, error: "Failed to update permit" };
  }
}

// ── Delete ─────────────────────────────────────────────────────────────────

export async function deletePackagePermit(id: number, packageId: number) {
  try {
    await db.package_permits.delete({ where: { id } });
    revalidatePath(`/dashboard/packages/${packageId}`);
    return { success: true as const };
  } catch (e) {
    console.error("deletePackagePermit:", e);
    return { success: false as const, error: "Failed to delete permit" };
  }
}
