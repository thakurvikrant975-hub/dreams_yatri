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
  valid_from:    string;
  valid_to:      string;
  weekday_price: number;
  weekday_cost:  number | null;
  weekend_price: number | null;
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
  location_id:   string;        // locations.id as string (BigInt)
  location_name: string;
  location_slug: string;
  location_type: string;
  pricings:      VehiclePricingEntry[];
  active_count:  number;
  total_count:   number;
  season_count:  number;
  updated_at:    Date;
  updated_by:    string | null;
  created_by:    string | null;
};

export type CabPricingFormState = { success: boolean; message: string };

// ── Auth guard ─────────────────────────────────────────────────────────────

async function requireSession() {
  const session = await dashboardAuth();
  if (!session?.user?.email) return { authorized: false as const, actorName: null };
  return {
    authorized: true as const,
    actorName:  session.user.id,
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

  // Query all active location-based pricing records
  const allPricings = await db.cab_pricing.findMany({
    where: {
      location_id: { not: null },
      ...(search ? {
        location: { name: { contains: search, mode: "insensitive" as const } },
      } : {}),
    },
    include: {
      location: { select: { id: true, name: true, slug: true, type: true } },
      vehicle:  { select: { id: true, name: true, type: true } },
      seasons:  { orderBy: { valid_from: "asc" } },
    },
    orderBy: [{ location: { name: "asc" } }, { vehicle: { name: "asc" } }],
  });

  // Group by location_id
  const grouped = new Map<string, typeof allPricings>();
  for (const cp of allPricings) {
    if (!cp.location_id || !cp.location) continue;
    const key = cp.location_id.toString();
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(cp);
  }

  let rows: CabPricingGroup[] = [];
  for (const [locationId, pricings] of grouped) {
    const loc = pricings[0].location!;
    const entries: VehiclePricingEntry[] = pricings.map((cp) => ({
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

    const latest = pricings.reduce(
      (max, cp) => (cp.updated_at > max.updated_at ? cp : max),
      pricings[0],
    );
    const oldest = pricings.reduce(
      (min, cp) => (cp.created_at < min.created_at ? cp : min),
      pricings[0],
    );

    rows.push({
      location_id:   locationId,
      location_name: loc.name,
      location_slug: loc.slug,
      location_type: loc.type,
      pricings:      entries,
      active_count:  entries.filter((e) => e.is_active).length,
      total_count:   entries.length,
      season_count:  entries.reduce((s, e) => s + e.seasons.length, 0),
      updated_at:    latest.updated_at,
      updated_by:    latest.updated_by,
      created_by:    oldest.created_by,
    });
  }

  const allStats = await db.cab_pricing.aggregate({ _count: { id: true } });

  if (status === "active")   rows = rows.filter((r) => r.active_count  > 0);
  if (status === "inactive") rows = rows.filter((r) => r.active_count === 0);

  rows.sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());

  const totalPages = Math.max(1, Math.ceil(rows.length / limit));
  const paginated  = rows.slice((page - 1) * limit, page * limit);

  const actorIds = [...new Set(paginated.flatMap((r) => [r.created_by, r.updated_by]).filter(Boolean) as string[])];
  const members = actorIds.length > 0
    ? await db.teamMember.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })
    : [];
  const memberNames: Record<string, string> = Object.fromEntries(members.map((m) => [m.id, m.name]));

  return {
    rows:        paginated,
    memberNames,
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

// ── Search city locations (for the city picker) ────────────────────────────
// Returns CITY, STATE, COUNTRY locations only.
// Excludes locations already priced (have a cab_pricing record with location_id).

export async function searchCityLocations(query: string, excludeAlreadyPriced = false) {
  let excludeIds: bigint[] = [];

  if (excludeAlreadyPriced) {
    const priced = await db.cab_pricing.findMany({
      where:  { location_id: { not: null } },
      select: { location_id: true },
      distinct: ["location_id"],
    });
    excludeIds = priced.map((r) => r.location_id!).filter(Boolean);
  }

  const locs = await db.location.findMany({
    where: {
      is_active: true,
      type: { in: ["CITY", "STATE", "COUNTRY"] },
      ...(query ? { name: { contains: query, mode: "insensitive" as const } } : {}),
      ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
    },
    select:  { id: true, name: true, slug: true, type: true },
    orderBy: [{ is_featured: "desc" }, { is_popular: "desc" }, { name: "asc" }],
    take:    20,
  });

  return locs.map((l) => ({ id: l.id.toString(), label: l.name, description: `${l.type} · ${l.slug}` }));
}

// ── Get active vehicles ────────────────────────────────────────────────────

export async function getActiveVehicles() {
  return db.vehicles.findMany({
    where:   { is_active: true },
    select:  { id: true, name: true, type: true },
    orderBy: { type: "asc" },
  });
}

// ── Find or create a city/state/country Location record ───────────────────

async function _getOrCreateCityLocation(
  locationId: string,
  locationName: string,
  actorName: string,
): Promise<bigint> {
  try {
    const bigId = BigInt(locationId);
    const existing = await db.location.findUnique({
      where:  { id: bigId },
      select: { id: true },
    });
    if (existing) return existing.id;
  } catch { /* invalid BigInt — fall through to create */ }

  // Create a new CITY location if the ID couldn't be resolved
  const slug = locationName
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 100);

  let finalSlug = slug;
  let i = 2;
  while (await db.location.findUnique({ where: { slug: finalSlug }, select: { id: true } })) {
    finalSlug = `${slug}-${i++}`;
  }

  const created = await db.location.create({
    data: {
      name:         locationName,
      slug:         finalSlug,
      type:         "CITY",
      is_active:    true,
      is_searchable: true,
      metadata:     { source: "cab_pricing" },
    },
    select: { id: true },
  });

  await createLog({
    action:     "CREATE",
    entity:     "Location",
    entityId:   created.id.toString(),
    entitySlug: finalSlug,
    newData:    { name: locationName, type: "CITY", source: "cab_pricing" },
  });

  return created.id;
}

// ── Upsert vehicle prices + seasons for a location ────────────────────────

export type SeasonInput = {
  pricingType:   CabPricingType;
  validFrom:     string;
  validTo:       string;
  weekdayPrice:  number;
  weekdayCost:   number | null;
  weekendPrice:  number | null;
  weekendCost:   number | null;
};

export type VehicleEntryInput = {
  vehicleId:   number;
  pricingType: CabPricingType;
  price:       number;
  costPrice:   number | null;
  seasons:     SeasonInput[];
};

async function _performUpsert(
  locationId: bigint,
  entries: VehicleEntryInput[],
  actorName: string,
  locMeta: { name: string; slug: string },
): Promise<CabPricingFormState> {
  await db.$transaction(async (tx) => {
    for (const e of entries) {
      const existing = await tx.cab_pricing.findFirst({
        where:  { location_id: locationId, vehicle_id: e.vehicleId },
        select: { id: true },
      });

      let recordId: number;
      if (existing) {
        await tx.cab_pricing.update({
          where: { id: existing.id },
          data: {
            pricing_type: e.pricingType as never,
            price:        e.price,
            cost_price:   e.costPrice,
            updated_by:   actorName,
          },
        });
        recordId = existing.id;
      } else {
        const created = await tx.cab_pricing.create({
          data: {
            location_id:  locationId,
            vehicle_id:   e.vehicleId,
            pricing_type: e.pricingType as never,
            price:        e.price,
            cost_price:   e.costPrice,
            is_active:    true,
            created_by:   actorName,
            updated_by:   actorName,
          },
        });
        recordId = created.id;
      }

      await tx.cab_pricing_season.deleteMany({ where: { pricing_id: recordId } });

      if (e.seasons.length > 0) {
        await tx.cab_pricing_season.createMany({
          data: e.seasons.map((s) => ({
            pricing_id:    recordId,
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
    entityId:    locationId.toString(),
    entitySlug:  locMeta.slug,
    description: `Updated cab pricing for ${locMeta.name}`,
    newData: {
      vehicles: entries.length,
      seasons:  entries.reduce((s, e) => s + e.seasons.length, 0),
    },
  });

  revalidatePath(PATH);
  return { success: true, message: "Pricing saved successfully" };
}

export async function upsertCabPricingForCity(
  cityLocationId: string,
  cityName:       string,
  entries:        VehicleEntryInput[],
): Promise<CabPricingFormState> {
  const { authorized, actorName } = await requireSession();
  if (!authorized) return { success: false, message: "Unauthorized" };

  try {
    const locId = await _getOrCreateCityLocation(cityLocationId, cityName, actorName);
    const loc   = await db.location.findUnique({
      where:  { id: locId },
      select: { name: true, slug: true },
    });
    return await _performUpsert(locId, entries, actorName, loc ?? { name: cityName, slug: "" });
  } catch (e) {
    console.error("[upsertCabPricingForCity]", e);
    return { success: false, message: classifyActionError(e).message };
  }
}

// Used by the Edit sheet (location is already known)
export async function upsertCabPricingForLocation(
  locationId: string,
  entries:    VehicleEntryInput[],
): Promise<CabPricingFormState> {
  const { authorized, actorName } = await requireSession();
  if (!authorized) return { success: false, message: "Unauthorized" };

  try {
    const locId = BigInt(locationId);
    const loc   = await db.location.findUnique({
      where:  { id: locId },
      select: { name: true, slug: true },
    });
    if (!loc) return { success: false, message: "Location not found" };
    return await _performUpsert(locId, entries, actorName, loc);
  } catch (e) {
    console.error("[upsertCabPricingForLocation]", e);
    return { success: false, message: classifyActionError(e).message };
  }
}

// ── Toggle active ──────────────────────────────────────────────────────────

export async function toggleCabPricingActive(
  locationId: string,
  isActive:   boolean,
): Promise<CabPricingFormState> {
  const { authorized } = await requireSession();
  if (!authorized) return { success: false, message: "Unauthorized" };

  try {
    await db.cab_pricing.updateMany({
      where: { location_id: BigInt(locationId) },
      data:  { is_active: isActive },
    });
    await createLog({
      action:   "UPDATE",
      entity:   "CabPricing",
      entityId: locationId,
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

export async function deleteCabPricingForLocation(
  locationId: string,
): Promise<CabPricingFormState> {
  const { authorized } = await requireSession();
  if (!authorized) return { success: false, message: "Unauthorized" };

  try {
    const loc = await db.location.findUnique({
      where:  { id: BigInt(locationId) },
      select: { name: true, slug: true },
    });
    await db.cab_pricing.deleteMany({ where: { location_id: BigInt(locationId) } });
    await createLog({
      action:      "DELETE",
      entity:      "CabPricing",
      entityId:    locationId,
      entitySlug:  loc?.slug,
      description: `Deleted all cab pricing for ${loc?.name ?? locationId}`,
      severity:    "MEDIUM",
    });
    revalidatePath(PATH);
    return { success: true, message: "Pricing deleted successfully" };
  } catch (e) {
    return { success: false, message: classifyActionError(e).message };
  }
}
