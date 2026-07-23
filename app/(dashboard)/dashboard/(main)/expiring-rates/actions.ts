"use server";

import { addDays, addMonths, addYears } from "date-fns";
import { db } from "@/app/lib/db";
import { Prisma } from "@/app/generated/prisma";
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
  const { page = 1, limit = 20, search = "", window = "expired" } = params;
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

  // "Hotels Affected" needs a distinct count, not rows — doing that by
  // fetching every matching season and de-duping hotel ids in JS doesn't
  // scale (it pulls the *entire* filtered result set across the wire just
  // to throw most of it away). COUNT(DISTINCT ...) computed in Postgres
  // stays O(1) result size no matter how many seasons match.
  const dateConditionSql = window === "expired"
    ? Prisma.sql`s.valid_to < ${now}`
    : Prisma.sql`s.valid_to >= ${now} AND s.valid_to <= ${cutoffFor(window, now)}`;
  const searchConditionSql = search
    ? Prisma.sql`AND (s.season_name ILIKE ${`%${search}%`} OR r.name ILIKE ${`%${search}%`} OR h.name ILIKE ${`%${search}%`} OR h.city ILIKE ${`%${search}%`})`
    : Prisma.empty;

  const [rows, totalCount, statsTotal, statsExpired, statsUrgent, hotelsAffectedRows] = await Promise.all([
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
            hotel: { select: { id: true, name: true, city: true, state: true, thumbnail: true, created_by: true } },
          },
        },
      },
    }),
    db.hotel_room_pricing_season.count({ where }),
    db.hotel_room_pricing_season.count({ where: ACTIVE_CHAIN }),
    db.hotel_room_pricing_season.count({ where: { ...ACTIVE_CHAIN, valid_to: { lt: now } } }),
    db.hotel_room_pricing_season.count({ where: { ...ACTIVE_CHAIN, valid_to: { gte: now, lte: addDays(now, 7) } } }),
    db.$queryRaw<{ count: number }[]>`
      SELECT COUNT(DISTINCT h.id)::int AS count
      FROM hotel_room_pricing_seasons s
      JOIN hotel_room_pricing p ON p.id = s.pricing_id
      JOIN hotel_rooms r ON r.id = p.room_id
      JOIN hotels h ON h.id = p.hotel_id
      WHERE s.is_active = true AND p.is_active = true AND r.is_active = true AND h.is_active = true
        AND ${dateConditionSql}
        ${searchConditionSql}
    `,
  ]);

  const hotelsAffected = hotelsAffectedRows[0]?.count ?? 0;

  // hotels.created_by is a plain team-member id (no FK relation defined —
  // same pattern as hotels/actions.ts's getHotels), so the uploader's name
  // needs a separate batch lookup rather than a nested select.
  const creatorIds = [...new Set(rows.map((s) => s.pricing.hotel.created_by).filter(Boolean) as string[])];
  const creators = creatorIds.length > 0
    ? await db.teamMember.findMany({ where: { id: { in: creatorIds } }, select: { id: true, name: true } })
    : [];
  const creatorNames: Record<string, string> = Object.fromEntries(creators.map((m) => [m.id, m.name]));

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
      pricingId:         s.pricing.id,
      planName:          s.pricing.plan_name,
      roomId:            s.pricing.room.id,
      roomName:          s.pricing.room.name,
      hotelId:           s.pricing.hotel.id,
      hotelName:         s.pricing.hotel.name,
      hotelLocation:     [s.pricing.hotel.city, s.pricing.hotel.state].filter(Boolean).join(", "),
      hotelThumbnail:    s.pricing.hotel.thumbnail,
      uploadedBy:        s.pricing.hotel.created_by ? (creatorNames[s.pricing.hotel.created_by] ?? null) : null,
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
