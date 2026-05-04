"use server";

import { revalidatePath } from "next/cache";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { db } from "@/app/lib/db";
import { z } from "zod";
import type { ActionResult } from "@/app/types/packages";

async function requireAuth(): Promise<ActionResult<never> | null> {
  const session = await dashboardAuth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  return null;
}

// ── Package Images (hero / listing photos) ────────────────────────────────────

export async function getPackageImagesAction(packageId: number) {
  const images = await db.package_images.findMany({
    where: { package_id: packageId },
    orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
  });
  return { success: true as const, data: images };
}

export async function addPackageImageAction(data: {
  package_id: number;
  url: string;
  thumbnail?: string;
  alt?: string;
}): Promise<ActionResult<{ id: number }>> {
  const authError = await requireAuth();
  if (authError) return authError;

  const parsed = z
    .object({
      package_id: z.number().int().positive(),
      url: z.url(),
      thumbnail: z.url().optional(),
      alt: z.string().max(255).optional(),
    })
    .safeParse(data);

  if (!parsed.success) {
    return { success: false, error: "Invalid data" };
  }

  // Count existing images to get sort_order
  const count = await db.package_images.count({
    where: { package_id: parsed.data.package_id },
  });

  const image = await db.package_images.create({
    data: {
      package_id: parsed.data.package_id,
      url: parsed.data.url,
      thumbnail: parsed.data.thumbnail ?? null,
      alt: parsed.data.alt ?? null,
      sort_order: count,
      is_primary: count === 0, // first image is primary
    },
    select: { id: true },
  });

  revalidatePath(`/dashboard/packages/${parsed.data.package_id}`);
  return { success: true, data: { id: image.id } };
}

export async function removePackageImageAction(
  imageId: number,
  packageId: number
): Promise<ActionResult<void>> {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    await db.package_images.delete({ where: { id: imageId } });
    revalidatePath(`/dashboard/packages/${packageId}`);
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Failed to delete image" };
  }
}

export async function setPrimaryPackageImageAction(
  imageId: number,
  packageId: number
): Promise<ActionResult<void>> {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    await db.$transaction([
      db.package_images.updateMany({
        where: { package_id: packageId },
        data: { is_primary: false },
      }),
      db.package_images.update({
        where: { id: imageId },
        data: { is_primary: true },
      }),
    ]);
    revalidatePath(`/dashboard/packages/${packageId}`);
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Failed to update primary image" };
  }
}

// ── Package Gallery (5-position curated grid) ─────────────────────────────────

export async function getPackageGalleryAction(packageId: number) {
  const images = await db.package_gallery.findMany({
    where: { package_id: packageId },
    orderBy: { position: "asc" },
  });
  return { success: true as const, data: images };
}

export async function upsertGalleryImageAction(data: {
  package_id: number;
  image_url: string;
  source_type: "PACKAGE" | "HOTEL" | "ROOM" | "ACTIVITY";
  source_id?: number;
  position: number;
  label?: string;
}): Promise<ActionResult<{ id: number }>> {
  const authError = await requireAuth();
  if (authError) return authError;

  const parsed = z
    .object({
      package_id: z.number().int().positive(),
      image_url: z.url(),
      source_type: z.enum(["PACKAGE", "HOTEL", "ROOM", "ACTIVITY"]),
      source_id: z.number().int().positive().optional(),
      position: z.number().int().min(1).max(5),
      label: z.string().max(100).optional(),
    })
    .safeParse(data);

  if (!parsed.success) {
    return { success: false, error: "Invalid data" };
  }

  try {
    const record = await db.package_gallery.upsert({
      where: {
        package_id_position: {
          package_id: parsed.data.package_id,
          position: parsed.data.position,
        },
      },
      create: {
        package_id: parsed.data.package_id,
        image_url: parsed.data.image_url,
        source_type: parsed.data.source_type,
        source_id: parsed.data.source_id ?? null,
        position: parsed.data.position,
        label: parsed.data.label ?? null,
      },
      update: {
        image_url: parsed.data.image_url,
        source_type: parsed.data.source_type,
        source_id: parsed.data.source_id ?? null,
        label: parsed.data.label ?? null,
      },
      select: { id: true },
    });
    revalidatePath(`/dashboard/packages/${parsed.data.package_id}`);
    return { success: true, data: { id: record.id } };
  } catch {
    return { success: false, error: "Failed to save gallery image" };
  }
}

export async function removeGalleryImageAction(
  packageId: number,
  position: number
): Promise<ActionResult<void>> {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    await db.package_gallery.deleteMany({
      where: { package_id: packageId, position },
    });
    revalidatePath(`/dashboard/packages/${packageId}`);
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Failed to remove gallery image" };
  }
}
