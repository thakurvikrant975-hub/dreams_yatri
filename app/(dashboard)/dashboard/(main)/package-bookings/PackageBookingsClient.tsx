import { Suspense } from "react";
import { BookCheck, CalendarClock, CircleCheck, CircleX, ClipboardList, IndianRupee } from "lucide-react";
import type { Prisma } from "@/app/generated/prisma";
import { db } from "@/app/lib/db";
import { getEffectiveMember } from "../lib/get-current-member";
import { formatPaiseRoundedUp } from "@/app/lib/money";
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
    // ── Whose bookings this viewer may see ────────────────────────────────
    // A sales executive is answerable for the trips they sold and for nothing
    // else, so the list — and every tile above it — is theirs alone. Team
    // leaders oversee the desk and see all of it, as they do everywhere else
    // in the workspace; so does anyone whose role is not a selling one, which
    // is ops and administration.
    //
    // Applied to the counts and the revenue as well as the rows. Scoping only
    // the table would have left an exec reading the company's total revenue
    // above a list of their own four bookings.
    const member = await getEffectiveMember();
    const roleName = (member?.member?.teamRole?.name ?? "").trim().toLowerCase();
    const sells = roleName.includes("sales") || roleName.includes("travel expert");
    const oversees = roleName.includes("team leader");
    const mine: Prisma.BookingWhereInput =
        sells && !oversees && member?.member?.id ? { salesAgentId: member.member.id } : {};

    const where: Prisma.BookingWhereInput = {
        ...mine,
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
                    { travellersList: { some: { fullName: { contains: search, mode: "insensitive" } } } },
                ],
            }
            : {}),
    };

    const [total, upcoming, pendingReview, confirmed, cancelled, revenue, bookings] = await Promise.all([
        db.booking.count({ where: mine }),
        db.booking.count({ where: { ...mine, status: "UPCOMING" } }),
        db.booking.count({ where: { ...mine, status: "PENDING_REVIEW" } }),
        db.booking.count({ where: { ...mine, status: "CONFIRMED" } }),
        db.booking.count({ where: { ...mine, status: "CANCELLED" } }),
        db.booking.aggregate({
            where: { ...mine, status: { not: "CANCELLED" } },
            _sum: { totalAmount_paise: true },
        }),
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
                contactPhone: true,
                packageId: true,
                // Who sold it. Null means the client booked off the website on
                // their own, which is the distinction between a sale and a
                // walk-in — see createBookingFromCustomPackage.
                salesAgentName: true,
                user: { select: { name: true, email: true } },
                travellersList: {
                    where: { isLead: true },
                    take: 1,
                    select: { fullName: true, firstName: true, lastName: true },
                },
                package: { select: { title: true } },
                destination: { select: { name: true } },
                // A booking made from a custom package usually has no
                // catalogue destination — an exec types what the client says,
                // which is rarely a row in that table. The query it came from
                // carries the words that were actually quoted.
                sourceQuery: {
                    select: {
                        destination: true,
                        // What was actually sent to the client. Booking.packageId
                        // points at the catalogue and is null for these, so
                        // without this every sales booking read "—" where its
                        // name should be.
                        custom_packages: {
                            where: { status: "SENT" },
                            select: { title: true },
                            orderBy: { sentAt: "desc" },
                            take: 1,
                        },
                    },
                },
                packageUrl: true,
                hotelBookings: { take: 1, select: { hotel: { select: { name: true, city: true } } } },
            },
        }),
    ]);

    const filteredTotal = await db.booking.count({ where });
    const totalPages = Math.max(1, Math.ceil(filteredTotal / limit));

    return (
        <>
            <StatGrid cols={6}>
                <StatCard label="Total Bookings" value={total}         icon={BookCheck}     />
                <StatCard label="Upcoming"        value={upcoming}      icon={CalendarClock} />
                <StatCard label="Pending Review"  value={pendingReview} icon={ClipboardList} />
                <StatCard label="Confirmed"       value={confirmed}     icon={CircleCheck}   />
                <StatCard label="Cancelled"       value={cancelled}     icon={CircleX}       />
                <StatCard
                    label="Total Revenue"
                    value={formatPaiseRoundedUp(revenue._sum.totalAmount_paise ?? 0)}
                    icon={IndianRupee}
                    sub="Excludes cancelled bookings"
                />
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
