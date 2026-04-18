"use server";

import { db } from "@/app/lib/db";
import { deleteFromR2 } from "@/app/lib/r2/r2delete";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/app/generated/prisma";

// ── Types ─────────────────────────────────────────────────────────────────

export type PackageFormState = {
  success: boolean;
  message: string;
  id?: number;
};

export type RouteOption = {
  id: number;
  slug: string;
  label: string;
  stops: { d: number; p: string }[];
  is_default: boolean;
};

export type Cab = {
  id: string;
  from: string;
  to: string;
  duration_mins: number | null;
  cab_type: "sedan" | "suv" | "bolero" | "innova" | "tempo_traveller" | "bus";
  price: number | null;
  note: string | null;
};

// ── Read — list ───────────────────────────────────────────────────────────

export async function getPackages() {
  return db.packages.findMany({
    orderBy: { created_at: "desc" },
    include: {
      destination: {
        select: { id: true, name: true, region: { select: { name: true } } },
      },
      _count: {
        select: {
          durations: true,
          stay_type_map: true,
          images: true,
          itineraries: true,
          policies: true,
        },
      },
    },
  });
}

// ── Read — single for edit ────────────────────────────────────────────────

export async function getPackageForEdit(id: number) {
  return db.packages.findUnique({
    where: { id },
    include: {
      destination: { select: { id: true, name: true } },
      tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
      categories: { include: { category: { select: { id: true, name: true, slug: true } } } },
      policies: { include: { policy: { select: { id: true, type: true, title: true, points: true } } } },
      images: { orderBy: { sort_order: "asc" } },
      stay_type_map: {
        orderBy: { sort_order: "asc" },
        include: { stay_type: { select: { id: true, name: true, slug: true } } },
      },
      durations: {
        orderBy: { sort_order: "asc" },
        include: {
          pricing: {
            orderBy: [{ route_index: "asc" }, { stay_map_id: "asc" }],
          },
          itineraries: {
            orderBy: { day: "asc" },
            include: {
              itin_hotels: {
                include: {
                  hotel: { select: { id: true, name: true, star_rating: true, category: true, meals_included: true } },
                  stay_map: { include: { stay_type: { select: { id: true, name: true } } } },
                },
              },
            },
          },
        },
      },
    },
  });
}

// ── Selects for dropdowns ──────────────────────────────────────────────────

export async function getDestinationsForSelect() {
  return db.destinations.findMany({
    where: { is_active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, region: { select: { name: true } } },
  });
}

export async function getTagsForSelect() {
  return db.tags.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  });
}

export async function getCategoriesForSelect() {
  return db.categories.findMany({
    where: { is_active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  });
}

export async function getPoliciesForSelect() {
  return db.policies.findMany({
    where: { is_active: true },
    orderBy: [{ type: "asc" }, { sort_order: "asc" }],
    select: { id: true, title: true, type: true },
  });
}

export async function getHotelsForSelect() {
  return db.hotels.findMany({
    where: { is_active: true },
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, slug: true, star_rating: true,
      category: true, meals_included: true,
      destination: { select: { name: true } },
      images: {
        where: { is_primary: true },
        take: 1,
        select: { url: true, thumbnail: true },
      },
    },
  });
}

export async function getActivitiesForSelect() {
  return db.activities.findMany({
    where:   { is_active: true },
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, slug: true, category: true,
      duration_hours: true,                // ← add this
      destination: { select: { name: true } },
    },
  });
}

export async function getStayTypesForSelect() {
  return db.stay_types.findMany({
    where: { is_active: true },
    orderBy: { sort_order: "asc" },
    select: { id: true, name: true, slug: true },
  });
}

// ── Create package ────────────────────────────────────────────────────────

export async function createPackage(
  _prev: PackageFormState,
  formData: FormData,
): Promise<PackageFormState> {
  const title = formData.get("title") as string;
  const slug = formData.get("slug") as string;
  const destination_id = Number(formData.get("destination_id"));
  const description = (formData.get("description") as string) || null;
  const is_active = formData.get("is_active") === "true";

  if (!title || !slug || !destination_id) {
    return { success: false, message: "Title, slug and destination are required" };
  }

  try {
    const existing = await db.packages.findUnique({ where: { slug } });
    if (existing) return { success: false, message: "Slug already exists" };

    const pkg = await db.packages.create({
      data: {
        title, slug, destination_id, description,
        is_active,
        is_verified: false,
        inclusions: [],
        exclusions: [],
      },
    });

    revalidatePath("/dashboard/packages");
    return { success: true, message: "Package created", id: pkg.id };
  } catch {
    return { success: false, message: "Database error." };
  }
}

