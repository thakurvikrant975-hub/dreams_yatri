import "server-only";
import { db } from "@/app/lib/db";

const HOTEL_ROLE = "Hotel Department";
const INVENTORY_ROLE = "Inventory Manager"; // legacy — pre-dates the Hotel/Cab role split
const MAX_DAYS = 366;

export type HotelDepartmentAnalyticsData = {
  totalAdded: number;
  activeAdded: number;
  inactiveAdded: number;
  dailyTrend: { date: string; added: number }[];
  byMember: { name: string; count: number }[];
};

function fmtDay(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(d);
}
function dayKey(d: Date): string {
  return d.toISOString().split("T")[0];
}

/**
 * "Hotels added by this department", scoped server-side to whoever is
 * actually calling — every other Analytics section takes an already-trusted
 * `member` (resolved via `getEffectiveMember()` in the page), so the same
 * pattern is followed here rather than re-deriving auth from a passed id.
 */
export async function getHotelDepartmentAnalytics(
  fromStr: string,
  toStr: string,
): Promise<HotelDepartmentAnalyticsData> {
  const from = new Date(`${fromStr}T00:00:00`);
  const to = new Date(`${toStr}T23:59:59.999`);

  // Legacy Inventory Manager members are only counted if they've actually
  // added a hotel (their role alone doesn't imply department) — the activity
  // log's entity is checked per-entry below rather than filtered in the
  // roster query.
  const logs = await db.activityLog.findMany({
    where: {
      entity: { equals: "Hotel", mode: "insensitive" },
      action: "CREATE",
      userRole: { in: [HOTEL_ROLE, INVENTORY_ROLE] },
      actionAt: { gte: from, lte: to },
    },
    orderBy: { actionAt: "desc" },
    select: { userId: true, userName: true, entityId: true, actionAt: true },
  });

  // Cross-reference against current hotel is_active state — the log doesn't
  // capture status, only creation.
  const hotelIds = logs.map((l) => l.entityId).filter((id): id is string => !!id).map(Number).filter((n) => Number.isFinite(n));
  const hotels = hotelIds.length > 0
    ? await db.hotels.findMany({ where: { id: { in: hotelIds } }, select: { id: true, is_active: true } })
    : [];
  const activeById = new Map(hotels.map((h) => [h.id, h.is_active]));

  const totalAdded = logs.length;
  const activeAdded = logs.filter((l) => l.entityId != null && activeById.get(Number(l.entityId)) === true).length;
  const inactiveAdded = totalAdded - activeAdded;

  const dayBuckets = new Map<string, number>();
  const byMemberMap = new Map<string, number>();
  for (const log of logs) {
    const key = dayKey(log.actionAt);
    dayBuckets.set(key, (dayBuckets.get(key) ?? 0) + 1);
    const name = log.userName ?? "Unknown";
    byMemberMap.set(name, (byMemberMap.get(name) ?? 0) + 1);
  }

  const dailyTrend: HotelDepartmentAnalyticsData["dailyTrend"] = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  let guard = 0;
  while (cursor <= end && guard < MAX_DAYS) {
    const key = dayKey(cursor);
    dailyTrend.push({ date: fmtDay(cursor), added: dayBuckets.get(key) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }

  const byMember = [...byMemberMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return { totalAdded, activeAdded, inactiveAdded, dailyTrend, byMember };
}
