"use server";

import { db }                  from "@/app/lib/db";
import { deleteFromR2 }        from "@/app/lib/r2/r2delete";
import { revalidatePath }      from "next/cache";
import { dashboardAuth }       from "@/app/lib/auth-dashboard";
import { ActivitySchema, ActivityUpdateSchema } from "@/app/lib/validators/activities";
import { actionError }         from "@/app/lib/action-error";
import { createLog }           from "../lib/logger";

// ── Auth helper ───────────────────────────────────────────────────────────

async function requireActor(): Promise<string | null> {
    const session = await dashboardAuth();
    if (!session?.user?.email) return null;
    return session.user.name ?? session.user.email;
}

// ── Types ─────────────────────────────────────────────────────────────────

export type ActivityFormState = {
    success: boolean;
    message: string;
    errors?: Record<string, string[]>;
    id?:     number;
    images?: ActivityImage[];
};

export type ActivityImage = {
    id:         number;
    url:        string;
    thumbnail:  string | null;
    is_primary: boolean;
    sort_order: number;
    label:      string | null;
};

export type ActivityCategory = {
    id:   number;
    name: string;
    slug: string;
};

export type ActivityItem = {
    id:             number;
    name:           string;
    slug:           string;
    description:    string | null;
    category_id:    number | null;
    difficulty:     string | null;
    duration_hours: number | null;
    address:        string | null;
    city:           string | null;
    state:          string | null;
    country:        string | null;
    pincode:        string | null;
    has_location:   boolean;
    location:       { name: string; city: { name: string } | null; state: { name: string } | null; country: { name: string } | null } | null;
    phone:          string | null;
    email:          string | null;
    is_active:      boolean;
    created_at:     Date;
    category:       ActivityCategory | null;
    images:         ActivityImage[];
    _count:         { images: number; variants: number };
};

export type ActivityVariantSeasonPricing = {
    id:                number;
    season_id:         number;
    label:             string;
    age_from:          number | null;
    age_to:            number | null;
    price:             number;
    original_price:    number | null;
    margin_percentage: number;
    is_active:         boolean;
    sort_order?:       number;
};

export type ActivityVariantSeason = {
    id:            number;
    variant_id:    number;
    season_name:   string;
    valid_from:    Date | string;
    valid_to:      Date | string;
    weekend_price: number | null;
    is_active:     boolean;
    sort_order:    number;
    pricing:       ActivityVariantSeasonPricing[];
};

export type ActivityVariant = {
    id:             number;
    activity_id:    number;
    name:           string;
    booking_mode:   string;
    pricing_type:   string;
    min_persons:    number | null;
    max_persons:    number | null;
    cost_price:     number | null;
    gst_percentage: number;
    valid_from:     Date | null;
    valid_to:       Date | null;
    is_active:      boolean;
    sort_order:     number;
    pricing:        ActivityVariantPricing[];
    seasons:        ActivityVariantSeason[];
};

export type ActivityVariantPricing = {
    id:                number;
    variant_id:        number;
    label:             string;
    age_from:          number | null;
    age_to:            number | null;
    price:             number;
    original_price:    number | null;
    margin_percentage: number;
    is_active:         boolean;
    sort_order:        number;
};

export type ActivityAddon = {
    id:           number;
    activity_id:  number;
    title:        string;
    description:  string | null;
    pricing_type: string;
    price:        number;
    cost_price:   number | null;
    is_optional:  boolean;
    is_active:    boolean;
    sort_order:   number;
};

export type GetActivitiesParams = {
    page?:        number;
    limit?:       number;
    search?:      string;
    category_id?: number | "all";
    status?:      "active" | "inactive" | "all";
};

// ── Read ──────────────────────────────────────────────────────────────────

const ACTIVITY_INCLUDE = {
    category: { select: { id: true, name: true, slug: true } },
    images: {
        orderBy: { sort_order: "asc" as const },
        select:  { id: true, url: true, thumbnail: true, is_primary: true, sort_order: true, label: true },
    },
    _count: { select: { images: true, variants: true } },
    location: { select: { name: true, city: { select: { name: true } }, state: { select: { name: true } }, country: { select: { name: true } } } },
} as const;

