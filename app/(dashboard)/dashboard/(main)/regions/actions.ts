"use server";

import { db }                   from "@/app/lib/db";
import { deleteFromR2 }         from "@/app/lib/r2/r2delete";
import { revalidatePath }       from "next/cache";
import { Ok, Result }           from "@/app/lib/result";
import { RegionSchema }         from "@/app/lib/validators/regions";
import { RegionInput }          from "@/app/lib/validators/regions";
import { dashboardAuth }        from "@/app/lib/auth-dashboard";
import { createLog }            from "../lib/logger";
import { classifyActionError }  from "@/app/lib/action-error";

// ── Shared FormState type ─────────────────────────────────────────────────────
export type RegionFormState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
};

// ── Auth guard — call at the top of every mutating action ─────────────────────
async function requireSession() {
  const session = await dashboardAuth();
  if (!session?.user?.email) {
    return { session: null, actorId: null, actorName: null, error: Result.unauthorized() };
  }
  const actorId   = session.user.id;
  const actorName = session.user.name ?? session.user.email;
  return { session, actorId, actorName, error: null };
}

// ── Internal helper: FormData → raw object ────────────────────────────────────
function extractRegionFields(formData: FormData) {
  return {
    name:        formData.get("name")        as string,
    slug:        formData.get("slug")        as string,
    country:     formData.get("country")     as string,
    description: (formData.get("description") as string) || undefined,
    meta_title:  (formData.get("meta_title")  as string) || undefined,
    meta_desc:   (formData.get("meta_desc")   as string) || undefined,
    is_active:   formData.get("is_active") === "true",
    thumbnail:   formData.get("thumbnail")   as string,
    cover_image: (formData.get("cover_image") as string) || undefined,
  };
}

// ── Internal helper: Result<T> → RegionFormState ──────────────────────────────
function toFormState(result: Result<string>): RegionFormState {
  if (result.success) return { success: true, message: result.data };
  return { success: false, message: result.error.message };
}

// ── Slug availability check ───────────────────────────────────────────────────
export async function checkSlugAvailability(
  slug: string,
): Promise<{ exists: boolean; suggestion: string }> {
  if (!slug) return { exists: false, suggestion: slug };

  const existing = await db.custom_regions.findFirst({ where: { slug } });
  if (!existing) return { exists: false, suggestion: slug };

  let counter = 2;
  let candidate = `${slug}-${counter}`;
  while (counter < 100) {
    const conflict = await db.custom_regions.findFirst({ where: { slug: candidate } });
    if (!conflict) break;
    counter++;
    candidate = `${slug}-${counter}`;
  }

  return { exists: true, suggestion: candidate };
}

// ── Read ──────────────────────────────────────────────────────────────────────

export type GetRegionsParams = {
  page?:        number;
  limit?:       number;
  search?:      string;
  country?:     string;
  status?:      "active" | "inactive" | "all";
  destCount?:   "0" | "1-5" | "6-15" | "15+" | "all";
};

