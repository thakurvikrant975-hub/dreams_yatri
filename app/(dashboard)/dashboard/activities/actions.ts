"use server";

import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ── Types ─────────────────────────────────────────────────────────────────

export type ActivityFormState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
};

// ── Schema ────────────────────────────────────────────────────────────────
const ActivitySchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers and hyphens"),
  destination_id: z.coerce.number().int().positive("Destination is required"),
  description: z.string().optional(),
  meta_title: z.string().optional(),
  meta_desc: z.string().optional(),
  category: z.string().optional(),
  difficulty: z.string().optional(),
  duration_hours: z.coerce.number().min(0).optional(),
  price: z.coerce.number().min(0).optional(),
  original_price: z.coerce.number().min(0).optional(),
  margin_percentage: z.coerce.number().min(0).max(100).default(0),
  pricing_type: z.string().optional(),
  min_persons: z.coerce.number().int().min(1).optional(),
  max_persons: z.coerce.number().int().min(1).optional(),
  is_active: z.boolean().default(true),
});

// ── Read ──────────────────────────────────────────────────────────────────

export async function getActivities() {
  return db.activities.findMany({
    orderBy: { created_at: "desc" },
    include: {
      destination: { select: { id: true, name: true } },
      _count: {
        select: { images: true, packages: true },
      },
    },
  });
}

export async function getDestinationsForSelect() {
  return db.destinations.findMany({
    where: { is_active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, region: { select: { name: true } } },
  });
}

// ── Create ────────────────────────────────────────────────────────────────

export async function createActivity(
  _prev: ActivityFormState,
  formData: FormData,
): Promise<ActivityFormState> {
  const raw = {
    name: formData.get("name"),
    slug: formData.get("slug"),
    destination_id: formData.get("destination_id"),
    description: formData.get("description") || undefined,
    meta_title: formData.get("meta_title") || undefined,
    meta_desc: formData.get("meta_desc") || undefined,
    category: formData.get("category") || undefined,
    difficulty: formData.get("difficulty") || undefined,
    duration_hours: formData.get("duration_hours") || undefined,
    price: formData.get("price") || undefined,
    original_price: formData.get("original_price") || undefined,
    margin_percentage: formData.get("margin_percentage") || 0,
    pricing_type: formData.get("pricing_type") || undefined,
    min_persons: formData.get("min_persons") || undefined,
    max_persons: formData.get("max_persons") || undefined,
    is_active: formData.get("is_active") === "true",
  };

  const parsed = ActivitySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      message: "Validation failed",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const existing = await db.activities.findUnique({ where: { slug: parsed.data.slug } });
    if (existing) {
      return { success: false, message: "Slug already in use", errors: { slug: ["Slug taken"] } };
    }

    await db.activities.create({ data: parsed.data });
    revalidatePath("/dashboard/activities");
    return { success: true, message: "Activity created" };
  } catch {
    return { success: false, message: "Database error. Please try again." };
  }
}

// ── Update ────────────────────────────────────────────────────────────────

export async function updateActivity(
  id: number,
  _prev: ActivityFormState,
  formData: FormData,
): Promise<ActivityFormState> {
  const raw = {
    name: formData.get("name"),
    slug: formData.get("slug"),
    destination_id: formData.get("destination_id"),
    description: formData.get("description") || undefined,
    meta_title: formData.get("meta_title") || undefined,
    meta_desc: formData.get("meta_desc") || undefined,
    category: formData.get("category") || undefined,
    difficulty: formData.get("difficulty") || undefined,
    duration_hours: formData.get("duration_hours") || undefined,
    price: formData.get("price") || undefined,
    original_price: formData.get("original_price") || undefined,
    margin_percentage: formData.get("margin_percentage") || 0,
    pricing_type: formData.get("pricing_type") || undefined,
    min_persons: formData.get("min_persons") || undefined,
    max_persons: formData.get("max_persons") || undefined,
    is_active: formData.get("is_active") === "true",
  };

  const parsed = ActivitySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      message: "Validation failed",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await db.activities.update({ where: { id }, data: parsed.data });
    revalidatePath("/dashboard/activities");
    return { success: true, message: "Activity updated" };
  } catch {
    return { success: false, message: "Database error. Please try again." };
  }
}

// ── Toggle Active ─────────────────────────────────────────────────────────

export async function toggleActivityActive(
  id: number,
  is_active: boolean,
): Promise<void> {
  await db.activities.update({ where: { id }, data: { is_active } });
  revalidatePath("/dashboard/activities");
}

// ── Delete ────────────────────────────────────────────────────────────────

export async function deleteActivity(id: number): Promise<ActivityFormState> {
  try {
    const activity = await db.activities.findUnique({
      where: { id },
      include: { _count: { select: { packages: true } } },
    });

    if (!activity) return { success: false, message: "Activity not found" };

    if (activity._count.packages > 0) {
      return {
        success: false,
        message: `Cannot delete — activity is used in ${activity._count.packages} package(s)`,
      };
    }

    // Delete images first
    await db.activity_images.deleteMany({ where: { activity_id: id } });
    await db.activities.delete({ where: { id } });

    revalidatePath("/dashboard/activities");
    return { success: true, message: "Activity deleted" };
  } catch {
    return { success: false, message: "Database error. Please try again." };
  }
}