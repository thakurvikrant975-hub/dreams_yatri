import { z } from "zod";

export const DestinationSchema = z
  .object({
    name: z
      .string()
      .min(1, "Destination name is required")
      .max(150, "Name must be 150 characters or less")
      .transform((s) =>
        s
          .trim()
          .replace(/\b\w/g, (c) => c.toUpperCase())
      ),

    slug: z
      .string()
      .min(1, "Slug is required")
      .max(180, "Slug must be 180 characters or less")
      .regex(
        /^[a-z0-9]+(-[a-z0-9]+)*$/,
        "Slug must be lowercase letters and numbers separated by hyphens, no leading or trailing hyphens"
      ),

    country: z
      .string()
      .min(1, "Country is required")
      .max(100, "Country must be 100 characters or less"),

    region_id: z
      .number({ message: "Region is required" })
      .int()
      .positive("Region is required"),

    location_id: z
      .string()
      .optional()
      .transform((s) => s?.trim() || undefined),

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

    is_active: z.boolean().default(false),

    thumbnail: z
      .string()
      .min(1, "Thumbnail is required"),

    cover_image: z
      .string()
      .optional()
      .transform((s) => s?.trim() || undefined),
  })
  .superRefine((data, ctx) => {
    if (data.is_active) {
      if (!data.meta_title) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["meta_title"],
          message: "SEO title is required to make a destination active",
        });
      }
      if (!data.meta_desc) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["meta_desc"],
          message: "SEO description is required to make a destination active",
        });
      }
    }
  });

export type DestinationInput = z.infer<typeof DestinationSchema>;
