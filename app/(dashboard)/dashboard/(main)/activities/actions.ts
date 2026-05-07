"use server";

import { db }             from "@/app/lib/db";
import { deleteFromR2 } from "@/app/lib/r2/r2delete";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ── Types ─────────────────────────────────────────────────────────────────

export type ActivityFormState = {
  success:  boolean;
  message:  string;
  errors?:  Record<string, string[]>;
  id?:      number; // returned on create so we can redirect to images tab
};

export type ActivityImage = {
  id:         number;
  url:        string;
  thumbnail:  string | null;
  is_primary: boolean;
  sort_order: number;
};

export type ActivityItem = {
  id:                number;
  name:              string;
  slug:              string;
  description:       string | null;
  meta_title:        string | null;
  meta_desc:         string | null;
  category:          string | null;
  difficulty:        string | null;
  duration_hours:    number | null;
  price:             number | null;
  original_price:    number | null;
  margin_percentage: number;
  pricing_type:      string | null;
  min_persons:       number | null;
  max_persons:       number | null;
  is_active:         boolean;
  created_at:        Date;
  destination:       { id: number; name: string };
  images:            ActivityImage[];
  _count:            { images: number; packages: number };
};

// ── Schema ────────────────────────────────────────────────────────────────
const ActivitySchema = z.object({
  name:              z.string().min(1, "Name is required"),
  slug:              z.string().min(1).regex(/^[a-z0-9-]+$/, "Only lowercase, numbers and hyphens"),
  destination_id:    z.coerce.number().int().positive("Destination is required"),
  description:       z.string().optional(),
  meta_title:        z.string().optional(),
  meta_desc:         z.string().optional(),
  category:          z.string().optional(),
  difficulty:        z.string().optional(),
  duration_hours:    z.coerce.number().min(0).optional(),
  price:             z.coerce.number().min(0).optional(),
  original_price:    z.coerce.number().min(0).optional(),
  margin_percentage: z.coerce.number().min(0).max(100).default(0),
  pricing_type: z.string().optional(),
  min_persons: z.coerce.number().int().min(1).optional(),
  max_persons: z.coerce.number().int().min(1).optional(),
  is_active: z.boolean().default(true),
});

// ── Read ──────────────────────────────────────────────────────────────────

export async function getActivities(): Promise<ActivityItem[]> {
  const rows = await db.activities.findMany({
    orderBy: { created_at: "desc" },
    include: {
      destination: { select: { id: true, name: true } },
      images: {
        orderBy: { sort_order: "asc" },
        select:  { id: true, url: true, thumbnail: true, is_primary: true, sort_order: true },
      },
      _count: { select: { images: true,  } },
    },
  });

  return rows.map(a => ({
    ...a,
    duration_hours:    a.duration_hours    ? Number(a.duration_hours)    : null,
    price:             a.price             ? Number(a.price)             : null,
    original_price:    a.original_price    ? Number(a.original_price)    : null,
    margin_percentage: Number(a.margin_percentage),
  }));
}

export async function getActivityById(id: number) {
  const activity = await db.activities.findUnique({
    where:   { id },
    include: {
      destination: { select: { id: true, name: true } },
      images: {
        orderBy: { sort_order: "asc" },
        select:  { id: true, url: true, thumbnail: true, is_primary: true, sort_order: true },
      },
    },
  });
  if (!activity) return null;
  return {
    ...activity,
    duration_hours:    activity.duration_hours    ? Number(activity.duration_hours)    : null,
    price:             activity.price             ? Number(activity.price)             : null,
    original_price:    activity.original_price    ? Number(activity.original_price)    : null,
    margin_percentage: Number(activity.margin_percentage),
  };
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
    name:              formData.get("name"),
    slug:              formData.get("slug"),
    destination_id:    formData.get("destination_id"),
    description:       formData.get("description")       || undefined,
    meta_title:        formData.get("meta_title")         || undefined,
    meta_desc:         formData.get("meta_desc")          || undefined,
    category:          formData.get("category")           || undefined,
    difficulty:        formData.get("difficulty")         || undefined,
    duration_hours:    formData.get("duration_hours")     || undefined,
    price:             formData.get("price")              || undefined,
    original_price:    formData.get("original_price")     || undefined,
    margin_percentage: formData.get("margin_percentage")  || 0,
    pricing_type:      formData.get("pricing_type")       || undefined,
    min_persons:       formData.get("min_persons")        || undefined,
    max_persons:       formData.get("max_persons")        || undefined,
    is_active:         formData.get("is_active") === "true",
  };

  const parsed = ActivitySchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const existing = await db.activities.findUnique({ where: { slug: parsed.data.slug } });
    if (existing) {
      return { success: false, message: "Slug already in use", errors: { slug: ["Slug taken"] } };
    }

    const activity = await db.activities.create({ data: parsed.data });
    revalidatePath("/dashboard/activities");
    return { success: true, message: "Activity created", id: activity.id };
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
    name:              formData.get("name"),
    slug:              formData.get("slug"),
    destination_id:    formData.get("destination_id"),
    description:       formData.get("description")       || undefined,
    meta_title:        formData.get("meta_title")         || undefined,
    meta_desc:         formData.get("meta_desc")          || undefined,
    category:          formData.get("category")           || undefined,
    difficulty:        formData.get("difficulty")         || undefined,
    duration_hours:    formData.get("duration_hours")     || undefined,
    price:             formData.get("price")              || undefined,
    original_price:    formData.get("original_price")     || undefined,
    margin_percentage: formData.get("margin_percentage")  || 0,
    pricing_type:      formData.get("pricing_type")       || undefined,
    min_persons:       formData.get("min_persons")        || undefined,
    max_persons:       formData.get("max_persons")        || undefined,
    is_active:         formData.get("is_active") === "true",
  };

  const parsed = ActivitySchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors };
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

