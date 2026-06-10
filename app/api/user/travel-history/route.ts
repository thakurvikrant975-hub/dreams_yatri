// app/api/user/travel-history/route.ts

import { NextRequest }          from "next/server";
import { z }                    from "zod/v4";
import { db }                   from "@/app/lib/db";
import { ApiResponse }          from "@/app/lib/api-response";
import { handleApiError }       from "@/app/lib/api-error";
import { getAuthenticatedUser } from "@/app/lib/functions/getAuthenticatedUser";
import { TRAVEL_HISTORY_STATUSES, travelHistoryStatus, travelHistoryStatusWhere } from "@/app/lib/booking-display-status";

// ─── Zod Schema ───────────────────────────────────────────────────────────────

const querySchema = z.object({
  status: z.enum(TRAVEL_HISTORY_STATUSES).optional(),
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
    const now = new Date();

    const where = {
      userId: sessionUser.id,
      ...(status ? travelHistoryStatusWhere(status, now) : {}),
    };

    // ── Query ────────────────────────────────────────────────────────────────
    const [bookings, total] = await Promise.all([
      db.booking.findMany({
        where,
        skip,
        take:    limit,
        orderBy: { startDate: "desc" },
        select: {
          id:            true,
          bookingNumber: true,
          tripType:      true,
          startDate:     true,
          endDate:       true,
          duration:      true,
          travellers:    true,
          status:        true,
          totalAmount:   true,
          paidAmount:    true,
          currency:      true,
          cancelledAt:   true,
          cancelReason:  true,
          createdAt:     true,
          destination: {
            select: {
              id:        true,
              name:      true,
              thumbnail: true,
              country:   true,
            },
          },
          package: {
            select: {
              title:     true,
              thumbnail: true,
            },
          },
          payments: {
            select: {
              id:     true,
              amount: true,
              status: true,
              method: true,
              paidAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      }),
      db.booking.count({ where }),
    ]);

    const data = bookings.map((b) => ({
      ...b,
      rawStatus: b.status,
      status: travelHistoryStatus(b.status, b.endDate, now),
    }));

    return ApiResponse.ok(data, {
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