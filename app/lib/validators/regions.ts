// app/lib/validators/regions.ts

import { z } from "zod";

export const RegionSchema = z.object({
  name:        z.string().min(1, "Name is required"),
  slug:        z.string().min(1, "Slug is required").regex(/^[a-z0-9-]+$/, "Lowercase, numbers and hyphens only"),
  country:     z.string().min(1, "Country is required"),
  description: z.string().optional(),
  meta_title:  z.string().optional(),
  meta_desc:   z.string().optional(),
  is_active:   z.boolean().default(true),
});

export type RegionInput = z.infer<typeof RegionSchema>;