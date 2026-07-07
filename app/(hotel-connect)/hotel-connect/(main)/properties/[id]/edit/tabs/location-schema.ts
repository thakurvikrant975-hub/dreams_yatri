import { z } from "zod";

// Reject empty/missing input outright instead of letting Number("") coerce to
// 0 and silently pass the -90..90 / -180..180 range check — that previously
// let a bypassed (or no-JS) submit save "null island" (0, 0) as a valid pin.
const requiredCoord = (min: number, max: number, label: string) =>
  z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number({ message: `${label} is required — pin your property on the map` }).min(min).max(max)
  );

export const locationSchema = z.object({
  address:   z.string().min(5, "Full address is required"),
  landmark:  z.string().max(200).optional().or(z.literal("")),
  city:      z.string().min(1, "City is required"),
  state:     z.string().min(1, "State is required"),
  country:   z.string().min(1, "Country is required"),
  // India requires the standard 6-digit PIN; other countries get a looser
  // alphanumeric postal-code check since formats vary widely (e.g. "SW1A 1AA").
  pincode:   z.string().min(3, "Enter a valid postal code").max(10, "Enter a valid postal code"),
  latitude:  requiredCoord(-90, 90, "Latitude"),
  longitude: requiredCoord(-180, 180, "Longitude"),
}).superRefine((data, ctx) => {
  const isIndia = data.country.trim().toLowerCase() === "india";
  if (isIndia && !/^\d{6}$/.test(data.pincode)) {
    ctx.addIssue({ code: "custom", path: ["pincode"], message: "Enter a valid 6-digit pincode" });
  }
});

export type LocationValues = z.infer<typeof locationSchema>;
export type LocationState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof LocationValues, string[]>>;
};
