"use server";

import { db }             from "@/app/lib/db";
import { deleteFromR2 } from "@/app/lib/r2/r2delete";
import { revalidatePath } from "next/cache";
import { z }              from "zod";

// ── Types ─────────────────────────────────────────────────────────────────

export type PackageFormState = {
  success:  boolean;
  message:  string;
  errors?:  Record<string, string[]>;
  id?:      number;
};

export type RouteOption = {
  id:         number;
  slug:       string;
  label:      string;
  stops:      { d: number; p: string }[];
  is_default: boolean;
};

export type PackageListItem = {
  id:          number;
  title:       string;
  slug:        string;
  thumbnail:   string | null;
  is_active:   boolean;
  created_at:  Date;
  destination: { id: number; name: string; region: { name: string } };
  _count:      { durations: number; images: number; itineraries: number };
};

// ── Selects ───────────────────────────────────────────────────────────────

export async function getDestinationsForSelect() {
  return db.destinations.findMany({
    where:   { is_active: true },
    orderBy: { name: "asc" },
    select:  { id: true, name: true, region: { select: { name: true } } },
  });
}

export async function getCategoriesForSelect() {
  return db.categories.findMany({
    where:   { is_active: true, parent_id: null },
    orderBy: { sort_order: "asc" },
    select:  {
      id: true, name: true,
      children: { where: { is_active: true }, select: { id: true, name: true } },
    },
  });
}

export async function getTagsForSelect() {
  return db.tags.findMany({
    orderBy: { name: "asc" },
    select:  { id: true, name: true },
  });
}

export async function getHotelsForSelect(destination_id?: number) {
  return db.hotels.findMany({
    where:   { is_active: true, ...(destination_id && { destination_id }) },
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, slug: true, category: true, star_rating: true,
      destination: { select: { name: true } },
      images: {
        where:  { is_primary: true },
        take:   1,
        select: { url: true, thumbnail: true },
      },
    },
  });
}

export async function getActivitiesForSelect(destination_id?: number) {
  return db.activities.findMany({
    where:   { is_active: true, ...(destination_id && { destination_id }) },
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, slug: true, category: true, duration_hours: true,
      destination: { select: { name: true } },
    },
  });
}

export async function getPoliciesForSelect() {
  return db.policies.findMany({
    where:   { is_active: true },
    orderBy: [{ type: "asc" }, { sort_order: "asc" }],
    select:  { id: true, title: true, type: true },
  });
}

// ── List ──────────────────────────────────────────────────────────────────

export async function getPackages(): Promise<PackageListItem[]> {
  return db.packages.findMany({
    orderBy: { created_at: "desc" },
    select: {
      id: true, title: true, slug: true, thumbnail: true,
      is_active: true, created_at: true,
      destination: { select: { id: true, name: true, region: { select: { name: true } } } },
      _count: { select: { durations: true, images: true, itineraries: true } },
    },
  });
}

// ── Get full package for edit ─────────────────────────────────────────────

export async function getPackageById(id: number) {
  return db.packages.findUnique({
    where: { id },
    include: {
      destination:     { select: { id: true, name: true } },
      images:          { orderBy: { sort_order: "asc" } },
      durations: {
        orderBy: { sort_order: "asc" },
        include: {
          pricing: true,
          itineraries: {
            orderBy: { day: "asc" },
            include: {
              hotel: {
                select: {
                  id: true, name: true, star_rating: true, category: true,
                },
              },
            },
          },
        },
      },
      stay_categories: { orderBy: { sort_order: "asc" } },
      tags:            { include: { tag: { select: { id: true, name: true } } } },
      categories:      { include: { category: { select: { id: true, name: true } } } },
      policies:        { include: { policy: { select: { id: true, title: true, type: true } } } },
    },
  });
}

export async function getPackageItinerary(package_id: number, duration_id: number) {
  return db.package_itineraries.findMany({
    where:   { package_id, duration_id },
    orderBy: { day: "asc" },
    include: {
      hotel: {
        select: {
          id: true, name: true, star_rating: true, category: true,
          images: { where: { is_primary: true }, take: 1, select: { url: true } },
        },
      },
    },
  });
}

// ── Create Package ────────────────────────────────────────────────────────

