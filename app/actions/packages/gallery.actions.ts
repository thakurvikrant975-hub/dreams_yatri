"use server";

import { revalidatePath } from "next/cache";
import {
  getPackageGallery,
  getPackageSourceImages,
  upsertGallerySlot,
  clearGallerySlot,
  updateGallerySlotLabel,
  type GallerySlot,
} from "@/app/services/gallery.service";

export async function handleGetPackageGallery(packageId: number, routeId: number) {
  try {
    const data = await getPackageGallery(packageId, routeId);
    return { success: true as const, data };
  } catch (e) {
    console.error(e);
    return { success: false as const, message: "Failed to load gallery" };
  }
}

export async function handleGetSourceImages(packageId: number) {
  try {
    const data = await getPackageSourceImages(packageId);
    return { success: true as const, data };
  } catch (e) {
    console.error(e);
    return { success: false as const, message: "Failed to load source images" };
  }
}

export async function handleUpsertGallerySlot(
  packageId: number,
  routeId: number,
  position: number,
  imageUrl: string,
  sourceType: GallerySlot["source_type"],
  sourceId: number | null,
) {
  try {
    await upsertGallerySlot(packageId, routeId, position, imageUrl, sourceType, sourceId);
    revalidatePath(`/dashboard/packages/${packageId}`);
    return { success: true as const };
  } catch (e) {
    console.error(e);
    return { success: false as const, message: "Failed to save gallery slot" };
  }
}

export async function handleClearGallerySlot(packageId: number, routeId: number, position: number) {
  try {
    await clearGallerySlot(packageId, routeId, position);
    revalidatePath(`/dashboard/packages/${packageId}`);
    return { success: true as const };
  } catch (e) {
    console.error(e);
    return { success: false as const, message: "Failed to clear gallery slot" };
  }
}

export async function handleUpdateGallerySlotLabel(packageId: number, routeId: number, position: number, label: string) {
  try {
    await updateGallerySlotLabel(packageId, routeId, position, label);
    revalidatePath(`/dashboard/packages/${packageId}`);
    return { success: true as const };
  } catch (e) {
    console.error(e);
    return { success: false as const, message: "Failed to update label" };
  }
}
