import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import ConnectHeader from "../components/ConnectHeader";
import { Card } from "@/app/components/ui/Card";
import Link from "next/link";
import {
  CalendarBlankIcon,
  CheckCircleIcon,
  ClockIcon,
  UsersThreeIcon,
  ArrowRightIcon,
  BuildingsIcon,
  CurrencyInrIcon,
  HouseLineIcon,
  XCircleIcon,
  ArrowClockwiseIcon,
  SpinnerIcon,
} from "@phosphor-icons/react/dist/ssr";
import { BookingStatus } from "@/app/generated/prisma";
import { cn } from "@/app/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type BookingSummary = {
  id: string;
  bookingNumber: string;
  status: BookingStatus;
  totalAmount: number;
  travellers: number;
  contactEmail: string | null;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  leadName: string;
  hotelName: string;
  hotelCity: string;
  checkInDate: Date;
  checkOutDate: Date;
  roomType: string;
  roomsCount: number;
};

type Stats = {
  total: number;
  upcoming: number;
  ongoing: number;
  completed: number;
  cancelled: number;
  revenue: number;
};

// ── Data fetch ────────────────────────────────────────────────────────────────

async function getOwnerBookings(
  ownerId: string,
  filter: string,
): Promise<{ bookings: BookingSummary[]; stats: Stats }> {
  const ownerHotels = await db.hotels.findMany({
    where: { owner_id: ownerId },
    select: { id: true },
  });

  const hotelIds = ownerHotels.map((h) => h.id);

  const emptyStats: Stats = {
    total: 0, upcoming: 0, ongoing: 0,
    completed: 0, cancelled: 0, revenue: 0,
  };

  if (!hotelIds.length) return { bookings: [], stats: emptyStats };

  // Get all unique booking IDs touching this owner's hotels
  const links = await db.bookingHotel.findMany({
    where: { hotelId: { in: hotelIds } },
    select: { bookingId: true },
    distinct: ["bookingId"],
  });

  if (!links.length) return { bookings: [], stats: emptyStats };

  const allBookingIds = links.map((l) => l.bookingId);

  // Status filter mapping
  const STATUS_FILTER: Partial<Record<string, BookingStatus[]>> = {
    upcoming:  ["UPCOMING", "CONFIRMED"],
    ongoing:   ["ONGOING"],
    completed: ["COMPLETED"],
    cancelled: ["CANCELLED", "REJECTED"],
  };
  const statusFilter = STATUS_FILTER[filter];

  // Fetch bookings with traveller + hotel data
  const raw = await db.booking.findMany({
    where: {
      id: { in: allBookingIds },
      ...(statusFilter ? { status: { in: statusFilter } } : {}),
    },
    select: {
      id: true,
      bookingNumber: true,
      status: true,
      totalAmount: true,
      travellers: true,
      contactEmail: true,
      startDate: true,
      endDate: true,
      createdAt: true,
      travellersList: {
        where: { isLead: true },
        take: 1,
        select: { fullName: true, firstName: true, lastName: true },
      },
      hotelBookings: {
        where: { hotelId: { in: hotelIds } },
        orderBy: { checkInDate: "asc" },
        take: 1,
        select: {
          checkInDate: true,
          checkOutDate: true,
          roomType: true,
          roomsCount: true,
          hotel: { select: { name: true, city: true } },
        },
      },
    },
    orderBy: { startDate: "desc" },
  });

  // Compute stats from all bookings regardless of tab filter
  const allRaw = await db.booking.findMany({
    where: { id: { in: allBookingIds } },
    select: { status: true, totalAmount: true },
  });

  const stats: Stats = {
    total:     allRaw.length,
    upcoming:  allRaw.filter((b) => (["UPCOMING","CONFIRMED"] as string[]).includes(b.status)).length,
    ongoing:   allRaw.filter((b) => b.status === "ONGOING").length,
    completed: allRaw.filter((b) => b.status === "COMPLETED").length,
    cancelled: allRaw.filter((b) => (["CANCELLED","REJECTED"] as string[]).includes(b.status)).length,
    revenue:   allRaw
      .filter((b) => !(["CANCELLED","REJECTED","PENDING_REVIEW"] as string[]).includes(b.status))
      .reduce((sum, b) => sum + Number(b.totalAmount), 0),
  };

  const bookings: BookingSummary[] = raw.map((b) => {
    const lead = b.travellersList[0];
    const stay = b.hotelBookings[0];
    return {
      id:           b.id,
      bookingNumber: b.bookingNumber,
      status:       b.status,
      totalAmount:  Number(b.totalAmount),
      travellers:   b.travellers,
      contactEmail: b.contactEmail,
      startDate:    b.startDate,
      endDate:      b.endDate,
      createdAt:    b.createdAt,
      leadName:     lead?.fullName ?? lead?.firstName ?? b.contactEmail ?? "Guest",
      hotelName:    stay?.hotel?.name ?? "—",
      hotelCity:    stay?.hotel?.city ?? "—",
      checkInDate:  stay?.checkInDate ?? b.startDate,
      checkOutDate: stay?.checkOutDate ?? b.endDate,
      roomType:     stay?.roomType ?? "—",
      roomsCount:   stay?.roomsCount ?? 1,
    };
  });

  return { bookings, stats };
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  BookingStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  UPCOMING:               { label: "Upcoming",     bg: "bg-blue-50",     text: "text-blue-700",     border: "border-blue-200"   },
  ONGOING:                { label: "Ongoing",      bg: "bg-emerald-50",  text: "text-emerald-700",  border: "border-emerald-200"},
  COMPLETED:              { label: "Completed",    bg: "bg-neutral-100", text: "text-neutral-500",  border: "border-neutral-200"},
  CANCELLED:              { label: "Cancelled",    bg: "bg-red-50",      text: "text-red-600",      border: "border-red-200"    },
  PENDING_REVIEW:         { label: "Pending",      bg: "bg-amber-50",    text: "text-amber-700",    border: "border-amber-200"  },
  HOTEL_VERIFICATION:     { label: "Processing",   bg: "bg-amber-50",    text: "text-amber-700",    border: "border-amber-200"  },
  HOTEL_CONFIRMED:        { label: "Processing",   bg: "bg-amber-50",    text: "text-amber-700",    border: "border-amber-200"  },
  CAB_VERIFICATION:       { label: "Processing",   bg: "bg-amber-50",    text: "text-amber-700",    border: "border-amber-200"  },
  CAB_CONFIRMED:          { label: "Processing",   bg: "bg-amber-50",    text: "text-amber-700",    border: "border-amber-200"  },
  OPS_REVIEW:             { label: "Review",       bg: "bg-amber-50",    text: "text-amber-700",    border: "border-amber-200"  },
  CONFIRMED:              { label: "Confirmed",    bg: "bg-emerald-50",  text: "text-emerald-700",  border: "border-emerald-200"},
  REJECTED:               { label: "Rejected",     bg: "bg-red-50",      text: "text-red-600",      border: "border-red-200"    },
  MODIFICATION_REQUESTED: { label: "Modification", bg: "bg-violet-50",   text: "text-violet-700",   border: "border-violet-200" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style:    "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day:   "numeric",
    month: "short",
    year:  "numeric",
  }).format(new Date(d));
}

