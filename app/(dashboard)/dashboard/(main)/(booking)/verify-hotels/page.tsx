import { Suspense } from "react";
import { Hotel } from "lucide-react";
import { Skeleton } from "../../components/ui/skeleton";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import { getHotelVerificationQueue } from "../package-bookings/actions";
import { HotelQueueTable } from "./Hotelqueuetable";

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

async function PageContent({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const paginated = await getHotelVerificationQueue(page);

  return (
    <>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
          <Hotel className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Hotel Verification Queue</h1>
          <p className="text-xs text-muted-foreground">
            {paginated.totalCount} booking{paginated.totalCount !== 1 ? "s" : ""} pending hotel verification
          </p>
        </div>
      </div>

      <HotelQueueTable paginated={paginated} currentPage={page} />
    </>
  );
}

function QueueSkeleton() {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="bg-muted/50 px-4 py-3 grid grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-4" />
        ))}
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="px-4 py-4 grid grid-cols-6 gap-4 border-t items-center">
          {Array.from({ length: 6 }).map((_, j) => (
            <Skeleton key={j} className="h-5 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function VerifyHotelPage({ searchParams }: PageProps) {
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
            <BreadcrumbPage>Verify Hotels</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Suspense fallback={<QueueSkeleton />}>
        <PageContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}