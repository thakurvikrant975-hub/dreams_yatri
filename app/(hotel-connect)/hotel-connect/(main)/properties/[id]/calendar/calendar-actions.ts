"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import { getRoomARI, type DailyRate } from "@/app/lib/hotel-inventory/rates";
import { ensureAvailability, stayNights } from "@/app/lib/hotel-inventory/availability";
import { enqueueAriPushIfConnected } from "@/app/lib/hotel-inventory/sync";

async function ownsRoom(hotelId: number, roomId: number, ownerId: string): Promise<boolean> {
  const room = await db.hotel_rooms.findFirst({
    where: { id: roomId, hotel_id: hotelId, hotel: { owner_id: ownerId } },
    select: { id: true },
  });
  return !!room;
}

/** Per-night ARI for one room over `[fromISO, toExclusiveISO)` (a month window). */
export async function fetchRoomCalendar(
  hotelId: number,
  roomId: number,
  fromISO: string,
  toExclusiveISO: string,
): Promise<{ error?: string; days?: DailyRate[] }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");
  if (!(await ownsRoom(hotelId, roomId, session.user.id))) return { error: "Room not found." };
  const days = await getRoomARI(roomId, fromISO, toExclusiveISO);
  return { days };
}

export type RangePatch = {
  totalUnits?: number;
  priceOverride?: number | null; // null clears the override
  stopSell?: boolean;
  minLos?: number | null;
  maxLos?: number | null;
  closedToArrival?: boolean;
  closedToDeparture?: boolean;
};

/**
 * Bulk-apply a patch to every night in `[fromISO, toISO]` (both inclusive) for a room.
 * Creates missing ledger rows first, then updates only the provided fields.
 */
export async function saveAvailabilityRange(
  hotelId: number,
  roomId: number,
  fromISO: string,
  toISO: string,
  patch: RangePatch,
): Promise<{ error?: string; updated?: number }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");
  if (!(await ownsRoom(hotelId, roomId, session.user.id))) return { error: "Room not found." };

  // Nights are inclusive of both ends → walk to the day after `toISO`.
  const toExclusive = new Date(`${toISO}T00:00:00.000Z`);
  toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
  const nights = stayNights(fromISO, toExclusive.toISOString().slice(0, 10));
  if (nights.length === 0) return { error: "Empty date range." };

  await ensureAvailability(roomId, nights);

  const data: Record<string, unknown> = {};
  if (patch.totalUnits !== undefined) data.total_units = patch.totalUnits;
  if (patch.priceOverride !== undefined) data.price_override = patch.priceOverride;
  if (patch.stopSell !== undefined) data.stop_sell = patch.stopSell;
  if (patch.minLos !== undefined) data.min_los = patch.minLos;
  if (patch.maxLos !== undefined) data.max_los = patch.maxLos;
  if (patch.closedToArrival !== undefined) data.closed_to_arrival = patch.closedToArrival;
  if (patch.closedToDeparture !== undefined) data.closed_to_departure = patch.closedToDeparture;
  if (Object.keys(data).length === 0) return { error: "Nothing to update." };

  const res = await db.hotel_room_availability.updateMany({
    where: {
      room_id: roomId,
      date: { gte: new Date(`${fromISO}T00:00:00.000Z`), lte: new Date(`${toISO}T00:00:00.000Z`) },
    },
    data,
  });

  // Best-effort: queue an ARI push if this hotel has a connected channel.
  try {
    await enqueueAriPushIfConnected(hotelId, roomId, fromISO, toISO);
  } catch (err) {
    console.error("[saveAvailabilityRange] enqueue ARI push failed:", err);
  }

  revalidatePath(`/hotel-connect/properties/${hotelId}/calendar`);
  return { updated: res.count };
}
