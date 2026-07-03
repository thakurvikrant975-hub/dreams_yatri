import { Suspense } from "react";
import { TicketCheck, FileKey, MapPin, FileCheck, FileX } from "lucide-react";
import { getPermits } from "./actions";
import { PermitsTable } from "./PermitsTable";
import { AddPermitButton } from "./AddPermitButton";
import {
  Breadcrumb, BreadcrumbItem,
  BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import { Skeleton } from "../../components/ui/skeleton";
import { PageHeader } from "../../components/dashboard/PageHeader";
import { StatCard, StatGrid } from "../../components/dashboard/Statcard";

// ── Skeleton fallback ─────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="bg-muted/50 px-4 py-3 grid grid-cols-7 gap-4">
        {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-4" />)}
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="px-4 py-3 grid grid-cols-7 gap-4 border-t items-center">
          <div className="col-span-2">
            <Skeleton className="h-4 w-36 mb-1" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-5 w-20 rounded" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
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

// ── Async data sub-component ──────────────────────────────────────────────

async function PermitsData({
  page, limit, search, category, status,
}: {
  page: number; limit: number; search: string;
  category: string; status: string;
}) {
  const { rows, total, totalPages, stats, memberNames } = await getPermits({
    page, limit, search, category, status,
  });

  return (
    <>
      <StatGrid cols={4}>
        <StatCard label="Total Permits"  value={stats.total}        icon={FileKey}   />
        <StatCard label="Active"         value={stats.active}       icon={FileCheck} />
        <StatCard label="Inactive"       value={stats.inactive}     icon={FileX}     />
        <StatCard label="With Location"  value={stats.withLocation} icon={MapPin}    />
      </StatGrid>

      <PermitsTable
        permits={rows}
        memberNames={memberNames}
        totalCount={total}
        currentPage={page}
        totalPages={totalPages}
        limit={limit}
        search={search}
        category={category}
        status={status}
      />
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function PermitsPage({
  page, limit, search, category, status,
}: {
  page: number; limit: number; search: string;
  category: string; status: string;
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
            <BreadcrumbPage>Permits</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader
        title="Permits"
        description="Manage entry permits, mountain passes, wildlife fees, and other travel permits"
        icon={TicketCheck}
        actions={<AddPermitButton />}
      />

      <Suspense fallback={
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-10" />
              </div>
            ))}
          </div>
          <TableSkeleton />
        </div>
      }>
        <PermitsData
          page={page}
          limit={limit}
          search={search}
          category={category}
          status={status}
        />
      </Suspense>

    </div>
  );
}
