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
  updateStayActiveMeals,
  reorderDayItems,
  searchActivities,
  searchRoomPricings,
  getRoomPricingById,
  getActivityVariants,
  getStayCategories,
  createStayCategory,
  updateStayCategory,
  deleteStayCategory,
  reorderStayCategories,
  getVehicles,
  addItineraryAttraction,
  bulkAddItineraryAttractions,
  updateItineraryAttraction,
  deleteItineraryAttraction,
  reorderItineraryAttractions,
  getDaySourceImages,
  checkItineraryDaysHaveContent,
  getHotelMealPricings,
  type TransferInput,
  type NoteInput,
  type ReorderItem,
  type StayCategoryInput,
  type HotelMealOption,
} from "@/app/services/itinerary-builder.service";

function p(packageId: number) {
  return `/dashboard/packages/${packageId}`;
}

export async function handleGetItineraryData(packageId: number, durationId: number, routeId: number) {
  try {
    const data = await getItineraryData(packageId, durationId, routeId);
    return { success: true as const, data };
  } catch (e) {
    console.error(e);
    return { success: false as const, message: "Failed to load itinerary data" };
  }
}

export async function handleUpsertDayMeta(
  packageId: number,
  durationId: number,
  routeId: number,
  day: number,
  data: { title: string; description?: string | null; meals?: string[]; excluded_meals?: string[] },
) {
  if (!Number.isInteger(day) || day < 1) return { success: false as const, message: "Invalid day number" };
  if (!data.title?.trim()) return { success: false as const, message: "Day title is required" };
  try {
    const result = await upsertDayMeta(packageId, durationId, routeId, day, data);
    revalidatePath(p(packageId));
    return { success: true as const, data: { id: result.id } };
  } catch (e) {
    console.error(e);
    return { success: false as const, message: "Failed to save day" };
  }
}

export async function handleGetActivityVariants(activityId: number) {
  try {
    const data = await getActivityVariants(activityId);
    return { success: true as const, data };
  } catch (e) {
    console.error(e);
    return { success: false as const, data: [] as Awaited<ReturnType<typeof getActivityVariants>>, message: "Failed to load variants" };
  }
}

export async function handleAddActivity(
  itineraryId: number,
  activityId: number,
  isOptional: boolean,
  packageId: number,
  variantId?: number | null,
) {
  try {
    await addItineraryActivity(itineraryId, activityId, isOptional, variantId);
    revalidatePath(p(packageId));
    return { success: true as const };
  } catch (e) {
    console.error(e);
    return { success: false as const, message: "Failed to add activity" };
  }
}

export async function handleUpdateActivity(
  id: number,
  data: { is_optional?: boolean; sort_order?: number; variant_id?: number | null },
  packageId: number,
) {
  try {
    await updateItineraryActivity(id, data);
    revalidatePath(p(packageId));
    return { success: true as const };
  } catch (e) {
    console.error(e);
    return { success: false as const, message: "Failed to update activity" };
  }
}

export async function handleDeleteActivity(id: number, packageId: number) {
  try {
    await deleteItineraryActivity(id);
    revalidatePath(p(packageId));
    return { success: true as const };
  } catch (e) {
    console.error(e);
    return { success: false as const, message: "Failed to delete activity" };
  }
}

export async function handleAddTransfer(itineraryId: number, data: TransferInput, packageId: number) {
  try {
    await addItineraryTransfer(itineraryId, data);
    revalidatePath(p(packageId));
    return { success: true as const };
  } catch (e) {
    console.error(e);
    return { success: false as const, message: "Failed to add transfer" };
  }
}

export async function handleUpdateTransfer(id: number, data: TransferInput, packageId: number) {
  try {
    await updateItineraryTransfer(id, data);
    revalidatePath(p(packageId));
    return { success: true as const };
  } catch (e) {
    console.error(e);
    return { success: false as const, message: "Failed to update transfer" };
  }
}

export async function handleDeleteTransfer(id: number, packageId: number) {
  try {
    await deleteItineraryTransfer(id);
    revalidatePath(p(packageId));
    return { success: true as const };
  } catch (e) {
    console.error(e);
    return { success: false as const, message: "Failed to delete transfer" };
  }
}

