import { z } from "zod";

export const locationSchema = z.object({
  address:   z.string().min(5, "Full address is required"),
  landmark:  z.string().max(200).optional().or(z.literal("")),
  city:      z.string().min(1, "City is required"),
  state:     z.string().min(1, "State is required"),
  country:   z.string().min(1, "Country is required"),
  pincode:   z.string().regex(/^\d{6}$/, "Enter a valid 6-digit pincode"),
  latitude:  z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

export type LocationValues = z.infer<typeof locationSchema>;
export type LocationState = {
  error?: string;
  fieldErrors?: Partial<Record<keyof LocationValues, string[]>>;
};
