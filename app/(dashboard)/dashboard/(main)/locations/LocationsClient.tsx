import { Suspense } from "react";
import { MapPinned } from "lucide-react";
import { Skeleton } from "../components/ui/skeleton";
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { getLocations, type GetLocationsParams } from "./actions";
import { LocationsTable } from "./LocationsTable";
import { CreateLocationDialog } from "./LocationDialog";
import { MergeLocationsDialog } from "./MergeLocationsDialog";
import { PageHeader } from "../components/dashboard/PageHeader";

// ── Skeleton ──────────────────────────────────────────────────────────────────

function TableSkeleton() {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-xl border bg-card p-4 space-y-2">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-7 w-10" />
                    </div>
                ))}
            </div>
            <div className="rounded-xl border bg-card overflow-hidden">
                <div className="bg-muted/50 px-4 py-3 grid grid-cols-6 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-4" />)}
                </div>
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="px-4 py-3 grid grid-cols-6 gap-4 border-t items-center">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-5 w-10 mx-auto" />
                        <div className="flex justify-end gap-1">
                            <Skeleton className="h-8 w-8 rounded-md" />
                            <Skeleton className="h-8 w-8 rounded-md" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Async data component ──────────────────────────────────────────────────────

async function LocationsData({ params }: { params: GetLocationsParams }) {
    const { locations, totalCount, stats } = await getLocations(params);

    return (
        <LocationsTable
            locations={locations}
            totalCount={totalCount}
            limit={params.limit ?? 20}
            stats={stats}
            search={params.search ?? ""}
            filterType={params.type ?? "all"}
            filterScope={params.scope ?? "used"}
            filterStatus={params.status ?? "all"}
            currentPage={params.page ?? 1}
        />
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export async function LocationsClient({
    page,
    limit,
    search,
    type,
    scope,
    status,
}: {
    page:    number;
    limit:   number;
    search:  string;
    type:    GetLocationsParams["type"];
    scope:   "used" | "all";
    status:  "active" | "inactive" | "all";
}) {
    const params: GetLocationsParams = { page, limit, search, type, scope, status };

    return (
        <div className="space-y-6">

            {/* Breadcrumb */}
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>Locations</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <PageHeader
                title="Locations"
                description="Every geographic point used across hotels, activities and routes — view on a map and fix wrong ones"
                icon={MapPinned}
                actions={
                    <div className="flex items-center gap-2">
                        <MergeLocationsDialog />
                        <CreateLocationDialog />
                    </div>
                }
            />

            <Suspense key={`${page}-${limit}-${search}-${type}-${scope}-${status}`} fallback={<TableSkeleton />}>
                <LocationsData params={params} />
            </Suspense>

        </div>
    );
}
