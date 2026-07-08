"use server";

import crypto from "crypto";
import { db } from "@/app/lib/db";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { checkRateLimit } from "@/app/lib/rate-limit";
import { sendEmail } from "@/app/lib/functions/sendEmail";
import { hotelOwnerVerificationEmailTemplate } from "@/app/lib/functions/emailTemplates";

export type VerifyEmailResult = { ok: boolean; error?: string };

export async function verifyOwnerEmail(token: string): Promise<VerifyEmailResult> {
  if (!token || token.length < 10) return { ok: false, error: "Invalid verification link." };

  const owner = await db.hotelOwner.findUnique({
    where: { email_verification_token: token },
    select: { id: true, email_verified: true, email_verification_expires: true },
  });

  if (!owner) return { ok: false, error: "This verification link is invalid or has already been used." };
  if (owner.email_verified) return { ok: true };
  if (!owner.email_verification_expires || owner.email_verification_expires < new Date()) {
    return { ok: false, error: "This verification link has expired. Please request a new one from your dashboard." };
  }

  await db.hotelOwner.update({
    where: { id: owner.id },
    data: { email_verified: true, email_verification_token: null, email_verification_expires: null },
  });

  return { ok: true };
}

const RESEND_ATTEMPT_LIMIT = 3;
const RESEND_WINDOW_SECONDS = 60 * 60;

export type ResendVerificationResult = { ok: boolean; error?: string; devUrl?: string };

/**
 * Lets an owner re-trigger the verification email themselves — the original
 * signup email is best-effort (fire-and-forget) and can silently fail to
 * deliver (e.g. Resend sandbox mode only delivers to the account owner's own
 * address until a sending domain is verified), previously leaving no way to
 * complete verification other than editing the DB directly.
 */
export async function resendVerificationEmail(): Promise<ResendVerificationResult> {
  const session = await hotelConnectAuth();
  if (!session) return { ok: false, error: "Please log in again." };

  const owner = await db.hotelOwner.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, email_verified: true },
  });
  if (!owner) return { ok: false, error: "Account not found." };
  if (owner.email_verified) return { ok: true };

  const { allowed } = await checkRateLimit(`ratelimit:resend-verify-email:${owner.id}`, RESEND_ATTEMPT_LIMIT, RESEND_WINDOW_SECONDS);
  if (!allowed) return { ok: false, error: "Too many resend attempts. Please wait a while and try again." };

  const verificationToken = crypto.randomBytes(32).toString("hex");
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db.hotelOwner.update({
    where: { id: owner.id },
    data: { email_verification_token: verificationToken, email_verification_expires: verificationExpires },
  });

  const verifyUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/hotel-connect/verify-email?token=${verificationToken}`;
  const isDev = process.env.NODE_ENV === "development";

  // Dev: hand the link back directly instead of relying on real delivery —
  // Resend's sandbox mode can't send to arbitrary test addresses anyway.
  if (isDev) return { ok: true, devUrl: verifyUrl };

  const sent = await sendEmail({
    to: owner.email,
    subject: "Verify your Dreams Yatri Hotel Connect account",
    html: hotelOwnerVerificationEmailTemplate(owner.name, verifyUrl),
  });
  if (!sent) return { ok: false, error: "Failed to send verification email. Please try again in a moment." };

  return { ok: true };
}
