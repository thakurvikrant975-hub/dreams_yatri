"use server";

import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ── Schema ────────────────────────────────────────────────────────────────

const CategorySchema = z.object({
    name: z.string().min(1, "Name is required"),
    slug: z
        .string()
        .min(1, "Slug is required")
        .regex(/^[a-z0-9-]+$/, "Lowercase, numbers and hyphens only"),
    description: z.string().optional(),
    meta_title: z.string().optional(),
    meta_desc: z.string().optional(),
    parent_id: z.number().int().positive().nullable(),
    sort_order: z.number().int().default(0),
    is_active: z.boolean().default(true),
});

export type CategoryFormState = {
    success: boolean;
    message: string;
    errors?: Record<string, string[]>;
};

// ── Types ─────────────────────────────────────────────────────────────────

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

// ── Read ──────────────────────────────────────────────────────────────────

export async function getCategories(): Promise<CategoryWithRelations[]> {
    return db.categories.findMany({
        orderBy: [{ sort_order: "asc" }, { name: "asc" }],
        include: {
            parent: { select: { id: true, name: true, slug: true } },
            children: {
                select: { id: true, name: true, slug: true, is_active: true },
                orderBy: { sort_order: "asc" },
            },
            _count: {
                select: { packages: true, children: true },
            },
        },
    });
}

// Only top-level categories for the parent dropdown
export async function getParentCategoriesForSelect(): Promise<CategoryForSelect[]> {
    return db.categories.findMany({
        where: { parent_id: null, is_active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, slug: true },
    });
}

// ── Create ────────────────────────────────────────────────────────────────

export async function createCategory(
    _prev: CategoryFormState,
    formData: FormData,
): Promise<CategoryFormState> {
    const raw = {
        name: formData.get("name") as string,
        slug: formData.get("slug") as string,
        description: (formData.get("description") as string) || undefined,
        meta_title: (formData.get("meta_title") as string) || undefined,
        meta_desc: (formData.get("meta_desc") as string) || undefined,
        parent_id: formData.get("parent_id")
            ? Number(formData.get("parent_id"))
            : null,
        sort_order: Number(formData.get("sort_order") ?? 0),
        is_active: formData.get("is_active") === "true",
    };

    const parsed = CategorySchema.safeParse(raw);
    if (!parsed.success) {
        return {
            success: false,
            message: "Validation failed",
            errors: parsed.error.flatten().fieldErrors,
        };
    }

    try {
        const existing = await db.categories.findUnique({
            where: { slug: parsed.data.slug },
        });
        if (existing) {
            return {
                success: false,
                message: "Slug already exists",
                errors: { slug: ["This slug is already taken"] },
            };
        }

        await db.categories.create({ data: parsed.data });

        revalidatePath("/dashboard/categories");
        return { success: true, message: "Category created successfully" };
    } catch {
        return { success: false, message: "Database error. Please try again." };
    }
}

// ── Update ────────────────────────────────────────────────────────────────

export async function updateCategory(
    id: number,
    _prev: CategoryFormState,
    formData: FormData,
): Promise<CategoryFormState> {
    const raw = {
        name: formData.get("name") as string,
        slug: formData.get("slug") as string,
        description: (formData.get("description") as string) || undefined,
        meta_title: (formData.get("meta_title") as string) || undefined,
        meta_desc: (formData.get("meta_desc") as string) || undefined,
        parent_id: formData.get("parent_id")
            ? Number(formData.get("parent_id"))
            : null,
        sort_order: Number(formData.get("sort_order") ?? 0),
        is_active: formData.get("is_active") === "true",
    };

    const parsed = CategorySchema.safeParse(raw);
    if (!parsed.success) {
        return {
            success: false,
            message: "Validation failed",
            errors: parsed.error.flatten().fieldErrors,
        };
    }

    try {
        // Prevent a category from being its own parent
        if (parsed.data.parent_id === id) {
            return {
                success: false,
                message: "A category cannot be its own parent",
            };
        }

        const slugConflict = await db.categories.findFirst({
            where: { slug: parsed.data.slug, NOT: { id } },
        });
        if (slugConflict) {
            return {
                success: false,
                message: "Slug already taken",
                errors: { slug: ["This slug is already taken"] },
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

// ── Delete ────────────────────────────────────────────────────────────────

export async function deleteCategory(id: number): Promise<CategoryFormState> {
    try {
        const category = await db.categories.findUnique({
            where: { id },
            include: {
                _count: { select: { packages: true, children: true } },
            },
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
                message: `Cannot delete — ${category._count.packages} package(s) are linked.`,
            };
        }

        await db.categories.delete({ where: { id } });
        revalidatePath("/dashboard/categories");
        return { success: true, message: "Category deleted successfully" };
    } catch {
        return { success: false, message: "Database error. Please try again." };
    }
}

// ── Toggle Active ─────────────────────────────────────────────────────────

export async function toggleCategoryActive(id: number, is_active: boolean) {
    await db.categories.update({ where: { id }, data: { is_active } });
    revalidatePath("/dashboard/categories");
}

// ── Reorder ───────────────────────────────────────────────────────────────

export async function updateSortOrder(id: number, sort_order: number) {
    await db.categories.update({ where: { id }, data: { sort_order } });
    revalidatePath("/dashboard/categories");
}