export async function toggleActivityActive(id: number, is_active: boolean): Promise<void> {
  await db.activities.update({ where: { id }, data: { is_active } });
  revalidatePath("/dashboard/activities");
}

// ── Delete Activity ───────────────────────────────────────────────────────

export async function deleteActivity(id: number): Promise<ActivityFormState> {
  try {
    const activity = await db.activities.findUnique({
      where:   { id },
      include: {
        images:  { select: { url: true, thumbnail: true } },
        _count:  { select: { packages: true } },
      },
    });

    if (!activity) return { success: false, message: "Activity not found" };

    if (activity._count.packages > 0) {
      return {
        success: false,
        message: `Cannot delete — used in ${activity._count.packages} package(s)`,
      };
    }

    // Delete R2 files
    const r2Keys = [
      ...new Set(
        activity.images.flatMap(img =>
          [img.url, img.thumbnail].filter(Boolean) as string[]
        )
      ),
    ];
    await Promise.all(r2Keys.map(k => deleteFromR2(k).catch(console.error)));

    await db.activity_images.deleteMany({ where: { activity_id: id } });
    await db.activities.delete({ where: { id } });

    revalidatePath("/dashboard/activities");
    return { success: true, message: "Activity deleted" };
  } catch {
    return { success: false, message: "Database error. Please try again." };
  }
}

// ── Image actions ─────────────────────────────────────────────────────────

export async function addActivityImages(
  activity_id: number,
  images: { url: string; thumbnail?: string }[],
): Promise<ActivityFormState> {
  try {
    const existing = await db.activity_images.count({ where: { activity_id } });
    const isFirst  = existing === 0;

    await db.activity_images.createMany({
      data: images.map((img, i) => ({
        activity_id,
        url:        img.url,
        thumbnail:  img.thumbnail || img.url,
        sort_order: existing + i,
        is_primary: isFirst && i === 0,
      })),
    });

    revalidatePath("/dashboard/activities");
    return { success: true, message: `${images.length} image${images.length !== 1 ? "s" : ""} added` };
  } catch {
    return { success: false, message: "Database error." };
  }
}

export async function deleteActivityImage(
  id:          number,
  activity_id: number,
  url:         string,
  thumbnail?:  string,
): Promise<ActivityFormState> {
  try {
    const keys = [...new Set([url, thumbnail].filter(Boolean) as string[])];
    await Promise.all(keys.map(k => deleteFromR2(k).catch(console.error)));
    await db.activity_images.delete({ where: { id } });
    revalidatePath("/dashboard/activities");
    return { success: true, message: "Image deleted" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

export async function setPrimaryActivityImage(
  id:          number,
  activity_id: number,
): Promise<ActivityFormState> {
  try {
    await db.$transaction([
      db.activity_images.updateMany({ where: { activity_id }, data: { is_primary: false } }),
      db.activity_images.update({    where: { id },            data: { is_primary: true } }),
    ]);
    revalidatePath("/dashboard/activities");
    return { success: true, message: "Primary image set" };
  } catch {
    return { success: false, message: "Database error." };
  }
}