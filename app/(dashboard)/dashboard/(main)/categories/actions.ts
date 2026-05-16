"use server";

import { db }              from "@/app/lib/db";
import { revalidatePath }  from "next/cache";
import { dashboardAuth }   from "@/app/lib/auth-dashboard";
import { CategorySchema }  from "@/app/lib/validators/categories";

// ── Auth helper ───────────────────────────────────────────────────────────────

async function requireActor(): Promise<string | null> {
    const session = await dashboardAuth();
    if (!session?.user?.email) return null;
    return session.user.name ?? session.user.email;
}

// ── Return type ───────────────────────────────────────────────────────────────

export type CategoryFormState = {
    success: boolean;
    message: string;
    errors?: Record<string, string[]>;
};

// ── Types ─────────────────────────────────────────────────────────────────────

export type CategoryWithRelations = {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    meta_title: string | null;
    meta_desc: string | null;
    parent_id: number | null;
    sort_order: number;
    is_active: boolean;
    parent: { id: number; name: string; slug: string } | null;
    children: { id: number; name: string; slug: string; is_active: boolean }[];
    _count: { packages: number; children: number };
};

export type CategoryForSelect = {
    id: number;
    name: string;
    slug: string;
};

// ── Read ──────────────────────────────────────────────────────────────────────

export type GetCategoriesParams = {
    page?:      number;
    limit?:     number;
    search?:    string;
    status?:    "active" | "inactive" | "all";
    parent_id?: "top" | number | "all";
};

const CATEGORY_INCLUDE = {
    parent: { select: { id: true, name: true, slug: true } },
    children: {
        select:  { id: true, name: true, slug: true, is_active: true },
        orderBy: { sort_order: "asc" as const },
    },
    _count: { select: { packages: true, children: true } },
} as const;

export async function getCategories(params: GetCategoriesParams = {}) {
    const { page = 1, limit = 10, search = "", status = "all", parent_id = "all" } = params;
    const skip = (page - 1) * limit;
    const isFiltering = !!(search || status !== "all" || parent_id !== "all");

    const filterWhere = {
        ...(search ? {
            OR: [
                { name: { contains: search, mode: "insensitive" as const } },
                { slug: { contains: search, mode: "insensitive" as const } },
            ],
        } : {}),
        ...(status === "active"   ? { is_active: true  } : {}),
        ...(status === "inactive" ? { is_active: false } : {}),
        ...(parent_id === "top"          ? { parent_id: null }         : {}),
        ...(typeof parent_id === "number" ? { parent_id }              : {}),
    };

    // When not filtering: paginate top-level only, include children for expand/collapse
    const topLevelWhere = { ...filterWhere, parent_id: null };
    const activeWhere   = isFiltering ? filterWhere : topLevelWhere;

    const [rows, totalCount, statsTotal, statsActive, statsSubCount, statsPackages, parentCategories] =
        await Promise.all([
            db.categories.findMany({
                where:   isFiltering ? filterWhere : topLevelWhere,
                orderBy: [{ sort_order: "asc" }, { name: "asc" }],
                skip,
                take:    limit,
                include: CATEGORY_INCLUDE,
            }),
            db.categories.count({ where: activeWhere }),
            db.categories.count(),
            db.categories.count({ where: { is_active: true } }),
            db.categories.count({ where: { parent_id: { not: null } } }),
            db.categories.aggregate({ _sum: { /* packages via _count below */ } }),
            db.categories.findMany({
                where:   { parent_id: null, is_active: true },
                orderBy: { name: "asc" },
                select:  { id: true, name: true, slug: true },
            }),
        ]);

    // Total packages: sum _count.packages across all categories
    const allForPackageCount = await db.categories.findMany({
        select: { _count: { select: { packages: true } } },
    });
    const statsPackageCount = allForPackageCount.reduce(
        (acc, c) => acc + c._count.packages, 0
    );

    return {
        categories:      rows as CategoryWithRelations[],
        totalCount,
        isFiltering,
        stats: {
            total:         statsTotal,
            active:        statsActive,
            subCategories: statsSubCount,
            packages:      statsPackageCount,
        },
        parentCategories: parentCategories as CategoryForSelect[],
    };
}

