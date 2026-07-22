"use server";

import { addDays, addMonths, addYears } from "date-fns";
import { db } from "@/app/lib/db";
import type { ExpiryWindow } from "./windows";

function cutoffFor(window: ExpiryWindow, from: Date): Date {
  switch (window) {
    case "7d":  return addDays(from, 7);
    case "15d": return addDays(from, 15);
    case "1m":  return addMonths(from, 1);
    case "3m":  return addMonths(from, 3);
    case "6m":  return addMonths(from, 6);
    case "1y":  return addYears(from, 1);
    case "2y":  return addYears(from, 2);
    case "expired": return from;
  }
}

// Only surfaces seasons on rooms/hotels that are still active — an expiring
// rate on an already-deactivated room isn't something the hotel team needs
// to act on.
const ACTIVE_CHAIN = {
  is_active: true,
  pricing: { is_active: true as const, room: { is_active: true }, hotel: { is_active: true } },
};

export interface GetExpiringSeasonalRatesParams {
  page?:   number;
  limit?:  number;
  search?: string;
  window?: ExpiryWindow;
}

export async function getExpiringSeasonalRates(params: GetExpiringSeasonalRatesParams = {}) {
  const { page = 1, limit = 20, search = "", window = "3m" } = params;
  const skip = (page - 1) * limit;
  const now = new Date();

  const dateFilter = window === "expired"
    ? { lt: now }
    : { gte: now, lte: cutoffFor(window, now) };

  const searchFilter = search ? {
    OR: [
      { season_name: { contains: search, mode: "insensitive" as const } },
      { pricing: { room:  { name: { contains: search, mode: "insensitive" as const } } } },
      { pricing: { hotel: { name: { contains: search, mode: "insensitive" as const } } } },
      { pricing: { hotel: { city: { contains: search, mode: "insensitive" as const } } } },
    ],
  } : {};

  const where = { ...ACTIVE_CHAIN, valid_to: dateFilter, ...searchFilter };

  const [rows, totalCount, statsTotal, statsExpired, statsUrgent, affectedRows] = await Promise.all([
    db.hotel_room_pricing_season.findMany({
      where,
      orderBy: { valid_to: "asc" },
      skip,
      take: limit,
      select: {
        id: true, season_name: true, valid_from: true, valid_to: true,
        price_per_night: true, extra_bed_rate: true, weekend_price_per_night: true,
        pricing: {
          select: {
            id: true, plan_name: true,
            room:  { select: { id: true, name: true } },
            hotel: { select: { id: true, name: true, city: true, state: true, thumbnail: true } },
          },
        },
      },
    }),
    db.hotel_room_pricing_season.count({ where }),
    db.hotel_room_pricing_season.count({ where: ACTIVE_CHAIN }),
    db.hotel_room_pricing_season.count({ where: { ...ACTIVE_CHAIN, valid_to: { lt: now } } }),
    db.hotel_room_pricing_season.count({ where: { ...ACTIVE_CHAIN, valid_to: { gte: now, lte: addDays(now, 7) } } }),
    // Distinct hotels affected by the *current* filter — a lightweight
    // projection (no pagination) since seasonal-rate volume is modest.
    db.hotel_room_pricing_season.findMany({
      where,
      select: { pricing: { select: { hotel: { select: { id: true } } } } },
    }),
  ]);

  const hotelsAffected = new Set(affectedRows.map((r) => r.pricing.hotel.id)).size;

  const seasons = rows.map((s) => {
    const daysRemaining = Math.ceil((s.valid_to.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      id:                s.id,
      seasonName:        s.season_name,
      validFrom:         s.valid_from,
      validTo:           s.valid_to,
      daysRemaining,
      pricePerNight:     Number(s.price_per_night),
      extraBedRate:      s.extra_bed_rate != null ? Number(s.extra_bed_rate) : null,
      weekendPrice:      s.weekend_price_per_night != null ? Number(s.weekend_price_per_night) : null,
      planName:          s.pricing.plan_name,
      roomId:            s.pricing.room.id,
      roomName:          s.pricing.room.name,
      hotelId:           s.pricing.hotel.id,
      hotelName:         s.pricing.hotel.name,
      hotelLocation:     [s.pricing.hotel.city, s.pricing.hotel.state].filter(Boolean).join(", "),
      hotelThumbnail:    s.pricing.hotel.thumbnail,
    };
  });

  return {
    seasons,
    totalCount,
    stats: {
      total:   statsTotal,
      expired: statsExpired,
      urgent7d: statsUrgent,
      hotelsAffected,
    },
  };
}
