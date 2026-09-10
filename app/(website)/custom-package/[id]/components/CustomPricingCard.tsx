"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import Card from "@/app/components/ui/Card";
import { Text } from "@/app/components/ui/Typography";
import type { PreviewData } from "@/app/(dashboard)/dashboard/(builder)/package-builder/[packageId]/ItineraryDocument";
import { payingPaxOf } from "@/app/(dashboard)/dashboard/(builder)/package-builder/traveller-ages";
import { useBookCustomPackage } from "./useBookCustomPackage";
import SavingsBadge from "@/app/components/packages/SavingBadge";

/** Mirrors the catalog page's PricingCard chrome (Card, spacing, typography)
 * but with locked, total-only content — no per-adult/GST breakdown. "Book
 * Now" creates a real Booking from the locked price (see
 * useBookCustomPackage) and hands off to the same login/pay/webhook
 * pipeline the catalog flow already uses, instead of a manual payment link. */
export function CustomPricingCard({ form, packageId }: { form: PreviewData; packageId: string }) {
  // Everyone travelling, for the "For N travellers" headcount — a different
  // number from the weighted shares below, which decide how the total splits.
  const totalPax = form.adults + form.children + form.infants;
  // The actual divisor form.pricePerPerson was computed against — see
  // payingPaxOf. Was form.adults + form.children (no infants, no weighting)
  // before child/infant pricing existed; kept in sync with the real formula
  // now so this "does it multiply back exactly" check isn't comparing
  // against the wrong number.
  const payingShares = payingPaxOf(form);
  const priceStr = form.totalPrice ? `${form.currency} ${Number(form.totalPrice).toLocaleString("en-IN")}` : "To be confirmed";
  // Marked approximate when it doesn't multiply back to the total — per-adult
  // is the total divided by paying shares and rounded, so the two can sit a
  // few rupees apart. This card shows both, a foot apart, on the page the
  // client actually reads.
  const perPersonExact =
    !!form.pricePerPerson && !!form.totalPrice && payingShares > 0 &&
    Number(form.pricePerPerson) * payingShares === Number(form.totalPrice);
  const perAdultPrice = form.pricePerPerson ? Number(form.pricePerPerson) : null;
  const perPersonStr = perAdultPrice
    ? `${perPersonExact ? "" : "~"}${form.currency} ${perAdultPrice.toLocaleString("en-IN")} per adult`
    : null;
  const childPct = Math.max(0, form.childPricingPercentage ?? 50) / 100;
  const infantPct = Math.max(0, form.infantPricingPercentage ?? 0) / 100;
  const perChildStr = form.children > 0 && perAdultPrice != null && childPct > 0
    ? `${form.currency} ${(perAdultPrice * childPct).toLocaleString("en-IN", { maximumFractionDigits: 2 })} per child`
    : null;
  const perInfantStr = form.infants > 0 && perAdultPrice != null && infantPct > 0
    ? `${form.currency} ${(perAdultPrice * infantPct).toLocaleString("en-IN", { maximumFractionDigits: 2 })} per infant`
    : null;
  const { handleBookNow, submitting, error } = useBookCustomPackage(packageId);

  return (
    <Card className="px-6 py-5">
      <Text size="xs" intent="muted" weight="medium" className="uppercase tracking-wide">
        Total Package Price
      </Text>
      {/* The saving, stated above the payable figure. `totalPrice` is already
          net of it, so without this the concession the client was promised is
          invisible on the page they were sent. */}
      {form.discount && (
        <div className="flex items-center gap-2.5 mt-1">
          <Text as="span" size="sm" intent="muted" className="line-through">
            {form.currency} {Math.round(form.discount.originalPrice).toLocaleString("en-IN")}
          </Text>
          <SavingsBadge amount={form.discount.label} prefix="" className="py-1 mr-1" />
        </div>
      )}

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
      {perChildStr && (
        <Text size="xs" intent="secondary" className="mt-1 block text-right">{perChildStr}</Text>
      )}
      {perInfantStr && (
        <Text size="xs" intent="secondary" className="mt-1 block text-right">{perInfantStr}</Text>
      )}
      {form.infants > 0 && !perInfantStr && (
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
