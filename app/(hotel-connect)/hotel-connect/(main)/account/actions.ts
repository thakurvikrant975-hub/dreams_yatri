"use server";

import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";

export type UpdatePhoneState = { ok?: boolean; error?: string };

export async function updateOwnerPhone(
  cc: string,
  phone: string,
): Promise<UpdatePhoneState> {
  const session = await hotelConnectAuth();
  if (!session) return { error: "Please sign in again." };

  const trimmed = phone.trim();
  const valid = cc === "+91" ? /^\d{10}$/.test(trimmed) : /^\d{5,15}$/.test(trimmed);
  if (!valid) return { error: "Enter a valid phone number." };

  try {
    await db.hotelOwner.update({
      where: { id: session.user.id },
      data: { phone_cc: cc, phone: trimmed },
    });
  } catch (err) {
    console.error("[updateOwnerPhone]", err);
    return { error: "Couldn't update your phone number. Please try again." };
  }

  return { ok: true };
}
