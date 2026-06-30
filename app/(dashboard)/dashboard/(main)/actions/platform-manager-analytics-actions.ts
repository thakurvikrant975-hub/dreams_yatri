import "server-only";
import { db } from "@/app/lib/db";

const INVENTORY_ROLE = "Inventory Manager";
const TRAVEL_ROLE = "Travel Expert";
const TRACKED_ROLES = [INVENTORY_ROLE, TRAVEL_ROLE];
const MAX_DAYS = 366;

export type EmployeeWorkEntry = {
  id: string;
  entity: string;
  action: string;
  entitySlug: string | null;
  description: string | null;
  actionAt: Date;
};

export type EmployeeWork = {
  id: string;
  name: string;
  role: string;
  total: number;
  create: number;
  update: number;
  delete: number;
  entries: EmployeeWorkEntry[];
};

export interface PlatformManagerAnalyticsData {
  totalActions: number;
  activeEmployees: number;
  totalEmployees: number;
  busiestDay: { date: string; count: number } | null;
  topEmployee: { name: string; count: number } | null;
  workReport: EmployeeWork[];
  dailyTrend: { date: string; "Inventory Manager": number; "Travel Expert": number }[];
  entityBreakdown: { name: string; value: number; color: string }[];
  actionBreakdown: { name: string; value: number; color: string }[];
  leaderboard: { name: string; value: number; color: string }[];
}

const ENTITY_COLORS: Record<string, string> = {
  Hotel: "var(--color-dashboard-primary)",
  CabPricing: "var(--color-dashboard-info)",
  Vehicle: "var(--color-dashboard-secondary)",
  CabDriver: "var(--color-dashboard-warning)",
  Activity: "var(--color-dashboard-success)",
  Package: "var(--color-dashboard-error)",
  Destination: "#a78bfa",
  Region: "#fb923c",
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: "var(--color-dashboard-success)",
  UPDATE: "var(--color-dashboard-info)",
  DELETE: "var(--color-dashboard-error)",
};

function fmtDay(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(d);
}
function dayKey(d: Date): string {
  return d.toISOString().split("T")[0];
}

export async function getPlatformManagerAnalytics(
  fromStr: string,
  toStr: string,
): Promise<PlatformManagerAnalyticsData> {
  const from = new Date(`${fromStr}T00:00:00`);
  const to = new Date(`${toStr}T23:59:59.999`);

  const [roster, logs] = await Promise.all([
    db.teamMember.findMany({
      where: { isActive: true, teamRole: { name: { in: TRACKED_ROLES } } },
      select: { id: true, name: true, teamRole: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    db.activityLog.findMany({
      where: { userRole: { in: TRACKED_ROLES }, actionAt: { gte: from, lte: to } },
      orderBy: { actionAt: "desc" },
      select: {
        id: true, userName: true, userRole: true, action: true,
        entity: true, entitySlug: true, description: true, actionAt: true,
      },
    }),
  ]);

  // Seed from roster so employees with zero actions in range still show up.
  const byEmployee = new Map<string, EmployeeWork>();
  for (const m of roster) {
    byEmployee.set(m.name, {
      id: m.id, name: m.name, role: m.teamRole?.name ?? "—",
      total: 0, create: 0, update: 0, delete: 0, entries: [],
    });
  }

  const dayBuckets = new Map<string, { "Inventory Manager": number; "Travel Expert": number }>();
  const entityCounts = new Map<string, number>();
  const actionCounts = new Map<string, number>();

  for (const log of logs) {
    const name = log.userName ?? "Unknown";
    let emp = byEmployee.get(name);
    if (!emp) {
      emp = { id: name, name, role: log.userRole ?? "—", total: 0, create: 0, update: 0, delete: 0, entries: [] };
      byEmployee.set(name, emp);
    }
    emp.total += 1;
    if (log.action === "CREATE") emp.create += 1;
    else if (log.action === "UPDATE") emp.update += 1;
    else if (log.action === "DELETE") emp.delete += 1;
    emp.entries.push({
      id: log.id, entity: log.entity, action: log.action,
      entitySlug: log.entitySlug, description: log.description, actionAt: log.actionAt,
    });

    const key = dayKey(log.actionAt);
    const bucket = dayBuckets.get(key) ?? { "Inventory Manager": 0, "Travel Expert": 0 };
    if (log.userRole === INVENTORY_ROLE) bucket["Inventory Manager"] += 1;
    else if (log.userRole === TRAVEL_ROLE) bucket["Travel Expert"] += 1;
    dayBuckets.set(key, bucket);

    entityCounts.set(log.entity, (entityCounts.get(log.entity) ?? 0) + 1);
    actionCounts.set(log.action, (actionCounts.get(log.action) ?? 0) + 1);
  }

  for (const emp of byEmployee.values()) {
    emp.entries.sort((a, b) => b.actionAt.getTime() - a.actionAt.getTime());
  }

  const workReport = [...byEmployee.values()].sort(
    (a, b) => b.total - a.total || a.name.localeCompare(b.name),
  );

  // Daily trend — fill every day in range (including zero-activity days), capped to avoid runaway loops.
  const dailyTrend: PlatformManagerAnalyticsData["dailyTrend"] = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  let guard = 0;
  while (cursor <= end && guard < MAX_DAYS) {
    const key = dayKey(cursor);
    const bucket = dayBuckets.get(key) ?? { "Inventory Manager": 0, "Travel Expert": 0 };
    dailyTrend.push({ date: fmtDay(cursor), ...bucket });
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }

  const entityBreakdown = [...entityCounts.entries()]
    .map(([name, value]) => ({ name, value, color: ENTITY_COLORS[name] ?? "var(--color-dashboard-neutral)" }))
    .sort((a, b) => b.value - a.value);

  const actionBreakdown = [...actionCounts.entries()]
    .map(([name, value]) => ({ name, value, color: ACTION_COLORS[name] ?? "var(--color-dashboard-neutral)" }))
    .sort((a, b) => b.value - a.value);

  const leaderboard = workReport
    .filter((e) => e.total > 0)
    .map((e) => ({
      name: e.name,
      value: e.total,
      color: e.role === INVENTORY_ROLE ? "var(--color-dashboard-primary)" : "var(--color-dashboard-secondary)",
    }));

  let busiestDay: PlatformManagerAnalyticsData["busiestDay"] = null;
  for (const d of dailyTrend) {
    const count = d["Inventory Manager"] + d["Travel Expert"];
    if (count > 0 && (!busiestDay || count > busiestDay.count)) busiestDay = { date: d.date, count };
  }

  const topEmployee = leaderboard[0] ? { name: leaderboard[0].name, count: leaderboard[0].value } : null;

  return {
    totalActions: logs.length,
    activeEmployees: workReport.filter((e) => e.total > 0).length,
    totalEmployees: roster.length,
    busiestDay,
    topEmployee,
    workReport,
    dailyTrend,
    entityBreakdown,
    actionBreakdown,
    leaderboard,
  };
}
