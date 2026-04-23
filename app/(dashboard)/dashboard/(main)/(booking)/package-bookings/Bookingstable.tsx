"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import {
  MoreHorizontal, Users, Hotel, Car, CheckCircle2,
  Clock, MapPin, CalendarDays, UserCheck,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { toast } from "sonner";
import { DataTable, type ColumnDef } from "../../components/dashboard/Datatable";
import { TableFilters } from "../../components/dashboard/Tablefilters";
import { Stats } from "../../components/dashboard/Stats";
import { BookingStatusBadge } from "./BookingShared";
import type { BookingWithRelations, PaginatedBookings, BookingStats } from "./actions";
import type { BookingStatus } from "@/app/generated/prisma";

interface Props {
  paginated: PaginatedBookings;
  stats: BookingStats;
  currentPage: number;
  destinations: { id: number; name: string }[];
}

export function BookingsTable({ paginated, stats, currentPage, destinations }: Props) {
  const { bookings, totalPages } = paginated;
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [destFilter, setDestFilter] = useState("all");

  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      const matchSearch =
        b.bookingNumber.toLowerCase().includes(search.toLowerCase()) ||
        b.user.name?.toLowerCase().includes(search.toLowerCase()) ||
        b.user.email.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || b.status === statusFilter;
      const matchDest = destFilter === "all" || String(b.destinationId) === destFilter;
      return matchSearch && matchStatus && matchDest;
    });
  }, [bookings, search, statusFilter, destFilter]);

  const goToPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    router.push(`?${params.toString()}`);
  };

  const statusOptions: { label: string; value: string }[] = [
    { label: "Pending Review", value: "PENDING_REVIEW" },
    { label: "Hotel Verification", value: "HOTEL_VERIFICATION" },
    { label: "Cab Verification", value: "CAB_VERIFICATION" },
    { label: "Ops Review", value: "OPS_REVIEW" },
    { label: "Confirmed", value: "CONFIRMED" },
    { label: "Upcoming", value: "UPCOMING" },
    { label: "Completed", value: "COMPLETED" },
    { label: "Rejected", value: "REJECTED" },
    { label: "Cancelled", value: "CANCELLED" },
  ];

  const columns: ColumnDef<BookingWithRelations>[] = [
    {
      header: "Booking",
      width: "w-56",
      cell: (b) => (
        <div>
          <p className="font-mono text-xs font-semibold text-primary">{b.bookingNumber}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <p className="text-sm font-medium truncate max-w-[160px]">{b.user.name}</p>
          </div>
          <p className="text-xs text-muted-foreground truncate max-w-[160px]">{b.user.email}</p>
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
            <span className="text-xs">{format(new Date(b.startDate), "dd MMM yyyy")}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 pl-5">
            {b.duration}D · {b.travellers} pax
          </p>
        </div>
      ),
    },
    {
      header: "Amount",
      align: "right",
      cell: (b) => (
        <div className="text-right">
          <p className="text-sm font-semibold">
            ₹{Number(b.totalAmount).toLocaleString("en-IN")}
          </p>
          <p className="text-xs text-muted-foreground">
            Paid: ₹{Number(b.paidAmount).toLocaleString("en-IN")}
          </p>
        </div>
      ),
    },
    {
      header: "Verifications",
      cell: (b) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <Hotel className={`h-3.5 w-3.5 ${b.hotelConfirmedAt ? "text-green-600" : "text-muted-foreground"}`} />
            <span className={`text-xs ${b.hotelConfirmedAt ? "text-green-700 font-medium" : "text-muted-foreground"}`}>
              Hotel {b.hotelConfirmedAt ? `✓ ${format(new Date(b.hotelConfirmedAt), "dd MMM")}` : "Pending"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Car className={`h-3.5 w-3.5 ${b.cabConfirmedAt ? "text-green-600" : "text-muted-foreground"}`} />
            <span className={`text-xs ${b.cabConfirmedAt ? "text-green-700 font-medium" : "text-muted-foreground"}`}>
              Cab {b.cabConfirmedAt ? `✓ ${format(new Date(b.cabConfirmedAt), "dd MMM")}` : "Pending"}
            </span>
          </div>
        </div>
      ),
    },
    {
      header: "Assignee",
      cell: (b) => (
        <div>
          {b.currentAssignee ? (
            <div className="flex items-center gap-1.5">
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary shrink-0">
                {b.currentAssignee.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs truncate max-w-[80px]">{b.currentAssignee.name}</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Unassigned</span>
          )}
          {b.currentDepartment && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[100px]">
              {b.currentDepartment.name}
            </p>
          )}
        </div>
      ),
    },
    {
      header: "Status",
      cell: (b) => <BookingStatusBadge status={b.status} />,
    },
    {
      header: "Actions",
      align: "right",
      cell: (b) => (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/dashboard/package-bookings/${b.id}`);
          }}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Stats
        rows={[
          { label: "Total Bookings", value: stats.total },
          { label: "Pending Review", value: stats.pendingReview },
          { label: "Hotel Queue", value: stats.hotelVerification },
          { label: "Cab Queue", value: stats.cabVerification },
          { label: "Confirmed", value: stats.confirmed },
          { label: "Cancelled", value: stats.cancelled, muted: true },
        ]}
      />

      <TableFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by booking ref, name or email..."
        filteredCount={filtered.length}
        totalCount={bookings.length}
        filters={[
          {
            value: statusFilter,
            onChange: setStatusFilter,
            placeholder: "All Statuses",
            options: statusOptions,
          },
          {
            value: destFilter,
            onChange: setDestFilter,
            placeholder: "All Destinations",
            options: destinations.map((d) => ({ label: d.name, value: String(d.id) })),
          },
        ]}
      />

      <DataTable
        data={filtered}
        columns={columns}
        rowKey={(b) => b.id}
        onRowClick={(b) => router.push(`/dashboard/package-bookings/${b.id}`)}
        emptyState={
          <div className="flex flex-col items-center gap-2">
            <Users className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">No bookings found</p>
            <p className="text-xs text-muted-foreground">Try adjusting your filters</p>
          </div>
        }
        pagination={{ currentPage, totalPages, onPageChange: goToPage }}
      />
    </div>
  );
}