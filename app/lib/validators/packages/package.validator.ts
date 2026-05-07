import { z } from "zod";

// ── Shared primitives ──────────────────────────────────────────────────────────

export const SlugSchema = z
  .string()
  .min(1, "Slug is required")
  .max(255)
  .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only");

// Zod v4: z.string().url() is deprecated — use z.url() standalone
const optionalUrl = z.union([z.url(), z.literal("")]).optional();

// Zod v4: z.nativeEnum() is deprecated — use z.enum() with string values
export const CabTypeSchema = z.enum([
  "SEDAN",
  "HATCHBACK",
  "SUV",
  "INNOVA",
  "ERTIGA",
  "WAGON_R",
  "BOLERO",
  "TEMPO_TRAVELLER",
  "MINI_VAN",
  "BUS",
]);
export type CabTypeValue = z.infer<typeof CabTypeSchema>;

// ── Package meta ───────────────────────────────────────────────────────────────

export const CreatePackageSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(255, "Title too long"),
  slug: SlugSchema,
  destination_id: z.number().int().positive("Destination is required"),
  description: z.string().max(5000).optional(),
  thumbnail: optionalUrl,
  inclusions: z.array(z.string().min(1, "Inclusion cannot be empty")).default([]),
  exclusions: z.array(z.string().min(1, "Exclusion cannot be empty")).default([]),
  is_active: z.boolean().default(true),
  tag_ids: z.array(z.number().int().positive()).default([]),
  category_ids: z.array(z.number().int().positive()).default([]),
  policy_ids: z.array(z.number().int().positive()).default([]),
});

export const UpdatePackageSchema = CreatePackageSchema.partial().required({
  title: true,
  slug: true,
  destination_id: true,
});

export type CreatePackageDTO = z.infer<typeof CreatePackageSchema>;
export type UpdatePackageDTO = z.infer<typeof UpdatePackageSchema>;

// ── Package duration ───────────────────────────────────────────────────────────

const DurationBaseSchema = z.object({
  package_id: z.number().int().positive(),
  slug: SlugSchema,
  label: z
    .string()
    .min(1, "Label is required")
    .max(100, "Label too long"),
  days: z.number().int().min(1, "Minimum 1 day"),
  nights: z.number().int().min(0, "Nights cannot be negative"),
  is_default: z.boolean().default(false),
  sort_order: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
  thumbnail_url: optionalUrl,
});

const nightsMatchDays = (data: { days: number; nights: number }) =>
  data.nights === data.days - 1;

// path must be mutable PropertyKey[] — do not use `as const`
const nightsMatchDaysError = {
  message: "Nights must equal days minus 1",
  path: ["nights"] as PropertyKey[],
};

export const CreateDurationSchema = DurationBaseSchema.refine(
  nightsMatchDays,
  nightsMatchDaysError
);

export const UpdateDurationSchema = DurationBaseSchema.omit({ package_id: true })
  .partial()
  .required({ slug: true, label: true, days: true, nights: true })
  .refine(nightsMatchDays, nightsMatchDaysError);

export type CreateDurationDTO = z.infer<typeof CreateDurationSchema>;
export type UpdateDurationDTO = z.infer<typeof UpdateDurationSchema>;

// ── Package stay category ──────────────────────────────────────────────────────

export const CreateStayCategorySchema = z.object({
  package_id: z.number().int().positive(),
  slug: SlugSchema,
  label: z
    .string()
    .min(1, "Label is required")
    .max(100, "Label too long"),
  description: z.string().max(500).optional(),
  min_duration_days: z.number().int().min(1).optional(),
  is_default: z.boolean().default(false),
  sort_order: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
});

export const UpdateStayCategorySchema = CreateStayCategorySchema.omit({
  package_id: true,
}).partial();

export type CreateStayCategoryDTO = z.infer<typeof CreateStayCategorySchema>;
export type UpdateStayCategoryDTO = z.infer<typeof UpdateStayCategorySchema>;

// ── Package gallery ────────────────────────────────────────────────────────────

const GallerySourceTypeSchema = z.enum([
  "PACKAGE",
  "HOTEL",
  "ROOM",
  "ACTIVITY",
]);

export const UpsertGalleryImageSchema = z.object({
  package_id: z.number().int().positive(),
  image_url: z.url(),
  source_type: GallerySourceTypeSchema,
  source_id: z.number().int().positive().optional(),
  position: z.number().int().min(1).max(5),
  label: z.string().max(100).optional(),
});

export type UpsertGalleryImageDTO = z.infer<typeof UpsertGalleryImageSchema>;
