"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import {
  Hotel, MapPin, Users, CalendarDays,
  CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Star,
  Utensils,
} from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Separator } from "../../components/ui/separator";
import { DataTable, type ColumnDef } from "../../components/dashboard/Datatable";
import { BookingStatusBadge } from "../package-bookings/Bookingshared";
import { HotelDayPanel } from "../package-bookings/[id]/Bookingdetailactions";
import type { PaginatedBookings, BookingWithRelations } from "../package-bookings/actions";

interface Props {
  paginated: PaginatedBookings;
  currentPage: number;
}

function HotelBookingCard({ booking }: { booking: BookingWithRelations }) {
  const [expanded, setExpanded] = useState(true);
  const router = useRouter();

  const confirmedDays = booking.hotelBookings?.filter((h) => h.isConfirmed).length ?? 0;
  const totalDays = booking.hotelBookings?.length ?? 0;
  const allDone = confirmedDays === totalDays && totalDays > 0;

  return (
    <div className={`rounded-xl border bg-card overflow-hidden ${allDone ? "border-green-200" : "border-border"}`}>
      {/* Booking header */}
      <div className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-semibold text-primary">{booking.bookingNumber}</span>
              <BookingStatusBadge status={booking.status} />
            </div>
            <p className="text-sm font-medium">{booking.user.name}</p>
            <p className="text-xs text-muted-foreground">{booking.user.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Trip info */}
          <div className="text-right space-y-0.5">
            <div className="flex items-center gap-1.5 justify-end">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm font-medium">{booking.destination.name}</span>
            </div>
            <div className="flex items-center gap-1.5 justify-end">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {format(new Date(booking.startDate), "dd MMM")} → {format(new Date(booking.endDate), "dd MMM yyyy")}
              </span>
            </div>
            <div className="flex items-center gap-1.5 justify-end">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{booking.travellers} pax · {booking.duration} nights</span>
            </div>
          </div>

          {/* Progress */}
          <div className="text-center min-w-[80px]">
            <div className={`text-2xl font-bold ${allDone ? "text-green-600" : "text-foreground"}`}>
              {confirmedDays}/{totalDays}
            </div>
            <p className="text-xs text-muted-foreground">nights done</p>
            {allDone && (
              <div className="flex items-center justify-center gap-1 mt-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                <span className="text-xs text-green-600 font-medium">All confirmed</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => router.push(`/dashboard/package-bookings/${booking.id}`)}
            >
              View Full
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Day-wise hotel breakdown */}
      {expanded && (
        <>
          <Separator />
          <div className="p-5 space-y-3">
            {/* Preferences banner */}
            <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2 border">
              <span className="font-medium text-foreground">Customer Preferences:</span>
              <span className="bg-background border rounded px-1.5 py-0.5">{(booking as any).mealPlan ?? "MAP"}</span>
              <span className="bg-background border rounded px-1.5 py-0.5">{(booking as any).foodPreference ?? "VEG"}</span>
              <span className="bg-background border rounded px-1.5 py-0.5">{(booking as any).roomSharingType ?? "SHARED"} rooms</span>
              <span className="bg-background border rounded px-1.5 py-0.5">{(booking as any).cabType ?? "INNOVA"}</span>
            </div>

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
              <div className="flex items-center gap-2 py-6 text-muted-foreground justify-center">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p className="text-sm">No hotel days assigned for this booking.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function HotelVerifyTable({ paginated, currentPage }: Props) {
  const { bookings, totalPages } = paginated;
  const router = useRouter();
  const searchParams = useSearchParams();

  const goToPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    router.push(`?${params.toString()}`);
  };

  if (bookings.length === 0) {
    return (
      <div className="rounded-xl border bg-card flex flex-col items-center justify-center py-16 gap-3">
        <Hotel className="h-12 w-12 text-muted-foreground" />
        <p className="text-sm font-medium text-muted-foreground">No bookings pending hotel verification</p>
        <p className="text-xs text-muted-foreground">All hotels have been verified</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {bookings.map((booking) => (
        <HotelBookingCard key={booking.id} booking={booking} />
      ))}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">Page {currentPage} of {totalPages}</p>
          <div className="flex gap-2">
            <Button
              size="sm" variant="outline"
              disabled={currentPage === 1}
              onClick={() => goToPage(currentPage - 1)}
            >
              Previous
            </Button>
            <Button
              size="sm" variant="outline"
              disabled={currentPage === totalPages}
              onClick={() => goToPage(currentPage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}