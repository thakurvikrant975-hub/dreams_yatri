"use server";

import { db }                  from "@/app/lib/db";
import { deleteFromR2 }        from "@/app/lib/r2/r2delete";
import { revalidatePath }      from "next/cache";
import { dashboardAuth }       from "@/app/lib/auth-dashboard";
import { DestinationSchema }   from "@/app/lib/validators/destinations";

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

export async function getDestinations() {
  const rows = await db.destinations.findMany({
    where:   { is_deleted: false },
    orderBy: { created_at: "desc" },
    include: {
      region: { select: { id: true, name: true, slug: true } },
      _count: {
        select: { packages: true, hotels: true, activities: true },
      },
    },
  });
  return rows.map((d) => ({
    ...d,
    latitude:  d.latitude  != null ? Number(d.latitude)  : null,
    longitude: d.longitude != null ? Number(d.longitude) : null,
  }));
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

    await db.destinations.create({
      data: {
        ...parsed.data,
        location_id: parsed.data.location_id ?? null,
        cover_image:  parsed.data.cover_image  ?? null,
        created_by:  actor,
      },
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

    // Clean up R2 assets after soft-delete stamp
    if (destination.thumbnail)   await deleteFromR2(destination.thumbnail).catch(console.error);
    if (destination.cover_image) await deleteFromR2(destination.cover_image).catch(console.error);

    revalidatePath("/dashboard/destinations");
    return { success: true, message: "Destination deleted successfully" };
  } catch {
    return { success: false, message: "Database error. Please try again." };
  }
}

// ── Toggle Active ─────────────────────────────────────────────────────────────

export async function toggleDestinationActive(
  id: number,
  is_active: boolean,
): Promise<DestinationFormState> {
  const actor = await requireActor();
  if (!actor) return { success: false, message: "Unauthorized" };

  try {
    if (is_active) {
      const dest = await db.destinations.findUnique({
        where:  { id },
        select: { meta_title: true, meta_desc: true },
      });
      if (!dest?.meta_title || !dest?.meta_desc) {
        return {
          success: false,
          message: "Cannot activate — SEO title and description are required first.",
        };
      }
    }

    await db.destinations.update({ where: { id }, data: { is_active, updated_by: actor } });
    revalidatePath("/dashboard/destinations");
    return { success: true, message: `Destination ${is_active ? "activated" : "deactivated"}` };
  } catch {
    return { success: false, message: "Database error. Please try again." };
  }
}
