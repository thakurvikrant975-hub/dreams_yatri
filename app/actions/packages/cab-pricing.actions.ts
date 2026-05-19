"use server";

import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";

// ── Types ──────────────────────────────────────────────────────────────────

export type CabPricingInput = {
  package_id: number;
  route_id: number;
  vehicle_id: number;
  sell_price: number;
  cost_price?: number | null;
  sort_order?: number;
  is_active?: boolean;
};

// ── Actions ────────────────────────────────────────────────────────────────

export async function upsertCabPricing(data: CabPricingInput) {
  try {
    await db.package_cab_pricings.upsert({
      where: { route_id_vehicle_id: { route_id: data.route_id, vehicle_id: data.vehicle_id } },
      create: {
        package_id: data.package_id,
        route_id: data.route_id,
        vehicle_id: data.vehicle_id,
        sell_price: data.sell_price,
        cost_price: data.cost_price ?? null,
        sort_order: data.sort_order ?? 0,
        is_active: data.is_active ?? true,
      },
      update: {
        sell_price: data.sell_price,
        cost_price: data.cost_price ?? null,
        sort_order: data.sort_order ?? 0,
        is_active: data.is_active ?? true,
      },
    });
    revalidatePath(`/dashboard/packages/${data.package_id}`);
    return { success: true as const };
  } catch (e) {
    console.error(e);
    return { success: false as const, error: "Failed to save cab pricing" };
  }
}

export async function deleteCabPricing(id: number, packageId: number) {
  try {
    await db.package_cab_pricings.delete({ where: { id } });
    revalidatePath(`/dashboard/packages/${packageId}`);
    return { success: true as const };
  } catch (e) {
    console.error(e);
    return { success: false as const, error: "Failed to delete cab pricing" };
  }
}

export async function toggleCabPricingActive(id: number, value: boolean, packageId: number) {
  try {
    await db.package_cab_pricings.update({ where: { id }, data: { is_active: value } });
    revalidatePath(`/dashboard/packages/${packageId}`);
    return { success: true as const };
  } catch (e) {
    console.error(e);
    return { success: false as const, error: "Failed to update status" };
  }
}
