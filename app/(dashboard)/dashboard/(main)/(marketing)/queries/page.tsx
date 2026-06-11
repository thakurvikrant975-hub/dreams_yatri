// /(marketing)/queries/page.tsx


import { Suspense } from "react";
import { Inbox } from "lucide-react";
import { Skeleton } from "../../components/ui/skeleton";
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import { getQueries, getRejectionReasons } from "./actions";
import { QueriesTable } from "./Queriestable";
import { AddQueryDialog } from "./Addquerydialog";
import type { Metadata } from "next";
import { PageHeader } from "../../components/dashboard/PageHeader";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "All Queries - Dashboard",
    description: "Admin dashboard for managing all queries",
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

// ── Skeleton ──────────────────────────────────────────────────────────────────

function TableSkeleton() {
    return (
        <div className="rounded-xl border bg-card overflow-hidden">
            <div className="bg-muted/50 px-4 py-3 grid grid-cols-7 gap-4">
                {Array.from({ length: 7 }).map((_, i) => (
                    <Skeleton key={i} className="h-4" />
                ))}
            </div>
            {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="px-4 py-3 grid grid-cols-7 gap-4 border-t items-center">
                    <div className="space-y-1">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-14" />
                    <Skeleton className="h-4 w-8 mx-auto" />
                    <div className="flex justify-end gap-1">
                        <Skeleton className="h-8 w-8 rounded-md" />
                        <Skeleton className="h-8 w-8 rounded-md" />
                        <Skeleton className="h-8 w-8 rounded-md" />
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── Async data ────────────────────────────────────────────────────────────────

async function QueriesData() {
    const [queries, reasons] = await Promise.all([
        getQueries(),
        getRejectionReasons(),
    ]);
    return <QueriesTable queries={queries} reasons={reasons} />;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function QueriesPage() {
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
                        <BreadcrumbPage>Queries</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>
  
            <PageHeader
                title="Lead Queries"
                description="Manage, verify, and action all incoming enquiries"
                icon={Inbox}
                actions={<AddQueryDialog />}
            />

            {/* Data of data */}
            <Suspense fallback={
                <div className="space-y-4">
                    <div className="grid grid-cols-6 gap-4">
                        {Array.from({ length: 6 }).map((_, i) => (
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
                <QueriesData />
            </Suspense>

        </div>
    );
}