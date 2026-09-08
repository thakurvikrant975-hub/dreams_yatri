import { Suspense } from "react";
import { RotateCcw } from "lucide-react";
import { getReopenRequestsQueue, type ReopenRequestsFilter } from "./actions";
import { ReopenRequestsTable } from "./ReopenRequestsTable";
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

async function ReopenRequestsData({
    page, limit, search, filter,
}: {
    page: number;
    limit: number;
    search: string;
    filter: ReopenRequestsFilter;
}) {
    const { rows, totalCount, stats } = await getReopenRequestsQueue({ page, limit, search, filter });

    return (
        <ReopenRequestsTable
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

export default function ReopenRequestsClient({
    page, limit, search, filter,
}: {
    page: number;
    limit: number;
    search: string;
    filter: ReopenRequestsFilter;
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
                        <BreadcrumbPage>Reopen Requests</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <PageHeader
                title="Reopen Requests"
                description="Closed queries a sales exec has asked to reopen — review, and approve back into their active list"
                icon={RotateCcw}
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
                <ReopenRequestsData page={page} limit={limit} search={search} filter={filter} />
            </Suspense>
        </div>
    );
}
