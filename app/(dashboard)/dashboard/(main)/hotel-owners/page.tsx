import type { Metadata } from "next";
import { Suspense } from "react";
import { Users, ShieldCheck, ShieldAlert, Building2 } from "lucide-react";
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { PageHeader } from "../components/dashboard/PageHeader";
import { StatCard, StatGrid } from "../components/dashboard/Statcard";
import { Skeleton } from "../components/ui/skeleton";
import { getHotelOwners, type OwnerVerifiedFilter } from "./actions";
import { HotelOwnersTableClient } from "./HotelOwnersTableClient";

export const metadata: Metadata = {
    title: "Hotel Owners - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

const VALID_LIMITS = [10, 20, 50] as const;
const VALID_VERIFIED = ["all", "verified", "unverified"] as const;

function TableSkeleton() {
    return (
        <div className="rounded-xl border bg-card overflow-hidden">
            <div className="bg-muted/50 px-4 py-3 grid grid-cols-6 gap-4">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-4" />)}
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="px-4 py-3 grid grid-cols-6 gap-4 border-t items-center">
                    <div className="space-y-1.5">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-4 w-20" />
                </div>
            ))}
        </div>
    );
}

async function HotelOwnersData({
    page, limit, search, verified,
}: {
    page: number; limit: number; search: string; verified: OwnerVerifiedFilter;
}) {
    const { owners, totalCount, stats } = await getHotelOwners({ page, limit, search, verified });

    return (
        <>
            <StatGrid cols={4}>
                <StatCard label="Total Owners" value={stats.total} icon={Users} />
                <StatCard label="Verified" value={stats.verified} icon={ShieldCheck} />
                <StatCard label="Unverified" value={stats.unverified} icon={ShieldAlert} />
                <StatCard label="Live Listings" value={stats.activeListings} icon={Building2} />
            </StatGrid>

            <HotelOwnersTableClient
                owners={owners}
                totalCount={totalCount}
                limit={limit}
                currentPage={page}
                search={search}
                verified={verified}
            />
        </>
    );
}

export default async function HotelOwnersPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string>>;
}) {
    const sp = await searchParams;

    const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
    const rawLim = parseInt(sp.limit ?? "20", 10);
    const limit = (VALID_LIMITS as readonly number[]).includes(rawLim) ? rawLim : 20;
    const search = (sp.search ?? "").trim();
    const verified = (VALID_VERIFIED as readonly string[]).includes(sp.verified ?? "")
        ? (sp.verified as OwnerVerifiedFilter)
        : "all";

    return (
        <div className="space-y-6">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem><BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink></BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem><BreadcrumbPage>Hotel Owners</BreadcrumbPage></BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <PageHeader
                title="Hotel Owners"
                description="Registered hotel-connect accounts — verify owners and check in on their properties"
                icon={Users}
            />

            <Suspense
                key={`${page}-${limit}-${search}-${verified}`}
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
                <HotelOwnersData page={page} limit={limit} search={search} verified={verified} />
            </Suspense>
        </div>
    );
}
