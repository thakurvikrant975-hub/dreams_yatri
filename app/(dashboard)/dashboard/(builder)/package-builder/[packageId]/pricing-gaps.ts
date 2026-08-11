// ─────────────────────────────────────────────────────────────────────────────
// Things that are on the package but contribute nothing to its price.
//
// The pricing code is deliberately forgiving — `t.fare ?? 0`, `a.price ?? 0`,
// a cab with no rate row simply skipped. That's correct for computing a total
// (a missing number is not zero-cost, but it's the only thing you can add up)
// and it's exactly what makes these gaps invisible: a train leg with no fare
// looks identical to a train leg that happens to be free, and the total comes
// out confidently wrong.
//
// So the rules live here, once, as pure functions the document reads to badge
// the section. They describe what's MISSING, never what it should be — nothing
// here guesses a price.
//
// Only real gaps. A warning next to something that's fine teaches people to
// ignore warnings, which costs more than the one it was trying to save.
// ─────────────────────────────────────────────────────────────────────────────

import type { DayItinerary, TicketInput, AddonInput } from "../action";

/** Empty means priced, or at least nothing here can prove otherwise. */
export type Gaps = string[];

/**
 * A travel leg. Fare is summed straight into the package total (see
 * ticketsSubtotal in page.tsx), so a null one quietly prices the leg at zero.
 *
 * Not flagged: a blank carrier or route. Those are cosmetic on a document the
 * client reads, and the exec can see them missing — the number can't be seen.
 */
export function ticketGaps(t: TicketInput): Gaps {
  const gaps: Gaps = [];
  if (t.fare == null || t.fare <= 0) gaps.push("no fare");
  if (t.ticketCount <= 0) gaps.push("no ticket count");
  return gaps;
}

/** An add-on. price × quantity goes into the total; a null price makes the
 * whole line free however many of them there are. */
export function addonGaps(a: AddonInput): Gaps {
  const gaps: Gaps = [];
  if (a.price == null || a.price <= 0) gaps.push("no price");
  if (a.quantity <= 0) gaps.push("no quantity");
  return gaps;
}

/**
 * A day's stay.
 *
 * Only hand-typed stays can have gaps. A catalog room carries a real
 * hotel_room_pricing row, and a day awaiting the hotel team is a known blank
 * rather than a forgotten one — badging either would be noise.
 */
export function stayGaps(d: DayItinerary): Gaps {
  if (d.roomPricingId != null || d.hotelPending) return [];
  if (!d.accommodation.trim()) return [];

  const gaps: Gaps = [];
  if (d.manualHotelPricePerNight == null || d.manualHotelPricePerNight <= 0) {
    gaps.push("no nightly rate");
  }
  // Only once mattresses are actually claimed — a rate with nothing to apply
  // it to isn't missing, it's irrelevant.
  if ((d.manualExtraBeds ?? 0) > 0 && (d.manualExtraBedRate == null || d.manualExtraBedRate <= 0)) {
    gaps.push("no mattress rate");
  }
  return gaps;
}

/**
 * A day's transport.
 *
 * A vehicle picked from the unscoped fleet catalog has no cabPricingId, which
 * is deliberate — there's no rate to reference — but it also means the day
 * adds nothing to the cab subtotal. That's the gap worth naming: the document
 * shows a vehicle, so the trip looks covered.
 *
 * A costing override counts as priced. Someone decided the number by hand.
 */
export function transportGaps(d: DayItinerary): Gaps {
  if (!d.transport.trim()) return [];
  if (d.cabPricingId != null || d.cabPriceOverride != null) return [];
  return ["no rate — picked from the fleet, not a priced cab"];
}
