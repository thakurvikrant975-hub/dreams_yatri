// app/api/user/payment-history/route.ts

import { NextRequest }          from "next/server";
import { z }                    from "zod/v4";
import { db }                   from "@/app/lib/db";
import { ApiResponse }          from "@/app/lib/api-response";
import { handleApiError }       from "@/app/lib/api-error";
import { getAuthenticatedUser } from "@/app/lib/functions/getAuthenticatedUser";
import { PaymentStatus }        from "@/app/generated/prisma";

// ─── Zod Schema ───────────────────────────────────────────────────────────────

const querySchema = z.object({
  status: z.enum(Object.values(PaymentStatus) as [string, ...string[]]).optional(),
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(10),
});

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getAuthenticatedUser();
    if (!sessionUser) return ApiResponse.error("Unauthorized", "UNAUTHORIZED", 401);

    // ── Validate query params ────────────────────────────────────────────────
    const { searchParams } = new URL(req.url);

    const parsed = querySchema.safeParse({
      status: searchParams.get("status") ?? undefined,
      page:   searchParams.get("page")   ?? 1,
      limit:  searchParams.get("limit")  ?? 10,
    });

    if (!parsed.success) {
      return ApiResponse.badRequest(parsed.error.issues[0]?.message ?? "Invalid query params");
    }

    const { status, page, limit } = parsed.data;
    const skip = (page - 1) * limit;

    const where = {
      userId: sessionUser.id,
      ...(status ? { status: status as PaymentStatus } : {}),
    };

    // ── Query ────────────────────────────────────────────────────────────────
    const [payments, total, stats] = await Promise.all([
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
      db.payment.aggregate({
        where:  { userId: sessionUser.id, status: "SUCCESS" },
        _sum:   { amount: true },
        _count: { id: true },
      }),
    ]);

    return ApiResponse.ok(payments, {
      stats: {
        totalPaid:       stats._sum.amount ?? 0,
        totalSuccessful: stats._count.id   ?? 0,
      },
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (error) {
    return handleApiError(error);
  }
}