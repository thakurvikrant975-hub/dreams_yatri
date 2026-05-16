"use server";

import { db }                  from "@/app/lib/db";
import { deleteFromR2 }        from "@/app/lib/r2/r2delete";
import { revalidatePath }      from "next/cache";
import { dashboardAuth }       from "@/app/lib/auth-dashboard";
import { DestinationSchema }   from "@/app/lib/validators/destinations";
import { createLog }           from "../lib/logger";

// ── Auth helper ───────────────────────────────────────────────────────────────

async function requireActor(): Promise<string | null> {
  const session = await dashboardAuth();
  if (!session?.user?.email) return null;
  return session.user.name ?? session.user.email;
}

export type DestinationFormState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
};

// ── Read ──────────────────────────────────────────────────────────────────────

export type GetDestinationsParams = {
  page?:      number;
  limit?:     number;
  search?:    string;
  region_id?: number;
  status?:    "active" | "inactive" | "all";
};

export async function getDestinations(params: GetDestinationsParams = {}) {
  const { page = 1, limit = 10, search = "", region_id, status = "all" } = params;
  const skip = (page - 1) * limit;

  const baseWhere  = { is_deleted: false } as const;
  const filterWhere = {
    is_deleted: false,
    ...(search ? {
      OR: [
        { name:    { contains: search, mode: "insensitive" as const } },
        { slug:    { contains: search, mode: "insensitive" as const } },
        { country: { contains: search, mode: "insensitive" as const } },
      ],
    } : {}),
    ...(region_id ? { region_id } : {}),
    ...(status === "active"   ? { is_active: true  } : {}),
    ...(status === "inactive" ? { is_active: false } : {}),
  };

  const [rows, totalCount, activeCount, totalPackages] = await Promise.all([
    db.destinations.findMany({
      where:   filterWhere,
      orderBy: { created_at: "desc" },
      skip,
      take:    limit,
      include: {
        region: { select: { id: true, name: true, slug: true } },
        _count: { select: { packages: true, hotels: true, activities: true } },
      },
    }),
    db.destinations.count({ where: filterWhere }),
    db.destinations.count({ where: { ...baseWhere, is_active: true } }),
    db.packages.count({ where: { destination: { is_deleted: false } } }),
  ]);

  const totalCount_all = status === "all" && !search && !region_id
    ? totalCount
    : await db.destinations.count({ where: baseWhere });

  return {
    destinations: rows.map((d) => ({
      ...d,
      latitude:  d.latitude  != null ? Number(d.latitude)  : null,
      longitude: d.longitude != null ? Number(d.longitude) : null,
    })),
    totalCount,
    stats: {
      total:    totalCount_all,
      active:   activeCount,
      inactive: totalCount_all - activeCount,
      packages: totalPackages,
    },
  };
}

export async function getDestinationById(id: number) {
  const d = await db.destinations.findUnique({
    where: { id },
    include: { region: { select: { id: true, name: true } } },
  });
  if (!d) return null;
  return {
    ...d,
    latitude:  d.latitude  != null ? Number(d.latitude)  : null,
    longitude: d.longitude != null ? Number(d.longitude) : null,
  };
}

