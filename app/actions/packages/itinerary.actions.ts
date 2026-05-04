"use server";

import { revalidatePath } from "next/cache";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { itineraryService } from "@/app/services/itinerary.service";
import {
  UpsertItineraryDaySchema,
  FullDayItinerarySchema,
  AddStaySchema,
  AddActivitySchema,
  AddTransferSchema,
  AddNoteSchema,
  ReorderTimelineSchema,
} from "@/app/lib/validators/packages";
import type { ActionResult, ItineraryGrid } from "@/app/types/packages";
import type { ItineraryValidationResult } from "@/app/services/itinerary.service";

// ── Auth guard ────────────────────────────────────────────────────────────────

async function requireAuth(): Promise<ActionResult<never> | null> {
  const session = await dashboardAuth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }
  return null;
}

function itineraryPath(packageId: number, durationId?: number): string {
  const base = `/dashboard/packages/${packageId}/itineraries`;
  return durationId ? `${base}?duration=${durationId}` : base;
}

// ── generateDaysAction ────────────────────────────────────────────────────────
// Auto-creates placeholder day records from route stops.

export async function generateDaysAction(
  packageId: number,
  durationId: number,
  routeId: number
): Promise<ActionResult<{ created: number; skipped: number }>> {
  const authError = await requireAuth();
  if (authError) return authError;

  const result = await itineraryService.generateDays(packageId, durationId, routeId);
  if (!result.success) {
    return { success: false, error: result.error.message };
  }

  revalidatePath(itineraryPath(packageId, durationId));
  return { success: true, data: result.data };
}

// ── getItineraryGridAction ────────────────────────────────────────────────────

export async function getItineraryGridAction(
  packageId: number,
  durationId: number,
  routeId: number
): Promise<ActionResult<ItineraryGrid>> {
  const result = await itineraryService.getGrid(packageId, durationId, routeId);
  if (!result.success) {
    return { success: false, error: result.error.message };
  }
  return { success: true, data: result.data };
}

// ── upsertDayAction ───────────────────────────────────────────────────────────
// Creates or updates a single day header (title + description).

export async function upsertDayAction(
  data: unknown
): Promise<ActionResult<{ id: number }>> {
  const authError = await requireAuth();
  if (authError) return authError;

  const parsed = UpsertItineraryDaySchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await itineraryService.upsertDay(parsed.data);
  if (!result.success) {
    return { success: false, error: result.error.message };
  }

  revalidatePath(itineraryPath(parsed.data.package_id, parsed.data.duration_id));
  return { success: true, data: result.data };
}

// ── saveDayAction ─────────────────────────────────────────────────────────────
// Atomically saves a complete day: header + stays + activities + transfers + notes.

export async function saveDayAction(
  data: unknown
): Promise<ActionResult<{ id: number }>> {
  const authError = await requireAuth();
  if (authError) return authError;

  const parsed = FullDayItinerarySchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await itineraryService.saveFullDay(parsed.data);
  if (!result.success) {
    return { success: false, error: result.error.message };
  }

  revalidatePath(itineraryPath(parsed.data.package_id, parsed.data.duration_id));
  return { success: true, data: result.data };
}

// ── validateItineraryAction ───────────────────────────────────────────────────

export async function validateItineraryAction(
  packageId: number,
  durationId: number,
  routeId: number
): Promise<ActionResult<ItineraryValidationResult>> {
  const result = await itineraryService.validateItinerary(packageId, durationId, routeId);
  if (!result.success) {
    return { success: false, error: result.error.message };
  }
  return { success: true, data: result.data };
}

// ── addStayAction ─────────────────────────────────────────────────────────────

export async function addStayAction(
  data: unknown
): Promise<ActionResult<{ id: number }>> {
  const authError = await requireAuth();
  if (authError) return authError;

  const parsed = AddStaySchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await itineraryService.addStay(parsed.data);
  if (!result.success) {
    return { success: false, error: result.error.message };
  }

  return { success: true, data: result.data };
}

// ── addActivityAction ─────────────────────────────────────────────────────────

export async function addActivityAction(
  data: unknown
): Promise<ActionResult<{ id: number }>> {
  const authError = await requireAuth();
  if (authError) return authError;

  const parsed = AddActivitySchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await itineraryService.addActivity(parsed.data);
  if (!result.success) {
    return { success: false, error: result.error.message };
  }

  return { success: true, data: result.data };
}

// ── addTransferAction ─────────────────────────────────────────────────────────

export async function addTransferAction(
  data: unknown
): Promise<ActionResult<{ id: number }>> {
  const authError = await requireAuth();
  if (authError) return authError;

  const parsed = AddTransferSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await itineraryService.addTransfer(parsed.data);
  if (!result.success) {
    return { success: false, error: result.error.message };
  }

  return { success: true, data: result.data };
}

// ── addNoteAction ─────────────────────────────────────────────────────────────

export async function addNoteAction(
  data: unknown
): Promise<ActionResult<{ id: number }>> {
  const authError = await requireAuth();
  if (authError) return authError;

  const parsed = AddNoteSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await itineraryService.addNote(parsed.data);
  if (!result.success) {
    return { success: false, error: result.error.message };
  }

  return { success: true, data: result.data };
}

// ── removeStayAction ──────────────────────────────────────────────────────────

export async function removeStayAction(stayId: number): Promise<ActionResult<void>> {
  const authError = await requireAuth();
  if (authError) return authError;

  const result = await itineraryService.removeStay(stayId);
  if (!result.success) {
    return { success: false, error: result.error.message };
  }

  return { success: true, data: undefined };
}

// ── removeActivityAction ──────────────────────────────────────────────────────

export async function removeActivityAction(activityId: number): Promise<ActionResult<void>> {
  const authError = await requireAuth();
  if (authError) return authError;

  const result = await itineraryService.removeActivity(activityId);
  if (!result.success) {
    return { success: false, error: result.error.message };
  }

  return { success: true, data: undefined };
}

// ── removeTransferAction ──────────────────────────────────────────────────────

export async function removeTransferAction(transferId: number): Promise<ActionResult<void>> {
  const authError = await requireAuth();
  if (authError) return authError;

  const result = await itineraryService.removeTransfer(transferId);
  if (!result.success) {
    return { success: false, error: result.error.message };
  }

  return { success: true, data: undefined };
}

// ── removeNoteAction ──────────────────────────────────────────────────────────

export async function removeNoteAction(noteId: number): Promise<ActionResult<void>> {
  const authError = await requireAuth();
  if (authError) return authError;

  const result = await itineraryService.removeNote(noteId);
  if (!result.success) {
    return { success: false, error: result.error.message };
  }

  return { success: true, data: undefined };
}

// ── reorderTimelineAction ─────────────────────────────────────────────────────
// Accepts the full ordered list for a day and batch-updates sort_order.
// Optimistic UI calls this after every successful drag — no revalidation needed
// since the client already holds the new order.

export async function reorderTimelineAction(
  data: unknown
): Promise<ActionResult<void>> {
  const authError = await requireAuth();
  if (authError) return authError;

  const parsed = ReorderTimelineSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await itineraryService.reorderTimeline(parsed.data);
  if (!result.success) {
    return { success: false, error: result.error.message };
  }

  return { success: true, data: undefined };
}
