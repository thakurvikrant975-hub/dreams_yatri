"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import {
  Car, MapPin, Users, CalendarDays,
  CheckCircle2, AlertCircle, ChevronDown, ChevronUp,
  ArrowRight,
} from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Separator } from "../../components/ui/separator";
import { BookingStatusBadge } from "../package-bookings/Bookingshared";
import { CabLegPanel } from "../package-bookings/[id]/Bookingdetailactions";
import type { PaginatedBookings, BookingWithRelations } from "../package-bookings/actions";

const CAB_LABELS: Record<string, string> = {
  SEDAN:           "Sedan",
  HATCHBACK:       "Hatchback",
  SUV:             "SUV",
  INNOVA:          "Innova Crysta",
  ERTIGA:          "Ertiga",
  WAGON_R:         "Wagon R",
  BOLERO:          "Bolero",
  TEMPO_TRAVELLER: "Tempo Traveller",
  MINI_VAN:        "Mini Van",
  BUS:             "Bus",
};

function CabBookingCard({ booking }: { booking: BookingWithRelations }) {
  const [expanded, setExpanded] = useState(true);
  const router = useRouter();

  const confirmedLegs = booking.cabBookings?.filter((c) => c.isConfirmed).length ?? 0;
  const totalLegs = booking.cabBookings?.length ?? 0;
  const allDone = confirmedLegs === totalLegs && totalLegs > 0;

  return (
    <div className={`rounded-xl border bg-card overflow-hidden ${allDone ? "border-green-200" : "border-border"}`}>
      {/* Booking header */}
      <div className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-semibold text-primary">{booking.bookingNumber}</span>
            <BookingStatusBadge status={booking.status} />
          </div>
          <p className="text-sm font-medium">{booking.user.name}</p>
          <p className="text-xs text-muted-foreground">{booking.user.email}</p>
        </div>

        <div className="flex items-center gap-4">
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
              <span className="text-xs text-muted-foreground">
                {booking.travellers} pax · {(booking as any).cabType ? CAB_LABELS[(booking as any).cabType] ?? (booking as any).cabType : "—"}
              </span>
            </div>
          </div>

          <div className="text-center min-w-[80px]">
            <div className={`text-2xl font-bold ${allDone ? "text-green-600" : "text-foreground"}`}>
              {confirmedLegs}/{totalLegs}
            </div>
            <p className="text-xs text-muted-foreground">legs done</p>
            {allDone && (
              <div className="flex items-center justify-center gap-1 mt-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                <span className="text-xs text-green-600 font-medium">All confirmed</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-8 text-xs"
              onClick={() => router.push(`/dashboard/package-bookings/${booking.id}`)}>
              View Full
            </Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0"
              onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Leg-wise breakdown */}
      {expanded && (
        <>
          <Separator />
          <div className="p-5 space-y-3">
            {/* Hotel confirmation status */}
            {booking.hotelConfirmedAt && (
              <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                Hotel verified on {format(new Date(booking.hotelConfirmedAt), "dd MMM, h:mm a")}
              </div>
            )}

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
              <div className="flex items-center gap-2 py-6 text-muted-foreground justify-center">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p className="text-sm">No cab legs assigned for this booking.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function CabVerifyTable({ paginated, currentPage }: { paginated: PaginatedBookings; currentPage: number }) {
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
        <Car className="h-12 w-12 text-muted-foreground" />
        <p className="text-sm font-medium text-muted-foreground">No bookings pending cab verification</p>
        <p className="text-xs text-muted-foreground">All cabs have been verified</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {bookings.map((booking) => (
        <CabBookingCard key={booking.id} booking={booking} />
      ))}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">Page {currentPage} of {totalPages}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={currentPage === 1}
              onClick={() => goToPage(currentPage - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={currentPage === totalPages}
              onClick={() => goToPage(currentPage + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}