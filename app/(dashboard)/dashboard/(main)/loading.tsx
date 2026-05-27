import { Skeleton } from "./components/ui/skeleton";

export default function DashboardPageLoading() {
    return (
        <div className="space-y-6">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-3" />
                <Skeleton className="h-4 w-28" />
            </div>

            {/* Page header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="space-y-1.5">
                        <Skeleton className="h-6 w-36" />
                        <Skeleton className="h-4 w-56" />
                    </div>
                </div>
                <Skeleton className="h-9 w-28 rounded-md" />
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-xl border bg-card p-4 space-y-2">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-7 w-10" />
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="rounded-xl border bg-card overflow-hidden">
                <div className="bg-muted/50 px-4 py-3 grid grid-cols-6 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-4" />
                    ))}
                </div>
                {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="px-4 py-3 grid grid-cols-6 gap-4 border-t items-center">
                        <div className="col-span-2 flex items-center gap-2">
                            <Skeleton className="h-9 w-12 rounded-md shrink-0" />
                            <div className="space-y-1">
                                <Skeleton className="h-4 w-28" />
                                <Skeleton className="h-3 w-20" />
                            </div>
                        </div>
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-5 w-16 mx-auto" />
                        <Skeleton className="h-5 w-14 mx-auto" />
                        <div className="flex justify-end gap-1">
                            <Skeleton className="h-8 w-8 rounded-md" />
                            <Skeleton className="h-8 w-8 rounded-md" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
