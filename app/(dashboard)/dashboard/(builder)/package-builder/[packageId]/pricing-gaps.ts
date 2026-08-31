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

import type { DayItinerary, TicketInput, AddonInput } from "@/app/(dashboard)/dashboard/(builder)/package-builder/action";

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
 * A day awaiting the hotel team is a known blank rather than a forgotten one,
 * so it is never badged.
 *
 * A catalog room used to be exempt too, on the reasoning that a real
 * hotel_room_pricing row is by definition priced. The room is. Its
 * extra_bed_rate is a different column and is very often null, and its room's
 * extra_bed_capacity is very often 0 — so mattresses an exec had entered
 * against a perfectly ordinary catalog room were charged at nothing, or
 * recorded against a room that cannot hold them, and this function said the
 * day was fine. It was the single largest source of "why was this rejected".
 * The mattress rules now apply to both kinds of stay; only the nightly-rate
 * rule stays exclusive to a hand-typed one.
 */
export function stayGaps(d: DayItinerary): Gaps {
  if (d.hotelPending) return [];
  const isCatalog = d.roomPricingId != null;
  if (!isCatalog && !d.accommodation.trim()) return [];

  const gaps: Gaps = [];
  if (!isCatalog && (d.manualHotelPricePerNight == null || d.manualHotelPricePerNight <= 0)) {
    gaps.push("no nightly rate");
  }

  // Only once mattresses are actually claimed — a rate with nothing to apply
  // it to isn't missing, it's irrelevant. An explicit count is the claim; the
  // auto-derived count is not, because nobody typed it and the room's own rate
  // will be applied to it correctly or not at all.
  const claimed = d.manualExtraBeds ?? 0;
  if (claimed > 0) {
    // The rate the day will actually be charged at — the exec's override
    // first, then the room's own snapshotted rate. Same order as
    // computeBuilderHotelPricing and stay-diagnostics.
    const rate = d.manualExtraBedRate ?? (isCatalog ? d.accommodationExtraBedRate ?? 0 : 0);
    if (rate <= 0) gaps.push("no mattress rate");

    if (isCatalog) {
      const perRoom = d.accommodationExtraBedCapacity ?? 0;
      const rooms = d.roomsCount && d.roomsCount > 0 ? d.roomsCount : 1;
      if (perRoom <= 0) gaps.push("room has no mattresses enabled");
      else if (claimed > perRoom * rooms) gaps.push("more mattresses than the rooms can take");
    }
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
