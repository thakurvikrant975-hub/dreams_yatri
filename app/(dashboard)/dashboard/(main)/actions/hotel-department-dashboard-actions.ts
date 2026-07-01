import "server-only";
import { db } from "@/app/lib/db";

export interface HotelDepartmentDashboardData {
  mine: {
    total: number;
    active: number;
    inactive: number;
    noRooms: number;
    draft: number;
    submitted: number;
    underReview: number;
    live: number;
    rejected: number;
  };
  global: {
    total: number;
    live: number;
    pendingReview: number;
  };
  mineThisWeek: number;
  byCategory: { category: string; count: number }[];
  recentHotels: {
    id: number;
    name: string;
    destination: string;
    category: string | null;
    roomCount: number;
    is_active: boolean;
    listingStatus: string;
    created_at: Date;
  }[];
}

const CATEGORY_LABELS: Record<string, string> = {
  budget: "Budget",
  standard: "Standard",
  deluxe: "Deluxe",
  luxury: "Luxury",
  premium: "Premium",
  boutique: "Boutique",
};

export const HOTEL_CATEGORY_LABEL = (cat: string | null) =>
  cat ? (CATEGORY_LABELS[cat] ?? cat) : "—";

export async function getHotelDepartmentDashboardData(
  actorName: string,
): Promise<HotelDepartmentDashboardData> {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);

  const byMe = { created_by: actorName };
  const byMeThisWeek = { created_by: actorName, created_at: { gte: weekStart } };

  const [
    myTotal,
    myActive,
    myInactive,
    myNoRooms,
    myDraft,
    mySubmitted,
    myUnderReview,
    myLive,
    myRejected,
    myThisWeek,

    globalTotal,
    globalLive,
    globalPendingReview,

    byCategoryRaw,
    recentRaw,
  ] = await Promise.all([
    db.hotels.count({ where: byMe }),
    db.hotels.count({ where: { ...byMe, is_active: true } }),
    db.hotels.count({ where: { ...byMe, is_active: false } }),
    db.hotels.count({ where: { ...byMe, hotelRooms: { none: {} } } }),
    db.hotels.count({ where: { ...byMe, listing_status: "DRAFT" } }),
    db.hotels.count({ where: { ...byMe, listing_status: "SUBMITTED" } }),
    db.hotels.count({ where: { ...byMe, listing_status: "UNDER_REVIEW" } }),
    db.hotels.count({ where: { ...byMe, listing_status: "LIVE" } }),
    db.hotels.count({ where: { ...byMe, listing_status: "REJECTED" } }),
    db.hotels.count({ where: byMeThisWeek }),

    db.hotels.count(),
    db.hotels.count({ where: { listing_status: "LIVE" } }),
    db.hotels.count({ where: { listing_status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }),

    db.hotels.groupBy({
      by: ["category"],
      where: byMe,
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),

    db.hotels.findMany({
      where: byMe,
      orderBy: { created_at: "desc" },
      take: 8,
      select: {
        id: true,
        name: true,
        category: true,
        is_active: true,
        listing_status: true,
        created_at: true,
        destination: { select: { name: true } },
        _count: { select: { hotelRooms: true } },
      },
    }),
  ]);

  return {
    mine: {
      total: myTotal,
      active: myActive,
      inactive: myInactive,
      noRooms: myNoRooms,
      draft: myDraft,
      submitted: mySubmitted,
      underReview: myUnderReview,
      live: myLive,
      rejected: myRejected,
    },
    global: {
      total: globalTotal,
      live: globalLive,
      pendingReview: globalPendingReview,
    },
    mineThisWeek: myThisWeek,
    byCategory: byCategoryRaw.map((r) => ({
      category: r.category ?? "Uncategorized",
      count: r._count.id,
    })),
    recentHotels: recentRaw.map((h) => ({
      id: h.id,
      name: h.name,
      destination: h.destination?.name ?? "—",
      category: h.category,
      roomCount: h._count.hotelRooms,
      is_active: h.is_active,
      listingStatus: h.listing_status,
      created_at: h.created_at,
    })),
  };
}
