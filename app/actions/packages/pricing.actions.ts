"use server";

import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";
import {
  computePackagePrice,
  type PricingInput,
} from "@/app/services/package-pricing.service";

export async function handleGetPackagePricings(packageId: number) {
  try {
    const data = await db.package_pricing.findMany({
      where: { package_id: packageId },
      select: {
        id: true,
        duration_id: true,
        stay_category_id: true,
        margin_percentage: true,
        gst_percentage: true,
      },
    });
    return {
      success: true as const,
      data: data.map((p) => ({
        id: p.id,
        duration_id: p.duration_id,
        stay_category_id: p.stay_category_id,
        margin_percentage: Number(p.margin_percentage),
        gst_percentage: Number(p.gst_percentage),
      })),
    };
  } catch {
    return { success: false as const, error: "Failed to load pricing configurations" };
  }
}

export async function handleUpsertPackagePricing(input: {
  package_id: number;
  duration_id: number;
  stay_category_id: number;
  margin_percentage: number;
  gst_percentage: number;
}) {
  try {
    await db.package_pricing.upsert({
      where: {
        package_id_duration_id_stay_category_id: {
          package_id: input.package_id,
          duration_id: input.duration_id,
          stay_category_id: input.stay_category_id,
        },
      },
      create: input,
      update: {
        margin_percentage: input.margin_percentage,
        gst_percentage: input.gst_percentage,
      },
    });
    revalidatePath(`/dashboard/packages/${input.package_id}`);
    return { success: true as const };
  } catch {
    return { success: false as const, error: "Failed to save pricing configuration" };
  }
}

export async function handleComputePackagePrice(input: PricingInput) {
  try {
    const data = await computePackagePrice(input);
    return { success: true as const, data };
  } catch (err) {
    console.error("[computePackagePrice]", err);
    return { success: false as const, error: "Failed to compute package price" };
  }
}
