"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import { getRoomARI, type DailyRate } from "@/app/lib/hotel-inventory/rates";
import { ensureAvailability, stayNights } from "@/app/lib/hotel-inventory/availability";
import { enqueueAriPushIfConnected } from "@/app/lib/hotel-inventory/sync";
import { ownsRoom } from "@/app/lib/hotel-inventory/owns-room";

/** Per-night ARI for one room over `[fromISO, toExclusiveISO)` (a month window). */
export async function fetchRoomCalendar(
  hotelId: number,
  roomId: number,
  fromISO: string,
  toExclusiveISO: string,
  pricingId?: number,
): Promise<{ error?: string; days?: DailyRate[] }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");
  if (!(await ownsRoom(hotelId, roomId, session.user.id))) return { error: "Room not found." };
  const days = await getRoomARI(roomId, fromISO, toExclusiveISO, undefined, pricingId);
  return { days };
}

export type RangePatch = {
  totalUnits?: number;
  priceOverride?: number | null; // null clears the override
  stopSell?: boolean;
  minLos?: number | null;
  maxLos?: number | null;
  minAdvanceDays?: number | null;
  maxAdvanceDays?: number | null;
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

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromISO) || !/^\d{4}-\d{2}-\d{2}$/.test(toISO)) {
    return { error: "Invalid date range." };
  }
  if (fromISO > toISO) return { error: "Start date must be before end date." };
  const todayISO = new Date().toISOString().slice(0, 10);
  if (fromISO < todayISO) return { error: "Can't edit availability for past dates." };

  // Reject non-finite / out-of-range values before they ever reach the DB or
  // a guest-facing quote — the client can't be trusted as the only gate.
  if (patch.totalUnits !== undefined && (!Number.isFinite(patch.totalUnits) || patch.totalUnits < 0)) {
    return { error: "Total units must be zero or a positive whole number." };
  }
  if (patch.priceOverride !== undefined && patch.priceOverride !== null &&
      (!Number.isFinite(patch.priceOverride) || patch.priceOverride <= 0)) {
    return { error: "Price must be a positive number." };
  }
  if (patch.minLos !== undefined && patch.minLos !== null && (!Number.isFinite(patch.minLos) || patch.minLos < 1)) {
    return { error: "Minimum stay must be at least 1 night." };
  }
  if (patch.maxLos !== undefined && patch.maxLos !== null && (!Number.isFinite(patch.maxLos) || patch.maxLos < 1)) {
    return { error: "Maximum stay must be at least 1 night." };
  }
  if (patch.minLos != null && patch.maxLos != null && patch.minLos > patch.maxLos) {
    return { error: "Minimum stay can't be greater than maximum stay." };
  }
  if (patch.minAdvanceDays !== undefined && patch.minAdvanceDays !== null &&
      (!Number.isFinite(patch.minAdvanceDays) || patch.minAdvanceDays < 0)) {
    return { error: "Minimum advance booking window can't be negative." };
  }
  if (patch.maxAdvanceDays !== undefined && patch.maxAdvanceDays !== null &&
      (!Number.isFinite(patch.maxAdvanceDays) || patch.maxAdvanceDays < 0)) {
    return { error: "Maximum advance booking window can't be negative." };
  }
  if (patch.minAdvanceDays != null && patch.maxAdvanceDays != null && patch.minAdvanceDays > patch.maxAdvanceDays) {
    return { error: "Minimum advance window can't be greater than maximum." };
  }

  // Nights are inclusive of both ends → walk to the day after `toISO`.
  const toExclusive = new Date(`${toISO}T00:00:00.000Z`);
  toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
  const nights = stayNights(fromISO, toExclusive.toISOString().slice(0, 10));
  if (nights.length === 0) return { error: "Empty date range." };

  await ensureAvailability(roomId, nights);

  if (patch.totalUnits !== undefined) {
    const busiest = await db.hotel_room_availability.aggregate({
      where: {
        room_id: roomId,
        date: { gte: new Date(`${fromISO}T00:00:00.000Z`), lte: new Date(`${toISO}T00:00:00.000Z`) },
      },
      _max: { booked_units: true },
    });
    const maxBooked = busiest._max.booked_units ?? 0;
    if (patch.totalUnits < maxBooked) {
      return { error: `Can't set total units below ${maxBooked} — that many are already booked on at least one night in this range.` };
    }
  }

  const data: Record<string, unknown> = {};
  if (patch.totalUnits !== undefined) data.total_units = patch.totalUnits;
  if (patch.priceOverride !== undefined) data.price_override = patch.priceOverride;
  if (patch.stopSell !== undefined) data.stop_sell = patch.stopSell;
  if (patch.minLos !== undefined) data.min_los = patch.minLos;
  if (patch.maxLos !== undefined) data.max_los = patch.maxLos;
  if (patch.minAdvanceDays !== undefined) data.min_advance_days = patch.minAdvanceDays;
  if (patch.maxAdvanceDays !== undefined) data.max_advance_days = patch.maxAdvanceDays;
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
