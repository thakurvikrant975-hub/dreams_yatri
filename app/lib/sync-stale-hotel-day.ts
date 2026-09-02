import type { DayItinerary } from "@/app/(dashboard)/dashboard/(builder)/package-builder/action";

/** Every field a hotel-team fill (or a hotel request itself) can touch — the
 * exact set `saveCustomPackage`'s staleResurrection guard protects from a
 * stale client payload. Kept in one place so this list and that guard can't
 * silently drift apart. */
const HOTEL_FIELDS = [
  "accommodation", "accommodationPhoto", "accommodationRoomPhotos", "accommodationLocation",
  "accommodationRoomSpecs", "accommodationStarRating", "accommodationRoomCapacity",
  "accommodationMaxAdults", "accommodationMaxChildren", "accommodationExtraBedCapacity",
  "accommodationExtraBedRate",
  "manualExtraBeds", "roomPricingId", "roomsCount", "manualHotelPricePerNight", "manualExtraBedRate",
  // A hotel request clears the night's other room types with the rest of the
  // stay (removeStay), and a fill sets a single room — so the server's list is
  // the truth for a filled day, and a stale tab's combo from the property that
  // was there before must not survive the merge.
  "extraRooms",
  "hotelCheckIn", "hotelCheckOut", "hotelMealPlan",
  "hotelPending", "hotelPendingNote", "hotelRequestType",
  "hotelFilledAt", "hotelFilledByName", "hotelFillNote",
] as const satisfies readonly (keyof DayItinerary)[];

/** After `saveCustomPackage` reports a day in `staleHotelRequestDays` (this
 * tab's copy predated a hotel-team fill it never saw, so its re-request was
 * blocked rather than silently clobbering the fill), this merges the
 * server's actual current hotel state for those specific days back into
 * local form state.
 *
 * Without this, the exec had to manually reload the whole page just to see
 * the hotel that was actually filled — and until they did, retrying the
 * same remove/re-request kept getting blocked for the same reason, since
 * their tab's `hotelFilledAt` still didn't match the database's. Merging the
 * fresh day in fixes both: they see the real hotel immediately, and their
 * tab is now caught up, so a follow-up request on that day goes through. */
export function mergeStaleHotelDays(
  itineraries: DayItinerary[],
  freshItineraries: DayItinerary[],
  staleDays: number[],
): DayItinerary[] {
  const freshByDay = new Map(freshItineraries.map((d) => [d.day, d]));
  return itineraries.map((it) => {
    if (!staleDays.includes(it.day)) return it;
    // The fetch behind this merge is async — if the exec already removed the
    // hotel and started a new request on this exact day before it landed
    // (beginHotelRequest/removeStay set hotelFillAcknowledged the moment
    // that happens), applying the merge now would silently overwrite their
    // in-progress removal back to the stale-fill's old hotel, undoing what
    // they just did without any indication it happened. Leave it alone —
    // they've already moved past needing this sync.
    if (it.hotelFillAcknowledged) return it;
    const fresh = freshByDay.get(it.day);
    if (!fresh) return it;
    const patch: Partial<DayItinerary> = {};
    for (const key of HOTEL_FIELDS) {
      (patch as Record<string, unknown>)[key] = fresh[key];
    }
    return { ...it, ...patch };
  });
}
