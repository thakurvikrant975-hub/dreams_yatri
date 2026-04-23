import { notFound } from "next/navigation";
import { format } from "date-fns";
import {
  MapPin, CalendarDays, Users, CreditCard,
  Hotel, Car, UserCheck, Clock, BookMarked,
} from "lucide-react";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/app/(dashboard)/dashboard/(main)/components/ui/breadcrumb";
import { Separator } from "@/app/(dashboard)/dashboard/(main)/components/ui/separator";
import { getBookingById, getTeamMembersForAssign } from "../../../../../package-bookings/actions";
import { BookingStatusBadge, BookingTimeline } from "../BookingShared";

import {
  HotelActionPanel,
  CabActionPanel,
  OpsActionPanel,
  AssignMemberPanel,
  AddNotePanel,
} from "../../../../../package-bookings/Bookingactions";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function BookingDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [booking, members] = await Promise.all([
    getBookingById(id),
    getTeamMembersForAssign(),
  ]);

  if (!booking) notFound();

  const latestPayment = booking.payments[0];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
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
            <BreadcrumbPage>{booking.bookingNumber}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <BookMarked className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold font-mono">{booking.bookingNumber}</h1>
              <BookingStatusBadge status={booking.status} />
            </div>
            <p className="text-xs text-muted-foreground">
              Created {format(new Date(booking.createdAt), "dd MMM yyyy, h:mm a")}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left column ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Customer & Package Info */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <h2 className="text-sm font-semibold">Booking Details</h2>
            <Separator />

            <div className="grid grid-cols-2 gap-4">
              {/* Customer */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Customer</p>
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

              {/* Destination */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Destination</p>
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">{booking.destination.name}</p>
                </div>
              </div>

              {/* Travel Dates */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Travel Dates</p>
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm">
                    {format(new Date(booking.startDate), "dd MMM yyyy")}
                    {" → "}
                    {format(new Date(booking.endDate), "dd MMM yyyy")}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground pl-5">{booking.duration} days</p>
              </div>

              {/* Travellers */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Travellers</p>
                <div className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">{booking.travellers} pax</p>
                </div>
              </div>

              {/* Trip Type */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Trip Type</p>
                <p className="text-sm font-medium capitalize">{booking.tripType?.toLowerCase().replace(/_/g, " ")}</p>
              </div>

              {/* Notes */}
              {booking.notes && (
                <div className="col-span-2 space-y-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Customer Notes</p>
                  <p className="text-sm bg-muted/50 rounded-md px-3 py-2 border">{booking.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Financials */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <h2 className="text-sm font-semibold">Payment</h2>
            <Separator />
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Total Amount</p>
                <p className="text-lg font-semibold">₹{Number(booking.totalAmount).toLocaleString("en-IN")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Paid Amount</p>
                <p className="text-lg font-semibold text-green-700">₹{Number(booking.paidAmount).toLocaleString("en-IN")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Currency</p>
                <p className="text-lg font-semibold">{booking.currency}</p>
              </div>
            </div>
            {latestPayment && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2 border">
                <CreditCard className="h-3.5 w-3.5 shrink-0" />
                Payment ID: <span className="font-mono">{latestPayment.id}</span>
                <span>·</span>
                <span className="capitalize">{latestPayment.status?.toLowerCase()}</span>
                <span>·</span>
                {format(new Date(latestPayment.createdAt), "dd MMM yyyy, h:mm a")}
              </div>
            )}
          </div>

          {/* Verification Status */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <h2 className="text-sm font-semibold">Verification Pipeline</h2>
            <Separator />
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-2 flex items-center gap-1.5">
                  <Hotel className="h-3.5 w-3.5" /> Hotel Verification
                </p>
                <HotelActionPanel booking={booking} />
                {booking.hotelAssignee && (
                  <p className="text-xs text-muted-foreground mt-1.5 pl-1">
                    Handled by: {booking.hotelAssignee.name}
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs text-muted-foreground font-medium mb-2 flex items-center gap-1.5">
                  <Car className="h-3.5 w-3.5" /> Cab Verification
                </p>
                <CabActionPanel booking={booking} />
                {booking.cabAssignee && (
                  <p className="text-xs text-muted-foreground mt-1.5 pl-1">
                    Handled by: {booking.cabAssignee.name}
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs text-muted-foreground font-medium mb-2 flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5" /> Operations Final Review
                </p>
                <OpsActionPanel booking={booking} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="space-y-5">

          {/* Assignment */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <h2 className="text-sm font-semibold">Assignment</h2>
            <Separator />
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Current Handler</p>
              {booking.currentAssignee ? (
                <div className="flex items-center gap-2">
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
                <p className="text-sm text-muted-foreground">Unassigned</p>
              )}
            </div>
            <AssignMemberPanel booking={booking} members={members} />
          </div>

          {/* Add Note */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <h2 className="text-sm font-semibold">Internal Note</h2>
            <Separator />
            <AddNotePanel bookingId={booking.id} />
          </div>

          {/* Activity Timeline */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Activity Timeline</h2>
            </div>
            <Separator />
            <BookingTimeline entries={booking.timeline} />
          </div>
        </div>
      </div>
    </div>
  );
}