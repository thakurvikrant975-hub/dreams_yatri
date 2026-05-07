import { z } from "zod";

export const createPackageSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(255, "Title must be less than 255 characters"),

  slug: z
    .string()
    .min(1, "Slug is required")
    .max(100, "Slug must be less than 100 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must be URL-friendly (lowercase letters, numbers, and hyphens)"
    ),

  thumbnail: z
    .string()
    .max(400, "Thumbnail URL must be less than 400 characters")
    .optional()
    .or(z.literal("")), // allow empty string from form

  description: z
    .string()
    .max(700, "Description must be less than 700 characters")
    .optional()
    .or(z.literal("")),

  destination_id: z.number().int().positive(),

  inclusions: z
    .array(
      z
        .string()
        .min(1, "Inclusion cannot be empty")
        .max(450, "Each inclusion must be less than 450 characters")
    )
    .max(100, "Maximum 100 inclusions allowed"),

  exclusions: z
    .array(
      z
        .string()
        .min(1, "Exclusion cannot be empty")
        .max(450, "Each exclusion must be less than 450 characters")
    )
    .max(100, "Maximum 100 exclusions allowed"),

  tags: z
    .array(
      z
        .string()
        .min(1, "Tag cannot be empty")
        .max(50, "Tag must be less than 50 characters")
    )
    .max(12, "Maximum 12 tags allowed"),

  category: z
    .array(
      z
        .string()
        .min(1, "Category cannot be empty")
        .max(100, "Category must be less than 100 characters")
    )
    .max(10, "Maximum 10 categories allowed"),
});