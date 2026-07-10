"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import { ownsRoom } from "@/app/lib/hotel-inventory/owns-room";

export type RoomRateDetail = {
  basePrice: number | null;
  oneAdultPrice: number | null;
  childRate: number | null;
  extraAdultRate: number | null;
  minLos: number | null;
  maxLos: number | null;
  minAdvanceDays: number | null;
  maxAdvanceDays: number | null;
};

/**
 * Reads whatever season + restrictions already exist for this exact date
 * range, so re-opening the same range shows what was last saved instead of
 * blank fields.
 */
export async function getRoomRateDetail(
  hotelId: number,
  roomId: number,
  pricingId: number,
  fromISO: string,
  toISO: string,
): Promise<{ error?: string; detail?: RoomRateDetail }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");
  if (!(await ownsRoom(hotelId, roomId, session.user.id))) return { error: "Room not found." };

  const pricing = await db.hotel_room_pricing.findFirst({
    where: { id: pricingId, room_id: roomId },
    select: { id: true },
  });
  if (!pricing) return { error: "Rate plan not found." };

  const season = pricing
    ? await db.hotel_room_pricing_season.findFirst({
        where: {
          pricing_id: pricing.id,
          valid_from: new Date(`${fromISO}T00:00:00.000Z`),
          valid_to: new Date(`${toISO}T00:00:00.000Z`),
        },
        select: {
          price_per_night: true,
          extra_bed_rate: true,
          extra_child_rate: true,
          occupancy_prices: { where: { occupancy: 1 }, select: { price_per_night: true } },
        },
      })
    : null;

  // Representative snapshot — a bulk save applies one set of restriction
  // values across the whole range, same as the calendar's bulk-edit already
  // does, so the first night's row is a faithful preview.
  const avail = await db.hotel_room_availability.findFirst({
    where: { room_id: roomId, date: new Date(`${fromISO}T00:00:00.000Z`) },
    select: { min_los: true, max_los: true, min_advance_days: true, max_advance_days: true },
  });

  return {
    detail: {
      basePrice: season ? Number(season.price_per_night) : null,
      oneAdultPrice: season?.occupancy_prices[0] ? Number(season.occupancy_prices[0].price_per_night) : null,
      childRate: season?.extra_child_rate != null ? Number(season.extra_child_rate) : null,
      extraAdultRate: season?.extra_bed_rate != null ? Number(season.extra_bed_rate) : null,
      minLos: avail?.min_los ?? null,
      maxLos: avail?.max_los ?? null,
      minAdvanceDays: avail?.min_advance_days ?? null,
      maxAdvanceDays: avail?.max_advance_days ?? null,
    },
  };
}

export type RoomRatesPatch = {
  basePrice: number;
  oneAdultPrice?: number | null;
  childRate?: number | null;
  extraAdultRate?: number | null;
};

/**
 * Scoped single-season upsert — deliberately NOT the staff dashboard's
 * updateRoomPricingWithSeasons, which deletes and recreates every season for
 * the room. An owner sets different rates for different weeks/months over
 * time; this must only touch the one season matching its own date range,
 * leaving any other range's season untouched.
 */
export async function saveRoomRates(
  hotelId: number,
  roomId: number,
  pricingId: number,
  fromISO: string,
  toISO: string,
  patch: RoomRatesPatch,
): Promise<{ error?: string }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");
  if (!(await ownsRoom(hotelId, roomId, session.user.id))) return { error: "Room not found." };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromISO) || !/^\d{4}-\d{2}-\d{2}$/.test(toISO)) {
    return { error: "Invalid date range." };
  }
  if (fromISO > toISO) return { error: "Start date must be before end date." };
  const todayISO = new Date().toISOString().slice(0, 10);
  if (fromISO < todayISO) return { error: "Can't edit rates for past dates." };

  if (!Number.isFinite(patch.basePrice) || patch.basePrice <= 0) {
    return { error: "Base rate (2 Adults) is required and must be a positive number." };
  }
  const extraChecks: [string, number | null | undefined][] = [
    ["1 Adult", patch.oneAdultPrice],
    ["Per Child", patch.childRate],
    ["Per Extra Adult", patch.extraAdultRate],
  ];
  for (const [label, v] of extraChecks) {
    if (v != null && (!Number.isFinite(v) || v < 0)) {
      return { error: `${label} rate must be zero or a positive number.` };
    }
  }

  // Not filtered to is_active — lets an owner adjust rates on a temporarily
  // deactivated plan without needing to reactivate it first.
  const pricing = await db.hotel_room_pricing.findFirst({
    where: { id: pricingId, room_id: roomId },
    select: { id: true },
  });
  if (!pricing) return { error: "Rate plan not found." };

  const validFrom = new Date(`${fromISO}T00:00:00.000Z`);
  const validTo = new Date(`${toISO}T00:00:00.000Z`);

  await db.$transaction(async (tx) => {
    const existing = await tx.hotel_room_pricing_season.findFirst({
      where: { pricing_id: pricingId, valid_from: validFrom, valid_to: validTo },
      select: { id: true },
    });

    const seasonData = {
      season_name: `${fromISO} to ${toISO}`,
      price_per_night: patch.basePrice,
      extra_bed_rate: patch.extraAdultRate ?? null,
      extra_child_rate: patch.childRate ?? null,
      is_active: true,
    };

    const seasonId = existing
      ? (await tx.hotel_room_pricing_season.update({
          where: { id: existing.id },
          data: seasonData,
          select: { id: true },
        })).id
      : (await tx.hotel_room_pricing_season.create({
          data: { pricing_id: pricingId, valid_from: validFrom, valid_to: validTo, ...seasonData },
          select: { id: true },
        })).id;

    // Only the occupancy=1 ("1 Adult") tier is managed here — any other
    // occupancy tiers on this season (set elsewhere) are left alone.
    await tx.hotel_room_pricing_season_occupancy.deleteMany({ where: { season_id: seasonId, occupancy: 1 } });
    if (patch.oneAdultPrice != null) {
      await tx.hotel_room_pricing_season_occupancy.create({
        data: { season_id: seasonId, occupancy: 1, price_per_night: patch.oneAdultPrice },
      });
    }
  });

  revalidatePath(`/hotel-connect/properties/${hotelId}/rates`);
  revalidatePath(`/hotel-connect/properties/${hotelId}/calendar`);
  return {};
}
