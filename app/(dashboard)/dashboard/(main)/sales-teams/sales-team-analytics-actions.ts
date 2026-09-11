// app/(dashboard)/dashboard/(main)/sales-teams/sales-team-analytics-actions.ts
import "server-only";
import { db } from "@/app/lib/db";
import { ACTIVE_PIPELINE_STATUSES } from "@/app/lib/queries/auto-assign";

const CONVERTED_STATUSES = ["CONVERTED", "PAYMENT_INITIATED"] as const;
import { istMonthBounds, istYearMonth } from "@/app/lib/ist-window";

export type MemberPerformance = {
  id: string;
  name: string;
  employeeId: string;
  confirmedThisMonth: number;
  totalRevenue: number;
  revenueTarget: number | null;
  conversionTarget: number | null;
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
  teamRevenueTarget: number | null;
  teamConversionTarget: number | null;
  teamQueriesThisMonth: number;
  teamConvertedThisMonth: number;
  teamConversionRate: number;
  teamPendingFollowUps: number;
};

export type SalesTeamAnalytics = {
  teams: TeamPerformance[];
  /** Sales-role staff not currently rostered onto any SalesTeam — real,
   * un-zeroed performance numbers, shown purely for awareness. The org
   * chart is Sales Manager → Team Leader → Sales Executive, so these
   * members report to nobody in that chain; they're deliberately excluded
   * from every figure in `companyTotals` below. */
  unassigned: MemberPerformance[];
  companyTotals: {
    confirmedThisMonth: number;
    totalRevenue: number;
    queriesThisMonth: number;
    convertedThisMonth: number;
    pendingFollowUps: number;
    /** Sum of every rostered team's own target — never a member sum inside
     * a team (a team's target is set independently of its roster's
     * individual ones, same rule the Sales Targets page uses), and never
     * counting `unassigned` members' own targets (see that field's doc).
     * Null when nobody has a target set at all, so callers can tell "0"
     * apart from "unset". */
    revenueTarget: number | null;
    conversionTarget: number | null;
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

  // Targets are keyed by calendar month, not an arbitrary range — a custom
  // date range still looks up whichever month it starts in, same as the
  // Sales Manager's set-targets page would for that range.
  const { year: targetYear, month: targetMonth } = istYearMonth(rangeStart);

  // Roster first, then the aggregations scoped to it — "company totals" here
  // used to mean "every assignedTo value on any query", which also swept in
  // partner agencies, other departments' stray assignees, and former execs'
  // old queries still sitting on their now-inactive id. A Sales Manager's
  // own numbers should only ever be the sales org's own roster.
  const [teams, unassignedRaw] = await Promise.all([
    db.salesTeam.findMany({
      include: {
        leader: { select: { id: true, name: true } },
        members: { select: { id: true, name: true, employeeId: true } },
      },
      orderBy: { name: "asc" },
    }),
    // Sales-role staff not yet placed on a team — same population
    // getSalesTargetsPageData treats as "unassigned", not just "anyone
    // active with no team" (that also caught non-sales staff in other
    // departments who happen to have salesTeamId null).
    db.teamMember.findMany({
      where: {
        salesTeamId: null,
        isActive: true,
        OR: [
          { teamRole: { name: { contains: "sales", mode: "insensitive" } } },
          { teamRole: { name: { contains: "team leader", mode: "insensitive" } } },
        ],
        // Excludes the Sales Manager herself — "sales" matches "Sales
        // Manager" too, and she shouldn't show up as one of her own
        // (unassigned) executives.
        NOT: { teamRole: { name: { contains: "manager", mode: "insensitive" } } },
      },
      select: { id: true, name: true, employeeId: true },
    }),
  ]);

  const salesOrgIds = [...teams.flatMap((t) => t.members.map((m) => m.id)), ...unassignedRaw.map((m) => m.id)];

  const [bookingsGrouped, queriesGrouped, convertedGrouped, pendingGrouped, memberTargets, teamTargets] = await Promise.all([
    db.booking.groupBy({
      by: ["currentAssigneeId"],
      where: {
        status: "CONFIRMED",
        createdAt: { gte: rangeStart, lte: rangeEnd },
        currentAssigneeId: { in: salesOrgIds },
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
        assignedTo: { in: salesOrgIds },
      },
      _count: { _all: true },
    }),
    db.package_queries.groupBy({
      by: ["assignedTo"],
      where: {
        deletedAt: null,
        assignedAt: { gte: rangeStart, lte: rangeEnd },
        assignedTo: { in: salesOrgIds },
        status: { in: [...CONVERTED_STATUSES] },
      },
      _count: { _all: true },
    }),
    db.package_queries.groupBy({
      by: ["assignedTo"],
      where: {
        deletedAt: null,
        assignedTo: { in: salesOrgIds },
        status: { in: [...ACTIVE_PIPELINE_STATUSES] },
      },
      _count: { _all: true },
    }),
    db.salesTarget.findMany({ where: { year: targetYear, month: targetMonth, teamMemberId: { not: null } } }),
    db.salesTarget.findMany({ where: { year: targetYear, month: targetMonth, salesTeamId: { not: null } } }),
  ]);

  const byBookingMember = new Map(bookingsGrouped.map((g) => [g.currentAssigneeId as string, g]));
  const byQueriesMember = new Map(queriesGrouped.map((g) => [g.assignedTo as string, g._count._all]));
  const byConvertedMember = new Map(convertedGrouped.map((g) => [g.assignedTo as string, g._count._all]));
  const byPendingMember = new Map(pendingGrouped.map((g) => [g.assignedTo as string, g._count._all]));
  const byMemberTarget = new Map(memberTargets.map((t) => [t.teamMemberId as string, t]));
  const byTeamTarget = new Map(teamTargets.map((t) => [t.salesTeamId as string, t]));

  const toPerf = (m: { id: string; name: string; employeeId: string }): MemberPerformance => {
    const booking = byBookingMember.get(m.id);
    const queriesThisMonth = byQueriesMember.get(m.id) ?? 0;
    const convertedThisMonth = byConvertedMember.get(m.id) ?? 0;
    const target = byMemberTarget.get(m.id);
    return {
      id: m.id,
      name: m.name,
      employeeId: m.employeeId,
      confirmedThisMonth: booking?._count._all ?? 0,
      totalRevenue: Number(booking?._sum.totalAmount ?? 0),
      revenueTarget: target?.revenueTarget ?? null,
      conversionTarget: target?.conversionTarget ?? null,
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
    const teamTarget = byTeamTarget.get(t.id);
    return {
      teamId: t.id,
      teamName: t.name,
      leader: t.leader,
      members,
      teamConfirmedThisMonth: members.reduce((s, m) => s + m.confirmedThisMonth, 0),
      teamTotalRevenue: members.reduce((s, m) => s + m.totalRevenue, 0),
      teamRevenueTarget: teamTarget?.revenueTarget ?? null,
      teamConversionTarget: teamTarget?.conversionTarget ?? null,
      teamQueriesThisMonth,
      teamConvertedThisMonth,
      teamConversionRate: teamQueriesThisMonth > 0 ? Math.round((teamConvertedThisMonth / teamQueriesThisMonth) * 100) : 0,
      teamPendingFollowUps: members.reduce((s, m) => s + m.pendingFollowUps, 0),
    };
  });

  // Informational only — real numbers (not zeroed out, since the aggregation
  // queries above are scoped to salesOrgIds which includes them), but never
  // folded into companyTotals below: the org chart is Sales Manager → Team
  // Leader → Sales Executive, and someone on no team reports to nobody in
  // that chain.
  const unassigned = unassignedRaw.map(toPerf);

  // Sum of the ROSTERED teams only — see the comment above.
  const companyTotals = {
    confirmedThisMonth: teamPerf.reduce((s, t) => s + t.teamConfirmedThisMonth, 0),
    totalRevenue: teamPerf.reduce((s, t) => s + t.teamTotalRevenue, 0),
    queriesThisMonth: teamPerf.reduce((s, t) => s + t.teamQueriesThisMonth, 0),
    convertedThisMonth: teamPerf.reduce((s, t) => s + t.teamConvertedThisMonth, 0),
    pendingFollowUps: teamPerf.reduce((s, t) => s + t.teamPendingFollowUps, 0),
    revenueTarget: (() => {
      const set = teamPerf.map((t) => t.teamRevenueTarget).filter((v): v is number => v !== null);
      return set.length > 0 ? set.reduce((a, b) => a + b, 0) : null;
    })(),
    conversionTarget: (() => {
      const set = teamPerf.map((t) => t.teamConversionTarget).filter((v): v is number => v !== null);
      return set.length > 0 ? set.reduce((a, b) => a + b, 0) : null;
    })(),
  };

  return { teams: teamPerf, unassigned, companyTotals };
}
