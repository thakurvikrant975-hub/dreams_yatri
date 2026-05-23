"use server";

import { db }                  from "@/app/lib/db";
import { revalidatePath }      from "next/cache";
import { dashboardAuth }       from "@/app/lib/auth-dashboard";
import { classifyActionError } from "@/app/lib/action-error";
import { createLog }           from "../../lib/logger";

const PATH = "/dashboard/cab-pricing";

// ── Types ──────────────────────────────────────────────────────────────────

export type CabPricingType = "PER_DAY" | "PER_KM";

export type CabSeason = {
  id:            number;
  pricing_type:  CabPricingType;
  valid_from:    string;        // YYYY-MM-DD
  valid_to:      string;
  weekday_price: number;
  weekday_cost:  number | null;
  weekend_price: number | null; // null = no weekend override
  weekend_cost:  number | null;
  is_active:     boolean;
};

export type VehiclePricingEntry = {
  vehicle_id:   number;
  vehicle_name: string;
  vehicle_type: string;
  pricing_type: CabPricingType;
  price:        number;
  cost_price:   number | null;
  is_active:    boolean;
  updated_by:   string | null;
  seasons:      CabSeason[];
};

export type CabPricingGroup = {
  destination_id:   number;
  destination_name: string;
  destination_slug: string;
  pricings:         VehiclePricingEntry[];
  active_count:     number;
  total_count:      number;
  season_count:     number;
  updated_at:       Date;
  updated_by:       string | null;
};

export type CabPricingFormState = { success: boolean; message: string };

// ── Auth guard ─────────────────────────────────────────────────────────────