export async function getRegions(params: GetRegionsParams = {}) {
  const { error } = await requireSession();
  if (error) return {
    regions:     [],
    totalPages:  0,
    currentPage: params.page ?? 1,
    limit:       params.limit ?? 10,
    totalCount:  0,
    memberNames: {} as Record<string, string>,
    stats:       { total: 0, active: 0, inactive: 0, destinations: 0 },
  };

  const {
    page      = 1,
    limit     = 10,
    search    = "",
    country   = "",
    status    = "all",
    destCount = "all",
  } = params;

  const skip = (page - 1) * limit;

  const where = {
    is_deleted: false,
    ...(search  ? { name: { contains: search, mode: "insensitive" as const } } : {}),
    ...(country ? { country: { equals: country, mode: "insensitive" as const } } : {}),
    ...(status === "active"   ? { is_active: true  } : {}),
    ...(status === "inactive" ? { is_active: false } : {}),
  };

  const [regions, filteredCount, totalCount, activeCount, destinationCount] =
    await Promise.all([
      db.custom_regions.findMany({
        where,
        skip,
        take: limit,
        include: { _count: { select: { destinations: true } } },
        orderBy: { created_at: "desc" },
      }),
      db.custom_regions.count({ where }),
      db.custom_regions.count({ where: { is_deleted: false } }),
      db.custom_regions.count({ where: { is_deleted: false, is_active: true } }),
      db.destinations.count(),
    ]);

  // Apply destination count filter in-memory (small result set after other filters)
  const filtered = destCount === "all" ? regions : regions.filter((r) => {
    const c = r._count.destinations;
    if (destCount === "0")    return c === 0;
    if (destCount === "1-5")  return c >= 1  && c <= 5;
    if (destCount === "6-15") return c >= 6  && c <= 15;
    if (destCount === "15+")  return c > 15;
    return true;
  });

  // Resolve created_by / updated_by IDs to team member names
  const actorIds = [...new Set(
    filtered.flatMap((r) => [r.created_by, r.updated_by]).filter(Boolean) as string[]
  )];
  const members = actorIds.length > 0
    ? await db.teamMember.findMany({
        where:  { id: { in: actorIds } },
        select: { id: true, name: true },
      })
    : [];
  const memberNames: Record<string, string> = Object.fromEntries(
    members.map((m) => [m.id, m.name])
  );

  return {
    regions: filtered,
    totalPages:  Math.ceil(filteredCount / limit),
    currentPage: page,
    limit,
    totalCount:  filteredCount,
    memberNames,
    stats: {
      total:        totalCount,
      active:       activeCount,
      inactive:     totalCount - activeCount,
      destinations: destinationCount,
    },
  };
}

// ── History ───────────────────────────────────────────────────────────────────

