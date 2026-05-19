"use server";

import {
  addPackageImages,
  getPackageImages,
  setPrimaryImage,
  reorderImages,
  deleteImage,
} from "@/app/services/package-image.service";
import { revalidatePath } from "next/cache";

export async function handleGetPackageImages(packageId: number) {
  try {
    const data = await getPackageImages(packageId);
    return { success: true, data };
  } catch (e) {
    console.error(e);
    return { success: false, message: "Failed to fetch images" };
  }
}

export async function handleAddImages(packageId: number, imageUrls: string[]) {
  try {
    const res = await addPackageImages(packageId, imageUrls);
    revalidatePath(`/dashboard/packages/${packageId}`);
    return { success: true, data: res };
  } catch (e) {
    console.error(e);
    return { success: false, message: "Failed to add images" };
  }
}

export async function handleSetPrimaryImage(imageId: number, packageId: number) {
  try {
    const res = await setPrimaryImage(imageId, packageId);
    revalidatePath(`/dashboard/packages/${packageId}`);
    return { success: true, data: res };
  } catch (e) {
    console.error(e);
    return { success: false, message: "Failed to set primary image" };
  }
}

export async function handleReorderImages(
  packageId: number,
  updates: { id: number; sort_order: number }[],
) {
  try {
    const res = await reorderImages(updates);
    revalidatePath(`/dashboard/packages/${packageId}`);
    return { success: true, data: res };
  } catch (e) {
    console.error(e);
    return { success: false, message: "Failed to reorder images" };
  }
}

export async function handleDeleteImage(imageId: number, packageId: number) {
  try {
    const res = await deleteImage(imageId);
    revalidatePath(`/dashboard/packages/${packageId}`);
    return { success: true, data: res };
  } catch (e) {
    console.error(e);
    return { success: false, message: "Failed to delete image" };
  }
}
