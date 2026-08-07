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

import type {
  DayItinerary, HotelRoomResult, VehicleResult, CabPricingResult, ActivityInput,
} from "../action";
import { formatTime12h } from "./ItineraryDocument";

/** Vehicle enum → display label. Mirrors CAB_LABELS in page.tsx, which stays
 * there because the right panel uses it for its own cab chips too. */
const CAB_LABELS: Record<string, string> = {
  SEDAN: "Sedan", SUV: "SUV", TEMPO: "Tempo Traveller", BUS: "Bus",
};

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

// ─────────────────────────────────────────────────────────────────────────────
// Transfer
// ─────────────────────────────────────────────────────────────────────────────

/** A search hit from either cab source: `cab_pricing` (a real, bookable rate —
 * has vehicleName) or the unscoped `vehicles` fleet catalog (no rate yet). */
export type AnyVehicleHit = VehicleResult | CabPricingResult;

/** True for a priced `cab_pricing` row rather than a bare fleet vehicle. Only
 * the priced kind carries a cabPricingId, and only a day with one contributes
 * to the cab subtotal — see computeBuilderCabPricing. */
export function isPricedVehicle(hit: AnyVehicleHit): hit is CabPricingResult {
  return "vehicleName" in hit;
}

/**
 * Applies a vehicle choice to a day.
 *
 * Mirrors the right-hand panel's handleVehicleSelect exactly, including the
 * cabPricingId rule above — picking from the fleet catalog deliberately leaves
 * it null so an unpriced vehicle can be shown on the itinerary without
 * silently contributing ₹0 to a costed total.
 */
export function applyVehicleSelection(day: DayItinerary, hit: AnyVehicleHit): DayItinerary {
  const priced = isPricedVehicle(hit);
  const name = priced ? hit.vehicleName : hit.name;
  const type = priced ? hit.vehicleType : hit.type;
  return {
    ...day,
    transport: name,
    transportPhoto: hit.thumbnail ?? day.transportPhoto,
    transportVehicleType: CAB_LABELS[type] ?? type,
    transportSeats: hit.passengerCapacity,
    cabPricingId: priced ? hit.id : null,
  };
}

/**
 * Clears the day's vehicle.
 *
 * Zeroes cabPricingId so a removed vehicle stops contributing to the price.
 * Pickup/drop/distance/travel-time are deliberately left alone — those
 * describe the route, not which vehicle covers it, and an exec swapping cabs
 * should not have to retype them.
 */
export function clearVehicleSelection(day: DayItinerary): DayItinerary {
  return {
    ...day,
    transport: "",
    transportPhoto: "",
    transportVehicleType: "",
    transportSeats: null,
    cabPricingId: null,
    cabQuantity: null,
    extraCabs: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Activities
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_ACTIVITY: ActivityInput = {
  title: "", description: "", photo: "", photos: [], photoLabels: [],
};

export function addActivity(day: DayItinerary, title = ""): DayItinerary {
  return { ...day, activities: [...day.activities, { ...EMPTY_ACTIVITY, title }] };
}

export function updateActivity(
  day: DayItinerary,
  index: number,
  patch: Partial<ActivityInput>,
): DayItinerary {
  return {
    ...day,
    activities: day.activities.map((a, i) => (i === index ? { ...a, ...patch } : a)),
  };
}

export function removeActivity(day: DayItinerary, index: number): DayItinerary {
  return { ...day, activities: day.activities.filter((_, i) => i !== index) };
}

/** Moves one activity by `delta` positions, clamped to the list. Returns the
 * day unchanged when the move would fall off either end, so a caller can wire
 * up/down buttons without guarding the boundaries itself. */
export function moveActivity(day: DayItinerary, index: number, delta: number): DayItinerary {
  const to = index + delta;
  if (to < 0 || to >= day.activities.length) return day;
  const next = [...day.activities];
  const [moved] = next.splice(index, 1);
  next.splice(to, 0, moved);
  return { ...day, activities: next };
}

// ─────────────────────────────────────────────────────────────────────────────
// Costing overrides
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Drops a costing correction that no longer describes what's selected.
 *
 * hotelPriceOverride/cabPriceOverride are corrections costing applied to a
 * SPECIFIC hotel or cab during review. saveCustomPackage already invalidates
 * them server-side once the selection changes (hotelSelectionChanged /
 * cabSelectionChanged in package-builder/action.ts) — but that only lands after
 * a save round-trips and the form is refreshed, which plain "Save Draft" never
 * does. Until then the live preview would keep pricing off the stale override,
 * so swapping a hotel right after a costing rejection would silently show the
 * old corrected price.
 *
 * The right-hand panel has always mirrored that invalidation client-side. This
 * is the same predicate, extracted so every edit surface gets it — a drawer
 * that wrote the day directly would otherwise reintroduce exactly the bug the
 * panel already guards against.
 */
export function invalidateStaleOverrides(prev: DayItinerary, next: DayItinerary): DayItinerary {
  const hotelChanged =
    prev.roomPricingId !== next.roomPricingId
    || prev.roomsCount !== next.roomsCount
    || prev.manualHotelPricePerNight !== next.manualHotelPricePerNight
    || prev.accommodation !== next.accommodation
    || JSON.stringify(prev.extraRooms ?? []) !== JSON.stringify(next.extraRooms ?? []);
  const cabChanged =
    prev.cabPricingId !== next.cabPricingId
    || prev.transportDistanceKm !== next.transportDistanceKm
    || prev.cabQuantity !== next.cabQuantity
    || JSON.stringify(prev.extraCabs ?? []) !== JSON.stringify(next.extraCabs ?? []);

  if (!hotelChanged && !cabChanged) return next;
  return {
    ...next,
    hotelPriceOverride: hotelChanged ? null : next.hotelPriceOverride,
    cabPriceOverride: cabChanged ? null : next.cabPriceOverride,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Blank day
// ─────────────────────────────────────────────────────────────────────────────

/** A fresh, empty day. Shared with page.tsx so inserting a day from the
 * preview produces exactly the same shape as the right panel's "Add day" —
 * a field missing here would read as undefined rather than as its empty
 * value, and only show up much later as a save or render oddity. */
export const emptyDay = (day: number): DayItinerary => ({
  day, title: "", description: "", activities: [],
  meals: [], accommodation: "", accommodationPhoto: "", accommodationRoomPhotos: [],
  accommodationLocation: "", accommodationRoomSpecs: "", accommodationRoomCapacity: null,
  roomPricingId: null,
  hotelCheckIn: "", hotelCheckOut: "", hotelMealPlan: "",
  hotelPending: false, hotelPendingNote: "", manualHotelPricePerNight: null,
  hotelFilledAt: null, hotelFilledByName: null,
  transport: "", transportPhoto: "", transportVehicleType: "", transportSeats: null,
  transportPickup: "", transportPickupLat: null, transportPickupLng: null,
  transportDrop: "", transportDistanceKm: null, transportTravelTime: "",
  cabPricingId: null,
  notes: "",
});
