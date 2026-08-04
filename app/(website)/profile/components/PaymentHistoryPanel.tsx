'use client'

import { useState, useEffect } from "react";
import { Section } from "./Section";
import Tabs from "@/app/components/ui/Tabs";
import Link from "next/link";
import { buttonVariants } from "@/app/components/ui/Button";
import { cn } from "@/app/lib/utils";
import { EmptyState } from "./EmptyState";
import { ReceiptIcon } from "@phosphor-icons/react";
import { BOOKING_STATUS_INFO } from "@/app/lib/booking-display-status";

// ─── Types ────────────────────────────────────────────────────────────────────

type PaymentStatus = "PENDING" | "ADVANCE_PAID" | "FULLY_PAID" | "REFUNDED" | "PARTIALLY_REFUNDED" | "TESTING" | "FAILED";

interface Payment {
  id: string;
  amount: string;
  currency: string;
  status: PaymentStatus;
  gateway: string;
  method: string | null;
  failureReason: string | null;
  refundAmount: string | null;
  refundedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  booking: {
    id: string;
    bookingNumber: string;
    startDate: string;
    status: keyof typeof BOOKING_STATUS_INFO;
    cancelReason: string | null;
    destination: {
      name: string;
    } | null;
    package: {
      title: string;
    } | null;
  };
}

