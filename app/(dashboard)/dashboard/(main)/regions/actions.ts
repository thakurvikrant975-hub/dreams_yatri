"use server";

import { db }             from "@/app/lib/db";
import { deleteFromR2 }   from "@/app/lib/r2/r2delete";
import { revalidatePath } from "next/cache";
import { Ok, Err, Result } from "@/app/lib/result";
import { RegionSchema }   from "@/app/lib/validators/regions";
import { RegionInput } from "@/app/lib/validators/regions";

// ── Shared FormState type ─────────────────────────────────────────────────────
export type RegionFormState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
};

// ── Internal helper: FormData → raw object ────────────────────────────────────
function extractRegionFields(formData: FormData) {
  return {
    name:        formData.get("name")        as string,
    slug:        formData.get("slug")        as string,
    country:     formData.get("country")     as string,
    description: (formData.get("description") as string) || undefined,
    meta_title:  (formData.get("meta_title")  as string) || undefined,
    meta_desc:   (formData.get("meta_desc")   as string) || undefined,
    is_active:   formData.get("is_active") === "true",
    thumbnail:   formData.get("thumbnail")   as string,
    cover_image: (formData.get("cover_image") as string) || undefined,
  };
}

// ── Internal helper: Result<T> → RegionFormState ──────────────────────────────
function toFormState(result: Result<string>): RegionFormState {
  if (result.success) return { success: true, message: result.data };
  return { success: false, message: result.error.message };
}

// ── Read ──────────────────────────────────────────────────────────────────────
const PAGE_SIZE = 10;

// actions.ts
export async function getRegions(page: number) {
    const skip = (page - 1) * PAGE_SIZE;
 
    const [regions, totalCount, activeCount, destinationCount] = await Promise.all([
        db.custom_regions.findMany({
            skip,
            take: PAGE_SIZE,
            include: { _count: { select: { destinations: true } } },
            orderBy: { created_at: "desc" },
        }),
        db.custom_regions.count(),
        db.custom_regions.count({ where: { is_active: true } }),
        db.destinations.count(),
    ]);
 
    return {
        regions,
        totalPages: Math.ceil(totalCount / PAGE_SIZE),
        currentPage: page,
        stats: {
            total: totalCount,
            active: activeCount,
            inactive: totalCount - activeCount,
            destinations: destinationCount,
        },
    };
} 

// ── Create ────────────────────────────────────────────────────────────────────
export async function createRegion(
  _prev: RegionFormState,
  formData: FormData,
): Promise<RegionFormState> {
  const parsed = RegionSchema.safeParse(extractRegionFields(formData));

  if (!parsed.success) {
    return {
      success: false,
      message: "Validation failed",
      errors:  parsed.error.flatten().fieldErrors,
    };
  }

  const result = await createRegionRecord(parsed.data);
  return toFormState(result);
}

async function createRegionRecord(data: RegionInput): Promise<Result<string>> {
  try {
    const existing = await db.custom_regions.findUnique({ where: { slug: data.slug } });
    if (existing) return Result.conflict("This slug is already taken");

    await db.custom_regions.create({
      data: {
        name:        data.name,
        slug:        data.slug,
        country:     data.country,
        description: data.description ?? null,
        meta_title:  data.meta_title  ?? null,
        meta_desc:   data.meta_desc   ?? null,
        is_active:   data.is_active,
        thumbnail:   data.thumbnail,
        cover_image: data.cover_image ?? null,
      },
    });
    revalidatePath("/dashboard/regions");
    return Ok("Region created successfully");
  } catch (e) {
    return Result.dbError(e);
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
export async function updateRegion(
  id: number,
  _prev: RegionFormState,
  formData: FormData,
): Promise<RegionFormState> {
  const parsed = RegionSchema.safeParse(extractRegionFields(formData));

  if (!parsed.success) {
    return {
      success: false,
      message: "Validation failed",
      errors:  parsed.error.flatten().fieldErrors,
    };
  }

  const result = await updateRegionRecord(id, parsed.data);
  return toFormState(result);
}

async function updateRegionRecord(
  id: number,
  data: RegionInput,
): Promise<Result<string>> {
  try {
    const slugConflict = await db.custom_regions.findFirst({
      where: { slug: data.slug, NOT: { id } },
    });
    if (slugConflict) return Result.conflict("This slug is already taken");

    const current = await db.custom_regions.findUnique({ where: { id } });
    if (!current) return Result.notFound("Region");

    await db.custom_regions.update({
      where: { id },
      data: {
        name:        data.name,
        slug:        data.slug,
        country:     data.country,
        description: data.description ?? null,
        meta_title:  data.meta_title  ?? null,
        meta_desc:   data.meta_desc   ?? null,
        is_active:   data.is_active,
        thumbnail:   data.thumbnail,
        cover_image: data.cover_image ?? null,
      },
    });

    // Prune replaced R2 assets after confirmed DB success
    if (data.thumbnail && current.thumbnail && data.thumbnail !== current.thumbnail) {
      await deleteFromR2(current.thumbnail).catch(console.error);
    }
    if (data.cover_image && current.cover_image && data.cover_image !== current.cover_image) {
      await deleteFromR2(current.cover_image).catch(console.error);
    }

    revalidatePath("/dashboard/regions");
    return Ok("Region updated successfully");
  } catch (e) {
    return Result.dbError(e);
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────
export async function deleteRegion(id: number): Promise<RegionFormState> {
  const result = await deleteRegionRecord(id);
  return toFormState(result);
}

async function deleteRegionRecord(id: number): Promise<Result<string>> {
  try {
    const region = await db.custom_regions.findUnique({
      where:   { id },
      include: { _count: { select: { destinations: true } } },
    });

    if (!region) return Result.notFound("Region");

    if (region._count.destinations > 0) {
      return Result.conflict(
        `Cannot delete — ${region._count.destinations} destination(s) linked. Remove them first.`
      );
    }

    if (region.thumbnail)   await deleteFromR2(region.thumbnail).catch(console.error);
    if (region.cover_image) await deleteFromR2(region.cover_image).catch(console.error);

    await db.custom_regions.delete({ where: { id } });
    revalidatePath("/dashboard/regions");
    return Ok("Region deleted successfully");
  } catch (e) {
    return Result.dbError(e);
  }
}

// ── Toggle Active ─────────────────────────────────────────────────────────────
export async function toggleRegionActive(id: number, is_active: boolean): Promise<void> {
  try {
    await db.custom_regions.update({ where: { id }, data: { is_active } });
    revalidatePath("/dashboard/regions");
  } catch (e) {
    console.error("[toggleRegionActive]", e);
    // Surface to caller if needed — extend to return Result<void> when toggle has UI feedback
  }
}