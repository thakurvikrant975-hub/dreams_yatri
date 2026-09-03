// app/(dashboard)/dashboard/(main)/sales-teams/sales-team-analytics-actions.ts
import "server-only";
import { db } from "@/app/lib/db";
import { ACTIVE_PIPELINE_STATUSES } from "@/app/lib/queries/auto-assign";

// Same monthly target hardcode as actions/sales-target-actions.ts — replace
// with a DB lookup when a SalesTarget model exists.
const MONTHLY_TARGET = 20;
const CONVERTED_STATUSES = ["CONVERTED", "PAYMENT_INITIATED"] as const;
import { istMonthBounds } from "@/app/lib/ist-window";

export type MemberPerformance = {
  id: string;
  name: string;
  employeeId: string;
  confirmedThisMonth: number;
  totalRevenue: number;
  monthlyTarget: number;
  queriesThisMonth: number;
  convertedThisMonth: number;
  conversionRate: number; // 0-100, rounded
  pendingFollowUps: number; // current backlog, not month-scoped
};

export type TeamPerformance = {
  teamId: string;
  teamName: string;
  leader: { id: string; name: string } | null;
  members: MemberPerformance[];
  teamConfirmedThisMonth: number;
  teamTotalRevenue: number;
  teamQueriesThisMonth: number;
  teamConvertedThisMonth: number;
  teamConversionRate: number;
  teamPendingFollowUps: number;
};

export type SalesTeamAnalytics = {
  teams: TeamPerformance[];
  unassigned: MemberPerformance[];
  companyTotals: {
    confirmedThisMonth: number;
    totalRevenue: number;
    queriesThisMonth: number;
    convertedThisMonth: number;
    pendingFollowUps: number;
  };
};

/** `fromStr`/`toStr` (YYYY-MM-DD) override the default "current calendar
 * month" window for the three date-scoped metrics below — lets a caller
 * (e.g. the Team Leader analytics view's leaderboard) reuse this same
 * company-wide ranking for whatever range its date picker is set to. The
 * `...ThisMonth` field names stay as-is even when a custom range is passed,
 * to avoid a churny rename across every existing consumer. */
export async function getSalesTeamAnalytics(fromStr?: string, toStr?: string): Promise<SalesTeamAnalytics> {
  const now = new Date();
  // The default window is this month in IST, not in the server's UTC month.
  const { start: monthStart, end: monthEnd } = istMonthBounds(now);

  // IST wall-clock dates from the picker, on a UTC server — without the
  // offset the window slides by 5½ hours and drops the night's leads.
  const rangeStart = fromStr ? new Date(`${fromStr}T00:00:00+05:30`) : monthStart;
  const rangeEnd   = toStr   ? new Date(`${toStr}T23:59:59.999+05:30`) : monthEnd;

  const [teams, bookingsGrouped, queriesGrouped, convertedGrouped, pendingGrouped, unassignedRaw] = await Promise.all([
    db.salesTeam.findMany({
      include: {
        leader: { select: { id: true, name: true } },
        members: { select: { id: true, name: true, employeeId: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.booking.groupBy({
      by: ["currentAssigneeId"],
      where: {
        status: "CONFIRMED",
        createdAt: { gte: rangeStart, lte: rangeEnd },
        currentAssigneeId: { not: null },
      },
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    db.package_queries.groupBy({
      by: ["assignedTo"],
      where: {
        deletedAt: null,
        // When the exec got it, not when it arrived — see the note in
        // team-leader-analytics-actions. A lead that came in overnight and
        // was handed over in the morning belongs to the morning.
        assignedAt: { gte: rangeStart, lte: rangeEnd },
        assignedTo: { not: null },
      },
      _count: { _all: true },
    }),
    db.package_queries.groupBy({
      by: ["assignedTo"],
      where: {
        deletedAt: null,
        assignedAt: { gte: rangeStart, lte: rangeEnd },
        assignedTo: { not: null },
        status: { in: [...CONVERTED_STATUSES] },
      },
      _count: { _all: true },
    }),
    db.package_queries.groupBy({
      by: ["assignedTo"],
      where: {
        deletedAt: null,
        assignedTo: { not: null },
        status: { in: [...ACTIVE_PIPELINE_STATUSES] },
      },
      _count: { _all: true },
    }),
    db.teamMember.findMany({
      where: { salesTeamId: null, isActive: true },
      select: { id: true, name: true, employeeId: true },
    }),
  ]);

  const byBookingMember = new Map(bookingsGrouped.map((g) => [g.currentAssigneeId as string, g]));
  const byQueriesMember = new Map(queriesGrouped.map((g) => [g.assignedTo as string, g._count._all]));
  const byConvertedMember = new Map(convertedGrouped.map((g) => [g.assignedTo as string, g._count._all]));
  const byPendingMember = new Map(pendingGrouped.map((g) => [g.assignedTo as string, g._count._all]));

  const toPerf = (m: { id: string; name: string; employeeId: string }): MemberPerformance => {
    const booking = byBookingMember.get(m.id);
    const queriesThisMonth = byQueriesMember.get(m.id) ?? 0;
    const convertedThisMonth = byConvertedMember.get(m.id) ?? 0;
    return {
      id: m.id,
      name: m.name,
      employeeId: m.employeeId,
      confirmedThisMonth: booking?._count._all ?? 0,
      totalRevenue: Number(booking?._sum.totalAmount ?? 0),
      monthlyTarget: MONTHLY_TARGET,
      queriesThisMonth,
      convertedThisMonth,
      conversionRate: queriesThisMonth > 0 ? Math.round((convertedThisMonth / queriesThisMonth) * 100) : 0,
      pendingFollowUps: byPendingMember.get(m.id) ?? 0,
    };
  };

  const teamPerf: TeamPerformance[] = teams.map((t) => {
    const members = t.members.map(toPerf);
    const teamQueriesThisMonth = members.reduce((s, m) => s + m.queriesThisMonth, 0);
    const teamConvertedThisMonth = members.reduce((s, m) => s + m.convertedThisMonth, 0);
    return {
      teamId: t.id,
      teamName: t.name,
      leader: t.leader,
      members,
      teamConfirmedThisMonth: members.reduce((s, m) => s + m.confirmedThisMonth, 0),
      teamTotalRevenue: members.reduce((s, m) => s + m.totalRevenue, 0),
      teamQueriesThisMonth,
      teamConvertedThisMonth,
      teamConversionRate: teamQueriesThisMonth > 0 ? Math.round((teamConvertedThisMonth / teamQueriesThisMonth) * 100) : 0,
      teamPendingFollowUps: members.reduce((s, m) => s + m.pendingFollowUps, 0),
    };
  });

  const unassigned = unassignedRaw.map(toPerf);

  const totalQueriesThisMonth = [...byQueriesMember.values()].reduce((s, v) => s + v, 0);
  const totalConvertedThisMonth = [...byConvertedMember.values()].reduce((s, v) => s + v, 0);

  const companyTotals = {
    confirmedThisMonth: [...byBookingMember.values()].reduce((s, g) => s + g._count._all, 0),
    totalRevenue: [...byBookingMember.values()].reduce((s, g) => s + Number(g._sum.totalAmount ?? 0), 0),
    queriesThisMonth: totalQueriesThisMonth,
    convertedThisMonth: totalConvertedThisMonth,
    pendingFollowUps: [...byPendingMember.values()].reduce((s, v) => s + v, 0),
  };

  return { teams: teamPerf, unassigned, companyTotals };
}