export async function handleAddNote(itineraryId: number, data: NoteInput, packageId: number) {
  try {
    await addItineraryNote(itineraryId, data);
    revalidatePath(p(packageId));
    return { success: true as const };
  } catch (e) {
    console.error(e);
    return { success: false as const, message: "Failed to add note" };
  }
}

export async function handleUpdateNote(id: number, data: NoteInput, packageId: number) {
  try {
    await updateItineraryNote(id, data);
    revalidatePath(p(packageId));
    return { success: true as const };
  } catch (e) {
    console.error(e);
    return { success: false as const, message: "Failed to update note" };
  }
}

export async function handleDeleteNote(id: number, packageId: number) {
  try {
    await deleteItineraryNote(id);
    revalidatePath(p(packageId));
    return { success: true as const };
  } catch (e) {
    console.error(e);
    return { success: false as const, message: "Failed to delete note" };
  }
}

export async function handleUpsertStay(
  itineraryId: number,
  stayCategoryId: number,
  roomPricingId: number,
  sortOrder: number,
  packageId: number,
  numNights: number = 1,
) {
  try {
    const result = await upsertItineraryStay(itineraryId, stayCategoryId, roomPricingId, sortOrder, numNights);
    revalidatePath(p(packageId));
    return { success: true as const, id: result.id, active_meals: result.active_meals };
  } catch (e) {
    console.error(e);
    return { success: false as const, message: "Failed to save stay" };
  }
}

export async function handleDeleteStay(id: number, packageId: number) {
  try {
    await deleteItineraryStay(id);
    revalidatePath(p(packageId));
    return { success: true as const };
  } catch (e) {
    console.error(e);
    return { success: false as const, message: "Failed to remove stay" };
  }
}

export async function handleUpdateStayActiveMeals(id: number, activeMeals: string[], packageId: number) {
  try {
    await updateStayActiveMeals(id, activeMeals);
    // No revalidatePath — meal toggles are managed in client state.
    // revalidatePath would trigger an RSC re-render that remounts the sidebar
    // and reinitializes localPrevStays from stale props, breaking optimistic updates.
    void packageId;
    return { success: true as const };
  } catch (e) {
    console.error(e);
    return { success: false as const, message: "Failed to update meals" };
  }
}

export async function handleReorderItems(updates: ReorderItem[], packageId: number) {
  try {
    await reorderDayItems(updates);
    revalidatePath(p(packageId));
    return { success: true as const };
  } catch (e) {
    console.error(e);
    return { success: false as const, message: "Failed to reorder" };
  }
}

export async function handleGetVehicles() {
  try {
    const data = await getVehicles();
    return { success: true as const, data };
  } catch (e) {
    console.error(e);
    return { success: false as const, data: [] as Awaited<ReturnType<typeof getVehicles>>, message: "Failed to load vehicles" };
  }
}

export async function handleSearchActivities(destinationId: number, query: string) {
  try {
    const data = await searchActivities(destinationId, query);
    return { success: true as const, data };
  } catch (e) {
    console.error(e);
    return { success: false as const, data: { items: [], has_more: false }, message: "Search failed" };
  }
}

export async function handleSearchRoomPricings(
  destinationId: number,
  query: string,
  itineraryId?: number,
  stayBlockOrder?: number,
  stopIndex?: number,
) {
  try {
    const data = await searchRoomPricings(destinationId, query, itineraryId, stayBlockOrder, stopIndex);
    return { success: true as const, data };
  } catch (e) {
    console.error(e);
    return { success: false as const, data: { items: [], has_more: false }, message: "Search failed" };
  }
}

export async function handleGetRoomPricingById(id: number) {
  try {
    const data = await getRoomPricingById(id);
    return { success: true as const, data };
  } catch (e) {
    console.error(e);
    return { success: false as const, data: null, message: "Failed to load room pricing" };
  }
}

// ── Stay category CRUD ─────────────────────────────────────────────────────

export async function handleGetStayCategories(packageId: number) {
  try {
    const data = await getStayCategories(packageId);
    return { success: true as const, data };
  } catch (e) {
    console.error(e);
    return { success: false as const, message: "Failed to load stay categories" };
  }
}

