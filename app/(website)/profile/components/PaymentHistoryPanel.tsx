'use client'

import { useState, useEffect } from "react";
import { Section } from "./Section";
import Tabs from "@/app/components/ui/Tabs";
import Button from "@/app/components/ui/Button";
import { cn } from "@/app/lib/utils";
import { EmptyState } from "./EmptyState";
import { ReceiptIcon } from "@phosphor-icons/react";

// ─── Types ────────────────────────────────────────────────────────────────────

type PaymentStatus = "SUCCESS" | "FAILED" | "REFUNDED";

interface Payment {
  id: string;
  amount: string;
  currency: string;
  status: PaymentStatus;
  gateway: string;
  method: string;
  failureReason: string | null;
  refundAmount: string | null;
  refundedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  booking: {
    bookingNumber: string;
    startDate: string;
    destination: {
      name: string;
    };
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
  SUCCESS:  { label: "Paid",     bg: "bg-green-50", text: "text-green-700" },
  FAILED:   { label: "Failed",   bg: "bg-red-50",   text: "text-red-600"   },
  REFUNDED: { label: "Refunded", bg: "bg-yellow-50", text: "text-yellow-700" },
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
  const status = STATUS_CONFIG[payment.status];

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-4 space-y-3 hover:border-neutral-300 transition-colors">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-neutral-900">
            {payment.booking.destination.name}
          </p>
          <p className="text-[11px] text-neutral-400">
            {payment.booking.bookingNumber}
          </p>
        </div>

        <span className={cn("text-[11px] font-semibold px-2.5 py-0.5 rounded-full", status.bg, status.text)}>
          {status.label}
        </span>
      </div>

      {/* Amount */}
      <div className="flex items-center justify-between">
        <p className="text-lg font-semibold text-neutral-900">
          {formatAmount(payment.amount, payment.currency)}
        </p>
        <p className="text-xs text-neutral-400">
          {payment.method.replace("_", " ")}
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

      {payment.status === "REFUNDED" && (
        <p className="text-[11px] text-yellow-600">
          Refunded {formatAmount(payment.refundAmount || "0", payment.currency)} on{" "}
          {formatDate(payment.refundedAt)}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-neutral-100 pt-2 text-xs text-neutral-400">
        <span>{payment.gateway}</span>

        <button className="flex items-center gap-1 hover:text-neutral-600">
          <ReceiptIcon size={14} />
          Receipt
        </button>
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

  // Fetch payments
  async function fetchPayments(status?: string) {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);

      const res = await fetch(`/api/user/payment-history?${params}`);
      const json = await res.json();

      if (!res.ok) {
        setError("Failed to load");
        return;
      }

      const data: Payment[] = json.data ?? [];
      setPayments(data);

      // counts from current data
      const SUCCESS = data.filter(p => p.status === "SUCCESS").length;
      const FAILED = data.filter(p => p.status === "FAILED").length;
      const REFUNDED = data.filter(p => p.status === "REFUNDED").length;

      setCounts({
        all: data.length,
        SUCCESS,
        FAILED,
        REFUNDED,
      });

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
            {[1,2,3].map(i => (
              <div key={i} className="h-24 bg-neutral-100 rounded-xl animate-pulse" />
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