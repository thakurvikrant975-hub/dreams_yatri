// app/(website)/profile/components/TravelHistoryPanel.tsx

'use client'

import { useState, useEffect } from "react";
import { Section }             from "./Section";
import Tabs                    from "@/app/components/ui/Tabs";
import Button                  from "@/app/components/ui/Button";
import { cn }                  from "@/app/lib/utils";
import {
  SuitcaseRollingIcon,
  CalendarBlankIcon,
  UsersThreeIcon,
  TagIcon,
  ImageBrokenIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  CreditCardIcon,
  InfoIcon,
} from "@phosphor-icons/react";
import type { Icon }           from "@phosphor-icons/react";
import { EmptyState }          from "./EmptyState";
import { BookingStatusModal, type BookingStatusSummary } from "./BookingStatusModal";
import { BOOKING_STATUS_INFO } from "@/app/lib/booking-display-status";

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingStatus = "UPCOMING" | "COMPLETED" | "CANCELLED";

interface Counts {
  all:       number;
  UPCOMING:  number;
  COMPLETED: number;
  CANCELLED: number;
}

interface Booking {
  id:            string;
  bookingNumber: string;
  tripType:      string;
  startDate:     string;
  endDate:       string;
  duration:      number;
  travellers:    number;
  status:        BookingStatus;
  totalAmount:   string;
  paidAmount:    string;
  currency:      string;
  cancelReason:  string | null;
  cancelledAt:   string | null;
  createdAt:     string;
  rawStatus:     keyof typeof BOOKING_STATUS_INFO;
  destination: {
    name:      string;
    country:   string;
    thumbnail: string | null;
  };
  package: {
    title:     string;
    thumbnail: string | null;
  } | null;
  payments: {
    status: string;
    method: string | null;
    paidAt: string | null;
  }[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const R2_BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";

const STATUS_CONFIG: Record<BookingStatus, { label: string; bg: string; text: string; icon: Icon }> = {
  UPCOMING:  { label: "Upcoming",  bg: "bg-blue-50",  text: "text-blue-700",  icon: ClockIcon       },
  COMPLETED: { label: "Completed", bg: "bg-green-50", text: "text-green-700", icon: CheckCircleIcon },
  CANCELLED: { label: "Cancelled", bg: "bg-red-50",   text: "text-red-600",   icon: XCircleIcon     },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function formatAmount(amount: string, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency, maximumFractionDigits: 0,
  }).format(Number(amount));
}

function imgUrl(key: string | null) {
  if (!key) return null;
  return key.startsWith("http") ? key : `${R2_BASE}/${key}`;
}

// ─── Booking Card ─────────────────────────────────────────────────────────────

function BookingCard({ booking }: { booking: Booking }) {
  const status     = STATUS_CONFIG[booking.status];
  const StatusIcon = status.icon;
  const latestPay  = booking.payments[0];
  const paid       = Number(booking.paidAmount);
  const total      = Number(booking.totalAmount);
  const remaining  = Math.max(total - paid, 0);
  const paidPct    = total > 0 ? Math.round((paid / total) * 100) : 0;
  const thumbnail  = imgUrl(booking.package?.thumbnail ?? booking.destination.thumbnail);
  const title      = booking.package?.title ?? booking.destination.name;
  const subtitle   = booking.package
    ? `${booking.destination.name}, ${booking.destination.country}`
    : booking.destination.country;

  const [statusOpen, setStatusOpen] = useState(false);

  const statusSummary: BookingStatusSummary = {
    bookingNumber: booking.bookingNumber,
    rawStatus:     booking.rawStatus,
    cancelReason:  booking.cancelReason,
    destination:   booking.destination,
    package:       booking.package,
  };

  return (
    <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden hover:border-neutral-300 hover:shadow-sm shadow-neutral-100 transition-all">
      <div className="flex flex-col sm:flex-row">

        {/* Destination image */}
        <div className="relative w-full sm:w-48 h-36 sm:h-auto shrink-0 bg-neutral-100">
          {thumbnail ? (
            <img src={thumbnail} alt={title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageBrokenIcon size={28} className="text-neutral-300" />
            </div>
          )}
          <span className={cn("absolute top-2.5 left-2.5 inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-sm", status.bg, status.text)}>
            <StatusIcon weight="fill" className="size-3" />
            {status.label}
          </span>
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0 p-4 space-y-3">

          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-900 truncate">
                {title}
              </p>
              <p className="text-[11px] text-neutral-400 mt-0.5 truncate">
                {subtitle}
              </p>
              <p className="text-[11px] text-neutral-400">
                {booking.bookingNumber} · Booked {formatDate(booking.createdAt)}
              </p>
            </div>
            <span className="shrink-0 inline-flex items-center gap-1 bg-neutral-50 text-neutral-600 text-[11px] font-semibold px-2.5 py-1 rounded-full">
              <TagIcon className="size-3" />
              {booking.tripType}
            </span>
          </div>

          {/* Trip meta */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-neutral-500">
            <span className="inline-flex items-center gap-1.5">
              <CalendarBlankIcon className="size-3.5 text-neutral-400" />
              {formatDate(booking.startDate)}
              <span className="text-neutral-300">→</span>
              {formatDate(booking.endDate)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              {booking.duration} {booking.duration === 1 ? "Night" : "Nights"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <UsersThreeIcon className="size-3.5 text-neutral-400" />
              {booking.travellers} {booking.travellers === 1 ? "Traveller" : "Travellers"}
            </span>
          </div>

          {/* Payment */}
          <div className="space-y-1.5 pt-2 border-t border-neutral-100">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-500">
                Paid <span className="font-semibold text-neutral-700">{formatAmount(booking.paidAmount, booking.currency)}</span>
                <span className="text-neutral-300 mx-1">/</span>
                {formatAmount(booking.totalAmount, booking.currency)}
              </span>
              <span className="font-semibold text-neutral-700">{paidPct}%</span>
            </div>
            <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  booking.status === "CANCELLED" ? "bg-red-400" :
                  paidPct === 100 ? "bg-green-500" : "bg-blue-500"
                )}
                style={{ width: `${paidPct}%` }}
              />
            </div>

            {(remaining > 0 && booking.status !== "CANCELLED") || latestPay?.method ? (
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-neutral-400 pt-0.5">
                {latestPay?.method && (
                  <span className="inline-flex items-center gap-1.5">
                    <CreditCardIcon className="size-3.5" />
                    Paid via {latestPay.method.replace(/_/g, " ")}
                    {latestPay.paidAt && <> on {formatDate(latestPay.paidAt)}</>}
                  </span>
                )}
                {remaining > 0 && booking.status !== "CANCELLED" && (
                  <span className="font-medium text-neutral-500">
                    {formatAmount(String(remaining), booking.currency)} remaining
                  </span>
                )}
              </div>
            ) : null}
          </div>

          {/* Cancellation info */}
          {booking.status === "CANCELLED" && (
            <div className="text-[11px] text-red-600 bg-red-50 rounded-lg px-2.5 py-1.5">
              {booking.cancelReason ? <>Reason: {booking.cancelReason}</> : "This booking was cancelled."}
              {booking.cancelledAt && <span className="text-red-400"> · {formatDate(booking.cancelledAt)}</span>}
            </div>
          )}

          {/* Footer actions */}
          <div className="flex justify-end pt-1">
            <Button variant="outline" size="sm" onClick={() => setStatusOpen(true)}>
              <InfoIcon weight="bold" className="size-3.5" />
              View status
            </Button>
          </div>
        </div>
      </div>

      <BookingStatusModal booking={statusSummary} open={statusOpen} onClose={setStatusOpen} />
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function TravelHistoryPanel() {
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState("");
  const [activeTab,   setActiveTab]   = useState("");
  const [page,        setPage]        = useState(1);
  const [totalPages,  setTotalPages]  = useState(1);

  // ← counts and TABS belong here, in TravelHistoryPanel
  const [counts, setCounts] = useState<Counts>({ all: 0, UPCOMING: 0, COMPLETED: 0, CANCELLED: 0 });

  const TABS = [
    { id: "",          label: "All",       caption: String(counts.all)       },
    { id: "UPCOMING",  label: "Upcoming",  caption: String(counts.UPCOMING)  },
    { id: "COMPLETED", label: "Completed", caption: String(counts.COMPLETED) },
    { id: "CANCELLED", label: "Cancelled", caption: String(counts.CANCELLED) },
  ];

  // Fetch counts once on mount
  useEffect(() => {
    async function fetchCounts() {
      try {
        const [all, upcoming, completed, cancelled] = await Promise.all([
          fetch("/api/user/travel-history?limit=1").then(r => r.json()),
          fetch("/api/user/travel-history?status=UPCOMING&limit=1").then(r => r.json()),
          fetch("/api/user/travel-history?status=COMPLETED&limit=1").then(r => r.json()),
          fetch("/api/user/travel-history?status=CANCELLED&limit=1").then(r => r.json()),
        ]);
        setCounts({
          all:       all.meta?.pagination?.total      ?? 0,
          UPCOMING:  upcoming.meta?.pagination?.total  ?? 0,
          COMPLETED: completed.meta?.pagination?.total ?? 0,
          CANCELLED: cancelled.meta?.pagination?.total ?? 0,
        });
      } catch {}
    }
    fetchCounts();
  }, []);

  async function fetchBookings(status: string, pageNum: number, append = false) {
    append ? setLoadingMore(true) : setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(pageNum) });
      // ← no limit — API default (10) applies
      if (status) params.set("status", status);
      const res  = await fetch(`/api/user/travel-history?${params}`);
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to load"); return; }
      setAllBookings(prev => append ? [...prev, ...(json.data ?? [])] : (json.data ?? []));
      setTotalPages(json.meta?.pagination?.totalPages ?? 1);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    setPage(1);
    setAllBookings([]);
    fetchBookings(activeTab, 1, false);
  }, [activeTab]);

  function handleLoadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchBookings(activeTab, nextPage, true);
  }

  const hasMore = page < totalPages;

  return (
    <div className="space-y-5">
      <Section title="Travel History" subtitle="All your trips at a glance">

        <div className="mb-5">
          <Tabs
            tabs={TABS}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>

        {loading && (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="bg-neutral-50 border border-neutral-100 rounded-xl overflow-hidden animate-pulse">
                <div className="flex flex-col sm:flex-row">
                  <div className="w-full sm:w-48 h-36 bg-neutral-200" />
                  <div className="flex-1 p-4 space-y-3">
                    <div className="h-4 bg-neutral-200 rounded w-2/3" />
                    <div className="h-3 bg-neutral-200 rounded w-1/2" />
                    <div className="h-3 bg-neutral-200 rounded w-3/4" />
                    <div className="h-2 bg-neutral-200 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="py-8 text-center text-sm text-red-500">{error}</div>
        )}

        {!loading && !error && allBookings.length === 0 && (
          <EmptyState
            title={activeTab ? `No ${activeTab.toLowerCase()} trips` : "No trips yet"}
            description={
              activeTab
                ? `You don't have any ${activeTab.toLowerCase()} bookings at the moment.`
                : "Your travel history will appear here once you make your first booking."
            }
            icon={<SuitcaseRollingIcon size={28} className="text-neutral-400" />}
          />
        )}

        {!loading && !error && allBookings.length > 0 && (
          <>
            <div className="space-y-3">
              {allBookings.map(b => <BookingCard key={b.id} booking={b} />)}
            </div>

            {hasMore && (
              <div className="flex justify-center mt-4">
                <Button
                  variant="primary"
                  size="md"
                  loading={loadingMore}
                  onClick={handleLoadMore}
                  className="rounded-lg mt-4"
                >
                  Load more trips
                </Button>
              </div>
            )}
          </>
        )}

      </Section>
    </div>
  );
}
