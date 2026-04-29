import { Suspense } from "react";
import Link from "next/link";
import { Hotel, Plus } from "lucide-react";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { getHotels } from "./actions";
import { HotelsTableClient } from "./HotelsTableClient";
import { Field } from "../components/ui/field";
import { Input } from "../components/ui/input";

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

    return (
        <>
            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
                {[
                    { label: "Total Hotels", value: hotels.length },
                    { label: "Active", value: activeCount, highlight: true },
                    { label: "Total Rooms", value: totalRooms },
                    { label: "In Packages", value: hotels.reduce((a, h) => a + h._count.packages, 0) },
                ].map(stat => (
                    <div key={stat.label} className="rounded-xl border bg-card p-4">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                        <p className={`text-2xl font-bold mt-1 ${stat.highlight ? "text-primary" : ""}`}>
                            {stat.value}
                        </p>
                    </div>
                ))}
            </div>

            <HotelsTableClient hotels={hotels} />
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

            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Hotel className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold">Hotels</h1>
                        <p className="text-sm text-muted-foreground">Manage hotel properties across all destinations</p>
                    </div>
                </div>


                <div className="flex items-center gap-8">
                    <Field orientation="horizontal">
                        <Input type="search" placeholder="Search..." className="w-[220px] h-10 w-64" />
                        <Button className="cursor-pointer h-10 w-24">Search</Button>
                    </Field>

                    <Button asChild className="h-10">
                        <Link href="/dashboard/hotels/new">
                            <Plus className="mr-2 h-5 w-4" />
                            Add Hotel
                        </Link>
                    </Button>
                </div>
            </div>

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