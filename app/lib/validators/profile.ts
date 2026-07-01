import { z } from "zod";

const optionalTrimmed = (max: number) =>
  z.string().max(max).optional().transform((s) => s?.trim() || undefined);

export const PersonalDetailsSchema = z.object({
  personalEmail: z.string().email("Enter a valid email").optional().or(z.literal("")).transform((s) => s || undefined),
  personalMobile: optionalTrimmed(15),
  alternativeMobile: optionalTrimmed(15),
});
export type PersonalDetailsInput = z.infer<typeof PersonalDetailsSchema>;

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
