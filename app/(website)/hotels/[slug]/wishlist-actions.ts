"use server";

import { db } from "@/app/lib/db";
import { getAuthenticatedUser } from "@/app/lib/functions/getAuthenticatedUser";

export async function isHotelWishlisted(hotelId: number): Promise<boolean> {
  const user = await getAuthenticatedUser();
  if (!user?.id) return false;

  const row = await db.hotel_wishlist.findUnique({
    where: { user_id_hotel_id: { user_id: user.id, hotel_id: hotelId } },
    select: { id: true },
  });
  return !!row;
}

export type ToggleWishlistResult = { ok: boolean; wishlisted: boolean; error?: string };

export async function toggleWishlist(hotelId: number): Promise<ToggleWishlistResult> {
  const user = await getAuthenticatedUser();
  if (!user?.id) return { ok: false, wishlisted: false, error: "Please log in to save hotels." };

  const existing = await db.hotel_wishlist.findUnique({
    where: { user_id_hotel_id: { user_id: user.id, hotel_id: hotelId } },
    select: { id: true },
  });

  if (existing) {
    await db.hotel_wishlist.delete({ where: { id: existing.id } });
    return { ok: true, wishlisted: false };
  }

  await db.hotel_wishlist.create({ data: { user_id: user.id, hotel_id: hotelId } });
  return { ok: true, wishlisted: true };
}
