import "server-only";
import { db } from "@/app/lib/db";

export interface InventoryManagerDashboardData {
  mine: {
    totalHotels:      number;
    activeHotels:     number;
    inactiveHotels:   number;
    hotelsNoRooms:    number;
    totalVehicles:    number;
    activeVehicles:   number;
    totalDrivers:     number;
    activeDrivers:    number;
    verifiedDrivers:  number;
    driversNoLicense: number;
  };
  global: {
    totalHotels:      number;
    totalVehicles:    number;
    totalDrivers:     number;
    cabPricingRoutes: number;
  };
  mineThisWeek: {
    hotels:   number;
    vehicles: number;
    drivers:  number;
  };
  recentHotels: {
    id: number; name: string; destination: string; category: string | null;
    roomCount: number; is_active: boolean; created_at: Date;
  }[];
  recentVehicles: {
    id: number; name: string; type: string; passenger_capacity: number;
    has_ac: boolean; is_active: boolean; rateCount: number; created_at: Date;
  }[];
  recentDrivers: {
    id: number; name: string; mobile: string; city: string | null;
    vehicle: string | null; is_verified: boolean; is_active: boolean; created_at: Date;
  }[];
}

function isP2022(e: unknown) {
  return (e as { code?: string })?.code === "P2022";
}

export async function getInventoryManagerDashboardData(
  actorName: string,
): Promise<InventoryManagerDashboardData> {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);

  const byMe         = { created_by: actorName };
  const byMeThisWeek = { created_by: actorName, created_at: { gte: weekStart } };

  // ── 1. Always-safe queries: global stats + hotel personalisation ──────────
  // hotels.created_by exists on all DBs (migrated earlier and deployed).
  // global counts never touch created_by so they're always safe.
  const [
    myTotalHotels, myActiveHotels, myInactiveHotels, myHotelsNoRooms, myHotelsWeek,
    recentHotelsRaw,
    globalHotels, globalVehicles, globalDrivers, globalCabRoutes,
  ] = await Promise.all([
    db.hotels.count({ where: byMe }),
    db.hotels.count({ where: { ...byMe, is_active: true } }),
    db.hotels.count({ where: { ...byMe, is_active: false } }),
    db.hotels.count({ where: { ...byMe, hotelRooms: { none: {} } } }),
    db.hotels.count({ where: byMeThisWeek }),
    db.hotels.findMany({
      where: byMe, orderBy: { created_at: "desc" }, take: 6,
      select: {
        id: true, name: true, category: true, is_active: true, created_at: true,
        destination: { select: { name: true } },
        _count: { select: { hotelRooms: true } },
      },
    }),
    db.hotels.count({ where: { is_active: true } }),
    db.vehicles.count({ where: { is_active: true } }),
    db.cab_drivers.count({ where: { is_active: true } }),
    db.cab_pricing.count({ where: { is_active: true } }),
  ]);

  // ── 2. Vehicle personalisation — graceful fallback on P2022 ──────────────
  // vehicles.created_by column may be absent on production until migration runs.
  let myTotalVehicles = 0, myActiveVehicles = 0, myVehiclesWeek = 0;
  let recentVehiclesRaw: Awaited<ReturnType<typeof db.vehicles.findMany<{
    where: typeof byMe; orderBy: { created_at: "desc" }; take: 5;
    select: {
      id: true; name: true; type: true; passenger_capacity: true;
      has_ac: true; is_active: true; created_at: true;
      _count: { select: { rates: true } };
    };
  }>>> = [];

  try {
    [myTotalVehicles, myActiveVehicles, myVehiclesWeek, recentVehiclesRaw] = await Promise.all([
      db.vehicles.count({ where: byMe }),
      db.vehicles.count({ where: { ...byMe, is_active: true } }),
      db.vehicles.count({ where: byMeThisWeek }),
      db.vehicles.findMany({
        where: byMe, orderBy: { created_at: "desc" }, take: 5,
        select: {
          id: true, name: true, type: true, passenger_capacity: true,
          has_ac: true, is_active: true, created_at: true,
          _count: { select: { rates: true } },
        },
      }),
    ]);
  } catch (e) {
    if (!isP2022(e)) throw e;
  }

  // ── 3. Driver personalisation — graceful fallback on P2022 ───────────────
  let myTotalDrivers = 0, myActiveDrivers = 0, myVerifiedDrivers = 0;
  let myDriversNoLicense = 0, myDriversWeek = 0;
  let recentDriversRaw: Awaited<ReturnType<typeof db.cab_drivers.findMany<{
    where: typeof byMe; orderBy: { created_at: "desc" }; take: 5;
    select: {
      id: true; name: true; mobile: true; city: true;
      is_verified: true; is_active: true; created_at: true;
      vehicle: { select: { name: true } };
    };
  }>>> = [];

  try {
    [myTotalDrivers, myActiveDrivers, myVerifiedDrivers, myDriversNoLicense, myDriversWeek, recentDriversRaw] =
      await Promise.all([
        db.cab_drivers.count({ where: byMe }),
        db.cab_drivers.count({ where: { ...byMe, is_active: true } }),
        db.cab_drivers.count({ where: { ...byMe, is_verified: true } }),
        db.cab_drivers.count({ where: { ...byMe, license_number: null } }),
        db.cab_drivers.count({ where: byMeThisWeek }),
        db.cab_drivers.findMany({
          where: byMe, orderBy: { created_at: "desc" }, take: 5,
          select: {
            id: true, name: true, mobile: true, city: true,
            is_verified: true, is_active: true, created_at: true,
            vehicle: { select: { name: true } },
          },
        }),
      ]);
  } catch (e) {
    if (!isP2022(e)) throw e;
  }

  return {
    mine: {
      totalHotels:      myTotalHotels,
      activeHotels:     myActiveHotels,
      inactiveHotels:   myInactiveHotels,
      hotelsNoRooms:    myHotelsNoRooms,
      totalVehicles:    myTotalVehicles,
      activeVehicles:   myActiveVehicles,
      totalDrivers:     myTotalDrivers,
      activeDrivers:    myActiveDrivers,
      verifiedDrivers:  myVerifiedDrivers,
      driversNoLicense: myDriversNoLicense,
    },
    global: {
      totalHotels:      globalHotels,
      totalVehicles:    globalVehicles,
      totalDrivers:     globalDrivers,
      cabPricingRoutes: globalCabRoutes,
    },
    mineThisWeek: {
      hotels:   myHotelsWeek,
      vehicles: myVehiclesWeek,
      drivers:  myDriversWeek,
    },
    recentHotels: recentHotelsRaw.map((h) => ({
      id: h.id, name: h.name, destination: h.destination.name,
      category: h.category, roomCount: h._count.hotelRooms,
      is_active: h.is_active, created_at: h.created_at,
    })),
    recentVehicles: recentVehiclesRaw.map((v) => ({
      id: v.id, name: v.name, type: v.type,
      passenger_capacity: v.passenger_capacity, has_ac: v.has_ac,
      is_active: v.is_active, rateCount: v._count.rates, created_at: v.created_at,
    })),
    recentDrivers: recentDriversRaw.map((d) => ({
      id: d.id, name: d.name, mobile: d.mobile, city: d.city,
      vehicle: d.vehicle?.name ?? null, is_verified: d.is_verified,
      is_active: d.is_active, created_at: d.created_at,
    })),
  };
}
