"use server";

import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { PolicyType } from "./constants";

// ── Types ─────────────────────────────────────────────────────────────────

export type PolicyFormState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
};

export type Policy = {
  id: number;
  type: PolicyType;
  title: string;
  points: string[];
  is_active: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
  _count: { packages: number };
};

// ── Schema ────────────────────────────────────────────────────────────────

const PolicySchema = z.object({
  type: z.enum(["CANCELLATION", "DATE_CHANGE", "REFUND", "TERMS_AND_CONDITIONS"]),
  title: z.string().min(1, "Title is required"),
  points: z.array(z.string().min(1)).min(1, "At least one point is required"),
  is_active: z.boolean().default(true),
  sort_order: z.coerce.number().int().default(0),
});

// ── Read ──────────────────────────────────────────────────────────────────

export async function getPolicies(): Promise<Policy[]> {
  return db.policies.findMany({
    orderBy: [{ type: "asc" }, { sort_order: "asc" }],
    include: {
      _count: { select: { packages: true } },
    },
  }) as Promise<Policy[]>;
}

// ── Create ────────────────────────────────────────────────────────────────

export async function createPolicy(
  _prev: PolicyFormState,
  formData: FormData,
): Promise<PolicyFormState> {
  // Points come as JSON string from the form
  let points: string[] = [];
  try {
    points = JSON.parse(formData.get("points") as string || "[]");
  } catch {
    return { success: false, message: "Invalid points data" };
  }

  const raw = {
    type: formData.get("type"),
    title: formData.get("title"),
    points,
    is_active: formData.get("is_active") === "true",
    sort_order: formData.get("sort_order") || 0,
  };

  const parsed = PolicySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      message: "Validation failed",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await db.policies.create({ data: parsed.data });
    revalidatePath("/dashboard/policies");
    return { success: true, message: "Policy created" };
  } catch {
    return { success: false, message: "Database error. Please try again." };
  }
}

// ── Update ────────────────────────────────────────────────────────────────

export async function updatePolicy(
  id: number,
  _prev: PolicyFormState,
  formData: FormData,
): Promise<PolicyFormState> {
  let points: string[] = [];
  try {
    points = JSON.parse(formData.get("points") as string || "[]");
  } catch {
    return { success: false, message: "Invalid points data" };
  }

  const raw = {
    type: formData.get("type"),
    title: formData.get("title"),
    points,
    is_active: formData.get("is_active") === "true",
    sort_order: formData.get("sort_order") || 0,
  };

  const parsed = PolicySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      message: "Validation failed",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await db.policies.update({ where: { id }, data: parsed.data });
    revalidatePath("/dashboard/policies");
    return { success: true, message: "Policy updated" };
  } catch {
    return { success: false, message: "Database error. Please try again." };
  }
}

// ── Toggle Active ─────────────────────────────────────────────────────────

export async function togglePolicyActive(id: number, is_active: boolean): Promise<void> {
  await db.policies.update({ where: { id }, data: { is_active } });
  revalidatePath("/dashboard/policies");
}

// ── Delete ────────────────────────────────────────────────────────────────

export async function deletePolicy(id: number): Promise<PolicyFormState> {
  try {
    const policy = await db.policies.findUnique({
      where: { id },
      include: { _count: { select: { packages: true } } },
    });

    if (!policy) return { success: false, message: "Policy not found" };

    if (policy._count.packages > 0) {
      return {
        success: false,
        message: `Cannot delete — used in ${policy._count.packages} package(s). Remove assignments first.`,
      };
    }

    await db.policies.delete({ where: { id } });
    revalidatePath("/dashboard/policies");
    return { success: true, message: "Policy deleted" };
  } catch {
    return { success: false, message: "Database error. Please try again." };
  }
}