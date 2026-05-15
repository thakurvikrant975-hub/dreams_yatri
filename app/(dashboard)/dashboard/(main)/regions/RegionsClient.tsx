import { Suspense } from "react";
import { Earth, Globe, GlobeLock, MapPinHouse } from "lucide-react";
import { getRegions } from "./actions";
import { RegionsTable } from "./Regionstable";
import { CreateRegionSheet } from "./RegionSheet";
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
import { PageHeader } from "../components/dashboard/PageHeader";
import { StatCard, StatGrid } from "../components/dashboard/Statcard";


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
    const end = Math.min(totalPages - 1, currentPage + 1);
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
  const { regions, totalPages, currentPage, stats } = await getRegions({ page });

  return (
    <>
      <StatGrid cols={4}>
        <StatCard
          label="Total Regions"
          value={stats.total}
          icon={Earth}
        />
        <StatCard
          label="Active Regions"
          value={stats.active}
          icon={Earth}
        />
        <StatCard
          label="Inactives Regions"
          value={stats.inactive}
          icon={GlobeLock}
        />
        <StatCard
          label="Destinations"
          value={stats.destinations}
          icon={MapPinHouse}
        />
      </StatGrid>
      <RegionsTable
        regions={regions}
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={stats.total}

      />
      {/* TablePagination removed — DataTable renders it internally */}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function RegionsPage({ page }: { page: number }) {


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

      <PageHeader
        title="Regions"
        description="Manage travel regions and their destinations"
        icon={Globe}
        actions={<CreateRegionSheet />}
      />

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