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
