import { notFound } from "next/navigation";
import { format } from "date-fns";
import {
  MapPin, CalendarDays, Users, CreditCard, Hotel,
  Car, Clock, BookMarked, Utensils, Package,
  Star, ChevronRight, AlertCircle, CheckCircle2,
} from "lucide-react";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../../../components/ui/breadcrumb";
import { Separator } from "../../../components/ui/separator";
import { Badge } from "../../../components/ui/badge";
import { getBookingById, getTeamMembersForAssign } from "../actions";
import { BookingStatusBadge, BookingTimeline } from "../BookingShared";
import {
  HotelDayPanel, CabLegPanel,
  OpsActionPanel, AssignMemberPanel, AddNotePanel,
} from "../Bookingactions";

interface PageProps {
  params: Promise<{ id: string }>;
}

function MealBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    BREAKFAST: "bg-amber-50 text-amber-700 border-amber-200",
    LUNCH:     "bg-green-50 text-green-700 border-green-200",
    DINNER:    "bg-indigo-50 text-indigo-700 border-indigo-200",
  };
  const labels: Record<string, string> = {
    BREAKFAST: "Breakfast", LUNCH: "Lunch", DINNER: "Dinner",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded border font-medium ${colors[type] ?? "bg-muted text-muted-foreground border-border"}`}>
      {labels[type] ?? type}
    </span>
  );
}

function StarRating({ rating }: { rating: number | null }) {
  if (!rating) return null;
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: rating }).map((_, i) => (
        <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
      ))}
    </span>
  );
}

function PriceRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${highlight ? "font-semibold" : ""}`}>
      <span className={`text-sm ${highlight ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
      <span className={`text-sm font-mono ${highlight ? "text-foreground" : "text-muted-foreground"}`}>{value}</span>
    </div>
  );
}

export default async function BookingDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [booking, members] = await Promise.all([
    getBookingById(id),
    getTeamMembersForAssign(),
  ]);

  if (!booking) notFound();

  const latestPayment = booking.payments?.[0];
  const allHotelsConfirmed = booking.hotelBookings?.every((h) => h.isConfirmed) ?? false;
  const allCabsConfirmed = booking.cabBookings?.every((c) => c.isConfirmed) ?? false;
  const confirmedHotelDays = booking.hotelBookings?.filter((h) => h.isConfirmed).length ?? 0;
  const confirmedCabLegs = booking.cabBookings?.filter((c) => c.isConfirmed).length ?? 0;

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbLink href="/dashboard/package-bookings">Package Bookings</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>{booking.bookingNumber}</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <BookMarked className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold font-mono">{booking.bookingNumber}</h1>
              <BookingStatusBadge status={booking.status} />
            </div>
            <p className="text-xs text-muted-foreground">
              Booked {format(new Date(booking.createdAt), "dd MMM yyyy, h:mm a")}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── LEFT COLUMN ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Customer + Package */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <h2 className="text-sm font-semibold">Booking Overview</h2>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              {/* Customer */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Customer</p>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                    {booking.user.name?.charAt(0).toUpperCase() ?? "?"}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{booking.user.name}</p>
                    <p className="text-xs text-muted-foreground">{booking.user.email}</p>
                  </div>
                </div>
              </div>

              {/* Package */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Package</p>
                <div className="flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                  <p className="text-sm font-medium">{booking.package?.title ?? "—"}</p>
                </div>
              </div>

              {/* Destination */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Destination</p>
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <p className="text-sm font-medium">{booking.destination.name}</p>
                </div>
              </div>

              {/* Travel Dates */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Travel Dates</p>
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                  <p className="text-sm">
                    {format(new Date(booking.startDate), "dd MMM")} → {format(new Date(booking.endDate), "dd MMM yyyy")}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground pl-5">{booking.duration} nights</p>
              </div>

              {/* Pax */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Travellers</p>
                <div className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                  <p className="text-sm font-medium">{booking.travellers} pax</p>
                </div>
              </div>

              {/* Preferences */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Preferences</p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-xs bg-muted px-2 py-0.5 rounded border">
                    {(booking as any).mealPlan ?? "MAP"}
                  </span>
                  <span className="text-xs bg-muted px-2 py-0.5 rounded border">
                    {(booking as any).foodPreference ?? "VEG"}
                  </span>
                  <span className="text-xs bg-muted px-2 py-0.5 rounded border">
                    {(booking as any).roomSharingType ?? "SHARED"} room
                  </span>
                  <span className="text-xs bg-muted px-2 py-0.5 rounded border">
                    {(booking as any).cabType ?? "INNOVA"}
                  </span>
                </div>
              </div>

              {booking.notes && (
                <div className="col-span-2 space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Customer Notes</p>
                  <p className="text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-md px-3 py-2">
                    {booking.notes}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Hotel day-wise ── */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hotel className="h-4 w-4 text-blue-600" />
                <h2 className="text-sm font-semibold">Hotel Verification — Day Wise</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {confirmedHotelDays}/{booking.hotelBookings?.length ?? 0} confirmed
                </span>
                {allHotelsConfirmed && (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                )}
              </div>
            </div>
            <Separator />

            {booking.hotelBookings?.length ? (
              <div className="space-y-3">
                {booking.hotelBookings.map((day) => (
                  <HotelDayPanel
                    key={day.id}
                    day={day}
                    bookingId={booking.id}
                    destinationId={booking.destinationId}
                    travellers={booking.travellers}
                  />
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 py-4 text-muted-foreground">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p className="text-sm">No hotel days assigned yet. Create from package itinerary.</p>
              </div>
            )}

            {!allHotelsConfirmed && booking.hotelBookings?.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  All {booking.hotelBookings.length} nights must be confirmed before hotel verification completes.
                </p>
              </div>
            )}
          </div>

          {/* ── Cab leg-wise ── */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Car className="h-4 w-4 text-purple-600" />
                <h2 className="text-sm font-semibold">Cab Verification — Leg Wise</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {confirmedCabLegs}/{booking.cabBookings?.length ?? 0} confirmed
                </span>
                {allCabsConfirmed && (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                )}
              </div>
            </div>
            <Separator />

            {booking.cabBookings?.length ? (
              <div className="space-y-3">
                {booking.cabBookings.map((leg) => (
                  <CabLegPanel
                    key={leg.id}
                    leg={leg}
                    bookingId={booking.id}
                    travellers={booking.travellers}
                  />
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 py-4 text-muted-foreground">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p className="text-sm">No cab legs assigned yet.</p>
              </div>
            )}
          </div>

          {/* Ops Panel */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <h2 className="text-sm font-semibold">Operations — Final Review</h2>
            <Separator />
            <OpsActionPanel booking={booking} />
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="space-y-5">

          {/* Price Breakdown */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <h2 className="text-sm font-semibold">Price Breakdown</h2>
            <Separator />
            <div className="space-y-0.5">
              <PriceRow label="Hotel Cost"    value={fmt((booking as any).hotelCost ?? 0)} />
              <PriceRow label="Cab Cost"      value={fmt((booking as any).cabCost ?? 0)} />
              <PriceRow label="Meal Cost"     value={fmt((booking as any).mealCost ?? 0)} />
              <Separator className="my-2" />
              <PriceRow label="Subtotal"      value={fmt((booking as any).subtotal ?? 0)} />
              <PriceRow label="Margin (22%)"  value={fmt((booking as any).marginAmount ?? 0)} />
              <PriceRow label="Pre-GST"       value={fmt((booking as any).preGst ?? Number(booking.totalAmount) - (booking as any).gstAmount ?? 0)} />
              <PriceRow label="GST (5%)"      value={fmt((booking as any).gstAmount ?? 0)} />
              <Separator className="my-2" />
              <PriceRow label="Total Amount"  value={fmt(Number(booking.totalAmount))} highlight />
              <PriceRow label="Paid Amount"   value={fmt(Number(booking.paidAmount))} highlight />
              <PriceRow label="Per Person"    value={fmt(Math.round(Number(booking.totalAmount) / booking.travellers))} />
            </div>
            {latestPayment && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-md px-2.5 py-2 border mt-2">
                <CreditCard className="h-3.5 w-3.5 shrink-0" />
                <span className="font-mono truncate">{latestPayment.id}</span>
              </div>
            )}
          </div>

          {/* Assignment */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <h2 className="text-sm font-semibold">Assignment</h2>
            <Separator />
            {booking.currentAssignee ? (
              <div className="flex items-center gap-2 mb-2">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                  {booking.currentAssignee.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium">{booking.currentAssignee.name}</p>
                  {booking.currentDepartment && (
                    <p className="text-xs text-muted-foreground">{booking.currentDepartment.name}</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-2">Unassigned</p>
            )}
            <AssignMemberPanel booking={booking} members={members} />
          </div>

          {/* Add Note */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <h2 className="text-sm font-semibold">Internal Note</h2>
            <Separator />
            <AddNotePanel bookingId={booking.id} />
          </div>

          {/* Timeline */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Activity Timeline</h2>
            </div>
            <Separator />
            <BookingTimeline entries={booking.timeline ?? []} />
          </div>
        </div>
      </div>
    </div>
  );
}