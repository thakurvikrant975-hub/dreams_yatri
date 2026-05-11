"use server";

import { db } from "@/app/lib/db";
import { $Enums } from "@/app/generated/prisma";

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
  const now = new Date();

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1);
  weekStart.setHours(0, 0, 0, 0);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

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
      where: { assignedTo: memberId },
    }),

    db.package_queries.count({
      where: {
        assignedTo: memberId,
        assignedAt: { gte: weekStart },
      },
    }),

    db.package_queries.count({
      where: {
        assignedTo: memberId,
        nextFollowUpAt: { gte: todayStart, lte: todayEnd },
      },
    }),

    db.package_queries.count({
      where: {
        assignedTo: memberId,
        nextFollowUpAt: { lt: todayStart },
        status: { in: openStatuses },
      },
    }),

db.package_queries.count({
  where: {
    assignedTo: memberId,
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
      where: { assignedTo: memberId },
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