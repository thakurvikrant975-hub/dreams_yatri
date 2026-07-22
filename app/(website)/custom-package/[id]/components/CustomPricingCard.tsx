"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import Card from "@/app/components/ui/Card";
import { Text } from "@/app/components/ui/Typography";
import type { PreviewData } from "@/app/(dashboard)/dashboard/(builder)/package-builder/[packageId]/ItineraryDocument";
import { useBookCustomPackage } from "./useBookCustomPackage";

/** Mirrors the catalog page's PricingCard chrome (Card, spacing, typography)
 * but with locked, total-only content — no per-adult/GST breakdown. "Book
 * Now" creates a real Booking from the locked price (see
 * useBookCustomPackage) and hands off to the same login/pay/webhook
 * pipeline the catalog flow already uses, instead of a manual payment link. */
export function CustomPricingCard({ form, packageId }: { form: PreviewData; packageId: string }) {
  const totalPax = form.adults + form.children;
  const priceStr = form.totalPrice ? `${form.currency} ${Number(form.totalPrice).toLocaleString("en-IN")}` : "To be confirmed";
  const perPersonStr = form.pricePerPerson
    ? `${form.currency} ${Number(form.pricePerPerson).toLocaleString("en-IN")} per person`
    : null;
  const { handleBookNow, submitting, error } = useBookCustomPackage(packageId);

  return (
    <Card className="px-6 py-5">
      <Text size="xs" intent="muted" weight="medium" className="uppercase tracking-wide">
        Total Package Price
      </Text>
      <div className="flex items-baseline gap-2 mt-0.5">
        <Text as="span" size="2xl" weight="bold" intent="primary" className="font-heading tracking-tight">
          {priceStr}
        </Text>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-100">
        <Text size="sm" intent="secondary">
          For {totalPax} traveller{totalPax !== 1 ? "s" : ""}
        </Text>
        {perPersonStr && (
          <Text size="sm" intent="secondary" weight="medium">{perPersonStr}</Text>
        )}
      </div>
      {form.infants > 0 && (
        <Text size="xs" intent="muted" className="mt-1.5 block">
          Infant charges as applicable / on request
        </Text>
      )}

      {form.totalPrice ? (
        <button
          type="button"
          onClick={handleBookNow}
          disabled={submitting}
          className="flex items-center justify-center gap-1.5 w-full mt-4 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white font-bold text-sm px-4 py-2.5 rounded-lg transition-colors"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <>Book Now <ArrowRight size={14} /></>}
        </button>
      ) : null}
      {error && (
        <Text size="xs" intent="error" className="mt-2 block text-center" role="alert">
          {error}
        </Text>
      )}
    </Card>
  );
}
