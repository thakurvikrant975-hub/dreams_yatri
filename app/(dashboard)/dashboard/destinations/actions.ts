"use server";

import { db } from "@/app/lib/db";
import { deleteFromR2 } from "@/lib/r2/r2delete";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ── Schema ────────────────────────────────────────────────────────────────

const DestinationSchema = z.object({
    name: z.string().min(1, "Name is required"),
    slug: z.string().min(1, "Slug is required").regex(/^[a-z0-9-]+$/, "Lowercase, numbers and hyphens only"),
    country: z.string().min(1, "Country is required"),
    region_id: z.number({ message: "Region is required" }).int().positive("Region is required"),
    description: z.string().optional(),
    meta_title: z.string().optional(),
    meta_desc: z.string().optional(),
    is_active: z.boolean().default(true),
});

export type DestinationFormState = {
    success: boolean;
    message: string;
    errors?: Record<string, string[]>;
};

// ── Read ──────────────────────────────────────────────────────────────────

export async function getDestinations() {
    return db.destinations.findMany({
        orderBy: { created_at: "desc" },
        include: {
            region: { select: { id: true, name: true, slug: true } },
            _count: {
                select: {
                    packages: true,
                    hotels: true,
                    activities: true,
                },
            },
        },
    });
}

export async function getDestinationById(id: number) {
    return db.destinations.findUnique({
        where: { id },
        include: { region: { select: { id: true, name: true } } },
    });
}

// Needed for the region select dropdown in the form
export async function getRegionsForSelect() {
    return db.regions.findMany({
        where: { is_active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, slug: true },
    });
}

// ── Create ────────────────────────────────────────────────────────────────

export async function createDestination(
    _prev: DestinationFormState,
    formData: FormData,
): Promise<DestinationFormState> {
    const raw = {
        name: formData.get("name") as string,
        slug: formData.get("slug") as string,
        country: formData.get("country") as string,
        region_id: Number(formData.get("region_id")),
        description: (formData.get("description") as string) || undefined,
        meta_title: (formData.get("meta_title") as string) || undefined,
        meta_desc: (formData.get("meta_desc") as string) || undefined,
        is_active: formData.get("is_active") === "true",
    };

    const thumbnail = (formData.get("thumbnail") as string) || null;
    const cover_image = (formData.get("cover_image") as string) || null;

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
            data: { ...parsed.data, thumbnail, cover_image },
        });

        revalidatePath("/dashboard/destinations");
        return { success: true, message: "Destination created successfully" };
    } catch {
        return { success: false, message: "Database error. Please try again." };
    }
}

// ── Update ────────────────────────────────────────────────────────────────

export async function updateDestination(
    id: number,
    _prev: DestinationFormState,
    formData: FormData,
): Promise<DestinationFormState> {
    const raw = {
        name: formData.get("name") as string,
        slug: formData.get("slug") as string,
        country: formData.get("country") as string,
        region_id: Number(formData.get("region_id")),
        description: (formData.get("description") as string) || undefined,
        meta_title: (formData.get("meta_title") as string) || undefined,
        meta_desc: (formData.get("meta_desc") as string) || undefined,
        is_active: formData.get("is_active") === "true",
    };

    const newThumbnail = (formData.get("thumbnail") as string) || null;
    const newCoverImage = (formData.get("cover_image") as string) || null;

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

        const current = await db.destinations.findUnique({ where: { id } });
        if (!current) return { success: false, message: "Destination not found" };

        // Delete old images from R2 if replaced
        if (newThumbnail && current.thumbnail && newThumbnail !== current.thumbnail)
            await deleteFromR2(current.thumbnail).catch(console.error);
        if (newCoverImage && current.cover_image && newCoverImage !== current.cover_image)
            await deleteFromR2(current.cover_image).catch(console.error);

        await db.destinations.update({
            where: { id },
            data: {
                ...parsed.data,
                ...(newThumbnail !== null && { thumbnail: newThumbnail }),
                ...(newCoverImage !== null && { cover_image: newCoverImage }),
            },
        });

        revalidatePath("/dashboard/destinations");
        return { success: true, message: "Destination updated successfully" };
    } catch {
        return { success: false, message: "Database error. Please try again." };
    }
}

// ── Delete ────────────────────────────────────────────────────────────────

export async function deleteDestination(id: number): Promise<DestinationFormState> {
    try {
        const destination = await db.destinations.findUnique({
            where: { id },
            include: {
                _count: { select: { packages: true, hotels: true, activities: true } },
            },
        });

        if (!destination) return { success: false, message: "Destination not found" };

        const linkedCount = destination._count.packages + destination._count.hotels + destination._count.activities;
        if (linkedCount > 0) {
            return {
                success: false,
                message: `Cannot delete — ${destination._count.packages} package(s), ${destination._count.hotels} hotel(s) and ${destination._count.activities} activity(s) are linked.`,
            };
        }

        if (destination.thumbnail) await deleteFromR2(destination.thumbnail).catch(console.error);
        if (destination.cover_image) await deleteFromR2(destination.cover_image).catch(console.error);

        await db.destinations.delete({ where: { id } });
        revalidatePath("/dashboard/destinations");
        return { success: true, message: "Destination deleted successfully" };
    } catch {
        return { success: false, message: "Database error. Please try again." };
    }
}

// ── Toggle Active ─────────────────────────────────────────────────────────

export async function toggleDestinationActive(id: number, is_active: boolean) {
    await db.destinations.update({ where: { id }, data: { is_active } });
    revalidatePath("/dashboard/destinations");
}