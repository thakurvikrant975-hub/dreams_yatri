// dashboard/actoins/sales-dashboard-actions.ts

"use server";

import { db } from "@/app/lib/db";
import { $Enums } from "@/app/generated/prisma";
import { istDayBounds, istMonthBounds, istWeekStart } from "@/app/lib/ist-window";

export interface SalesDashboardData {
  assignedTotal: number;
  newThisWeek: number;
  followUpsDueToday: number;
  followUpsOverdue: number;
  confirmedThisMonth: number;
  monthlyTarget: number;
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

  const [
    assignedTotal,
    newThisWeek,
    followUpsDueToday,
    followUpsOverdue,
    confirmedThisMonth,
    recentQueries,
    todayFollowUps,
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

db.package_queries.count({
  where: {
    assignedTo: memberId,
    deletedAt: null,
    status: {
      in: ["PAYMENT_INITIATED", "CONVERTED"],
    },
    verifiedAt: {
      gte: monthStart,
      lte: monthEnd,
    },
  },
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
  ]);

  return {
    assignedTotal,
    newThisWeek,
    followUpsDueToday,
    followUpsOverdue,
    confirmedThisMonth,
    monthlyTarget: 20,
    recentQueries,
    todayFollowUps,
  };
}