export async function getActivities(params: GetActivitiesParams = {}) {
    const {
        page        = 1,
        limit       = 10,
        search      = "",
        category_id = "all",
        status      = "all",
    } = params;

    const skip        = (page - 1) * limit;
    const isFiltering = !!(search || category_id !== "all" || status !== "all");

    const where = {
        ...(search ? {
            OR: [
                { name:     { contains: search, mode: "insensitive" as const } },
                { city:     { contains: search, mode: "insensitive" as const } },
                { state:    { contains: search, mode: "insensitive" as const } },
                { location: { name:    { contains: search, mode: "insensitive" as const } } },
                { location: { city:    { name: { contains: search, mode: "insensitive" as const } } } },
                { location: { state:   { name: { contains: search, mode: "insensitive" as const } } } },
                { location: { country: { name: { contains: search, mode: "insensitive" as const } } } },
            ],
        } : {}),
        ...(category_id !== "all" ? { category_id: category_id as number } : {}),
        ...(status === "active"   ? { is_active: true  }                   : {}),
        ...(status === "inactive" ? { is_active: false }                   : {}),
    };

    const [activities, totalCount, statsTotal, statsActive, statsWithVariants] =
        await Promise.all([
            db.activities.findMany({
                where,
                orderBy: { created_at: "desc" },
                skip,
                take:    limit,
                include: ACTIVITY_INCLUDE,
            }),
            db.activities.count({ where }),
            db.activities.count(),
            db.activities.count({ where: { is_active: true } }),
            db.activities.count({ where: { variants: { some: {} } } }),
        ]);

    return {
        activities: activities.map(({ location_id, ...a }) => ({
            ...a,
            duration_hours: a.duration_hours ? Number(a.duration_hours) : null,
            has_location: location_id != null,
        })) as ActivityItem[],
        totalCount,
        isFiltering,
        stats: {
            total:        statsTotal,
            active:       statsActive,
            inactive:     statsTotal - statsActive,
            withVariants: statsWithVariants,
        },
    };
}

export async function getActivityWithVariants(id: number) {
    const baseInclude = {
        category: { select: { id: true, name: true, slug: true } },
        images: {
            orderBy: { sort_order: "asc" } as const,
            select:  { id: true, url: true, thumbnail: true, is_primary: true, sort_order: true, label: true },
        },
        addons: { orderBy: { sort_order: "asc" } as const },
        location: {
            select: {
                id:        true,
                name:      true,
                type:      true,
                slug:      true,
                latitude:  true,
                longitude: true,
                state:   { select: { name: true } },
                country: { select: { name: true } },
            },
        },
    } as const;

    const variantsWithSeasons = {
        orderBy: { sort_order: "asc" } as const,
        include: {
            pricing: { orderBy: { sort_order: "asc" } as const },
            seasons: {
                orderBy: { sort_order: "asc" } as const,
                include: { pricing: { orderBy: { sort_order: "asc" } as const } },
            },
        },
    } as const;

    const variantsNoSeasons = {
        orderBy: { sort_order: "asc" } as const,
        include: { pricing: { orderBy: { sort_order: "asc" } as const } },
    } as const;

    type ActivityFull = Awaited<ReturnType<typeof db.activities.findUnique<{
        where: { id: number };
        include: typeof baseInclude & { variants: typeof variantsWithSeasons };
    }>>>;

    let activity: ActivityFull = null;

    try {
        activity = await db.activities.findUnique({
            where: { id },
            include: { ...baseInclude, variants: variantsWithSeasons },
        });
    } catch (e: unknown) {
        const err = e as Record<string, unknown>;
        if (err?.code !== "P2021") throw e;
        // activity_variant_seasons table not yet in production — fetch without seasons
        const partial = await db.activities.findUnique({
            where: { id },
            include: { ...baseInclude, variants: variantsNoSeasons },
        });
        activity = partial
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? ({ ...partial, variants: partial.variants.map((v: any) => ({ ...v, seasons: [] })) } as ActivityFull)
            : null;
    }

    if (!activity) return null;
    return {
        ...activity,
        duration_hours: activity.duration_hours ? Number(activity.duration_hours) : null,
        variants: activity.variants.map(v => ({
            ...v,
            cost_price:     v.cost_price     ? Number(v.cost_price)     : null,
            gst_percentage: Number(v.gst_percentage),
            pricing: v.pricing.map(p => ({
                ...p,
                price:             Number(p.price),
                original_price:    p.original_price ? Number(p.original_price) : null,
                margin_percentage: Number(p.margin_percentage),
            })),
        })),
        addons: activity.addons.map(a => ({
            ...a,
            price:      Number(a.price),
            cost_price: a.cost_price ? Number(a.cost_price) : null,
        })),
    };
}

export async function getCategoriesForSelect() {
    return db.activity_categories.findMany({
        where:   { is_active: true },
        orderBy: [{ sort_order: "asc" }, { name: "asc" }],
        select:  { id: true, name: true, slug: true },
    });
}

// ── Slug check ────────────────────────────────────────────────────────────

