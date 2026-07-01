import { z } from "zod";

export const LOCATION_TYPES = [
  "REGION", "SUBREGION", "COUNTRY", "STATE", "CITY", "DISTRICT", "AREA",
  "NEIGHBORHOOD", "VILLAGE", "LANDMARK", "AIRPORT", "BEACH", "MOUNTAIN",
  "ISLAND", "TOURISM_ZONE", "BUS_STATION", "TRAIN_STATION", "PORT",
  "HOTEL", "ACTIVITY", "ROUTE_STOP",
] as const;

export type LocationTypeValue = (typeof LOCATION_TYPES)[number];

export const LocationSchema = z.object({
  type: z.enum(LOCATION_TYPES, { message: "Type is required" }),

  name: z
    .string()
    .min(1, "Name is required")
    .max(255, "Name must be 255 characters or less")
    .transform((s) => s.trim()),

  official_name: z
    .string()
    .max(255, "Official name must be 255 characters or less")
    .optional()
    .transform((s) => s?.trim() || undefined),

  slug: z
    .string()
    .min(1, "Slug is required")
    .max(255, "Slug must be 255 characters or less")
    .regex(
      /^[a-z0-9]+(-[a-z0-9]+)*$/,
      "Slug must be lowercase letters and numbers separated by hyphens, no leading or trailing hyphens",
    ),

  short_code: z
    .string()
    .max(20, "Short code must be 20 characters or less")
    .optional()
    .transform((s) => s?.trim() || undefined),

  iso_code: z
    .string()
    .max(10, "ISO code must be 10 characters or less")
    .optional()
    .transform((s) => s?.trim() || undefined),

  latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
  longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
  elevation_meters: z.coerce.number().int().nullable().optional(),
  population: z.coerce.number().int().nonnegative().nullable().optional(),

  timezone: z
    .string()
    .max(64, "Timezone must be 64 characters or less")
    .optional()
    .transform((s) => s?.trim() || undefined),

  description: z
    .string()
    .max(2000, "Description must be 2000 characters or less")
    .optional()
    .transform((s) => s?.trim() || undefined),

  is_featured: z.boolean().default(false),
  is_popular: z.boolean().default(false),
  is_searchable: z.boolean().default(true),
  is_active: z.boolean().default(true),

  // Hierarchy — references to other Location rows (BigInt ids passed as strings).
  parent_id: z.string().optional().transform((s) => s?.trim() || undefined),
  country_id: z.string().optional().transform((s) => s?.trim() || undefined),
  state_id: z.string().optional().transform((s) => s?.trim() || undefined),
  city_id: z.string().optional().transform((s) => s?.trim() || undefined),

  // SEO + external source ids.
  seo_title: z
    .string()
    .max(60, "SEO title must be 60 characters or less")
    .optional()
    .transform((s) => s?.trim() || undefined),
  seo_description: z
    .string()
    .max(160, "SEO description must be 160 characters or less")
    .optional()
    .transform((s) => s?.trim() || undefined),
  hero_image: z.string().optional().transform((s) => s?.trim() || undefined),
  geonames_id: z.coerce.number().int().nullable().optional(),
  osm_id: z.string().max(50).optional().transform((s) => s?.trim() || undefined),
  mapbox_id: z.string().max(100).optional().transform((s) => s?.trim() || undefined),
});

export type LocationInput = z.infer<typeof LocationSchema>;