const BasicSchema = z.object({
  title:          z.string().min(1, "Title is required"),
  slug:           z.string().min(1).regex(/^[a-z0-9-]+$/),
  destination_id: z.coerce.number().int().positive("Destination required"),
  description:    z.string().optional(),
  meta_title:     z.string().optional(),
  meta_desc:      z.string().optional(),
  is_active:      z.boolean().default(true),
});

export async function createPackage(
  _prev: PackageFormState,
  formData: FormData,
): Promise<PackageFormState> {
  const raw = {
    title:          formData.get("title"),
    slug:           formData.get("slug"),
    destination_id: formData.get("destination_id"),
    description:    formData.get("description")  || undefined,
    meta_title:     formData.get("meta_title")   || undefined,
    meta_desc:      formData.get("meta_desc")    || undefined,
    is_active:      formData.get("is_active") === "true",
  };

  const parsed = BasicSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const existing = await db.packages.findUnique({ where: { slug: parsed.data.slug } });
    if (existing) return { success: false, message: "Slug taken", errors: { slug: ["Slug already in use"] } };

    const pkg = await db.packages.create({
      data: { ...parsed.data, inclusions: [], exclusions: [] },
    });

    revalidatePath("/dashboard/packages");
    return { success: true, message: "Package created", id: pkg.id };
  } catch {
    return { success: false, message: "Database error. Please try again." };
  }
}

// ── Update Basic ──────────────────────────────────────────────────────────

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
    title:          formData.get("title"),
    slug:           formData.get("slug"),
    destination_id: formData.get("destination_id"),
    description:    formData.get("description")  || undefined,
    meta_title:     formData.get("meta_title")   || undefined,
    meta_desc:      formData.get("meta_desc")    || undefined,
    is_active:      formData.get("is_active") === "true",
  };

  const parsed = BasicSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const thumbnail = (formData.get("thumbnail") as string) || null;

    if (thumbnail) {
      const current = await db.packages.findUnique({ where: { id }, select: { thumbnail: true } });
      if (current?.thumbnail && current.thumbnail !== thumbnail) {
        await deleteFromR2(current.thumbnail).catch(console.error);
      }
    }

    await db.packages.update({
      where: { id },
      data:  {
        ...parsed.data,
        inclusions,
        exclusions,
        ...(thumbnail !== null && { thumbnail }),
      },
    });

    revalidatePath("/dashboard/packages");
    revalidatePath(`/dashboard/packages/${id}`);
    return { success: true, message: "Package updated" };
  } catch {
    return { success: false, message: "Database error. Please try again." };
  }
}

// ── Update policies only ─────────────────────────────────────────────────