export async function getRegionHistory(id: number) {
  return db.activityLog.findMany({
    where:   { entity: "Region", entityId: String(id) },
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

// ── Create ────────────────────────────────────────────────────────────────────
export async function createRegion(
  _prev: RegionFormState,
  formData: FormData,
): Promise<RegionFormState> {
  const { actorId, error } = await requireSession();
  if (error) return toFormState(error);

  const parsed = RegionSchema.safeParse(extractRegionFields(formData));
  if (!parsed.success) {
    return {
      success: false,
      message: "Validation failed",
      errors:  parsed.error.flatten().fieldErrors,
    };
  }

  const result = await createRegionRecord(parsed.data, actorId!);
  return toFormState(result);
}

async function createRegionRecord(
  data: RegionInput,
  actorId: string,
): Promise<Result<string>> {
  try {
    const existing = await db.custom_regions.findUnique({ where: { slug: data.slug } });
    if (existing) return Result.conflict("This slug is already taken");

    const region = await db.custom_regions.create({
      data: {
        name:        data.name,
        slug:        data.slug,
        country:     data.country,
        description: data.description ?? null,
        meta_title:  data.meta_title  ?? null,
        meta_desc:   data.meta_desc   ?? null,
        is_active:   data.is_active,
        thumbnail:   data.thumbnail,
        cover_image: data.cover_image ?? null,
        created_by:  actorId,
        updated_by:  actorId,
      },
    });

    await createLog({
      action:     "CREATE",
      entity:     "Region",
      entityId:   String(region.id),
      entitySlug: region.slug,
      newData:    { name: region.name, country: region.country, is_active: region.is_active },
    });

    revalidatePath("/dashboard/regions");
    return Ok("Region created successfully");
  } catch (e) {
    console.error("[createRegion]", e);
    return { success: false, error: { code: "DB_ERROR" as const, message: classifyActionError(e).message } };
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
export async function updateRegion(
  id: number,
  _prev: RegionFormState,
  formData: FormData,
): Promise<RegionFormState> {
  const { actorId, error } = await requireSession();
  if (error) return toFormState(error);

  const parsed = RegionSchema.safeParse(extractRegionFields(formData));
  if (!parsed.success) {
    return {
      success: false,
      message: "Validation failed",
      errors:  parsed.error.flatten().fieldErrors,
    };
  }

  const result = await updateRegionRecord(id, parsed.data, actorId!);
  return toFormState(result);
}

async function updateRegionRecord(
  id: number,
  data: RegionInput,
  actorId: string,
): Promise<Result<string>> {
  try {
    const slugConflict = await db.custom_regions.findFirst({
      where: { slug: data.slug, NOT: { id } },
    });
    if (slugConflict) return Result.conflict("This slug is already taken");

    const current = await db.custom_regions.findUnique({ where: { id } });
    if (!current) return Result.notFound("Region");

    await db.custom_regions.update({
      where: { id },
      data: {
        name:        data.name,
        slug:        data.slug,
        country:     data.country,
        description: data.description ?? null,
        meta_title:  data.meta_title  ?? null,
        meta_desc:   data.meta_desc   ?? null,
        is_active:   data.is_active,
        thumbnail:   data.thumbnail,
        cover_image: data.cover_image ?? null,
        updated_by:  actorId,
      },
    });

    // Prune replaced R2 assets after confirmed DB success
    if (data.thumbnail && current.thumbnail && data.thumbnail !== current.thumbnail) {
      await deleteFromR2(current.thumbnail).catch(console.error);
    }
    if (data.cover_image && current.cover_image && data.cover_image !== current.cover_image) {
      await deleteFromR2(current.cover_image).catch(console.error);
    }

    await createLog({
      action:       "UPDATE",
      entity:       "Region",
      entityId:     String(id),
      entitySlug:   data.slug,
      previousData: { name: current.name, is_active: current.is_active },
      newData:      { name: data.name,    is_active: data.is_active },
    });

    revalidatePath("/dashboard/regions");
    return Ok("Region updated successfully");
  } catch (e) {
    console.error("[updateRegion]", e);
    return { success: false, error: { code: "DB_ERROR" as const, message: classifyActionError(e).message } };
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────
export async function deleteRegion(id: number): Promise<RegionFormState> {
  const { actorId, error } = await requireSession();
  if (error) return toFormState(error);

  const result = await deleteRegionRecord(id, actorId!);
  return toFormState(result);
}

async function deleteRegionRecord(
  id: number,
  actorId: string,
): Promise<Result<string>> {
  try {
    const region = await db.custom_regions.findUnique({
      where:   { id },
      include: { destinations: { select: { name: true }, take: 5 } },
    });

    if (!region) return Result.notFound("Region");

    if (region.destinations.length > 0) {
      const names = region.destinations.map((d) => d.name).join(", ");
      const total = await db.destinations.count({ where: { region_id: id } });
      const extra = total > 5 ? ` and ${total - 5} more` : "";
      return Result.conflict(
        `Cannot delete — linked to ${total} destination(s): ${names}${extra}. Remove them first.`
      );
    }

    // Stamp audit fields before hard delete
    await db.custom_regions.update({
      where: { id },
      data:  { deleted_by: actorId, deleted_at: new Date(), is_deleted: true },
    });

    if (region.thumbnail)   await deleteFromR2(region.thumbnail).catch(console.error);
    if (region.cover_image) await deleteFromR2(region.cover_image).catch(console.error);

    await db.custom_regions.delete({ where: { id } });

    await createLog({
      action:     "DELETE",
      entity:     "Region",
      entityId:   String(id),
      entitySlug: region.slug,
      severity:   "MEDIUM",
      previousData: { name: region.name, country: region.country },
    });

    revalidatePath("/dashboard/regions");
    return Ok("Region deleted successfully");
  } catch (e) {
    console.error("[deleteRegion]", e);
    return { success: false, error: { code: "DB_ERROR" as const, message: classifyActionError(e).message } };
  }
}

// ── Toggle Active ─────────────────────────────────────────────────────────────
export async function toggleRegionActive(
  id: number,
  is_active: boolean,
): Promise<RegionFormState> {
  const { actorId, error } = await requireSession();
  if (error) return toFormState(error);

  try {
    const region = await db.custom_regions.findUnique({ where: { id } });
    if (!region) return toFormState(Result.notFound("Region"));

    // Cannot activate without SEO
    if (is_active && (!region.meta_title || !region.meta_desc)) {
      return {
        success: false,
        message: "Cannot activate — SEO title and description are required first.",
      };
    }

    await db.custom_regions.update({
      where: { id },
      data:  { is_active, updated_by: actorId },
    });

    await createLog({
      action:     "UPDATE",
      entity:     "Region",
      entityId:   String(id),
      entitySlug: region.slug,
      metadata:   { operation: "toggle_active" },
      newData:    { isActive: is_active },
    });

    revalidatePath("/dashboard/regions");
    return { success: true, message: `Region ${is_active ? "activated" : "deactivated"}` };
  } catch (e) {
    return toFormState(Result.dbError(e));
  }
}
