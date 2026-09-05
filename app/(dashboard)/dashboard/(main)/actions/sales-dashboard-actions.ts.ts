// dashboard/actoins/sales-dashboard-actions.ts

"use server";

import { db } from "@/app/lib/db";
import { $Enums } from "@/app/generated/prisma";
import { istDayBounds, istMonthBounds, istWeekStart, istYearMonth } from "@/app/lib/ist-window";

export interface SalesDashboardData {
  assignedTotal: number;
  newThisWeek: number;
  followUpsDueToday: number;
  followUpsOverdue: number;
  confirmedThisMonth: number;
  totalRevenue: number;
  /** Null when the Sales Manager hasn't set a target for this member yet
   * this month — distinct from a target of zero. */
  monthlyTarget: number | null;
  revenueTarget: number | null;
  recentQueries: {
    id: string;
    name: string;
    destination: string | null;
    status: string;
    assignedAt: Date | null;
    nextFollowUpAt: Date | null;
    travelDate: Date | null;
  }[];
  todayFollowUps: {
    id: string;
    name: string;
    phone: string;
    destination: string | null;
    nextFollowUpAt: Date | null;
    status: string;
  }[];
}

export async function getSalesDashboardData(
  memberId: string
): Promise<SalesDashboardData> { 
  /*
   * IST, not the server's clock. setHours() on Vercel means UTC midnight —
   * half past five in the morning here — so every lead that arrived between
   * midnight and 5:30am counted as yesterday's, and an exec who came in to a
   * night's worth of landing-page leads saw a "today" that excluded them.
   */
  const now = new Date();
  const { start: todayStart, end: todayEnd } = istDayBounds(now);
  const weekStart = istWeekStart(now);
  const { start: monthStart, end: monthEnd } = istMonthBounds(now);

  const openStatuses: $Enums.QueryStatus[] = [
    $Enums.QueryStatus.SUBMITTED,
    $Enums.QueryStatus.VERIFIED,
  ];

  const { year: targetYear, month: targetMonth } = istYearMonth(now);

  const [
    assignedTotal,
    newThisWeek,
    followUpsDueToday,
    followUpsOverdue,
    confirmedBookings,
    recentQueries,
    todayFollowUps,
    target,
  ] = await Promise.all([
    db.package_queries.count({
      where: { assignedTo: memberId, deletedAt: null },
    }),

    db.package_queries.count({
      where: {
        assignedTo: memberId,
        deletedAt: null,
        // Keyed on when the exec was handed it, not when it came in — a lead
        // that arrived last week and reached them on Monday is this week's
        // work.
        assignedAt: { gte: weekStart },
      },
    }),

    db.package_queries.count({
      where: {
        assignedTo: memberId,
        deletedAt: null,
        nextFollowUpAt: { gte: todayStart, lte: todayEnd },
      },
    }),

    db.package_queries.count({
      where: {
        assignedTo: memberId,
        deletedAt: null,
        nextFollowUpAt: { lt: todayStart },
        status: { in: openStatuses },
      },
    }),

    // Confirmed bookings this member closed this month — same definition
    // the Sales Manager's team analytics and the Targets page use, so this
    // number always means the same thing everywhere it's shown.
    db.booking.aggregate({
      where: {
        currentAssigneeId: memberId,
        status: "CONFIRMED",
        createdAt: { gte: monthStart, lte: monthEnd },
      },
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),

    db.package_queries.findMany({
      where: { assignedTo: memberId, deletedAt: null },
      orderBy: { assignedAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        destination: true,
        status: true,
        assignedAt: true,
        nextFollowUpAt: true,
        travelDate: true,
      },
    }),

    db.package_queries.findMany({
      where: {
        assignedTo: memberId,
        deletedAt: null,
        nextFollowUpAt: { gte: todayStart, lte: todayEnd },
      },
      orderBy: { nextFollowUpAt: "asc" },
      take: 10,
      select: {
        id: true,
        name: true,
        phone: true,
        destination: true,
        nextFollowUpAt: true,
        status: true,
      },
    }),

    db.salesTarget.findUnique({
      where: { teamMemberId_year_month: { teamMemberId: memberId, year: targetYear, month: targetMonth } },
    }),
  ]);

  return {
    assignedTotal,
    newThisWeek,
    followUpsDueToday,
    followUpsOverdue,
    confirmedThisMonth: confirmedBookings._count._all,
    totalRevenue: Number(confirmedBookings._sum.totalAmount ?? 0),
    monthlyTarget: target?.conversionTarget ?? null,
    revenueTarget: target?.revenueTarget ?? null,
    recentQueries,
    todayFollowUps,
  };
}