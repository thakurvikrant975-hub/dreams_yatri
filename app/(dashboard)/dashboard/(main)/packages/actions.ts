"use server";

import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";

// ── Read ──────────────────────────────────────────────────────────────────

export async function getPackageForBuilder(id: number) {
  const pkg = await db.packages.findUnique({
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
      stay_categories: {
        orderBy: { sort_order: "asc" },
        select: {
          id: true, label: true, slug: true, description: true,
          min_duration_days: true, is_default: true, sort_order: true, is_active: true,
        },
      },
      policies: {
        include: {
          policy: { select: { id: true, type: true, title: true } },
        },
      },
      gallery: {
        orderBy: { position: "asc" },
        select: { id: true, position: true, image_url: true, source_type: true, source_id: true, label: true },
      },
      packagePricings: {
        select: {
          id: true,
          duration_id: true,
          stay_category_id: true,
          margin_percentage: true,
          gst_percentage: true,
        },
      },
      cabPricings: {
        orderBy: [{ route_id: "asc" }, { sort_order: "asc" }],
        select: {
          id: true,
          route_id: true,
          vehicle_id: true,
          sell_price: true,
          cost_price: true,
          sort_order: true,
          is_active: true,
          vehicle: { select: { id: true, name: true, type: true, passenger_capacity: true, has_ac: true, fuel_type: true } },
        },
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

  if (!pkg) return null;

  const availableVehicles = await db.vehicles.findMany({
    where: { is_active: true },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    select: { id: true, name: true, type: true, passenger_capacity: true, has_ac: true, fuel_type: true },
  });

  // Prisma returns Decimal — serialize to plain numbers for RSC boundary
  return {
    ...pkg,
    packagePricings: pkg.packagePricings.map((p) => ({
      id: p.id,
      duration_id: p.duration_id,
      stay_category_id: p.stay_category_id,
      margin_percentage: Number(p.margin_percentage),
      gst_percentage: Number(p.gst_percentage),
    })),
    cabPricings: pkg.cabPricings.map((c) => ({
      id: c.id,
      route_id: c.route_id,
      vehicle_id: c.vehicle_id,
      sell_price: Number(c.sell_price),
      cost_price: c.cost_price != null ? Number(c.cost_price) : null,
      sort_order: c.sort_order,
      is_active: c.is_active,
      vehicle: c.vehicle,
    })),
    availableVehicles,
    durations: pkg.durations.map((d) => ({
      ...d,
      routes: d.routes.map((r) => ({
        ...r,
        stops: r.stops.map((s) => ({
          ...s,
          latitude: s.latitude != null ? Number(s.latitude) : null,
          longitude: s.longitude != null ? Number(s.longitude) : null,
        })),
      })),
    })),
  };
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
      durations: {
        where: { is_default: true },
        take: 1,
        select: {
          slug: true,
          routes: {
            orderBy: { sort_order: "asc" },
            take: 1,
            select: { slug: true },
          },
        },
      },
      stay_categories: {
        where: { is_default: true },
        take: 1,
        select: { slug: true },
      },
    },
  });
}

// ── Toggle Active ─────────────────────────────────────────────────────────

export async function togglePackageActive(
  id: number,
  is_active: boolean,
): Promise<{ success: boolean; message?: string }> {
  if (is_active) {
    const pkg = await db.packages.findUnique({
      where: { id },
      select: {
        durations: {
          where: { is_default: true },
          take: 1,
          select: {
            id: true,
            routes: { take: 1, select: { id: true } },
          },
        },
        stay_categories: {
          where: { is_default: true },
          take: 1,
          select: { id: true },
        },
      },
    });

    if (!pkg?.durations.length) {
      return { success: false, message: "Set a default duration before activating" };
    }
    if (!pkg.durations[0].routes.length) {
      return { success: false, message: "Add at least one route to the default duration" };
    }
    if (!pkg?.stay_categories.length) {
      return { success: false, message: "Set a default stay category before activating" };
    }
  }

  await db.packages.update({ where: { id }, data: { is_active } });
  revalidatePath("/dashboard/packages");
  return { success: true };
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