export async function checkActivitySlug(slug: string): Promise<{
    status:      "available" | "active_taken" | "inactive_exists";
    suggestion?: string;
    existingId?: number;
}> {
    if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
        return { status: "available" };
    }

    const existing = await db.activities.findUnique({
        where:  { slug },
        select: { id: true, is_active: true },
    });

    if (!existing) return { status: "available" };

    if (!existing.is_active) {
        return { status: "inactive_exists", existingId: existing.id };
    }

    // Active record taken — find the next available suggestion
    let counter = 2;
    let suggestion = "";
    while (counter <= 99) {
        suggestion = `${slug}-${counter}`;
        const conflict = await db.activities.findUnique({
            where:  { slug: suggestion },
            select: { id: true, is_active: true },
        });
        if (!conflict || !conflict.is_active) break;
        counter++;
    }

    return { status: "active_taken", suggestion };
}

// ── Create ────────────────────────────────────────────────────────────────

export async function createActivity(
    _prev: ActivityFormState,
    formData: FormData,
): Promise<ActivityFormState> {
    const actor = await requireActor();
    if (!actor) return { success: false, message: "Unauthorized" };

    const raw = {
        name:           formData.get("name"),
        slug:           formData.get("slug"),
        category_id:    formData.get("category_id") || undefined,
        description:    formData.get("description")    || undefined,
        difficulty:     formData.get("difficulty")     || undefined,
        duration_hours: formData.get("duration_hours") || undefined,
        is_active:      formData.get("is_active") === "true",
        location_id:    (formData.get("location_id") as string) || undefined,
        address:        formData.get("address")   || undefined,
        city:           formData.get("city")      || undefined,
        state:          formData.get("state")     || undefined,
        country:        formData.get("country")   || undefined,
        pincode:        formData.get("pincode")   || undefined,
        phone:          formData.get("phone")     || undefined,
        email:          formData.get("email")     || undefined,
    };

    const parsed = ActivitySchema.safeParse(raw);
    if (!parsed.success) {
        return {
            success: false,
            message: "Validation failed",
            errors:  parsed.error.flatten().fieldErrors,
        };
    }

    try {
        const existing = await db.activities.findUnique({
            where:  { slug: parsed.data.slug },
            select: { id: true, is_active: true },
        });

        if (existing) {
            if (!existing.is_active) {
                // Reactivate and update the soft-deleted / inactive record
                await db.activities.update({ where: { id: existing.id }, data: parsed.data });
                revalidatePath("/dashboard/activities");
                await createLog({
                    action:     "UPDATE",
                    entity:     "Activity",
                    entityId:   String(existing.id),
                    entitySlug: parsed.data.slug,
                    userName:   actor,
                });
                return { success: true, message: "Activity updated successfully", id: existing.id };
            }
            return {
                success: false,
                message: "Slug already in use",
                errors:  { slug: ["This slug is already taken"] },
            };
        }

        const activity = await db.activities.create({ data: { ...parsed.data, created_by: actor } });
        revalidatePath("/dashboard/activities");
        await createLog({
            action:     "CREATE",
            entity:     "Activity",
            entityId:   String(activity.id),
            entitySlug: activity.slug,
            newData:    { name: activity.name, created_by: actor },
            userName:   actor,
        });
        return { success: true, message: "Activity created successfully", id: activity.id };
    } catch (e) {
        console.error("[createActivity]", e);
        return actionError(e);
    }
}

// ── Update ────────────────────────────────────────────────────────────────

export async function updateActivity(
    id: number,
    _prev: ActivityFormState,
    formData: FormData,
): Promise<ActivityFormState> {
    const actor = await requireActor();
    if (!actor) return { success: false, message: "Unauthorized" };

    const raw = {
        name:             formData.get("name"),
        category_id:      formData.get("category_id") || undefined,
        description:      formData.get("description")    || undefined,
        difficulty:       formData.get("difficulty")     || undefined,
        duration_hours:   formData.get("duration_hours") || undefined,
        is_active:        formData.get("is_active") === "true",
        location_id:      (formData.get("location_id") as string) || undefined,
        address:          formData.get("address")   || undefined,
        city:             formData.get("city")      || undefined,
        state:            formData.get("state")     || undefined,
        country:          formData.get("country")   || undefined,
        pincode:          formData.get("pincode")   || undefined,
        phone:            formData.get("phone")     || undefined,
        email:            formData.get("email")     || undefined,
        included_meals:   formData.get("included_meals") || undefined,
    };

    const parsed = ActivityUpdateSchema.safeParse(raw);
    if (!parsed.success) {
        return {
            success: false,
            message: "Validation failed",
            errors:  parsed.error.flatten().fieldErrors,
        };
    }

    try {
        const current = await db.activities.findUnique({ where: { id } });
        if (!current) return { success: false, message: "Activity not found" };

        await db.activities.update({ where: { id }, data: parsed.data });
        revalidatePath("/dashboard/activities");
        revalidatePath(`/dashboard/activities/${id}`);
        await createLog({
            action:     "UPDATE",
            entity:     "Activity",
            entityId:   String(id),
            entitySlug: current.slug,
            userName:   actor,
        });
        return { success: true, message: "Activity updated successfully" };
    } catch (e) {
        console.error("[updateActivity]", e);
        return actionError(e);
    }
}

