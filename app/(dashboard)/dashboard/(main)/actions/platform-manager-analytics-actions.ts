import "server-only";
import { db } from "@/app/lib/db";

const INVENTORY_ROLE = "Inventory Manager"; // legacy — pre-dates the Hotel/Cab role split
const HOTEL_ROLE = "Hotel Department";
const CAB_ROLE = "Cab Department";
const TRAVEL_ROLE = "Travel Expert";
const TRACKED_ROLES = [INVENTORY_ROLE, HOTEL_ROLE, CAB_ROLE, TRAVEL_ROLE];
const MAX_DAYS = 366;

// Activity-log entity casing isn't consistent across action files (e.g. "Hotel"
// vs "destination"), so classification is case-insensitive. Inventory Manager
// is a legacy role with no department of its own — its members are split into
// Hotel / Cab purely by which entities they've touched. Members already on the
// explicit Hotel Department / Cab Department / Travel Expert roles are
// classified by role directly, regardless of which entity they touch.
const HOTEL_ENTITIES = new Set(["hotel"]);
const CAB_ENTITIES = new Set(["vehicle", "cabdriver", "cabpricing"]);
const TRAVEL_ENTITIES = new Set(["package", "activity", "destination", "region"]);

export type DepartmentKey = "hotel" | "cab" | "travel";

const DEPT_LABEL: Record<DepartmentKey, string> = {
  hotel: "Hotel Department",
  cab: "Cab Department",
  travel: "Travel Expert",
};
const DEPT_COLOR: Record<DepartmentKey, string> = {
  hotel: "var(--color-dashboard-primary)",
  cab: "var(--color-dashboard-info)",
  travel: "var(--color-dashboard-secondary)",
};

function classifyEntity(entity: string): DepartmentKey | "other" {
  const key = entity.toLowerCase();
  if (HOTEL_ENTITIES.has(key)) return "hotel";
  if (CAB_ENTITIES.has(key)) return "cab";
  if (TRAVEL_ENTITIES.has(key)) return "travel";
  return "other";
}

// Resolve the department an activity-log entry belongs to: explicit roles win
// outright, the legacy Inventory Manager role falls back to entity inference.
function classifyEntry(userRole: string | null, entity: string): DepartmentKey | "other" {
  if (userRole === HOTEL_ROLE) return "hotel";
  if (userRole === CAB_ROLE) return "cab";
  if (userRole === TRAVEL_ROLE) return "travel";
  if (userRole === INVENTORY_ROLE) return classifyEntity(entity);
  return "other";
}

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
  departmentLabel: string;
  departmentKeys: DepartmentKey[];
  total: number;
  create: number;
  update: number;
  delete: number;
  hotelActions: number;
  cabActions: number;
  entries: EmployeeWorkEntry[];
};

export type DepartmentSummary = {
  key: DepartmentKey;
  label: string;
  color: string;
  totalActions: number;
  activeEmployees: number;
  totalEmployees: number;
  topEmployee: { name: string; count: number } | null;
};

