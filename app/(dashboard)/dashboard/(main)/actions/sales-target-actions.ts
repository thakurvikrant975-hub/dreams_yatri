// app/(dashboard)/dashboard/(main)/actions/sales-target-actions.ts
import "server-only";
import { db } from "@/app/lib/db";

export interface SalesTargetData {
  confirmedThisMonth: number;
  monthlyTarget: number;
  totalRevenue: number; // sum of totalAmount for confirmed bookings this month
}

export async function getSalesTargetData(memberId: string): Promise<SalesTargetData> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const [confirmedCount, revenueResult] = await Promise.all([
    // Count bookings confirmed this month where this member is the assignee
    db.booking.count({
      where: {
        currentAssigneeId: memberId,
        status: "CONFIRMED",
        createdAt: { gte: monthStart, lte: monthEnd },
      },
    }),

    // Sum revenue for those bookings
    db.booking.aggregate({
      where: {
        currentAssigneeId: memberId,
        status: "CONFIRMED",
        createdAt: { gte: monthStart, lte: monthEnd },
      },
      _sum: { totalAmount: true },
    }),
  ]);

  return {
    confirmedThisMonth: confirmedCount,
    monthlyTarget: 20, // replace with DB lookup when SalesTarget model exists
    totalRevenue: Number(revenueResult._sum.totalAmount ?? 0),
  };
}