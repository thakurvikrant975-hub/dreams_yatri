"use client";

// ─────────────────────────────────────────────────────────────────────────────
// The step between reading a quote and paying for it.
//
// The catalogue side has always had this: /book/[quoteId] shows what is about
// to be bought, asks the client to accept the policies, and lets them choose
// between the deposit and the whole amount. A custom package went from a Book
// button straight to a payment screen — no confirmation of what was being
// bought, no policies accepted, and no choice about how much to pay, even
// though the payment engine has supported paying in full all along.
//
// Deliberately a mirror of BookReview rather than a shared component: that one
// is built around a quote, its freshness countdown and a traveller form, none
// of which exist here — a custom package's travellers, dates and price were
// settled by the exec before the client ever saw it. What is shared is the
// shape of the decision, so the two read as one product.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useModal } from "@/app/hooks/useModals";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import { Heading, Text } from "@/app/components/ui/Typography";
import SavingsBadge from "@/app/components/packages/SavingBadge";
import { createCustomPackageBookingDraft } from "@/app/actions/payment/booking.actions";

export type BookSummary = {
  packageId: string;
  title: string;
  destination: string | null;
  travelDate: string | null;
  nights: number;
  travellers: number;
  currency: string;
  /** What is being bought — the chosen option's price, or the package's own. */
  total: number;
  optionId: string | null;
  optionLabel: string | null;
  discount: { originalPrice: number; amount: number; label: string } | null;
  /** From computePaymentSchedule, against the price above. */
  depositAmount: number;
  balanceAmount: number;
  balanceDueDate: string | null;
  /** True when policy leaves no choice: inside the balance window, or the
   *  minimum deposit already covers the trip. */
  mustPayFull: boolean;
};

