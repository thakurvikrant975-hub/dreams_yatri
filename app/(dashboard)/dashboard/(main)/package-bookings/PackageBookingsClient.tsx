import { Suspense } from "react";
import { BookCheck, CalendarClock, CircleCheck, CircleX } from "lucide-react";
import type { Prisma } from "@/app/generated/prisma";
import { db } from "@/app/lib/db";
import { PackageBookingsTable } from "./PackageBookingsTable";
import {
    Breadcrumb, BreadcrumbItem,
    BreadcrumbLink, BreadcrumbList,
    BreadcrumbPage, BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { Skeleton } from "../components/ui/skeleton";
import { PageHeader } from "../components/dashboard/PageHeader";
import { StatCard, StatGrid } from "../components/dashboard/Statcard";

const PAYMENT_STATUSES = [
    "PENDING", "ADVANCE_PAID", "FULLY_PAID", "REFUNDED", "PARTIALLY_REFUNDED", "FAILED",
];
const BOOKING_STATUSES = [
    "UPCOMING", "ONGOING", "COMPLETED", "CANCELLED", "PENDING_REVIEW", "HOTEL_VERIFICATION",
    "HOTEL_CONFIRMED", "CAB_VERIFICATION", "CAB_CONFIRMED", "OPS_REVIEW", "CONFIRMED",
    "REJECTED", "MODIFICATION_REQUESTED",
];

function TableSkeleton() {
    return (
        <div className="rounded-xl border bg-card overflow-hidden">
            <div className="bg-muted/50 px-4 py-3 grid grid-cols-9 gap-4">
                {Array.from({ length: 9 }).map((_, i) => (
                    <Skeleton key={i} className="h-4" />
                ))}
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-4 py-3 grid grid-cols-9 gap-4 border-t items-center">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-6 mx-auto" />
                    <Skeleton className="h-4 w-20 ml-auto" />
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-8 w-8 rounded-md ml-auto" />
                </div>
            ))}
        </div>
    );
}

async function BookingsData({
    page, limit, search, paymentStatus, status,
}: {
    page: number;
    limit: number;
    search: string;
    paymentStatus: string;
    status: string;
}) {
    const where: Prisma.BookingWhereInput = {
        ...(paymentStatus
            ? { paymentStatus: paymentStatus as Prisma.BookingWhereInput["paymentStatus"] }
            : {}),
        ...(status
            ? { status: status as Prisma.BookingWhereInput["status"] }
            : {}),
        ...(search
            ? {
                OR: [
                    { bookingNumber: { contains: search, mode: "insensitive" } },
                    { contactEmail: { contains: search, mode: "insensitive" } },
                    { contactPhone: { contains: search, mode: "insensitive" } },
                    { user: { name: { contains: search, mode: "insensitive" } } },
                ],
            }
            : {}),
    };

    const [total, upcoming, confirmed, cancelled, bookings] = await Promise.all([
        db.booking.count(),
        db.booking.count({ where: { status: "UPCOMING" } }),
        db.booking.count({ where: { status: "CONFIRMED" } }),
        db.booking.count({ where: { status: "CANCELLED" } }),
        db.booking.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
            select: {
                id: true,
                bookingNumber: true,
                startDate: true,
                endDate: true,
                travellers: true,
                totalAmount_paise: true,
                paymentStatus: true,
                status: true,
                paymentPlan: true,
                createdAt: true,
                contactEmail: true,
                packageId: true,
                user: { select: { name: true, email: true } },
                package: { select: { title: true } },
                destination: { select: { name: true } },
                packageUrl: true,
                hotelBookings: { take: 1, select: { hotel: { select: { name: true, city: true } } } },
            },
        }),
    ]);

    const filteredTotal = await db.booking.count({ where });
    const totalPages = Math.max(1, Math.ceil(filteredTotal / limit));

    return (
        <>
            <StatGrid cols={4}>
                <StatCard label="Total Bookings" value={total}     icon={BookCheck}     />
                <StatCard label="Upcoming"        value={upcoming}  icon={CalendarClock} />
                <StatCard label="Confirmed"       value={confirmed} icon={CircleCheck}   />
                <StatCard label="Cancelled"       value={cancelled} icon={CircleX}       />
            </StatGrid>

            <PackageBookingsTable
                bookings={bookings}
                currentPage={page}
                totalPages={totalPages}
                totalCount={filteredTotal}
                limit={limit}
                search={search}
                paymentStatus={paymentStatus}
                status={status}
            />
        </>
    );
}

export default function PackageBookingsClient({
    page, limit, search, paymentStatus, status,
}: {
    page: number;
    limit: number;
    search: string;
    paymentStatus: string;
    status: string;
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
                        <BreadcrumbPage>Package Bookings</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <PageHeader
                title="Package Bookings"
                description="Manage and review all package booking orders"
                icon={BookCheck}
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
                <BookingsData
                    page={page}
                    limit={limit}
                    search={search}
                    paymentStatus={paymentStatus}
                    status={status}
                />
            </Suspense>
        </div>
    );
}
