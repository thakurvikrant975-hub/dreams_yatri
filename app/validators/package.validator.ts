import z from "zod";

export const createPackageSchema = z.object({
    title: z.string().min(1, "Title is required").max(255, "Title must be less than 255 characters"),
    slug: z.string().min(1, "Slug is required").max(100, "Slug must be less than 100 characters").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be URL-friendly (lowercase letters, numbers, and hyphens)"),
    thumbnail: z.string().optional(),
    description: z.string().optional(),
    destination_id: z.number(),
    inclusions: z.array(z.string()),
    exclusions: z.array(z.string()),
    tags: z.array(z.string()),
    category: z.array(z.string()),
});