export async function getParentCategoriesForSelect(): Promise<CategoryForSelect[]> {
    return db.categories.findMany({
        where:   { parent_id: null, is_active: true },
        orderBy: { name: "asc" },
        select:  { id: true, name: true, slug: true },
    });
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createCategory(
    _prev: CategoryFormState,
    formData: FormData,
): Promise<CategoryFormState> {
    const actor = await requireActor();
    if (!actor) return { success: false, message: "Unauthorized" };

    const raw = {
        name:        formData.get("name")        as string,
        slug:        formData.get("slug")        as string,
        description: (formData.get("description") as string) || undefined,
        meta_title:  (formData.get("meta_title")  as string) || undefined,
        meta_desc:   (formData.get("meta_desc")   as string) || undefined,
        parent_id:   formData.get("parent_id") ? Number(formData.get("parent_id")) : null,
        sort_order:  Number(formData.get("sort_order") ?? 0),
        is_active:   formData.get("is_active") === "true",
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
        const existing = await db.categories.findUnique({ where: { slug: parsed.data.slug } });
        if (existing) {
            return {
                success: false,
                message: "Slug already exists",
                errors:  { slug: ["This slug is already taken"] },
            };
        }

        await db.categories.create({ data: parsed.data });

        revalidatePath("/dashboard/categories");
        return { success: true, message: "Category created successfully" };
    } catch {
        return { success: false, message: "Database error. Please try again." };
    }
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateCategory(
    id: number,
    _prev: CategoryFormState,
    formData: FormData,
): Promise<CategoryFormState> {
    const actor = await requireActor();
    if (!actor) return { success: false, message: "Unauthorized" };

    const raw = {
        name:        formData.get("name")        as string,
        slug:        formData.get("slug")        as string,
        description: (formData.get("description") as string) || undefined,
        meta_title:  (formData.get("meta_title")  as string) || undefined,
        meta_desc:   (formData.get("meta_desc")   as string) || undefined,
        parent_id:   formData.get("parent_id") ? Number(formData.get("parent_id")) : null,
        sort_order:  Number(formData.get("sort_order") ?? 0),
        is_active:   formData.get("is_active") === "true",
    };

    const parsed = CategorySchema.safeParse(raw);
    if (!parsed.success) {
        return {
            success: false,
            message: "Validation failed",
            errors:  parsed.error.flatten().fieldErrors,
        };
    }

    if (parsed.data.parent_id === id) {
        return { success: false, message: "A category cannot be its own parent" };
    }

    try {
        const slugConflict = await db.categories.findFirst({
            where: { slug: parsed.data.slug, NOT: { id } },
        });
        if (slugConflict) {
            return {
                success: false,
                message: "Slug already taken",
                errors:  { slug: ["This slug is already taken"] },
            };
        }

        const current = await db.categories.findUnique({ where: { id } });
        if (!current) return { success: false, message: "Category not found" };

        await db.categories.update({ where: { id }, data: parsed.data });

        revalidatePath("/dashboard/categories");
        return { success: true, message: "Category updated successfully" };
    } catch {
        return { success: false, message: "Database error. Please try again." };
    }
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteCategory(id: number): Promise<CategoryFormState> {
    const actor = await requireActor();
    if (!actor) return { success: false, message: "Unauthorized" };

    try {
        const category = await db.categories.findUnique({
            where:   { id },
            include: { _count: { select: { packages: true, children: true } } },
        });

        if (!category) return { success: false, message: "Category not found" };

        if (category._count.children > 0) {
            return {
                success: false,
                message: `Cannot delete — ${category._count.children} subcategory(s) exist. Remove them first.`,
            };
        }

        if (category._count.packages > 0) {
            return {
                success: false,
                message: `Cannot delete — ${category._count.packages} package(s) are linked. Unlink them first.`,
            };
        }

        await db.categories.delete({ where: { id } });
        revalidatePath("/dashboard/categories");
        return { success: true, message: "Category deleted successfully" };
    } catch {
        return { success: false, message: "Database error. Please try again." };
    }
}

// ── Toggle Active ─────────────────────────────────────────────────────────────

export async function toggleCategoryActive(
    id: number,
    is_active: boolean,
): Promise<CategoryFormState> {
    const actor = await requireActor();
    if (!actor) return { success: false, message: "Unauthorized" };

    try {
        await db.categories.update({ where: { id }, data: { is_active } });
        revalidatePath("/dashboard/categories");
        return {
            success: true,
            message: `Category ${is_active ? "activated" : "deactivated"}`,
        };
    } catch {
        return { success: false, message: "Database error. Please try again." };
    }
}

// ── Reorder ───────────────────────────────────────────────────────────────────

export async function updateSortOrder(
    id: number,
    sort_order: number,
): Promise<CategoryFormState> {
    const actor = await requireActor();
    if (!actor) return { success: false, message: "Unauthorized" };

    try {
        await db.categories.update({ where: { id }, data: { sort_order } });
        revalidatePath("/dashboard/categories");
        return { success: true, message: "Sort order updated" };
    } catch {
        return { success: false, message: "Database error. Please try again." };
    }
}
