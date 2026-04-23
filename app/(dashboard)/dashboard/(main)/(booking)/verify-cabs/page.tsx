import { Suspense } from "react";
import { Car } from "lucide-react";
import { Skeleton } from "../../components/ui/skeleton";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import { getCabVerificationQueue } from "../package-bookings/actions";
import { CabQueueTable } from "./CabQueueTable";

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

async function PageContent({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const paginated = await getCabVerificationQueue(page);

  return (
    <>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
          <Car className="h-5 w-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Cab Verification Queue</h1>
          <p className="text-xs text-muted-foreground">
            {paginated.totalCount} booking{paginated.totalCount !== 1 ? "s" : ""} pending cab/transport verification
          </p>
        </div>
      </div>

      <CabQueueTable paginated={paginated} currentPage={page} />
    </>
  );
}

function QueueSkeleton() {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="bg-muted/50 px-4 py-3 grid grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-4" />)}
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="px-4 py-4 grid grid-cols-6 gap-4 border-t items-center">
          {Array.from({ length: 6 }).map((_, j) => <Skeleton key={j} className="h-5 w-full" />)}
        </div>
      ))}
    </div>
  );
}

export default function VerifyCabsPage({ searchParams }: PageProps) {
  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/package-bookings">Package Bookings</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Verify Cabs</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Suspense fallback={<QueueSkeleton />}>
        <PageContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}