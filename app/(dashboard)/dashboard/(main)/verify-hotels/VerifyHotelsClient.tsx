import { Suspense } from "react";
import { Hotel, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import type { Prisma } from "@/app/generated/prisma";
import { db } from "@/app/lib/db";
import { VerifyHotelsTable, type BookingRow, type HotelStats } from "./VerifyHotelsTable";
import {
    Breadcrumb, BreadcrumbItem,
    BreadcrumbLink, BreadcrumbList,
    BreadcrumbPage, BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { Skeleton } from "../components/ui/skeleton";
import { PageHeader } from "../components/dashboard/PageHeader";

type Urgency = "all" | "urgent" | "overdue" | "confirmed" | "pending";

function TableSkeleton() {
    return (
        <div className="rounded-xl border bg-card overflow-hidden">
            <div className="bg-muted/50 px-4 py-3 grid grid-cols-8 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-4" />
                ))}
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-4 py-3 grid grid-cols-8 gap-4 border-t items-center">
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-4 w-6 mx-auto" />
                    <Skeleton className="h-8 w-20 ml-auto" />
                    <Skeleton className="h-5 w-16 mx-auto" />
                    <Skeleton className="h-7 w-16 mx-auto" />
                </div>
            ))}
        </div>
    );
}

async function HotelsData({
    page, limit, search, urgency,
}: {
    page: number;
    limit: number;
    search: string;
    urgency: Urgency;
}) {
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
            ],
        }
        : {};

    const baseWhere: Prisma.BookingWhereInput = {
        paymentStatus: { in: ["ADVANCE_PAID", "FULLY_PAID"] },
        status: { notIn: ["CANCELLED", "COMPLETED", "REJECTED"] },
        ...searchWhere,
    };

    const urgencyFilter: Prisma.BookingWhereInput =
        urgency === "urgent"    ? { startDate: { lte: in15Days }, hotelConfirmedAt: null } :
        urgency === "overdue"   ? { createdAt:  { lte: ago48h },  hotelConfirmedAt: null } :
        urgency === "confirmed" ? { hotelConfirmedAt: { not: null } } :
        urgency === "pending"   ? { hotelConfirmedAt: null } :
        {};

    const where: Prisma.BookingWhereInput = { ...baseWhere, ...urgencyFilter };

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
                    createdAt: true, hotelConfirmedAt: true, priceSnapshot: true,
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

    const bookings: BookingRow[] = rawBookings.map((b) => {
        // BookingHotel rows are created lazily — only once ops actually
        // touches that day — so `_count.hotelBookings` under-counts any day
        // that's never been confirmed yet. The itinerary snapshot has the
        // real total (same source confirmHotelStay itself checks against),
        // so a booking with untouched days can never falsely read as done.
        const snapshotDays    = ((b.priceSnapshot as { days?: { hotel: unknown }[] } | null)?.days ?? []);
        const trueHotelDays   = snapshotDays.filter((d) => d.hotel != null).length;
        const totalHotelCount = trueHotelDays > 0 ? trueHotelDays : b._count.hotelBookings;
        const confirmedExisting = b._count.hotelBookings - b.hotelBookings.length;
        const pendingCount     = totalHotelCount - confirmedExisting;
        const isFullyConfirmed = b.hotelConfirmedAt != null || (totalHotelCount > 0 && pendingCount === 0);
        const daysToTravel     = Math.ceil((b.startDate.getTime() - nowMs) / 86_400_000);
        const hoursOld         = (nowMs - b.createdAt.getTime()) / 3_600_000;
        const isUrgent         = !isFullyConfirmed && daysToTravel <= 15 && daysToTravel >= 0;
        const isOverdue        = !isFullyConfirmed && hoursOld >= 48;

        return {
            id: b.id, bookingNumber: b.bookingNumber,
            startDate: b.startDate, endDate: b.endDate,
            travellers: b.travellers, totalAmount_paise: b.totalAmount_paise,
            paymentStatus: b.paymentStatus, createdAt: b.createdAt,
            hotelConfirmedAt: b.hotelConfirmedAt,
            user: b.user, package: b.package, destination: b.destination,
            pendingCount, totalHotelCount, isFullyConfirmed,
            daysToTravel, hoursOld, isUrgent, isOverdue,
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

export default function VerifyHotelsClient({
    page, limit, search, urgency,
}: {
    page: number;
    limit: number;
    search: string;
    urgency: Urgency;
}) {
    return (
        <div className="space-y-6">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>Verify Hotels</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <PageHeader
                title="Verify Hotels"
                description="Confirm hotel stays for paid bookings"
                icon={Hotel}
            />

            <Suspense
                fallback={
                    <div className="space-y-4">
                        <div className="grid grid-cols-4 gap-4">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="rounded-xl border bg-card p-4 space-y-2">
                                    <Skeleton className="h-3 w-16" />
                                    <Skeleton className="h-7 w-10" />
                                </div>
                            ))}
                        </div>
                        <TableSkeleton />
                    </div>
                }
            >
                <HotelsData
                    page={page}
                    limit={limit}
                    search={search}
                    urgency={urgency}
                />
            </Suspense>
        </div>
    );
}
