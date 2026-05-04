"use server";

import { revalidatePath } from "next/cache";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { packageService, type ListPackagesInput } from "@/app/services/package.service";
import {
  CreatePackageSchema,
  UpdatePackageSchema,
  CreateDurationSchema,
  UpdateDurationSchema,
  CreateStayCategorySchema,
  UpdateStayCategorySchema,
  CreateRouteSchema,
  UpdateRouteSchema,
  ReorderStopsSchema,
} from "@/app/lib/validators/packages";
import type { ActionResult, PackageListItem, PackageWithRelations } from "@/app/types/packages";
import type { PaginatedResult } from "@/app/types/common.types";

// ── Auth guard ────────────────────────────────────────────────────────────────

async function requireAuth(): Promise<ActionResult<never> | null> {
  const session = await dashboardAuth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }
  return null;
}

const LIST_PATH = "/dashboard/packages";

function packagePath(id: number): string {
  return `/dashboard/packages/${id}`;
}

// ── Package CRUD ──────────────────────────────────────────────────────────────

export async function listPackagesAction(
  params: ListPackagesInput = {}
): Promise<ActionResult<PaginatedResult<PackageListItem>>> {
  const result = await packageService.listPackages(params);
  return { success: true, data: result };
}

export async function getPackageByIdAction(
  id: number
): Promise<ActionResult<PackageWithRelations>> {
  const result = await packageService.getPackageById(id);
  if (!result.success) {
    return { success: false, error: result.error.message };
  }
  return { success: true, data: result.data };
}

export async function createPackageAction(
  data: unknown
): Promise<ActionResult<{ id: number }>> {
  const authError = await requireAuth();
  if (authError) return authError;

  const parsed = CreatePackageSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await packageService.createPackage(parsed.data);
  if (!result.success) {
    return { success: false, error: result.error.message };
  }

  revalidatePath(LIST_PATH);
  return { success: true, data: result.data };
}

export async function updatePackageAction(
  id: number,
  data: unknown
): Promise<ActionResult<void>> {
  const authError = await requireAuth();
  if (authError) return authError;

  const parsed = UpdatePackageSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await packageService.updatePackage(id, parsed.data);
  if (!result.success) {
    return { success: false, error: result.error.message };
  }

  revalidatePath(LIST_PATH);
  revalidatePath(packagePath(id));
  return { success: true, data: undefined };
}

// ── Duration actions ──────────────────────────────────────────────────────────

export async function createDurationAction(
  data: unknown
): Promise<ActionResult<{ id: number }>> {
  const authError = await requireAuth();
  if (authError) return authError;

  const parsed = CreateDurationSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await packageService.createDuration(parsed.data);
  if (!result.success) {
    return { success: false, error: result.error.message };
  }

  revalidatePath(packagePath(parsed.data.package_id));
  return { success: true, data: result.data };
}

export async function updateDurationAction(
  id: number,
  packageId: number,
  data: unknown
): Promise<ActionResult<void>> {
  const authError = await requireAuth();
  if (authError) return authError;

  const parsed = UpdateDurationSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await packageService.updateDuration(id, parsed.data);
  if (!result.success) {
    return { success: false, error: result.error.message };
  }

  revalidatePath(packagePath(packageId));
  return { success: true, data: undefined };
}

export async function deleteDurationAction(
  id: number,
  packageId: number
): Promise<ActionResult<void>> {
  const authError = await requireAuth();
  if (authError) return authError;

  const result = await packageService.deleteDuration(id);
  if (!result.success) {
    return { success: false, error: result.error.message };
  }

  revalidatePath(packagePath(packageId));
  return { success: true, data: undefined };
}

// ── Stay category actions ─────────────────────────────────────────────────────

export async function createStayCategoryAction(
  data: unknown
): Promise<ActionResult<{ id: number }>> {
  const authError = await requireAuth();
  if (authError) return authError;

  const parsed = CreateStayCategorySchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await packageService.createStayCategory(parsed.data);
  if (!result.success) {
    return { success: false, error: result.error.message };
  }

  revalidatePath(packagePath(parsed.data.package_id));
  return { success: true, data: result.data };
}

export async function updateStayCategoryAction(
  id: number,
  packageId: number,
  data: unknown
): Promise<ActionResult<void>> {
  const authError = await requireAuth();
  if (authError) return authError;

  const parsed = UpdateStayCategorySchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await packageService.updateStayCategory(id, parsed.data);
  if (!result.success) {
    return { success: false, error: result.error.message };
  }

  revalidatePath(packagePath(packageId));
  return { success: true, data: undefined };
}

// ── Route actions ─────────────────────────────────────────────────────────────

export async function createRouteAction(
  packageId: number,
  data: unknown
): Promise<ActionResult<{ id: number }>> {
  const authError = await requireAuth();
  if (authError) return authError;

  const parsed = CreateRouteSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await packageService.createRoute(parsed.data);
  if (!result.success) {
    return { success: false, error: result.error.message };
  }

  revalidatePath(`${packagePath(packageId)}/routes`);
  return { success: true, data: result.data };
}

export async function updateRouteAction(
  id: number,
  packageId: number,
  data: unknown
): Promise<ActionResult<void>> {
  const authError = await requireAuth();
  if (authError) return authError;

  const parsed = UpdateRouteSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await packageService.updateRoute(id, parsed.data);
  if (!result.success) {
    return { success: false, error: result.error.message };
  }

  revalidatePath(`${packagePath(packageId)}/routes`);
  revalidatePath(`${packagePath(packageId)}/routes/${id}`);
  return { success: true, data: undefined };
}

export async function deleteRouteAction(
  id: number,
  packageId: number
): Promise<ActionResult<void>> {
  const authError = await requireAuth();
  if (authError) return authError;

  const result = await packageService.deleteRoute(id);
  if (!result.success) {
    return { success: false, error: result.error.message };
  }

  revalidatePath(`${packagePath(packageId)}/routes`);
  return { success: true, data: undefined };
}

export async function reorderStopsAction(
  packageId: number,
  data: unknown
): Promise<ActionResult<void>> {
  const authError = await requireAuth();
  if (authError) return authError;

  const parsed = ReorderStopsSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await packageService.reorderStops(parsed.data);
  if (!result.success) {
    return { success: false, error: result.error.message };
  }

  revalidatePath(`${packagePath(packageId)}/routes`);
  return { success: true, data: undefined };
}

// ── Utility actions ───────────────────────────────────────────────────────────

export async function getDestinationsForSelectAction() {
  return packageService.getDestinationsForSelect();
}

export async function getPoliciesAction() {
  return packageService.getPolicies();
}

export async function getPackagePoliciesAction(packageId: number) {
  return packageService.getPackagePolicies(packageId);
}

export async function setPackagePoliciesAction(
  packageId: number,
  policyIds: number[]
): Promise<ActionResult<void>> {
  const authError = await requireAuth();
  if (authError) return authError;

  const result = await packageService.setPackagePolicies(packageId, policyIds);
  if (!result.success) {
    return { success: false, error: result.error.message };
  }

  revalidatePath(packagePath(packageId));
  return { success: true, data: undefined };
}

export async function getRoomPricingForStayCategoryAction(
  packageId: number,
  stayCategories: number[]
) {
  return packageService.getRoomPricingForStayCategories(packageId, stayCategories);
}

export async function getActivitiesForPackageAction(destinationId: number) {
  return packageService.getActivitiesForDestination(destinationId);
}
