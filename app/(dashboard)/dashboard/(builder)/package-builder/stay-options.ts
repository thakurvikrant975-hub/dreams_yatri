// ─────────────────────────────────────────────────────────────────────────────
// Stay tiers — the 2★/3★/4★ options a package is quoted at.
//
// Pure half: labels, ordering, and the star ladder itself. No "use server", so
// the builder, the costing panel, the document and the server actions can all
// import it — the mutations live next door in stay-options.actions.ts.
//
// Only hotels differ between tiers (see the schema comment on
// custom_package_stay_options): one itinerary, one set of activities and cabs,
// N choices of where the client sleeps, therefore N prices.
// ─────────────────────────────────────────────────────────────────────────────

/** The tiers a package can be quoted at. Not free text: these have to sort,
 * and "3★ on this package" has to mean the same as "3★ on that one" for the
 * comparison table to say anything. */
export const STAR_TIERS = [2, 3, 4, 5] as const;
export type StarTier = (typeof STAR_TIERS)[number];

export function isStarTier(n: number): n is StarTier {
  return (STAR_TIERS as readonly number[]).includes(n);
}

/** "3 Star", unless the exec named it something else ("3 Star — Lake View"). */
export function stayOptionLabel(o: { starRating: number; label?: string | null }): string {
  return o.label?.trim() || `${o.starRating} Star`;
}

/** Cheapest tier first, which is the order a client compares in. sortOrder wins
 * where it has been set deliberately; star rating is the tiebreak, so options
 * created before anyone reordered them still come out in a sensible order. */
export function sortStayOptions<T extends { starRating: number; sortOrder?: number }>(options: T[]): T[] {
  return [...options].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.starRating - b.starRating,
  );
}

/** The option the document prints in full and an untouched client is quoted.
 * Falls back to the first by sort order rather than returning nothing: a
 * package with options but no flagged default still has to render. */
export function defaultStayOption<T extends { starRating: number; sortOrder?: number; isDefault: boolean }>(
  options: T[],
): T | null {
  if (options.length === 0) return null;
  return options.find((o) => o.isDefault) ?? sortStayOptions(options)[0];
}

/** The hotel columns that exist both on a stay row and (mirrored, for the
 * default option) on the day row. One list, used by the mirror writer and by
 * every reader that has to copy a stay onto a day — so a column added to one
 * side can't quietly go missing from the other. */
export const STAY_FIELDS = [
  "accommodation",
  "accommodationPhoto",
  "accommodationRoomPhotos",
  "accommodationLocation",
  "accommodationRoomSpecs",
  "accommodationStarRating",
  "accommodationRoomCapacity",
  "accommodationMaxAdults",
  "accommodationMaxChildren",
  "accommodationExtraBedCapacity",
  "roomPricingId",
  "roomsCount",
  "extraRooms",
  "hotelCheckIn",
  "hotelCheckOut",
  "hotelMealPlan",
  "manualHotelPricePerNight",
  // Part of the hotel line's own arithmetic, so they belong to the stay and
  // have to travel with it — a mirror that dropped them would price the
  // default tier off one tier's extra beds and another's rooms.
  "manualExtraBeds",
  "manualExtraBedRate",
  "hotelPriceOverride",
  "hotelPending",
  "hotelPendingNote",
  "hotelRequestType",
  "hotelRequestedAt",
  "hotelFilledAt",
  "hotelFilledById",
  "hotelFilledByName",
  "hotelFillNote",
  "hotelFillNotifiedAt",
] as const;

export type StayFieldName = (typeof STAY_FIELDS)[number];
export type StayFields = Partial<Record<StayFieldName, unknown>>;

/** Narrow any object carrying stay columns down to just those columns — used
 * to copy a stay row onto its day row and back without hand-listing 27 fields
 * at each call site. */
export function pickStayFields<T extends StayFields>(source: T): StayFields {
  const out: StayFields = {};
  for (const key of STAY_FIELDS) {
    if (key in source) out[key] = source[key];
  }
  return out;
}

/** A tier with nothing booked on any day yet. Worth naming because it is the
 * normal state of a freshly added option, and it is the reason a new tier must
 * not be offered to the client or priced as though it were free. */
export function stayOptionIsEmpty(stays: { accommodation?: string | null; roomPricingId?: number | null }[]): boolean {
  return stays.every((s) => !s.accommodation?.trim() && s.roomPricingId == null);
}

/** Which days of a tier still have no hotel — what the exec has left to do
 * before the option can be quoted, and what costing would otherwise be handed
 * as a ₹0 night. */
export function stayOptionGapDays(
  stays: { day: number; accommodation?: string | null; roomPricingId?: number | null; hotelPending?: boolean }[],
): number[] {
  return stays
    .filter((s) => !s.hotelPending && !s.accommodation?.trim() && s.roomPricingId == null)
    .map((s) => s.day)
    .sort((a, b) => a - b);
}
