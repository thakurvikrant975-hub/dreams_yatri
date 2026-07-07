"use server";

import { hash } from "bcryptjs";
import { z } from "zod";
import { db } from "@/app/lib/db";

const ResetSchema = z.object({
  token: z.string().min(10),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/[a-zA-Z]/, "Password must include at least one letter.")
    .regex(/[0-9]/, "Password must include at least one number."),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

export type ResetPasswordState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: { password?: string[]; confirmPassword?: string[] };
};

export async function resetPassword(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const parsed = ResetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    if (flat.token) return { error: "Invalid or missing reset link." };
    return { fieldErrors: { password: flat.password, confirmPassword: flat.confirmPassword } };
  }

  const { token, password } = parsed.data;

  const owner = await db.hotelOwner.findUnique({
    where: { password_reset_token: token },
    select: { id: true, password_reset_expires: true },
  });
  if (!owner) return { error: "This reset link is invalid or has already been used." };
  if (!owner.password_reset_expires || owner.password_reset_expires < new Date()) {
    return { error: "This reset link has expired. Please request a new one." };
  }

  const hashed = await hash(password, 12);
  await db.hotelOwner.update({
    where: { id: owner.id },
    data: { password: hashed, password_reset_token: null, password_reset_expires: null },
  });

  return { ok: true };
}
