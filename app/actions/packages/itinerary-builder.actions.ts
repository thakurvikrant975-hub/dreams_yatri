"use server";

import { revalidatePath } from "next/cache";
import {
  getItineraryData,
  upsertDayMeta,
  addItineraryActivity,
  updateItineraryActivity,
  deleteItineraryActivity,
  addItineraryTransfer,
  updateItineraryTransfer,
  deleteItineraryTransfer,
  addItineraryNote,
  updateItineraryNote,
  deleteItineraryNote,
  upsertItineraryStay,
  deleteItineraryStay,
  reorderDayItems,
  searchActivities,
  searchRoomPricings,
  type TransferInput,
  type NoteInput,
  type ReorderItem,
} from "@/app/services/itinerary-builder.service";

function p(packageId: number) {
  return `/dashboard/packages/${packageId}`;
}

export async function handleGetItineraryData(packageId: number, durationId: number, routeId: number) {
  try {
    const data = await getItineraryData(packageId, durationId, routeId);
    return { success: true as const, data };
  } catch {
    return { success: false as const, message: "Failed to load itinerary data" };
  }
}

export async function handleUpsertDayMeta(
  packageId: number,
  durationId: number,
  routeId: number,
  day: number,
  data: { title: string; description?: string | null },
) {
  try {
    const result = await upsertDayMeta(packageId, durationId, routeId, day, data);
    revalidatePath(p(packageId));
    return { success: true as const, data: { id: result.id } };
  } catch {
    return { success: false as const, message: "Failed to save day" };
  }
}

export async function handleAddActivity(
  itineraryId: number,
  activityId: number,
  isOptional: boolean,
  packageId: number,
) {
  try {
    await addItineraryActivity(itineraryId, activityId, isOptional);
    revalidatePath(p(packageId));
    return { success: true as const };
  } catch {
    return { success: false as const, message: "Failed to add activity" };
  }
}

export async function handleUpdateActivity(
  id: number,
  data: { is_optional?: boolean; sort_order?: number },
  packageId: number,
) {
  try {
    await updateItineraryActivity(id, data);
    revalidatePath(p(packageId));
    return { success: true as const };
  } catch {
    return { success: false as const, message: "Failed to update activity" };
  }
}

export async function handleDeleteActivity(id: number, packageId: number) {
  try {
    await deleteItineraryActivity(id);
    revalidatePath(p(packageId));
    return { success: true as const };
  } catch {
    return { success: false as const, message: "Failed to delete activity" };
  }
}

export async function handleAddTransfer(itineraryId: number, data: TransferInput, packageId: number) {
  try {
    await addItineraryTransfer(itineraryId, data);
    revalidatePath(p(packageId));
    return { success: true as const };
  } catch {
    return { success: false as const, message: "Failed to add transfer" };
  }
}

export async function handleUpdateTransfer(id: number, data: TransferInput, packageId: number) {
  try {
    await updateItineraryTransfer(id, data);
    revalidatePath(p(packageId));
    return { success: true as const };
  } catch {
    return { success: false as const, message: "Failed to update transfer" };
  }
}

export async function handleDeleteTransfer(id: number, packageId: number) {
  try {
    await deleteItineraryTransfer(id);
    revalidatePath(p(packageId));
    return { success: true as const };
  } catch {
    return { success: false as const, message: "Failed to delete transfer" };
  }
}

export async function handleAddNote(itineraryId: number, data: NoteInput, packageId: number) {
  try {
    await addItineraryNote(itineraryId, data);
    revalidatePath(p(packageId));
    return { success: true as const };
  } catch {
    return { success: false as const, message: "Failed to add note" };
  }
}

export async function handleUpdateNote(id: number, data: NoteInput, packageId: number) {
  try {
    await updateItineraryNote(id, data);
    revalidatePath(p(packageId));
    return { success: true as const };
  } catch {
    return { success: false as const, message: "Failed to update note" };
  }
}

export async function handleDeleteNote(id: number, packageId: number) {
  try {
    await deleteItineraryNote(id);
    revalidatePath(p(packageId));
    return { success: true as const };
  } catch {
    return { success: false as const, message: "Failed to delete note" };
  }
}

export async function handleUpsertStay(
  itineraryId: number,
  stayCategoryId: number,
  roomPricingId: number,
  sortOrder: number,
  packageId: number,
) {
  try {
    await upsertItineraryStay(itineraryId, stayCategoryId, roomPricingId, sortOrder);
    revalidatePath(p(packageId));
    return { success: true as const };
  } catch {
    return { success: false as const, message: "Failed to save stay" };
  }
}

export async function handleDeleteStay(id: number, packageId: number) {
  try {
    await deleteItineraryStay(id);
    revalidatePath(p(packageId));
    return { success: true as const };
  } catch {
    return { success: false as const, message: "Failed to remove stay" };
  }
}

export async function handleReorderItems(updates: ReorderItem[], packageId: number) {
  try {
    await reorderDayItems(updates);
    revalidatePath(p(packageId));
    return { success: true as const };
  } catch {
    return { success: false as const, message: "Failed to reorder" };
  }
}

export async function handleSearchActivities(destinationId: number, query: string) {
  try {
    const data = await searchActivities(destinationId, query);
    return { success: true as const, data };
  } catch {
    return { success: false as const, data: [] as Awaited<ReturnType<typeof searchActivities>>, message: "Search failed" };
  }
}

export async function handleSearchRoomPricings(destinationId: number, query: string) {
  try {
    const data = await searchRoomPricings(destinationId, query);
    return { success: true as const, data };
  } catch {
    return { success: false as const, data: [] as Awaited<ReturnType<typeof searchRoomPricings>>, message: "Search failed" };
  }
}
