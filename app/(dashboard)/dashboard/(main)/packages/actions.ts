"use server";

import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { createLog } from "../lib/logger";

// ── Auth helper ───────────────────────────────────────────────────────────

async function requireActor(): Promise<string | null> {
  const session = await dashboardAuth();
  if (!session?.user?.email) return null;
  return session.user.id;
}

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
      destination: { select: { name: true, latitude: true, longitude: true } },
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
      packagePricings: {
        select: {
          id: true,
          duration_id: true,
          stay_category_id: true,
          margin_percentage: true,
          gst_percentage: true,
        },
      },
      permits: {
        orderBy: [{ duration_id: "asc" }, { sort_order: "asc" }],
        select: { id: true, duration_id: true, name: true, price: true, price_type: true, is_included: true, sort_order: true },
      },
      cabTypes: {
        orderBy: [{ duration_id: "asc" }, { sort_order: "asc" }],
        include: {
          vehicle: {
            select: { id: true, name: true, type: true, passenger_capacity: true, has_ac: true },
          },
          segments: {
            orderBy: { sort_order: "asc" },
            include: {
              cab_pricing: {
                include: {
                  location:    { select: { id: true, name: true } },
                  destination: { select: { id: true, name: true } },
                  seasons: {
                    where: { is_active: true },
                    select: {
                      id: true,
                      valid_from: true,
                      valid_to: true,
                      pricing_type: true,
                      weekday_price: true,
                      weekend_price: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      durations: {
        orderBy: { days: "asc" },
        include: {
          routes: {
            orderBy: { sort_order: "asc" },
            include: {
              _count: { select: { itineraries: true } },
              stops: {
                orderBy: { sort_order: "asc" },
                select: {
                  id: true,
                  place_name: true,
                  stay_days: true,
                  sort_order: true,
                  location_id: true,
                  location: {
                    select: { id: true, name: true, latitude: true, longitude: true, type: true, slug: true },
                  },
                },
              },
            },
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
    permits: pkg.permits.map((p) => ({
      id:          p.id,
      duration_id: p.duration_id,
      name:        p.name,
      price:       Number(p.price),
      price_type:  (p.price_type ?? "FLAT") as "FLAT" | "PER_PERSON" | "PER_VEHICLE",
      is_included: p.is_included,
      sort_order:  p.sort_order,
    })),
    cabTypes: pkg.cabTypes.map((ct) => ({
      id: ct.id,
      duration_id: ct.duration_id,
      vehicle_id: ct.vehicle_id,
      label: ct.label,
      note: ct.note,
      is_default: ct.is_default,
      is_active: ct.is_active,
      sort_order: ct.sort_order,
      vehicle: ct.vehicle,
      segments: ct.segments.map((s) => ({
        id: s.id,
        day_from: s.day_from,
        day_to: s.day_to,
        sort_order: s.sort_order,
        cab_pricing: {
          id: s.cab_pricing.id,
          pricing_type: s.cab_pricing.pricing_type as "PER_DAY" | "PER_KM",
          price: Number(s.cab_pricing.price),
          destination: s.cab_pricing.location
            ? { id: 0, name: s.cab_pricing.location.name }
            : (s.cab_pricing.destination ?? { id: 0, name: "—" }),
          seasons: s.cab_pricing.seasons.map((se) => ({
            id: se.id,
            valid_from: se.valid_from,
            valid_to: se.valid_to,
            pricing_type: se.pricing_type as "PER_DAY" | "PER_KM",
            weekday_price: Number(se.weekday_price),
            weekend_price: Number(se.weekend_price),
          })),
        },
      })),
    })),
    availableVehicles,
    durations: pkg.durations.map((d) => ({
      ...d,
      routes: d.routes.map((r) => ({
        ...r,
        stops: r.stops.map((s) => ({
          id: s.id,
          place_name: s.place_name,
          stay_days: s.stay_days,
          sort_order: s.sort_order,
          location_id: s.location_id ? String(s.location_id) : null,
          location: s.location ? {
            id: String(s.location.id),
            name: s.location.name,
            latitude: s.location.latitude != null ? Number(s.location.latitude) : null,
            longitude: s.location.longitude != null ? Number(s.location.longitude) : null,
            type: s.location.type,
            slug: s.location.slug,
          } : null,
        })),
      })),
    })),
  };
}

export type GetPackagesParams = {
  page?:        number;
  limit?:       number;
  search?:      string;
  destination?: number | "all";
  status?:      "active" | "inactive" | "all";
};

const PACKAGE_INCLUDE = {
  destination: {
    select: { id: true, name: true, region: { select: { name: true } } },
  },
  _count: {
    select: { durations: true, packageRoutes: true, gallery: true },
  },
  durations: {
    where: { is_default: true },
    take: 1,
    select: {
      slug: true,
      routes: { orderBy: { sort_order: "asc" as const }, take: 1, select: { slug: true } },
    },
  },
  stay_categories: {
    where: { is_default: true },
    take: 1,
    select: { slug: true },
  },
} as const;

export async function getPackages(params: GetPackagesParams = {}) {
  const {
    page        = 1,
    limit       = 20,
    search      = "",
    destination = "all",
    status      = "all",
  } = params;

  const skip = (page - 1) * limit;

  const where = {
    ...(search      ? { title: { contains: search, mode: "insensitive" as const } } : {}),
    ...(destination !== "all" ? { destination_id: destination as number } : {}),
    ...(status === "active"   ? { is_active: true }  : {}),
    ...(status === "inactive" ? { is_active: false } : {}),
  };

  const [rows, totalCount, statsTotal, statsActive] = await Promise.all([
    db.packages.findMany({ where, orderBy: { created_at: "desc" }, skip, take: limit, include: PACKAGE_INCLUDE }),
    db.packages.count({ where }),
    db.packages.count(),
    db.packages.count({ where: { is_active: true } }),
  ]);

  const actorIds = [...new Set(rows.flatMap((r) => [r.created_by, r.updated_by]).filter(Boolean) as string[])];
  const members = actorIds.length > 0
    ? await db.teamMember.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })
    : [];
  const memberNames: Record<string, string> = Object.fromEntries(members.map((m) => [m.id, m.name]));

  return {
    packages: rows,
    memberNames,
    totalCount,
    stats: { total: statsTotal, active: statsActive, inactive: statsTotal - statsActive },
  };
}

export async function getDestinationsForPackageFilter() {
  return db.destinations.findMany({
    where: { packages: { some: {} } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
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
        thumbnail: true,
        durations: {
          where: { is_default: true },
          take: 1,
          select: {
            id: true,
            routes: {
              take: 1,
              select: {
                id: true,
                _count: { select: { stops: true } },
              },
            },
          },
        },
        stay_categories: {
          where: { is_default: true },
          take: 1,
          select: { id: true },
        },
      },
    });

    if (!pkg?.thumbnail) {
      return { success: false, message: "Add a thumbnail image before activating" };
    }
    if (!pkg.durations.length) {
      return { success: false, message: "Set a default duration before activating" };
    }
    if (!pkg.durations[0].routes.length) {
      return { success: false, message: "Add at least one route to the default duration" };
    }
    if (pkg.durations[0].routes[0]._count.stops === 0) {
      return { success: false, message: "Add at least one stop to the default route before activating" };
    }
    if (!pkg.stay_categories.length) {
      return { success: false, message: "Set a default stay category before activating" };
    }

    const hasPricingConfig = await db.package_pricing.findFirst({
      where: {
        package_id: id,
        duration_id: pkg.durations[0].id,
        stay_category_id: pkg.stay_categories[0].id,
      },
      select: { id: true },
    });
    if (!hasPricingConfig) {
      return { success: false, message: "Configure pricing for the default duration + stay category before activating" };
    }
  }

  const actor = await requireActor();
  const row = await db.packages.update({
    where: { id },
    data:  { is_active, updated_by: actor },
  });

  await createLog({
    action:     "UPDATE",
    entity:     "package",
    entityId:   String(id),
    entitySlug: row.slug,
    newData:    { is_active },
    metadata:   { operation: "toggle_active" },
  });

  revalidatePath("/dashboard/packages");
  return { success: true };
}

// ── History ───────────────────────────────────────────────────────────────

export async function getPackageHistory(id: number | string) {
  return db.activityLog.findMany({
    where:   { entity: "package", entityId: String(id) },
    orderBy: { actionAt: "desc" },
    select: {
      id:           true,
      action:       true,
      description:  true,
      userName:     true,
      userEmail:    true,
      previousData: true,
      newData:      true,
      metadata:     true,
      status:       true,
      actionAt:     true,
    },
    take: 50,
  });
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

    await createLog({
      action:       "DELETE",
      entity:       "package",
      entityId:     String(id),
      entitySlug:   pkg.slug,
      previousData: { title: pkg.title, slug: pkg.slug, destination_id: pkg.destination_id },
    });

    revalidatePath("/dashboard/packages");
    return { success: true, message: "Package deleted" };
  } catch {
    return { success: false, message: "Database error. Please try again." };
  }
}
