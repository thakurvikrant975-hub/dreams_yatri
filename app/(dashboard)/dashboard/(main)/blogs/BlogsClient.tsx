import { Suspense }      from "react";
import { FileText, Clock, CheckCircle2, XCircle, Hourglass, BookOpen } from "lucide-react";
import { getAllBlogs, getBlogStats } from "./actions";
import { BlogsTable }  from "./BlogsTable";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { Skeleton }    from "../components/ui/skeleton";
import { PageHeader }  from "../components/dashboard/PageHeader";
import { StatCard, StatGrid } from "../components/dashboard/Statcard";

// ── Skeletons ─────────────────────────────────────────────────────────────────

function StatsSkeleton() {
  return (
    <StatGrid cols={5}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-dashboard-base-100 border-dashboard-base-300 p-4 space-y-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-10" />
        </div>
      ))}
    </StatGrid>
  );
}

function TableSkeleton() {
  return (
    <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 overflow-hidden">
      <div className="grid grid-cols-6 gap-4 px-4 py-3 bg-dashboard-base-200 border-b border-dashboard-base-300">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-3" />)}
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="grid grid-cols-6 gap-4 px-4 py-3 border-b border-dashboard-base-300 last:border-0 items-center">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-lg shrink-0" />
            <Skeleton className="h-4 w-36" />
          </div>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-4 w-20" />
          <div className="flex justify-end gap-1.5">
            <Skeleton className="h-8 w-16 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Async data sub-components ─────────────────────────────────────────────────

async function StatsSection() {
  const stats = await getBlogStats();
  return (
    <StatGrid cols={5}>
      <StatCard label="Total Posts"  value={stats.total}     icon={FileText}     />
      <StatCard label="Pending"      value={stats.pending}   icon={Hourglass}    highlight={stats.pending > 0} />
      <StatCard label="Published"    value={stats.published} icon={CheckCircle2} />
      <StatCard label="Rejected"     value={stats.rejected}  icon={XCircle}      />
      <StatCard label="Drafts"       value={stats.drafts}    icon={Clock}        />
    </StatGrid>
  );
}

async function TableSection({
  page, limit, search, status,
}: {
  page: number; limit: number; search: string; status: string;
}) {
  const result = await getAllBlogs({ page, limit, search, status });
  return (
    <BlogsTable
      rows={result.rows}
      currentPage={result.currentPage}
      totalPages={result.totalPages}
      totalCount={result.total}
      limit={result.limit}
      search={search}
      status={status}
    />
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BlogsClient({
  page, limit, search, status,
}: {
  page: number; limit: number; search: string; status: string;
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
            <BreadcrumbPage>Blog Reviews</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader
        title="Blog Reviews"
        description="Review, approve, or reject user-submitted blog posts"
        icon={BookOpen}
      />

      <Suspense fallback={<StatsSkeleton />}>
        <StatsSection />
      </Suspense>

      <Suspense fallback={<TableSkeleton />}>
        <TableSection page={page} limit={limit} search={search} status={status} />
      </Suspense>

    </div>
  );
}
