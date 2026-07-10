import { db } from "@/app/lib/db";

/** Confirms `roomId` belongs to a hotel owned by `ownerId`. */
export async function ownsRoom(hotelId: number, roomId: number, ownerId: string): Promise<boolean> {
  const room = await db.hotel_rooms.findFirst({
    where: { id: roomId, hotel_id: hotelId, hotel: { owner_id: ownerId } },
    select: { id: true },
  });
  return !!room;
}
