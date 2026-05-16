import { z } from "zod";

export const CategorySchema = z.object({
  name: z
    .string()
    .min(1, "Category name is required")
    .max(100, "Name must be 100 characters or less")
    .transform((s) =>
      s.trim().replace(/\b\w/g, (c) => c.toUpperCase())
    ),

  slug: z
    .string()
    .min(1, "Slug is required")
    .max(120, "Slug must be 120 characters or less")
    .regex(
      /^[a-z0-9]+(-[a-z0-9]+)*$/,
      "Slug must be lowercase letters and numbers separated by hyphens — no leading or trailing hyphens"
    ),

  description: z
    .string()
    .max(2000, "Description must be 2000 characters or less")
    .optional()
    .transform((s) => s?.trim() || undefined),

  meta_title: z
    .string()
    .max(60, "SEO title must be 60 characters or less")
    .optional()
    .transform((s) => s?.trim().slice(0, 60) || undefined),

  meta_desc: z
    .string()
    .max(160, "SEO description must be 160 characters or less")
    .optional()
    .transform((s) => s?.trim().slice(0, 160) || undefined),

  parent_id: z.number().int().positive().nullable(),

  sort_order: z.number().int().min(0).default(0),

  is_active: z.boolean().default(true),
});

export type CategoryInput = z.infer<typeof CategorySchema>;