const money = (currency: string, n: number) => `${currency} ${Math.round(n).toLocaleString("en-IN")}`;

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function BookCustomPackage({ summary }: { summary: BookSummary }) {
  const router = useRouter();
  const { openModal } = useModal();
  const [payChoice, setPayChoice] = useState<"DEPOSIT" | "FULL">("DEPOSIT");
  const [policy, setPolicy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The engine decides whether a deposit is allowed at all; the client only
  // chooses when it is. Showing a choice that checkout would override is how
  // a client ends up believing they paid a deposit on a trip that required
  // the lot.
  const choice: "DEPOSIT" | "FULL" = summary.mustPayFull ? "FULL" : payChoice;
  const payNow = choice === "FULL" ? summary.total : summary.depositAmount;

  async function proceed() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await createCustomPackageBookingDraft(summary.packageId, summary.optionId, choice);
      if (!res.success) {
        setSubmitting(false);
        if (res.reason === "unauthenticated") {
          // Signing in returns here, not to the itinerary — the client has
          // already made every decision this page asks for.
          openModal("login-modal", {
            redirectTo: window.location.pathname + window.location.search,
            onSuccess: () => { proceed(); },
          });
          return;
        }
        setError(res.message ?? "Could not start your booking. Please try again.");
        return;
      }
      router.push(`/bookings/${res.bookingId}/pay`);
    } catch (err) {
      console.error("[BookCustomPackage] failed", err);
      setSubmitting(false);
      setError("Something went wrong. Please try again.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <Heading as="h1" size="lg" className="mb-1">Review your booking</Heading>
      <Text size="sm" intent="secondary" className="block mb-6">
        Check the details below, then choose how much to pay now.
      </Text>

      <Card className="overflow-hidden">
        {/* ── What is being bought ─────────────────────────────────────── */}
        <div className="px-5 py-4 border-b border-(--border-muted)">
          <Text size="base" weight="semibold" intent="primary" className="block">{summary.title}</Text>
          {summary.destination && (
            <Text size="xs" intent="secondary" className="block mt-0.5">{summary.destination}</Text>
          )}
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Detail label="Travel date" value={summary.travelDate ? formatDate(summary.travelDate) : "—"} />
            <Detail label="Nights" value={String(summary.nights)} />
            <Detail label="Travellers" value={String(summary.travellers)} />
          </div>
          {/* Named only when the package quoted more than one, so a client who
              never had a choice is not shown one they did not make. */}
          {summary.optionLabel && (
            <Text size="xs" intent="secondary" className="block mt-3">
              Stay: <span className="font-medium text-neutral-700">{summary.optionLabel}</span>
            </Text>
          )}
        </div>

        {/* ── The price, and the saving if there was one ────────────────── */}
        <div className="px-5 py-4 border-b border-(--border-muted) flex items-center justify-between gap-3">
          <Text size="sm" intent="secondary">Package total</Text>
          <div className="flex items-baseline gap-2">
            {summary.discount && (
              <span className="text-sm text-neutral-400 line-through tabular-nums">
                {money(summary.currency, summary.discount.originalPrice)}
              </span>
            )}
            <Text size="base" weight="bold" intent="primary">{money(summary.currency, summary.total)}</Text>
            {summary.discount && (
              <SavingsBadge amount={summary.discount.label} prefix="" className="shrink-0 mx-1.5" />
            )}
          </div>
        </div>

        {/* ── How much to pay now ──────────────────────────────────────── */}
        {summary.mustPayFull ? (
          <div className="px-5 py-4 border-b border-(--border-muted)">
            <Text size="sm" weight="semibold" intent="primary" className="block">Full payment due</Text>
            <Text size="xs" intent="muted" className="block mt-0.5">
              {summary.balanceDueDate === null && summary.depositAmount >= summary.total
                ? "This trip is paid in one instalment."
                : "Travel is close enough that the balance is already due, so the whole amount is payable now."}
            </Text>
          </div>
        ) : (
          <div className="px-5 py-4 border-b border-(--border-muted) flex flex-col gap-2.5">
            <PayOption
              selected={choice === "DEPOSIT"} onSelect={() => setPayChoice("DEPOSIT")}
              title="Pay advance to book" amount={money(summary.currency, summary.depositAmount)}
              sub={`Balance ${money(summary.currency, summary.balanceAmount)}${summary.balanceDueDate ? ` by ${formatDate(summary.balanceDueDate)}` : ""}`}
            />
            <PayOption
              selected={choice === "FULL"} onSelect={() => setPayChoice("FULL")}
              title="Pay full amount now" amount={money(summary.currency, summary.total)}
              sub="Nothing left to pay later."
            />
          </div>
        )}

        {/* ── Policies, then pay ───────────────────────────────────────── */}
        <div className="px-5 py-4">
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox" checked={policy} onChange={(e) => setPolicy(e.target.checked)}
              className="mt-0.5 size-4 cursor-pointer shrink-0 accent-primary-500"
            />
            <Text size="xs" intent="secondary">
              I confirm I have read and accept the{" "}
              <Link href="/cancellation-policy" target="_blank" className="text-primary-500 underline">Cancellation Policy</Link>,{" "}
              <Link href="/terms" target="_blank" className="text-primary-500 underline">Terms of Service</Link>{" and "}
              <Link href="/privacy-policy" target="_blank" className="text-primary-500 underline">Privacy Policy</Link>.
            </Text>
          </label>

          <Button
            variant="premium" size="lg" className="w-full mt-4"
            onClick={proceed} loading={submitting} disabled={!policy || submitting}
          >
            {policy ? `Pay ${money(summary.currency, payNow)} now` : "Accept policies to continue"}
          </Button>

          {error && <Text size="xs" intent="error" className="mt-2 block text-center" role="alert">{error}</Text>}
        </div>
      </Card>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <Text size="xs" intent="muted" className="block">{label}</Text>
      <Text size="sm" weight="semibold" intent="primary" className="block truncate">{value}</Text>
    </div>
  );
}

/** Same control the catalogue's review uses, so the choice looks identical
 *  whichever way a client arrived at it. */
function PayOption({ selected, onSelect, title, amount, sub }: {
  selected: boolean; onSelect: () => void; title: string; amount: string; sub: string;
}) {
  return (
    <button
      type="button" onClick={onSelect}
      className={`w-full text-left cursor-pointer rounded-lg border px-3 py-2.5 transition ${
        selected ? "border-primary-500 ring-2 ring-primary-200 bg-primary-50/60" : "border-(--border-muted) hover:border-primary-300"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${selected ? "border-primary-500" : "border-neutral-300"}`}>
          {selected && <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <Text size="sm" weight="semibold" intent="primary">{title}</Text>
            <Text size="sm" weight="bold" intent="primary">{amount}</Text>
          </div>
          <Text size="xs" intent="muted" className="block mt-0.5">{sub}</Text>
        </div>
      </div>
    </button>
  );
}
