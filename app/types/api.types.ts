// app/types/api.types.ts
import { z } from "zod";

// ── Reusable field definitions ────────────────────────────────────────────────
const slugField = z
  .string()
  .min(2)
  .max(255)
  .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers and hyphens only");

const nameField = z.string().min(2).max(255);

// ── Pagination ────────────────────────────────────────────────────────────────
export const paginationSchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(30).default(20),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

// ── Region ────────────────────────────────────────────────────────────────────
export const createRegionSchema = z.object({
  name: nameField,
  slug: slugField,
});

export const updateRegionSchema = createRegionSchema.partial();

export type CreateRegionInput = z.infer<typeof createRegionSchema>;
export type UpdateRegionInput = z.infer<typeof updateRegionSchema>;

// ── Destination ───────────────────────────────────────────────────────────────
export const createDestinationSchema = z.object({
  name:      nameField,
  slug:      slugField,
  country:   z.string().min(2).max(100).default("India"),
  region_id: z.number().int().positive(),
});

export const updateDestinationSchema = createDestinationSchema.partial();

export type CreateDestinationInput = z.infer<typeof createDestinationSchema>;
export type UpdateDestinationInput = z.infer<typeof updateDestinationSchema>;

// ── Package ───────────────────────────────────────────────────────────────────
export const createPackageSchema = z.object({
  title:               z.string().min(3).max(255),
  slug:                slugField,
  description:         z.string().optional(),
  base_destination_id: z.number().int().positive(),
  is_active:           z.boolean().default(true),
});

export const updatePackageSchema = createPackageSchema.partial();

export type CreatePackageInput = z.infer<typeof createPackageSchema>;
export type UpdatePackageInput = z.infer<typeof updatePackageSchema>;

// ── Package Variant ───────────────────────────────────────────────────────────
export const createPackageVariantSchema = z.object({
  package_id:       z.number().int().positive(),
  title:            z.string().max(255).optional(),
  duration_days:    z.number().int().positive(),
  duration_nights:  z.number().int().positive(),
  starting_price:   z.number().positive(),
  route:            z.array(z.string()).min(1),
  region_breakdown: z.record(z.string(), z.number()),
  stay_category:    z.enum([
    "1-star", "2-star", "3-star", "4-star", "5-star", "homestay", "camping"
  ]),
  is_active:        z.boolean().default(true),
});

export const updatePackageVariantSchema = createPackageVariantSchema.partial();

export type CreatePackageVariantInput = z.infer<typeof createPackageVariantSchema>;
export type UpdatePackageVariantInput = z.infer<typeof updatePackageVariantSchema>;

// ── Package Itinerary ─────────────────────────────────────────────────────────
export const itineraryDaySchema = z.object({
  day:        z.number().int().positive(),
  title:      z.string().min(1),
  activities: z.array(z.string()).min(1),
});

export const createItinerarySchema = z.object({
  variant_id: z.number().int().positive(),
  itinerary:  z.array(itineraryDaySchema).min(1),
});

export const updateItinerarySchema = createItinerarySchema.partial();

export type ItineraryDay         = z.infer<typeof itineraryDaySchema>;
export type CreateItineraryInput = z.infer<typeof createItinerarySchema>;
export type UpdateItineraryInput = z.infer<typeof updateItinerarySchema>;

// ── Image Upload ──────────────────────────────────────────────────────────────
export const IMAGE_FOLDERS = ["packages", "destinations", "regions", "blog"] as const;
export type ImageFolder = typeof IMAGE_FOLDERS[number];

export const uploadImageSchema = z.object({
  folder: z.enum(IMAGE_FOLDERS),
});