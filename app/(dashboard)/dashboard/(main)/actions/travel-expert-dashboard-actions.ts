import "server-only";
import { db } from "@/app/lib/db";

export interface TravelExpertDashboardData {
  // ── My content (filtered by created_by) ────────────────────────────────
  mine: {
    totalPackages:   number;
    activePackages:  number;
    inactivePackages: number;
    packagesNoThumb: number;
    totalRegions:    number;
    totalDestinations: number;
    totalHotels:     number;
  };

  // ── System-wide totals (for context / contribution %) ──────────────────
  global: {
    totalPackages:    number;
    totalRegions:     number;
    totalDestinations: number;
    totalHotels:      number;
    totalActivities:  number;  // activities has no created_by
  };

  // ── Added THIS WEEK by me ──────────────────────────────────────────────
  mineThisWeek: {
    packages:     number;
    regions:      number;
    destinations: number;
    hotels:       number;
  };

  // ── Recent content I created ───────────────────────────────────────────
  recentPackages: {
    id:          number;
    title:       string;
    destination: string;
    is_active:   boolean;
    hasThumbnail: boolean;
    created_at:  Date;
  }[];

  recentRegions: {
    id:         number;
    name:       string;
    country:    string;
    is_active:  boolean;
    destCount:  number;
    created_at: Date;
  }[];

  recentDestinations: {
    id:         number;
    name:       string;
    region:     string;
    is_active:  boolean;
    created_at: Date;
  }[];
}

export async function getTravelExpertDashboardData(
  actorName: string,
): Promise<TravelExpertDashboardData> {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);

  const byMe = { created_by: actorName };
  const byMeThisWeek = { created_by: actorName, created_at: { gte: weekStart } };

  const [
    // ── Mine ──────────────────────────────────────────────────────────────
    myTotalPkgs,
    myActivePkgs,
    myInactivePkgs,
    myPkgsNoThumb,
    myRegions,
    myDestinations,
    myHotels,

    // ── Global ────────────────────────────────────────────────────────────
    globalPkgs,
    globalRegions,
    globalDests,
    globalHotels,
    globalActivities,

    // ── Mine this week ────────────────────────────────────────────────────
    myPkgsWeek,
    myRegionsWeek,
    myDestsWeek,
    myHotelsWeek,

    // ── Recent mine ───────────────────────────────────────────────────────
    recentPkgsRaw,
    recentRegionsRaw,
    recentDestsRaw,
  ] = await Promise.all([
    // mine
    db.packages.count({ where: byMe }),
    db.packages.count({ where: { ...byMe, is_active: true } }),
    db.packages.count({ where: { ...byMe, is_active: false } }),
    db.packages.count({ where: { ...byMe, thumbnail: null } }),
    db.custom_regions.count({ where: { ...byMe, is_deleted: false } }),
    db.destinations.count({ where: { ...byMe, is_deleted: false } }),
    db.hotels.count({ where: byMe }),

    // global
    db.packages.count(),
    db.custom_regions.count({ where: { is_deleted: false } }),
    db.destinations.count({ where: { is_deleted: false } }),
    db.hotels.count({ where: { is_active: true } }),
    db.activities.count({ where: { is_active: true } }),

    // mine this week
    db.packages.count({ where: byMeThisWeek }),
    db.custom_regions.count({ where: { ...byMeThisWeek, is_deleted: false } }),
    db.destinations.count({ where: { ...byMeThisWeek, is_deleted: false } }),
    db.hotels.count({ where: byMeThisWeek }),

    // recent packages
    db.packages.findMany({
      where:   byMe,
      orderBy: { created_at: "desc" },
      take:    6,
      select: {
        id: true, title: true, is_active: true, thumbnail: true, created_at: true,
        destination: { select: { name: true } },
      },
    }),

    // recent regions
    db.custom_regions.findMany({
      where:   { ...byMe, is_deleted: false },
      orderBy: { created_at: "desc" },
      take:    5,
      select: {
        id: true, name: true, country: true, is_active: true, created_at: true,
        _count: { select: { destinations: true } },
      },
    }),

    // recent destinations
    db.destinations.findMany({
      where:   { ...byMe, is_deleted: false },
      orderBy: { created_at: "desc" },
      take:    5,
      select: {
        id: true, name: true, is_active: true, created_at: true,
        region: { select: { name: true } },
      },
    }),
  ]);

  return {
    mine: {
      totalPackages:    myTotalPkgs,
      activePackages:   myActivePkgs,
      inactivePackages: myInactivePkgs,
      packagesNoThumb:  myPkgsNoThumb,
      totalRegions:     myRegions,
      totalDestinations: myDestinations,
      totalHotels:      myHotels,
    },
    global: {
      totalPackages:    globalPkgs,
      totalRegions:     globalRegions,
      totalDestinations: globalDests,
      totalHotels:      globalHotels,
      totalActivities:  globalActivities,
    },
    mineThisWeek: {
      packages:     myPkgsWeek,
      regions:      myRegionsWeek,
      destinations: myDestsWeek,
      hotels:       myHotelsWeek,
    },
    recentPackages: recentPkgsRaw.map((p) => ({
      id:          p.id,
      title:       p.title,
      destination: p.destination.name,
      is_active:   p.is_active,
      hasThumbnail: !!p.thumbnail,
      created_at:  p.created_at,
    })),
    recentRegions: recentRegionsRaw.map((r) => ({
      id:         r.id,
      name:       r.name,
      country:    r.country,
      is_active:  r.is_active,
      destCount:  r._count.destinations,
      created_at: r.created_at,
    })),
    recentDestinations: recentDestsRaw.map((d) => ({
      id:         d.id,
      name:       d.name,
      region:     d.region.name,
      is_active:  d.is_active,
      created_at: d.created_at,
    })),
  };
}
