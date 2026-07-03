"use server";

import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { createLog } from "../../lib/logger";

const PATH = "/dashboard/cab-drivers";

// ── Types ──────────────────────────────────────────────────────────────────

export type CabDriverVehicle = {
  id: number;
  name: string;
  type: string;
  image_key: string | null;
};

export type CabDriverFull = {
  id: number;
  name: string;
  mobile: string;
  mobile_secondary: string | null;
  profile_image_key: string | null;
  city: string | null;
  state: string | null;
  vehicle_id: number | null;
  vehicle: CabDriverVehicle | null;
  license_number: string | null;
  license_expiry: string | null;
  license_image_key: string | null;
  vehicle_reg_number: string | null;
  vehicle_reg_expiry: string | null;
  insurance_expiry: string | null;
  vehicle_image_keys: string[];
  bank_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_account_holder: string | null;
  upi_id: string | null;
  salary_type: string | null;
  salary_amount: number | null;
  is_verified: boolean;
  avg_rating: number | null;
  rating_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type CabDriverInput = {
  name: string;
  mobile: string;
  mobile_secondary?: string | null;
  profile_image_key?: string | null;
  city?: string | null;
  state?: string | null;
  vehicle_id?: number | null;
  license_number?: string | null;
  license_expiry?: string | null;
  license_image_key?: string | null;
  vehicle_reg_number?: string | null;
  vehicle_reg_expiry?: string | null;
  insurance_expiry?: string | null;
  vehicle_image_keys?: string[];
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_ifsc?: string | null;
  bank_account_holder?: string | null;
  upi_id?: string | null;
  salary_type?: string | null;
  salary_amount?: number | null;
  is_active?: boolean;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function serializeDriver(d: {
  id: number; name: string; mobile: string; mobile_secondary: string | null;
  profile_image_key: string | null; city: string | null; state: string | null;
  vehicle_id: number | null; vehicle: { id: number; name: string; type: string; image_key: string | null } | null;
  license_number: string | null; license_expiry: Date | null; license_image_key: string | null;
  vehicle_reg_number: string | null; vehicle_reg_expiry: Date | null; insurance_expiry: Date | null;
  vehicle_image_keys: string[]; bank_name: string | null; bank_account_number: string | null;
  bank_ifsc: string | null; bank_account_holder: string | null; upi_id: string | null;
  salary_type: string | null; salary_amount: { toNumber(): number } | null;
  is_verified: boolean; avg_rating: { toNumber(): number } | null; rating_count: number;
  is_active: boolean; created_at: Date; updated_at: Date;
  created_by: string | null; updated_by: string | null;
}): CabDriverFull {
  return {
    id: d.id, name: d.name, mobile: d.mobile, mobile_secondary: d.mobile_secondary,
    profile_image_key: d.profile_image_key, city: d.city, state: d.state,
    vehicle_id: d.vehicle_id, vehicle: d.vehicle,
    license_number: d.license_number,
    license_expiry: d.license_expiry?.toISOString() ?? null,
    license_image_key: d.license_image_key,
    vehicle_reg_number: d.vehicle_reg_number,
    vehicle_reg_expiry: d.vehicle_reg_expiry?.toISOString() ?? null,
    insurance_expiry: d.insurance_expiry?.toISOString() ?? null,
    vehicle_image_keys: d.vehicle_image_keys,
    bank_name: d.bank_name, bank_account_number: d.bank_account_number,
    bank_ifsc: d.bank_ifsc, bank_account_holder: d.bank_account_holder,
    upi_id: d.upi_id,
    salary_type: d.salary_type,
    salary_amount: d.salary_amount != null ? d.salary_amount.toNumber() : null,
    is_verified: d.is_verified,
    avg_rating: d.avg_rating != null ? d.avg_rating.toNumber() : null,
    rating_count: d.rating_count,
    is_active: d.is_active,
    created_at: d.created_at.toISOString(),
    updated_at: d.updated_at.toISOString(),
    created_by: d.created_by,
    updated_by: d.updated_by,
  };
}

function toDate(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// ── Read ───────────────────────────────────────────────────────────────────

export async function getCabDrivers(params: {
  page?: number; limit?: number; search?: string;
  status?: "active" | "inactive" | "all";
  verified?: "verified" | "unverified" | "all";
} = {}) {
  const { page = 1, limit = 20, search = "", status = "all", verified = "all" } = params;

  const where = {
    ...(search ? {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { mobile: { contains: search } },
        { city: { contains: search, mode: "insensitive" as const } },
      ],
    } : {}),
    ...(status === "active"   ? { is_active:   true  } : status === "inactive"  ? { is_active:   false } : {}),
    ...(verified === "verified" ? { is_verified: true  } : verified === "unverified" ? { is_verified: false } : {}),
  };

  const [drivers, total] = await Promise.all([
    db.cab_drivers.findMany({
      where,
      include: { vehicle: { select: { id: true, name: true, type: true, image_key: true } } },
      orderBy: { updated_at: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.cab_drivers.count({ where }),
  ]);

  const rows = drivers.map(serializeDriver);
  const actorIds = [...new Set(rows.flatMap((d) => [d.created_by, d.updated_by]).filter(Boolean) as string[])];
  const members = actorIds.length > 0
    ? await db.teamMember.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })
    : [];
  const memberNames: Record<string, string> = Object.fromEntries(members.map((m) => [m.id, m.name]));

  return {
    rows,
    memberNames,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    limit,
  };
}

// ── History ────────────────────────────────────────────────────────────────

export async function getCabDriverHistory(id: number) {
  return db.activityLog.findMany({
    where:   { entity: "CabDriver", entityId: String(id) },
    orderBy: { actionAt: "desc" },
    select: {
      id:           true,
      action:       true,
      description:  true,
      userName:     true,
      userEmail:    true,
      previousData: true,
      newData:      true,
      metadata:     true,
      status:       true,
      actionAt:     true,
    },
    take: 50,
  });
}

export async function getActiveVehiclesForDriver() {
  return db.vehicles.findMany({
    where: { is_active: true },
    select: { id: true, name: true, type: true, image_key: true },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
}

// ── Create ─────────────────────────────────────────────────────────────────

export async function createCabDriver(data: CabDriverInput) {
  const session = await dashboardAuth();
  if (!session?.user) return { success: false as const, message: "Unauthorized" };
  const actorId = session.user.id ?? null;

  try {
    const created = await db.cab_drivers.create({
      data: {
        name: data.name,
        mobile: data.mobile,
        mobile_secondary: data.mobile_secondary ?? null,
        profile_image_key: data.profile_image_key ?? null,
        city: data.city ?? null,
        state: data.state ?? null,
        ...(data.vehicle_id
          ? { vehicle: { connect: { id: data.vehicle_id } } }
          : {}),
        license_number: data.license_number ?? null,
        license_expiry: toDate(data.license_expiry),
        license_image_key: data.license_image_key ?? null,
        vehicle_reg_number: data.vehicle_reg_number ?? null,
        vehicle_reg_expiry: toDate(data.vehicle_reg_expiry),
        insurance_expiry: toDate(data.insurance_expiry),
        vehicle_image_keys: data.vehicle_image_keys ?? [],
        bank_name: data.bank_name ?? null,
        bank_account_number: data.bank_account_number ?? null,
        bank_ifsc: data.bank_ifsc ?? null,
        bank_account_holder: data.bank_account_holder ?? null,
        upi_id: data.upi_id ?? null,
        salary_type: (data.salary_type as never) ?? null,
        salary_amount: data.salary_amount ?? null,
        is_active: data.is_active ?? true,
        created_by: actorId,
        updated_by: actorId,
      },
      include: { vehicle: { select: { id: true, name: true, type: true, image_key: true } } },
    });
    revalidatePath(PATH);
    await createLog({
      action:     "CREATE",
      entity:     "CabDriver",
      entityId:   String(created.id),
      entitySlug: created.name,
      newData:    { name: created.name, mobile: created.mobile },
    });
    return { success: true as const, message: "Driver added", driver: serializeDriver(created) };
  } catch (e) {
    console.error("[createCabDriver]", e);
    return { success: false as const, message: "Failed to add driver" };
  }
}

// ── Update ─────────────────────────────────────────────────────────────────

export async function updateCabDriver(id: number, data: CabDriverInput) {
  const session = await dashboardAuth();
  if (!session?.user) return { success: false as const, message: "Unauthorized" };
  const actorId = session.user.id ?? null;

  try {
    const updated = await db.cab_drivers.update({
      where: { id },
      data: {
        name: data.name,
        mobile: data.mobile,
        mobile_secondary: data.mobile_secondary ?? null,
        profile_image_key: data.profile_image_key ?? null,
        city: data.city ?? null,
        state: data.state ?? null,
        vehicle: data.vehicle_id
          ? { connect: { id: data.vehicle_id } }
          : { disconnect: true },
        license_number: data.license_number ?? null,
        license_expiry: toDate(data.license_expiry),
        license_image_key: data.license_image_key ?? null,
        vehicle_reg_number: data.vehicle_reg_number ?? null,
        vehicle_reg_expiry: toDate(data.vehicle_reg_expiry),
        insurance_expiry: toDate(data.insurance_expiry),
        vehicle_image_keys: data.vehicle_image_keys ?? [],
        bank_name: data.bank_name ?? null,
        bank_account_number: data.bank_account_number ?? null,
        bank_ifsc: data.bank_ifsc ?? null,
        bank_account_holder: data.bank_account_holder ?? null,
        upi_id: data.upi_id ?? null,
        salary_type: (data.salary_type as never) ?? null,
        salary_amount: data.salary_amount ?? null,
        is_active: data.is_active,
        updated_at: new Date(),
        updated_by: actorId,
      },
      include: { vehicle: { select: { id: true, name: true, type: true, image_key: true } } },
    });
    revalidatePath(PATH);
    await createLog({
      action:     "UPDATE",
      entity:     "CabDriver",
      entityId:   String(id),
      entitySlug: updated.name,
    });
    return { success: true as const, message: "Driver updated", driver: serializeDriver(updated) };
  } catch (e) {
    console.error("[updateCabDriver]", e);
    return { success: false as const, message: "Failed to update driver" };
  }
}

// ── Toggle active ──────────────────────────────────────────────────────────

export async function toggleDriverActive(id: number, value: boolean) {
  const session = await dashboardAuth();
  const actorId = session?.user?.id ?? null;

  try {
    const updated = await db.cab_drivers.update({ where: { id }, data: { is_active: value, updated_at: new Date(), updated_by: actorId } });
    revalidatePath(PATH);
    await createLog({
      action:     "UPDATE",
      entity:     "CabDriver",
      entityId:   String(id),
      entitySlug: updated.name,
      newData:    { is_active: value },
      metadata:   { operation: "toggle_active" },
    });
    return { success: true as const };
  } catch (e) {
    console.error("[toggleDriverActive]", e);
    return { success: false as const, message: "Failed to update status" };
  }
}

// ── Toggle verified ────────────────────────────────────────────────────────

export async function toggleDriverVerified(id: number, value: boolean) {
  const session = await dashboardAuth();
  if (!session?.user) return { success: false as const, message: "Unauthorized" };
  const actorId = session.user.id ?? null;

  try {
    const updated = await db.cab_drivers.update({ where: { id }, data: { is_verified: value, updated_at: new Date(), updated_by: actorId } });
    revalidatePath(PATH);
    await createLog({
      action:     "UPDATE",
      entity:     "CabDriver",
      entityId:   String(id),
      entitySlug: updated.name,
      newData:    { is_verified: value },
      metadata:   { operation: "toggle_verified" },
    });
    return { success: true as const, message: value ? "Driver verified" : "Verification removed" };
  } catch (e) {
    console.error("[toggleDriverVerified]", e);
    return { success: false as const, message: "Failed to update verification" };
  }
}

// ── Cab pricing rate lookup ────────────────────────────────────────────────

export async function getCabPricingRateForDriver(
  destinationId: number,
  vehicleId: number,
): Promise<{ price: number; pricing_type: string } | null> {
  if (!destinationId || !vehicleId) return null;
  try {
    const row = await db.cab_pricing.findFirst({
      where: { destination_id: destinationId, vehicle_id: vehicleId, is_active: true },
      select: { price: true, pricing_type: true },
    });
    if (!row) return null;
    return { price: row.price.toNumber(), pricing_type: row.pricing_type };
  } catch {
    return null;
  }
}

// ── Delete ─────────────────────────────────────────────────────────────────

export async function deleteCabDriver(id: number) {
  const session = await dashboardAuth();
  if (!session?.user) return { success: false as const, message: "Unauthorized" };

  try {
    const deleted = await db.cab_drivers.delete({ where: { id } });
    revalidatePath(PATH);
    await createLog({
      action:     "DELETE",
      entity:     "CabDriver",
      entityId:   String(id),
      entitySlug: deleted.name,
    });
    return { success: true as const, message: "Driver deleted" };
  } catch (e) {
    console.error("[deleteCabDriver]", e);
    return { success: false as const, message: "Failed to delete driver" };
  }
}
