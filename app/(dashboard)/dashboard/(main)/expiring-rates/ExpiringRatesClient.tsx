import { Suspense } from "react";
import { CalendarClock, AlertTriangle, TimerOff, Building2 } from "lucide-react";
import { getExpiringSeasonalRates } from "./actions";
import type { ExpiryWindow } from "./windows";
import { ExpiringRatesTable } from "./ExpiringRatesTable";
import {
    Breadcrumb, BreadcrumbItem,
    BreadcrumbLink, BreadcrumbList,
    BreadcrumbPage, BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { Skeleton } from "../components/ui/skeleton";
import { PageHeader } from "../components/dashboard/PageHeader";
import { StatCard, StatGrid } from "../components/dashboard/Statcard";

function TableSkeleton() {
    return (
        <div className="rounded-xl border bg-card overflow-hidden">
            <div className="bg-muted/50 px-4 py-3 grid grid-cols-6 gap-4">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-4" />)}
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="px-4 py-3 grid grid-cols-6 gap-4 border-t items-center">
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-10 w-14 rounded-md" />
                        <Skeleton className="h-4 w-28" />
                    </div>
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16 mx-auto" />
                    <Skeleton className="h-7 w-16 ml-auto" />
                </div>
            ))}
        </div>
    );
}

async function ExpiringRatesData({
    page, limit, search, window,
}: {
    page: number; limit: number; search: string; window: ExpiryWindow;
}) {
    const { seasons, totalCount, stats } = await getExpiringSeasonalRates({ page, limit, search, window });

    return (
        <>
            <StatGrid cols={4}>
                <StatCard label="Total Seasonal Rates" value={stats.total} icon={CalendarClock} />
                <StatCard label="Expiring in 7 Days" value={stats.urgent7d} icon={AlertTriangle} />
                <StatCard label="Already Expired" value={stats.expired} icon={TimerOff} />
                <StatCard label="Hotels Affected" value={stats.hotelsAffected} icon={Building2} sub="In current filter" />
            </StatGrid>

            <ExpiringRatesTable
                seasons={seasons}
                currentPage={page}
                totalPages={Math.max(1, Math.ceil(totalCount / limit))}
                totalCount={totalCount}
                limit={limit}
                search={search}
                window={window}
            />
        </>
    );
}

export default function ExpiringRatesClient({
    page, limit, search, window,
}: {
    page: number; limit: number; search: string; window: ExpiryWindow;
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
                        <BreadcrumbPage>Expiring Seasonal Rates</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <PageHeader
                title="Expiring Seasonal Rates"
                description="Rooms whose seasonal pricing is about to lapse — catch them before they fall back to base rate"
                icon={CalendarClock}
            />

            <Suspense
                key={`${page}-${limit}-${search}-${window}`}
                fallback={
                    <div className="space-y-4">
                        <div className="grid grid-cols-4 gap-3">
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
                <ExpiringRatesData page={page} limit={limit} search={search} window={window} />
            </Suspense>
        </div>
    );
}
