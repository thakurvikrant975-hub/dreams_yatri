// ─────────────────────────────────────────────────────────────────────────────
// Day mutations — the one definition of what each itinerary edit does.
//
// Pure functions: (day, input) → new day. No React, no state, no I/O, so they
// can be unit-tested directly and, more importantly, shared.
//
// The sharing is the point. Picking a hotel snapshots six fields off the
// catalog room — including the occupancy caps the room/mattress maths and the
// package price both depend on. As soon as a second surface (a task drawer in
// the preview) can also pick a hotel, any drift between its version of that
// snapshot and the right-hand panel's shows up as a silently wrong price
// rather than as an error. One function, called from both, makes that class of
// bug impossible instead of merely unlikely.
// ─────────────────────────────────────────────────────────────────────────────

import type { DayItinerary, HotelRoomResult } from "../action";
import { formatTime12h } from "./ItineraryDocument";

/** Structured meal keys on a room's plan → the document's display labels.
 * Mirrors MEAL_KEY_LABELS in page.tsx, which stays there because the right
 * panel uses it for its own meal chips too. */
const MEAL_KEY_LABELS: Record<string, string> = {
  breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner",
};

/**
 * Applies a catalog room selection to a day.
 *
 * Every field that isn't on the room falls back to what the day already had,
 * so re-picking a room never blanks something an exec typed by hand.
 */
export function applyHotelRoomSelection(
  day: DayItinerary,
  raw: HotelRoomResult,
): DayItinerary {
  // Which meals this room's plan actually covers, rather than leaving the
  // exec to toggle them by hand — falls back to whatever was already set if
  // the plan has no structured meals configured (e.g. a room-only rate).
  const hotelMeals = raw.coveredMeals
    .map((k) => MEAL_KEY_LABELS[k])
    .filter((v): v is string => !!v);

  return {
    ...day,
    accommodation: `${raw.hotelName} — ${raw.roomName}`,
    accommodationPhoto: raw.hotelPhoto ?? day.accommodationPhoto,
    accommodationRoomPhotos: raw.roomPhotos.length > 0 ? raw.roomPhotos : day.accommodationRoomPhotos,
    accommodationLocation: raw.location ?? day.accommodationLocation,
    accommodationRoomSpecs: raw.roomSpecs ?? day.accommodationRoomSpecs,
    accommodationRoomCapacity: raw.roomCapacity ?? day.accommodationRoomCapacity,
    // Occupancy caps snapshotted straight from the picked room — these feed
    // the "rooms & mattresses needed" readout AND the priced room count (see
    // planRoomOccupancy in app/lib/room-capacity.ts). Dropping any of them
    // here would leave the day falling back to base beds alone and quietly
    // over-report rooms. A manual mattress count from before (if this day was
    // previously hand-typed) no longer means anything once a real catalog room
    // is behind it.
    accommodationMaxAdults: raw.maxAdults,
    accommodationMaxChildren: raw.maxChildren,
    accommodationExtraBedCapacity: raw.extraBedCapacity,
    manualExtraBeds: null,
    hotelMealPlan: raw.mealPlanName ?? day.hotelMealPlan,
    meals: hotelMeals.length > 0 ? hotelMeals : day.meals,
    // The hotel's own check-in/check-out policy. Stored as 24h "HH:MM" on the
    // hotel record (<input type="time">) — converted here so it reads the same
    // as a hand-typed value both in the field and in the document.
    hotelCheckIn: raw.checkInTime ? formatTime12h(raw.checkInTime) : day.hotelCheckIn,
    hotelCheckOut: raw.checkOutTime ? formatTime12h(raw.checkOutTime) : day.hotelCheckOut,
    // Links this night to the real hotel_room_pricing row so the package price
    // can be computed from its actual date/occupancy-aware rate.
    roomPricingId: raw.id,
  };
}

/**
 * Clears the day's hotel.
 *
 * Zeroes roomPricingId so a removed hotel stops contributing to the price, and
 * drops the capacity snapshot with it — leaving stale caps behind would let a
 * hand-typed replacement inherit the old room's occupancy limits.
 */
export function clearHotelSelection(day: DayItinerary): DayItinerary {
  return {
    ...day,
    accommodation: "",
    accommodationPhoto: "",
    accommodationRoomPhotos: [],
    accommodationLocation: "",
    accommodationRoomSpecs: "",
    accommodationRoomCapacity: null,
    accommodationMaxAdults: null,
    accommodationMaxChildren: null,
    accommodationExtraBedCapacity: null,
    hotelMealPlan: "",
    roomPricingId: null,
    roomsCount: null,
    extraRooms: [],
  };
}
