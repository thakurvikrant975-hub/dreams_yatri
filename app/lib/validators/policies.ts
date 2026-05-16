import { z } from "zod";

export const PolicySchema = z.object({
  type: z.enum(["CANCELLATION", "DATE_CHANGE", "REFUND", "TERMS_AND_CONDITIONS"], {
    message: "Policy type is required",
  }),

  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or less")
    .transform((s) => s.trim()),

  points: z
    .array(z.string().min(1, "Point cannot be empty"))
    .min(1, "At least one point is required"),

  is_active: z.boolean().default(true),

  sort_order: z.coerce.number().int().min(0).default(0),
});

export type PolicyInput = z.infer<typeof PolicySchema>;
