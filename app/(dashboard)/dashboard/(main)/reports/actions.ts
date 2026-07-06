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

// ── New rich hotel-dept types ──────────────────────────────────────────────

export type HotelRowDetail = {
  id: number;
  name: string;
  thumbnail: string | null;
  city: string | null;
  state: string | null;
  isActive: boolean;
  createdAt: string;
  imagesCount: number;
  roomsCount: number;
  pricingCount: number;
};

export type HotelDeptMember = {
  id: string;
  name: string;
  profilePicUrl: string | null;
  designation: string | null;
  isActive: boolean;
  hotelsAdded: number;
  roomsAdded: number;
  imagesAdded: number;
  pricingAdded: number;
  hotels: HotelRowDetail[];
};

export type DailyHotelPoint = {
  date: string;
  total: number;
  [memberId: string]: number | string;
};

export type HotelDeptReportData = {
  summary: {
    hotelsAdded: number;
    roomsAdded: number;
    imagesAdded: number;
    pricingAdded: number;
    hotelsWithoutRooms: number;
  };
  members: HotelDeptMember[];
  dailyChart: DailyHotelPoint[];
};

export type CabReportData = {
  pricingAdded: number;
  driversAdded: number;
  driversWithVehicle: number;
  driversVerified: number;
  byMember: MemberCabWork[];
};

// ── New rich cab-dept types ─────────────────────────────────────────────────

export type DriverRowDetail = {
  id: number;
  name: string;
  mobile: string;
  city: string | null;
  state: string | null;
  hasVehicle: boolean;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
};

export type CabDeptMember = {
  id: string;
  name: string;
  profilePicUrl: string | null;
  designation: string | null;
  isActive: boolean;
  driversAdded: number;
  driversVerified: number;
  driversWithVehicle: number;
  pricingAdded: number;
  drivers: DriverRowDetail[];
};

export type DailyCabPoint = {
  date: string;
  total: number;
  [memberId: string]: number | string;
};

export type CabDeptReportData = {
  summary: {
    driversAdded: number;
    driversVerified: number;
    driversWithVehicle: number;
    pricingAdded: number;
  };
  members: CabDeptMember[];
  dailyChart: DailyCabPoint[];
};

export type TravelReportData = {
  activitiesAdded: number;
  packagesAdded: number;
  routesAdded: number;
  stayCategoriesAdded: number;
  pricingSectionsAdded: number;
  byMember: MemberTravelWork[];
};

// ── New rich travel-dept types ─────────────────────────────────────────────

export type PackageRowDetail = {
  id: number;
  title: string;
  thumbnail: string | null;
  destination: string | null;
  isActive: boolean;
  createdAt: string;
  routesCount: number;
  daysCount: number;
  stayCategoriesCount: number;
  pricingCount: number;
};

export type TravelDeptMember = {
  id: string;
  name: string;
  profilePicUrl: string | null;
  designation: string | null;
  isActive: boolean;
  activitiesAdded: number;
  packagesAdded: number;
  routesAdded: number;
  daysAdded: number;
  stayCategoriesAdded: number;
  pricingAdded: number;
  packages: PackageRowDetail[];
};

export type DailyTravelPoint = {
  date: string;
  total: number;
  [memberId: string]: number | string;
};

export type TravelDeptReportData = {
  summary: {
    activitiesAdded: number;
    packagesAdded: number;
    routesAdded: number;
    daysAdded: number;
    stayCategoriesAdded: number;
    pricingAdded: number;
  };
  members: TravelDeptMember[];
  dailyChart: DailyTravelPoint[];
};

export type ReportsData = {
  hotel: HotelReportData;
  hotelDept: HotelDeptReportData;
  cab: CabReportData;
  cabDept: CabDeptReportData;
  travel: TravelReportData;
  travelDept: TravelDeptReportData;
  period: TimePeriod;
  fromStr: string;
  toStr: string;
};

// ── Hotel dept full report ─────────────────────────────────────────────────

