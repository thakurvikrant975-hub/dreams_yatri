"use server";

import crypto from "crypto";
import { z } from "zod";
import { db } from "@/app/lib/db";
import { checkRateLimit } from "@/app/lib/rate-limit";
import { sendEmail } from "@/app/lib/functions/sendEmail";
import { hotelOwnerPasswordResetTemplate } from "@/app/lib/functions/emailTemplates";

const EmailSchema = z.string().email();

export type ForgotPasswordState = { sent?: boolean; error?: string };

const RESET_REQUEST_LIMIT = 5;
const RESET_REQUEST_WINDOW_SECONDS = 60 * 60;

export async function requestPasswordReset(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const parsed = EmailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Please enter a valid email address." };
  const email = parsed.data;

  const rateKey = `ratelimit:hc-forgot-password:${email.toLowerCase()}`;
  const { allowed } = await checkRateLimit(rateKey, RESET_REQUEST_LIMIT, RESET_REQUEST_WINDOW_SECONDS);
  if (!allowed) {
    // Same generic message as success — don't reveal whether the rate limit
    // fired because of this email specifically.
    return { sent: true };
  }

  const owner = await db.hotelOwner.findUnique({ where: { email }, select: { id: true, name: true } });

  // Always report success regardless of whether the email is registered —
  // otherwise this endpoint becomes an account-enumeration oracle.
  if (owner) {
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 30 * 60 * 1000);
    await db.hotelOwner.update({
      where: { id: owner.id },
      data: { password_reset_token: token, password_reset_expires: expires },
    });
    const resetUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/hotel-connect/reset-password?token=${token}`;
    sendEmail({
      to: email,
      subject: "Reset your Dreams Yatri Hotel Connect password",
      html: hotelOwnerPasswordResetTemplate(owner.name, resetUrl),
    }).catch((err) => console.error("[requestPasswordReset] email failed:", err));
  }

  return { sent: true };
}
