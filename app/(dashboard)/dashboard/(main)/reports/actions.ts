"use server";

import { db } from "@/app/lib/db";

// ── Period helpers ─────────────────────────────────────────────────────────

export type TimePeriod =
  | "today"
  | "yesterday"
  | "this_week"
  | "current_month"
  | "last_month"
  | "custom";

function toDateRange(
  period: TimePeriod,
  customFrom?: string,
  customTo?: string,
): { gte: Date; lte: Date } {
  const now = new Date();
  const sod = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const eod = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  switch (period) {
    case "today":
      return { gte: sod(now), lte: eod(now) };

    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { gte: sod(y), lte: eod(y) };
    }

    case "this_week": {
      const dow = now.getDay();
      const monday = new Date(now);
      monday.setDate(monday.getDate() - (dow === 0 ? 6 : dow - 1));
      return { gte: sod(monday), lte: eod(now) };
    }

    case "current_month":
      return {
        gte: new Date(now.getFullYear(), now.getMonth(), 1),
        lte: eod(now),
      };

    case "last_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { gte: start, lte: end };
    }

    case "custom":
      if (customFrom && customTo) {
        return {
          gte: new Date(customFrom + "T00:00:00"),
          lte: new Date(customTo + "T23:59:59"),
        };
      }
      return { gte: sod(now), lte: eod(now) };
  }
}

// ── Types ──────────────────────────────────────────────────────────────────

export type MemberHotelWork = {
  memberId: string;
  memberName: string;
  hotelsAdded: number;
  roomsForTheirHotels: number;
};

export type MemberCabWork = {
  memberId: string;
  memberName: string;
  pricingAdded: number;
  driversAdded: number;
};

export type MemberTravelWork = {
  memberId: string;
  memberName: string;
  activitiesAdded: number;
  packagesAdded: number;
};

export type HotelReportData = {
  hotelsAdded: number;
  roomsAdded: number;
  imagesAdded: number;
  hotelsWithoutRooms: number;
  byMember: MemberHotelWork[];
};

export type CabReportData = {
  pricingAdded: number;
  driversAdded: number;
  driversWithVehicle: number;
  driversVerified: number;
  byMember: MemberCabWork[];
};

export type TravelReportData = {
  activitiesAdded: number;
  packagesAdded: number;
  routesAdded: number;
  stayCategoriesAdded: number;
  pricingSectionsAdded: number;
  byMember: MemberTravelWork[];
};

export type ReportsData = {
  hotel: HotelReportData;
  cab: CabReportData;
  travel: TravelReportData;
  period: TimePeriod;
  fromStr: string;
  toStr: string;
};

// ── Main fetch ─────────────────────────────────────────────────────────────

