import type { Metadata } from "next";
import type { Prisma } from "@/app/generated/prisma";
import { db } from "@/app/lib/db";
import { AssignDriverTable, type AssignRow, type AssignStats } from "./AssignDriverTable";

export const metadata: Metadata = {
    title: "Assign Drivers - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

const VALID_LIMITS  = [10, 20, 50] as const;
const VALID_FILTERS = ["all", "unassigned", "urgent", "assigned"] as const;

type SnapDay = { day: number; transfers?: { pickup_name?: string | null }[] };
type Snapshot = { days?: SnapDay[] };

export default async function AssignDriverPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string>>;
}) {
    const sp     = await searchParams;
    const page   = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
    const rawLim = parseInt(sp.limit ?? "20", 10);
    const limit  = (VALID_LIMITS as readonly number[]).includes(rawLim) ? rawLim : 20;
    const search = (sp.search ?? "").trim();
    const filter = (VALID_FILTERS as readonly string[]).includes(sp.filter ?? "")
        ? (sp.filter as typeof VALID_FILTERS[number])
        : "all";

    const nowMs      = Date.now();
    const in15Days   = new Date(nowMs + 15 * 86_400_000);
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0));

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

    // Show all paid bookings that have cab transfers (broad scope — driver assignment is separate from cab verification)
    const baseWhere: Prisma.BookingWhereInput = {
        paymentStatus: { in: ["ADVANCE_PAID", "FULLY_PAID"] },
        status: { notIn: ["CANCELLED", "REJECTED", "PENDING_REVIEW"] },
        ...searchWhere,
    };

    const filterWhere: Prisma.BookingWhereInput =
        filter === "urgent"     ? { startDate: { lte: in15Days } } :
        filter === "assigned"   ? { cabConfirmedAt: { not: null } } :
        filter === "unassigned" ? { cabConfirmedAt: null } :
        {};

    const where: Prisma.BookingWhereInput = { ...baseWhere, ...filterWhere };

    const [rawBookings, totalCount, unassigned, urgent, assignedToday, total] = await Promise.all([
        db.booking.findMany({
            where,
            orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
            skip:  (page - 1) * limit,
            take:  limit,
            select: {
                id: true, bookingNumber: true, startDate: true, endDate: true,
                travellers: true, totalAmount_paise: true, paymentStatus: true,
                createdAt: true, cabConfirmedAt: true, cabType: true,
                user:        { select: { name: true, email: true } },
                package:     { select: { title: true } },
                destination: { select: { name: true } },
                priceSnapshot: true,
                cabBookings: {
                    where: { isConfirmed: true, driverName: { not: null } },
                    select: { legNumber: true },
                },
            },
        }),
        db.booking.count({ where }),
        db.booking.count({ where: { ...baseWhere, cabConfirmedAt: null } }),
        db.booking.count({ where: { ...baseWhere, startDate: { lte: in15Days }, cabConfirmedAt: null } }),
        db.booking.count({ where: { ...baseWhere, cabConfirmedAt: { gte: todayStart } } }),
        db.booking.count({ where: baseWhere }),
    ]);

    const stats: AssignStats = { total, unassigned, urgent, assignedToday };

    const bookings: AssignRow[] = rawBookings.map((b) => {
        const snap = (b.priceSnapshot ?? {}) as Snapshot;
        const totalCabCount  = (snap.days ?? []).filter((d) => (d.transfers ?? []).length > 0).length;
        const assignedCount  = b.cabBookings.length;
        const isFullyAssigned = totalCabCount > 0 && assignedCount >= totalCabCount;
        const daysToTravel   = Math.ceil((b.startDate.getTime() - nowMs) / 86_400_000);
        const isUrgent       = !isFullyAssigned && daysToTravel <= 15 && daysToTravel >= 0;

        return {
            id:                b.id,
            bookingNumber:     b.bookingNumber,
            startDate:         b.startDate,
            endDate:           b.endDate,
            travellers:        b.travellers,
            totalAmount_paise: b.totalAmount_paise,
            paymentStatus:     b.paymentStatus,
            createdAt:         b.createdAt,
            cabConfirmedAt:    b.cabConfirmedAt,
            cabType:           b.cabType,
            user:              b.user,
            package:           b.package,
            destination:       b.destination,
            totalCabCount,
            assignedCount,
            isFullyAssigned,
            daysToTravel,
            isUrgent,
        };
    });

    return (
        <AssignDriverTable
            bookings={bookings}
            stats={stats}
            currentPage={page}
            totalPages={Math.max(1, Math.ceil(totalCount / limit))}
            totalCount={totalCount}
            limit={limit}
            search={search}
            filter={filter}
        />
    );
}
