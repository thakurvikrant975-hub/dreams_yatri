import { Suspense } from "react";
import { MapPin } from "lucide-react";
import { Skeleton } from "../components/ui/skeleton";
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { getDestinations, getRegionsForSelect, type GetDestinationsParams } from "./actions";
import { DestinationsTable } from "./Destinationstable";
import { CreateDestinationDialog } from "./Destinationdialog";
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
                <div className="bg-muted/50 px-4 py-3 grid grid-cols-7 gap-4">
                    {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-4" />)}
                </div>
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="px-4 py-3 grid grid-cols-7 gap-4 border-t items-center">
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-10 w-14 rounded-lg shrink-0" />
                            <div className="space-y-1">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-3 w-16" />
                            </div>
                        </div>
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-10 w-14 rounded-lg" />
                        <Skeleton className="h-5 w-16 mx-auto" />
                        <Skeleton className="h-4 w-16 mx-auto" />
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

async function DestinationsData({
    regions,
    params,
}: {
    regions: Awaited<ReturnType<typeof getRegionsForSelect>>;
    params:  GetDestinationsParams;
}) {
    const { destinations, totalCount, stats, memberNames } = await getDestinations(params);

    return (
        <DestinationsTable
            destinations={destinations}
            memberNames={memberNames}
            regions={regions}
            totalCount={totalCount}
            limit={params.limit ?? 10}
            stats={stats}
            search={params.search ?? ""}
            filterRegion={params.region_id ? String(params.region_id) : "all"}
            filterStatus={params.status ?? "all"}
            currentPage={params.page ?? 1}
        />
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export async function DestinationsClient({
    page,
    limit,
    search,
    region_id,
    status,
}: {
    page:       number;
    limit:      number;
    search:     string;
    region_id?: number;
    status:     "active" | "inactive" | "all";
}) {
    // Single fetch — shared between CreateDestinationDialog and DestinationsTable
    const regions = await getRegionsForSelect();
    const params: GetDestinationsParams = { page, limit, search, region_id, status };

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
                        <BreadcrumbPage>Destinations</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <PageHeader
                title="Destinations"
                description="Manage travel destinations within each region"
                icon={MapPin}
                actions={<CreateDestinationDialog regions={regions} />}
            />

            <Suspense key={`${page}-${limit}-${search}-${region_id}-${status}`} fallback={<TableSkeleton />}>
                <DestinationsData regions={regions} params={params} />
            </Suspense>

        </div>
    );
}
