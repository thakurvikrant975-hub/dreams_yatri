import { Suspense } from "react";
import Link from "next/link";
import { Package, Plus } from "lucide-react";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { getPackages, getDestinationsForPackageFilter, type GetPackagesParams } from "./actions";
import { PackagesTableClient } from "./components/PackagesTableClient";
import { PageHeader } from "../components/dashboard/PageHeader";
import { StatCard, StatGrid } from "../components/dashboard/Statcard";

// ── Skeleton ──────────────────────────────────────────────────────────────

function TableSkeleton() {
    return (
        <div className="rounded-xl border bg-card overflow-hidden">
            <div className="bg-muted/50 px-4 py-3 grid grid-cols-8 gap-4">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-4" />)}
            </div>
            {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="px-4 py-3 grid grid-cols-8 gap-4 border-t items-center">
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-12 w-16 rounded-lg shrink-0" />
                        <div className="space-y-1.5">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-24" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-3 w-14" />
                    </div>
                    <Skeleton className="h-4 w-8 mx-auto" />
                    <Skeleton className="h-4 w-8 mx-auto" />
                    <Skeleton className="h-4 w-8 mx-auto" />
                    <Skeleton className="h-5 w-10 mx-auto" />
                    <Skeleton className="h-4 w-28" />
                    <div className="flex justify-end gap-1">
                        <Skeleton className="h-8 w-8 rounded-md" />
                        <Skeleton className="h-8 w-8 rounded-md" />
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── Async data component ──────────────────────────────────────────────────

async function PackagesData({ params }: { params: GetPackagesParams }) {
    const [{ packages, totalCount, stats }, destinations] = await Promise.all([
        getPackages(params),
        getDestinationsForPackageFilter(),
    ]);

    return (
        <>
            <StatGrid cols={3}>
                <StatCard label="Total Packages"    value={stats.total}    icon={Package} />
                <StatCard label="Active Packages"   value={stats.active}   icon={Package} />
                <StatCard label="Inactive Packages" value={stats.inactive} icon={Package} />
            </StatGrid>

            <PackagesTableClient
                packages={packages}
                destinations={destinations}
                totalCount={totalCount}
                limit={params.limit ?? 20}
                currentPage={params.page ?? 1}
                search={params.search ?? ""}
                destination={params.destination ?? "all"}
                status={(params.status ?? "all") as "active" | "inactive" | "all"}
            />
        </>
    );
}

// ── Page shell ────────────────────────────────────────────────────────────

export default function PackagesPage({
    page,
    limit,
    search,
    status,
    destination,
}: {
    page:        number;
    limit:       number;
    search:      string;
    status:      "active" | "inactive" | "all";
    destination: number | "all";
}) {
    const params: GetPackagesParams = { page, limit, search, status, destination };

    return (
        <div className="space-y-6">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem><BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink></BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem><BreadcrumbPage>Packages</BreadcrumbPage></BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <PageHeader
                title="Packages"
                description="Create and manage travel packages"
                icon={Package}
                actions={
                    <Button asChild size="lg"
                        className="gap-2 bg-dashboard-primary text-dashboard-primary-content hover:bg-dashboard-primary/90 rounded-md transition-all duration-200 hover:scale-[1.02] shadow-sm">
                        <Link href="/dashboard/packages/new">
                            <Plus />
                            New Package
                        </Link>
                    </Button>
                }
            />

            <Suspense
                key={`${page}-${limit}-${search}-${String(destination)}-${status}`}
                fallback={
                    <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="rounded-xl border bg-card p-4 space-y-2">
                                    <Skeleton className="h-3 w-20" />
                                    <Skeleton className="h-7 w-10" />
                                </div>
                            ))}
                        </div>
                        <TableSkeleton />
                    </div>
                }
            >
                <PackagesData params={params} />
            </Suspense>
        </div>
    );
}
