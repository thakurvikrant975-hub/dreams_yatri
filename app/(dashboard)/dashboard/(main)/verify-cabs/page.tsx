import type { Metadata } from "next";
import type { Prisma } from "@/app/generated/prisma";
import { db } from "@/app/lib/db";
import { VerifyCabsTable, type CabRow, type CabStats } from "./VerifyCabsTable";

export const metadata: Metadata = {
    title: "Verify Cabs - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

const VALID_LIMITS  = [10, 20, 50] as const;
const VALID_URGENCY = ["all", "urgent", "overdue", "confirmed", "pending"] as const;

// Snapshot type — only what we need for counting transfer days / cab pricing
type SnapDay = { day: number; transfers?: { pickup_name?: string | null }[] };
type SnapCab = { day_from: number; day_to: number; total?: number };
type Snapshot = { days?: SnapDay[]; cab_segments?: SnapCab[] };

export default async function VerifyCabsPage({
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

    const searchWhere: Prisma.BookingWhereInput = search
        ? {
            OR: [
                { bookingNumber: { contains: search, mode: "insensitive" } },
                { contactEmail:  { contains: search, mode: "insensitive" } },
                { contactPhone:  { contains: search, mode: "insensitive" } },
                { user: { name:  { contains: search, mode: "insensitive" } } },
                { travellersList: { some: { fullName: { contains: search, mode: "insensitive" } } } },
            ],
        }
        : {};

    // Cabs come after hotel confirmation — show relevant statuses
    const baseWhere: Prisma.BookingWhereInput = {
        paymentStatus: { in: ["ADVANCE_PAID", "FULLY_PAID"] },
        status: { notIn: ["CANCELLED", "COMPLETED", "REJECTED", "PENDING_REVIEW", "HOTEL_VERIFICATION"] },
        ...searchWhere,
    };

    const urgencyFilter: Prisma.BookingWhereInput =
        urgency === "urgent"    ? { startDate: { lte: in15Days }, cabConfirmedAt: null } :
        urgency === "overdue"   ? { createdAt:  { lte: ago48h  }, cabConfirmedAt: null } :
        urgency === "confirmed" ? { cabConfirmedAt: { not: null } } :
        urgency === "pending"   ? { cabConfirmedAt: null } :
        {};

    const where: Prisma.BookingWhereInput = { ...baseWhere, ...urgencyFilter };

    const [rawBookings, totalCount, pending, urgent, overdue, confirmedToday, total] =
        await Promise.all([
            db.booking.findMany({
                where,
                orderBy: [{ cabConfirmedAt: "asc" }, { startDate: "asc" }, { createdAt: "asc" }],
                skip:  (page - 1) * limit,
                take:  limit,
                select: {
                    id: true, bookingNumber: true, startDate: true, endDate: true,
                    travellers: true, paymentStatus: true,
                    createdAt: true, cabConfirmedAt: true, cabType: true,
                    contactEmail: true,
                    user:        { select: { name: true, email: true } },
                    travellersList: {
                        where: { isLead: true },
                        take: 1,
                        select: { fullName: true, firstName: true, lastName: true },
                    },
                    package:     { select: { title: true } },
                    destination: { select: { name: true } },
                    priceSnapshot: true,
                    _count:    { select: { cabBookings: true } },
                    cabBookings: { where: { isConfirmed: false }, select: { id: true } },
                },
            }),
            db.booking.count({ where }),
            db.booking.count({ where: { ...baseWhere, cabConfirmedAt: null } }),
            db.booking.count({ where: { ...baseWhere, startDate: { lte: in15Days }, cabConfirmedAt: null } }),
            db.booking.count({ where: { ...baseWhere, createdAt: { lte: ago48h },  cabConfirmedAt: null } }),
            db.booking.count({ where: { ...baseWhere, cabConfirmedAt: { gte: todayStart } } }),
            db.booking.count({ where: baseWhere }),
        ]);

    const stats: CabStats = { total, pending, urgent, overdue, confirmedToday };

    const bookings: CabRow[] = rawBookings.map((b) => {
        const snap = (b.priceSnapshot ?? {}) as Snapshot;
        // Total transfer days = days that have at least one transfer in snapshot
        const totalCabCount  = (snap.days ?? []).filter((d) => (d.transfers ?? []).length > 0).length;
        const pendingCabCount = b.cabBookings.length; // unconfirmed BookingCab rows

        const isFullyConfirmed = b.cabConfirmedAt != null || (totalCabCount > 0 && pendingCabCount === 0 && b._count.cabBookings >= totalCabCount);
        const daysToTravel     = Math.ceil((b.startDate.getTime() - nowMs) / 86_400_000);
        const hoursOld         = (nowMs - b.createdAt.getTime()) / 3_600_000;
        const isUrgent         = !isFullyConfirmed && daysToTravel <= 15 && daysToTravel >= 0;
        const isOverdue        = !isFullyConfirmed && hoursOld >= 48;

        // Cab-only pricing for the "Amount" column — NOT the booking's whole
        // package total (which also includes hotels/meals/activities).
        const cabPricingPaise = (snap.cab_segments ?? []).reduce(
            (sum, seg) => (seg.total != null ? sum + Math.ceil(Number(seg.total)) * 100 : sum),
            0,
        );

        return {
            id:                b.id,
            bookingNumber:     b.bookingNumber,
            startDate:         b.startDate,
            endDate:           b.endDate,
            travellers:        b.travellers,
            cabPricingPaise,
            paymentStatus:     b.paymentStatus,
            createdAt:         b.createdAt,
            cabConfirmedAt:    b.cabConfirmedAt,
            cabType:           b.cabType,
            user:              b.user,
            contactEmail:      b.contactEmail,
            travellersList:    b.travellersList,
            package:           b.package,
            destination:       b.destination,
            pendingCabCount,
            totalCabCount,
            isFullyConfirmed,
            daysToTravel,
            hoursOld,
            isUrgent,
            isOverdue,
        };
    });

    return (
        <VerifyCabsTable
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
