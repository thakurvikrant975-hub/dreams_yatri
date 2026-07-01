import "server-only";
import { db } from "@/app/lib/db";

const INVENTORY_ROLE = "Inventory Manager";
const TRAVEL_ROLE = "Travel Expert";

export interface PlatformManagerDashboardData {
  global: {
    totalHotels: number;
    totalCabPricingRoutes: number;
    totalVehicles: number;
    totalDrivers: number;
    totalPackages: number;
    totalActivities: number;
    totalDestinations: number;
    totalRegions: number;
  };
  thisWeek: {
    hotels: number;
    cabPricing: number;
    vehicles: number;
    drivers: number;
    packages: number;
    activities: number;
    destinations: number;
    regions: number;
  };
  attention: {
    hotelsNoRooms: number;
    driversNoLicense: number;
    inactivePackages: number;
    inactiveActivities: number;
  };
  inventoryManagers: {
    id: string;
    name: string;
    hotels: number;
    hotelsThisWeek: number;
    cabPricing: number;
    vehicles: number;
    drivers: number;
    lastActiveAt: Date | null;
  }[];
  travelExperts: {
    id: string;
    name: string;
    packages: number;
    packagesThisWeek: number;
    activities: number;
    destinations: number;
    regions: number;
    lastActiveAt: Date | null;
  }[];
  recentActivity: {
    id: string;
    userName: string | null;
    userRole: string | null;
    action: string;
    entity: string;
    entitySlug: string | null;
    description: string | null;
    actionAt: Date;
  }[];
}

function countByName(rows: { created_by: string | null; _count: { _all: number } }[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rows) {
    if (r.created_by) map.set(r.created_by, r._count._all);
  }
  return map;
}

