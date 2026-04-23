"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import {
  CheckCircle2, AlertTriangle, MapPin,
  CalendarDays, Car, RefreshCw, Hotel,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "../../components/ui/label";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription, DialogFooter,
} from "../../components/ui/dialog";
import { toast } from "sonner";
import { DataTable, type ColumnDef } from "../../components/dashboard/Datatable";
import { Stats } from "../../components/dashboard/Stats";
import { confirmCab, flagCabIssue } from "../package-bookings/actions";
import type { BookingWithRelations, PaginatedBookings } from "../package-bookings/actions";

interface Props {
  paginated: PaginatedBookings;
  currentPage: number;
}

export function CabQueueTable({ paginated, currentPage }: Props) {
  const { bookings, totalPages, totalCount } = paginated;
  const router = useRouter();
  const searchParams = useSearchParams();

  const [actionBooking, setActionBooking] = useState<{
    booking: BookingWithRelations;
    type: "confirm" | "flag";
  } | null>(null);
  const [notes, setNotes] = useState("");
  const [isPending, start] = useTransition();

  const goToPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    router.push(`?${params.toString()}`);
  };

  const handleConfirm = () => {
    if (!actionBooking) return;
    start(async () => {
      const r = await confirmCab(actionBooking.booking.id, notes || undefined);
      if (r.success) {
        toast.success("Cab confirmed — moved to ops review");
        setActionBooking(null);
        setNotes("");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  };

  const handleFlag = () => {
    if (!actionBooking || !notes.trim()) {
      toast.error("Please describe the issue");
      return;
    }
    start(async () => {
      const r = await flagCabIssue(actionBooking.booking.id, notes);
      if (r.success) {
        toast.success("Issue flagged");
        setActionBooking(null);
        setNotes("");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  };

  const columns: ColumnDef<BookingWithRelations>[] = [
    {
      header: "Booking",
      width: "w-48",
      cell: (b) => (
        <div>
          <p className="font-mono text-xs font-semibold text-primary">{b.bookingNumber}</p>
          <p className="text-sm font-medium truncate max-w-[150px]">{b.user.name}</p>
          <p className="text-xs text-muted-foreground truncate max-w-[150px]">{b.user.email}</p>
        </div>
      ),
    },
    {
      header: "Destination",
      cell: (b) => (
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-sm">{b.destination.name}</span>
        </div>
      ),
    },
    {
      header: "Travel Dates",
      cell: (b) => (
        <div>
          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs font-medium">{format(new Date(b.startDate), "dd MMM yyyy")}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 pl-5">
            {b.duration}D · {b.travellers} pax
          </p>
        </div>
      ),
    },
    {
      header: "Hotel Status",
      cell: (b) => (
        <div className="flex items-center gap-1.5">
          <Hotel className="h-3.5 w-3.5 text-green-600 shrink-0" />
          <span className="text-xs text-green-700 font-medium">
            Confirmed {b.hotelConfirmedAt ? format(new Date(b.hotelConfirmedAt), "dd MMM") : ""}
          </span>
        </div>
      ),
    },
    {
      header: "Amount",
      align: "right",
      cell: (b) => (
        <p className="text-sm font-semibold text-right">
          ₹{Number(b.totalAmount).toLocaleString("en-IN")}
        </p>
      ),
    },
    {
      header: "Actions",
      align: "right",
      cell: (b) => (
        <div className="flex items-center gap-2 justify-end">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
            onClick={(e) => {
              e.stopPropagation();
              setNotes("");
              setActionBooking({ booking: b, type: "flag" });
            }}
          >
            <AlertTriangle className="h-3 w-3 mr-1" /> Flag
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white"
            onClick={(e) => {
              e.stopPropagation();
              setNotes("");
              setActionBooking({ booking: b, type: "confirm" });
            }}
          >
            <CheckCircle2 className="h-3 w-3 mr-1" /> Confirm
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <Stats
        rows={[
          { label: "Pending Verification", value: totalCount },
          { label: "Current Page", value: bookings.length },
        ]}
      />

      <DataTable
        data={bookings}
        columns={columns}
        rowKey={(b) => b.id}
        onRowClick={(b) => router.push(`/dashboard/package-bookings/${b.id}`)}
        emptyState={
          <div className="flex flex-col items-center gap-2 py-4">
            <Car className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">No bookings pending cab verification</p>
          </div>
        }
        pagination={{ currentPage, totalPages, onPageChange: goToPage }}
      />

      {/* Confirm Dialog */}
      <Dialog open={actionBooking?.type === "confirm"} onOpenChange={(o) => !o && setActionBooking(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Confirm Cab — {actionBooking?.booking.bookingNumber}</DialogTitle>
            <DialogDescription>
              Confirm cab/transport is arranged and available for this booking.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="Vehicle type, driver name, pickup point, contact number..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionBooking(null)}>Cancel</Button>
            <Button onClick={handleConfirm} disabled={isPending} className="bg-purple-600 hover:bg-purple-700 text-white">
              {isPending && <RefreshCw className="h-3 w-3 animate-spin mr-2" />}
              Confirm Cab
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Flag Dialog */}
      <Dialog open={actionBooking?.type === "flag"} onOpenChange={(o) => !o && setActionBooking(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Flag Cab Issue — {actionBooking?.booking.bookingNumber}</DialogTitle>
            <DialogDescription>Describe the transport availability issue.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Issue Description *</Label>
            <Textarea
              placeholder="No vehicle available, route not serviceable, date conflict..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionBooking(null)}>Cancel</Button>
            <Button onClick={handleFlag} disabled={isPending} variant="destructive">
              {isPending && <RefreshCw className="h-3 w-3 animate-spin mr-2" />}
              Flag Issue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}