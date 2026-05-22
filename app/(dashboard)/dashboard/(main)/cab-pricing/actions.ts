"use server";

import { db }              from "@/app/lib/db";
import { revalidatePath }  from "next/cache";
import { dashboardAuth }   from "@/app/lib/auth-dashboard";
import { classifyActionError } from "@/app/lib/action-error";

const PATH = "/dashboard/cab-pricing";

// ── Types ──────────────────────────────────────────────────────────────────

export type VehiclePricingEntry = {
  vehicle_id:    number;
  vehicle_name:  string;
  vehicle_type:  string;
  per_day_price: number;
  cost_price:    number | null;
  is_active:     boolean;
};

export type CabPricingGroup = {
  destination_id:   number;
  destination_name: string;
  destination_slug: string;
  pricings:         VehiclePricingEntry[];
  active_count:     number;
  total_count:      number;
  updated_at:       Date;
};

export type CabPricingFormState = {
  success: boolean;
  message: string;
};

// ── Auth guard ─────────────────────────────────────────────────────────────

async function requireSession() {
  const session = await dashboardAuth();
  if (!session?.user?.email) return { authorized: false as const };
  return { authorized: true as const, actorName: session.user.name ?? session.user.email };
}

// ── Read ───────────────────────────────────────────────────────────────────

export type GetCabPricingsParams = {
  page?:   number;
  limit?:  number;
  search?: string;
  status?: "active" | "inactive" | "all";
};

export async function getCabPricings(params: GetCabPricingsParams = {}) {
  const { page = 1, limit = 10, search = "", status = "all" } = params;

  const where = {
    cabPricings: { some: {} },
    ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
  };

  const [destinations, totalCount, allStats] = await Promise.all([
    db.destinations.findMany({
      where,
      include: {
        cabPricings: {
          include: { vehicle: { select: { id: true, name: true, type: true } } },
          orderBy:  { vehicle: { name: "asc" } },
        },
      },
      orderBy: { name: "asc" },
    }),
    db.destinations.count({ where }),
    db.cab_pricing.aggregate({ _count: { id: true } }),
  ]);

  // Apply status filter in-memory (filter on whether any pricing record matches)
  let rows: CabPricingGroup[] = destinations.map((dest) => {
    const pricings: VehiclePricingEntry[] = dest.cabPricings.map((cp) => ({
      vehicle_id:    cp.vehicle_id,
      vehicle_name:  cp.vehicle.name,
      vehicle_type:  cp.vehicle.type,
      per_day_price: Number(cp.per_day_price),
      cost_price:    cp.cost_price != null ? Number(cp.cost_price) : null,
      is_active:     cp.is_active,
    }));

    const updated = dest.cabPricings.reduce<Date>((max, cp) => {
      return cp.updated_at > max ? cp.updated_at : max;
    }, dest.cabPricings[0]?.updated_at ?? new Date(0));

    return {
      destination_id:   dest.id,
      destination_name: dest.name,
      destination_slug: dest.slug,
      pricings,
      active_count:  pricings.filter((p) => p.is_active).length,
      total_count:   pricings.length,
      updated_at:    updated,
    };
  });

  if (status === "active")   rows = rows.filter((r) => r.active_count  > 0);
  if (status === "inactive") rows = rows.filter((r) => r.active_count === 0);

  const totalPages = Math.ceil(rows.length / limit);
  const paginated  = rows.slice((page - 1) * limit, page * limit);

  return {
    rows:        paginated,
    totalPages,
    currentPage: page,
    limit,
    totalCount:  rows.length,
    stats: {
      total_destinations: rows.length,
      total_entries:      allStats._count.id,
      active_entries:     rows.reduce((s, r) => s + r.active_count,  0),
    },
  };
}

// ── Search destinations for the sheet select ───────────────────────────────

export async function searchDestinations(query: string) {
  const dests = await db.destinations.findMany({
    where: {
      is_active: true,
      ...(query ? { name: { contains: query, mode: "insensitive" as const } } : {}),
    },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
    take: 20,
  });
  return dests.map((d) => ({ id: d.id, label: d.name, description: d.slug }));
}

// ── Get active vehicles for the pricing form ───────────────────────────────

export async function getActiveVehicles() {
  const vehicles = await db.vehicles.findMany({
    where:   { is_active: true },
    select:  { id: true, name: true, type: true },
    orderBy: { type: "asc" },
  });
  return vehicles;
}

// ── Get existing pricings for a destination (for pre-filling edit form) ────

export async function getCabPricingsByDestination(destinationId: number) {
  const pricings = await db.cab_pricing.findMany({
    where:   { destination_id: destinationId },
    include: { vehicle: { select: { id: true, name: true, type: true } } },
  });
  return pricings.map((cp) => ({
    vehicle_id:    cp.vehicle_id,
    vehicle_name:  cp.vehicle.name,
    vehicle_type:  cp.vehicle.type,
    per_day_price: Number(cp.per_day_price),
    cost_price:    cp.cost_price != null ? Number(cp.cost_price) : null,
    is_active:     cp.is_active,
  }));
}

// ── Upsert all vehicle prices for a destination ────────────────────────────

export async function upsertCabPricingForDestination(
  destinationId: number,
  entries: { vehicleId: number; perDayPrice: number; costPrice: number | null }[],
): Promise<CabPricingFormState> {
  const { authorized } = await requireSession();
  if (!authorized) return { success: false, message: "Unauthorized" };

  try {
    await db.$transaction(
      entries.map((e) =>
        db.cab_pricing.upsert({
          where: {
            destination_id_vehicle_id: {
              destination_id: destinationId,
              vehicle_id:     e.vehicleId,
            },
          },
          create: {
            destination_id: destinationId,
            vehicle_id:     e.vehicleId,
            per_day_price:  e.perDayPrice,
            cost_price:     e.costPrice,
            is_active:      true,
          },
          update: {
            per_day_price: e.perDayPrice,
            cost_price:    e.costPrice,
          },
        }),
      ),
    );

    revalidatePath(PATH);
    return { success: true, message: "Pricing saved successfully" };
  } catch (e) {
    console.error("[upsertCabPricing]", e);
    return { success: false, message: classifyActionError(e).message };
  }
}

// ── Toggle active for all pricings of a destination ────────────────────────

export async function toggleCabPricingActive(
  destinationId: number,
  isActive: boolean,
): Promise<CabPricingFormState> {
  const { authorized } = await requireSession();
  if (!authorized) return { success: false, message: "Unauthorized" };

  try {
    await db.cab_pricing.updateMany({
      where: { destination_id: destinationId },
      data:  { is_active: isActive },
    });
    revalidatePath(PATH);
    return { success: true, message: `Pricing ${isActive ? "activated" : "deactivated"}` };
  } catch (e) {
    return { success: false, message: classifyActionError(e).message };
  }
}

// ── Delete all pricings for a destination ─────────────────────────────────

export async function deleteCabPricingForDestination(
  destinationId: number,
): Promise<CabPricingFormState> {
  const { authorized } = await requireSession();
  if (!authorized) return { success: false, message: "Unauthorized" };

  try {
    await db.cab_pricing.deleteMany({ where: { destination_id: destinationId } });
    revalidatePath(PATH);
    return { success: true, message: "Pricing deleted successfully" };
  } catch (e) {
    return { success: false, message: classifyActionError(e).message };
  }
}
