import "server-only";
import { db } from "@/app/lib/db";

export interface CabDepartmentDashboardData {
  mine: {
    totalVehicles: number;
    activeVehicles: number;
    inactiveVehicles: number;
    vehiclesNoRates: number;
    totalDrivers: number;
    activeDrivers: number;
    verifiedDrivers: number;
    driversNoLicense: number;
    driversNoVehicle: number;
    pricingRoutes: number;
  };
  global: {
    totalVehicles: number;
    totalDrivers: number;
    totalPricingRoutes: number;
  };
  mineThisWeek: {
    vehicles: number;
    drivers: number;
  };
  byVehicleType: { type: string; count: number }[];
  recentVehicles: {
    id: number;
    name: string;
    type: string;
    capacity: number;
    hasAc: boolean;
    is_active: boolean;
    rateCount: number;
    created_at: Date;
  }[];
  recentDrivers: {
    id: number;
    name: string;
    mobile: string;
    city: string | null;
    vehicle: string | null;
    is_verified: boolean;
    is_active: boolean;
    created_at: Date;
  }[];
}

function isColumnMissingError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const err = e as Record<string, unknown>;
  if (err.code === "P2022") return true;
  if (err.name === "PrismaClientValidationError") {
    return String(err.message ?? "").includes("created_by");
  }
  return false;
}

export async function getCabDepartmentDashboardData(
  actorId: string,
): Promise<CabDepartmentDashboardData> {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);

  const byMe = { created_by: actorId };
  const byMeThisWeek = { created_by: actorId, created_at: { gte: weekStart } };

  let totalVehicles = 0;
  let activeVehicles = 0;
  let inactiveVehicles = 0;
  let vehiclesNoRates = 0;
  let vehiclesWeek = 0;
  let globalVehicles = 0;
  let byVehicleTypeRaw: { type: string; _count: { id: number } }[] = [];
  let recentVehiclesRaw: {
    id: number; name: string; type: string; passenger_capacity: number;
    has_ac: boolean; is_active: boolean; created_at: Date;
    _count: { rates: number };
  }[] = [];

  try {
    [
      totalVehicles,
      activeVehicles,
      inactiveVehicles,
      vehiclesNoRates,
      vehiclesWeek,
      globalVehicles,
      byVehicleTypeRaw,
      recentVehiclesRaw,
    ] = await Promise.all([
      db.vehicles.count({ where: byMe }),
      db.vehicles.count({ where: { ...byMe, is_active: true } }),
      db.vehicles.count({ where: { ...byMe, is_active: false } }),
      db.vehicles.count({ where: { ...byMe, rates: { none: {} } } }),
      db.vehicles.count({ where: byMeThisWeek }),
      db.vehicles.count({ where: { is_active: true } }),
      db.vehicles.groupBy({
        by: ["type"],
        where: byMe,
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      }),
      db.vehicles.findMany({
        where: byMe,
        orderBy: { created_at: "desc" },
        take: 6,
        select: {
          id: true, name: true, type: true,
          passenger_capacity: true, has_ac: true,
          is_active: true, created_at: true,
          _count: { select: { rates: true } },
        },
      }),
    ]);
  } catch (e) {
    if (!isColumnMissingError(e)) throw e;
  }

  let totalDrivers = 0;
  let activeDrivers = 0;
  let verifiedDrivers = 0;
  let driversNoLicense = 0;
  let driversNoVehicle = 0;
  let driversWeek = 0;
  let globalDrivers = 0;
  let recentDriversRaw: {
    id: number; name: string; mobile: string; city: string | null;
    is_verified: boolean; is_active: boolean; created_at: Date;
    vehicle: { name: string } | null;
  }[] = [];

  try {
    [
      totalDrivers,
      activeDrivers,
      verifiedDrivers,
      driversNoLicense,
      driversNoVehicle,
      driversWeek,
      globalDrivers,
      recentDriversRaw,
    ] = await Promise.all([
      db.cab_drivers.count({ where: byMe }),
      db.cab_drivers.count({ where: { ...byMe, is_active: true } }),
      db.cab_drivers.count({ where: { ...byMe, is_verified: true } }),
      db.cab_drivers.count({ where: { ...byMe, license_number: null } }),
      db.cab_drivers.count({ where: { ...byMe, vehicle_id: null } }),
      db.cab_drivers.count({ where: byMeThisWeek }),
      db.cab_drivers.count({ where: { is_active: true } }),
      db.cab_drivers.findMany({
        where: byMe,
        orderBy: { created_at: "desc" },
        take: 6,
        select: {
          id: true, name: true, mobile: true, city: true,
          is_verified: true, is_active: true, created_at: true,
          vehicle: { select: { name: true } },
        },
      }),
    ]);
  } catch (e) {
    if (!isColumnMissingError(e)) throw e;
  }

  const [pricingRoutesMine, globalPricingRoutes] = await Promise.all([
    db.cab_pricing.count({ where: { created_by: actorId, is_active: true } }),
    db.cab_pricing.count({ where: { is_active: true } }),
  ]);

  return {
    mine: {
      totalVehicles,
      activeVehicles,
      inactiveVehicles,
      vehiclesNoRates,
      totalDrivers,
      activeDrivers,
      verifiedDrivers,
      driversNoLicense,
      driversNoVehicle,
      pricingRoutes: pricingRoutesMine,
    },
    global: {
      totalVehicles: globalVehicles,
      totalDrivers: globalDrivers,
      totalPricingRoutes: globalPricingRoutes,
    },
    mineThisWeek: {
      vehicles: vehiclesWeek,
      drivers: driversWeek,
    },
    byVehicleType: byVehicleTypeRaw.map((r) => ({
      type: r.type,
      count: r._count.id,
    })),
    recentVehicles: recentVehiclesRaw.map((v) => ({
      id: v.id,
      name: v.name,
      type: v.type,
      capacity: v.passenger_capacity,
      hasAc: v.has_ac,
      is_active: v.is_active,
      rateCount: v._count.rates,
      created_at: v.created_at,
    })),
    recentDrivers: recentDriversRaw.map((d) => ({
      id: d.id,
      name: d.name,
      mobile: d.mobile,
      city: d.city,
      vehicle: d.vehicle?.name ?? null,
      is_verified: d.is_verified,
      is_active: d.is_active,
      created_at: d.created_at,
    })),
  };
}
