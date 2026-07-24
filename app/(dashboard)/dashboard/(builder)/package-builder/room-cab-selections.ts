// Plain (non-"use server") module — action.ts is a server-actions file where
// every export must be an async function, so these pure validators live here
// instead, shared by action.ts and the public fetch-shared-package.ts.

/** One additional, DIFFERENT room type booked for the same night beyond the
 * primary `roomPricingId` on DayItinerary — e.g. one couple takes a Deluxe
 * Room while another takes a Suite. `label` is a display copy ("Hotel —
 * Room") captured at selection time, same "typed value + id" pattern as
 * `accommodation`/`roomPricingId` above, so the UI/PDF never needs an extra
 * round-trip fetch just to show what was picked. */
export interface RoomSelection {
  roomPricingId: number;
  label:         string;
  quantity:      number;
  /** Captured at selection time from the same HotelRoomResult the primary
   * room's rich fields come from, so this room type renders with the same
   * fidelity (photo/capacity/specs) instead of a bare label. */
  thumbnail?:     string | null;
  roomCapacity?:  number | null;
  roomSpecs?:     string | null;
}

/** Same pattern as RoomSelection, for an additional cab on the same day
 * (e.g. one Sedan + one SUV). cabPricingId is null when picked from the
 * unscoped fleet catalog (no real rate to reference), matching the primary
 * cabPricingId's own null case. */
export interface CabSelection {
  cabPricingId: number | null;
  label:        string;
  quantity:     number;
  /** Captured at selection time from the same VehicleResult/CabPricingResult
   * the primary cab's rich fields come from — see RoomSelection's thumbnail. */
  vehicleType?:  string | null;
  seats?:        number | null;
  thumbnail?:    string | null;
}

/** Prisma Json columns come back as `unknown`-ish JsonValue — validate into
 * the expected shape rather than trusting it, since a hand-edited row or a
 * future schema tweak could otherwise silently produce garbage entries. */
export function parseRoomSelections(value: unknown): RoomSelection[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
    .map((v) => ({
      roomPricingId: Number(v.roomPricingId),
      label: typeof v.label === "string" ? v.label : "",
      quantity: Math.max(1, Number(v.quantity) || 1),
      thumbnail: typeof v.thumbnail === "string" ? v.thumbnail : null,
      roomCapacity: typeof v.roomCapacity === "number" ? v.roomCapacity : null,
      roomSpecs: typeof v.roomSpecs === "string" ? v.roomSpecs : null,
    }))
    .filter((v) => Number.isFinite(v.roomPricingId));
}

export function parseCabSelections(value: unknown): CabSelection[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
    .map((v) => ({
      cabPricingId: v.cabPricingId == null ? null : Number(v.cabPricingId),
      label: typeof v.label === "string" ? v.label : "",
      quantity: Math.max(1, Number(v.quantity) || 1),
      vehicleType: typeof v.vehicleType === "string" ? v.vehicleType : null,
      seats: typeof v.seats === "number" ? v.seats : null,
      thumbnail: typeof v.thumbnail === "string" ? v.thumbnail : null,
    }));
}
