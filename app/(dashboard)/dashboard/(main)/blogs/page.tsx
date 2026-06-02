import { Suspense } from 'react';
import type { Metadata } from 'next';
import { FileText, Clock, CheckCircle2, XCircle, Hourglass } from 'lucide-react';
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '../components/ui/breadcrumb';
import { Skeleton } from '../components/ui/skeleton';
import { PageHeader } from '../components/dashboard/PageHeader';
import { StatCard, StatGrid } from '../components/dashboard/Statcard';
import { BlogsTable } from './BlogsTable';
import { getAllBlogs, getBlogStats } from './actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Blog Reviews - Dashboard',
  robots: { index: false, follow: false },
};

// ── Skeletons ─────────────────────────────────────────────────────────────────

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-dashboard-base-100 border-dashboard-base-300 p-4 space-y-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-10" />
        </div>
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 overflow-hidden">
      <div className="grid grid-cols-6 gap-4 px-4 py-2.5 bg-dashboard-base-200 border-b border-dashboard-base-300">
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
            <Skeleton className="h-8 w-16 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Async data components ─────────────────────────────────────────────────────

async function StatsSection() {
  const stats = await getBlogStats();
  return (
    <StatGrid cols={5}>
      <StatCard label="Total Posts"  value={stats.total}     icon={FileText}    />
      <StatCard label="Pending"      value={stats.pending}   icon={Hourglass}   highlight={stats.pending > 0} />
      <StatCard label="Published"    value={stats.published} icon={CheckCircle2}/>
      <StatCard label="Rejected"     value={stats.rejected}  icon={XCircle}     />
      <StatCard label="Drafts"       value={stats.drafts}    icon={Clock}       />
    </StatGrid>
  );
}

async function TableSection() {
  const rows = await getAllBlogs();
  return <BlogsTable initialRows={rows} />;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BlogsPage() {
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
        icon={FileText}
      />

      <Suspense fallback={<StatsSkeleton />}>
        <StatsSection />
      </Suspense>

      <Suspense fallback={<TableSkeleton />}>
        <TableSection />
      </Suspense>

    </div>
  );
}
