import type { Metadata } from "next";
import { Suspense } from "react";
import { ClipboardCheck } from "lucide-react";
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { PageHeader } from "../components/dashboard/PageHeader";
import { StatCard, StatGrid } from "../components/dashboard/Statcard";
import { Skeleton } from "../components/ui/skeleton";
import { getSubmissions, type SubmissionStatusFilter } from "./actions";
import { SubmissionsTableClient } from "./SubmissionsTableClient";

export const metadata: Metadata = {
    title: "Property Submissions - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

const VALID_LIMITS = [10, 20, 50] as const;
const VALID_STATUS = ["pending", "approved", "rejected", "all"] as const;

function TableSkeleton() {
    return (
        <div className="rounded-xl border bg-card overflow-hidden">
            <div className="bg-muted/50 px-4 py-3 grid grid-cols-6 gap-4">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-4" />)}
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="px-4 py-3 grid grid-cols-6 gap-4 border-t items-center">
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-12 w-16 rounded-lg shrink-0" />
                        <div className="space-y-1.5">
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="h-3 w-20" />
                        </div>
                    </div>
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-20 mx-auto" />
                    <Skeleton className="h-4 w-20" />
                    <div className="flex justify-end"><Skeleton className="h-8 w-20 rounded-md" /></div>
                </div>
            ))}
        </div>
    );
}

async function SubmissionsData({
    page, limit, search, status,
}: {
    page: number; limit: number; search: string; status: SubmissionStatusFilter;
}) {
    const { hotels, totalCount, stats } = await getSubmissions({ page, limit, search, status });

    return (
        <>
            <StatGrid cols={4}>
                <StatCard label="Awaiting Review" value={stats.pending} icon={ClipboardCheck} />
                <StatCard label="Approved / Live" value={stats.approved} icon={ClipboardCheck} />
                <StatCard label="Rejected" value={stats.rejected} icon={ClipboardCheck} />
                <StatCard label="Total Submitted" value={stats.total} icon={ClipboardCheck} />
            </StatGrid>

            <SubmissionsTableClient
                hotels={hotels}
                totalCount={totalCount}
                limit={limit}
                currentPage={page}
                search={search}
                status={status}
            />
        </>
    );
}

export default async function PropertySubmissionsPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string>>;
}) {
    const sp = await searchParams;

    const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
    const rawLim = parseInt(sp.limit ?? "20", 10);
    const limit = (VALID_LIMITS as readonly number[]).includes(rawLim) ? rawLim : 20;
    const search = (sp.search ?? "").trim();
    const status = (VALID_STATUS as readonly string[]).includes(sp.status ?? "")
        ? (sp.status as SubmissionStatusFilter)
        : "pending";

    return (
        <div className="space-y-6">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem><BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink></BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem><BreadcrumbPage>Property Submissions</BreadcrumbPage></BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <PageHeader
                title="Property Submissions"
                description="Review hotel & homestay listings submitted by owners for approval"
                icon={ClipboardCheck}
            />

            <Suspense
                key={`${page}-${limit}-${search}-${status}`}
                fallback={
                    <div className="space-y-4">
                        <div className="grid grid-cols-4 gap-4">
                            {Array.from({ length: 4 }).map((_, i) => (
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
                <SubmissionsData page={page} limit={limit} search={search} status={status} />
            </Suspense>
        </div>
    );
}