interface Counts {
  all: number;
  SUCCESS: number;
  FAILED: number;
  REFUNDED: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<PaymentStatus, { label: string; bg: string; text: string }> = {
  PENDING:            { label: "Processing",        bg: "bg-blue-50",     text: "text-blue-600"   },
  ADVANCE_PAID:       { label: "Partially Paid",     bg: "bg-amber-50",    text: "text-amber-700"  },
  FULLY_PAID:         { label: "Paid",               bg: "bg-green-50",    text: "text-green-700"  },
  REFUNDED:           { label: "Refunded",           bg: "bg-yellow-50",   text: "text-yellow-700" },
  PARTIALLY_REFUNDED: { label: "Partially Refunded", bg: "bg-yellow-50",   text: "text-yellow-700" },
  TESTING:            { label: "Test",               bg: "bg-neutral-100", text: "text-neutral-500" },
  FAILED:             { label: "Failed",             bg: "bg-red-50",      text: "text-red-600"    },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function formatAmount(amount: string, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

// ─── Payment Card ─────────────────────────────────────────────────────────────

function PaymentCard({ payment }: { payment: Payment }) {
  const status   = STATUS_CONFIG[payment.status];
  const title    = payment.booking.package?.title ?? payment.booking.destination?.name ?? "Trip";
  const subtitle = payment.booking.package ? payment.booking.destination?.name ?? null : null;

  // Booking *status* belongs on the booking itself (and the Trips tab already
  // shows it) — on a payment row the useful action is the receipt for the money
  // that actually moved, which is why the status modal is gone from here.
  const hasReceipt = payment.status === "FULLY_PAID"
    || payment.status === "ADVANCE_PAID"
    || payment.status === "REFUNDED"
    || payment.status === "PARTIALLY_REFUNDED";

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-4 space-y-3 hover:border-neutral-300 transition-colors">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-900 truncate">
            {title}
          </p>
          {subtitle && (
            <p className="text-[11px] text-neutral-400 truncate">
              {subtitle}
            </p>
          )}
          <p className="text-[11px] text-neutral-400">
            {payment.booking.bookingNumber}
          </p>
        </div>

        <span className={cn("shrink-0 text-[11px] font-semibold px-2.5 py-0.5 rounded-full", status.bg, status.text)}>
          {status.label}
        </span>
      </div>

      {/* Amount */}
      <div className="flex items-center justify-between">
        <p className="text-lg font-semibold text-neutral-900">
          {formatAmount(payment.amount, payment.currency)}
        </p>
        <p className="text-xs text-neutral-400">
          {payment.method?.replace(/_/g, " ") ?? "-"}
        </p>
      </div>

      {/* Dates */}
      <div className="text-xs text-neutral-500 flex justify-between">
        <span>Paid: {formatDate(payment.paidAt)}</span>
        <span>Created: {formatDate(payment.createdAt)}</span>
      </div>

      {/* Failure / Refund Info */}
      {payment.status === "FAILED" && payment.failureReason && (
        <p className="text-[11px] text-red-500">
          {payment.failureReason}
        </p>
      )}

      {(payment.status === "REFUNDED" || payment.status === "PARTIALLY_REFUNDED") && (
        <p className="text-[11px] text-yellow-600">
          Refunded {formatAmount(payment.refundAmount || "0", payment.currency)} on{" "}
          {formatDate(payment.refundedAt)}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-neutral-100 pt-2 text-xs text-neutral-400">
        <span>{payment.gateway}</span>

        {/* Only a captured payment has anything to invoice — a failed or still
            processing attempt would render an invoice showing nothing paid. */}
        {hasReceipt ? (
          <Link
            href={`/bookings/${payment.booking.id}/invoice`}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <ReceiptIcon weight="bold" className="size-3.5" />
            View receipt
          </Link>
        ) : (
          <span className="text-neutral-300">No receipt</span>
        )}
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function PaymentHistoryPanel() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("");

  const [counts, setCounts] = useState<Counts>({
    all: 0,
    SUCCESS: 0,
    FAILED: 0,
    REFUNDED: 0,
  });

  const TABS = [
    { id: "", label: "All", caption: String(counts.all) },
    { id: "SUCCESS", label: "Paid", caption: String(counts.SUCCESS) },
    { id: "FAILED", label: "Failed", caption: String(counts.FAILED) },
    { id: "REFUNDED", label: "Refunded", caption: String(counts.REFUNDED) },
  ];
// Replace the entire fetchPayments function and useEffect with this

// Fetch counts once on mount — independent of active tab
useEffect(() => {
  async function fetchCounts() {
    try {
      const [all, success, failed, refunded] = await Promise.all([
        fetch("/api/user/payment-history?limit=1").then(r => r.json()),
        fetch("/api/user/payment-history?status=SUCCESS&limit=1").then(r => r.json()),
        fetch("/api/user/payment-history?status=FAILED&limit=1").then(r => r.json()),
        fetch("/api/user/payment-history?status=REFUNDED&limit=1").then(r => r.json()),
      ]);
      setCounts({
        all:      all.meta?.pagination?.total      ?? 0,
        SUCCESS:  success.meta?.pagination?.total  ?? 0,
        FAILED:   failed.meta?.pagination?.total   ?? 0,
        REFUNDED: refunded.meta?.pagination?.total ?? 0,
      });
    } catch {}
  }
  fetchCounts();
}, []); // ← empty deps — runs once only

// Fetch payments when tab changes — only updates the list, never touches counts
async function fetchPayments(status: string) {
  setLoading(true);
  setError("");
  try {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    const res  = await fetch(`/api/user/payment-history?${params}`);
    const json = await res.json();
    if (!res.ok) { setError("Failed to load"); return; }
    setPayments(json.data ?? []);
  } catch {
    setError("Network error");
  } finally {
    setLoading(false);
  }
}

useEffect(() => {
  fetchPayments(activeTab);
}, [activeTab]);

  return (
    <div className="space-y-5">
      <Section title="Payment History" subtitle="Track all your transactions">

        {/* Tabs */}
        <div className="mb-5">
          <Tabs
            tabs={TABS}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="h-56 bg-neutral-100 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="text-center text-sm text-red-500 py-6">
            {error}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && payments.length === 0 && (
          <EmptyState
            title="No payments found"
            description="Your payment transactions will appear here."
            icon={<ReceiptIcon size={28} className="text-neutral-400" />}
          />
        )}

        {/* List */}
        {!loading && !error && payments.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {payments.map(p => (
              <PaymentCard key={p.id} payment={p} />
            ))}
          </div>
        )}

      </Section>
    </div>
  );
}