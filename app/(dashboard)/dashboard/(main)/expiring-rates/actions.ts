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

export interface GetExpiringSeasonalRatesParams {
  page?:       number;
  limit?:      number;
  search?:     string;
  window?:     ExpiryWindow;
  uploadedBy?: string;
}

// A hotel_room_pricing row ("Pricing Plan") can carry several seasons
// (e.g. Winter / Summer / Peak) — the plan doesn't actually lapse back to
// base rate until the LAST of them ends, so "expiring" has to be judged at
// the plan level (MAX(valid_to) across its seasons), never per individual
// season row. Checking each season's own valid_to independently — the
// previous behavior — flagged a plan as "expiring" the moment any one of
// its seasons ended, even while a later season on the same plan still had
// months of coverage left.
const planExpiryCte = Prisma.sql`
  WITH plan_expiry AS (
    SELECT s.pricing_id, MAX(s.valid_to) AS plan_expiry, COUNT(*)::int AS season_count
    FROM hotel_room_pricing_seasons s
    JOIN hotel_room_pricing p ON p.id = s.pricing_id
    JOIN hotel_rooms r ON r.id = p.room_id
    JOIN hotels h ON h.id = p.hotel_id
    WHERE s.is_active = true AND p.is_active = true AND r.is_active = true AND h.is_active = true
    GROUP BY s.pricing_id
  )
`;

// One row per plan — the "representative" season is whichever one carries
// the plan's own MAX(valid_to), i.e. the season that actually determines
// when the plan expires. DISTINCT ON collapses ties (two seasons ending on
// the exact same date) down to a single deterministic row per plan.
const planRowsCte = Prisma.sql`
  ${planExpiryCte}
  SELECT DISTINCT ON (pe.pricing_id)
    s.id, s.season_name, s.valid_from, s.valid_to,
    s.price_per_night, s.extra_bed_rate, s.weekend_price_per_night,
    pe.plan_expiry, pe.season_count,
    p.id AS pricing_id, p.plan_name,
    r.id AS room_id, r.name AS room_name,
    h.id AS hotel_id, h.name AS hotel_name, h.city, h.state, h.thumbnail, h.created_by
  FROM plan_expiry pe
  JOIN hotel_room_pricing_seasons s ON s.pricing_id = pe.pricing_id AND s.valid_to = pe.plan_expiry AND s.is_active = true
  JOIN hotel_room_pricing p ON p.id = pe.pricing_id
  JOIN hotel_rooms r ON r.id = p.room_id
  JOIN hotels h ON h.id = p.hotel_id
  ORDER BY pe.pricing_id, s.id
`;

interface PlanRow {
  id: number;
  season_name: string;
  valid_from: Date;
  valid_to: Date;
  price_per_night: Prisma.Decimal;
  extra_bed_rate: Prisma.Decimal | null;
  weekend_price_per_night: Prisma.Decimal | null;
  plan_expiry: Date;
  season_count: number;
  pricing_id: number;
  plan_name: string | null;
  room_id: number;
  room_name: string;
  hotel_id: number;
  hotel_name: string;
  city: string | null;
  state: string | null;
  thumbnail: string | null;
  created_by: string | null;
}

