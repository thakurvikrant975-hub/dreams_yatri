"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/app/lib/db";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { createLog } from "../../lib/logger";

const PATH = "/dashboard/vehicles";

/** Trims and capitalizes just the first letter — "innova crysta" ->
 * "Innova crysta". Leaves everything else in the string untouched, so an
 * intentional all-caps model name ("XYLO") or an already-capitalized one
 * isn't rewritten, only ever the lower-cased first letter typed by mistake. */
function capitalizeFirst(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed[0].toUpperCase() + trimmed.slice(1) : trimmed;
}

// ── Types ──────────────────────────────────────────────────────────────────

export type VehicleRate = {
  id: number;
  label: string;
  rate_type: string;
  price: number;
  cost_price: number | null;
  is_active: boolean;
};

export type VehicleFull = {
  id: number;
  name: string;
  type: string;
  passenger_capacity: number;
  luggage_bags: number;
  has_ac: boolean;
  image_key: string | null;
  fuel_type: string | null;
  description: string | null;
  is_active: boolean;
  rates: VehicleRate[];
};

// ── Vehicles ───────────────────────────────────────────────────────────────

export async function getVehiclesWithRates(): Promise<VehicleFull[]> {
  const list = await db.vehicles.findMany({
    orderBy: [{ type: "asc" }, { name: "asc" }],
    include: {
      rates: {
        where: { is_active: true },
        orderBy: { label: "asc" },
      },
    },
  });
  return list.map((v) => ({
    id: v.id,
    name: v.name,
    type: v.type,
    passenger_capacity: v.passenger_capacity,
    luggage_bags: v.luggage_bags,
    has_ac: v.has_ac,
    image_key: v.image_key,
    fuel_type: v.fuel_type,
    description: v.description,
    is_active: v.is_active,
    rates: v.rates.map((r) => ({
      id: r.id,
      label: r.label,
      rate_type: r.rate_type,
      price: Number(r.price),
      cost_price: r.cost_price != null ? Number(r.cost_price) : null,
      is_active: r.is_active,
    })),
  }));
}

export async function createVehicle(data: {
  name: string;
  type: string;
  passenger_capacity: number;
  luggage_bags?: number;
  has_ac?: boolean;
  image_key?: string | null;
  fuel_type?: string | null;
  description?: string | null;
}) {
  const session = await dashboardAuth();
  const actorName = session?.user?.id ?? null;

  try {
    const created = await db.vehicles.create({
      data: {
        name: capitalizeFirst(data.name),
        type: data.type as never,
        passenger_capacity: data.passenger_capacity,
        luggage_bags: data.luggage_bags ?? 0,
        has_ac: data.has_ac ?? false,
        image_key: data.image_key ?? null,
        fuel_type: (data.fuel_type as never) ?? null,
        description: data.description ?? null,
        created_by: actorName,
      },
    });
    revalidatePath(PATH);
    await createLog({
      action:     "CREATE",
      entity:     "Vehicle",
      entityId:   String(created.id),
      entitySlug: created.name,
      newData:    { name: created.name, type: created.type, created_by: actorName },
    });
    return { success: true as const, message: "Vehicle created", id: created.id };
  } catch (e) {
    console.error("[createVehicle]", e);
    return { success: false as const, message: "Failed to create vehicle" };
  }
}

export async function updateVehicle(
  id: number,
  data: {
    name: string;
    type: string;
    passenger_capacity: number;
    luggage_bags?: number;
    has_ac?: boolean;
    image_key?: string | null;
    fuel_type?: string | null;
    description?: string | null;
  },
) {
  try {
    await db.vehicles.update({
      where: { id },
      data: {
        name: capitalizeFirst(data.name),
        type: data.type as never,
        passenger_capacity: data.passenger_capacity,
        luggage_bags: data.luggage_bags ?? 0,
        has_ac: data.has_ac ?? false,
        image_key: data.image_key ?? null,
        fuel_type: (data.fuel_type as never) ?? null,
        description: data.description ?? null,
      },
    });
    revalidatePath(PATH);
    await createLog({
      action:     "UPDATE",
      entity:     "Vehicle",
      entityId:   String(id),
      entitySlug: capitalizeFirst(data.name),
    });
    return { success: true as const, message: "Vehicle updated" };
  } catch (e) {
    console.error("[updateVehicle]", e);
    return { success: false as const, message: "Failed to update vehicle" };
  }
}

export async function toggleVehicleActive(id: number, value: boolean) {
  try {
    const updated = await db.vehicles.update({ where: { id }, data: { is_active: value } });
    revalidatePath(PATH);
    await createLog({
      action:     "UPDATE",
      entity:     "Vehicle",
      entityId:   String(id),
      entitySlug: updated.name,
      newData:    { is_active: value },
      metadata:   { operation: "toggle_active" },
    });
    return { success: true as const };
  } catch (e) {
    console.error("[toggleVehicleActive]", e);
    return { success: false as const, message: "Failed to update status" };
  }
}

export async function deleteVehicle(id: number) {
  try {
    const inUse = await db.cab_pricing.count({ where: { vehicle_id: id } });
    if (inUse > 0) {
      return { success: false as const, message: `Cannot delete — vehicle is used in ${inUse} cab pricing record(s)` };
    }
    const deleted = await db.vehicles.delete({ where: { id } });
    revalidatePath(PATH);
    await createLog({
      action:     "DELETE",
      entity:     "Vehicle",
      entityId:   String(id),
      entitySlug: deleted.name,
    });
    return { success: true as const, message: "Vehicle deleted" };
  } catch (e) {
    console.error("[deleteVehicle]", e);
    return { success: false as const, message: "Failed to delete vehicle" };
  }
}

// ── Vehicle Rates ──────────────────────────────────────────────────────────

export async function createVehicleRate(
  vehicleId: number,
  data: {
    label: string;
    rate_type: string;
    price: number;
    cost_price?: number | null;
  },
) {
  try {
    const created = await db.vehicle_rates.create({
      data: {
        vehicle_id: vehicleId,
        label: data.label,
        rate_type: data.rate_type as never,
        price: data.price,
        cost_price: data.cost_price ?? null,
      },
    });
    revalidatePath(PATH);
    return {
      success: true as const,
      message: "Rate added",
      rate: {
        id: created.id,
        label: created.label,
        rate_type: created.rate_type,
        price: Number(created.price),
        cost_price: created.cost_price != null ? Number(created.cost_price) : null,
        is_active: created.is_active,
      } satisfies VehicleRate,
    };
  } catch {
    return { success: false as const, message: "Failed to add rate" };
  }
}

export async function updateVehicleRate(
  id: number,
  data: {
    label: string;
    rate_type: string;
    price: number;
    cost_price?: number | null;
    is_active?: boolean;
  },
) {
  try {
    await db.vehicle_rates.update({
      where: { id },
      data: {
        label: data.label,
        rate_type: data.rate_type as never,
        price: data.price,
        cost_price: data.cost_price ?? null,
        ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
      },
    });
    revalidatePath(PATH);
    return { success: true as const, message: "Rate updated" };
  } catch {
    return { success: false as const, message: "Failed to update rate" };
  }
}

export async function deleteVehicleRate(id: number) {
  try {
    await db.vehicle_rates.delete({ where: { id } });
    revalidatePath(PATH);
    return { success: true as const, message: "Rate deleted" };
  } catch {
    return { success: false as const, message: "Failed to delete rate" };
  }
}
