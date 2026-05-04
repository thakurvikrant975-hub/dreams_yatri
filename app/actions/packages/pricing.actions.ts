"use server";

import { revalidatePath } from "next/cache";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { pricingService, type PricingCalculationInput } from "@/app/services/pricing.service";
import {
  SetPricingSchema,
  BulkSetPricingSchema,
  UpsertCabOptionSchema,
} from "@/app/lib/validators/packages";
import type { ActionResult } from "@/app/types/packages";
import type { PackagePriceBreakdown } from "@/app/types/packages";

// ── Auth guard ────────────────────────────────────────────────────────────────

async function requireAuth(): Promise<ActionResult<never> | null> {
  const session = await dashboardAuth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }
  return null;
}

// ── calculatePriceAction ──────────────────────────────────────────────────────
// No auth needed — called by public-facing pricing preview too.

export async function calculatePriceAction(
  input: PricingCalculationInput
): Promise<ActionResult<PackagePriceBreakdown>> {
  const result = await pricingService.calculatePackagePrice(input);
  if (!result.success) {
    return { success: false, error: result.error.message };
  }
  return { success: true, data: result.data };
}

// ── setPricingAction ──────────────────────────────────────────────────────────

export async function setPricingAction(
  data: unknown
): Promise<ActionResult<void>> {
  const authError = await requireAuth();
  if (authError) return authError;

  const parsed = SetPricingSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await pricingService.setPricing(parsed.data);
  if (!result.success) {
    return { success: false, error: result.error.message };
  }

  revalidatePath(`/dashboard/packages/${parsed.data.package_id}/pricing`);
  return { success: true, data: undefined };
}

// ── bulkSetPricingAction ──────────────────────────────────────────────────────

export async function bulkSetPricingAction(
  data: unknown
): Promise<ActionResult<void>> {
  const authError = await requireAuth();
  if (authError) return authError;

  const parsed = BulkSetPricingSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await pricingService.bulkSetPricing(parsed.data);
  if (!result.success) {
    return { success: false, error: result.error.message };
  }

  revalidatePath(`/dashboard/packages/${parsed.data.package_id}/pricing`);
  return { success: true, data: undefined };
}

// ── upsertCabOptionAction ─────────────────────────────────────────────────────

export async function upsertCabOptionAction(
  data: unknown
): Promise<ActionResult<void>> {
  const authError = await requireAuth();
  if (authError) return authError;

  const parsed = UpsertCabOptionSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await pricingService.upsertCabOption(parsed.data);
  if (!result.success) {
    return { success: false, error: result.error.message };
  }

  revalidatePath(`/dashboard/packages/${parsed.data.package_id}/pricing`);
  return { success: true, data: undefined };
}
