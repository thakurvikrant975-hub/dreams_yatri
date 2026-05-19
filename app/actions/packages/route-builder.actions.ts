"use server";

import { revalidatePath } from "next/cache";
import {
  getPackageRouteData,
  upsertRouteVariant,
  deleteRouteVariant,
  updateRouteMeta,
  updateDurationMeta,
  type StopInput,
  type RouteMeta,
  type DurationMeta,
} from "@/app/services/route-builder.service";

export async function handleGetRouteData(packageId: number) {
  try {
    const data = await getPackageRouteData(packageId);
    return { success: true, data };
  } catch (e) {
    console.error(e);
    return { success: false, message: "Failed to load route data" };
  }
}

export async function handleSaveRouteVariant(
  packageId: number,
  stops: StopInput[],
  meta?: RouteMeta,
  durationMeta?: DurationMeta,
  routeId?: number,
) {
  if (stops.length === 0) return { success: false, message: "At least one stop is required" };
  if (stops.some((s) => !s.place_name?.trim())) return { success: false, message: "All stops must have a name" };
  if (stops.some((s) => !Number.isInteger(s.stay_days) || s.stay_days < 1)) return { success: false, message: "Each stop must have at least 1 night" };
  try {
    const result = await upsertRouteVariant(packageId, stops, meta, durationMeta, routeId);
    revalidatePath(`/dashboard/packages/${packageId}`);
    return { success: true, data: result };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Failed to save route" };
  }
}

export async function handleDeleteRouteVariant(routeId: number, packageId: number) {
  try {
    await deleteRouteVariant(routeId);
    revalidatePath(`/dashboard/packages/${packageId}`);
    return { success: true };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Failed to delete route" };
  }
}

export async function handleUpdateRouteMeta(
  routeId: number,
  data: { name?: string; slug?: string; meta_title?: string | null; meta_desc?: string | null },
  packageId: number,
) {
  try {
    await updateRouteMeta(routeId, data);
    revalidatePath(`/dashboard/packages/${packageId}`);
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, message: "Failed to update route" };
  }
}

export async function handleUpdateDurationMeta(
  durationId: number,
  data: {
    is_default?: boolean;
    thumbnail_url?: string | null;
    sort_order?: number;
    is_active?: boolean;
    label?: string;
  },
  packageId: number,
) {
  try {
    await updateDurationMeta(durationId, data);
    revalidatePath(`/dashboard/packages/${packageId}`);
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, message: "Failed to update duration" };
  }
}
