import { Suspense } from "react";
import { MapPin } from "lucide-react";
import { Skeleton } from "../components/ui/skeleton";
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { getDestinations, getRegionsForSelect } from "./actions";
import { DestinationsTable } from "./Destinationstable";
import { CreateDestinationDialog } from "./Destinationdialog";

// ── Skeleton ──────────────────────────────────────────────────────────────

function TableSkeleton() {
    return (
        <div className="rounded-xl border bg-card overflow-hidden">
            <div className="bg-muted/50 px-4 py-3 grid grid-cols-7 gap-4">
                {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-4" />)}
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-4 py-3 grid grid-cols-7 gap-4 border-t items-center">
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                        <div className="space-y-1">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-3 w-16" />
                        </div>
                    </div>
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-4 w-16 mx-auto" />
                    <Skeleton className="h-5 w-10 mx-auto" />
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

// ── Async data component ──────────────────────────────────────────────────
async function DestinationsData() {
    const [destinations, regions] = await Promise.all([
        getDestinations(),
        getRegionsForSelect(),
    ]);
 
    // Stats and filters are now handled inside DestinationsTable
    return <DestinationsTable destinations={destinations} regions={regions} />;
}

// ── Page ──────────────────────────────────────────────────────────────────

async function CreateButtonData() {
    const regions = await getRegionsForSelect();
    return <CreateDestinationDialog regions={regions} />;
}
export default function DestinationsPage() {
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
                        <BreadcrumbPage>Destinations</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>
 
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold">Destinations</h1>
                        <p className="text-sm text-muted-foreground">
                            Manage travel destinations within each region
                        </p>
                    </div>
                </div>
 
                <Suspense fallback={<Skeleton className="h-9 w-36" />}>
                    <CreateButtonData />
                </Suspense>
            </div>
 
            {/* Data */}
            <Suspense fallback={
                <div className="space-y-4">
                    <div className="grid grid-cols-4 gap-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="rounded-xl border bg-card p-4 space-y-2">
                                <Skeleton className="h-3 w-16" />
                                <Skeleton className="h-7 w-10" />
                            </div>
                        ))}
                    </div>
                    <TableSkeleton />
                </div>
            }>
                <DestinationsData />
            </Suspense>
 
        </div>
    );
}