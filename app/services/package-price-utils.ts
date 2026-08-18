// ─────────────────────────────────────────────────────────────────────────────
// Package price composition — subtotals in, what the client pays out.
//
// A plain module, not part of package-pricing.service.ts, for the usual reason
// in this codebase: that file carries "use server", where every export has to
// be an async function. This is pure arithmetic and is called from both server
// and (in time) client code, so it lives beside it instead — same split as
// cab-pricing-utils and hotel-name-utils.
// ─────────────────────────────────────────────────────────────────────────────

import { applyDiscount } from "@/app/(dashboard)/dashboard/(builder)/package-builder/discount";

/** Ticket fares always carry a flat margin, whatever the package's own margin
 * is set to. */
export const TICKET_MARGIN_PCT = 5;

/** Subtotals → what the client pays. Margin on hotel+cab+add-ons at the
 * package's rate, a flat 5% on ticket fares, GST on the lot, then costing's
 * concession off the end (after GST — see discount.ts).
 *
 * Pulled out of computeFinalPackagePricing because stay tiers price the same
 * trip several times over: only the hotel subtotal differs between a 2★ and a
 * 4★ quote, and every other term is shared. Two implementations of this
 * arithmetic would be two answers to "what does this cost", and the tier
 * comparison the client reads is exactly where that would show. */
export function composePackagePrice(input: {
  hotelSubtotal: number;
  cabSubtotal: number;
  ticketsSubtotal: number;
  addonsSubtotal: number;
  marginPercentage: number;
  gstPercentage: number;
  discountType: "FLAT" | "PERCENT" | null;
  discountValue: number | null;
  /** Paying heads — adults + children. Infants don't divide into the total. */
  payingPax: number;
}) {
  const hotelCabBase = input.hotelSubtotal + input.cabSubtotal;
  const baseCost = hotelCabBase + input.addonsSubtotal + input.ticketsSubtotal;
  const hotelCabMarginAmount = Math.round((hotelCabBase + input.addonsSubtotal) * input.marginPercentage / 100);
  const ticketsMarginAmount = Math.round(input.ticketsSubtotal * TICKET_MARGIN_PCT / 100);
  const marginAmount = hotelCabMarginAmount + ticketsMarginAmount;
  const taxable = baseCost + marginAmount;
  const gstAmount = Math.round(taxable * input.gstPercentage / 100);
  const listPrice = taxable + gstAmount;
  const discount = applyDiscount(listPrice, { type: input.discountType, value: input.discountValue });
  const finalPrice = discount.finalPrice;

  return {
    hotelCabBase, baseCost, hotelCabMarginAmount, ticketsMarginAmount, marginAmount,
    taxable, gstAmount, listPrice,
    discountAmount: discount.amount,
    totalPrice: finalPrice,
    pricePerPerson: input.payingPax > 0 ? Math.round(finalPrice / input.payingPax) : finalPrice,
  };
}