// ── Toggle Active ─────────────────────────────────────────────────────────

export async function toggleActivityActive(
    id: number,
    is_active: boolean,
): Promise<ActivityFormState> {
    const actor = await requireActor();
    if (!actor) return { success: false, message: "Unauthorized" };

    try {
        const updated = await db.activities.update({ where: { id }, data: { is_active } });
        revalidatePath("/dashboard/activities");
        await createLog({
            action:     "UPDATE",
            entity:     "Activity",
            entityId:   String(id),
            entitySlug: updated.slug,
            newData:    { is_active },
            metadata:   { operation: "toggle_active" },
            userName:   actor,
        });
        return {
            success: true,
            message: `Activity ${is_active ? "activated" : "deactivated"}`,
        };
    } catch (e) {
        console.error("[toggleActivityActive]", e);
        return actionError(e);
    }
}

// ── Delete Activity ───────────────────────────────────────────────────────

export async function deleteActivity(id: number): Promise<ActivityFormState> {
    const actor = await requireActor();
    if (!actor) return { success: false, message: "Unauthorized" };

    try {
        const activity = await db.activities.findUnique({
            where:   { id },
            include: {
                images: { select: { url: true, thumbnail: true } },
                _count: { select: { itinerary_activities: true, variants: true } },
            },
        });

        if (!activity) return { success: false, message: "Activity not found" };

        if (activity._count.itinerary_activities > 0) {
            return {
                success: false,
                message: `Cannot delete — this activity is used in ${activity._count.itinerary_activities} itinerary day(s). Remove it from all packages first.`,
            };
        }

        // Delete R2 images
        const r2Keys = [
            ...new Set(
                activity.images.flatMap(img =>
                    [img.url, img.thumbnail].filter(Boolean) as string[]
                )
            ),
        ];
        await Promise.all(r2Keys.map(k => deleteFromR2(k).catch(console.error)));

        // Cascade-delete children then activity
        await db.activity_images.deleteMany({ where: { activity_id: id } });
        await db.activity_addons.deleteMany({ where: { activity_id: id } });
        await db.activity_variants.deleteMany({ where: { activity_id: id } });
        await db.activities.delete({ where: { id } });

        revalidatePath("/dashboard/activities");
        await createLog({
            action:     "DELETE",
            entity:     "Activity",
            entityId:   String(id),
            entitySlug: activity.slug,
            userName:   actor,
        });
        return { success: true, message: "Activity deleted successfully" };
    } catch (e) {
        console.error("[deleteActivity]", e);
        return actionError(e);
    }
}

// ── Image actions ─────────────────────────────────────────────────────────

export async function addActivityImages(
    activity_id: number,
    images: { url: string; thumbnail?: string }[],
): Promise<ActivityFormState> {
    const actor = await requireActor();
    if (!actor) return { success: false, message: "Unauthorized" };

    try {
        const existing = await db.activity_images.count({ where: { activity_id } });
        const isFirst  = existing === 0;

        await db.activity_images.createMany({
            data: images.map((img, i) => ({
                activity_id,
                url:        img.url,
                thumbnail:  img.thumbnail || img.url,
                sort_order: existing + i,
                is_primary: isFirst && i === 0,
            })),
        });

        const created = await db.activity_images.findMany({
            where:   { activity_id, sort_order: { gte: existing } },
            orderBy: { sort_order: "asc" },
            select:  { id: true, url: true, thumbnail: true, is_primary: true, sort_order: true, label: true },
        });

        revalidatePath("/dashboard/activities");
        revalidatePath(`/dashboard/activities/${activity_id}`);
        return {
            success: true,
            message: `${images.length} image${images.length !== 1 ? "s" : ""} added`,
            images:  created,
        };
    } catch (e) {
        console.error("[addActivityImages]", e);
        return actionError(e);
    }
}