export async function getRegionsForSelect() {
  return db.custom_regions.findMany({
    where:   { is_active: true, is_deleted: false },
    orderBy: { name: "asc" },
    select:  { id: true, name: true, slug: true },
  });
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createDestination(
  _prev: DestinationFormState,
  formData: FormData,
): Promise<DestinationFormState> {
  const actor = await requireActor();
  if (!actor) return { success: false, message: "Unauthorized" };

  const raw = {
    name:        formData.get("name")        as string,
    slug:        formData.get("slug")        as string,
    country:     formData.get("country")     as string,
    region_id:   Number(formData.get("region_id")),
    description: (formData.get("description") as string) || undefined,
    meta_title:  (formData.get("meta_title")  as string) || undefined,
    meta_desc:   (formData.get("meta_desc")   as string) || undefined,
    is_active:   formData.get("is_active") === "true",
    location_id: (formData.get("location_id") as string) || undefined,
    thumbnail:   (formData.get("thumbnail")   as string) || "",
    cover_image: (formData.get("cover_image") as string) || undefined,
  };

  const parsed = DestinationSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const existing = await db.destinations.findUnique({ where: { slug: parsed.data.slug } });
    if (existing) {
      return { success: false, message: "Slug already exists", errors: { slug: ["This slug is already taken"] } };
    }

    const created = await db.destinations.create({
      data: {
        ...parsed.data,
        location_id: parsed.data.location_id ?? null,
        cover_image:  parsed.data.cover_image  ?? null,
        created_by:  actor,
      },
    });

    await createLog({
      action:     "CREATE",
      entity:     "destination",
      entityId:   String(created.id),
      entitySlug: created.slug,
      newData:    { name: created.name, slug: created.slug, country: created.country },
    });

    revalidatePath("/dashboard/destinations");
    return { success: true, message: "Destination created successfully" };
  } catch {
    return { success: false, message: "Database error. Please try again." };
  }
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateDestination(
  id: number,
  _prev: DestinationFormState,
  formData: FormData,
): Promise<DestinationFormState> {
  const actor = await requireActor();
  if (!actor) return { success: false, message: "Unauthorized" };

  const current = await db.destinations.findUnique({ where: { id } });
  if (!current) return { success: false, message: "Destination not found" };

  // For updates: use the incoming thumbnail if provided, otherwise fall back to the existing one
  const incomingThumbnail  = (formData.get("thumbnail")   as string) || "";
  const incomingCoverImage = (formData.get("cover_image") as string) || undefined;
  const effectiveThumbnail = incomingThumbnail || current.thumbnail || "";

  const raw = {
    name:        formData.get("name")        as string,
    slug:        formData.get("slug")        as string,
    country:     formData.get("country")     as string,
    region_id:   Number(formData.get("region_id")),
    description: (formData.get("description") as string) || undefined,
    meta_title:  (formData.get("meta_title")  as string) || undefined,
    meta_desc:   (formData.get("meta_desc")   as string) || undefined,
    is_active:   formData.get("is_active") === "true",
    location_id: (formData.get("location_id") as string) || undefined,
    thumbnail:   effectiveThumbnail,
    cover_image: incomingCoverImage,
  };

  const parsed = DestinationSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const slugConflict = await db.destinations.findFirst({
      where: { slug: parsed.data.slug, NOT: { id } },
    });
    if (slugConflict) {
      return { success: false, message: "Slug already taken", errors: { slug: ["This slug is already taken"] } };
    }

    // Delete replaced R2 assets
    if (incomingThumbnail && current.thumbnail && incomingThumbnail !== current.thumbnail)
      await deleteFromR2(current.thumbnail).catch(console.error);
    if (incomingCoverImage && current.cover_image && incomingCoverImage !== current.cover_image)
      await deleteFromR2(current.cover_image).catch(console.error);

    await db.destinations.update({
      where: { id },
      data: {
        ...parsed.data,
        location_id: parsed.data.location_id ?? null,
        cover_image:  parsed.data.cover_image  ?? null,
        updated_by:  actor,
      },
    });

    await createLog({
      action:       "UPDATE",
      entity:       "destination",
      entityId:     String(id),
      entitySlug:   parsed.data.slug,
      previousData: { name: current.name, country: current.country, is_active: current.is_active },
      newData:      { name: parsed.data.name, country: parsed.data.country, is_active: parsed.data.is_active },
    });

    revalidatePath("/dashboard/destinations");
    return { success: true, message: "Destination updated successfully" };
  } catch {
    return { success: false, message: "Database error. Please try again." };
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteDestination(id: number): Promise<DestinationFormState> {
  const actor = await requireActor();
  if (!actor) return { success: false, message: "Unauthorized" };

  try {
    const destination = await db.destinations.findUnique({
      where:   { id },
      include: {
        _count: { select: { packages: true, hotels: true, activities: true } },
        packages:   { select: { title: true }, take: 5 },
        hotels:     { select: { name: true }, take: 5 },
        activities: { select: { name: true }, take: 5 },
      },
    });

    if (!destination) return { success: false, message: "Destination not found" };

    const linkedCount = destination._count.packages + destination._count.hotels + destination._count.activities;
    if (linkedCount > 0) {
      const names: string[] = [
        ...destination.packages.map((p) => `Package: ${p.title}`),
        ...destination.hotels.map((h) => `Hotel: ${h.name}`),
        ...destination.activities.map((a) => `Activity: ${a.name}`),
      ];
      const remaining = linkedCount - names.length;
      const nameList = names.join(", ") + (remaining > 0 ? `, and ${remaining} more` : "");
      return {
        success: false,
        message: `Cannot delete — linked to: ${nameList}. Remove them first.`,
      };
    }

    // Soft-delete: stamp audit fields, preserve data for audit history
    await db.destinations.update({
      where: { id },
      data: { is_deleted: true, deleted_by: actor, deleted_at: new Date(), is_active: false },
    });

    await createLog({
      action:       "DELETE",
      entity:       "destination",
      entityId:     String(id),
      entitySlug:   destination.slug,
      previousData: { name: destination.name, slug: destination.slug, country: destination.country },
    });

    // Clean up R2 assets after soft-delete stamp
    if (destination.thumbnail)   await deleteFromR2(destination.thumbnail).catch(console.error);
    if (destination.cover_image) await deleteFromR2(destination.cover_image).catch(console.error);

    revalidatePath("/dashboard/destinations");
    return { success: true, message: "Destination deleted successfully" };
  } catch {
    return { success: false, message: "Database error. Please try again." };
  }
}

// ── History ───────────────────────────────────────────────────────────────────

export async function getDestinationHistory(id: number) {
  return db.activityLog.findMany({
    where:   { entity: "destination", entityId: String(id) },
    orderBy: { actionAt: "desc" },
    select: {
      id:          true,
      action:      true,
      description: true,
      userName:    true,
      userEmail:   true,
      previousData: true,
      newData:      true,
      metadata:     true,
      status:      true,
      actionAt:    true,
    },
    take: 50,
  });
}

// ── Toggle Active ─────────────────────────────────────────────────────────────

export async function toggleDestinationActive(
  id: number,
  is_active: boolean,
): Promise<DestinationFormState> {
  const actor = await requireActor();
  if (!actor) return { success: false, message: "Unauthorized" };

  try {
    const row = await db.destinations.findUnique({
      where:  { id },
      select: { slug: true, meta_title: true, meta_desc: true },
    });

    if (is_active && (!row?.meta_title || !row?.meta_desc)) {
      return {
        success: false,
        message: "Cannot activate — SEO title and description are required first.",
      };
    }

    await db.destinations.update({ where: { id }, data: { is_active, updated_by: actor } });

    await createLog({
      action:     "UPDATE",
      entity:     "destination",
      entityId:   String(id),
      entitySlug: row?.slug,
      newData:    { is_active },
      metadata:   { operation: "toggle_active" },
    });

    revalidatePath("/dashboard/destinations");
    return { success: true, message: `Destination ${is_active ? "activated" : "deactivated"}` };
  } catch {
    return { success: false, message: "Database error. Please try again." };
  }
}
