"use server";

import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";

// ── Read ──────────────────────────────────────────────────────────────────

export async function getPackageForBuilder(id: number) {
  return db.packages.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      slug: true,
      thumbnail: true,
      description: true,
      destination_id: true,
      inclusions: true,
      exclusions: true,
      is_active: true,
      created_at: true,
      destination: { select: { name: true } },
      tags: { include: { tag: { select: { name: true } } } },
      categories: { include: { category: { select: { name: true } } } },
      images: {
        orderBy: { sort_order: "asc" },
        select: { id: true, url: true, thumbnail: true, sort_order: true, is_primary: true },
      },
      durations: {
        orderBy: { days: "asc" },
        include: {
          routes: {
            orderBy: { sort_order: "asc" },
            include: { stops: { orderBy: { sort_order: "asc" } } },
          },
        },
      },
    },
  });
}

export async function getPackages() {
  return db.packages.findMany({
    orderBy: { created_at: "desc" },
    include: {
      destination: {
        select: {
          id: true,
          name: true,
          region: { select: { name: true } },
        },
      },
      _count: {
        select: {
          durations: true,
          packageRoutes: true,
          gallery: true,
        },
      },
    },
  });
}

// ── Toggle Active ─────────────────────────────────────────────────────────

export async function togglePackageActive(id: number, is_active: boolean) {
  await db.packages.update({ where: { id }, data: { is_active } });
  revalidatePath("/dashboard/packages");
}

// ── Delete Package ────────────────────────────────────────────────────────

export async function deletePackage(id: number): Promise<{ success: boolean; message: string }> {
  try {
    const pkg = await db.packages.findUnique({
      where: { id },
      include: { bookings: { select: { id: true }, take: 1 } },
    });

    if (!pkg) return { success: false, message: "Package not found" };
    if (pkg.bookings.length > 0) {
      return { success: false, message: "Cannot delete — package has active bookings" };
    }

    await db.$transaction([
      // itinerary_stays has no cascade from package_itineraries — delete first
      db.itinerary_stays.deleteMany({ where: { itinerary: { package_id: id } } }),
      // package_itineraries cascades: itinerary_activities, itinerary_transfers, itinerary_notes
      db.package_itineraries.deleteMany({ where: { package_id: id } }),
      // package_pricing references both durations and stay_categories — delete before both
      db.package_pricing.deleteMany({ where: { package_id: id } }),
      // package_durations cascades: package_routes (onDelete: Cascade on duration_id)
      db.package_durations.deleteMany({ where: { package_id: id } }),
      // simple M2M / child tables
      db.package_tags.deleteMany({ where: { package_id: id } }),
      db.package_categories.deleteMany({ where: { package_id: id } }),
      db.package_policy_map.deleteMany({ where: { package_id: id } }),
      // stay_categories must come after itinerary_stays
      db.package_stay_categories.deleteMany({ where: { package_id: id } }),
      db.package_cab_options.deleteMany({ where: { package_id: id } }),
      db.package_gallery.deleteMany({ where: { package_id: id } }),
      db.package_images.deleteMany({ where: { package_id: id } }),
      db.packages.delete({ where: { id } }),
    ]);

    revalidatePath("/dashboard/packages");
    return { success: true, message: "Package deleted" };
  } catch {
    return { success: false, message: "Database error. Please try again." };
  }
}
