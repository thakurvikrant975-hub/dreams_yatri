// app/api/user/travel-history/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { getAuthenticatedUser } from "@/app/lib/functions/getAuthenticatedUser";
import { BookingStatus } from "@/app/generated/prisma";
// app/api/user/travel-history/route.ts

export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getAuthenticatedUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as BookingStatus | null;
    const page   = parseInt(searchParams.get("page")  ?? "1");
    const limit  = parseInt(searchParams.get("limit") ?? "10");
    const skip   = (page - 1) * limit;

    if (status && !Object.values(BookingStatus).includes(status)) {
      return NextResponse.json({ error: "Invalid status filter." }, { status: 400 });
    }

    const where = {
      userId: sessionUser.id,
      ...(status ? { status } : {}),
    };

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

    return NextResponse.json({
      bookings,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (error) {
    console.error("[travel-history]", error);
    return NextResponse.json(
      { error: "Internal server error.", detail: (error as Error).message },
      { status: 500 }
    );
  }
}