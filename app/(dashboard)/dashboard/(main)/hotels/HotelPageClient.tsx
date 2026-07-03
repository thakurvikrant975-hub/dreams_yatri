import { Suspense } from "react";
import Link from "next/link";
import { Building2, Hotel, Plus } from "lucide-react";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { PageHeader } from "../components/dashboard/PageHeader";
import { StatCard, StatGrid } from "../components/dashboard/Statcard";
import { getHotels, getDestinationsForHotelFilter, type GetHotelsParams } from "./actions";
import { HotelsTableClient } from "./HotelsTableClient";

// ── Skeleton ──────────────────────────────────────────────────────────────

function TableSkeleton() {
    return (
        <div className="rounded-xl border bg-card overflow-hidden">
            <div className="bg-muted/50 px-4 py-3 grid grid-cols-7 gap-4">
                {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-4" />)}
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="px-4 py-3 grid grid-cols-7 gap-4 border-t items-center">
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-12 w-16 rounded-lg shrink-0" />
                        <div className="space-y-1.5">
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="h-3 w-20" />
                        </div>
                    </div>
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-4 w-12 mx-auto" />
                    <Skeleton className="h-4 w-8 mx-auto" />
                    <Skeleton className="h-5 w-10 mx-auto" />
                    <div className="flex justify-end gap-1">
                        <Skeleton className="h-8 w-16 rounded-md" />
                        <Skeleton className="h-8 w-8 rounded-md" />
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── Async data component ──────────────────────────────────────────────────

async function HotelsData({ params }: { params: GetHotelsParams }) {
    const [{ hotels: rawHotels, memberNames, totalCount, stats }, destinations] = await Promise.all([
        getHotels(params),
        getDestinationsForHotelFilter(),
    ]);

    const hotels = rawHotels.map((h) => ({
        ...h,
        margin_percentage: Number(h.margin_percentage),
        gst_percentage:    Number(h.gst_percentage),
    }));

    return (
        <>
            <StatGrid cols={3}>
                <StatCard label="Total Hotels"  value={stats.total}      icon={Hotel}     />
                <StatCard label="Active Hotels" value={stats.active}     icon={Hotel}     />
                <StatCard label="Total Rooms"   value={stats.totalRooms} icon={Building2} />
            </StatGrid>

            <HotelsTableClient
                hotels={hotels}
                memberNames={memberNames}
                destinations={destinations}
                totalCount={totalCount}
                limit={params.limit ?? 20}
                currentPage={params.page ?? 1}
                search={params.search ?? ""}
                destination={params.destination ?? "all"}
                category={params.category ?? "all"}
                status={(params.status ?? "all") as "active" | "inactive" | "all"}
            />
        </>
    );
}

// ── Page shell ────────────────────────────────────────────────────────────

export async function HotelsPageServer({
    page,
    limit,
    search,
    status,
    destination,
    category,
}: {
    page:        number;
    limit:       number;
    search:      string;
    status:      "active" | "inactive" | "all";
    destination: number | "all";
    category:    string | "all";
}) {
    const params: GetHotelsParams = { page, limit, search, status, destination, category };

    return (
        <div className="space-y-6">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem><BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink></BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem><BreadcrumbPage>Hotels</BreadcrumbPage></BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <PageHeader
                title="Hotels Builder"
                description="Add and Manage hotel properties"
                icon={Hotel}
                actions={
                    <Button asChild size="lg"
                        className="gap-2 bg-dashboard-primary text-dashboard-primary-content hover:bg-dashboard-primary/90 rounded-md transition-all duration-200 hover:scale-[1.02] shadow-sm">
                        <Link href="/dashboard/hotels/new">
                            <Plus />
                            Add Hotel
                        </Link>
                    </Button>
                }
            />

            <Suspense
                key={`${page}-${limit}-${search}-${String(destination)}-${category}-${status}`}
                fallback={
                    <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
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
                <HotelsData params={params} />
            </Suspense>
        </div>
    );
}
