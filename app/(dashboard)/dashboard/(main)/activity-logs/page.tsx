import { Suspense } from "react";
import { Activity } from "lucide-react";
import { Skeleton } from "../components/ui/skeleton";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { getLogsPaginated, getLogStats } from "./actions";
import { ActivityLogsTable } from "./ActivityLogsTable";
import { PageHeader } from "../components/dashboard/PageHeader";

function TableSkeleton() {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="bg-muted/50 px-4 py-3 grid grid-cols-7 gap-4">
        {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-4" />)}
      </div>
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="px-4 py-3 grid grid-cols-7 gap-4 border-t items-center">
          <div className="space-y-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-36" />
          </div>
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-28" />
        </div>
      ))}
    </div>
  );
}

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

async function PageContent({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));

  const [paginated, stats] = await Promise.all([
    getLogsPaginated(page),
    getLogStats(),
  ]);

  return (
    <>

      <PageHeader
        title="Activity Logs"
        description="Full audit trail all actions, actors, and outcomes"
        icon={Activity}
      />

      <ActivityLogsTable
        paginated={paginated}
        stats={stats}
        currentPage={page}
      />
    </>
  );
}

export default function LogsPage({ searchParams }: PageProps) {
  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Activity Logs</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Suspense fallback={<TableSkeleton />}>
        <PageContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}