import type { DayItinerary } from "@/app/(dashboard)/dashboard/(builder)/package-builder/action";

/** Every field a hotel-team fill (or a hotel request itself) can touch — the
 * exact set `saveCustomPackage`'s staleResurrection guard protects from a
 * stale client payload. Kept in one place so this list and that guard can't
 * silently drift apart. */
const HOTEL_FIELDS = [
  "accommodation", "accommodationPhoto", "accommodationRoomPhotos", "accommodationLocation",
  "accommodationRoomSpecs", "accommodationStarRating", "accommodationRoomCapacity",
  "accommodationMaxAdults", "accommodationMaxChildren", "accommodationExtraBedCapacity",
  "manualExtraBeds", "roomPricingId", "roomsCount", "manualHotelPricePerNight", "manualExtraBedRate",
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
    const fresh = freshByDay.get(it.day);
    if (!fresh) return it;
    const patch: Partial<DayItinerary> = {};
    for (const key of HOTEL_FIELDS) {
      (patch as Record<string, unknown>)[key] = fresh[key];
    }
    return { ...it, ...patch };
  });
}
