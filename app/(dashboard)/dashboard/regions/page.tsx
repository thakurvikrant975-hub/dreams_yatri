import { Suspense } from "react";
import { Globe } from "lucide-react";
import { getRegions } from "./actions";
import { RegionsTable } from "./Regionstable";
import { CreateRegionDialog } from "./RegionDialog";

import {
  Breadcrumb, BreadcrumbItem,
  BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { Skeleton } from "../components/ui/skeleton";

// ── Skeleton fallback ──────────────────────────────────────────────────────
function TableSkeleton() {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="bg-muted/50 px-4 py-3 grid grid-cols-7 gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-4" />
        ))}
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="px-4 py-3 grid grid-cols-7 gap-4 border-t items-center">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-8 mx-auto" />
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

// ── Async data component ───────────────────────────────────────────────────
async function RegionsData() {
  const regions = await getRegions();

  const activeCount = regions.filter(r => r.is_active).length;
  const totalDest = regions.reduce((acc, r) => acc + r._count.destinations, 0);

  return (
    <>
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Total</p>
          <p className="text-2xl font-bold mt-1">{regions.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Active</p>
          <p className="text-2xl font-bold mt-1 text-primary">{activeCount}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Destinations</p>
          <p className="text-2xl font-bold mt-1">{totalDest}</p>
        </div>
      </div>

      {/* Table */}
      <RegionsTable regions={regions} />
    </>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function RegionsPage() {
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
            <BreadcrumbPage>Regions</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Regions</h1>
            <p className="text-sm text-muted-foreground">
              Manage travel regions and their destinations
            </p>
          </div>
        </div>
        <CreateRegionDialog />
      </div>

      {/* Data — Suspense streams the table in */}
      <Suspense fallback={
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-card p-4 space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-7 w-10" />
              </div>
            ))}
          </div>
          <TableSkeleton />
        </div>
      }>
        <RegionsData />
      </Suspense>

    </div>
  );
}