import { z } from "zod";

// ── Shared percentage primitive ────────────────────────────────────────────────

const PercentageSchema = z
  .number()
  .min(0, "Cannot be negative")
  .max(100, "Cannot exceed 100%")
  .refine(
    (v) => Number((v * 100).toFixed(0)) % 1 === 0 || true,
    { message: "Maximum 2 decimal places" }
  );

// ── Single pricing entry (per package × duration × stay_category) ─────────────

export const SetPricingSchema = z.object({
  package_id: z.number().int().positive(),
  duration_id: z.number().int().positive("Duration is required"),
  stay_category_id: z.number().int().positive("Stay category is required"),
  margin_percentage: PercentageSchema,
  gst_percentage: PercentageSchema,
});

// ── Seasonal margin ───────────────────────────────────────────────────────────
// A date-ranged override of the base margin above. The year in the dates is
// stored but ignored when the engine matches (resolvePackageMargin), so a
// season recurs every year — which is also why a range may legitimately end
// "before" it starts (20 Dec → 5 Jan wraps the new year) and isn't rejected
// here on that basis alone.

const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

export const MarginSeasonSchema = z.object({
  season_name: z.string().trim().max(80, "Season name is too long").nullable(),
  valid_from: IsoDateSchema,
  valid_to: IsoDateSchema,
  margin_percentage: PercentageSchema,
  color: z.string().max(32).nullable(),
});

export const ReplaceMarginSeasonsSchema = z.object({
  package_id: z.number().int().positive(),
  duration_id: z.number().int().positive("Duration is required"),
  stay_category_id: z.number().int().positive("Stay category is required"),
  seasons: z.array(MarginSeasonSchema).max(60, "Too many seasons for one combination"),
});

export type MarginSeasonDTO = z.infer<typeof MarginSeasonSchema>;
export type ReplaceMarginSeasonsDTO = z.infer<typeof ReplaceMarginSeasonsSchema>;

export const UpdatePricingSchema = SetPricingSchema.omit({
  package_id: true,
  duration_id: true,
  stay_category_id: true,
}).partial();

export type SetPricingDTO = z.infer<typeof SetPricingSchema>;
export type UpdatePricingDTO = z.infer<typeof UpdatePricingSchema>;

// ── Bulk pricing (set all at once for a package) ──────────────────────────────

export const BulkSetPricingSchema = z.object({
  package_id: z.number().int().positive(),
  entries: z
    .array(
      z.object({
        duration_id: z.number().int().positive("Duration is required"),
        stay_category_id: z.number().int().positive("Stay category is required"),
        margin_percentage: PercentageSchema,
        gst_percentage: PercentageSchema,
      })
    )
    .min(1, "At least one pricing entry required")
    .refine(
      (entries) => {
        const keys = entries.map(
          (e) => `${e.duration_id}_${e.stay_category_id}`
        );
        return keys.length === new Set(keys).size;
      },
      {
        message:
          "Duplicate duration + stay_category combination in bulk pricing input",
      }
    ),
});

export type BulkSetPricingDTO = z.infer<typeof BulkSetPricingSchema>;

// ── Price computation query ────────────────────────────────────────────────────

export const PackagePriceQuerySchema = z.object({
  package_id: z.number().int().positive(),
  duration_id: z.number().int().positive("Duration is required"),
  stay_category_id: z.number().int().positive("Stay category is required"),
  pax: z
    .number()
    .int()
    .min(1, "At least 1 person required")
    .max(100, "Maximum 100 persons"),
});

export type PackagePriceQueryDTO = z.infer<typeof PackagePriceQuerySchema>;

// ── Cab option ─────────────────────────────────────────────────────────────────

import { CabTypeSchema } from "./package.validator";

export const UpsertCabOptionSchema = z.object({
  package_id: z.number().int().positive(),
  cab_type: CabTypeSchema,
  capacity: z.number().int().min(1, "Capacity must be at least 1"),
  rate_per_cab: z
    .number()
    .positive("Rate must be a positive amount")
    .max(999999.99),
  is_default: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

export type UpsertCabOptionDTO = z.infer<typeof UpsertCabOptionSchema>;
