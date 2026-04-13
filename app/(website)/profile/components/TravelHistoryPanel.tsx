// app/(website)/profile/components/TravelHistoryPanel.tsx

'use client'

import { useState, useEffect } from "react";
import { Section }             from "./Section";
import Tabs                    from "@/app/components/ui/Tabs";
import Button                  from "@/app/components/ui/Button";
import { cn }                  from "@/app/lib/utils";
import { SuitcaseRollingIcon } from "@phosphor-icons/react";
import { EmptyState }          from "./EmptyState";

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
  destination: {
    name:      string;
    country:   string;
    thumbnail: string | null;
  };
  payments: {
    status: string;
    method: string | null;
    paidAt: string | null;
  }[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<BookingStatus, { label: string; bg: string; text: string }> = {
  UPCOMING:  { label: "Upcoming",  bg: "bg-blue-50",  text: "text-blue-700"  },
  COMPLETED: { label: "Completed", bg: "bg-green-50", text: "text-green-700" },
  CANCELLED: { label: "Cancelled", bg: "bg-red-50",   text: "text-red-600"   },
};

const PAGE_SIZE = 4;

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

// ─── Booking Card ─────────────────────────────────────────────────────────────

function BookingCard({ booking }: { booking: Booking }) {
  const status    = STATUS_CONFIG[booking.status];
  const latestPay = booking.payments[0];
  const paid      = Number(booking.paidAmount);
  const total     = Number(booking.totalAmount);
  const remaining = total - paid;
  const paidPct   = total > 0 ? Math.round((paid / total) * 100) : 0;

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-4 space-y-3 hover:border-neutral-300 transition-colors">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-900 truncate">
            {booking.destination.name}
            <span className="text-neutral-400 font-normal ml-1 text-xs">· {booking.destination.country}</span>
          </p>
          <p className="text-[11px] text-neutral-400 mt-0.5">{booking.bookingNumber}</p>
        </div>
        <span className={cn("shrink-0 text-[11px] font-semibold px-2.5 py-0.5 rounded-full", status.bg, status.text)}>
          {status.label}
        </span>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Trip type",  value: booking.tripType           },
          { label: "Duration",   value: `${booking.duration}N`     },
          { label: "Travellers", value: String(booking.travellers) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-neutral-50 rounded-lg py-2 text-center">
            <p className="text-[10px] text-neutral-400 mb-0.5">{label}</p>
            <p className="text-xs font-semibold text-neutral-700">{value}</p>
          </div>
        ))}
      </div>

      {/* Dates */}
      <div className="flex items-center gap-2 text-xs text-neutral-500">
        <span>{formatDate(booking.startDate)}</span>
        <span className="text-neutral-300">→</span>
        <span>{formatDate(booking.endDate)}</span>
      </div>

      {/* Payment progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-neutral-500">
            Paid {formatAmount(booking.paidAmount, booking.currency)}
            <span className="text-neutral-300 mx-1">/</span>
            {formatAmount(booking.totalAmount, booking.currency)}
          </span>
          <span className="font-semibold text-neutral-700">{paidPct}%</span>
        </div>
        <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full",
              booking.status === "CANCELLED" ? "bg-red-400" :
              paidPct === 100 ? "bg-green-500" : "bg-blue-500"
            )}
            style={{ width: `${paidPct}%` }}
          />
        </div>
        {remaining > 0 && booking.status === "UPCOMING" && (
          <p className="text-[10px] text-neutral-400">
            {formatAmount(String(remaining), booking.currency)} remaining
          </p>
        )}
        {booking.cancelReason && (
          <p className="text-[10px] text-red-400">Reason: {booking.cancelReason}</p>
        )}
      </div>

      {/* Payment method footer */}
      {latestPay?.method && (
        <div className="flex items-center justify-between text-[11px] text-neutral-400 border-t border-neutral-100 pt-2">
          <span>via {latestPay.method.replace("_", " ")}</span>
          {latestPay.paidAt && <span>{formatDate(latestPay.paidAt)}</span>}
        </div>
      )}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[1,2,3,4].map(i => (
              <div key={i} className="bg-neutral-50 border border-neutral-100 rounded-xl p-4 animate-pulse space-y-3">
                <div className="h-4 bg-neutral-200 rounded w-2/3" />
                <div className="grid grid-cols-3 gap-2">
                  {[1,2,3].map(j => <div key={j} className="h-10 bg-neutral-200 rounded-lg" />)}
                </div>
                <div className="h-3 bg-neutral-200 rounded w-1/2" />
                <div className="h-2 bg-neutral-200 rounded" />
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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