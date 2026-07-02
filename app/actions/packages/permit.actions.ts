"use server";

import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";

// ── Types ──────────────────────────────────────────────────────────────────

export type PermitOption = {
  id:              number;
  name:            string;
  price:           number;
  location_name:   string | null;
  category:        string;
  custom_category: string | null;
};

export type PackagePermit = {
  id: number;
  duration_id: number;
  name: string;
  price: number;
  is_included: boolean;
  sort_order: number;
};

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
      include: { location: { select: { name: true } } },
      orderBy: { name: "asc" },
      take: 60,
    });
    return {
      success: true,
      data: permits.map((p) => ({
        id:              p.id,
        name:            p.name,
        price:           Number(p.price_per_vehicle),
        location_name:   p.location?.name ?? null,
        category:        p.category,
        custom_category: p.custom_category,
      })),
    };
  } catch (e) {
    console.error("getPermitOptions:", e);
    return { success: false };
  }
}

// ── Create ─────────────────────────────────────────────────────────────────

export async function createPackagePermit(input: {
  package_id: number;
  duration_id: number;
  name: string;
  price: number;
  is_included?: boolean;
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
        package_id: input.package_id,
        duration_id: input.duration_id,
        name,
        price: input.price,
        is_included: input.is_included ?? true,
        sort_order,
      },
    });

    revalidatePath(`/dashboard/packages/${input.package_id}`);
    return {
      success: true as const,
      data: {
        id: permit.id,
        duration_id: permit.duration_id,
        name: permit.name,
        price: Number(permit.price),
        is_included: permit.is_included,
        sort_order: permit.sort_order,
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
  data: { name?: string; price?: number; is_included?: boolean },
) {
  try {
    if (data.name !== undefined && !data.name.trim()) {
      return { success: false as const, error: "Permit name is required" };
    }
    if (data.price !== undefined && (isNaN(data.price) || data.price < 0)) {
      return { success: false as const, error: "Enter a valid non-negative price" };
    }

    await db.package_permits.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.price !== undefined && { price: data.price }),
        ...(data.is_included !== undefined && { is_included: data.is_included }),
      },
    });

    revalidatePath(`/dashboard/packages/${packageId}`);
    return { success: true as const };
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
