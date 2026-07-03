import { Suspense }       from "react";
import { Car, CarFront, IndianRupee, CheckCircle2 } from "lucide-react";
import { getCabPricings, getActiveVehicles }        from "./actions";
import { CabPricingTable }   from "./CabPricingTable";
import { CreateCabPricingSheet } from "./CabPricingSheet";
import {
  Breadcrumb, BreadcrumbItem,
  BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import { Skeleton }          from "../../components/ui/skeleton";
import { PageHeader }        from "../../components/dashboard/PageHeader";
import { StatCard, StatGrid } from "../../components/dashboard/Statcard";

type Status = "active" | "inactive" | "all";

// ── Skeleton ──────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="bg-muted/50 px-4 py-3 grid grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-4" />)}
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="px-4 py-3 grid grid-cols-5 gap-4 border-t items-center">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-20 rounded-md" />
            <Skeleton className="h-5 w-20 rounded-md" />
          </div>
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

// ── Async data component ──────────────────────────────────────────────────

async function CabPricingData({
  page, limit, search, status,
}: {
  page: number; limit: number; search: string; status: Status;
}) {
  const [data, vehicles] = await Promise.all([
    getCabPricings({ page, limit, search, status }),
    getActiveVehicles(),
  ]);

  const { rows, totalPages, currentPage, totalCount, limit: lim, stats, memberNames } = data;

  return (
    <>
      <StatGrid cols={3}>
        <StatCard
          label="Destinations Priced"
          value={stats.total_destinations}
          icon={CarFront}
        />
        <StatCard
          label="Active Prices"
          value={stats.active_entries}
          icon={CheckCircle2}
        />
        <StatCard
          label="Total Entries"
          value={stats.total_entries}
          icon={IndianRupee}
        />
      </StatGrid>

      <CabPricingTable
        rows={rows}
        memberNames={memberNames}
        vehicles={vehicles}
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        limit={lim}
        search={search}
        status={status}
      />
    </>
  );
}

// ── Page shell ────────────────────────────────────────────────────────────

async function CabPricingActions() {
  const vehicles = await getActiveVehicles();
  return <CreateCabPricingSheet vehicles={vehicles} />;
}

export default function CabPricingClient({
  page, limit, search, status,
}: {
  page: number; limit: number; search: string; status: Status;
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
            <BreadcrumbPage>Cab Pricing</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader
        title="Cab Pricing"
        description="Set per-day vehicle prices for each destination"
        icon={Car}
        actions={
          <Suspense fallback={
            <Skeleton className="h-10 w-32 rounded-md" />
          }>
            <CabPricingActions />
          </Suspense>
        }
      />

      <Suspense
        key={`${page}-${limit}-${search}-${status}`}
        fallback={
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-xl border bg-card p-4 space-y-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-7 w-10" />
                </div>
              ))}
            </div>
            <TableSkeleton />
          </div>
        }
      >
        <CabPricingData
          page={page}
          limit={limit}
          search={search}
          status={status}
        />
      </Suspense>

    </div>
  );
}
