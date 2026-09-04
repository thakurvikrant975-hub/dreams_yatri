import { Suspense } from "react";
import { ClipboardCheck } from "lucide-react";
import { getLeadRequestsQueue, type LeadRequestsFilter } from "./actions";
import { LeadRequestsTable } from "./LeadRequestsTable";
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
                    <Skeleton className="h-10 w-36" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-7 w-24 ml-auto" />
                </div>
            ))}
        </div>
    );
}

async function LeadRequestsData({
    page, limit, search, filter,
}: {
    page: number;
    limit: number;
    search: string;
    filter: LeadRequestsFilter;
}) {
    const { rows, totalCount, stats } = await getLeadRequestsQueue({ page, limit, search, filter });

    return (
        <LeadRequestsTable
            requests={rows}
            stats={stats}
            currentPage={page}
            totalPages={Math.max(1, Math.ceil(totalCount / limit))}
            totalCount={totalCount}
            limit={limit}
            search={search}
            filter={filter}
        />
    );
}

export default function LeadRequestsClient({
    page, limit, search, filter,
}: {
    page: number;
    limit: number;
    search: string;
    filter: LeadRequestsFilter;
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
                        <BreadcrumbPage>Lead Requests</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <PageHeader
                title="Lead Requests"
                description="Leads sales executives have asked to add — review, and accept into the pipeline"
                icon={ClipboardCheck}
            />

            <Suspense
                key={`${page}-${limit}-${search}-${filter}`}
                fallback={
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                <LeadRequestsData page={page} limit={limit} search={search} filter={filter} />
            </Suspense>
        </div>
    );
}