async function getHotelDeptReport(range: { gte: Date; lte: Date }): Promise<HotelDeptReportData> {
  // 1. Find hotel department (case-insensitive name match)
  const hotelDept = await db.department.findFirst({
    where: { name: { contains: "hotel", mode: "insensitive" } },
    select: { id: true },
  });

  // 2. All members in hotel dept + summary stats in parallel
  const [allMembers, hotelsAdded, roomsAdded, imagesAdded, pricingAdded, hotelsWithoutRooms] =
    await Promise.all([
      hotelDept
        ? db.teamMember.findMany({
            where: { departmentId: hotelDept.id },
            select: { id: true, name: true, profilePicUrl: true, designation: true, isActive: true },
            orderBy: { name: "asc" },
          })
        : ([] as { id: string; name: string; profilePicUrl: string | null; designation: string | null; isActive: boolean }[]),
      db.hotels.count({ where: { created_at: range } }),
      db.hotel_rooms.count({ where: { created_at: range } }),
      db.hotel_images.count({ where: { created_at: range } }),
      db.hotel_room_pricing.count({ where: { created_at: range } }),
      db.hotels.count({ where: { created_at: range, hotelRooms: { none: {} } } }),
    ]);

  // 3. All hotels in period with image + room counts
  const hotelsInPeriod = await db.hotels.findMany({
    where: { created_at: range },
    select: {
      id: true, name: true, thumbnail: true, city: true, state: true,
      is_active: true, created_at: true, created_by: true,
      _count: { select: { images: true, hotelRooms: true } },
    },
    orderBy: { created_at: "desc" },
  });

  // 4. Pricing count per hotel
  const hotelIds = hotelsInPeriod.map((h) => h.id);
  const pricingByHotel =
    hotelIds.length > 0
      ? await db.hotel_room_pricing.groupBy({
          by: ["hotel_id"],
          where: { hotel_id: { in: hotelIds } },
          _count: { id: true },
        })
      : [];
  const pricingHotelMap = new Map(pricingByHotel.map((p) => [p.hotel_id, p._count.id]));

  // 5. Build hotel rows indexed by creator
  const hotelsByCreator = new Map<string, HotelRowDetail[]>();
  for (const h of hotelsInPeriod) {
    const key = h.created_by ?? "__unknown__";
    if (!hotelsByCreator.has(key)) hotelsByCreator.set(key, []);
    hotelsByCreator.get(key)!.push({
      id: h.id,
      name: h.name,
      thumbnail: h.thumbnail,
      city: h.city,
      state: h.state,
      isActive: h.is_active,
      createdAt: h.created_at.toISOString().split("T")[0],
      imagesCount: h._count.images,
      roomsCount: h._count.hotelRooms,
      pricingCount: pricingHotelMap.get(h.id) ?? 0,
    });
  }

  // 6. Merge dept members + any non-dept members who still created hotels
  const deptMemberIds = new Set(allMembers.map((m) => m.id));
  const extraIds = [...hotelsByCreator.keys()].filter(
    (id) => id !== "__unknown__" && !deptMemberIds.has(id),
  );
  const extraMembers =
    extraIds.length > 0
      ? await db.teamMember.findMany({
          where: { id: { in: extraIds } },
          select: { id: true, name: true, profilePicUrl: true, designation: true, isActive: true },
        })
      : [];

  const memberList = [...allMembers, ...extraMembers];

  const members: HotelDeptMember[] = memberList
    .map((m) => {
      const hotels = hotelsByCreator.get(m.id) ?? [];
      return {
        id: m.id,
        name: m.name,
        profilePicUrl: m.profilePicUrl ?? null,
        designation: m.designation ?? null,
        isActive: m.isActive,
        hotelsAdded: hotels.length,
        roomsAdded: hotels.reduce((s, h) => s + h.roomsCount, 0),
        imagesAdded: hotels.reduce((s, h) => s + h.imagesCount, 0),
        pricingAdded: hotels.reduce((s, h) => s + h.pricingCount, 0),
        hotels,
      };
    })
    .sort((a, b) => b.hotelsAdded - a.hotelsAdded);

  // 7. Daily chart — one entry per calendar day in range
  const dailyRaw = new Map<string, Record<string, number>>();
  for (const h of hotelsInPeriod) {
    const d = h.created_at.toISOString().split("T")[0];
    if (!dailyRaw.has(d)) dailyRaw.set(d, {});
    const slot = dailyRaw.get(d)!;
    const mid = h.created_by ?? "__unknown__";
    slot[mid] = (slot[mid] ?? 0) + 1;
    slot.__total__ = (slot.__total__ ?? 0) + 1;
  }

  const dailyChart: DailyHotelPoint[] = [];
  const cur = new Date(range.gte);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(range.lte);
  end.setHours(23, 59, 59, 999);
  while (cur <= end) {
    const iso = cur.toISOString().split("T")[0];
    const slot = dailyRaw.get(iso) ?? {};
    const fmtLabel = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(
      new Date(iso),
    );
    const point: DailyHotelPoint = { date: fmtLabel, total: slot.__total__ ?? 0 };
    for (const m of members) point[m.id] = slot[m.id] ?? 0;
    dailyChart.push(point);
    cur.setDate(cur.getDate() + 1);
  }

  return {
    summary: { hotelsAdded, roomsAdded, imagesAdded, pricingAdded, hotelsWithoutRooms },
    members,
    dailyChart,
  };
}

