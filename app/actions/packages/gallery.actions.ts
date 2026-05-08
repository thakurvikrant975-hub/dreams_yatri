"use server";

import { revalidatePath } from "next/cache";
import {
  getPackageGallery,
  getPackageSourceImages,
  upsertGallerySlot,
  clearGallerySlot,
  updateGallerySlotLabel,
  type GallerySlot,
  type GallerySourceImages,
} from "@/app/services/gallery.service";

export async function handleGetPackageGallery(packageId: number) {
  try {
    const data = await getPackageGallery(packageId);
    return { success: true as const, data };
  } catch {
    return { success: false as const, message: "Failed to load gallery" };
  }
}

export async function handleGetSourceImages(packageId: number) {
  try {
    const data = await getPackageSourceImages(packageId);
    return { success: true as const, data };
  } catch {
    return { success: false as const, message: "Failed to load source images" };
  }
}

export async function handleUpsertGallerySlot(
  packageId: number,
  position: number,
  imageUrl: string,
  sourceType: GallerySlot["source_type"],
  sourceId: number | null,
) {
  try {
    await upsertGallerySlot(packageId, position, imageUrl, sourceType, sourceId);
    revalidatePath(`/dashboard/packages/${packageId}`);
    return { success: true as const };
  } catch {
    return { success: false as const, message: "Failed to save gallery slot" };
  }
}

export async function handleClearGallerySlot(packageId: number, position: number) {
  try {
    await clearGallerySlot(packageId, position);
    revalidatePath(`/dashboard/packages/${packageId}`);
    return { success: true as const };
  } catch {
    return { success: false as const, message: "Failed to clear gallery slot" };
  }
}

export async function handleUpdateGallerySlotLabel(packageId: number, position: number, label: string) {
  try {
    await updateGallerySlotLabel(packageId, position, label);
    revalidatePath(`/dashboard/packages/${packageId}`);
    return { success: true as const };
  } catch {
    return { success: false as const, message: "Failed to update label" };
  }
}
