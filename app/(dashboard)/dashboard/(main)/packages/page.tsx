import { Suspense } from "react";
import Link from "next/link";
import { Package, Plus } from "lucide-react";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { getPackages } from "./actions";
import { PackagesTableClient } from "./components/PackagesTableClient";

// ── Skeleton ──────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="bg-muted/50 px-4 py-3 grid grid-cols-7 gap-4">
        {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-4" />)}
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="px-4 py-3 grid grid-cols-7 gap-4 border-t items-center">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-16 rounded-lg shrink-0" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <div className="space-y-1">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-3 w-14" />
          </div>
          <Skeleton className="h-4 w-8 mx-auto" />
          <Skeleton className="h-4 w-8 mx-auto" />
          <Skeleton className="h-4 w-8 mx-auto" />
          <Skeleton className="h-5 w-10 mx-auto" />
          <div className="flex justify-end gap-1">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Data component ────────────────────────────────────────────────────────

async function PackagesData() {
  const packages = await getPackages();

  const activeCount = packages.filter(p => p.is_active).length;
  const inactiveCount = packages.length - activeCount;

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Packages", value: packages.length },
          { label: "Active", value: activeCount, highlight: true },
          { label: "Inactive", value: inactiveCount },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.highlight ? "text-primary" : ""}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <PackagesTableClient packages={packages} />
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function PackagesPage() {
  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Packages</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Packages</h1>
            <p className="text-sm text-muted-foreground">
              Create and manage travel packages with durations, itineraries and pricing
            </p>
          </div>
        </div>

        <Button asChild className="h-10">
          <Link href="/dashboard/packages/new">
            <Plus className="mr-2 h-4 w-4" />
            New Package
          </Link>
        </Button>
      </div>

      <Suspense
        fallback={
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
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
        <PackagesData />
      </Suspense>
    </div>
  );
}
