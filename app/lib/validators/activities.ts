import { z } from "zod";

export const ActivitySchema = z.object({
  name: z
    .string()
    .min(1, "Activity name is required")
    .max(90, "Name must be 90 characters or less")
    .transform((s) => s.trim()),

  slug: z
    .string()
    .min(1, "Slug is required")
    .max(220, "Slug must be 220 characters or less")
    .regex(
      /^[a-z0-9]+(-[a-z0-9]+)*$/,
      "Slug must be lowercase letters and numbers separated by hyphens — no leading or trailing hyphens"
    ),

  category_id: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .nullable(),

  description: z
    .string()
    .max(5000, "Description must be 5000 characters or less")
    .optional()
    .transform((s) => s?.trim() || undefined),

  difficulty: z
    .string()
    .max(50)
    .optional()
    .transform((s) => s?.trim() || undefined),

  duration_hours: z.coerce
    .number()
    .min(0, "Duration must be 0 or more")
    .max(999)
    .optional()
    .nullable(),

  location_id: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v && v !== "" ? BigInt(v) : null)),

  address: z
    .string()
    .max(500)
    .optional()
    .transform((s) => s?.trim() || undefined),

  city: z
    .string()
    .max(100)
    .optional()
    .transform((s) => s?.trim() || undefined),

  state: z
    .string()
    .max(100)
    .optional()
    .transform((s) => s?.trim() || undefined),

  country: z
    .string()
    .max(100)
    .optional()
    .transform((s) => s?.trim() || undefined),

  pincode: z
    .string()
    .max(20)
    .optional()
    .transform((s) => s?.trim() || undefined),

  phone: z
    .string()
    .max(20)
    .optional()
    .transform((s) => s?.trim() || undefined),

  email: z
    .string()
    .email("Invalid email address")
    .max(200)
    .optional()
    .or(z.literal(""))
    .transform((s) => s?.trim() || undefined),

  is_active: z.boolean().default(true),

  included_meals: z.preprocess(
    (v) => {
      if (Array.isArray(v)) return v;
      if (typeof v === "string" && v) { try { return JSON.parse(v); } catch { return []; } }
      return [];
    },
    z.array(z.string()).default([]),
  ),
});

export const ActivityUpdateSchema = ActivitySchema.omit({ slug: true });

export type ActivityInput       = z.infer<typeof ActivitySchema>;
export type ActivityUpdateInput = z.infer<typeof ActivityUpdateSchema>;
