// app/api/user/payment-history/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { getAuthenticatedUser } from "@/app/lib/functions/getAuthenticatedUser";
import { PaymentStatus } from "@/app/generated/prisma";

export async function GET(req: NextRequest) {
  const sessionUser = await getAuthenticatedUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as PaymentStatus | null;
  const page   = parseInt(searchParams.get("page")  ?? "1");
  const limit  = parseInt(searchParams.get("limit") ?? "10");
  const skip   = (page - 1) * limit;

  if (status && !Object.values(PaymentStatus).includes(status)) {
    return NextResponse.json({ error: "Invalid status filter." }, { status: 400 });
  }

  const where = {
    userId: sessionUser.id,
    ...(status ? { status } : {}),
  };

  const [payments, total] = await Promise.all([
    db.payment.findMany({
      where,
      skip,
      take:    limit,
      orderBy: { createdAt: "desc" },
      select: {
        id:               true,
        amount:           true,
        currency:         true,
        status:           true,
        gateway:          true,
        method:           true,
        gatewayOrderId:   true,
        gatewayPaymentId: true,
        refundAmount:     true,
        refundedAt:       true,
        failureReason:    true,
        paidAt:           true,
        createdAt:        true,
        booking: {
          select: {
            id:            true,
            bookingNumber: true,
            startDate:     true,
            destination: {
              select: { name: true },
            },
          },
        },
      },
    }),
    db.payment.count({ where }),
  ]);

  // Summary stats
  const stats = await db.payment.aggregate({
    where:  { userId: sessionUser.id, status: "SUCCESS" },
    _sum:   { amount: true },
    _count: { id: true },
  });

  return NextResponse.json({
    payments,
    stats: {
      totalPaid:      stats._sum.amount  ?? 0,
      totalSuccessful:stats._count.id    ?? 0,
    },
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}