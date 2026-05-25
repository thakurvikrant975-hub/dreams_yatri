"use server";

import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";
import { dashboardAuth } from "@/app/lib/auth-dashboard";

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
  license_expiry: string | null;   // ISO date string
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
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
  is_active: boolean; created_at: Date; updated_at: Date;
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
    is_active: d.is_active,
    created_at: d.created_at.toISOString(),
    updated_at: d.updated_at.toISOString(),
  };
}

function toDate(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// ── Read ───────────────────────────────────────────────────────────────────

export async function getCabDrivers(params: {
  page?: number; limit?: number; search?: string; status?: "active" | "inactive" | "all";
} = {}) {
  const { page = 1, limit = 20, search = "", status = "all" } = params;

  const where = {
    ...(search ? {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { mobile: { contains: search } },
        { city: { contains: search, mode: "insensitive" as const } },
      ],
    } : {}),
    ...(status === "active" ? { is_active: true } : status === "inactive" ? { is_active: false } : {}),
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

  return {
    rows: drivers.map(serializeDriver),
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    limit,
  };
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

  try {
    const created = await db.cab_drivers.create({
      data: {
        name: data.name,
        mobile: data.mobile,
        mobile_secondary: data.mobile_secondary ?? null,
        profile_image_key: data.profile_image_key ?? null,
        city: data.city ?? null,
        state: data.state ?? null,
        vehicle_id: data.vehicle_id ?? null,
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
      },
      include: { vehicle: { select: { id: true, name: true, type: true, image_key: true } } },
    });
    revalidatePath(PATH);
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
        vehicle_id: data.vehicle_id ?? null,
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
        updated_at: new Date(),
      },
      include: { vehicle: { select: { id: true, name: true, type: true, image_key: true } } },
    });
    revalidatePath(PATH);
    return { success: true as const, message: "Driver updated", driver: serializeDriver(updated) };
  } catch (e) {
    console.error("[updateCabDriver]", e);
    return { success: false as const, message: "Failed to update driver" };
  }
}

// ── Toggle active ──────────────────────────────────────────────────────────

export async function toggleDriverActive(id: number, value: boolean) {
  try {
    await db.cab_drivers.update({ where: { id }, data: { is_active: value, updated_at: new Date() } });
    revalidatePath(PATH);
    return { success: true as const };
  } catch (e) {
    console.error("[toggleDriverActive]", e);
    return { success: false as const, message: "Failed to update status" };
  }
}

// ── Delete ─────────────────────────────────────────────────────────────────

export async function deleteCabDriver(id: number) {
  const session = await dashboardAuth();
  if (!session?.user) return { success: false as const, message: "Unauthorized" };

  try {
    await db.cab_drivers.delete({ where: { id } });
    revalidatePath(PATH);
    return { success: true as const, message: "Driver deleted" };
  } catch (e) {
    console.error("[deleteCabDriver]", e);
    return { success: false as const, message: "Failed to delete driver" };
  }
}