export async function handleCreateStayCategory(packageId: number, data: StayCategoryInput) {
  try {
    const result = await createStayCategory(packageId, data);
    revalidatePath(p(packageId));
    return { success: true as const, data: result };
  } catch (e) {
    console.error(e);
    return { success: false as const, message: "Failed to create tier" };
  }
}

export async function handleUpdateStayCategory(id: number, data: StayCategoryInput, packageId: number) {
  try {
    const result = await updateStayCategory(id, data);
    revalidatePath(p(packageId));
    return { success: true as const, data: result };
  } catch (e) {
    console.error(e);
    return { success: false as const, message: "Failed to update tier" };
  }
}

export async function handleDeleteStayCategory(id: number, packageId: number) {
  try {
    await deleteStayCategory(id);
    revalidatePath(p(packageId));
    return { success: true as const };
  } catch (e) {
    console.error(e);
    return { success: false as const, message: "Cannot delete — this tier is in use by an itinerary" };
  }
}

export async function handleReorderStayCategories(
  updates: { id: number; sort_order: number }[],
  packageId: number,
) {
  try {
    await reorderStayCategories(updates);
    revalidatePath(p(packageId));
    return { success: true as const };
  } catch (e) {
    console.error(e);
    return { success: false as const, message: "Failed to reorder" };
  }
}

// ── Day source images ──────────────────────────────────────────────────────

export async function handleGetDaySourceImages(itineraryId: number, packageId: number) {
  try {
    const data = await getDaySourceImages(itineraryId, packageId);
    return { success: true as const, data };
  } catch (e) {
    console.error(e);
    return { success: false as const, message: "Failed to load images" };
  }
}

// ── Attraction CRUD ────────────────────────────────────────────────────────

export async function handleAddAttraction(
  itineraryId: number,
  imageKey: string,
  caption: string,
  packageId: number,
) {
  try {
    const data = await addItineraryAttraction(itineraryId, imageKey, caption);
    revalidatePath(p(packageId));
    return { success: true as const, data };
  } catch (e) {
    console.error(e);
    return { success: false as const, message: "Failed to add attraction" };
  }
}

export async function handleBulkAddAttractions(
  itineraryId: number,
  imageKeys: string[],
  packageId: number,
) {
  try {
    const data = await bulkAddItineraryAttractions(itineraryId, imageKeys);
    revalidatePath(p(packageId));
    return { success: true as const, data };
  } catch (e) {
    console.error(e);
    return { success: false as const, message: "Failed to add attractions" };
  }
}

export async function handleUpdateAttraction(id: number, caption: string, packageId: number) {
  try {
    await updateItineraryAttraction(id, caption);
    revalidatePath(p(packageId));
    return { success: true as const };
  } catch (e) {
    console.error(e);
    return { success: false as const, message: "Failed to update attraction" };
  }
}

export async function handleDeleteAttraction(id: number, packageId: number) {
  try {
    await deleteItineraryAttraction(id);
    revalidatePath(p(packageId));
    return { success: true as const };
  } catch (e) {
    console.error(e);
    return { success: false as const, message: "Failed to delete attraction" };
  }
}

export async function handleReorderAttractions(
  updates: { id: number; sort_order: number }[],
  packageId: number,
) {
  try {
    await reorderItineraryAttractions(updates);
    revalidatePath(p(packageId));
    return { success: true as const };
  } catch (e) {
    console.error(e);
    return { success: false as const, message: "Failed to reorder attractions" };
  }
}

export async function handleCheckItineraryDaysContent(
  packageId: number,
  routeId: number,
  durationId: number,
  fromDay: number,
  toDay: number,
) {
  try {
    const hasContent = await checkItineraryDaysHaveContent(packageId, routeId, durationId, fromDay, toDay);
    return { success: true as const, hasContent };
  } catch (e) {
    console.error(e);
    return { success: false as const, message: "Failed to check days" };
  }
}

export async function handleGetHotelMealPricings(hotelId: number) {
  try {
    const data = await getHotelMealPricings(hotelId);
    return { success: true as const, data };
  } catch (e) {
    console.error(e);
    return { success: false as const, data: [] as HotelMealOption[], message: "Failed to load meal pricings" };
  }
}
