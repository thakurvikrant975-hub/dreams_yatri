import { Suspense } from "react";
import { Car } from "lucide-react";
import { Skeleton } from "../../components/ui/skeleton";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import { getCabVerificationQueue } from "../package-bookings/actions";
import { CabVerifyTable } from "./Cabverifytable";
import { Stats } from "../../components/dashboard/Stats";

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

function Skeleton2() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-6 w-24" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 2 }).map((_, j) => (
              <Skeleton key={j} className="h-20 rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

async function PageContent({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const paginated = await getCabVerificationQueue(page);

  const totalLegs = paginated.bookings.reduce(
    (sum, b) => sum + (b.cabBookings?.length ?? 0), 0
  );
  const confirmedLegs = paginated.bookings.reduce(
    (sum, b) => sum + (b.cabBookings?.filter((c) => c.isConfirmed).length ?? 0), 0
  );

  return (
    <>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
          <Car className="h-5 w-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Cab Verification Queue</h1>
          <p className="text-xs text-muted-foreground">
            {paginated.totalCount} booking{paginated.totalCount !== 1 ? "s" : ""} pending cab verification
          </p>
        </div>
      </div>

      <Stats
        rows={[
          { label: "Bookings Pending", value: paginated.totalCount },
          { label: "Total Legs",       value: totalLegs },
          { label: "Legs Confirmed",   value: confirmedLegs },
          { label: "Legs Pending",     value: totalLegs - confirmedLegs, muted: (totalLegs - confirmedLegs) === 0 },
        ]}
      />

      <CabVerifyTable paginated={paginated} currentPage={page} />
    </>
  );
}

export default function VerifyCabsPage({ searchParams }: PageProps) {
  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbLink href="/dashboard/package-bookings">Package Bookings</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>Verify Cabs</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Suspense fallback={<Skeleton2 />}>
        <PageContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}