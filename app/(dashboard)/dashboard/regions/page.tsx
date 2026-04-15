import { Suspense } from "react";
import { Globe } from "lucide-react";
import { getRegions } from "./actions";
import { RegionsTable } from "./Regionstable";
import { CreateRegionDialog } from "./RegionDialog";
import {
  Pagination, PaginationContent, PaginationEllipsis,
  PaginationItem, PaginationLink,
  PaginationNext, PaginationPrevious,
} from "../components/ui/pagination";

import {
  Breadcrumb, BreadcrumbItem,
  BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { Skeleton } from "../components/ui/skeleton";
import { Stats } from "../components/dashboard/Stats";

// ── Skeleton fallback ─────────────────────────────────────────────────────
function TableSkeleton() {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="bg-muted/50 px-4 py-3 grid grid-cols-7 gap-4">
        {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-4" />)}
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
function TablePagination({
  currentPage, totalPages,
}: {
  currentPage: number; totalPages: number;
}) {
  if (totalPages <= 1) return null;

  function getPageNumbers(): (number | "ellipsis")[] {
    if (totalPages <= 5)
      return Array.from({ length: totalPages }, (_, i) => i + 1);

    const pages: (number | "ellipsis")[] = [1];
    if (currentPage > 3) pages.push("ellipsis");

    const start = Math.max(2, currentPage - 1);
    const end   = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);

    if (currentPage < totalPages - 2) pages.push("ellipsis");
    pages.push(totalPages);
    return pages;
  }

  return (
    <div className="border-t px-4 py-3 flex items-center justify-between">
      <p className="text-xs text-muted-foreground">
        Page {currentPage} of {totalPages}
      </p>
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href={`?page=${currentPage - 1}`}
              aria-disabled={currentPage === 1}
              className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
            />
          </PaginationItem>
          {getPageNumbers().map((p, i) =>
            p === "ellipsis" ? (
              <PaginationItem key={`e-${i}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={p}>
                <PaginationLink href={`?page=${p}`} isActive={p === currentPage}>
                  {p}
                </PaginationLink>
              </PaginationItem>
            ),
          )}
          <PaginationItem>
            <PaginationNext
              href={`?page=${currentPage + 1}`}
              aria-disabled={currentPage === totalPages}
              className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}

// page is passed as a prop so RegionsData can fetch the correct slice
async function RegionsData({ page }: { page: number }) {
    const { regions, totalPages, currentPage, stats } = await getRegions(page);

    return (
        <>
            <Stats
                rows={[
                    { label: "Total Regions", value: stats.total },
                    { label: "Active", value: stats.active },
                    { label: "Inactive", value: stats.inactive, muted: true },
                    { label: "Destinations", value: stats.destinations },
                ]}
            />
            <RegionsTable
                regions={regions}
                currentPage={currentPage}
                totalPages={totalPages}
            />
            {/* TablePagination removed — DataTable renders it internally */}
        </>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────
export default async function RegionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

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
        <RegionsData page={page} />
      </Suspense>

    </div>
  );
}