export interface PlatformManagerAnalyticsData {
  totalActions: number;
  activeEmployees: number;
  totalEmployees: number;
  busiestDay: { date: string; count: number } | null;
  topEmployee: { name: string; count: number } | null;
  departments: DepartmentSummary[];
  workReport: EmployeeWork[];
  dailyTrend: { date: string; "Hotel Department": number; "Cab Department": number; "Travel Expert": number }[];
  entityBreakdown: { name: string; value: number; color: string }[];
  actionBreakdown: { name: string; value: number; color: string }[];
  departmentBreakdown: { name: string; value: number; color: string }[];
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

function buildDeptSummary(
  key: DepartmentKey,
  pool: EmployeeWork[],
  metric: (e: EmployeeWork) => number,
): DepartmentSummary {
  const totalActions = pool.reduce((sum, e) => sum + metric(e), 0);
  const activeEmployees = pool.filter((e) => metric(e) > 0).length;
  const top = [...pool].sort((a, b) => metric(b) - metric(a))[0];
  return {
    key,
    label: DEPT_LABEL[key],
    color: DEPT_COLOR[key],
    totalActions,
    activeEmployees,
    totalEmployees: pool.length,
    topEmployee: top && metric(top) > 0 ? { name: top.name, count: metric(top) } : null,
  };
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
        id: true, userId: true, userName: true, userRole: true, action: true,
        entity: true, entitySlug: true, description: true, actionAt: true,
      },
    }),
  ]);

  // Seed from roster so employees with zero actions in range still show up.
  // Keyed by team member ID (not name) — two members can share a display name.
  const byEmployee = new Map<string, EmployeeWork>();
  for (const m of roster) {
    byEmployee.set(m.id, {
      id: m.id, name: m.name, role: m.teamRole?.name ?? "—",
      departmentLabel: "—", departmentKeys: [],
      total: 0, create: 0, update: 0, delete: 0,
      hotelActions: 0, cabActions: 0, entries: [],
    });
  }

  const dayBuckets = new Map<string, { "Hotel Department": number; "Cab Department": number; "Travel Expert": number }>();
  const entityCounts = new Map<string, number>();
  const actionCounts = new Map<string, number>();

  for (const log of logs) {
    // userId is the reliable join key; fall back to name only for legacy log
    // rows written before userId was tracked on every entry.
    const empKey = log.userId ?? log.userName ?? "unknown";
    const name = log.userName ?? "Unknown";
    let emp = byEmployee.get(empKey);
    if (!emp) {
      emp = {
        id: empKey, name, role: log.userRole ?? "—",
        departmentLabel: "—", departmentKeys: [],
        total: 0, create: 0, update: 0, delete: 0,
        hotelActions: 0, cabActions: 0, entries: [],
      };
      byEmployee.set(empKey, emp);
    }
    emp.total += 1;
    if (log.action === "CREATE") emp.create += 1;
    else if (log.action === "UPDATE") emp.update += 1;
    else if (log.action === "DELETE") emp.delete += 1;
    emp.entries.push({
      id: log.id, entity: log.entity, action: log.action,
      entitySlug: log.entitySlug, description: log.description, actionAt: log.actionAt,
    });

    const dept = classifyEntry(log.userRole, log.entity);
    if (dept === "hotel") emp.hotelActions += 1;
    else if (dept === "cab") emp.cabActions += 1;

    const key = dayKey(log.actionAt);
    const bucket = dayBuckets.get(key) ?? { "Hotel Department": 0, "Cab Department": 0, "Travel Expert": 0 };
    if (dept === "hotel") bucket["Hotel Department"] += 1;
    else if (dept === "cab") bucket["Cab Department"] += 1;
    else if (dept === "travel") bucket["Travel Expert"] += 1;
    dayBuckets.set(key, bucket);

    entityCounts.set(log.entity, (entityCounts.get(log.entity) ?? 0) + 1);
    actionCounts.set(log.action, (actionCounts.get(log.action) ?? 0) + 1);
  }

  for (const emp of byEmployee.values()) {
    emp.entries.sort((a, b) => b.actionAt.getTime() - a.actionAt.getTime());

    if (emp.role === TRAVEL_ROLE) {
      emp.departmentLabel = "Travel Expert";
      emp.departmentKeys = ["travel"];
    } else if (emp.role === HOTEL_ROLE) {
      emp.departmentLabel = "Hotel Department";
      emp.departmentKeys = ["hotel"];
    } else if (emp.role === CAB_ROLE) {
      emp.departmentLabel = "Cab Department";
      emp.departmentKeys = ["cab"];
    } else {
      // Legacy Inventory Manager — classify by what they've actually touched.
      const hasHotel = emp.hotelActions > 0;
      const hasCab = emp.cabActions > 0;
      if (hasHotel && hasCab) {
        emp.departmentLabel = "Hotel & Cab";
        emp.departmentKeys = ["hotel", "cab"];
      } else if (hasHotel) {
        emp.departmentLabel = "Hotel Department";
        emp.departmentKeys = ["hotel"];
      } else if (hasCab) {
        emp.departmentLabel = "Cab Department";
        emp.departmentKeys = ["cab"];
      } else {
        // No activity in range yet — show under both pools until classified.
        emp.departmentLabel = "Hotel & Cab";
        emp.departmentKeys = ["hotel", "cab"];
      }
    }
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
    const bucket = dayBuckets.get(key) ?? { "Hotel Department": 0, "Cab Department": 0, "Travel Expert": 0 };
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
      color: e.role === TRAVEL_ROLE
        ? DEPT_COLOR.travel
        : e.hotelActions >= e.cabActions ? DEPT_COLOR.hotel : DEPT_COLOR.cab,
    }));

  const hotelPool = workReport.filter((e) => e.departmentKeys.includes("hotel"));
  const cabPool = workReport.filter((e) => e.departmentKeys.includes("cab"));
  const travelPool = workReport.filter((e) => e.role === TRAVEL_ROLE);

  const departments: DepartmentSummary[] = [
    buildDeptSummary("hotel", hotelPool, (e) => (e.role === HOTEL_ROLE ? e.total : e.hotelActions)),
    buildDeptSummary("cab", cabPool, (e) => (e.role === CAB_ROLE ? e.total : e.cabActions)),
    buildDeptSummary("travel", travelPool, (e) => e.total),
  ];

  const departmentBreakdown = departments
    .map((d) => ({ name: d.label, value: d.totalActions, color: d.color }))
    .filter((d) => d.value > 0);

  let busiestDay: PlatformManagerAnalyticsData["busiestDay"] = null;
  for (const d of dailyTrend) {
    const count = d["Hotel Department"] + d["Cab Department"] + d["Travel Expert"];
    if (count > 0 && (!busiestDay || count > busiestDay.count)) busiestDay = { date: d.date, count };
  }

  const topEmployee = leaderboard[0] ? { name: leaderboard[0].name, count: leaderboard[0].value } : null;

  return {
    totalActions: logs.length,
    activeEmployees: workReport.filter((e) => e.total > 0).length,
    totalEmployees: roster.length,
    busiestDay,
    topEmployee,
    departments,
    workReport,
    dailyTrend,
    entityBreakdown,
    actionBreakdown,
    departmentBreakdown,
    leaderboard,
  };
}
