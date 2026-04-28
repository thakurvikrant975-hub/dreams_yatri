"use server";

import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";
import type { CabType } from "@/app/generated/prisma/client";

const BASE = "/dashboard/packages";

function toSlug(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

// ── Packages ──────────────────────────────────────────────────────────────

export async function getPackages() {
  return db.packages.findMany({
    orderBy: { id: "desc" },
    include: { durations: { orderBy: { sort_order: "asc" } } },
  });
}

export async function getPackageForEdit(id: number) {
  const pkg = await db.packages.findUnique({
    where: { id },
    include: {
      gallery: { orderBy: { position: "asc" } },
      durations: {
        orderBy: { sort_order: "asc" },
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

  const [packageHotels, pricing, cabs, policyMaps] = await Promise.all([
    db.package_hotels.findMany({ where: { package_id: id }, orderBy: { id: "asc" } }),
    db.package_pricing.findMany({
      where: { package_id: id },
      orderBy: [{ duration_id: "asc" }, { stay_category_id: "asc" }],
    }),
    db.package_cab_options.findMany({ where: { package_id: id }, orderBy: { id: "asc" } }),
    db.package_policy_map.findMany({ where: { package_id: id } }),
  ]);

  return { ...pkg, packageHotels, pricing, cabs, policyMaps };
}

export async function createPackage(data: {
  title: string;
  destination_id: number;
  description?: string;
  thumbnail?: string;
  cover_image?: string;
  is_active: boolean;
}) {
  const pkg = await db.packages.create({
    data: { ...data, slug: toSlug(data.title) },
  });
  revalidatePath(BASE);
  return pkg;
}

export async function updatePackage(
  id: number,
  data: {
    title?: string;
    destination_id?: number;
    description?: string;
    thumbnail?: string;
    cover_image?: string;
    is_active?: boolean;
  }
) {
  const slug = data.title ? { slug: toSlug(data.title) } : {};
  await db.packages.update({ where: { id }, data: { ...data, ...slug } });
  revalidatePath(BASE);
  revalidatePath(`${BASE}/${id}`);
}

// ── Duration + Route + Stops (single transaction) ─────────────────────────

export async function createDurationWithRoute(
  packageId: number,
  duration: { label: string; days: number; nights: number; is_default: boolean; sort_order: number },
  route: { name: string; is_active: boolean; meta_title?: string; meta_desc?: string; sort_order: number },
  stops: { location: string; stay_days: number; sort_order: number }[]
) {
  const result = await db.$transaction(async (tx) => {
    const d = await tx.package_durations.create({
      data: {
        package_id: packageId,
        slug: toSlug(duration.label),
        label: duration.label,
        days: duration.days,
        nights: duration.nights,
        is_default: duration.is_default,
        sort_order: duration.sort_order,
      },
    });
    const r = await tx.package_routes.create({
      data: {
        duration_id: d.id,
        name: route.name,
        slug: toSlug(route.name),
        is_active: route.is_active,
        meta_title: route.meta_title,
        meta_desc: route.meta_desc,
        sort_order: route.sort_order,
      },
    });
    if (stops.length > 0) {
      await tx.route_stops.createMany({
        data: stops.map((s) => ({ route_id: r.id, ...s })),
      });
    }
    return { duration: d, route: r };
  });
  revalidatePath(`${BASE}/${packageId}`);
  return result;
}

export async function createRouteWithStops(
  durationId: number,
  packageId: number,
  route: { name: string; is_active: boolean; meta_title?: string; meta_desc?: string; sort_order: number },
  stops: { location: string; stay_days: number; sort_order: number }[]
) {
  const result = await db.$transaction(async (tx) => {
    const r = await tx.package_routes.create({
      data: {
        duration_id: durationId,
        name: route.name,
        slug: toSlug(route.name),
        is_active: route.is_active,
        meta_title: route.meta_title,
        meta_desc: route.meta_desc,
        sort_order: route.sort_order,
      },
    });
    if (stops.length > 0) {
      await tx.route_stops.createMany({
        data: stops.map((s) => ({ route_id: r.id, ...s })),
      });
    }
    return r;
  });
  revalidatePath(`${BASE}/${packageId}`);
  return result;
}

export async function deleteDuration(id: number, packageId: number) {
  await db.package_durations.delete({ where: { id } });
  revalidatePath(`${BASE}/${packageId}`);
}

export async function deleteRoute(id: number, packageId: number) {
  await db.package_routes.delete({ where: { id } });
  revalidatePath(`${BASE}/${packageId}`);
}

export async function deleteStop(id: number, packageId: number) {
  await db.route_stops.delete({ where: { id } });
  revalidatePath(`${BASE}/${packageId}`);
}

// ── Itinerary (transaction) ───────────────────────────────────────────────

export async function createItinerary(input: {
  package_id: number;
  duration_id: number;
  route_id: number;
  day: number;
  title: string;
  description?: string;
  meals?: unknown;
  hotels?: { hotel_id: number; stay_category_id: number }[];
  activities?: { activity_id: number }[];
  transfers?: { pickup_point: string; drop_point: string; cab_type: string; duration_text: string }[];
  notes?: { type?: string; message: string }[];
}) {
  const { hotels, activities, transfers, notes, ...base } = input;

  const itinerary = await db.$transaction(async (tx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const it = await tx.package_itineraries.create({ data: base as any });
    if (hotels?.length) {
      await tx.itinerary_hotels.createMany({
        data: hotels.map((h) => ({ itinerary_id: it.id, ...h })),
        skipDuplicates: true,
      });
    }
    if (activities?.length) {
      await tx.itinerary_activities.createMany({
        data: activities.map((a) => ({ itinerary_id: it.id, ...a })),
      });
    }
    if (transfers?.length) {
      await tx.itinerary_transfers.createMany({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: transfers.map((t) => ({ itinerary_id: it.id, ...t })) as any,
      });
    }
    if (notes?.length) {
      await tx.itinerary_notes.createMany({
        data: notes.map((n) => ({ itinerary_id: it.id, message: n.message, type: n.type })),
      });
    }
    return it;
  });

  revalidatePath(`${BASE}/${input.package_id}`);
  return itinerary;
}

export async function deleteItinerary(id: number, packageId: number) {
  await db.package_itineraries.delete({ where: { id } });
  revalidatePath(`${BASE}/${packageId}`);
}

export async function getItinerariesForRoute(routeId: number) {
  return db.package_itineraries.findMany({
    where: { route_id: routeId },
    orderBy: { day: "asc" },
    include: {
      itinerary_hotels: true,
      itinerary_activities: true,
      itinerary_transfers: true,
      itinerary_notes: true,
    },
  });
}

// ── Package Hotels ────────────────────────────────────────────────────────

export async function addPackageHotel(data: {
  package_id: number;
  hotel_id: number;
  stay_category_id: number;
  is_recommended?: boolean;
}) {
  const record = await db.package_hotels.create({ data });
  revalidatePath(`${BASE}/${data.package_id}`);
  return record;
}

export async function removePackageHotel(id: number, packageId: number) {
  await db.package_hotels.delete({ where: { id } });
  revalidatePath(`${BASE}/${packageId}`);
}

export async function toggleHotelRecommended(id: number, packageId: number, value: boolean) {
  await db.package_hotels.update({ where: { id }, data: { is_recommended: value } });
  revalidatePath(`${BASE}/${packageId}`);
}

// ── Pricing ───────────────────────────────────────────────────────────────

export async function savePricingGrid(
  packageId: number,
  rows: {
    duration_id: number;
    stay_category_id: number;
    meal_rate_cp: number;
    meal_rate_map: number;
    meal_rate_ap: number;
    margin_pct?: number;
    gst_pct?: number;
  }[]
) {
  await db.$transaction([
    db.package_pricing.deleteMany({ where: { package_id: packageId } }),
    db.package_pricing.createMany({
      data: rows.map((r) => ({ package_id: packageId, ...r })),
    }),
  ]);
  revalidatePath(`${BASE}/${packageId}`);
}

// ── Cabs ──────────────────────────────────────────────────────────────────

export async function createCabOption(data: {
  package_id: number;
  cab_type: string;
  capacity: number;
  rate_per_day: number;
}) {
  const record = await db.package_cab_options.create({
    data: { ...data, cab_type: data.cab_type as CabType },
  });
  revalidatePath(`${BASE}/${data.package_id}`);
  return record;
}

export async function updateCabOption(
  id: number,
  packageId: number,
  data: { cab_type?: string; capacity?: number; rate_per_day?: number }
) {
  await db.package_cab_options.update({
    where: { id },
    data: {
      ...(data.cab_type && { cab_type: data.cab_type as CabType }),
      ...(data.capacity !== undefined && { capacity: data.capacity }),
      ...(data.rate_per_day !== undefined && { rate_per_day: data.rate_per_day }),
    },
  });
  revalidatePath(`${BASE}/${packageId}`);
}

export async function deleteCabOption(id: number, packageId: number) {
  await db.package_cab_options.delete({ where: { id } });
  revalidatePath(`${BASE}/${packageId}`);
}

// ── Policies ──────────────────────────────────────────────────────────────

export async function setPackagePolicies(packageId: number, policyIds: number[]) {
  await db.$transaction([
    db.package_policy_map.deleteMany({ where: { package_id: packageId } }),
    db.package_policy_map.createMany({
      data: policyIds.map((policy_id) => ({ package_id: packageId, policy_id })),
    }),
  ]);
  revalidatePath(`${BASE}/${packageId}`);
}

// ── Gallery ───────────────────────────────────────────────────────────────

export async function saveGallery(packageId: number, images: { key: string; alt?: string }[]) {
  await db.$transaction([
    db.package_gallery.deleteMany({ where: { package_id: packageId } }),
    db.package_gallery.createMany({
      data: images.map((img, i) => ({
        package_id: packageId,
        image_url: img.key,
        thumbnail: img.key,
        alt: img.alt ?? "",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        source_type: "manual" as any,
        position: i + 1,
        is_active: true,
      })),
    }),
  ]);
  revalidatePath(`${BASE}/${packageId}`);
}

// ── Search / lookup helpers ───────────────────────────────────────────────

export async function searchDestinations(query: string) {
  const rows = await db.destinations.findMany({
    where: query ? { name: { contains: query, mode: "insensitive" } } : undefined,
    orderBy: { name: "asc" },
    take: 20,
  });
  return rows.map((d) => ({ id: d.id, label: d.name }));
}

export async function searchHotels(query: string) {
  const rows = await db.hotels.findMany({
    where: query ? { name: { contains: query, mode: "insensitive" } } : undefined,
    orderBy: { name: "asc" },
    take: 20,
  });
  return rows.map((h) => ({ id: h.id, label: h.name }));
}

export async function searchActivities(query: string) {
  const rows = await db.activities.findMany({
    where: query ? { name: { contains: query, mode: "insensitive" } } : undefined,
    orderBy: { name: "asc" },
    take: 20,
  });
  return rows.map((a) => ({ id: a.id, label: a.name }));
}

export async function getAllPolicies() {
  const rows = await db.policies.findMany({ orderBy: { title: "asc" } });
  return rows.map((p) => ({ id: p.id, label: p.title }));
}

export async function getStayCategories() {
  return db.package_stay_categories.findMany({ orderBy: { id: "asc" } });
}

export async function getDurationsForPackage(packageId: number) {
  return db.package_durations.findMany({
    where: { package_id: packageId },
    orderBy: { sort_order: "asc" },
  });
}

export async function getRoutesForDuration(durationId: number) {
  return db.package_routes.findMany({
    where: { duration_id: durationId },
    orderBy: { sort_order: "asc" },
  });
}
