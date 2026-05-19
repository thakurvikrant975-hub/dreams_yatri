"use server";

import { z }             from "zod";
import { db }            from "@/app/lib/db";
import { revalidatePath } from "next/cache";
import { dashboardAuth } from "@/app/lib/auth-dashboard";

// ── Auth helper ───────────────────────────────────────────────────────────

async function requireActor() {
    const session = await dashboardAuth();
    if (!session?.user?.email) return null;
    return session.user.name ?? session.user.email;
}

// ── Types ─────────────────────────────────────────────────────────────────

export type CategoryFormState = {
    success: boolean;
    message: string;
    errors?: Record<string, string[]>;
    id?:     number;
};

export type CategoryRow = {
    id:          number;
    name:        string;
    slug:        string;
    is_active:   boolean;
    sort_order:  number;
    created_at:  Date;
    _count:      { activities: number };
};

// ── Validator ─────────────────────────────────────────────────────────────

const CategorySchema = z.object({
    name: z
        .string()
        .min(1, "Name is required")
        .max(100, "Name must be 100 characters or less")
        .transform(s => s.trim().replace(/\b\w/g, c => c.toUpperCase())),
    slug: z
        .string()
        .min(1, "Slug is required")
        .max(120, "Slug must be 120 characters or less")
        .regex(
            /^[a-z0-9]+(-[a-z0-9]+)*$/,
            "Slug must be lowercase letters and numbers separated by hyphens"
        ),
    sort_order: z.coerce.number().int().min(0).default(0),
    is_active:  z.boolean().default(true),
});

// ── Read ──────────────────────────────────────────────────────────────────

export type GetCategoriesParams = {
    search?: string;
    status?: "active" | "inactive" | "all";
};

export async function getCategories(params: GetCategoriesParams = {}): Promise<{
    categories:  CategoryRow[];
    totalCount:  number;
}> {
    const { search = "", status = "all" } = params;

    const where = {
        ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
        ...(status === "active"   ? { is_active: true  } : {}),
        ...(status === "inactive" ? { is_active: false } : {}),
    };

    const [categories, totalCount] = await Promise.all([
        db.activity_categories.findMany({
            where,
            orderBy: [{ sort_order: "asc" }, { name: "asc" }],
            include: { _count: { select: { activities: true } } },
        }),
        db.activity_categories.count(),
    ]);

    return { categories, totalCount };
}

// ── Create ────────────────────────────────────────────────────────────────

export async function createCategory(
    _prev: CategoryFormState,
    formData: FormData,
): Promise<CategoryFormState> {
    const actor = await requireActor();
    if (!actor) return { success: false, message: "Unauthorized" };

    const raw = {
        name:       formData.get("name"),
        slug:       formData.get("slug"),
        sort_order: formData.get("sort_order") || "0",
        is_active:  formData.get("is_active") === "true",
    };

    const parsed = CategorySchema.safeParse(raw);
    if (!parsed.success) {
        return {
            success: false,
            message: "Validation failed",
            errors:  parsed.error.flatten().fieldErrors,
        };
    }

    try {
        const existing = await db.activity_categories.findFirst({
            where: { OR: [{ name: parsed.data.name }, { slug: parsed.data.slug }] },
        });
        if (existing) {
            const field = existing.name === parsed.data.name ? "name" : "slug";
            return {
                success: false,
                message: `${field === "name" ? "Name" : "Slug"} already in use`,
                errors:  { [field]: [`This ${field} is already taken`] },
            };
        }

        const cat = await db.activity_categories.create({ data: parsed.data });
        revalidatePath("/dashboard/activities/categories");
        revalidatePath("/dashboard/activities");
        return { success: true, message: "Category created", id: cat.id };
    } catch {
        return { success: false, message: "Database error. Please try again." };
    }
}

// ── Update ────────────────────────────────────────────────────────────────

export async function updateCategory(
    id:       number,
    _prev:    CategoryFormState,
    formData: FormData,
): Promise<CategoryFormState> {
    const actor = await requireActor();
    if (!actor) return { success: false, message: "Unauthorized" };

    const raw = {
        name:       formData.get("name"),
        slug:       formData.get("slug"),
        sort_order: formData.get("sort_order") || "0",
        is_active:  formData.get("is_active") === "true",
    };

    const parsed = CategorySchema.safeParse(raw);
    if (!parsed.success) {
        return {
            success: false,
            message: "Validation failed",
            errors:  parsed.error.flatten().fieldErrors,
        };
    }

    try {
        const current = await db.activity_categories.findUnique({ where: { id } });
        if (!current) return { success: false, message: "Category not found" };

        const conflict = await db.activity_categories.findFirst({
            where: {
                id: { not: id },
                OR: [
                    ...(parsed.data.name !== current.name ? [{ name: parsed.data.name }] : []),
                    ...(parsed.data.slug !== current.slug ? [{ slug: parsed.data.slug }] : []),
                ],
            },
        });
        if (conflict) {
            const field = conflict.name === parsed.data.name ? "name" : "slug";
            return {
                success: false,
                message: `${field === "name" ? "Name" : "Slug"} already in use`,
                errors:  { [field]: [`This ${field} is already taken`] },
            };
        }

        await db.activity_categories.update({ where: { id }, data: parsed.data });
        revalidatePath("/dashboard/activities/categories");
        revalidatePath("/dashboard/activities");
        return { success: true, message: "Category updated" };
    } catch {
        return { success: false, message: "Database error. Please try again." };
    }
}

// ── Toggle Active ─────────────────────────────────────────────────────────

export async function toggleCategoryActive(
    id:        number,
    is_active: boolean,
): Promise<CategoryFormState> {
    const actor = await requireActor();
    if (!actor) return { success: false, message: "Unauthorized" };

    try {
        await db.activity_categories.update({ where: { id }, data: { is_active } });
        revalidatePath("/dashboard/activities/categories");
        revalidatePath("/dashboard/activities");
        return { success: true, message: `Category ${is_active ? "activated" : "deactivated"}` };
    } catch {
        return { success: false, message: "Database error. Please try again." };
    }
}

// ── Delete ────────────────────────────────────────────────────────────────

export async function deleteCategory(id: number): Promise<CategoryFormState> {
    const actor = await requireActor();
    if (!actor) return { success: false, message: "Unauthorized" };

    try {
        const cat = await db.activity_categories.findUnique({
            where:   { id },
            include: { _count: { select: { activities: true } } },
        });

        if (!cat) return { success: false, message: "Category not found" };

        if (cat._count.activities > 0) {
            return {
                success: false,
                message: `Cannot delete — ${cat._count.activities} activit${cat._count.activities !== 1 ? "ies use" : "y uses"} this category. Reassign them first.`,
            };
        }

        await db.activity_categories.delete({ where: { id } });
        revalidatePath("/dashboard/activities/categories");
        revalidatePath("/dashboard/activities");
        return { success: true, message: "Category deleted" };
    } catch {
        return { success: false, message: "Database error. Please try again." };
    }
}
