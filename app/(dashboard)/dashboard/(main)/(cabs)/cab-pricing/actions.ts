"use server";

import { db }                  from "@/app/lib/db";
import { revalidatePath }      from "next/cache";
import { dashboardAuth }       from "@/app/lib/auth-dashboard";
import { classifyActionError } from "@/app/lib/action-error";

const PATH = "/dashboard/cab-pricing";

// ── Types ──────────────────────────────────────────────────────────────────

export type CabPricingType  = "PER_DAY" | "PER_KM";
export type CabScheduleType = "SEASONAL" | "WEEKEND";

export type CabSchedule = {
  id:            number;
  label:         string;
  schedule_type: CabScheduleType;
  pricing_type:  CabPricingType;
  price:         number;
  cost_price:    number | null;
  valid_from:    string | null;  // ISO date string (YYYY-MM-DD)
  valid_to:      string | null;
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
  schedules:    CabSchedule[];
};

export type CabPricingGroup = {
  destination_id:   number;
  destination_name: string;
  destination_slug: string;
  pricings:         VehiclePricingEntry[];
  active_count:     number;
  total_count:      number;
  schedule_count:   number;
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
            vehicle:   { select: { id: true, name: true, type: true } },
            schedules: { orderBy: { created_at: "asc" } },
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
      schedules:    cp.schedules.map((s) => ({
        id:            s.id,
        label:         s.label,
        schedule_type: s.schedule_type as CabScheduleType,
        pricing_type:  s.pricing_type as CabPricingType,
        price:         Number(s.price),
        cost_price:    s.cost_price != null ? Number(s.cost_price) : null,
        valid_from:    s.valid_from ? s.valid_from.toISOString().slice(0, 10) : null,
        valid_to:      s.valid_to   ? s.valid_to.toISOString().slice(0, 10)   : null,
        is_active:     s.is_active,
      })),
    }));

    // Most recently updated record drives the group's updated_at / updated_by
    const latest = dest.cabPricings.reduce(
      (max, cp) => (cp.updated_at > max.updated_at ? cp : max),
      dest.cabPricings[0],
    );

    return {
      destination_id:   dest.id,
      destination_name: dest.name,
      destination_slug: dest.slug,
      pricings,
      active_count:   pricings.filter((p) => p.is_active).length,
      total_count:    pricings.length,
      schedule_count: pricings.reduce((s, p) => s + p.schedules.length, 0),
      updated_at:     latest?.updated_at ?? new Date(0),
      updated_by:     latest?.updated_by ?? null,
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

// ── Search destinations ────────────────────────────────────────────────────

export async function searchDestinations(query: string) {
  const dests = await db.destinations.findMany({
    where: {
      is_active: true,
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

// ── Upsert vehicle prices + schedules for a destination ────────────────────

export type ScheduleInput = {
  label:        string;
  scheduleType: CabScheduleType;
  pricingType:  CabPricingType;
  price:        number;
  costPrice:    number | null;
  validFrom:    string | null;  // YYYY-MM-DD
  validTo:      string | null;
};

export type VehicleEntryInput = {
  vehicleId:   number;
  pricingType: CabPricingType;
  price:       number;
  costPrice:   number | null;
  schedules:   ScheduleInput[];
};

export async function upsertCabPricingForDestination(
  destinationId: number,
  entries: VehicleEntryInput[],
): Promise<CabPricingFormState> {
  const { authorized, actorName } = await requireSession();
  if (!authorized) return { success: false, message: "Unauthorized" };

  try {
    await db.$transaction(async (tx) => {
      for (const e of entries) {
        // 1. Upsert the base cab_pricing record
        const record = await tx.cab_pricing.upsert({
          where: {
            destination_id_vehicle_id: {
              destination_id: destinationId,
              vehicle_id:     e.vehicleId,
            },
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

        // 2. Replace schedules: delete old, create new
        await tx.cab_pricing_schedule.deleteMany({ where: { pricing_id: record.id } });

        if (e.schedules.length > 0) {
          await tx.cab_pricing_schedule.createMany({
            data: e.schedules.map((s) => ({
              pricing_id:    record.id,
              label:         s.label,
              schedule_type: s.scheduleType as never,
              pricing_type:  s.pricingType as never,
              price:         s.price,
              cost_price:    s.costPrice,
              valid_from:    s.validFrom ? new Date(s.validFrom) : null,
              valid_to:      s.validTo   ? new Date(s.validTo)   : null,
              is_active:     true,
            })),
          });
        }
      }
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