// ── Travel dept full report ────────────────────────────────────────────────

async function getTravelDeptReport(range: { gte: Date; lte: Date }): Promise<TravelDeptReportData> {
  // 1. Find travel-expert department
  const travelDept = await db.department.findFirst({
    where: { name: { contains: "travel", mode: "insensitive" } },
    select: { id: true },
  });

  // 2. Dept members + packages + activities in parallel
  const [allMembers, packagesInPeriod, activityDailyRaw] = await Promise.all([
    travelDept
      ? db.teamMember.findMany({
          where: { departmentId: travelDept.id },
          select: { id: true, name: true, profilePicUrl: true, designation: true, isActive: true },
          orderBy: { name: "asc" },
        })
      : ([] as { id: string; name: string; profilePicUrl: string | null; designation: string | null; isActive: boolean }[]),
    db.packages.findMany({
      where: { created_at: range },
      select: {
        id: true,
        title: true,
        thumbnail: true,
        is_active: true,
        created_at: true,
        created_by: true,
        destination: { select: { name: true } },
        durations: { select: { _count: { select: { routes: true } } } },
        _count: { select: { itineraries: true, stay_categories: true, packagePricings: true } },
      },
      orderBy: { created_at: "desc" },
    }),
    db.activities.findMany({
      where: { created_at: range },
      select: { created_at: true, created_by: true },
    }),
  ]);

  // 3. Activity count by creator
  const activityCreatorMap = new Map<string, number>();
  for (const a of activityDailyRaw) {
    const mid = a.created_by ?? "__unknown__";
    activityCreatorMap.set(mid, (activityCreatorMap.get(mid) ?? 0) + 1);
  }

  // 4. Compute summary
  const activitiesAdded = activityDailyRaw.length;
  const packagesAdded = packagesInPeriod.length;
  let routesAdded = 0, daysAdded = 0, stayCategoriesAdded = 0, pricingAdded = 0;
  for (const p of packagesInPeriod) {
    routesAdded += p.durations.reduce((s, d) => s + d._count.routes, 0);
    daysAdded += p._count.itineraries;
    stayCategoriesAdded += p._count.stay_categories;
    pricingAdded += p._count.packagePricings;
  }

  // 5. Build package rows by creator
  const packagesByCreator = new Map<string, PackageRowDetail[]>();
  for (const p of packagesInPeriod) {
    const key = p.created_by ?? "__unknown__";
    if (!packagesByCreator.has(key)) packagesByCreator.set(key, []);
    packagesByCreator.get(key)!.push({
      id: p.id,
      title: p.title,
      thumbnail: p.thumbnail ?? null,
      destination: p.destination.name,
      isActive: p.is_active,
      createdAt: p.created_at.toISOString().split("T")[0],
      routesCount: p.durations.reduce((s, d) => s + d._count.routes, 0),
      daysCount: p._count.itineraries,
      stayCategoriesCount: p._count.stay_categories,
      pricingCount: p._count.packagePricings,
    });
  }

  // 6. Merge dept members + any non-dept members who created packages/activities
  const deptMemberIds = new Set(allMembers.map((m) => m.id));
  const allCreatorIds = new Set([
    ...packagesByCreator.keys(),
    ...activityCreatorMap.keys(),
  ]);
  const extraIds = [...allCreatorIds].filter(
    (id) => id !== "__unknown__" && !deptMemberIds.has(id),
  );
  const extraMembers =
    extraIds.length > 0
      ? await db.teamMember.findMany({
          where: { id: { in: extraIds } },
          select: { id: true, name: true, profilePicUrl: true, designation: true, isActive: true },
        })
      : [];

  const memberList = [...allMembers, ...extraMembers];

  const members: TravelDeptMember[] = memberList
    .map((m) => {
      const pkgs = packagesByCreator.get(m.id) ?? [];
      return {
        id: m.id,
        name: m.name,
        profilePicUrl: m.profilePicUrl ?? null,
        designation: m.designation ?? null,
        isActive: m.isActive,
        activitiesAdded: activityCreatorMap.get(m.id) ?? 0,
        packagesAdded: pkgs.length,
        routesAdded: pkgs.reduce((s, p) => s + p.routesCount, 0),
        daysAdded: pkgs.reduce((s, p) => s + p.daysCount, 0),
        stayCategoriesAdded: pkgs.reduce((s, p) => s + p.stayCategoriesCount, 0),
        pricingAdded: pkgs.reduce((s, p) => s + p.pricingCount, 0),
        packages: pkgs,
      };
    })
    .sort(
      (a, b) =>
        b.activitiesAdded + b.packagesAdded - (a.activitiesAdded + a.packagesAdded),
    );

  // 7. Daily chart — packages + activities combined per member per day
  const dailyRaw = new Map<string, Record<string, number>>();
  for (const p of packagesInPeriod) {
    const d = p.created_at.toISOString().split("T")[0];
    if (!dailyRaw.has(d)) dailyRaw.set(d, {});
    const slot = dailyRaw.get(d)!;
    const mid = p.created_by ?? "__unknown__";
    slot[mid] = (slot[mid] ?? 0) + 1;
    slot.__total__ = (slot.__total__ ?? 0) + 1;
  }
  for (const a of activityDailyRaw) {
    const d = a.created_at.toISOString().split("T")[0];
    if (!dailyRaw.has(d)) dailyRaw.set(d, {});
    const slot = dailyRaw.get(d)!;
    const mid = a.created_by ?? "__unknown__";
    slot[mid] = (slot[mid] ?? 0) + 1;
    slot.__total__ = (slot.__total__ ?? 0) + 1;
  }

  const dailyChart: DailyTravelPoint[] = [];
  const cur = new Date(range.gte);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(range.lte);
  end.setHours(23, 59, 59, 999);
  while (cur <= end) {
    const iso = cur.toISOString().split("T")[0];
    const slot = dailyRaw.get(iso) ?? {};
    const fmtLabel = new Intl.DateTimeFormat("en-IN", {
      day: "numeric", month: "short",
    }).format(new Date(iso));
    const point: DailyTravelPoint = { date: fmtLabel, total: slot.__total__ ?? 0 };
    for (const m of members) point[m.id] = slot[m.id] ?? 0;
    dailyChart.push(point);
    cur.setDate(cur.getDate() + 1);
  }

  return {
    summary: { activitiesAdded, packagesAdded, routesAdded, daysAdded, stayCategoriesAdded, pricingAdded },
    members,
    dailyChart,
  };
}