export async function deleteActivityImage(
    id:          number,
    activity_id: number,
    url:         string,
    thumbnail?:  string,
): Promise<ActivityFormState> {
    const actor = await requireActor();
    if (!actor) return { success: false, message: "Unauthorized" };

    try {
        const keys = [...new Set([url, thumbnail].filter(Boolean) as string[])];
        await Promise.all(keys.map(k => deleteFromR2(k).catch(console.error)));
        await db.activity_images.delete({ where: { id } });
        revalidatePath("/dashboard/activities");
        revalidatePath(`/dashboard/activities/${activity_id}`);
        return { success: true, message: "Image deleted" };
    } catch (e) {
        console.error("[deleteActivityImage]", e);
        return actionError(e);
    }
}

export async function setPrimaryActivityImage(
    id:          number,
    activity_id: number,
): Promise<ActivityFormState> {
    const actor = await requireActor();
    if (!actor) return { success: false, message: "Unauthorized" };

    try {
        await db.$transaction([
            db.activity_images.updateMany({ where: { activity_id }, data: { is_primary: false } }),
            db.activity_images.update({    where: { id },            data: { is_primary: true  } }),
        ]);
        revalidatePath("/dashboard/activities");
        revalidatePath(`/dashboard/activities/${activity_id}`);
        return { success: true, message: "Primary image set" };
    } catch (e) {
        console.error("[setPrimaryActivityImage]", e);
        return actionError(e);
    }
}

export async function updateActivityImageLabel(
    id:    number,
    label: string,
): Promise<ActivityFormState> {
    const actor = await requireActor();
    if (!actor) return { success: false, message: "Unauthorized" };

    try {
        await db.activity_images.update({ where: { id }, data: { label: label || null } });
        revalidatePath("/dashboard/activities");
        return { success: true, message: "Label saved" };
    } catch (e) {
        console.error("[updateActivityImageLabel]", e);
        return actionError(e);
    }
}

export async function batchSaveActivityImageLabels(
    activity_id: number,
    updates: { id: number; label: string }[],
): Promise<ActivityFormState> {
    const actor = await requireActor();
    if (!actor) return { success: false, message: "Unauthorized" };

    try {
        await Promise.all(
            updates.map(u =>
                db.activity_images.update({ where: { id: u.id }, data: { label: u.label || null } })
            )
        );
        revalidatePath(`/dashboard/activities/${activity_id}`);
        return { success: true, message: "Labels saved" };
    } catch (e) {
        console.error("[batchSaveActivityImageLabels]", e);
        return actionError(e);
    }
}

// ── Activity Variants ─────────────────────────────────────────────────────

export async function createVariant(
    activity_id: number,
    data: {
        name:           string;
        booking_mode:   string;
        pricing_type:   string;
        min_persons?:   number | null;
        max_persons?:   number | null;
        cost_price?:    number | null;
        gst_percentage?: number;
        valid_from?:    Date | null;
        valid_to?:      Date | null;
        is_active:      boolean;
    },
): Promise<ActivityFormState> {
    const actor = await requireActor();
    if (!actor) return { success: false, message: "Unauthorized" };

    try {
        const count   = await db.activity_variants.count({ where: { activity_id } });
        const variant = await db.activity_variants.create({
            data: { activity_id, sort_order: count, ...data },
        });
        revalidatePath(`/dashboard/activities/${activity_id}`);
        return { success: true, message: "Variant created", id: variant.id };
    } catch (e) {
        console.error("[createVariant]", e);
        return actionError(e);
    }
}

export async function updateVariant(
    id:          number,
    activity_id: number,
    data: {
        name:           string;
        booking_mode:   string;
        pricing_type:   string;
        min_persons?:   number | null;
        max_persons?:   number | null;
        cost_price?:    number | null;
        gst_percentage?: number;
        valid_from?:    Date | null;
        valid_to?:      Date | null;
        is_active:      boolean;
    },
): Promise<ActivityFormState> {
    const actor = await requireActor();
    if (!actor) return { success: false, message: "Unauthorized" };

    try {
        await db.activity_variants.update({ where: { id }, data });
        revalidatePath(`/dashboard/activities/${activity_id}`);
        return { success: true, message: "Variant updated" };
    } catch (e) {
        console.error("[updateVariant]", e);
        return actionError(e);
    }
}

export async function deleteVariant(
    id:          number,
    activity_id: number,
): Promise<ActivityFormState> {
    const actor = await requireActor();
    if (!actor) return { success: false, message: "Unauthorized" };

    try {
        const variant = await db.activity_variants.findUnique({
            where:   { id },
            include: { _count: { select: { itinerary_activities: true } } },
        });

        if (!variant) return { success: false, message: "Variant not found" };

        if (variant._count.itinerary_activities > 0) {
            return {
                success: false,
                message: `Cannot delete — this variant is used in ${variant._count.itinerary_activities} itinerary day(s). Remove it from all packages first.`,
            };
        }

        await db.activity_variant_pricing.deleteMany({ where: { variant_id: id } });
        await db.activity_variants.delete({ where: { id } });
        revalidatePath(`/dashboard/activities/${activity_id}`);
        return { success: true, message: "Variant deleted" };
    } catch (e) {
        console.error("[deleteVariant]", e);
        return actionError(e);
    }
}

