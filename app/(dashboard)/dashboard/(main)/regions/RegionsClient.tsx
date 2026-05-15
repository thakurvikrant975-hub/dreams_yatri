import { Suspense } from "react";
import { Earth, Globe, GlobeLock, MapPinHouse } from "lucide-react";
import { getRegions } from "./actions";
import { RegionsTable } from "./Regionstable";
import { CreateRegionSheet } from "./RegionSheet";
import {
  Breadcrumb, BreadcrumbItem,
  BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { Skeleton } from "../components/ui/skeleton";
import { PageHeader } from "../components/dashboard/PageHeader";
import { StatCard, StatGrid } from "../components/dashboard/Statcard";

type Status    = "active" | "inactive" | "all";
type DestCount = "0" | "1-5" | "6-15" | "15+" | "all";

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

// ── Data async sub-component ──────────────────────────────────────────────
async function RegionsData({
  page, limit, search, country, status, destCount,
}: {
  page: number; limit: number; search: string; country: string;
  status: Status; destCount: DestCount;
}) {
  const { regions, totalPages, currentPage, stats, totalCount, limit: lim } =
    await getRegions({ page, limit, search, country, status, destCount });

  return (
    <>
      <StatGrid cols={4}>
        <StatCard label="Total Regions"    value={stats.total}        icon={Earth}      />
        <StatCard label="Active Regions"   value={stats.active}       icon={Earth}      />
        <StatCard label="Inactive Regions" value={stats.inactive}     icon={GlobeLock}  />
        <StatCard label="Destinations"     value={stats.destinations} icon={MapPinHouse} />
      </StatGrid>
      <RegionsTable
        regions={regions}
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        limit={lim}
        search={search}
        country={country}
        status={status}
        destCount={destCount}
      />
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function RegionsPage({
  page, limit, search, country, status, destCount,
}: {
  page: number; limit: number; search: string; country: string;
  status: Status; destCount: DestCount;
}) {
  return (
    <div className="space-y-6">

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
        <RegionsData
          page={page}
          limit={limit}
          search={search}
          country={country}
          status={status}
          destCount={destCount}
        />
      </Suspense>

    </div>
  );
}
