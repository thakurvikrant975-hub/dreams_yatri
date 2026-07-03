import { Suspense } from "react";
import Link from "next/link";
import { Activity, Plus, Zap, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { PageHeader }       from "../components/dashboard/PageHeader";
import { StatCard, StatGrid } from "../components/dashboard/Statcard";
import { getActivities, getCategoriesForSelect, type GetActivitiesParams } from "./actions";
import { ActivitiesTableClient } from "./ActivitiesTableClient";

// ── Skeleton ──────────────────────────────────────────────────────────────

function TableSkeleton() {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-xl border bg-card p-4 space-y-2">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-7 w-10" />
                    </div>
                ))}
            </div>
            <div className="flex gap-3">
                <Skeleton className="h-9 flex-1 max-w-sm" />
                <Skeleton className="h-9 w-36" />
                <Skeleton className="h-9 w-24 ml-auto" />
            </div>
            <div className="rounded-xl border bg-card overflow-hidden">
                <div className="bg-muted/50 px-4 py-3 grid grid-cols-6 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-4" />)}
                </div>
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="px-4 py-3 grid grid-cols-6 gap-4 border-t items-center">
                        <div className="flex items-center gap-3 col-span-2">
                            <Skeleton className="h-10 w-14 rounded-lg" />
                            <Skeleton className="h-4 w-28" />
                        </div>
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-5 w-8 mx-auto" />
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

// ── Async data component ──────────────────────────────────────────────────

async function ActivitiesData({ params }: { params: GetActivitiesParams }) {
    const [{ activities, totalCount, isFiltering, stats, memberNames }, categories] = await Promise.all([
        getActivities(params),
        getCategoriesForSelect(),
    ]);

    return (
        <>
            <StatGrid cols={4}>
                <StatCard label="Total Activities"  value={stats.total}        icon={Activity}     />
                <StatCard label="Active"            value={stats.active}       icon={CheckCircle2} />
                <StatCard label="Inactive"          value={stats.inactive}     icon={XCircle}      />
                <StatCard label="With Variants"     value={stats.withVariants} icon={Zap}          />
            </StatGrid>

            <ActivitiesTableClient
                activities={activities}
                memberNames={memberNames}
                categories={categories}
                totalCount={totalCount}
                limit={params.limit ?? 10}
                currentPage={params.page ?? 1}
                isFiltering={isFiltering}
                search={params.search ?? ""}
                category_id={params.category_id ?? "all"}
                status={(params.status ?? "all") as "active" | "inactive" | "all"}
            />
        </>
    );
}

// ── Client component (server async) ──────────────────────────────────────

export async function ActivitiesClient({
    page,
    limit,
    search,
    status,
    category_id,
}: {
    page:        number;
    limit:       number;
    search:      string;
    status:      "active" | "inactive" | "all";
    category_id: number | "all";
}) {
    const params: GetActivitiesParams = { page, limit, search, status, category_id };

    return (
        <div className="space-y-6">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>Activities</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <PageHeader
                title="Activities"
                description="Manage activities across all destinations"
                icon={Activity}
                actions={
                    <Button asChild size="lg" className="rounded-md bg-dashboard-primary text-dashboard-base-100 py-2.5 px-4 hover:bg-dashboard-primary hover:scale-105 duration-300 hover:text-dashboard-base-100 border border-dashboard-primary">
                        <Link href="/dashboard/activities/new" className="">
                            <Plus className="mr-2 h-4 w-4" /> New Activity
                        </Link>
                    </Button>
                }
            />

            <Suspense
                key={`${page}-${limit}-${search}-${String(category_id)}-${status}`}
                fallback={<TableSkeleton />}
            >
                <ActivitiesData params={params} />
            </Suspense>
        </div>
    );
}
