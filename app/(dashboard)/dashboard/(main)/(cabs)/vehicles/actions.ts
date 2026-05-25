"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/app/lib/db";

const PATH = "/dashboard/vehicles";

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
  try {
    await db.vehicles.create({
      data: {
        name: data.name,
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
    return { success: true as const, message: "Vehicle created" };
  } catch {
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
        name: data.name,
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
    return { success: true as const, message: "Vehicle updated" };
  } catch {
    return { success: false as const, message: "Failed to update vehicle" };
  }
}

export async function toggleVehicleActive(id: number, value: boolean) {
  try {
    await db.vehicles.update({ where: { id }, data: { is_active: value } });
    revalidatePath(PATH);
    return { success: true as const };
  } catch {
    return { success: false as const, message: "Failed to update status" };
  }
}

export async function deleteVehicle(id: number) {
  try {
    const inUse = await db.itinerary_transfers.count({ where: { vehicle_id: id } });
    if (inUse > 0) {
      return { success: false as const, message: `Cannot delete — vehicle is used in ${inUse} transfer(s)` };
    }
    await db.vehicles.delete({ where: { id } });
    revalidatePath(PATH);
    return { success: true as const, message: "Vehicle deleted" };
  } catch {
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