function formatShortDate(d: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day:   "numeric",
    month: "short",
  }).format(new Date(d));
}

function initials(name: string) {
  const parts = name.trim().split(" ");
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  bg,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  bg: string;
}) {
  return (
    <Card variant="elevated" radius="md">
      <div className="p-4 flex items-center gap-3">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", bg)}>
          <Icon size={17} weight="fill" className={color} />
        </div>
        <div className="min-w-0">
          <p className="text-xl font-bold text-neutral-900 leading-none mb-0.5 truncate">
            {value}
          </p>
          <p className="text-xs text-neutral-500">{label}</p>
        </div>
      </div>
    </Card>
  );
}

function StatusBadge({ status }: { status: BookingStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING_REVIEW;
  return (
    <span
      className={cn(
        "inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border",
        cfg.bg, cfg.text, cfg.border,
      )}
    >
      {cfg.label}
    </span>
  );
}

function FilterTab({
  id,
  label,
  count,
  active,
}: {
  id: string;
  label: string;
  count: number;
  active: boolean;
}) {
  return (
    <Link
      href={`?tab=${id}`}
      className={cn(
        "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
        active
          ? "bg-primary-500 text-white shadow-sm"
          : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800",
      )}
    >
      {label}
      <span
        className={cn(
          "text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none",
          active ? "bg-white/20 text-white" : "bg-neutral-100 text-neutral-500",
        )}
      >
        {count}
      </span>
    </Link>
  );
}

function BookingRow({ booking }: { booking: BookingSummary }) {
  const ini = initials(booking.leadName).toUpperCase() || "G";

  return (
    <tr className="group hover:bg-neutral-50/60 transition-colors">
      {/* Guest */}
      <td className="px-5 py-4 whitespace-nowrap">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
            <span className="text-[11px] font-bold text-primary-600">{ini}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-neutral-800 truncate max-w-[140px]">
              {booking.leadName}
            </p>
            <p className="text-[11px] text-neutral-400 font-mono">#{booking.bookingNumber}</p>
          </div>
        </div>
      </td>

      {/* Property */}
      <td className="px-5 py-4">
        <p className="text-sm font-medium text-neutral-800 truncate max-w-[160px]">
          {booking.hotelName}
        </p>
        <p className="text-[11px] text-neutral-400 mt-0.5">
          {formatShortDate(booking.checkInDate)} → {formatShortDate(booking.checkOutDate)}
        </p>
      </td>

      {/* Room */}
      <td className="px-5 py-4 hidden md:table-cell">
        <p className="text-sm text-neutral-700 truncate max-w-[120px]">{booking.roomType}</p>
        <p className="text-[11px] text-neutral-400 mt-0.5">{booking.roomsCount} room{booking.roomsCount !== 1 ? "s" : ""}</p>
      </td>

      {/* Guests */}
      <td className="px-5 py-4 hidden lg:table-cell">
        <div className="flex items-center gap-1.5 text-sm text-neutral-600">
          <UsersThreeIcon size={14} className="text-neutral-400 shrink-0" />
          {booking.travellers}
        </div>
      </td>

      {/* Amount */}
      <td className="px-5 py-4 whitespace-nowrap">
        <p className="text-sm font-semibold text-neutral-900">{formatINR(booking.totalAmount)}</p>
        <p className="text-[11px] text-neutral-400 mt-0.5">Total</p>
      </td>

      {/* Status */}
      <td className="px-5 py-4 whitespace-nowrap">
        <StatusBadge status={booking.status} />
      </td>

      {/* Action */}
      <td className="px-5 py-4 whitespace-nowrap text-right">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-neutral-400 group-hover:text-primary-500 transition-colors cursor-default">
          View
          <ArrowRightIcon size={12} weight="bold" />
        </span>
      </td>
    </tr>
  );
}

function EmptyState({ filter }: { filter: string }) {
  const isFiltered = filter !== "all";

  return (
    <div className="py-16 text-center">
      <div className="mx-auto w-14 h-14 rounded-xl bg-neutral-100 flex items-center justify-center mb-4">
        <CalendarBlankIcon size={24} weight="duotone" className="text-neutral-400" />
      </div>
      <h3 className="text-base font-semibold text-neutral-800 mb-1.5">
        {isFiltered ? "No bookings found" : "No bookings yet"}
      </h3>
      <p className="text-sm text-neutral-500 max-w-xs mx-auto leading-relaxed">
        {isFiltered
          ? "Try switching to a different tab to see other bookings."
          : "When guests book your property through DreamsYatri, their reservations will appear here."}
      </p>
      {isFiltered && (
        <Link
          href="?tab=all"
          className="inline-flex items-center gap-1.5 mt-4 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
        >
          <ArrowClockwiseIcon size={14} />
          View all bookings
        </Link>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function HotelConnectBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await hotelConnectAuth();
  const ownerId = session!.user.id;
  const { tab = "all" } = await searchParams;

  const { bookings, stats } = await getOwnerBookings(ownerId, tab);

  const TABS = [
    { id: "all",       label: "All",        count: stats.total     },
    { id: "upcoming",  label: "Upcoming",   count: stats.upcoming  },
    { id: "ongoing",   label: "Ongoing",    count: stats.ongoing   },
    { id: "completed", label: "Completed",  count: stats.completed },
    { id: "cancelled", label: "Cancelled",  count: stats.cancelled },
  ];

  return (
    <>
      <ConnectHeader title="Bookings" />

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-5xl mx-auto w-full space-y-6">

          {/* Stats strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              label="Total Bookings"
              value={stats.total}
              icon={CalendarBlankIcon}
              color="text-primary-600"
              bg="bg-primary-50"
            />
            <StatCard
              label="Upcoming"
              value={stats.upcoming}
              icon={ClockIcon}
              color="text-blue-600"
              bg="bg-blue-50"
            />
            <StatCard
              label="Ongoing"
              value={stats.ongoing}
              icon={SpinnerIcon}
              color="text-emerald-600"
              bg="bg-emerald-50"
            />
            <StatCard
              label="Revenue"
              value={formatINR(stats.revenue)}
              icon={CurrencyInrIcon}
              color="text-violet-600"
              bg="bg-violet-50"
            />
          </div>

          {/* Table card */}
          <Card variant="elevated" radius="md" className="overflow-hidden">
            {/* Filter tabs */}
            <div className="px-4 pt-4 pb-0 border-b border-neutral-100">
              <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none pb-0">
                {TABS.map((t) => (
                  <FilterTab
                    key={t.id}
                    id={t.id}
                    label={t.label}
                    count={t.count}
                    active={tab === t.id}
                  />
                ))}
              </div>
            </div>

            {bookings.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-neutral-100">
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Guest</th>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Property</th>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-400 hidden md:table-cell">Room</th>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-400 hidden lg:table-cell">Guests</th>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Amount</th>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Status</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {bookings.map((booking) => (
                      <BookingRow key={booking.id} booking={booking} />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState filter={tab} />
            )}

            {/* Footer */}
            {bookings.length > 0 && (
              <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50/50">
                <p className="text-xs text-neutral-400">
                  Showing {bookings.length} booking{bookings.length !== 1 ? "s" : ""}
                  {tab !== "all" ? ` · ${TABS.find((t) => t.id === tab)?.label ?? ""}` : ""}
                </p>
              </div>
            )}
          </Card>

          {/* No properties empty state */}
          {stats.total === 0 && tab === "all" && (
            <Card variant="elevated" radius="md" className="border-dashed">
              <div className="py-10 text-center">
                <div className="mx-auto w-12 h-12 rounded-xl bg-neutral-100 flex items-center justify-center mb-3">
                  <BuildingsIcon size={20} weight="duotone" className="text-neutral-400" />
                </div>
                <p className="text-sm font-medium text-neutral-700 mb-0.5">Your bookings will appear here</p>
                <p className="text-xs text-neutral-400 max-w-xs mx-auto">
                  Once your property is live and guests make reservations, all bookings will be shown on this page.
                </p>
                <Link
                  href="/hotel-connect/properties"
                  className="inline-flex items-center gap-1.5 mt-4 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
                >
                  <HouseLineIcon size={14} />
                  Manage Properties
                </Link>
              </div>
            </Card>
          )}

        </div>
      </div>
    </>
  );
}
