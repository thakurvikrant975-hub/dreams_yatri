import { Suspense } from "react";
import { Car, MapPin, CarFront } from "lucide-react";
import { getCabDirectory } from "./actions";
import { CabDirectoryTable } from "./CabDirectoryTable";
import {
    Breadcrumb, BreadcrumbItem,
    BreadcrumbLink, BreadcrumbList,
    BreadcrumbPage, BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { Skeleton } from "../components/ui/skeleton";
import { PageHeader } from "../components/dashboard/PageHeader";
import { StatCard, StatGrid } from "../components/dashboard/Statcard";

type Status = "all" | "active" | "inactive";

function TableSkeleton() {
    return (
        <div className="rounded-xl border bg-card overflow-hidden">
            <div className="bg-muted/50 px-4 py-3 grid grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-4" />)}
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="px-4 py-3 grid grid-cols-3 gap-4 border-t items-center">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-4 w-12 mx-auto" />
                </div>
            ))}
        </div>
    );
}

async function CabDirectoryData({
    page, limit, search, status,
}: {
    page: number; limit: number; search: string; status: Status;
}) {
    const { rows, totalCount, stats, currentPage, totalPages } = await getCabDirectory({ page, limit, search, status });

    return (
        <>
            <StatGrid cols={3}>
                <StatCard label="Cities Covered" value={stats.total_cities} icon={MapPin} />
                <StatCard label="Cabs Available" value={stats.total_active_listings} icon={Car} />
                <StatCard label="Vehicle Types" value={stats.total_vehicle_types} icon={CarFront} />
            </StatGrid>

            <CabDirectoryTable
                rows={rows}
                currentPage={currentPage}
                totalPages={totalPages}
                totalCount={totalCount}
                limit={limit}
                search={search}
                status={status}
            />
        </>
    );
}

export default function CabDirectoryClient({
    page, limit, search, status,
}: {
    page: number; limit: number; search: string; status: Status;
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
                        <BreadcrumbPage>Cab Directory</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <PageHeader
                title="Cab Directory"
                description="Browse which cabs are available in each city — view only, no pricing"
                icon={Car}
            />

            <Suspense
                key={`${page}-${limit}-${search}-${status}`}
                fallback={
                    <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-3">
                            {Array.from({ length: 3 }).map((_, i) => (
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
                <CabDirectoryData page={page} limit={limit} search={search} status={status} />
            </Suspense>
        </div>
    );
}