// ── Variant Pricing ───────────────────────────────────────────────────────

export async function upsertVariantPricing(
    variant_id:  number,
    activity_id: number,
    data: {
        id?:               number;
        label:             string;
        age_from?:         number | null;
        age_to?:           number | null;
        price:             number;
        original_price?:   number | null;
        margin_percentage?: number;
        is_active:         boolean;
    },
): Promise<ActivityFormState> {
    const actor = await requireActor();
    if (!actor) return { success: false, message: "Unauthorized" };

    try {
        if (data.id) {
            await db.activity_variant_pricing.update({
                where: { id: data.id },
                data: {
                    label:             data.label,
                    age_from:          data.age_from ?? null,
                    age_to:            data.age_to   ?? null,
                    price:             data.price,
                    original_price:    data.original_price    ?? null,
                    margin_percentage: data.margin_percentage ?? 0,
                    is_active:         data.is_active,
                },
            });
        } else {
            const count = await db.activity_variant_pricing.count({ where: { variant_id } });
            await db.activity_variant_pricing.create({
                data: {
                    variant_id,
                    label:             data.label,
                    age_from:          data.age_from ?? null,
                    age_to:            data.age_to   ?? null,
                    price:             data.price,
                    original_price:    data.original_price    ?? null,
                    margin_percentage: data.margin_percentage ?? 0,
                    is_active:         data.is_active,
                    sort_order:        count,
                },
            });
        }
        revalidatePath(`/dashboard/activities/${activity_id}`);
        return { success: true, message: "Pricing saved" };
    } catch (e) {
        console.error("[upsertVariantPricing]", e);
        return actionError(e);
    }
}

export async function deleteVariantPricing(
    id:          number,
    activity_id: number,
): Promise<ActivityFormState> {
    const actor = await requireActor();
    if (!actor) return { success: false, message: "Unauthorized" };

    try {
        await db.activity_variant_pricing.delete({ where: { id } });
        revalidatePath(`/dashboard/activities/${activity_id}`);
        return { success: true, message: "Pricing deleted" };
    } catch (e) {
        console.error("[deleteVariantPricing]", e);
        return actionError(e);
    }
}

// ── Variant Seasons ───────────────────────────────────────────────────────

export type ActivitySeasonPricingInput = {
    label:              string;
    age_from?:          number | null;
    age_to?:            number | null;
    price:              number;
    original_price?:    number | null;
    margin_percentage?: number;
    is_active:          boolean;
};

export type ActivitySeasonInput = {
    season_name:   string;
    valid_from:    string; // YYYY-MM-DD
    valid_to:      string;
    weekend_price?: number | null;
    is_active:     boolean;
    pricing:       ActivitySeasonPricingInput[];
};

export async function createVariantSeason(
    variant_id:  number,
    activity_id: number,
    data:        ActivitySeasonInput,
): Promise<ActivityFormState & { id?: number }> {
    const actor = await requireActor();
    if (!actor) return { success: false, message: "Unauthorized" };

    try {
        if (!data.season_name?.trim()) return { success: false, message: "Season name is required." };
        if (!data.valid_from || !data.valid_to) return { success: false, message: "Date range is required." };
        if (new Date(data.valid_to) <= new Date(data.valid_from))
            return { success: false, message: "End date must be after start date." };

        const count = await db.activity_variant_season.count({ where: { variant_id } });

        const season = await db.$transaction(async (tx) => {
            const s = await tx.activity_variant_season.create({
                data: {
                    variant_id,
                    season_name:   data.season_name.trim(),
                    valid_from:    new Date(data.valid_from),
                    valid_to:      new Date(data.valid_to),
                    weekend_price: data.weekend_price ?? null,
                    is_active:     data.is_active,
                    sort_order:    count,
                },
            });
            if (data.pricing.length > 0) {
                await tx.activity_variant_season_pricing.createMany({
                    data: data.pricing.map((p, i) => ({
                        season_id:         s.id,
                        label:             p.label,
                        age_from:          p.age_from  ?? null,
                        age_to:            p.age_to    ?? null,
                        price:             p.price,
                        original_price:    p.original_price ?? null,
                        margin_percentage: p.margin_percentage ?? 0,
                        is_active:         p.is_active,
                        sort_order:        i,
                    })),
                });
            }
            return s;
        });

        revalidatePath(`/dashboard/activities/${activity_id}`);
        return { success: true, message: "Season added", id: season.id };
    } catch (e) {
        console.error("[createVariantSeason]", e);
        return actionError(e);
    }
}

