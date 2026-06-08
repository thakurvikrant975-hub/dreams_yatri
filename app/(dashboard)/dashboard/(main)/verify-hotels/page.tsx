import type { Metadata } from "next";
import type { Prisma } from "@/app/generated/prisma";
import { db } from "@/app/lib/db";
import { VerifyHotelsTable, type BookingRow, type HotelStats } from "./VerifyHotelsTable";

export const metadata: Metadata = {
    title: "Verify Hotels - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

const VALID_LIMITS  = [10, 20, 50] as const;
const VALID_URGENCY = ["all", "urgent", "overdue", "confirmed", "pending"] as const;

export default async function VerifyHotelsPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string>>;
}) {
    const sp      = await searchParams;
    const page    = Math.max(1, parseInt(sp.page   ?? "1",  10) || 1);
    const rawLim  = parseInt(sp.limit ?? "20", 10);
    const limit   = (VALID_LIMITS  as readonly number[]).includes(rawLim) ? rawLim : 20;
    const search  = (sp.search  ?? "").trim();
    const urgency = (VALID_URGENCY as readonly string[]).includes(sp.urgency ?? "")
        ? (sp.urgency as typeof VALID_URGENCY[number])
        : "all";

    const nowMs      = Date.now();
    const in15Days   = new Date(nowMs + 15 * 86_400_000);
    const ago48h     = new Date(nowMs - 48 * 3_600_000);
    const now        = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // ── Search sub-clause ────────────────────────────────────────────────────
    const searchWhere: Prisma.BookingWhereInput = search
        ? {
            OR: [
                { bookingNumber: { contains: search, mode: "insensitive" } },
                { contactEmail:  { contains: search, mode: "insensitive" } },
                { contactPhone:  { contains: search, mode: "insensitive" } },
                { user: { name:  { contains: search, mode: "insensitive" } } },
            ],
        }
        : {};

    // ── Base where ───────────────────────────────────────────────────────────
    const baseWhere: Prisma.BookingWhereInput = {
        paymentStatus: { in: ["ADVANCE_PAID", "FULLY_PAID"] },
        status: { notIn: ["CANCELLED", "COMPLETED", "REJECTED"] },
        ...searchWhere,
    };

    // ── Urgency filter ────────────────────────────────────────────────────────
    const urgencyFilter: Prisma.BookingWhereInput =
        urgency === "urgent"    ? { startDate: { lte: in15Days }, hotelConfirmedAt: null } :
        urgency === "overdue"   ? { createdAt:  { lte: ago48h },  hotelConfirmedAt: null } :
        urgency === "confirmed" ? { hotelConfirmedAt: { not: null } } :
        urgency === "pending"   ? { hotelConfirmedAt: null } :
        {};

    const where: Prisma.BookingWhereInput = { ...baseWhere, ...urgencyFilter };

    // ── Parallel data fetch ──────────────────────────────────────────────────
    const [rawBookings, totalCount, pending, urgent, overdue, confirmedToday, total] =
        await Promise.all([
            db.booking.findMany({
                where,
                orderBy: [{ hotelConfirmedAt: "asc" }, { startDate: "asc" }, { createdAt: "asc" }],
                skip:  (page - 1) * limit,
                take:  limit,
                select: {
                    id: true, bookingNumber: true, startDate: true, endDate: true,
                    travellers: true, totalAmount_paise: true, paymentStatus: true,
                    createdAt: true, hotelConfirmedAt: true,
                    user:        { select: { name: true, email: true } },
                    package:     { select: { title: true } },
                    destination: { select: { name: true } },
                    _count:      { select: { hotelBookings: true } },
                    hotelBookings: { where: { isConfirmed: false }, select: { id: true } },
                },
            }),
            db.booking.count({ where }),
            db.booking.count({ where: { ...baseWhere, hotelConfirmedAt: null } }),
            db.booking.count({ where: { ...baseWhere, startDate: { lte: in15Days }, hotelConfirmedAt: null } }),
            db.booking.count({ where: { ...baseWhere, createdAt: { lte: ago48h },  hotelConfirmedAt: null } }),
            db.booking.count({ where: { ...baseWhere, hotelConfirmedAt: { gte: todayStart } } }),
            db.booking.count({ where: baseWhere }),
        ]);

    const stats: HotelStats = { total, pending, urgent, overdue, confirmedToday };

    // ── Enrich with computed flags ───────────────────────────────────────────
    const bookings: BookingRow[] = rawBookings.map((b) => {
        const pendingCount     = b.hotelBookings.length;
        const totalHotelCount  = b._count.hotelBookings;
        const isFullyConfirmed = b.hotelConfirmedAt != null || (totalHotelCount > 0 && pendingCount === 0);
        const daysToTravel     = Math.ceil((b.startDate.getTime() - nowMs) / 86_400_000);
        const hoursOld         = (nowMs - b.createdAt.getTime()) / 3_600_000;
        const isUrgent         = !isFullyConfirmed && daysToTravel <= 15 && daysToTravel >= 0;
        const isOverdue        = !isFullyConfirmed && hoursOld >= 48;

        return {
            id:                b.id,
            bookingNumber:     b.bookingNumber,
            startDate:         b.startDate,
            endDate:           b.endDate,
            travellers:        b.travellers,
            totalAmount_paise: b.totalAmount_paise,
            paymentStatus:     b.paymentStatus,
            createdAt:         b.createdAt,
            hotelConfirmedAt:  b.hotelConfirmedAt,
            user:              b.user,
            package:           b.package,
            destination:       b.destination,
            pendingCount,
            totalHotelCount,
            isFullyConfirmed,
            daysToTravel,
            hoursOld,
            isUrgent,
            isOverdue,
        };
    });

    return (
        <VerifyHotelsTable
            bookings={bookings}
            stats={stats}
            currentPage={page}
            totalPages={Math.max(1, Math.ceil(totalCount / limit))}
            totalCount={totalCount}
            limit={limit}
            search={search}
            urgency={urgency}
        />
    );
}