export async function getExpiringSeasonalRates(params: GetExpiringSeasonalRatesParams = {}) {
  const { page = 1, limit = 20, search = "", window = "expired", uploadedBy = "" } = params;
  const skip = (page - 1) * limit;
  const now = new Date();

  const dateConditionSql = window === "expired"
    ? Prisma.sql`plan_expiry < ${now}`
    : Prisma.sql`plan_expiry >= ${now} AND plan_expiry <= ${cutoffFor(window, now)}`;
  const searchConditionSql = search
    ? Prisma.sql`AND (season_name ILIKE ${`%${search}%`} OR room_name ILIKE ${`%${search}%`} OR hotel_name ILIKE ${`%${search}%`} OR city ILIKE ${`%${search}%`})`
    : Prisma.empty;
  const uploadedByConditionSql = uploadedBy
    ? Prisma.sql`AND created_by = ${uploadedBy}`
    : Prisma.empty;

  // Same date/search predicates as the outer window, but joined at the
  // pricing/room/hotel level rather than through the deduped plan rows —
  // needed for the hotel-affected count, which counts DISTINCT hotels
  // rather than plans.
  const dateConditionRaw = window === "expired"
    ? Prisma.sql`pe.plan_expiry < ${now}`
    : Prisma.sql`pe.plan_expiry >= ${now} AND pe.plan_expiry <= ${cutoffFor(window, now)}`;
  const searchConditionRaw = search
    ? Prisma.sql`AND (h.name ILIKE ${`%${search}%`} OR h.city ILIKE ${`%${search}%`} OR r.name ILIKE ${`%${search}%`})`
    : Prisma.empty;
  const uploadedByConditionRaw = uploadedBy
    ? Prisma.sql`AND h.created_by = ${uploadedBy}`
    : Prisma.empty;

  const [rows, totalCountRows, statsTotalRows, statsExpiredRows, statsUrgentRows, hotelsAffectedRows, uploaderStatsRows] = await Promise.all([
    db.$queryRaw<PlanRow[]>`
      SELECT * FROM (${planRowsCte}) plans
      WHERE ${dateConditionSql} ${searchConditionSql} ${uploadedByConditionSql}
      ORDER BY plan_expiry ASC
      LIMIT ${limit} OFFSET ${skip}
    `,
    db.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM (${planRowsCte}) plans
      WHERE ${dateConditionSql} ${searchConditionSql} ${uploadedByConditionSql}
    `,
    db.$queryRaw<{ count: number }[]>`${planExpiryCte} SELECT COUNT(*)::int AS count FROM plan_expiry`,
    db.$queryRaw<{ count: number }[]>`
      ${planExpiryCte}
      SELECT COUNT(*)::int AS count FROM plan_expiry WHERE plan_expiry < ${now}
    `,
    db.$queryRaw<{ count: number }[]>`
      ${planExpiryCte}
      SELECT COUNT(*)::int AS count FROM plan_expiry WHERE plan_expiry >= ${now} AND plan_expiry <= ${addDays(now, 7)}
    `,
    db.$queryRaw<{ count: number }[]>`
      ${planExpiryCte}
      SELECT COUNT(DISTINCT h.id)::int AS count
      FROM plan_expiry pe
      JOIN hotel_room_pricing p ON p.id = pe.pricing_id
      JOIN hotel_rooms r ON r.id = p.room_id
      JOIN hotels h ON h.id = p.hotel_id
      WHERE ${dateConditionRaw}
        ${searchConditionRaw}
        ${uploadedByConditionRaw}
    `,
    // Per-uploader plan counts within the current window/search — powers the
    // "Uploaded by" filter dropdown so team members with zero expiring/matching
    // plans don't clutter the list, and so counts stay accurate as the user
    // narrows the window or search. Deliberately excludes uploadedByConditionRaw
    // itself (a facet count, not filtered by its own filter).
    db.$queryRaw<{ id: string; count: number }[]>`
      ${planExpiryCte}
      SELECT h.created_by AS id, COUNT(*)::int AS count
      FROM plan_expiry pe
      JOIN hotel_room_pricing p ON p.id = pe.pricing_id
      JOIN hotel_rooms r ON r.id = p.room_id
      JOIN hotels h ON h.id = p.hotel_id
      WHERE ${dateConditionRaw}
        ${searchConditionRaw}
        AND h.created_by IS NOT NULL
      GROUP BY h.created_by
      ORDER BY count DESC
    `,
  ]);

  const totalCount = totalCountRows[0]?.count ?? 0;
  const hotelsAffected = hotelsAffectedRows[0]?.count ?? 0;

  // hotels.created_by is a plain team-member id (no FK relation defined —
  // same pattern as hotels/actions.ts's getHotels), so the uploader's name
  // needs a separate batch lookup rather than a nested select.
  const creatorIds = [...new Set([
    ...rows.map((s) => s.created_by),
    ...uploaderStatsRows.map((u) => u.id),
  ].filter(Boolean) as string[])];
  const creators = creatorIds.length > 0
    ? await db.teamMember.findMany({ where: { id: { in: creatorIds } }, select: { id: true, name: true } })
    : [];
  const creatorNames: Record<string, string> = Object.fromEntries(creators.map((m) => [m.id, m.name]));

  const uploaders = uploaderStatsRows.map((u) => ({
    id:    u.id,
    name:  creatorNames[u.id] ?? "Unknown",
    count: u.count,
  }));

  const seasons = rows.map((s) => {
    const daysRemaining = Math.ceil((s.plan_expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      id:                s.id,
      seasonName:        s.season_name,
      validFrom:         s.valid_from,
      validTo:           s.plan_expiry, // the plan's true expiry — the latest season end date, not necessarily this row's own valid_to
      seasonCount:       s.season_count,
      daysRemaining,
      pricePerNight:     Number(s.price_per_night),
      extraBedRate:      s.extra_bed_rate != null ? Number(s.extra_bed_rate) : null,
      weekendPrice:      s.weekend_price_per_night != null ? Number(s.weekend_price_per_night) : null,
      pricingId:         s.pricing_id,
      planName:          s.plan_name,
      roomId:            s.room_id,
      roomName:          s.room_name,
      hotelId:           s.hotel_id,
      hotelName:         s.hotel_name,
      hotelLocation:     [s.city, s.state].filter(Boolean).join(", "),
      hotelThumbnail:    s.thumbnail,
      uploadedBy:        s.created_by ? (creatorNames[s.created_by] ?? null) : null,
    };
  });

  return {
    seasons,
    totalCount,
    uploaders,
    stats: {
      total:    statsTotalRows[0]?.count ?? 0,
      expired:  statsExpiredRows[0]?.count ?? 0,
      urgent7d: statsUrgentRows[0]?.count ?? 0,
      hotelsAffected,
    },
  };
}