export async function updateVariantSeason(
    id:          number,
    activity_id: number,
    data:        ActivitySeasonInput,
): Promise<ActivityFormState> {
    const actor = await requireActor();
    if (!actor) return { success: false, message: "Unauthorized" };

    try {
        if (!data.season_name?.trim()) return { success: false, message: "Season name is required." };
        if (!data.valid_from || !data.valid_to) return { success: false, message: "Date range is required." };
        if (new Date(data.valid_to) <= new Date(data.valid_from))
            return { success: false, message: "End date must be after start date." };

        await db.$transaction(async (tx) => {
            await tx.activity_variant_season.update({
                where: { id },
                data: {
                    season_name:   data.season_name.trim(),
                    valid_from:    new Date(data.valid_from),
                    valid_to:      new Date(data.valid_to),
                    weekend_price: data.weekend_price ?? null,
                    is_active:     data.is_active,
                },
            });
            // Replace pricing rows
            await tx.activity_variant_season_pricing.deleteMany({ where: { season_id: id } });
            if (data.pricing.length > 0) {
                await tx.activity_variant_season_pricing.createMany({
                    data: data.pricing.map((p, i) => ({
                        season_id:         id,
                        label:             p.label,
                        age_from:          p.age_from  ?? null,
                        age_to:            p.age_to    ?? null,
                        price:             p.price,
                        original_price:    p.original_price ?? null,
                        margin_percentage: p.margin_percentage ?? 0,
                        is_active:         p.is_active,
                        sort_order:        i,
                    })),
                });
            }
        });

        revalidatePath(`/dashboard/activities/${activity_id}`);
        return { success: true, message: "Season updated" };
    } catch (e) {
        console.error("[updateVariantSeason]", e);
        return actionError(e);
    }
}

export async function deleteVariantSeason(id: number, activity_id: number): Promise<ActivityFormState> {
    const actor = await requireActor();
    if (!actor) return { success: false, message: "Unauthorized" };

    try {
        await db.activity_variant_season.delete({ where: { id } });
        revalidatePath(`/dashboard/activities/${activity_id}`);
        return { success: true, message: "Season deleted" };
    } catch (e) {
        console.error("[deleteVariantSeason]", e);
        return actionError(e);
    }
}

// ── Combined variant + seasons (create / update in one call) ─────────────

export type VariantInput = {
    name:           string;
    booking_mode:   string;
    pricing_type:   string;
    min_persons?:   number | null;
    max_persons?:   number | null;
    cost_price?:    number | null;
    gst_percentage: number;
    is_active:      boolean;
    seasons:        ActivitySeasonInput[];
};

export async function createVariantWithSeasons(
    activity_id: number,
    data:        VariantInput,
): Promise<ActivityFormState & { id?: number }> {
    const actor = await requireActor();
    if (!actor) return { success: false, message: "Unauthorized" };

    try {
        if (!data.name?.trim()) return { success: false, message: "Variant name is required." };

        const count = await db.activity_variants.count({ where: { activity_id } });

        const variant = await db.$transaction(async (tx) => {
            const v = await tx.activity_variants.create({
                data: {
                    activity_id,
                    name:           data.name.trim(),
                    booking_mode:   data.booking_mode,
                    pricing_type:   data.pricing_type,
                    min_persons:    data.min_persons  ?? null,
                    max_persons:    data.max_persons  ?? null,
                    cost_price:     data.cost_price   ?? null,
                    gst_percentage: data.gst_percentage,
                    is_active:      data.is_active,
                    sort_order:     count,
                },
            });

            for (const [i, s] of data.seasons.entries()) {
                const season = await tx.activity_variant_season.create({
                    data: {
                        variant_id:    v.id,
                        season_name:   s.season_name.trim(),
                        valid_from:    new Date(s.valid_from),
                        valid_to:      new Date(s.valid_to),
                        weekend_price: s.weekend_price ?? null,
                        is_active:     s.is_active,
                        sort_order:    i,
                    },
                });
                if (s.pricing.length > 0) {
                    await tx.activity_variant_season_pricing.createMany({
                        data: s.pricing.map((p, j) => ({
                            season_id:         season.id,
                            label:             p.label,
                            age_from:          p.age_from  ?? null,
                            age_to:            p.age_to    ?? null,
                            price:             p.price,
                            original_price:    p.original_price ?? null,
                            margin_percentage: p.margin_percentage ?? 0,
                            is_active:         p.is_active,
                            sort_order:        j,
                        })),
                    });
                }
            }

            return v;
        });

        revalidatePath(`/dashboard/activities/${activity_id}`);
        return { success: true, message: "Variant added", id: variant.id };
    } catch (e) {
        console.error("[createVariantWithSeasons]", e);
        return actionError(e);
    }
}

