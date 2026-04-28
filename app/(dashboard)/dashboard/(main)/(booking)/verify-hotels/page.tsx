import { Suspense } from "react";
import { Hotel, CalendarDays, Users, MapPin, CheckCircle2, AlertCircle } from "lucide-react";
import { Skeleton } from "../../components/ui/skeleton";
import { format } from "date-fns";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import { getHotelVerificationQueue } from "../package-bookings/actions";
import { BookingStatusBadge } from "../package-bookings/Bookingshared";
import { HotelVerifyTable } from "./Hotelverifytable";
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
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, j) => (
              <Skeleton key={j} className="h-24 rounded-lg" />
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
  const paginated = await getHotelVerificationQueue(page);

  const totalNights = paginated.bookings.reduce(
    (sum, b) => sum + (b.hotelBookings?.length ?? 0), 0
  );
  const confirmedNights = paginated.bookings.reduce(
    (sum, b) => sum + (b.hotelBookings?.filter((h) => h.isConfirmed).length ?? 0), 0
  );
  const pendingNights = totalNights - confirmedNights;

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

      <Stats
        rows={[
          { label: "Bookings Pending",  value: paginated.totalCount },
          { label: "Total Nights",      value: totalNights },
          { label: "Nights Confirmed",  value: confirmedNights },
          { label: "Nights Pending",    value: pendingNights, muted: pendingNights === 0 },
        ]}
      />

      <HotelVerifyTable paginated={paginated} currentPage={page} />
    </>
  );
}

export default function VerifyHotelPage({ searchParams }: PageProps) {
  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbLink href="/dashboard/package-bookings">Package Bookings</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>Verify Hotels</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Suspense fallback={<Skeleton2 />}>
        <PageContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}