// ── Cab dept full report ───────────────────────────────────────────────────

async function getCabDeptReport(range: { gte: Date; lte: Date }): Promise<CabDeptReportData> {
  // 1. Find cab department
  const cabDept = await db.department.findFirst({
    where: { name: { contains: "cab", mode: "insensitive" } },
    select: { id: true },
  });

  // 2. Dept members + drivers in period + pricing counts in parallel
  const [allMembers, driversInPeriod, pricingByCreator] = await Promise.all([
    cabDept
      ? db.teamMember.findMany({
          where: { departmentId: cabDept.id },
          select: { id: true, name: true, profilePicUrl: true, designation: true, isActive: true },
          orderBy: { name: "asc" },
        })
      : ([] as { id: string; name: string; profilePicUrl: string | null; designation: string | null; isActive: boolean }[]),
    db.cab_drivers.findMany({
      where: { created_at: range },
      select: {
        id: true, name: true, mobile: true, city: true, state: true,
        vehicle_id: true, is_verified: true, is_active: true,
        created_at: true, created_by: true,
      },
      orderBy: { created_at: "desc" },
    }),
    db.cab_pricing.groupBy({
      by: ["created_by"],
      where: { created_at: range, created_by: { not: null } },
      _count: { id: true },
    }),
  ]);

  // 3. Summary
  const driversAdded = driversInPeriod.length;
  const driversVerified = driversInPeriod.filter((d) => d.is_verified).length;
  const driversWithVehicle = driversInPeriod.filter((d) => d.vehicle_id !== null).length;
  const pricingAdded = pricingByCreator.reduce((s, r) => s + r._count.id, 0);

  // 4. Pricing by creator map
  const pricingCreatorMap = new Map<string, number>(
    pricingByCreator.map((r) => [r.created_by as string, r._count.id]),
  );

  // 5. Build driver rows by creator
  const driversByCreator = new Map<string, DriverRowDetail[]>();
  for (const d of driversInPeriod) {
    const key = d.created_by ?? "__unknown__";
    if (!driversByCreator.has(key)) driversByCreator.set(key, []);
    driversByCreator.get(key)!.push({
      id: d.id,
      name: d.name,
      mobile: d.mobile,
      city: d.city ?? null,
      state: d.state ?? null,
      hasVehicle: d.vehicle_id !== null,
      isVerified: d.is_verified,
      isActive: d.is_active,
      createdAt: d.created_at.toISOString().split("T")[0],
    });
  }

  // 6. Merge dept members + any extra creators
  const deptMemberIds = new Set(allMembers.map((m) => m.id));
  const allCreatorIds = new Set([
    ...driversByCreator.keys(),
    ...pricingCreatorMap.keys(),
  ]);
  const extraIds = [...allCreatorIds].filter(
    (id) => id !== "__unknown__" && !deptMemberIds.has(id),
  );
  const extraMembers =
    extraIds.length > 0
      ? await db.teamMember.findMany({
          where: { id: { in: extraIds } },
          select: { id: true, name: true, profilePicUrl: true, designation: true, isActive: true },
        })
      : [];

  const memberList = [...allMembers, ...extraMembers];

  const members: CabDeptMember[] = memberList
    .map((m) => {
      const drivers = driversByCreator.get(m.id) ?? [];
      return {
        id: m.id,
        name: m.name,
        profilePicUrl: m.profilePicUrl ?? null,
        designation: m.designation ?? null,
        isActive: m.isActive,
        driversAdded: drivers.length,
        driversVerified: drivers.filter((d) => d.isVerified).length,
        driversWithVehicle: drivers.filter((d) => d.hasVehicle).length,
        pricingAdded: pricingCreatorMap.get(m.id) ?? 0,
        drivers,
      };
    })
    .sort((a, b) => b.driversAdded + b.pricingAdded - (a.driversAdded + a.pricingAdded));

  // 7. Daily chart — drivers + pricing combined per member per day
  const dailyRaw = new Map<string, Record<string, number>>();
  for (const d of driversInPeriod) {
    const day = d.created_at.toISOString().split("T")[0];
    if (!dailyRaw.has(day)) dailyRaw.set(day, {});
    const slot = dailyRaw.get(day)!;
    const mid = d.created_by ?? "__unknown__";
    slot[mid] = (slot[mid] ?? 0) + 1;
    slot.__total__ = (slot.__total__ ?? 0) + 1;
  }
  // pricing daily (fetch separately since groupBy doesn't give date)
  const pricingDailyRaw = await db.cab_pricing.findMany({
    where: { created_at: range },
    select: { created_at: true, created_by: true },
  });
  for (const p of pricingDailyRaw) {
    const day = p.created_at.toISOString().split("T")[0];
    if (!dailyRaw.has(day)) dailyRaw.set(day, {});
    const slot = dailyRaw.get(day)!;
    const mid = p.created_by ?? "__unknown__";
    slot[mid] = (slot[mid] ?? 0) + 1;
    slot.__total__ = (slot.__total__ ?? 0) + 1;
  }

  const dailyChart: DailyCabPoint[] = [];
  const cur = new Date(range.gte);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(range.lte);
  end.setHours(23, 59, 59, 999);
  while (cur <= end) {
    const iso = cur.toISOString().split("T")[0];
    const slot = dailyRaw.get(iso) ?? {};
    const fmtLabel = new Intl.DateTimeFormat("en-IN", {
      day: "numeric", month: "short",
    }).format(new Date(iso));
    const point: DailyCabPoint = { date: fmtLabel, total: slot.__total__ ?? 0 };
    for (const m of members) point[m.id] = slot[m.id] ?? 0;
    dailyChart.push(point);
    cur.setDate(cur.getDate() + 1);
  }

  return {
    summary: { driversAdded, driversVerified, driversWithVehicle, pricingAdded },
    members,
    dailyChart,
  };
}

// ── Main fetch ─────────────────────────────────────────────────────────────

export async function getReportsData(
  period: TimePeriod = "today",
  customFrom?: string,
  customTo?: string,
): Promise<ReportsData> {
  const range = toDateRange(period, customFrom, customTo);

  // ── Hotel + Cab + Travel dept (run in parallel with everything else) ───────
  const [
    hotelDept,
    cabDept,
    travelDept,
    hotelsAdded,
    roomsAdded,
    imagesAdded,
    hotelsWithoutRooms,
    hotelsByMember,
  ] = await Promise.all([
    getHotelDeptReport(range),
    getCabDeptReport(range),
    getTravelDeptReport(range),
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
    hotelDept,
    cabDept,
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
    travelDept,
    period,
    fromStr: fmt(range.gte),
    toStr: fmt(range.lte),
  };
}
