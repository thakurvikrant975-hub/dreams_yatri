"use server";

import { db }             from "@/app/lib/db";
import { deleteFromR2 } from "@/app/lib/r2/r2delete";
import { revalidatePath } from "next/cache";
import { z }              from "zod";

// ── Schema ────────────────────────────────────────────────────────────────
const RegionSchema = z.object({
  name:        z.string().min(1, "Name is required"),
  slug:        z.string().min(1, "Slug is required").regex(/^[a-z0-9-]+$/, "Lowercase, numbers and hyphens only"),
  country:     z.string().min(1, "Country is required"),
  description: z.string().optional(),
  meta_title:  z.string().optional(),
  meta_desc:   z.string().optional(),
  is_active:   z.boolean().default(true),
});

export type RegionFormState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
};

// ── Read ──────────────────────────────────────────────────────────────────
export async function getRegions() {
  return db.regions.findMany({
    orderBy: { created_at: "desc" },
    include: { _count: { select: { destinations: true } } },
  });
}

// ── Create ────────────────────────────────────────────────────────────────
export async function createRegion(
  _prev: RegionFormState,
  formData: FormData,
): Promise<RegionFormState> {
  const raw = {
    name:        formData.get("name")        as string,
    slug:        formData.get("slug")        as string,
    country:     formData.get("country")     as string,
    description: (formData.get("description") as string) || undefined,
    meta_title:  (formData.get("meta_title")  as string) || undefined,
    meta_desc:   (formData.get("meta_desc")   as string) || undefined,
    is_active:   formData.get("is_active") === "true",
  };

  // Image keys — stored as R2 keys in DB
  const thumbnail   = (formData.get("thumbnail")   as string) || null;
  const cover_image = (formData.get("cover_image") as string) || null;

  const parsed = RegionSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const existing = await db.regions.findUnique({ where: { slug: parsed.data.slug } });
    if (existing) {
      return { success: false, message: "Slug already exists", errors: { slug: ["This slug is already taken"] } };
    }

    await db.regions.create({
      data: {
        ...parsed.data,
        thumbnail,     // R2 key e.g. "regions/north-india-thumb-1748234921.jpg"
        cover_image,   // R2 key e.g. "regions/north-india-cover-1748234921.jpg"
      },
    });

    revalidatePath("/dashboard/regions");
    return { success: true, message: "Region created successfully" };
  } catch {
    return { success: false, message: "Database error. Please try again." };
  }
}

// ── Update ────────────────────────────────────────────────────────────────
export async function updateRegion(
  id: number,
  _prev: RegionFormState,
  formData: FormData,
): Promise<RegionFormState> {
  const raw = {
    name:        formData.get("name")        as string,
    slug:        formData.get("slug")        as string,
    country:     formData.get("country")     as string,
    description: (formData.get("description") as string) || undefined,
    meta_title:  (formData.get("meta_title")  as string) || undefined,
    meta_desc:   (formData.get("meta_desc")   as string) || undefined,
    is_active:   formData.get("is_active") === "true",
  };

  // New image keys from form (empty string means no change / no image)
  const newThumbnail  = (formData.get("thumbnail")   as string) || null;
  const newCoverImage = (formData.get("cover_image") as string) || null;

  const parsed = RegionSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const existing = await db.regions.findFirst({
      where: { slug: parsed.data.slug, NOT: { id } },
    });
    if (existing) {
      return { success: false, message: "Slug already taken", errors: { slug: ["This slug is already taken"] } };
    }

    // Get current region to check old image keys
    const current = await db.regions.findUnique({ where: { id } });
    if (!current) return { success: false, message: "Region not found" };

    // If new image uploaded — delete old one from R2
    if (newThumbnail && current.thumbnail && newThumbnail !== current.thumbnail) {
      await deleteFromR2(current.thumbnail).catch(console.error);
    }
    if (newCoverImage && current.cover_image && newCoverImage !== current.cover_image) {
      await deleteFromR2(current.cover_image).catch(console.error);
    }

    await db.regions.update({
      where: { id },
      data: {
        ...parsed.data,
        // Only update image if a new one was uploaded, otherwise keep existing
        ...(newThumbnail  !== null && { thumbnail:   newThumbnail }),
        ...(newCoverImage !== null && { cover_image: newCoverImage }),
      },
    });

    revalidatePath("/dashboard/regions");
    return { success: true, message: "Region updated successfully" };
  } catch {
    return { success: false, message: "Database error. Please try again." };
  }
}

// ── Delete ────────────────────────────────────────────────────────────────
export async function deleteRegion(id: number): Promise<RegionFormState> {
  try {
    const region = await db.regions.findUnique({
      where: { id },
      include: { _count: { select: { destinations: true } } },
    });

    if (!region) return { success: false, message: "Region not found" };

    if (region._count.destinations > 0) {
      return {
        success: false,
        message: `Cannot delete — ${region._count.destinations} destination(s) linked. Remove them first.`,
      };
    }

    // Delete images from R2 first
    if (region.thumbnail)   await deleteFromR2(region.thumbnail).catch(console.error);
    if (region.cover_image) await deleteFromR2(region.cover_image).catch(console.error);

    await db.regions.delete({ where: { id } });
    revalidatePath("/dashboard/regions");
    return { success: true, message: "Region deleted successfully" };
  } catch {
    return { success: false, message: "Database error. Please try again." };
  }
}

// ── Toggle Active ──────────────────────────────────────────────────────────
export async function toggleRegionActive(id: number, is_active: boolean) {
  await db.regions.update({ where: { id }, data: { is_active } });
  revalidatePath("/dashboard/regions");
}