// (sales)/sales-query/page.tsx

import { Suspense } from "react";
import { TrendingUp } from "lucide-react";
import { Skeleton } from "../../components/ui/skeleton";
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import { getSalesQueries, getCloseReasons, getRejectionReasons, isSalesTeamLeader, getMyTeamMembers } from "./actions";
import { SalesQueriesTable } from "./Salesqueriestable";
import type { Metadata } from "next";
import { PageHeader } from "../../components/dashboard/PageHeader";

export const metadata: Metadata = {
    title: "Sales Queries - Dashboard",
    description: "Admin dashboard for managing sales queries",
    robots: {
        index: false,
        follow: false,
        nocache: true,
        googleBot: {
            index: false,
            follow: false,
        },
    },
};

function TableSkeleton() {
    return (
        <div className="rounded-xl border bg-card overflow-hidden">
            <div className="bg-muted/50 px-4 py-3 grid grid-cols-9 gap-4">
                {Array.from({ length: 9 }).map((_, i) => (
                    <Skeleton key={i} className="h-4" />
                ))}
            </div>
            {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="px-4 py-3 grid grid-cols-9 gap-4 border-t items-center">
                    <div className="space-y-1">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-7 w-24 rounded-md mx-auto" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-14" />
                    <Skeleton className="h-4 w-8 mx-auto" />
                    <Skeleton className="h-4 w-20" />
                    <div className="flex justify-end gap-1">
                        <Skeleton className="h-8 w-8 rounded-md" />
                        <Skeleton className="h-8 w-8 rounded-md" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function todayStr() {
    return new Date().toISOString().split("T")[0];
}
function firstOfMonthStr() {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
}

async function SalesQueriesData({ from, to, isAllTime, isTeamLead }: { from?: string; to?: string; isAllTime: boolean; isTeamLead: boolean }) {
    const [queries, closeReasons, rejectionReasons, teamMembers] = await Promise.all([
        getSalesQueries(from, to),
        getCloseReasons(),
        getRejectionReasons(),
        // Empty for anyone who isn't a Team Leader — only feeds the
        // "Assigned To" filter, which only renders for a leader anyway.
        getMyTeamMembers(),
    ]);
    return (
        <SalesQueriesTable
            queries={queries}
            closeReasons={closeReasons}
            rejectionReasons={rejectionReasons}
            teamMembers={teamMembers}
            from={from ?? firstOfMonthStr()}
            to={to ?? todayStr()}
            isAllTime={isAllTime}
            isTeamLead={isTeamLead}
        />
    );
}

export default async function SalesQueryPage({
    searchParams,
}: {
    searchParams: Promise<{ from?: string; to?: string; range?: string }>;
}) {
    const sp = await searchParams;
    const isAllTime = sp.range === "all";
    const from = isAllTime ? undefined : (sp.from ?? firstOfMonthStr());
    const to = isAllTime ? undefined : (sp.to ?? todayStr());
    const isTeamLead = await isSalesTeamLeader();

    return (
        <div className="space-y-6">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>{isTeamLead ? "Team Queries" : "My Queries"}</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <PageHeader
                title={isTeamLead ? "Team Queries" : "My Queries"}
                description={isTeamLead ? "All queries assigned to your team" : "All queries assigned to you"}
                icon={TrendingUp}
            />

            <Suspense fallback={
                <div className="space-y-4">
                    <div className="h-10 rounded-xl border bg-card" />
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
                        {Array.from({ length: 7 }).map((_, i) => (
                            <div key={i} className="rounded-xl border bg-card p-4 space-y-2">
                                <Skeleton className="h-3 w-16" />
                                <Skeleton className="h-7 w-10" />
                            </div>
                        ))}
                    </div>
                    <div className="h-12 rounded-xl border bg-card" />
                    <TableSkeleton />
                </div>
            }>
                <SalesQueriesData from={from} to={to} isAllTime={isAllTime} isTeamLead={isTeamLead} />
            </Suspense>
        </div>
    );
}