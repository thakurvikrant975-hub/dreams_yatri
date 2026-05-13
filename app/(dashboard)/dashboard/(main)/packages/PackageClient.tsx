import { Suspense } from "react";
import Link from "next/link";
import { Package, Plus } from "lucide-react";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { getPackages } from "./actions";
import { PackagesTableClient } from "./components/PackagesTableClient";
import { PageHeader } from "../components/dashboard/PageHeader";
import { StatCard, StatGrid } from "../components/dashboard/Statcard";

// ── Skeleton ──────────────────────────────────────────────────────────────

function TableSkeleton() {
    return (
        <div className="rounded-xl border bg-card overflow-hidden">
            <div className="bg-muted/50 px-4 py-3 grid grid-cols-7 gap-4">
                {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-4" />)}
            </div>
            {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="px-4 py-3 grid grid-cols-7 gap-4 border-t items-center">
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
                    <div className="flex justify-end gap-1">
                        <Skeleton className="h-8 w-8 rounded-md" />
                        <Skeleton className="h-8 w-8 rounded-md" />
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── Data component ────────────────────────────────────────────────────────

async function PackagesData() {
    const packages = await getPackages();

    const activeCount = packages.filter(p => p.is_active).length;
    const inactiveCount = packages.length - activeCount;

    return (
        <>

           <StatGrid cols={3}>
                <StatCard
                    label="Total Packages"
                    value={packages.length}
                    icon={Package}
                />
                <StatCard
                    label="Active Packages"
                    value={activeCount}
                    icon={Package}
                />
                <StatCard
                    label="Inactive Packages"
                    value={inactiveCount}
                    icon={Package}
                />

            </StatGrid>

            <PackagesTableClient packages={packages} />
        </>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function PackagesPage() {
    return (
        <div className="space-y-6">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>Packages</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>


            <PageHeader
                title="Packages"
                description="Create and manage travel packages"
                icon={Package}
                actions={<Button asChild size="lg"
                    className="gap-2 bg-dashboard-primary text-dashboard-primary-content hover:bg-dashboard-primary/90 rounded-md transition-all duration-200 hover:scale-[1.02] shadow-sm">
                    <Link href="/dashboard/packages/new">
                        <Plus />
                        New Package
                    </Link>
                </Button>}
            />

            <Suspense
                fallback={
                    <div className="space-y-4">
                        <div className="grid grid-cols-4 gap-4">
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
                <PackagesData />
            </Suspense>
        </div>
    );
}
