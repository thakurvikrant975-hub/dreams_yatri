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

import type { RoomSelection, CabSelection } from "../room-cab-selections";
import type {
  DayItinerary, HotelRoomResult, VehicleResult, CabPricingResult, ActivityInput,
  TicketInput, AddonInput,
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
    // A day that was hand-typed before now has a real catalog rate behind it —
    // leaving the manual price/rate set would double-count it against the
    // room's own rate in computeBuilderHotelPricing's manual branch.
    manualHotelPricePerNight: null,
    manualExtraBedRate: null,
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
  hotelPending: false, hotelPendingNote: "", hotelRequestType: null, manualHotelPricePerNight: null,
  hotelFilledAt: null, hotelFilledByName: null,
  transport: "", transportPhoto: "", transportVehicleType: "", transportSeats: null,
  transportPickup: "", transportPickupLat: null, transportPickupLng: null,
  transportDrop: "", transportDistanceKm: null, transportTravelTime: "",
  cabPricingId: null,
  notes: "", notesType: null, notesTitle: null,
});

// ─────────────────────────────────────────────────────────────────────────────
// Tickets and add-ons
//
// Package-level rather than day-level (a return flight belongs to the trip,
// not to a day), but they live here for the same reason everything else does:
// one definition, shared by the right-hand panel and the preview's drawers.
// ─────────────────────────────────────────────────────────────────────────────

export const emptyTicket = (type: TicketInput["type"]): TicketInput => ({
  type, provider: "", ticketNumber: "",
  fromPlace: "", toPlace: "", travelDate: "", departureTime: "", arrivalTime: "", durationText: "",
  adults: 0, children: 0, infants: 0, ticketCount: 1,
  fare: null, notes: "",
});

export const TICKET_TYPE_LABELS: Record<TicketInput["type"], string> = {
  FLIGHT: "Flight", TRAIN: "Train", HELICOPTER: "Helicopter",
};

/** Journey length from the two times — derived, never typed. Wraps past
 * midnight (a 23:30 → 01:10 leg is 1h 40m, not negative). */