export async function updatePackagePolicies(
  id:         number,
  policy_ids: number[],
): Promise<PackageFormState> {
  try {
    await db.$transaction(async tx => {
      await tx.package_policy_map.deleteMany({ where: { package_id: id } });
      if (policy_ids.length > 0) {
        await tx.package_policy_map.createMany({
          data: policy_ids.map(policy_id => ({ package_id: id, policy_id })),
        });
      }
    });
    revalidatePath(`/dashboard/packages/${id}`);
    return { success: true, message: "Policies updated" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

// ── Toggle / Delete ───────────────────────────────────────────────────────

export async function togglePackageActive(id: number, is_active: boolean) {
  await db.packages.update({ where: { id }, data: { is_active } });
  revalidatePath("/dashboard/packages");
}

export async function deletePackage(id: number): Promise<PackageFormState> {
  try {
    const pkg = await db.packages.findUnique({
      where:   { id },
      include: { images: { select: { url: true, thumbnail: true } } },
    });
    if (!pkg) return { success: false, message: "Package not found" };

    const r2Keys = [
      ...new Set([
        pkg.thumbnail,
        pkg.cover_image,
        ...pkg.images.flatMap(i => [i.url, i.thumbnail]),
      ].filter(Boolean) as string[]),
    ];
    await Promise.all(r2Keys.map(k => deleteFromR2(k).catch(console.error)));

    await db.$transaction([
      db.package_itineraries.deleteMany({     where: { package_id: id } }),
      db.package_pricing.deleteMany({         where: { package_id: id } }),
      db.package_images.deleteMany({          where: { package_id: id } }),
      db.package_hotels.deleteMany({          where: { package_id: id } }),
      db.package_activities.deleteMany({      where: { package_id: id } }),
      db.package_tags.deleteMany({            where: { package_id: id } }),
      db.package_categories.deleteMany({      where: { package_id: id } }),
      db.package_policy_map.deleteMany({      where: { package_id: id } }),
      db.package_stay_categories.deleteMany({ where: { package_id: id } }),
      db.package_durations.deleteMany({       where: { package_id: id } }),
      db.packages.delete({                    where: { id } }),
    ]);

    revalidatePath("/dashboard/packages");
    return { success: true, message: "Package deleted" };
  } catch {
    return { success: false, message: "Database error. Please try again." };
  }
}

// ── Durations ─────────────────────────────────────────────────────────────

export async function createDuration(package_id: number, formData: FormData): Promise<PackageFormState> {
  try {
    let routes: RouteOption[] = [];
    try { routes = JSON.parse((formData.get("routes") as string) || "[]"); } catch { /* ignore */ }

    const count = await db.package_durations.count({ where: { package_id } });
    await db.package_durations.create({
      data: {
        package_id,
        slug:       formData.get("slug")  as string,
        label:      formData.get("label") as string,
        days:       Number(formData.get("days")),
        nights:     Number(formData.get("nights")),
        routes,
        is_default: formData.get("is_default") === "true",
        is_active:  true,
        sort_order: count,
        meta_title: (formData.get("meta_title") as string) || null,
        meta_desc:  (formData.get("meta_desc")  as string) || null,
      },
    });
    revalidatePath(`/dashboard/packages/${package_id}`);
    return { success: true, message: "Duration added" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

export async function updateDuration(id: number, package_id: number, formData: FormData): Promise<PackageFormState> {
  try {
    let routes: RouteOption[] = [];
    try { routes = JSON.parse((formData.get("routes") as string) || "[]"); } catch { /* ignore */ }

    await db.package_durations.update({
      where: { id },
      data: {
        label:      formData.get("label") as string,
        days:       Number(formData.get("days")),
        nights:     Number(formData.get("nights")),
        routes,
        is_default: formData.get("is_default") === "true",
        meta_title: (formData.get("meta_title") as string) || null,
        meta_desc:  (formData.get("meta_desc")  as string) || null,
      },
    });
    revalidatePath(`/dashboard/packages/${package_id}`);
    return { success: true, message: "Duration updated" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

export async function deleteDuration(id: number, package_id: number): Promise<PackageFormState> {
  try {
    await db.$transaction([
      db.package_itineraries.deleteMany({ where: { duration_id: id } }),
      db.package_pricing.deleteMany({    where: { duration_id: id } }),
      db.package_durations.delete({      where: { id } }),
    ]);
    revalidatePath(`/dashboard/packages/${package_id}`);
    return { success: true, message: "Duration deleted" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

// ── Stay Categories ───────────────────────────────────────────────────────

export async function createStayCategory(package_id: number, formData: FormData): Promise<PackageFormState> {
  try {
    const count = await db.package_stay_categories.count({ where: { package_id } });
    await db.package_stay_categories.create({
      data: {
        package_id,
        slug:              formData.get("slug")  as string,
        label:             formData.get("label") as string,
        description:       (formData.get("description") as string) || null,
        min_duration_days: formData.get("min_duration_days") ? Number(formData.get("min_duration_days")) : null,
        is_default:        formData.get("is_default") === "true",
        sort_order:        count,
        is_active:         true,
      },
    });
    revalidatePath(`/dashboard/packages/${package_id}`);
    return { success: true, message: "Stay category added" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

export async function updateStayCategory(id: number, package_id: number, formData: FormData): Promise<PackageFormState> {
  try {
    await db.package_stay_categories.update({
      where: { id },
      data: {
        label:             formData.get("label") as string,
        description:       (formData.get("description") as string) || null,
        min_duration_days: formData.get("min_duration_days") ? Number(formData.get("min_duration_days")) : null,
        is_default:        formData.get("is_default") === "true",
        is_active:         formData.get("is_active") === "true",
      },
    });
    revalidatePath(`/dashboard/packages/${package_id}`);
    return { success: true, message: "Stay category updated" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

export async function deleteStayCategory(id: number, package_id: number): Promise<PackageFormState> {
  try {
    await db.$transaction([
      db.package_pricing.deleteMany({     where: { stay_category_id: id } }),
      db.package_hotels.deleteMany({      where: { stay_category_id: id } }),
      db.package_stay_categories.delete({ where: { id } }),
    ]);
    revalidatePath(`/dashboard/packages/${package_id}`);
    return { success: true, message: "Stay category deleted" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

// ── Pricing matrix ────────────────────────────────────────────────────────

export async function upsertPricing(
  package_id:       number,
  duration_id:      number,
  route_index:      number,
  stay_category_id: number,
  price:            number,
  original_price:   number | null,
): Promise<PackageFormState> {
  try {
    await db.package_pricing.upsert({
      where: {
        package_id_duration_id_route_index_stay_category_id: {
          package_id, duration_id, route_index, stay_category_id,
        },
      },
      create: { package_id, duration_id, route_index, stay_category_id, price, original_price, is_active: true },
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
  package_id:  number,
  duration_id: number,
  day:         number,
  data: {
    title:        string;
    description:  string;
    hotel_id:     number | null;
    hotel_days:   number | null;
    activity_ids: number[];
    meals:        string[];
    route_index:  number | null;
  },
): Promise<PackageFormState> {
  try {
    const existing = await db.package_itineraries.findFirst({
      where: { package_id, duration_id, day },
    });

    const payload = {
      title:        data.title,
      description:  data.description || null,
      hotel_id:     data.hotel_id,
      hotel_days:   data.hotel_days,
      activity_ids: data.activity_ids,
      meals:        data.meals,
      route_index:  data.route_index,
      activities:   [],
    };

    if (existing) {
      await db.package_itineraries.update({ where: { id: existing.id }, data: payload });
    } else {
      await db.package_itineraries.create({ data: { package_id, duration_id, day, ...payload } });
    }

    revalidatePath(`/dashboard/packages/${package_id}`);
    return { success: true, message: "Day saved" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

export async function clearItineraryDay(package_id: number, duration_id: number, day: number): Promise<PackageFormState> {
  try {
    await db.package_itineraries.deleteMany({ where: { package_id, duration_id, day } });
    revalidatePath(`/dashboard/packages/${package_id}`);
    return { success: true, message: "Day cleared" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

// ── Policies ──────────────────────────────────────────────────────────────

export async function assignPolicy(package_id: number, policy_id: number): Promise<PackageFormState> {
  try {
    await db.package_policy_map.upsert({
      where:  { package_id_policy_id: { package_id, policy_id } },
      create: { package_id, policy_id },
      update: {},
    });
    revalidatePath(`/dashboard/packages/${package_id}`);
    return { success: true, message: "Policy assigned" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

export async function removePolicy(package_id: number, policy_id: number): Promise<PackageFormState> {
  try {
    await db.package_policy_map.delete({
      where: { package_id_policy_id: { package_id, policy_id } },
    });
    revalidatePath(`/dashboard/packages/${package_id}`);
    return { success: true, message: "Policy removed" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

// ── Tags & Categories ─────────────────────────────────────────────────────

export async function updatePackageTags(package_id: number, tag_ids: number[]): Promise<PackageFormState> {
  try {
    await db.$transaction([
      db.package_tags.deleteMany({ where: { package_id } }),
      ...(tag_ids.length > 0 ? [db.package_tags.createMany({ data: tag_ids.map(tag_id => ({ package_id, tag_id })) })] : []),
    ]);
    revalidatePath(`/dashboard/packages/${package_id}`);
    return { success: true, message: "Tags updated" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

export async function updatePackageCategories(package_id: number, category_ids: number[]): Promise<PackageFormState> {
  try {
    await db.$transaction([
      db.package_categories.deleteMany({ where: { package_id } }),
      ...(category_ids.length > 0 ? [db.package_categories.createMany({ data: category_ids.map(category_id => ({ package_id, category_id })) })] : []),
    ]);
    revalidatePath(`/dashboard/packages/${package_id}`);
    return { success: true, message: "Categories updated" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

// ── Images ────────────────────────────────────────────────────────────────

export async function addPackageImages(package_id: number, images: { url: string; thumbnail?: string }[]): Promise<PackageFormState> {
  try {
    const existing = await db.package_images.count({ where: { package_id } });
    await db.package_images.createMany({
      data: images.map((img, i) => ({
        package_id,
        url:        img.url,
        thumbnail:  img.thumbnail || img.url,
        sort_order: existing + i,
        is_primary: existing === 0 && i === 0,
      })),
    });
    revalidatePath(`/dashboard/packages/${package_id}`);
    return { success: true, message: "Images added" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

export async function deletePackageImage(id: number, package_id: number, url: string, thumbnail?: string): Promise<PackageFormState> {
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