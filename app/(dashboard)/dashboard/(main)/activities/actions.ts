"use server";

import { db }             from "@/app/lib/db";
import { deleteFromR2 }   from "@/app/lib/r2/r2delete";
import { revalidatePath } from "next/cache";
import { dashboardAuth }  from "@/app/lib/auth-dashboard";
import { ActivitySchema, ActivityUpdateSchema } from "@/app/lib/validators/activities";

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
    latitude:       number | null;
    longitude:      number | null;
    address:        string | null;
    city:           string | null;
    state:          string | null;
    country:        string | null;
    pincode:        string | null;
    phone:          string | null;
    email:          string | null;
    is_active:      boolean;
    created_at:     Date;
    category:       ActivityCategory | null;
    images:         ActivityImage[];
    _count:         { images: number; variants: number };
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
            name: { contains: search, mode: "insensitive" as const },
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
        activities: activities.map(a => ({
            ...a,
            duration_hours: a.duration_hours ? Number(a.duration_hours) : null,
            latitude:       a.latitude  ? Number(a.latitude)  : null,
            longitude:      a.longitude ? Number(a.longitude) : null,
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
    const activity = await db.activities.findUnique({
        where: { id },
        include: {
            category: { select: { id: true, name: true, slug: true } },
            images: {
                orderBy: { sort_order: "asc" },
                select:  { id: true, url: true, thumbnail: true, is_primary: true, sort_order: true, label: true },
            },
            variants: {
                orderBy: { sort_order: "asc" },
                include: { pricing: { orderBy: { sort_order: "asc" } } },
            },
            addons: { orderBy: { sort_order: "asc" } },
        },
    });
    if (!activity) return null;
    return {
        ...activity,
        duration_hours: activity.duration_hours ? Number(activity.duration_hours) : null,
        latitude:       activity.latitude  ? Number(activity.latitude)  : null,
        longitude:      activity.longitude ? Number(activity.longitude) : null,
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
        latitude:       formData.get("latitude")  || undefined,
        longitude:      formData.get("longitude") || undefined,
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
                return { success: true, message: "Activity updated successfully", id: existing.id };
            }
            return {
                success: false,
                message: "Slug already in use",
                errors:  { slug: ["This slug is already taken"] },
            };
        }

        const activity = await db.activities.create({ data: parsed.data });
        revalidatePath("/dashboard/activities");
        return { success: true, message: "Activity created successfully", id: activity.id };
    } catch {
        return { success: false, message: "Database error. Please try again." };
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
        name:           formData.get("name"),
        category_id:    formData.get("category_id") || undefined,
        description:    formData.get("description")    || undefined,
        difficulty:     formData.get("difficulty")     || undefined,
        duration_hours: formData.get("duration_hours") || undefined,
        is_active:      formData.get("is_active") === "true",
        latitude:       formData.get("latitude")  || undefined,
        longitude:      formData.get("longitude") || undefined,
        address:        formData.get("address")   || undefined,
        city:           formData.get("city")      || undefined,
        state:          formData.get("state")     || undefined,
        country:        formData.get("country")   || undefined,
        pincode:        formData.get("pincode")   || undefined,
        phone:          formData.get("phone")     || undefined,
        email:          formData.get("email")     || undefined,
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
        return { success: true, message: "Activity updated successfully" };
    } catch {
        return { success: false, message: "Database error. Please try again." };
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
        await db.activities.update({ where: { id }, data: { is_active } });
        revalidatePath("/dashboard/activities");
        return {
            success: true,
            message: `Activity ${is_active ? "activated" : "deactivated"}`,
        };
    } catch {
        return { success: false, message: "Database error. Please try again." };
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
        return { success: true, message: "Activity deleted successfully" };
    } catch {
        return { success: false, message: "Database error. Please try again." };
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

        revalidatePath("/dashboard/activities");
        revalidatePath(`/dashboard/activities/${activity_id}`);
        return { success: true, message: `${images.length} image${images.length !== 1 ? "s" : ""} added` };
    } catch {
        return { success: false, message: "Database error." };
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
    } catch {
        return { success: false, message: "Database error." };
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
    } catch {
        return { success: false, message: "Database error." };
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
    } catch {
        return { success: false, message: "Database error." };
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
    } catch {
        return { success: false, message: "Database error." };
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
    } catch {
        return { success: false, message: "Database error." };
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
    } catch {
        return { success: false, message: "Database error." };
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
    } catch {
        return { success: false, message: "Database error." };
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
    } catch {
        return { success: false, message: "Database error." };
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
    } catch {
        return { success: false, message: "Database error." };
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
    } catch {
        return { success: false, message: "Database error." };
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
    } catch {
        return { success: false, message: "Database error." };
    }
}
