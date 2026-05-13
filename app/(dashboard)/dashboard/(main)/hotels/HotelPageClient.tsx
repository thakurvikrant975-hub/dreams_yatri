import { Suspense } from "react";
import Link from "next/link";
import { Building2, Hotel, House, Plus } from "lucide-react";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { getHotels } from "./actions";
import { HotelsTableClient } from "./HotelsTableClient";
import { StatGrid, StatCard } from "../components/dashboard/Statcard";
import { PageHeader } from "../components/dashboard/PageHeader";

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

// ── Data component ────────────────────────────────────────────────────────

async function HotelsData() {
    const hotels = await getHotels();

    const activeCount = hotels.filter(h => h.is_active).length;
    const totalRooms = hotels.reduce((acc, h) => acc + h._count.hotelRooms, 0);

    // Derive unique destinations from fetched hotels
    const destinations = Array.from(
        new Map(hotels.map(h => [h.destination.id, h.destination])).values()
    );

    return (
        <>
            <StatGrid cols={3}>
                <StatCard label="Total Hotels"  value={hotels.length} icon={Hotel}     />
                <StatCard label="Active Hotels" value={activeCount}   icon={Hotel}     />
                <StatCard label="Total Rooms"   value={totalRooms}    icon={Building2} />
            </StatGrid>

            <HotelsTableClient hotels={hotels} destinations={destinations} />
        </>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function HotelsPage() {
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

            <Suspense fallback={
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
            }>
                <HotelsData />
            </Suspense>
        </div>
    );
}