export function computeDurationText(departureTime: string, arrivalTime: string): string {
  if (!departureTime || !arrivalTime) return "";
  const [dh, dm] = departureTime.split(":").map(Number);
  const [ah, am] = arrivalTime.split(":").map(Number);
  if ([dh, dm, ah, am].some((n) => Number.isNaN(n))) return "";
  let diff = (ah * 60 + am) - (dh * 60 + dm);
  if (diff < 0) diff += 24 * 60;
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/** A blank add-on. `day` null means it belongs to the package as a whole
 * rather than to one day — see AddonInput.day. */
export const emptyAddon = (day: number | null = null): AddonInput => ({
  name: "", price: null, quantity: 1, notes: "", day,
});

// ─────────────────────────────────────────────────────────────────────────────
// "Add Hotels by Team" request
//
// When an exec can't find a suitable hotel in the catalog, the day is handed
// to the hotel team instead: hotelPending flags it into their queue
// (/dashboard/hotel-requests) and blocks the package from going to costing
// review until they fill it in.
//
// The request reuses roomsCount / manualExtraBeds / hotelMealPlan rather than
// having its own columns — see the 20260806150000_add_hotel_request_type
// migration note. That means starting a request and picking a hotel write to
// overlapping fields, which is exactly why both live here rather than being
// spelled out at each call site.
// ─────────────────────────────────────────────────────────────────────────────

/** Property types an exec can ask the team for. Mirrors STAY_LABELS in
 * page.tsx, which stays there because the right panel renders the same list. */
export const STAY_TYPE_LABELS: Record<string, string> = {
  STAR_3: "3★ Hotel", STAR_4: "4★ Hotel", STAR_5: "5★ Hotel",
  BOUTIQUE: "Boutique", HOMESTAY: "Homestay",
  RESORT: "Resort", CAMP: "Camp", BUDGET: "Budget",
};

/**
 * Clears the day's catalog hotel so a request can be composed against it.
 *
 * A request and a picked room are mutually exclusive: the pricing engine takes
 * the manual branch for a day with no roomPricingId, so leaving a stale room
 * behind would keep charging for a hotel the exec has just said they couldn't
 * find. Does NOT set hotelPending — the day only enters the team's queue on
 * submit, so an abandoned form leaves nothing behind.
 */
export function beginHotelRequest(day: DayItinerary): DayItinerary {
  return {
    ...clearHotelSelection(day),
    manualExtraBeds: null,
    manualHotelPricePerNight: null,
    manualExtraBedRate: null,
    hotelRequestType: null,
    hotelPendingNote: "",
  };
}

/** Puts the day into the hotel team's queue. */
export function submitHotelRequest(day: DayItinerary): DayItinerary {
  return { ...day, hotelPending: true };
}

/** Withdraws the request — the exec would rather search again after all. */
export function cancelHotelRequest(day: DayItinerary): DayItinerary {
  return {
    ...day,
    hotelPending: false,
    hotelPendingNote: "",
    hotelRequestType: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Extra rooms and a hand-typed stay
// ─────────────────────────────────────────────────────────────────────────────

/** Adds a second (different) room type for the same night — e.g. one couple in
 * a Deluxe, another in a Suite. Captured the same way the primary room is, so
 * it renders and prices with the same fidelity rather than as a bare label. */
export function addExtraRoom(day: DayItinerary, raw: HotelRoomResult): DayItinerary {
  return {
    ...day,
    extraRooms: [
      ...(day.extraRooms ?? []),
      {
        roomPricingId: raw.id,
        label: `${raw.hotelName} — ${raw.roomName}`,
        quantity: 1,
        thumbnail: raw.thumbnail ?? null,
        roomCapacity: raw.roomCapacity ?? null,
        roomSpecs: raw.roomSpecs ?? null,
      },
    ],
  };
}

export function updateExtraRoom(
  day: DayItinerary, index: number, patch: Partial<RoomSelection>,
): DayItinerary {
  return {
    ...day,
    extraRooms: (day.extraRooms ?? []).map((r, i) => (i === index ? { ...r, ...patch } : r)),
  };
}

export function removeExtraRoom(day: DayItinerary, index: number): DayItinerary {
  return { ...day, extraRooms: (day.extraRooms ?? []).filter((_, i) => i !== index) };
}

/**
 * Switches the day to a hand-typed stay.
 *
 * The third state a day's accommodation can be in, alongside a catalog room
 * and a team request. Clears roomPricingId so the pricing engine takes its
 * manual branch (computeBuilderHotelPricing prices these off
 * manualHotelPricePerNight rather than a catalog rate), and drops the capacity
 * snapshot with it — those caps described the catalog room, and leaving them
 * would have planRoomOccupancy sizing a hotel nobody picked.
 */
export function beginManualHotel(day: DayItinerary): DayItinerary {
  return {
    ...clearHotelSelection(day),
    hotelPending: false,
    hotelPendingNote: "",
    hotelRequestType: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Extra cabs
// ─────────────────────────────────────────────────────────────────────────────

/** A second vehicle type for the same day — one Sedan plus one SUV. Mirrors
 * addExtraRoom, including the cabPricingId rule: a fleet-catalog pick has no
 * rate to reference, so it stays null and contributes nothing to the total. */
export function addExtraCab(day: DayItinerary, hit: AnyVehicleHit): DayItinerary {
  const priced = isPricedVehicle(hit);
  const type = priced ? hit.vehicleType : hit.type;
  return {
    ...day,
    extraCabs: [
      ...(day.extraCabs ?? []),
      {
        cabPricingId: priced ? hit.id : null,
        label: priced ? hit.vehicleName : hit.name,
        quantity: 1,
        vehicleType: CAB_LABELS[type] ?? type,
        seats: hit.passengerCapacity,
        thumbnail: hit.thumbnail ?? null,
      },
    ],
  };
}

export function updateExtraCab(
  day: DayItinerary, index: number, patch: Partial<CabSelection>,
): DayItinerary {
  return {
    ...day,
    extraCabs: (day.extraCabs ?? []).map((c, i) => (i === index ? { ...c, ...patch } : c)),
  };
}

export function removeExtraCab(day: DayItinerary, index: number): DayItinerary {
  return { ...day, extraCabs: (day.extraCabs ?? []).filter((_, i) => i !== index) };
}

// ─────────────────────────────────────────────────────────────────────────────
// One stay across several nights
//
// The normal shape of a package: 3 nights in Manali, then 2 in Srinagar. The
// builder previously made you pick the same hotel once per day, which is both
// tedious and how days drift apart — a re-pick on day 3 can land on a
// different room type than day 2 without anything saying so.
//
// A stay is therefore a RUN of consecutive days sharing one roomPricingId.
// Nothing new is stored: the run is derived from the days themselves, so this
// stays compatible with every package already saved and with the pricing
// engine, which still prices each night independently.
// ─────────────────────────────────────────────────────────────────────────────

/** The consecutive days sharing this day's room, as day numbers. A day with no
 * catalog room is a run of itself alone. */
export function stayRun(days: DayItinerary[], day: number): number[] {
  const idx = days.findIndex((d) => d.day === day);
  if (idx === -1) return [];
  const id = days[idx].roomPricingId;
  if (id == null) return [days[idx].day];

  let start = idx;
  while (start > 0 && days[start - 1].roomPricingId === id) start--;
  let end = idx;
  while (end < days.length - 1 && days[end + 1].roomPricingId === id) end++;
  return days.slice(start, end + 1).map((d) => d.day);
}

/** True when this day continues a stay that began earlier — the case that
 * renders as a compact "already assigned from day N" card rather than a full
 * hotel block. */
export function continuesStayFrom(days: DayItinerary[], day: number): number | null {
  const run = stayRun(days, day);
  return run.length > 1 && run[0] !== day ? run[0] : null;
}

export type StayAssignment =
  | { ok: true; days: number[] }
  | { ok: false; reason: string };

/**
 * Checks a proposed run of nights for one hotel.
 *
 * Two rules, both about producing an itinerary a hotel could actually honour:
 *
 *   consecutive — a guest cannot stay Monday and Wednesday at one hotel while
 *                 sleeping elsewhere on Tuesday and have it be one booking.
 *                 Non-contiguous nights are two separate stays, and saying so
 *                 is better than silently making a booking nobody can fulfil.
 *   in range    — every night has to exist in the itinerary.
 *
 * Deliberately NOT a rule: overlapping another hotel's run. Re-assigning
 * nights away from a previous hotel is the normal way to correct a mistake,
 * and the days simply move.
 */
export function validateStayAssignment(
  days: DayItinerary[],
  wanted: number[],
): StayAssignment {
  const sorted = [...new Set(wanted)].sort((a, b) => a - b);
  if (sorted.length === 0) return { ok: false, reason: "Pick at least one night." };

  const known = new Set(days.map((d) => d.day));
  const missing = sorted.filter((d) => !known.has(d));
  if (missing.length > 0) {
    return { ok: false, reason: `Day ${missing[0]} isn't in this itinerary.` };
  }

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) {
      return {
        ok: false,
        reason: `Nights must run back to back — day ${sorted[i - 1]} and day ${sorted[i]} have a gap. Assign the second stretch separately.`,
      };
    }
  }
  return { ok: true, days: sorted };
}
