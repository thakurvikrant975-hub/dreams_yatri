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
  label:      string | null;
};

export type ActivityItem = {
  id:             number;
  name:           string;
  slug:           string;
  description:    string | null;
  meta_title:     string | null;
  meta_desc:      string | null;
  category:       string | null;
  difficulty:     string | null;
  duration_hours: number | null;
  latitude:       number | null;
  longitude:      number | null;
  is_active:      boolean;
  created_at:     Date;
  destination:    { id: number; name: string };
  images:         ActivityImage[];
  _count:         { images: number; variants: number };
};

export type ActivityVariant = {
  id:             number;
  activity_id:    number;
  name:           string;
  booking_mode:   string;
  pricing_type:   string;
  min_persons:    number | null;
  max_persons:    number | null;
  cost_price:     number | null;
  gst_percentage: number;
  valid_from:     Date | null;
  valid_to:       Date | null;
  is_active:      boolean;
  sort_order:     number;
  pricing:        ActivityVariantPricing[];
};

export type ActivityVariantPricing = {
  id:                number;
  variant_id:        number;
  label:             string;
  age_from:          number | null;
  age_to:            number | null;
  price:             number;
  original_price:    number | null;
  margin_percentage: number;
  is_active:         boolean;
  sort_order:        number;
};

export type ActivityAddon = {
  id:           number;
  activity_id:  number;
  title:        string;
  description:  string | null;
  pricing_type: string;
  price:        number;
  cost_price:   number | null;
  is_optional:  boolean;
  is_active:    boolean;
  sort_order:   number;
};

// ── Schema ────────────────────────────────────────────────────────────────
const ActivitySchema = z.object({
  name:           z.string().min(1, "Name is required"),
  slug:           z.string().min(1).regex(/^[a-z0-9-]+$/, "Only lowercase, numbers and hyphens"),
  destination_id: z.coerce.number().int().positive("Destination is required"),
  description:    z.string().optional(),
  meta_title:     z.string().optional(),
  meta_desc:      z.string().optional(),
  category:       z.string().optional(),
  difficulty:     z.string().optional(),
  duration_hours: z.coerce.number().min(0).optional(),
  is_active:      z.boolean().default(true),
  latitude:       z.coerce.number().nullable().optional(),
  longitude:      z.coerce.number().nullable().optional(),
});

// ── Read ──────────────────────────────────────────────────────────────────

export async function getActivities(): Promise<ActivityItem[]> {
  const rows = await db.activities.findMany({
    orderBy: { created_at: "desc" },
    include: {
      destination: { select: { id: true, name: true } },
      images: {
        orderBy: { sort_order: "asc" },
        select:  { id: true, url: true, thumbnail: true, is_primary: true, sort_order: true, label: true },
      },
      _count: { select: { images: true, variants: true } },
    },
  });

  return rows.map(a => ({
    ...a,
    duration_hours: a.duration_hours ? Number(a.duration_hours) : null,
    latitude:       a.latitude  ? Number(a.latitude)  : null,
    longitude:      a.longitude ? Number(a.longitude) : null,
  }));
}

export async function getActivityById(id: number) {
  const activity = await db.activities.findUnique({
    where:   { id },
    include: {
      destination: { select: { id: true, name: true } },
      images: {
        orderBy: { sort_order: "asc" },
        select:  { id: true, url: true, thumbnail: true, is_primary: true, sort_order: true, label: true },
      },
    },
  });
  if (!activity) return null;
  return {
    ...activity,
    duration_hours: activity.duration_hours ? Number(activity.duration_hours) : null,
  };
}

export async function getActivityWithVariants(id: number) {
  const activity = await db.activities.findUnique({
    where: { id },
    include: {
      destination: { select: { id: true, name: true } },
      variants: {
        orderBy: { sort_order: "asc" },
        include: {
          pricing: { orderBy: { sort_order: "asc" } },
        },
      },
      addons: { orderBy: { sort_order: "asc" } },
    },
  });
  if (!activity) return null;
  return {
    ...activity,
    duration_hours: activity.duration_hours ? Number(activity.duration_hours) : null,
    variants: activity.variants.map(v => ({
      ...v,
      cost_price: v.cost_price ? Number(v.cost_price) : null,
      gst_percentage: Number(v.gst_percentage),
      pricing: v.pricing.map(p => ({
        ...p,
        price: Number(p.price),
        original_price: p.original_price ? Number(p.original_price) : null,
        margin_percentage: Number(p.margin_percentage),
      })),
    })),
    addons: activity.addons.map(a => ({
      ...a,
      price: Number(a.price),
      cost_price: a.cost_price ? Number(a.cost_price) : null,
    })),
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
    name:           formData.get("name"),
    slug:           formData.get("slug"),
    destination_id: formData.get("destination_id"),
    description:    formData.get("description")    || undefined,
    meta_title:     formData.get("meta_title")     || undefined,
    meta_desc:      formData.get("meta_desc")      || undefined,
    category:       formData.get("category")       || undefined,
    difficulty:     formData.get("difficulty")     || undefined,
    duration_hours: formData.get("duration_hours") || undefined,
    is_active:      formData.get("is_active") === "true",
    latitude:       formData.get("latitude")  || undefined,
    longitude:      formData.get("longitude") || undefined,
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
    name:           formData.get("name"),
    slug:           formData.get("slug"),
    destination_id: formData.get("destination_id"),
    description:    formData.get("description")    || undefined,
    meta_title:     formData.get("meta_title")     || undefined,
    meta_desc:      formData.get("meta_desc")      || undefined,
    category:       formData.get("category")       || undefined,
    difficulty:     formData.get("difficulty")     || undefined,
    duration_hours: formData.get("duration_hours") || undefined,
    is_active:      formData.get("is_active") === "true",
    latitude:       formData.get("latitude")  || undefined,
    longitude:      formData.get("longitude") || undefined,
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
        images: { select: { url: true, thumbnail: true } },
        _count: { select: { itinerary_activities: true } },
      },
    });

    if (!activity) return { success: false, message: "Activity not found" };

    if (activity._count.itinerary_activities > 0) {
      return {
        success: false,
        message: `Cannot delete — used in ${activity._count.itinerary_activities} itinerary day(s). Remove from packages first.`,
      };
    }

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

