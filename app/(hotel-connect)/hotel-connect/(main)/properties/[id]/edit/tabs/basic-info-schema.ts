import { z } from "zod";

const year = new Date().getFullYear();

const optionalYear = (min: number) =>
  z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().int().min(min).max(year).optional().nullable()
  );

export const basicInfoSchema = z.object({
  name: z
    .string()
    .min(2, "Property name must be at least 2 characters")
    .max(100, "Property name is too long"),

  // "0" submitted by "Non-Rated / Budget" option → treated as null
  star_rating: z.preprocess(
    (v) => (v === "" || v === "0" || v == null ? undefined : v),
    z.coerce.number().int().min(1).max(5).optional().nullable()
  ),

  year_built: optionalYear(1800),
  booking_since_year: optionalYear(1990),

  has_channel_manager: z.boolean().default(false),
  channel_manager_name: z.string().max(100).optional().or(z.literal("")),

  contact_email: z
    .string()
    .email("Enter a valid email address")
    .optional()
    .or(z.literal("")),

  contact_mobile_cc: z.string().default("+91"),

  // Format depends on contact_mobile_cc — checked in superRefine below since
  // a bare regex here can't see the sibling country-code field. A hardcoded
  // 10-digit-only rule previously rejected every non-+91 number even though
  // the client's own OTP flow already accepted 5-15 digits for those.
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

export type BasicInfoValues = z.infer<typeof basicInfoSchema>;

export type BasicInfoState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof BasicInfoValues, string[]>>;
};
