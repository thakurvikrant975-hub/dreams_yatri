"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/app/lib/db";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { createLog } from "../../lib/logger";
import type { PermitCategory, PermitValidityType, PermitRow, PermitInput } from "./permit.types";

const PATH = "/dashboard/permits";

// ── Helpers ────────────────────────────────────────────────────────────────

function mapRow(r: {
  id: number;
  name: string;
  category: string;
  custom_category: string | null;
  location_id: bigint | null;
  location: { name: string } | null;
  issuing_authority: string | null;
  price_per_vehicle: { toNumber(): number };
  price_per_person: { toNumber(): number } | null;
  validity_type: string;
  validity_days: number | null;
  notes: string | null;
  is_active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
}): PermitRow {
  return {
    id:                r.id,
    name:              r.name,
    category:          r.category as PermitCategory,
    custom_category:   r.custom_category,
    location_id:       r.location_id?.toString() ?? null,
    location_name:     r.location?.name ?? null,
    issuing_authority: r.issuing_authority,
    price_per_vehicle: r.price_per_vehicle.toNumber(),
    price_per_person:  r.price_per_person?.toNumber() ?? null,
    validity_type:     r.validity_type as PermitValidityType,
    validity_days:     r.validity_days,
    notes:             r.notes,
    is_active:         r.is_active,
    created_by:        r.created_by,
    updated_by:        r.updated_by,
    created_at:        r.created_at,
    updated_at:        r.updated_at,
  };
}

const INCLUDE = {
  location: { select: { name: true } },
} as const;

// ── Read ───────────────────────────────────────────────────────────────────

export async function getPermits(opts: {
  page:     number;
  limit:    number;
  search:   string;
  category: string;
  status:   string;
}): Promise<{
  rows:       PermitRow[];
  total:      number;
  totalPages: number;
  stats: { total: number; active: number; inactive: number; withLocation: number };
}> {
  const { page, limit, search, category, status } = opts;

  const where = {
    ...(search
      ? {
          OR: [
            { name:              { contains: search, mode: "insensitive" as const } },
            { issuing_authority: { contains: search, mode: "insensitive" as const } },
            { location:          { name: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
    ...(category && category !== "all" ? { category: category as never } : {}),
    ...(status === "active"   ? { is_active: true  } :
        status === "inactive" ? { is_active: false } : {}),
  };

  const [rows, total, statsTotal, statsActive, statsWithLoc] = await Promise.all([
    db.permits.findMany({
      where,
      include: INCLUDE,
      orderBy: [{ is_active: "desc" }, { name: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.permits.count({ where }),
    db.permits.count(),
    db.permits.count({ where: { is_active: true } }),
    db.permits.count({ where: { location_id: { not: null } } }),
  ]);

  const mapped = rows.map(mapRow);
  const actorIds = [...new Set(mapped.flatMap((r) => [r.created_by, r.updated_by]).filter(Boolean) as string[])];
  const members = actorIds.length > 0
    ? await db.team_members.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })
    : [];
  const memberNames: Record<string, string> = Object.fromEntries(members.map((m) => [m.id, m.name]));

  return {
    rows:       mapped,
    memberNames,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    stats: {
      total:        statsTotal,
      active:       statsActive,
      inactive:     statsTotal - statsActive,
      withLocation: statsWithLoc,
    },
  };
}

// ── Create ─────────────────────────────────────────────────────────────────

export async function createPermit(input: PermitInput) {
  const session = await dashboardAuth();
  const actor = session?.user?.id ?? null;

  try {
    const name = input.name.trim();
    if (!name) return { success: false as const, message: "Permit name is required" };

    const created = await db.permits.create({
      data: {
        name,
        category:          input.category,
        custom_category:   input.category === "OTHER" ? (input.custom_category?.trim() || null) : null,
        location_id:       input.location_id ? BigInt(input.location_id) : null,
        issuing_authority: input.issuing_authority?.trim() || null,
        price_per_vehicle: input.price_per_vehicle,
        price_per_person:  input.price_per_person ?? null,
        validity_type:     input.validity_type,
        validity_days:     input.validity_type === "MULTI_DAY" ? (input.validity_days ?? null) : null,
        notes:             input.notes?.trim() || null,
        is_active:         true,
        created_by:        actor,
        updated_by:        actor,
      },
      include: INCLUDE,
    });

    revalidatePath(PATH);
    await createLog({
      action:     "CREATE",
      entity:     "Permit",
      entityId:   String(created.id),
      entitySlug: created.name,
      newData:    { name: created.name, category: created.category },
    });

    return { success: true as const, data: mapRow(created) };
  } catch (e) {
    console.error("[createPermit]", e);
    return { success: false as const, message: "Failed to create permit" };
  }
}

// ── Update ─────────────────────────────────────────────────────────────────

export async function updatePermit(id: number, input: PermitInput) {
  const session = await dashboardAuth();
  const actor = session?.user?.id ?? null;

  try {
    const name = input.name.trim();
    if (!name) return { success: false as const, message: "Permit name is required" };

    const updated = await db.permits.update({
      where: { id },
      data: {
        name,
        category:          input.category,
        custom_category:   input.category === "OTHER" ? (input.custom_category?.trim() || null) : null,
        location_id:       input.location_id ? BigInt(input.location_id) : null,
        issuing_authority: input.issuing_authority?.trim() || null,
        price_per_vehicle: input.price_per_vehicle,
        price_per_person:  input.price_per_person ?? null,
        validity_type:     input.validity_type,
        validity_days:     input.validity_type === "MULTI_DAY" ? (input.validity_days ?? null) : null,
        notes:             input.notes?.trim() || null,
        updated_by:        actor,
      },
      include: INCLUDE,
    });

    revalidatePath(PATH);
    await createLog({
      action:     "UPDATE",
      entity:     "Permit",
      entityId:   String(updated.id),
      entitySlug: updated.name,
    });

    return { success: true as const, data: mapRow(updated) };
  } catch (e) {
    console.error("[updatePermit]", e);
    return { success: false as const, message: "Failed to update permit" };
  }
}

// ── Toggle Active ──────────────────────────────────────────────────────────

export async function togglePermitActive(id: number, value: boolean) {
  try {
    await db.permits.update({ where: { id }, data: { is_active: value } });
    revalidatePath(PATH);
    return { success: true as const };
  } catch (e) {
    console.error("[togglePermitActive]", e);
    return { success: false as const, message: "Failed to update status" };
  }
}

// ── Delete ─────────────────────────────────────────────────────────────────

export async function deletePermit(id: number) {
  try {
    const deleted = await db.permits.delete({ where: { id } });
    revalidatePath(PATH);
    await createLog({
      action:     "DELETE",
      entity:     "Permit",
      entityId:   String(id),
      entitySlug: deleted.name,
    });
    return { success: true as const, message: "Permit deleted" };
  } catch (e) {
    console.error("[deletePermit]", e);
    return { success: false as const, message: "Failed to delete permit" };
  }
}
