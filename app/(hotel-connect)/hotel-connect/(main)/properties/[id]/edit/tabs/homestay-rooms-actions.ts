"use server";

import { redirect } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";

export type HomestayRoomsState = { ok?: boolean; error?: string };

export async function saveHomestayRooms(
  hotelId: number,
  _prev: HomestayRoomsState,
  _formData: FormData
): Promise<HomestayRoomsState> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");

  const ownerId = session.user.id;
  const hotel = await db.hotels.findFirst({
    where: { id: hotelId, owner_id: ownerId },
    select: { id: true, wizard_step: true },
  });
  if (!hotel) redirect("/hotel-connect");

  await db.hotels.update({
    where: { id: hotelId },
    data: { wizard_step: Math.max(hotel.wizard_step, 4) },
  });

  return { ok: true };
}
