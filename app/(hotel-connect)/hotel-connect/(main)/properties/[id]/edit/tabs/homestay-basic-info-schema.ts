import { z } from "zod";

const year = new Date().getFullYear();

const optionalYear = (min: number) =>
  z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().int().min(min).max(year).optional().nullable()
  );

export const homestayBasicInfoSchema = z.object({
  name: z
    .string()
    .min(2, "Property name must be at least 2 characters")
    .max(100, "Property name is too long"),

  year_built: optionalYear(1800),
  booking_since_year: optionalYear(1990),

  hosted_as: z
    .enum(["individually", "as_part_of_business"])
    .optional()
    .nullable(),

  host_lives_at_property: z.preprocess(
    (v) => v === "yes",
    z.boolean().default(false)
  ),

  contact_email: z
    .string()
    .email("Enter a valid email address")
    .optional()
    .or(z.literal("")),

  contact_mobile_cc: z.string().default("+91"),

  // Format depends on contact_mobile_cc — checked in superRefine below since
  // a bare regex here can't see the sibling country-code field.
  contact_mobile: z.string().optional().or(z.literal("")),

  whatsapp_same_as_mobile: z.boolean().default(false),
  contact_whatsapp: z.string().optional().or(z.literal("")),
  contact_landline: z.string().optional().or(z.literal("")),
}).superRefine((data, ctx) => {
  if (!data.contact_mobile) return;
  const isIndia = data.contact_mobile_cc === "+91";
  const valid = isIndia ? /^\d{10}$/.test(data.contact_mobile) : /^\d{5,15}$/.test(data.contact_mobile);
  if (!valid) {
    ctx.addIssue({
      code: "custom",
      path: ["contact_mobile"],
      message: isIndia ? "Enter a valid 10-digit number" : "Enter a valid mobile number",
    });
  }
});

export type HomestayBasicInfoValues = z.infer<typeof homestayBasicInfoSchema>;

export type HomestayBasicInfoState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof HomestayBasicInfoValues, string[]>>;
};
