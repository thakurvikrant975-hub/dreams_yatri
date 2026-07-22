import "server-only";
import { db } from "@/app/lib/db";

const MAX_DAYS = 366;
const PAID_STATUSES = ["CONFIRMED", "COMPLETED", "ONGOING", "UPCOMING"] as const;

export interface GeneralAnalyticsData {
  totalBookings: number;
  totalRevenuePaise: number;
  avgBookingValuePaise: number;
  cancelledBookings: number;
  dailyTrend: { date: string; bookings: number; revenue: number }[];
  statusBreakdown: { name: string; value: number; color: string }[];
  topDestinations: { name: string; value: number; color: string }[];
}

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: "var(--color-dashboard-success)",
  COMPLETED: "var(--color-dashboard-success)",
  ONGOING: "var(--color-dashboard-info)",
  UPCOMING: "var(--color-dashboard-primary)",
  CANCELLED: "var(--color-dashboard-error)",
  REJECTED: "var(--color-dashboard-error)",
  PENDING_REVIEW: "var(--color-dashboard-warning)",
  HOTEL_VERIFICATION: "var(--color-dashboard-warning)",
  HOTEL_CONFIRMED: "var(--color-dashboard-warning)",
  CAB_VERIFICATION: "var(--color-dashboard-warning)",
  CAB_CONFIRMED: "var(--color-dashboard-warning)",
  OPS_REVIEW: "var(--color-dashboard-warning)",
  MODIFICATION_REQUESTED: "var(--color-dashboard-secondary)",
};

const DEST_PALETTE = [
  "var(--color-dashboard-primary)", "var(--color-dashboard-secondary)", "var(--color-dashboard-info)",
  "var(--color-dashboard-success)", "var(--color-dashboard-warning)", "#a78bfa", "#fb923c", "#f472b6",
];

function fmtDay(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(d);
}
function dayKey(d: Date): string {
  return d.toISOString().split("T")[0];
}
function titleCase(s: string): string {
  return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function getGeneralAnalytics(fromStr: string, toStr: string): Promise<GeneralAnalyticsData> {
  const from = new Date(`${fromStr}T00:00:00`);
  const to = new Date(`${toStr}T23:59:59.999`);

  const [bookings, statusGroups, destGroups] = await Promise.all([
    db.booking.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { totalAmount_paise: true, status: true, createdAt: true },
    }),
    db.booking.groupBy({
      by: ["status"],
      where: { createdAt: { gte: from, lte: to } },
      _count: { _all: true },
    }),
    db.booking.groupBy({
      by: ["destinationId"],
      where: { createdAt: { gte: from, lte: to } },
      _count: { _all: true },
      orderBy: { _count: { destinationId: "desc" } },
      take: 6,
    }),
  ]);

  // Hotel-only bookings have no destinationId (that catalog is a package-browsing
  // concept) — exclude them from the "top destinations" breakdown rather than
  // showing a meaningless "Destination #null" bucket.
  const destGroupsWithDest = destGroups.filter((g): g is typeof g & { destinationId: number } => g.destinationId != null);
  const destIds = destGroupsWithDest.map((g) => g.destinationId);
  const destNames = destIds.length > 0
    ? await db.destinations.findMany({ where: { id: { in: destIds } }, select: { id: true, name: true } })
    : [];
  const destNameMap = new Map(destNames.map((d) => [d.id, d.name]));

  const dayBuckets = new Map<string, { bookings: number; revenue: number }>();
  let totalRevenuePaise = 0;
  let cancelledBookings = 0;

  for (const b of bookings) {
    const key = dayKey(b.createdAt);
    const bucket = dayBuckets.get(key) ?? { bookings: 0, revenue: 0 };
    bucket.bookings += 1;
    if (PAID_STATUSES.includes(b.status as typeof PAID_STATUSES[number])) {
      bucket.revenue += b.totalAmount_paise;
      totalRevenuePaise += b.totalAmount_paise;
    }
    dayBuckets.set(key, bucket);
    if (b.status === "CANCELLED") cancelledBookings += 1;
  }

  const dailyTrend: GeneralAnalyticsData["dailyTrend"] = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  let guard = 0;
  while (cursor <= end && guard < MAX_DAYS) {
    const key = dayKey(cursor);
    const bucket = dayBuckets.get(key) ?? { bookings: 0, revenue: 0 };
    dailyTrend.push({ date: fmtDay(cursor), bookings: bucket.bookings, revenue: Math.round(bucket.revenue / 100) });
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }

  const statusBreakdown = statusGroups
    .map((g) => ({
      name: titleCase(g.status),
      value: g._count._all,
      color: STATUS_COLORS[g.status] ?? "var(--color-dashboard-neutral)",
    }))
    .sort((a, b) => b.value - a.value);

  const topDestinations = destGroupsWithDest.map((g, i) => ({
    name: destNameMap.get(g.destinationId) ?? `Destination #${g.destinationId}`,
    value: g._count._all,
    color: DEST_PALETTE[i % DEST_PALETTE.length],
  }));

  return {
    totalBookings: bookings.length,
    totalRevenuePaise,
    avgBookingValuePaise: bookings.length > 0 ? Math.round(totalRevenuePaise / bookings.length) : 0,
    cancelledBookings,
    dailyTrend,
    statusBreakdown,
    topDestinations,
  };
}
