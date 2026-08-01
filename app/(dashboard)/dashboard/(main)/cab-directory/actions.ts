"use server";

// (main)/cab-directory/actions.ts
//
// Sales-facing, price-free view of which cabs are available in which city.
// Deliberately a separate query from (cabs)/cab-pricing/actions.ts's
// getCabPricings() rather than reusing it — that function's return type
// carries price/cost_price/seasons on every row, and since this page's
// table is a client component, whatever this returns gets serialized into
// the page's RSC payload and is inspectable in the browser regardless of
// what the UI chooses to render. Selecting only non-price columns here
// keeps prices off the wire entirely, not just off the screen.

import { db } from "@/app/lib/db";

export type CabDirectoryVehicle = {
  vehicle_id: number;
  vehicle_name: string;
  vehicle_type: string;
  passenger_capacity: number;
  luggage_bags: number;
  has_ac: boolean;
  fuel_type: string | null;
  is_active: boolean;
};

export type CabDirectoryGroup = {
  location_id: string;
  location_name: string;
  location_slug: string;
  location_type: string;
  vehicles: CabDirectoryVehicle[];
  active_count: number;
  total_count: number;
};

export type GetCabDirectoryParams = {
  page?: number;
  limit?: number;
  search?: string;
  status?: "active" | "inactive" | "all";
};

export async function getCabDirectory(params: GetCabDirectoryParams = {}) {
  const { page = 1, limit = 20, search = "", status = "all" } = params;

  const allPricings = await db.cab_pricing.findMany({
    where: {
      location_id: { not: null },
      ...(search ? {
        location: { name: { contains: search, mode: "insensitive" as const } },
      } : {}),
    },
    select: {
      location_id: true,
      is_active: true,
      location: { select: { id: true, name: true, slug: true, type: true } },
      vehicle: {
        select: {
          id: true, name: true, type: true,
          passenger_capacity: true, luggage_bags: true,
          has_ac: true, fuel_type: true,
        },
      },
    },
    orderBy: [{ location: { name: "asc" } }, { vehicle: { name: "asc" } }],
  });

  const grouped = new Map<string, typeof allPricings>();
  for (const cp of allPricings) {
    if (!cp.location_id || !cp.location) continue;
    const key = cp.location_id.toString();
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(cp);
  }

  let rows: CabDirectoryGroup[] = [];
  for (const [locationId, entries] of grouped) {
    const loc = entries[0].location!;
    const vehicles: CabDirectoryVehicle[] = entries.map((cp) => ({
      vehicle_id: cp.vehicle.id,
      vehicle_name: cp.vehicle.name,
      vehicle_type: cp.vehicle.type,
      passenger_capacity: cp.vehicle.passenger_capacity,
      luggage_bags: cp.vehicle.luggage_bags,
      has_ac: cp.vehicle.has_ac,
      fuel_type: cp.vehicle.fuel_type,
      is_active: cp.is_active,
    }));

    rows.push({
      location_id: locationId,
      location_name: loc.name,
      location_slug: loc.slug,
      location_type: loc.type,
      vehicles,
      active_count: vehicles.filter((v) => v.is_active).length,
      total_count: vehicles.length,
    });
  }

  if (status === "active") rows = rows.filter((r) => r.active_count > 0);
  if (status === "inactive") rows = rows.filter((r) => r.active_count === 0);

  rows.sort((a, b) => a.location_name.localeCompare(b.location_name));

  const totalCount = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const paginated = rows.slice((page - 1) * limit, page * limit);

  const totalVehicleTypes = await db.vehicles.count({ where: { is_active: true } });

  return {
    rows: paginated,
    totalPages,
    currentPage: page,
    limit,
    totalCount,
    stats: {
      total_cities: totalCount,
      total_active_listings: rows.reduce((s, r) => s + r.active_count, 0),
      total_vehicle_types: totalVehicleTypes,
    },
  };
}
