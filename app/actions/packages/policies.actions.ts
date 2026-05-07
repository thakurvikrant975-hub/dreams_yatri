"use server";

import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";

export async function searchPoliciesByType(type: string, query: string) {
  try {
    const list = await db.policies.findMany({
      where: {
        type: type as never,
        is_active: true,
        ...(query ? { title: { contains: query, mode: "insensitive" as const } } : {}),
      },
      select: { id: true, title: true, points: true },
      orderBy: [{ sort_order: "asc" }, { title: "asc" }],
      take: 20,
    });
    return { success: true as const, data: list };
  } catch {
    return { success: false as const, data: [] as { id: number; title: string; points: string[] }[], message: "Search failed" };
  }
}

export async function setPackagePolicy(packageId: number, type: string, policyId: number) {
  try {
    // Find all existing policies of this type linked to the package
    const existing = await db.package_policy_map.findMany({
      where: { package_id: packageId, policy: { type: type as never } },
      select: { policy_id: true },
    });

    await db.$transaction([
      ...existing.map((e) =>
        db.package_policy_map.delete({
          where: {
            package_id_policy_id: { package_id: packageId, policy_id: e.policy_id },
          },
        }),
      ),
      db.package_policy_map.create({
        data: { package_id: packageId, policy_id: policyId },
      }),
    ]);

    revalidatePath(`/dashboard/packages/${packageId}`);
    return { success: true as const };
  } catch {
    return { success: false as const, message: "Failed to assign policy" };
  }
}

export async function removePackagePolicy(packageId: number, type: string) {
  try {
    const existing = await db.package_policy_map.findMany({
      where: { package_id: packageId, policy: { type: type as never } },
      select: { policy_id: true },
    });

    if (existing.length > 0) {
      await db.$transaction(
        existing.map((e) =>
          db.package_policy_map.delete({
            where: {
              package_id_policy_id: { package_id: packageId, policy_id: e.policy_id },
            },
          }),
        ),
      );
    }

    revalidatePath(`/dashboard/packages/${packageId}`);
    return { success: true as const };
  } catch {
    return { success: false as const, message: "Failed to remove policy" };
  }
}
