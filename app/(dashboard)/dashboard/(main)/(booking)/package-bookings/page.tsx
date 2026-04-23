import { Suspense } from "react";
import { BookMarked } from "lucide-react";
import { Skeleton } from "../../components/ui/skeleton";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import {
  getBookingsPaginated,
  getBookingStats,
  getDestinationsForFilter,
} from "./actions";
import { BookingsTable } from "./Bookingstable";

function TableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="bg-muted/50 px-4 py-3 grid grid-cols-8 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-4" />
          ))}
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="px-4 py-4 grid grid-cols-8 gap-4 border-t items-center">
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-28" />
            </div>
            {Array.from({ length: 7 }).map((_, j) => (
              <Skeleton key={j} className="h-5 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

async function PageContent({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));

  const [paginated, stats, destinations] = await Promise.all([
    getBookingsPaginated(page),
    getBookingStats(),
    getDestinationsForFilter(),
  ]);

  return (
    <>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <BookMarked className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Package Bookings</h1>
            <p className="text-xs text-muted-foreground">
              Manage and track all customer bookings through the pipeline
            </p>
          </div>
        </div>
      </div>

      <BookingsTable
        paginated={paginated}
        stats={stats}
        currentPage={page}
        destinations={destinations}
      />
    </>
  );
}

export default function PackageBookingsPage({ searchParams }: PageProps) {
  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Package Bookings</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Suspense fallback={<TableSkeleton />}>
        <PageContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}