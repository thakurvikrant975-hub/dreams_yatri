import { Suspense } from "react";
import { Bed } from "lucide-react";
import type { Prisma } from "@/app/generated/prisma";
import { db } from "@/app/lib/db";
import { getPackageReviewScope } from "@/app/lib/sales-teams/leader-scope";
import { TeamHotelRequestsTable, type HotelRequestRow } from "./TeamHotelRequestsTable";
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

function NoScopeState() {
    return (
        <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 p-8 text-center text-sm text-dashboard-base-content/60">
            You&apos;re not currently set as the leader of a SalesTeam — ask your admin to assign you before this page can show your team&apos;s hotel requests.
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
    const scope = await getPackageReviewScope();
    if (scope.kind === "none") return <NoScopeState />;

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

    // Same "still awaiting the hotel team" definition hotel-requests-v2
    // uses — hotelRejectedAt is excluded so a rejected day (which stays
    // hotelPending: true to keep surfacing for the exec) doesn't linger here.
    const pendingFilter = { hotelPending: true, hotelRejectedAt: null } as const;

    const scopeWhere: Prisma.custom_packagesWhereInput =
        scope.kind === "team" ? { builtBy: { in: scope.memberIds } } : {};

    const where: Prisma.custom_packagesWhereInput = {
        itineraries: { some: pendingFilter },
        ...scopeWhere,
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
                    where:   pendingFilter,
                    orderBy: { day: "asc" },
                    select:  { day: true, hotelPendingNote: true, hotelRequestedAt: true },
                },
            },
        }),
        db.custom_packages.count({ where }),
        db.custom_itineraries.count({ where: { ...pendingFilter, package: scopeWhere } }),
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
        <TeamHotelRequestsTable
            requests={requests}
            stats={{ totalPackages: totalCount, totalDays }}
            currentPage={page}
            totalPages={Math.max(1, Math.ceil(totalCount / limit))}
            totalCount={totalCount}
            limit={limit}
            search={search}
            scopeLabel={scope.kind === "team" ? scope.teamName : "All sales executives"}
        />
    );
}

export default function TeamHotelRequestsClient({
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
                        <BreadcrumbPage>Team Hotel Requests</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <PageHeader
                title="Team Hotel Requests"
                description="Days your team flagged as needing a hotel from the Hotel Department, still waiting on a fill"
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