// ── Update basic info ─────────────────────────────────────────────────────

const BasicSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  destination_id: z.coerce.number().int().positive(),
  description: z.string().optional(),
  meta_title: z.string().optional(),
  meta_desc: z.string().optional(),
  is_active: z.boolean().default(false),
});

export async function updatePackageBasic(
  id: number,
  _prev: PackageFormState,
  formData: FormData,
): Promise<PackageFormState> {
  let inclusions: string[] = [];
  let exclusions: string[] = [];
  try {
    inclusions = JSON.parse((formData.get("inclusions") as string) || "[]");
    exclusions = JSON.parse((formData.get("exclusions") as string) || "[]");
  } catch { /* ignore */ }

  const raw = {
    title: formData.get("title"),
    slug: formData.get("slug"),
    destination_id: formData.get("destination_id"),
    description: formData.get("description") || undefined,
    meta_title: formData.get("meta_title") || undefined,
    meta_desc: formData.get("meta_desc") || undefined,
    is_active: formData.get("is_active") === "true",
  };

  const parsed = BasicSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, message: "Validation failed" };
  }

  try {
    const thumbnail = (formData.get("thumbnail") as string) || null;
    const cover_image = (formData.get("cover_image") as string) || null;

    await db.packages.update({
      where: { id },
      data: {
        ...parsed.data,
        inclusions,
        exclusions,
        ...(thumbnail && { thumbnail }),
        ...(cover_image && { cover_image }),
      },
    });

    revalidatePath("/dashboard/packages");
    revalidatePath(`/dashboard/packages/${id}`);
    return { success: true, message: "Package updated" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

// ── Update tags ───────────────────────────────────────────────────────────

export async function updatePackageTags(
  package_id: number,
  tag_ids: number[],
): Promise<PackageFormState> {
  try {
    await db.$transaction([
      db.package_tags.deleteMany({ where: { package_id } }),
      ...(tag_ids.length > 0
        ? [db.package_tags.createMany({
          data: tag_ids.map(tag_id => ({ package_id, tag_id })),
        })]
        : []),
    ]);
    revalidatePath(`/dashboard/packages/${package_id}`);
    return { success: true, message: "Tags updated" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

// ── Update categories ─────────────────────────────────────────────────────

export async function updatePackageCategories(
  package_id: number,
  category_ids: number[],
): Promise<PackageFormState> {
  try {
    await db.$transaction([
      db.package_categories.deleteMany({ where: { package_id } }),
      ...(category_ids.length > 0
        ? [db.package_categories.createMany({
          data: category_ids.map(category_id => ({ package_id, category_id })),
        })]
        : []),
    ]);
    revalidatePath(`/dashboard/packages/${package_id}`);
    return { success: true, message: "Categories updated" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

// ── Update policies ───────────────────────────────────────────────────────

export async function updatePackagePolicies(
  package_id: number,
  policy_ids: number[],
): Promise<PackageFormState> {
  try {
    await db.$transaction(async tx => {
      await tx.package_policy_map.deleteMany({ where: { package_id } });
      if (policy_ids.length > 0) {
        await tx.package_policy_map.createMany({
          data: policy_ids.map(policy_id => ({ package_id, policy_id })),
        });
      }
    });
    revalidatePath(`/dashboard/packages/${package_id}`);
    return { success: true, message: "Policies updated" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

// ── Stay type map ─────────────────────────────────────────────────────────

export async function syncPackageStayTypes(
  package_id: number,
  stay_type_ids: number[],
): Promise<PackageFormState> {
  try {
    await db.$transaction(async tx => {
      await tx.package_stay_type_map.deleteMany({ where: { package_id } });
      if (stay_type_ids.length > 0) {
        await tx.package_stay_type_map.createMany({
          data: stay_type_ids.map((stay_type_id, i) => ({
            package_id,
            stay_type_id,
            sort_order: i,
            is_default: i === 0,
            is_active: true,
          })),
        });
      }
    });
    revalidatePath(`/dashboard/packages/${package_id}`);
    return { success: true, message: "Stay types updated" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

// ── Toggle active / verified ──────────────────────────────────────────────

export async function togglePackageActive(id: number, is_active: boolean) {
  await db.packages.update({ where: { id }, data: { is_active } });
  revalidatePath("/dashboard/packages");
}

export async function togglePackageVerified(
  id: number,
  is_verified: boolean,
): Promise<PackageFormState> {
  try {
    await db.packages.update({ where: { id }, data: { is_verified } });
    revalidatePath(`/dashboard/packages/${id}`);
    return { success: true, message: is_verified ? "Package verified" : "Verification removed" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

// ── Delete package ────────────────────────────────────────────────────────

export async function deletePackage(id: number): Promise<PackageFormState> {
  try {
    const pkg = await db.packages.findUnique({
      where: { id },
      include: { images: { select: { url: true, thumbnail: true } } },
    });
    if (!pkg) return { success: false, message: "Package not found" };

    const r2Keys = [...new Set([
      pkg.thumbnail,
      pkg.cover_image,
      ...pkg.images.flatMap(i => [i.url, i.thumbnail]),
    ].filter(Boolean) as string[])];
    await Promise.all(r2Keys.map(k => deleteFromR2(k).catch(console.error)));

    await db.$transaction([
      db.package_policy_map.deleteMany({ where: { package_id: id } }),
      db.package_tags.deleteMany({ where: { package_id: id } }),
      db.package_categories.deleteMany({ where: { package_id: id } }),
      db.package_activities.deleteMany({ where: { package_id: id } }),
      db.package_images.deleteMany({ where: { package_id: id } }),
      db.package_pricing.deleteMany({ where: { package_id: id } }),
      db.package_itinerary_hotels.deleteMany({ where: { itinerary: { package_id: id } } }),
      db.package_itineraries.deleteMany({ where: { package_id: id } }),
      db.package_durations.deleteMany({ where: { package_id: id } }),
      db.package_stay_type_map.deleteMany({ where: { package_id: id } }),
      db.packages.delete({ where: { id } }),
    ]);

    revalidatePath("/dashboard/packages");
    return { success: true, message: "Package deleted" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

// ── Durations ─────────────────────────────────────────────────────────────

export async function createDuration(
  package_id: number,
  data: {
    slug: string;
    label: string;
    h1_title: string | null;
    days: number;
    nights: number;
    routes: RouteOption[];
    thumbnail: string | null;
    meta_title: string | null;
    meta_desc: string | null;
    is_default: boolean;
    sort_order: number;
  },
): Promise<PackageFormState> {
  try {
    const dur = await db.package_durations.create({
      data: { package_id, ...data, is_active: true },
    });
    revalidatePath(`/dashboard/packages/${package_id}`);
    return { success: true, message: "Duration created", id: dur.id };
  } catch {
    return { success: false, message: "Database error." };
  }
}

export async function updateDuration(
  id: number,
  package_id: number,
  data: {
    label: string;
    h1_title: string | null;
    days: number;
    nights: number;
    routes: RouteOption[];
    thumbnail: string | null;
    meta_title: string | null;
    meta_desc: string | null;
    is_default: boolean;
    sort_order: number;
    is_active: boolean;
  },
): Promise<PackageFormState> {
  try {
    await db.package_durations.update({ where: { id }, data });
    revalidatePath(`/dashboard/packages/${package_id}`);
    return { success: true, message: "Duration updated" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

export async function deleteDuration(id: number, package_id: number): Promise<PackageFormState> {
  try {
    await db.$transaction([
      db.package_itinerary_hotels.deleteMany({ where: { itinerary: { duration_id: id } } }),
      db.package_itineraries.deleteMany({ where: { duration_id: id } }),
      db.package_pricing.deleteMany({ where: { duration_id: id } }),
      db.package_durations.delete({ where: { id } }),
    ]);
    revalidatePath(`/dashboard/packages/${package_id}`);
    return { success: true, message: "Duration deleted" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

// ── Pricing ───────────────────────────────────────────────────────────────

export async function upsertPricing(
  package_id: number,
  duration_id: number,
  route_index: number,
  stay_map_id: number,
  price: number,
  original_price: number | null,
): Promise<PackageFormState> {
  try {
    await db.package_pricing.upsert({
      where: {
        package_id_duration_id_route_index_stay_map_id: {
          package_id, duration_id, route_index, stay_map_id,
        },
      },
      create: { package_id, duration_id, route_index, stay_map_id, price, original_price, is_active: true },
      update: { price, original_price },
    });
    revalidatePath(`/dashboard/packages/${package_id}`);
    return { success: true, message: "Price saved" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

// ── Itinerary ─────────────────────────────────────────────────────────────

export async function upsertItineraryDay(
  package_id: number,
  duration_id: number,
  day: number,
  data: {
    title: string;
    description: string;
    activity_ids: number[];
    meals: string[] | null;
    route_index: number | null;
    cabs: Cab[];
  },
): Promise<PackageFormState> {
  try {
    const existing = await db.package_itineraries.findFirst({
      where: { package_id, duration_id, day },
    });

    const payload = {
      title: data.title,
      description: data.description || null,
      activity_ids: data.activity_ids,
      activities: data.activity_ids,
      meals: data.meals ?? Prisma.JsonNull,   // ← was data.meals
      route_index: data.route_index,
      cabs: data.cabs.length > 0 ? data.cabs : Prisma.JsonNull,
    };

    if (existing) {
      await db.package_itineraries.update({ where: { id: existing.id }, data: payload });
    } else {
      await db.package_itineraries.create({
        data: { package_id, duration_id, day, ...payload },
      });
    }

    revalidatePath(`/dashboard/packages/${package_id}`);
    return { success: true, message: "Day saved" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

export async function clearItineraryDay(
  package_id: number,
  duration_id: number,
  day: number,
): Promise<PackageFormState> {
  try {
    const row = await db.package_itineraries.findFirst({
      where: { package_id, duration_id, day },
    });
    if (row) {
      await db.package_itinerary_hotels.deleteMany({ where: { itinerary_id: row.id } });
      await db.package_itineraries.delete({ where: { id: row.id } });
    }
    revalidatePath(`/dashboard/packages/${package_id}`);
    return { success: true, message: "Day cleared" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

// ── Itinerary hotel assignments ───────────────────────────────────────────

export async function upsertItineraryHotel(
  itinerary_id: number,
  stay_map_id: number,
  hotel_id: number,
  nights: number,
  package_id: number,
): Promise<PackageFormState> {
  try {
    await db.package_itinerary_hotels.upsert({
      where: { itinerary_id_stay_map_id: { itinerary_id, stay_map_id } },
      create: { itinerary_id, stay_map_id, hotel_id, nights },
      update: { hotel_id, nights },
    });
    revalidatePath(`/dashboard/packages/${package_id}`);
    return { success: true, message: "Hotel assigned" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

export async function removeItineraryHotel(
  itinerary_id: number,
  stay_map_id: number,
  package_id: number,
): Promise<PackageFormState> {
  try {
    await db.package_itinerary_hotels.deleteMany({ where: { itinerary_id, stay_map_id } });
    revalidatePath(`/dashboard/packages/${package_id}`);
    return { success: true, message: "Hotel removed" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

// ── Images ────────────────────────────────────────────────────────────────

export async function addPackageImages(
  package_id: number,
  images: { url: string; thumbnail?: string }[],
): Promise<PackageFormState> {
  try {
    const existing = await db.package_images.count({ where: { package_id } });
    const isFirst = existing === 0;
    await db.package_images.createMany({
      data: images.map((img, i) => ({
        package_id,
        url: img.url,
        thumbnail: img.thumbnail || img.url,
        sort_order: existing + i,
        is_primary: isFirst && i === 0,
      })),
    });
    revalidatePath(`/dashboard/packages/${package_id}`);
    return { success: true, message: `${images.length} image(s) added` };
  } catch {
    return { success: false, message: "Database error." };
  }
}

export async function deletePackageImage(
  id: number,
  package_id: number,
  url: string,
  thumbnail?: string,
): Promise<PackageFormState> {
  try {
    const keys = [...new Set([url, thumbnail].filter(Boolean) as string[])];
    await Promise.all(keys.map(k => deleteFromR2(k).catch(console.error)));
    await db.package_images.delete({ where: { id } });
    revalidatePath(`/dashboard/packages/${package_id}`);
    return { success: true, message: "Image deleted" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

export async function setPrimaryPackageImage(id: number, package_id: number): Promise<PackageFormState> {
  try {
    await db.$transaction([
      db.package_images.updateMany({ where: { package_id }, data: { is_primary: false } }),
      db.package_images.update({ where: { id }, data: { is_primary: true } }),
    ]);
    revalidatePath(`/dashboard/packages/${package_id}`);
    return { success: true, message: "Primary image set" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

export async function updatePackageImageMeta(
  id: number,
  title: string | null,
  alt: string | null,
): Promise<PackageFormState> {
  try {
    await db.package_images.update({ where: { id }, data: { title, alt } });
    return { success: true, message: "Updated" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

// ── Hotel meals ───────────────────────────────────────────────────────────

export async function updateHotelMeals(
  hotel_id: number,
  meals_included: string[],
): Promise<PackageFormState> {
  try {
    await db.hotels.update({ where: { id: hotel_id }, data: { meals_included } });
    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Meals updated" };
  } catch {
    return { success: false, message: "Database error." };
  }
}