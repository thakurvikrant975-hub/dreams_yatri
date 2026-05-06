// (sales)/sales-query/page.tsx

import { Suspense } from "react";
import { TrendingUp } from "lucide-react";
import { Skeleton } from "../../components/ui/skeleton";
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import { getSalesQueries, getCloseReasons } from "./actions";
import { PackageQueryType } from "../../(marketing)/queries/actions";
import { SalesQueriesTable } from "./Salesqueriestable";
import type { Metadata } from "next";

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
            <div className="bg-muted/50 px-4 py-3 grid grid-cols-8 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-4" />
                ))}
            </div>
            {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="px-4 py-3 grid grid-cols-8 gap-4 border-t items-center">
                    <div className="space-y-1">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-4 w-24" />
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

async function SalesQueriesData() {
    const [queries, closeReasons] = await Promise.all([
        getSalesQueries(),
        getCloseReasons(),
    ]);
    return <SalesQueriesTable queries={queries as PackageQueryType[]} closeReasons={closeReasons} />;
}

export default function SalesQueryPage() {
    return (
        <div className="space-y-6">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>My Queries</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <TrendingUp className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold">My Assigned Queries</h1>
                        <p className="text-sm text-muted-foreground">
                            Manage and follow up on queries assigned to you
                        </p>
                    </div>
                </div>
            </div>

            <Suspense fallback={
                <div className="space-y-4">
                    <div className="grid grid-cols-5 gap-4">
                        {Array.from({ length: 5 }).map((_, i) => (
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
                <SalesQueriesData />
            </Suspense>
        </div>
    );
}