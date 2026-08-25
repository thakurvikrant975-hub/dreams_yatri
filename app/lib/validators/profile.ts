import { z } from "zod";

const optionalTrimmed = (max: number) =>
  z.string().max(max).optional().transform((s) => s?.trim() || undefined);

export const PersonalDetailsSchema = z.object({
  personalEmail: z.string().email("Enter a valid email").optional().or(z.literal("")).transform((s) => s || undefined),
  personalMobile: optionalTrimmed(15),
  alternativeMobile: optionalTrimmed(15),
  officialMobile: optionalTrimmed(15),
});
export type PersonalDetailsInput = z.infer<typeof PersonalDetailsSchema>;

export const GenderSchema = z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]);

// The onboarding popup's required set — a stricter superset of
// PersonalDetailsSchema, since those fields are optional everywhere else in
// the app (the ordinary profile-edit dialogs) but are exactly what gates the
// popup from closing the first time someone completes it.
export const OnboardingPersonalSchema = z.object({
  gender: GenderSchema,
  personalEmail: z.string().email("Enter a valid email"),
  personalMobile: z.string().trim().min(1, "Personal mobile is required").max(15),
  alternativeMobile: z.string().trim().min(1, "Alternate mobile is required").max(15),
  officialMobile: optionalTrimmed(15),
  // Exactly one of these two must hold: a real date, or the "don't
  // remember" flag — enforced by .refine below rather than by making
  // joiningDate itself required, since "I don't remember" is a legitimate,
  // deliberate answer, not a missing one.
  joiningDate: z.string().optional().transform((s) => s || undefined),
  joiningDateUnknown: z.boolean().optional().default(false),
}).refine((data) => !!data.joiningDate || data.joiningDateUnknown, {
  message: "Enter a joining date, or choose \"I don't remember\"",
  path: ["joiningDate"],
});
export type OnboardingPersonalInput = z.infer<typeof OnboardingPersonalSchema>;

export const FamilyDetailsSchema = z.object({
  fatherName: optionalTrimmed(255),
  fatherMobile: optionalTrimmed(15),
  motherName: optionalTrimmed(255),
  motherMobile: optionalTrimmed(15),
});
export type FamilyDetailsInput = z.infer<typeof FamilyDetailsSchema>;

export const IdentityDocumentsSchema = z.object({
  aadhaarNumber: z
    .string()
    .optional()
    .transform((s) => s?.replace(/\s/g, "").trim() || undefined)
    .refine((s) => !s || /^\d{12}$/.test(s), "Aadhaar number must be 12 digits"),
  aadhaarFileKey: optionalTrimmed(500),
  aadhaarFileUrl: optionalTrimmed(1000),
  aadhaarBackFileKey: optionalTrimmed(500),
  aadhaarBackFileUrl: optionalTrimmed(1000),
  panNumber: z
    .string()
    .optional()
    .transform((s) => s?.toUpperCase().trim() || undefined)
    .refine((s) => !s || /^[A-Z]{5}\d{4}[A-Z]$/.test(s), "PAN must be in the format ABCDE1234F"),
  panFileKey: optionalTrimmed(500),
  panFileUrl: optionalTrimmed(1000),
});
export type IdentityDocumentsInput = z.infer<typeof IdentityDocumentsSchema>;

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "New password must be different from your current password",
    path: ["newPassword"],
  });
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