export async function updateVariantWithSeasons(
    id:          number,
    activity_id: number,
    data:        VariantInput,
): Promise<ActivityFormState> {
    const actor = await requireActor();
    if (!actor) return { success: false, message: "Unauthorized" };

    try {
        if (!data.name?.trim()) return { success: false, message: "Variant name is required." };

        await db.$transaction(async (tx) => {
            await tx.activity_variants.update({
                where: { id },
                data: {
                    name:           data.name.trim(),
                    booking_mode:   data.booking_mode,
                    pricing_type:   data.pricing_type,
                    min_persons:    data.min_persons  ?? null,
                    max_persons:    data.max_persons  ?? null,
                    cost_price:     data.cost_price   ?? null,
                    gst_percentage: data.gst_percentage,
                    is_active:      data.is_active,
                },
            });

            // Replace all seasons
            const existing = await tx.activity_variant_season.findMany({
                where: { variant_id: id },
                select: { id: true },
            });
            await tx.activity_variant_season_pricing.deleteMany({
                where: { season_id: { in: existing.map(s => s.id) } },
            });
            await tx.activity_variant_season.deleteMany({ where: { variant_id: id } });

            for (const [i, s] of data.seasons.entries()) {
                const season = await tx.activity_variant_season.create({
                    data: {
                        variant_id:    id,
                        season_name:   s.season_name.trim(),
                        valid_from:    new Date(s.valid_from),
                        valid_to:      new Date(s.valid_to),
                        weekend_price: s.weekend_price ?? null,
                        is_active:     s.is_active,
                        sort_order:    i,
                    },
                });
                if (s.pricing.length > 0) {
                    await tx.activity_variant_season_pricing.createMany({
                        data: s.pricing.map((p, j) => ({
                            season_id:         season.id,
                            label:             p.label,
                            age_from:          p.age_from  ?? null,
                            age_to:            p.age_to    ?? null,
                            price:             p.price,
                            original_price:    p.original_price ?? null,
                            margin_percentage: p.margin_percentage ?? 0,
                            is_active:         p.is_active,
                            sort_order:        j,
                        })),
                    });
                }
            }
        });

        revalidatePath(`/dashboard/activities/${activity_id}`);
        return { success: true, message: "Variant updated" };
    } catch (e) {
        console.error("[updateVariantWithSeasons]", e);
        return actionError(e);
    }
}

// ── Activity Add-ons ──────────────────────────────────────────────────────

export async function createAddon(
    activity_id: number,
    data: {
        title:        string;
        description?: string | null;
        pricing_type: string;
        price:        number;
        cost_price?:  number | null;
        is_optional:  boolean;
        is_active:    boolean;
    },
): Promise<ActivityFormState> {
    const actor = await requireActor();
    if (!actor) return { success: false, message: "Unauthorized" };

    try {
        const count = await db.activity_addons.count({ where: { activity_id } });
        await db.activity_addons.create({
            data: { activity_id, sort_order: count, ...data },
        });
        revalidatePath(`/dashboard/activities/${activity_id}`);
        return { success: true, message: "Add-on created" };
    } catch (e) {
        console.error("[createAddon]", e);
        return actionError(e);
    }
}

export async function updateAddon(
    id:          number,
    activity_id: number,
    data: {
        title:        string;
        description?: string | null;
        pricing_type: string;
        price:        number;
        cost_price?:  number | null;
        is_optional:  boolean;
        is_active:    boolean;
    },
): Promise<ActivityFormState> {
    const actor = await requireActor();
    if (!actor) return { success: false, message: "Unauthorized" };

    try {
        await db.activity_addons.update({ where: { id }, data });
        revalidatePath(`/dashboard/activities/${activity_id}`);
        return { success: true, message: "Add-on updated" };
    } catch (e) {
        console.error("[updateAddon]", e);
        return actionError(e);
    }
}

export async function deleteAddon(
    id:          number,
    activity_id: number,
): Promise<ActivityFormState> {
    const actor = await requireActor();
    if (!actor) return { success: false, message: "Unauthorized" };

    try {
        await db.activity_addons.delete({ where: { id } });
        revalidatePath(`/dashboard/activities/${activity_id}`);
        return { success: true, message: "Add-on deleted" };
    } catch (e) {
        console.error("[deleteAddon]", e);
        return actionError(e);
    }
}
