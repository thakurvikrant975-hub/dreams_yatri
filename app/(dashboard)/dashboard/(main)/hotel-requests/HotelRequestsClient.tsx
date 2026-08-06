import { Suspense } from "react";
import { Bed } from "lucide-react";
import type { Prisma } from "@/app/generated/prisma";
import { db } from "@/app/lib/db";
import { HotelRequestsTable, type HotelRequestRow } from "./HotelRequestsTable";
import {
    Breadcrumb, BreadcrumbItem,
    BreadcrumbLink, BreadcrumbList,
    BreadcrumbPage, BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { Skeleton } from "../components/ui/skeleton";
import { PageHeader } from "../components/dashboard/PageHeader";

function TableSkeleton() {
    return (
        <div className="rounded-xl border bg-card overflow-hidden">
            <div className="bg-muted/50 px-4 py-3 grid grid-cols-5 gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-4" />
                ))}
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-4 py-3 grid grid-cols-5 gap-4 border-t items-center">
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16 mx-auto" />
                    <Skeleton className="h-7 w-24 ml-auto" />
                </div>
            ))}
        </div>
    );
}

async function HotelRequestsData({
    page, limit, search,
}: {
    page: number;
    limit: number;
    search: string;
}) {
    const searchWhere: Prisma.custom_packagesWhereInput = search
        ? {
            OR: [
                { title:       { contains: search, mode: "insensitive" } },
                { destination: { contains: search, mode: "insensitive" } },
                { query: { name:  { contains: search, mode: "insensitive" } } },
                { query: { phone: { contains: search, mode: "insensitive" } } },
            ],
        }
        : {};

    const where: Prisma.custom_packagesWhereInput = {
        itineraries: { some: { hotelPending: true } },
        ...searchWhere,
    };

    const [rows, totalCount, totalDays] = await Promise.all([
        db.custom_packages.findMany({
            where,
            orderBy: { updatedAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
            select: {
                id: true, title: true, destination: true, travelDate: true,
                builtByName: true,
                query: { select: { name: true, phone: true } },
                itineraries: {
                    where:   { hotelPending: true },
                    orderBy: { day: "asc" },
                    select:  { day: true, hotelPendingNote: true, hotelRequestedAt: true },
                },
            },
        }),
        db.custom_packages.count({ where }),
        db.custom_itineraries.count({ where: { hotelPending: true } }),
    ]);

    const requests: HotelRequestRow[] = rows.map((r) => ({
        id: r.id,
        title: r.title,
        destination: r.destination,
        travelDate: r.travelDate,
        requestedByName: r.builtByName,
        clientName: r.query?.name ?? null,
        clientPhone: r.query?.phone ?? null,
        pendingDays: r.itineraries.map((it) => ({ day: it.day, note: it.hotelPendingNote, requestedAt: it.hotelRequestedAt })),
        oldestRequestedAt: r.itineraries.reduce<Date | null>((oldest, it) => {
            if (!it.hotelRequestedAt) return oldest;
            if (!oldest || it.hotelRequestedAt < oldest) return it.hotelRequestedAt;
            return oldest;
        }, null),
    }));

    return (
        <HotelRequestsTable
            requests={requests}
            stats={{ totalPackages: totalCount, totalDays }}
            currentPage={page}
            totalPages={Math.max(1, Math.ceil(totalCount / limit))}
            totalCount={totalCount}
            limit={limit}
            search={search}
        />
    );
}

export default function HotelRequestsClient({
    page, limit, search,
}: {
    page: number;
    limit: number;
    search: string;
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
                        <BreadcrumbPage>Hotel Requests</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <PageHeader
                title="Hotel Requests"
                description="Fill in hotels the sales team couldn't find in the catalog"
                icon={Bed}
            />

            <Suspense
                fallback={
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            {Array.from({ length: 2 }).map((_, i) => (
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
                <HotelRequestsData page={page} limit={limit} search={search} />
            </Suspense>
        </div>
    );
}
