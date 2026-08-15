// ─────────────────────────────────────────────────────────────────────────────
// Discount maths.
//
// One module because five places need the same answer: the builder's live
// pricing, the costing panel, the document the client reads, the frozen
// snapshot written at send time, and the booking created from it. Two of those
// disagreeing is a client quoted one number and charged another.
//
// Applied AFTER margin and GST. A discount is a concession on what the client
// pays, not a change to what the trip costs us — netting it off earlier would
// shrink the margin figure costing is reviewing and hide the concession inside
// it.
// ─────────────────────────────────────────────────────────────────────────────

export type DiscountInput = {
  type: "FLAT" | "PERCENT" | null | undefined;
  value: number | null | undefined;
};

export type DiscountResult = {
  /** True when a discount is actually in force — set, positive, and reducing. */
  applies: boolean;
  /** Rupees off. Zero when nothing applies. */
  amount: number;
  /** What the package priced at before the concession. */
  originalPrice: number;
  /** What the client pays. */
  finalPrice: number;
  /** Filled only for PERCENT, for the "10% off" chip. */
  percentOff: number | null;
};

/** Resolves a discount against a computed final price.
 *
 * Clamped to the price itself: a flat discount larger than the package can
 * never make the total negative, which would otherwise show the client a
 * refund. Never rounds up — the amount is floored to whole rupees so the
 * struck-through figure and the payable one always differ by exactly what is
 * displayed.
 */
export function applyDiscount(price: number, d: DiscountInput): DiscountResult {
  const none: DiscountResult = {
    applies: false, amount: 0, originalPrice: price, finalPrice: price, percentOff: null,
  };

  if (!d.type || d.value == null || d.value <= 0 || price <= 0) return none;

  const raw = d.type === "PERCENT"
    ? (price * d.value) / 100
    : d.value;

  const amount = Math.min(Math.floor(raw), price);
  if (amount <= 0) return none;

  return {
    applies: true,
    amount,
    originalPrice: price,
    finalPrice: price - amount,
    // Derived rather than echoed back, so a FLAT discount can still be shown
    // as an approximate percentage if a surface wants to.
    percentOff: d.type === "PERCENT" ? d.value : null,
  };
}

/** "₹2,000 off" / "10% off" — the chip the document shows beside the price. */
export function discountLabel(d: DiscountInput, amount: number): string {
  if (d.type === "PERCENT" && d.value) return `${d.value}% off`;
  return `₹${Math.round(amount).toLocaleString("en-IN")} off`;
}