export async function getReportsData(
  period: TimePeriod = "today",
  customFrom?: string,
  customTo?: string,
): Promise<ReportsData> {
  const range = toDateRange(period, customFrom, customTo);

  // ── Hotel ────────────────────────────────────────────────────────────────
  const [
    hotelsAdded,
    roomsAdded,
    imagesAdded,
    hotelsWithoutRooms,
    hotelsByMember,
  ] = await Promise.all([
    db.hotels.count({ where: { created_at: range } }),
    db.hotel_rooms.count({ where: { created_at: range } }),
    db.hotel_images.count({ where: { created_at: range } }),
    db.hotels.count({
      where: { created_at: range, hotelRooms: { none: {} } },
    }),
    db.hotels.groupBy({
      by: ["created_by"],
      where: { created_at: range, created_by: { not: null } },
      _count: { id: true },
    }),
  ]);

  // ── Cab ──────────────────────────────────────────────────────────────────
  const [
    pricingAdded,
    driversAdded,
    driversWithVehicle,
    driversVerified,
    pricingByMember,
    driversByMember,
  ] = await Promise.all([
    db.cab_pricing.count({ where: { created_at: range } }),
    db.cab_drivers.count({ where: { created_at: range } }),
    db.cab_drivers.count({ where: { created_at: range, vehicle_id: { not: null } } }),
    db.cab_drivers.count({ where: { created_at: range, is_verified: true } }),
    db.cab_pricing.groupBy({
      by: ["created_by"],
      where: { created_at: range, created_by: { not: null } },
      _count: { id: true },
    }),
    db.cab_drivers.groupBy({
      by: ["created_by"],
      where: { created_at: range, created_by: { not: null } },
      _count: { id: true },
    }),
  ]);

  // ── Travel ───────────────────────────────────────────────────────────────
  const [
    activitiesAdded,
    packagesAdded,
    activitiesByMember,
    packagesByMember,
    packageIds,
  ] = await Promise.all([
    db.activities.count({ where: { created_at: range } }),
    db.packages.count({ where: { created_at: range } }),
    db.activities.groupBy({
      by: ["created_by"],
      where: { created_at: range, created_by: { not: null } },
      _count: { id: true },
    }),
    db.packages.groupBy({
      by: ["created_by"],
      where: { created_at: range, created_by: { not: null } },
      _count: { id: true },
    }),
    db.packages.findMany({
      where: { created_at: range },
      select: { id: true },
    }),
  ]);

  const pkgIdList = packageIds.map((p) => p.id);

  const [routesAdded, stayCategoriesAdded, pricingSectionsAdded] =
    pkgIdList.length > 0
      ? await Promise.all([
          db.package_routes.count({
            where: { duration: { package_id: { in: pkgIdList } } },
          }),
          db.package_stay_categories.count({
            where: { package_id: { in: pkgIdList } },
          }),
          db.package_pricing.count({
            where: { package_id: { in: pkgIdList } },
          }),
        ])
      : [0, 0, 0];

  // ── Resolve member names ──────────────────────────────────────────────────
  const allActorIds = [
    ...hotelsByMember.map((r) => r.created_by as string),
    ...pricingByMember.map((r) => r.created_by as string),
    ...driversByMember.map((r) => r.created_by as string),
    ...activitiesByMember.map((r) => r.created_by as string),
    ...packagesByMember.map((r) => r.created_by as string),
  ];
  const uniqueActorIds = [...new Set(allActorIds.filter(Boolean))];

  const members =
    uniqueActorIds.length > 0
      ? await db.teamMember.findMany({
          where: { id: { in: uniqueActorIds } },
          select: { id: true, name: true },
        })
      : [];

  const memberMap = new Map(members.map((m) => [m.id, m.name]));
  const resolveName = (id: string) => memberMap.get(id) ?? id;

  // ── Hotel by-member ───────────────────────────────────────────────────────
  const hotelMemberMap = new Map<string, number>(
    hotelsByMember.map((r) => [r.created_by as string, r._count.id]),
  );

  // Rooms added for each member's hotels in the period
  const roomsByMemberId: Record<string, number> = {};
  if (hotelsByMember.length > 0) {
    const memberIds = hotelsByMember.map((r) => r.created_by as string);
    const hotelsInPeriod = await db.hotels.findMany({
      where: { created_at: range, created_by: { in: memberIds } },
      select: { id: true, created_by: true },
    });
    const hotelIdList = hotelsInPeriod.map((h) => h.id);
    if (hotelIdList.length > 0) {
      const roomGroups = await db.hotel_rooms.groupBy({
        by: ["hotel_id"],
        where: { hotel_id: { in: hotelIdList } },
        _count: { id: true },
      });
      const roomsByHotelId = new Map(roomGroups.map((r) => [r.hotel_id, r._count.id]));
      for (const h of hotelsInPeriod) {
        const mid = h.created_by as string;
        roomsByMemberId[mid] =
          (roomsByMemberId[mid] ?? 0) + (roomsByHotelId.get(h.id) ?? 0);
      }
    }
  }

  const hotelByMember: MemberHotelWork[] = [...hotelMemberMap.entries()]
    .map(([id, cnt]) => ({
      memberId: id,
      memberName: resolveName(id),
      hotelsAdded: cnt,
      roomsForTheirHotels: roomsByMemberId[id] ?? 0,
    }))
    .sort((a, b) => b.hotelsAdded - a.hotelsAdded);

  // ── Cab by-member ─────────────────────────────────────────────────────────
  const cabPricingMap = new Map<string, number>(
    pricingByMember.map((r) => [r.created_by as string, r._count.id]),
  );
  const cabDriverMap = new Map<string, number>(
    driversByMember.map((r) => [r.created_by as string, r._count.id]),
  );
  const cabMemberIds = [...new Set([...cabPricingMap.keys(), ...cabDriverMap.keys()])];

  const cabByMember: MemberCabWork[] = cabMemberIds
    .map((id) => ({
      memberId: id,
      memberName: resolveName(id),
      pricingAdded: cabPricingMap.get(id) ?? 0,
      driversAdded: cabDriverMap.get(id) ?? 0,
    }))
    .sort((a, b) => b.pricingAdded + b.driversAdded - (a.pricingAdded + a.driversAdded));

  // ── Travel by-member ──────────────────────────────────────────────────────
  const activityMemberMap = new Map<string, number>(
    activitiesByMember.map((r) => [r.created_by as string, r._count.id]),
  );
  const packageMemberMap = new Map<string, number>(
    packagesByMember.map((r) => [r.created_by as string, r._count.id]),
  );
  const travelMemberIds = [
    ...new Set([...activityMemberMap.keys(), ...packageMemberMap.keys()]),
  ];

  const travelByMember: MemberTravelWork[] = travelMemberIds
    .map((id) => ({
      memberId: id,
      memberName: resolveName(id),
      activitiesAdded: activityMemberMap.get(id) ?? 0,
      packagesAdded: packageMemberMap.get(id) ?? 0,
    }))
    .sort(
      (a, b) =>
        b.activitiesAdded + b.packagesAdded - (a.activitiesAdded + a.packagesAdded),
    );

  const fmt = (d: Date) => d.toISOString().split("T")[0];

  return {
    hotel: {
      hotelsAdded,
      roomsAdded,
      imagesAdded,
      hotelsWithoutRooms,
      byMember: hotelByMember,
    },
    cab: {
      pricingAdded,
      driversAdded,
      driversWithVehicle,
      driversVerified,
      byMember: cabByMember,
    },
    travel: {
      activitiesAdded,
      packagesAdded,
      routesAdded,
      stayCategoriesAdded,
      pricingSectionsAdded,
      byMember: travelByMember,
    },
    period,
    fromStr: fmt(range.gte),
    toStr: fmt(range.lte),
  };
}
