import { Suspense } from "react";
import { Building2, BedDouble, CheckCircle2 } from "lucide-react";
import { getHotels } from "../hotels/actions";
import { HotelInventoryTable } from "./HotelInventoryTable";
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
            <div className="bg-muted/50 px-4 py-3 grid grid-cols-5 gap-4">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-4" />)}
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="px-4 py-3 grid grid-cols-5 gap-4 border-t items-center">
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-10 w-14 rounded-md" />
                        <Skeleton className="h-4 w-28" />
                    </div>
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-12 mx-auto" />
                    <Skeleton className="h-7 w-16 ml-auto" />
                </div>
            ))}
        </div>
    );
}

async function HotelInventoryData({
    page, limit, search, status,
}: {
    page: number; limit: number; search: string; status: Status;
}) {
    const { hotels, totalCount, stats } = await getHotels({ page, limit, search, status });

    return (
        <>
            <StatGrid cols={3}>
                <StatCard label="Total Hotels" value={stats.total} icon={Building2} />
                <StatCard label="Active" value={stats.active} icon={CheckCircle2} />
                <StatCard label="Total Rooms" value={stats.totalRooms} icon={BedDouble} />
            </StatGrid>

            <HotelInventoryTable
                hotels={hotels}
                currentPage={page}
                totalPages={Math.max(1, Math.ceil(totalCount / limit))}
                totalCount={totalCount}
                limit={limit}
                search={search}
                status={status}
            />
        </>
    );
}

export default function HotelInventoryClient({
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
                        <BreadcrumbPage>Hotel Inventory</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <PageHeader
                title="Hotel Inventory"
                description="Browse hotels, rooms and pricing — view only"
                icon={Building2}
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
                <HotelInventoryData page={page} limit={limit} search={search} status={status} />
            </Suspense>
        </div>
    );
}
