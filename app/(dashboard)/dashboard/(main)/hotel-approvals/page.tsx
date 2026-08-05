import type { Metadata } from "next";
import { Suspense } from "react";
import { BadgeCheck, ClipboardCheck, CircleAlert, Hotel } from "lucide-react";
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { PageHeader } from "../components/dashboard/PageHeader";
import { StatCard, StatGrid } from "../components/dashboard/Statcard";
import { Skeleton } from "../components/ui/skeleton";
import {
    getHotelApprovals, getDestinationsForApprovalFilter, type ApprovalStatusFilter,
} from "./actions";
import { HotelApprovalsTableClient } from "./HotelApprovalsTableClient";

export const metadata: Metadata = {
    title: "Hotel Approvals - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

const VALID_LIMITS = [10, 20, 50] as const;
const VALID_STATUS = ["pending", "approved", "changes", "all"] as const;

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
                    <Skeleton className="h-2 w-28" />
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-4 w-20" />
                    <div className="flex justify-end"><Skeleton className="h-8 w-20 rounded-md" /></div>
                </div>
            ))}
        </div>
    );
}

async function ApprovalsData({
    page, limit, search, status, destination,
}: {
    page: number; limit: number; search: string;
    status: ApprovalStatusFilter; destination: number | "all";
}) {
    const [{ hotels, reviewers, totalCount, stats }, destinations] = await Promise.all([
        getHotelApprovals({ page, limit, search, status, destination }),
        getDestinationsForApprovalFilter(),
    ]);

    return (
        <>
            <StatGrid cols={4}>
                <StatCard label="Awaiting Review" value={stats.pending} icon={ClipboardCheck} />
                <StatCard label="Approved" value={stats.approved} icon={BadgeCheck} />
                <StatCard label="Changes Requested" value={stats.changes} icon={CircleAlert} />
                <StatCard label="Total Hotels" value={stats.total} icon={Hotel} />
            </StatGrid>

            <HotelApprovalsTableClient
                hotels={hotels}
                reviewers={reviewers}
                destinations={destinations}
                totalCount={totalCount}
                limit={limit}
                currentPage={page}
                search={search}
                status={status}
                destination={destination}
            />
        </>
    );
}

export default async function HotelApprovalsPage({
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
        ? (sp.status as ApprovalStatusFilter)
        : "pending";
    const rawDest = sp.destination ?? "all";
    const destination = rawDest === "all" ? ("all" as const) : ((parseInt(rawDest, 10) || "all") as number | "all");

    return (
        <div className="space-y-6">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem><BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink></BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem><BreadcrumbPage>Hotel Approvals</BreadcrumbPage></BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <PageHeader
                title="Hotel Approvals"
                description="Manager sign-off on hotel content. Unapproved hotels stay live — this only tracks what has been checked."
                icon={BadgeCheck}
            />

            <Suspense
                key={`${page}-${limit}-${search}-${status}-${String(destination)}`}
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
                <ApprovalsData page={page} limit={limit} search={search} status={status} destination={destination} />
            </Suspense>
        </div>
    );
}