async function requireSession() {
  const session = await dashboardAuth();
  if (!session?.user?.email) return { authorized: false as const, actorName: null };
  return {
    authorized: true as const,
    actorName:  session.user.name ?? session.user.email,
  };
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

  const [destinations, allStats] = await Promise.all([
    db.destinations.findMany({
      where,
      include: {
        cabPricings: {
          include: {
            vehicle:  { select: { id: true, name: true, type: true } },
            seasons:  { orderBy: { valid_from: "asc" } },
          },
          orderBy: { vehicle: { name: "asc" } },
        },
      },
      orderBy: { name: "asc" },
    }),
    db.cab_pricing.aggregate({ _count: { id: true } }),
  ]);

  let rows: CabPricingGroup[] = destinations.map((dest) => {
    const pricings: VehiclePricingEntry[] = dest.cabPricings.map((cp) => ({
      vehicle_id:   cp.vehicle_id,
      vehicle_name: cp.vehicle.name,
      vehicle_type: cp.vehicle.type,
      pricing_type: cp.pricing_type as CabPricingType,
      price:        Number(cp.price),
      cost_price:   cp.cost_price != null ? Number(cp.cost_price) : null,
      is_active:    cp.is_active,
      updated_by:   cp.updated_by,
      seasons:      cp.seasons.map((s) => ({
        id:            s.id,
        pricing_type:  s.pricing_type as CabPricingType,
        valid_from:    s.valid_from.toISOString().slice(0, 10),
        valid_to:      s.valid_to.toISOString().slice(0, 10),
        weekday_price: Number(s.weekday_price),
        weekday_cost:  s.weekday_cost  != null ? Number(s.weekday_cost)  : null,
        weekend_price: s.weekend_price != null ? Number(s.weekend_price) : null,
        weekend_cost:  s.weekend_cost  != null ? Number(s.weekend_cost)  : null,
        is_active:     s.is_active,
      })),
    }));

    const latest = dest.cabPricings.reduce(
      (max, cp) => (cp.updated_at > max.updated_at ? cp : max),
      dest.cabPricings[0],
    );

    return {
      destination_id:   dest.id,
      destination_name: dest.name,
      destination_slug: dest.slug,
      pricings,
      active_count:  pricings.filter((p) => p.is_active).length,
      total_count:   pricings.length,
      season_count:  pricings.reduce((s, p) => s + p.seasons.length, 0),
      updated_at:    latest?.updated_at ?? new Date(0),
      updated_by:    latest?.updated_by ?? null,
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
      active_entries:     rows.reduce((s, r) => s + r.active_count, 0),
    },
  };
}

// ── Search destinations (excludes already-priced when requested) ───────────

export async function searchDestinations(query: string, excludeAlreadyPriced = false) {
  const dests = await db.destinations.findMany({
    where: {
      is_active: true,
      ...(excludeAlreadyPriced ? { cabPricings: { none: {} } } : {}),
      ...(query ? { name: { contains: query, mode: "insensitive" as const } } : {}),
    },
    select:  { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
    take:    20,
  });
  return dests.map((d) => ({ id: d.id, label: d.name, description: d.slug }));
}

// ── Get active vehicles ────────────────────────────────────────────────────

export async function getActiveVehicles() {
  return db.vehicles.findMany({
    where:   { is_active: true },
    select:  { id: true, name: true, type: true },
    orderBy: { type: "asc" },
  });
}

// ── Upsert vehicle prices + seasons ───────────────────────────────────────

export type SeasonInput = {
  pricingType:   CabPricingType;
  validFrom:     string;        // YYYY-MM-DD
  validTo:       string;
  weekdayPrice:  number;
  weekdayCost:   number | null;
  weekendPrice:  number | null; // null = no override
  weekendCost:   number | null;
};

export type VehicleEntryInput = {
  vehicleId:   number;
  pricingType: CabPricingType;
  price:       number;
  costPrice:   number | null;
  seasons:     SeasonInput[];
};

export async function upsertCabPricingForDestination(
  destinationId: number,
  entries: VehicleEntryInput[],
): Promise<CabPricingFormState> {
  const { authorized, actorName } = await requireSession();
  if (!authorized) return { success: false, message: "Unauthorized" };

  try {
    const dest = await db.destinations.findUnique({
      where:  { id: destinationId },
      select: { name: true, slug: true },
    });

    await db.$transaction(async (tx) => {
      for (const e of entries) {
        const record = await tx.cab_pricing.upsert({
          where: {
            destination_id_vehicle_id: { destination_id: destinationId, vehicle_id: e.vehicleId },
          },
          create: {
            destination_id: destinationId,
            vehicle_id:     e.vehicleId,
            pricing_type:   e.pricingType as never,
            price:          e.price,
            cost_price:     e.costPrice,
            is_active:      true,
            updated_by:     actorName,
          },
          update: {
            pricing_type: e.pricingType as never,
            price:        e.price,
            cost_price:   e.costPrice,
            updated_by:   actorName,
          },
        });

        // Replace all seasons for this vehicle/destination
        await tx.cab_pricing_season.deleteMany({ where: { pricing_id: record.id } });

        if (e.seasons.length > 0) {
          await tx.cab_pricing_season.createMany({
            data: e.seasons.map((s) => ({
              pricing_id:    record.id,
              pricing_type:  s.pricingType as never,
              valid_from:    new Date(s.validFrom),
              valid_to:      new Date(s.validTo),
              weekday_price: s.weekdayPrice,
              weekday_cost:  s.weekdayCost,
              weekend_price: s.weekendPrice,
              weekend_cost:  s.weekendCost,
              is_active:     true,
            })),
          });
        }
      }
    });

    await createLog({
      action:      "UPDATE",
      entity:      "CabPricing",
      entityId:    String(destinationId),
      entitySlug:  dest?.slug,
      description: `Updated cab pricing for ${dest?.name ?? destinationId}`,
      newData: {
        vehicles: entries.length,
        seasons:  entries.reduce((s, e) => s + e.seasons.length, 0),
      },
    });

    revalidatePath(PATH);
    return { success: true, message: "Pricing saved successfully" };
  } catch (e) {
    console.error("[upsertCabPricing]", e);
    return { success: false, message: classifyActionError(e).message };
  }
}

// ── Toggle active ──────────────────────────────────────────────────────────

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
    await createLog({
      action:   "UPDATE",
      entity:   "CabPricing",
      entityId: String(destinationId),
      metadata: { operation: "toggle_active", isActive },
      newData:  { isActive },
    });
    revalidatePath(PATH);
    return { success: true, message: `Pricing ${isActive ? "activated" : "deactivated"}` };
  } catch (e) {
    return { success: false, message: classifyActionError(e).message };
  }
}

// ── Delete ─────────────────────────────────────────────────────────────────

export async function deleteCabPricingForDestination(
  destinationId: number,
): Promise<CabPricingFormState> {
  const { authorized } = await requireSession();
  if (!authorized) return { success: false, message: "Unauthorized" };

  try {
    const dest = await db.destinations.findUnique({
      where:  { id: destinationId },
      select: { name: true, slug: true },
    });
    await db.cab_pricing.deleteMany({ where: { destination_id: destinationId } });
    await createLog({
      action:      "DELETE",
      entity:      "CabPricing",
      entityId:    String(destinationId),
      entitySlug:  dest?.slug,
      description: `Deleted all cab pricing for ${dest?.name ?? destinationId}`,
      severity:    "MEDIUM",
    });
    revalidatePath(PATH);
    return { success: true, message: "Pricing deleted successfully" };
  } catch (e) {
    return { success: false, message: classifyActionError(e).message };
  }
}
