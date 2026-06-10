import "server-only";
import { db } from "@/app/lib/db";

export interface DataEntryDashboardData {
  // KPI counts
  totalPackages: number;
  activePackages: number;
  totalDestinations: number;
  totalHotels: number;
  totalActivities: number;

  // Attention items
  inactivePackages: number;
  packagesWithoutThumbnail: number;
  hotelsWithoutRooms: number;
  activitiesWithoutImages: number;

  // Added this week
  addedThisWeek: {
    packages: number;
    hotels: number;
    destinations: number;
    activities: number;
  };

  // Recent content
  recentPackages: {
    id: number;
    title: string;
    destination: string;
    is_active: boolean;
    hasThumbnail: boolean;
    created_at: Date;
  }[];

  recentHotels: {
    id: number;
    name: string;
    destination: string;
    roomCount: number;
    is_active: boolean;
    created_at: Date;
  }[];
}

export async function getDataEntryDashboardData(): Promise<DataEntryDashboardData> {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);

  const [
    totalPackages,
    activePackages,
    totalDestinations,
    totalHotels,
    totalActivities,
    inactivePackages,
    packagesWithoutThumbnail,
    hotelsWithoutRooms,
    activitiesWithoutImages,
    pkgsThisWeek,
    hotelsThisWeek,
    destThisWeek,
    activitiesThisWeek,
    recentPackagesRaw,
    recentHotelsRaw,
  ] = await Promise.all([
    db.packages.count(),
    db.packages.count({ where: { is_active: true } }),
    db.destinations.count({ where: { is_deleted: false } }),
    db.hotels.count({ where: { is_active: true } }),
    db.activities.count({ where: { is_active: true } }),

    db.packages.count({ where: { is_active: false } }),
    db.packages.count({ where: { thumbnail: null, is_active: false } }),

    // Hotels with zero rooms
    db.hotels.count({
      where: {
        is_active: true,
        hotelRooms: { none: {} },
      },
    }),

    // Activities with zero images
    db.activities.count({
      where: {
        is_active: true,
        images: { none: {} },
      },
    }),

    db.packages.count({ where: { created_at: { gte: weekStart } } }),
    db.hotels.count({ where: { created_at: { gte: weekStart } } }),
    db.destinations.count({ where: { created_at: { gte: weekStart } } }),
    db.activities.count({ where: { created_at: { gte: weekStart } } }),

    db.packages.findMany({
      orderBy: { created_at: "desc" },
      take: 6,
      select: {
        id: true,
        title: true,
        is_active: true,
        thumbnail: true,
        created_at: true,
        destination: { select: { name: true } },
      },
    }),

    db.hotels.findMany({
      orderBy: { created_at: "desc" },
      take: 6,
      select: {
        id: true,
        name: true,
        is_active: true,
        created_at: true,
        destination: { select: { name: true } },
        _count: { select: { hotelRooms: true } },
      },
    }),
  ]);

  return {
    totalPackages,
    activePackages,
    totalDestinations,
    totalHotels,
    totalActivities,
    inactivePackages,
    packagesWithoutThumbnail,
    hotelsWithoutRooms,
    activitiesWithoutImages,
    addedThisWeek: {
      packages: pkgsThisWeek,
      hotels: hotelsThisWeek,
      destinations: destThisWeek,
      activities: activitiesThisWeek,
    },
    recentPackages: recentPackagesRaw.map((p) => ({
      id: p.id,
      title: p.title,
      destination: p.destination.name,
      is_active: p.is_active,
      hasThumbnail: !!p.thumbnail,
      created_at: p.created_at,
    })),
    recentHotels: recentHotelsRaw.map((h) => ({
      id: h.id,
      name: h.name,
      destination: h.destination.name,
      roomCount: h._count.hotelRooms,
      is_active: h.is_active,
      created_at: h.created_at,
    })),
  };
}