export async function getPlatformManagerDashboardData(): Promise<PlatformManagerDashboardData> {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);

  // ── Roster ──────────────────────────────────────────────────────────────
  const roster = await db.teamMember.findMany({
    where: { isActive: true, teamRole: { name: { in: [INVENTORY_ROLE, TRAVEL_ROLE] } } },
    select: { id: true, name: true, teamRole: { select: { name: true } } },
    orderBy: { name: "asc" },
  });

  const inventoryMembers = roster.filter((m) => m.teamRole?.name === INVENTORY_ROLE);
  const travelMembers = roster.filter((m) => m.teamRole?.name === TRAVEL_ROLE);
  const inventoryNames = inventoryMembers.map((m) => m.name);
  const travelNames = travelMembers.map((m) => m.name);
  const allNames = [...inventoryNames, ...travelNames];

  const byName = (names: string[]) => ({ created_by: { in: names } });
  const byNameThisWeek = (names: string[]) => ({ created_by: { in: names }, created_at: { gte: weekStart } });

  const [
    // global totals
    totalHotels, totalCabPricingRoutes, totalVehicles, totalDrivers,
    totalPackages, totalActivities, totalDestinations, totalRegions,

    // this week (org-wide)
    weekHotels, weekCabPricing, weekVehicles, weekDrivers,
    weekPackages, weekActivities, weekDestinations, weekRegions,

    // attention
    hotelsNoRooms, driversNoLicense, inactivePackages, inactiveActivities,

    // per-employee groupBy — all-time
    hotelsByEmployee, cabPricingByEmployee, vehiclesByEmployee, driversByEmployee,
    packagesByEmployee, activitiesByEmployee, destinationsByEmployee, regionsByEmployee,

    // per-employee groupBy — this week
    hotelsByEmployeeWeek, packagesByEmployeeWeek,

    // last active per employee
    lastActiveByEmployee,

    // recent activity feed
    recentActivityRaw,
  ] = await Promise.all([
    db.hotels.count(),
    db.cab_pricing.count(),
    db.vehicles.count(),
    db.cab_drivers.count(),
    db.packages.count(),
    db.activities.count(),
    db.destinations.count({ where: { is_deleted: false } }),
    db.custom_regions.count({ where: { is_deleted: false } }),

    db.hotels.count({ where: { created_at: { gte: weekStart } } }),
    db.cab_pricing.count({ where: { created_at: { gte: weekStart } } }),
    db.vehicles.count({ where: { created_at: { gte: weekStart } } }),
    db.cab_drivers.count({ where: { created_at: { gte: weekStart } } }),
    db.packages.count({ where: { created_at: { gte: weekStart } } }),
    db.activities.count({ where: { created_at: { gte: weekStart } } }),
    db.destinations.count({ where: { created_at: { gte: weekStart }, is_deleted: false } }),
    db.custom_regions.count({ where: { created_at: { gte: weekStart }, is_deleted: false } }),

    db.hotels.count({ where: { hotelRooms: { none: {} } } }),
    db.cab_drivers.count({ where: { license_number: null } }),
    db.packages.count({ where: { is_active: false } }),
    db.activities.count({ where: { is_active: false } }),

    db.hotels.groupBy({ by: ["created_by"], where: byName(inventoryNames), _count: { _all: true } }),
    db.cab_pricing.groupBy({ by: ["created_by"], where: byName(inventoryNames), _count: { _all: true } }),
    db.vehicles.groupBy({ by: ["created_by"], where: byName(inventoryNames), _count: { _all: true } }),
    db.cab_drivers.groupBy({ by: ["created_by"], where: byName(inventoryNames), _count: { _all: true } }),
    db.packages.groupBy({ by: ["created_by"], where: byName(travelNames), _count: { _all: true } }),
    db.activities.groupBy({ by: ["created_by"], where: byName(travelNames), _count: { _all: true } }),
    db.destinations.groupBy({ by: ["created_by"], where: { ...byName(travelNames), is_deleted: false }, _count: { _all: true } }),
    db.custom_regions.groupBy({ by: ["created_by"], where: { ...byName(travelNames), is_deleted: false }, _count: { _all: true } }),

    db.hotels.groupBy({ by: ["created_by"], where: byNameThisWeek(inventoryNames), _count: { _all: true } }),
    db.packages.groupBy({ by: ["created_by"], where: byNameThisWeek(travelNames), _count: { _all: true } }),

    allNames.length > 0
      ? db.activityLog.groupBy({ by: ["userName"], where: { userName: { in: allNames } }, _max: { actionAt: true } })
      : Promise.resolve([]),

    db.activityLog.findMany({
      where: { userRole: { in: [INVENTORY_ROLE, TRAVEL_ROLE] } },
      orderBy: { actionAt: "desc" },
      take: 15,
      select: {
        id: true, userName: true, userRole: true, action: true,
        entity: true, entitySlug: true, description: true, actionAt: true,
      },
    }),
  ]);

  const lastActiveMap = new Map<string, Date>();
  for (const r of lastActiveByEmployee) {
    if (r.userName && r._max.actionAt) lastActiveMap.set(r.userName, r._max.actionAt);
  }

  const hotelsMap = countByName(hotelsByEmployee);
  const cabPricingMap = countByName(cabPricingByEmployee);
  const vehiclesMap = countByName(vehiclesByEmployee);
  const driversMap = countByName(driversByEmployee);
  const hotelsWeekMap = countByName(hotelsByEmployeeWeek);

  const packagesMap = countByName(packagesByEmployee);
  const activitiesMap = countByName(activitiesByEmployee);
  const destinationsMap = countByName(destinationsByEmployee);
  const regionsMap = countByName(regionsByEmployee);
  const packagesWeekMap = countByName(packagesByEmployeeWeek);

  return {
    global: {
      totalHotels, totalCabPricingRoutes, totalVehicles, totalDrivers,
      totalPackages, totalActivities, totalDestinations, totalRegions,
    },
    thisWeek: {
      hotels: weekHotels, cabPricing: weekCabPricing, vehicles: weekVehicles, drivers: weekDrivers,
      packages: weekPackages, activities: weekActivities, destinations: weekDestinations, regions: weekRegions,
    },
    attention: { hotelsNoRooms, driversNoLicense, inactivePackages, inactiveActivities },
    inventoryManagers: inventoryMembers.map((m) => ({
      id: m.id,
      name: m.name,
      hotels: hotelsMap.get(m.name) ?? 0,
      hotelsThisWeek: hotelsWeekMap.get(m.name) ?? 0,
      cabPricing: cabPricingMap.get(m.name) ?? 0,
      vehicles: vehiclesMap.get(m.name) ?? 0,
      drivers: driversMap.get(m.name) ?? 0,
      lastActiveAt: lastActiveMap.get(m.name) ?? null,
    })),
    travelExperts: travelMembers.map((m) => ({
      id: m.id,
      name: m.name,
      packages: packagesMap.get(m.name) ?? 0,
      packagesThisWeek: packagesWeekMap.get(m.name) ?? 0,
      activities: activitiesMap.get(m.name) ?? 0,
      destinations: destinationsMap.get(m.name) ?? 0,
      regions: regionsMap.get(m.name) ?? 0,
      lastActiveAt: lastActiveMap.get(m.name) ?? null,
    })),
    recentActivity: recentActivityRaw.map((a) => ({
      id: a.id,
      userName: a.userName,
      userRole: a.userRole,
      action: a.action,
      entity: a.entity,
      entitySlug: a.entitySlug,
      description: a.description,
      actionAt: a.actionAt,
    })),
  };
}
