"use server";

import { db } from "@/app/lib/db";

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