export async function updateActivityImageLabel(
  id:    number,
  label: string,
): Promise<ActivityFormState> {
  try {
    await db.activity_images.update({ where: { id }, data: { label: label || null } });
    revalidatePath("/dashboard/activities");
    return { success: true, message: "Label saved" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

// ── Activity Variants ─────────────────────────────────────────────────────

export async function createVariant(
  activity_id: number,
  data: {
    name: string;
    booking_mode: string;
    pricing_type: string;
    min_persons?: number | null;
    max_persons?: number | null;
    cost_price?: number | null;
    gst_percentage?: number;
    valid_from?: Date | null;
    valid_to?: Date | null;
    is_active: boolean;
  },
): Promise<ActivityFormState> {
  try {
    const count = await db.activity_variants.count({ where: { activity_id } });
    const variant = await db.activity_variants.create({
      data: { activity_id, sort_order: count, ...data },
    });
    revalidatePath(`/dashboard/activities/${activity_id}`);
    return { success: true, message: "Variant created", id: variant.id };
  } catch {
    return { success: false, message: "Database error." };
  }
}

export async function updateVariant(
  id: number,
  activity_id: number,
  data: {
    name: string;
    booking_mode: string;
    pricing_type: string;
    min_persons?: number | null;
    max_persons?: number | null;
    cost_price?: number | null;
    gst_percentage?: number;
    valid_from?: Date | null;
    valid_to?: Date | null;
    is_active: boolean;
  },
): Promise<ActivityFormState> {
  try {
    await db.activity_variants.update({ where: { id }, data });
    revalidatePath(`/dashboard/activities/${activity_id}`);
    return { success: true, message: "Variant updated" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

export async function deleteVariant(id: number, activity_id: number): Promise<ActivityFormState> {
  try {
    await db.activity_variants.delete({ where: { id } });
    revalidatePath(`/dashboard/activities/${activity_id}`);
    return { success: true, message: "Variant deleted" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

// ── Variant Pricing ───────────────────────────────────────────────────────

export async function upsertVariantPricing(
  variant_id: number,
  activity_id: number,
  data: {
    id?: number;
    label: string;
    age_from?: number | null;
    age_to?: number | null;
    price: number;
    original_price?: number | null;
    margin_percentage?: number;
    is_active: boolean;
  },
): Promise<ActivityFormState> {
  try {
    if (data.id) {
      await db.activity_variant_pricing.update({
        where: { id: data.id },
        data: { label: data.label, age_from: data.age_from ?? null, age_to: data.age_to ?? null, price: data.price, original_price: data.original_price ?? null, margin_percentage: data.margin_percentage ?? 0, is_active: data.is_active },
      });
    } else {
      const count = await db.activity_variant_pricing.count({ where: { variant_id } });
      await db.activity_variant_pricing.create({
        data: { variant_id, label: data.label, age_from: data.age_from ?? null, age_to: data.age_to ?? null, price: data.price, original_price: data.original_price ?? null, margin_percentage: data.margin_percentage ?? 0, is_active: data.is_active, sort_order: count },
      });
    }
    revalidatePath(`/dashboard/activities/${activity_id}`);
    return { success: true, message: "Pricing saved" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

export async function deleteVariantPricing(id: number, activity_id: number): Promise<ActivityFormState> {
  try {
    await db.activity_variant_pricing.delete({ where: { id } });
    revalidatePath(`/dashboard/activities/${activity_id}`);
    return { success: true, message: "Pricing deleted" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

// ── Activity Add-ons ──────────────────────────────────────────────────────

export async function createAddon(
  activity_id: number,
  data: {
    title: string;
    description?: string | null;
    pricing_type: string;
    price: number;
    cost_price?: number | null;
    is_optional: boolean;
    is_active: boolean;
  },
): Promise<ActivityFormState> {
  try {
    const count = await db.activity_addons.count({ where: { activity_id } });
    await db.activity_addons.create({
      data: { activity_id, sort_order: count, ...data },
    });
    revalidatePath(`/dashboard/activities/${activity_id}`);
    return { success: true, message: "Add-on created" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

export async function updateAddon(
  id: number,
  activity_id: number,
  data: {
    title: string;
    description?: string | null;
    pricing_type: string;
    price: number;
    cost_price?: number | null;
    is_optional: boolean;
    is_active: boolean;
  },
): Promise<ActivityFormState> {
  try {
    await db.activity_addons.update({ where: { id }, data });
    revalidatePath(`/dashboard/activities/${activity_id}`);
    return { success: true, message: "Add-on updated" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

export async function deleteAddon(id: number, activity_id: number): Promise<ActivityFormState> {
  try {
    await db.activity_addons.delete({ where: { id } });
    revalidatePath(`/dashboard/activities/${activity_id}`);
    return { success: true, message: "Add-on deleted" };
  } catch {
    return { success: false, message: "Database error." };
  }
}