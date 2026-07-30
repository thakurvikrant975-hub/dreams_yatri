import type { Metadata } from "next";
import { PlaneTakeoff } from "lucide-react";
import type { Prisma } from "@/app/generated/prisma";
import { db } from "@/app/lib/db";
import { UpcomingGuestsTable, type GuestRow, type GuestStats } from "./UpcomingGuestsTable";
import {
    Breadcrumb, BreadcrumbItem,
    BreadcrumbLink, BreadcrumbList,
    BreadcrumbPage, BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { PageHeader } from "../components/dashboard/PageHeader";

export const metadata: Metadata = {
    title: "Upcoming Guests - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

const VALID_LIMITS = [10, 20, 50] as const;
const DAYS_AHEAD = 7;

export default async function UpcomingGuestsPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string>>;
}) {
    const sp     = await searchParams;
    const page   = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
    const rawLim = parseInt(sp.limit ?? "20", 10);
    const limit  = (VALID_LIMITS as readonly number[]).includes(rawLim) ? rawLim : 20;
    const search = (sp.search ?? "").trim();

    const nowMs      = Date.now();
    const now        = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const windowEnd  = new Date(todayStart.getTime() + DAYS_AHEAD * 86_400_000);

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

    // Travelling within the next 7 days and not cancelled — every paid
    // booking in this window is worth a pre-travel vendor check, regardless
    // of how far its own hotel/cab verification has gotten, since a booking
    // still stuck mid-verification days before departure is exactly what
    // this page exists to surface.
    const where: Prisma.BookingWhereInput = {
        startDate: { gte: todayStart, lte: windowEnd },
        paymentStatus: { in: ["ADVANCE_PAID", "FULLY_PAID"] },
        status: { notIn: ["CANCELLED", "COMPLETED", "REJECTED"] },
        ...searchWhere,
    };

    // "Needs attention" = at least one confirmed hotel/cab leg that hasn't
    // been double-checked with the vendor yet — computed across the whole
    // filtered set (not just this page) so the stat card stays accurate
    // regardless of pagination.
    const needsAttentionWhere: Prisma.BookingWhereInput = {
        AND: [
            where,
            {
                OR: [
                    { hotelBookings: { some: { isConfirmed: true, reconfirmedAt: null } } },
                    { cabBookings:   { some: { isConfirmed: true, reconfirmedAt: null } } },
                ],
            },
        ],
    };

    const [rawBookings, totalCount, travelingToday, needsAttention] =
        await Promise.all([
            db.booking.findMany({
                where,
                orderBy: [{ startDate: "asc" }, { bookingNumber: "asc" }],
                skip: (page - 1) * limit,
                take: limit,
                select: {
                    id: true, bookingNumber: true, startDate: true, endDate: true,
                    travellers: true, contactEmail: true,
                    user: { select: { name: true, email: true } },
                    travellersList: {
                        where: { isLead: true },
                        take: 1,
                        select: { fullName: true, firstName: true, lastName: true },
                    },
                    package: { select: { title: true } },
                    destination: { select: { name: true } },
                    hotelBookings: { select: { isConfirmed: true, reconfirmedAt: true } },
                    cabBookings: { select: { isConfirmed: true, reconfirmedAt: true } },
                },
            }),
            db.booking.count({ where }),
            db.booking.count({ where: { ...where, startDate: { gte: todayStart, lt: new Date(todayStart.getTime() + 86_400_000) } } }),
            db.booking.count({ where: needsAttentionWhere }),
        ]);

    const guests: GuestRow[] = rawBookings.map((b) => {
        const hotelTotal       = b.hotelBookings.length;
        const hotelConfirmed   = b.hotelBookings.filter((h) => h.isConfirmed).length;
        const hotelReconfirmed = b.hotelBookings.filter((h) => h.isConfirmed && h.reconfirmedAt != null).length;
        const cabTotal         = b.cabBookings.length;
        const cabConfirmed     = b.cabBookings.filter((c) => c.isConfirmed).length;
        const cabReconfirmed   = b.cabBookings.filter((c) => c.isConfirmed && c.reconfirmedAt != null).length;

        const daysToTravel = Math.ceil((b.startDate.getTime() - nowMs) / 86_400_000);
        // "Fully reconfirmed" only requires every leg that's actually
        // confirmed to be reconfirmed — a hotel-only booking (no cab legs at
        // all) shouldn't be stuck "needing attention" forever just because
        // cabConfirmed is 0.
        const hasAnyConfirmedLeg = hotelConfirmed > 0 || cabConfirmed > 0;
        const isFullyReconfirmed =
            hasAnyConfirmedLeg &&
            hotelReconfirmed === hotelConfirmed &&
            cabReconfirmed === cabConfirmed;

        return {
            id: b.id,
            bookingNumber: b.bookingNumber,
            startDate: b.startDate,
            endDate: b.endDate,
            travellers: b.travellers,
            contactEmail: b.contactEmail,
            user: b.user,
            travellersList: b.travellersList,
            package: b.package,
            destination: b.destination,
            hotelTotal, hotelConfirmed, hotelReconfirmed,
            cabTotal, cabConfirmed, cabReconfirmed,
            daysToTravel,
            isFullyReconfirmed,
        };
    });

    const stats: GuestStats = {
        total: totalCount,
        travelingToday,
        needsAttention,
        fullyReconfirmed: Math.max(0, totalCount - needsAttention),
    };

    return (
        <div className="space-y-6">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>Upcoming Guests</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <PageHeader
                title="Upcoming Guests"
                description="Bookings travelling in the next 7 days — reconfirm hotels and cabs directly with each vendor before arrival"
                icon={PlaneTakeoff}
            />

            <UpcomingGuestsTable
                guests={guests}
                stats={stats}
                currentPage={page}
                totalPages={Math.max(1, Math.ceil(totalCount / limit))}
                totalCount={totalCount}
                limit={limit}
                search={search}
                daysAhead={DAYS_AHEAD}
            />
        </div>
    );
}
