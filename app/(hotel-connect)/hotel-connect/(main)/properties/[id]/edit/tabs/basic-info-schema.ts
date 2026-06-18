import { z } from "zod";
import { PropertySubType } from "@/app/generated/prisma";

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

  property_sub_type: z.nativeEnum(PropertySubType, {
    message: "Please select a property type",
  }),

  star_rating: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
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

  contact_mobile: z
    .string()
    .regex(/^\d{10}$/, "Enter a valid 10-digit number")
    .optional()
    .or(z.literal("")),

  whatsapp_same_as_mobile: z.boolean().default(false),
  contact_whatsapp: z.string().optional().or(z.literal("")),
  contact_landline: z.string().optional().or(z.literal("")),
});

export type BasicInfoValues = z.infer<typeof basicInfoSchema>;

export type BasicInfoState = {
  error?: string;
  fieldErrors?: Partial<Record<keyof BasicInfoValues, string[]>>;
};
