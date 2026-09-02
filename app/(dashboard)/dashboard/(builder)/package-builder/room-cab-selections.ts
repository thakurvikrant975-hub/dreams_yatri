// Plain (non-"use server") module — action.ts is a server-actions file where
// every export must be an async function, so these pure validators live here
// instead, shared by action.ts and the public fetch-shared-package.ts.

/** One additional, DIFFERENT room type booked for the same night beyond the
 * primary `roomPricingId` on DayItinerary — e.g. one couple takes a Deluxe
 * Room while another takes a Suite. `label` is a display copy ("Hotel —
 * Room") captured at selection time, same "typed value + id" pattern as
 * `accommodation`/`roomPricingId` above, so the UI/PDF never needs an extra
 * round-trip fetch just to show what was picked.
 *
 * Always a room of the SAME hotel as the primary — see `hotelId`. */
export interface RoomSelection {
  roomPricingId: number;
  label:         string;
  quantity:      number;
  /** The property this room belongs to.
   *
   * A night is one booking at one hotel: a party splitting across a Deluxe and
   * a Standard is still checking into a single property, and two hotels on one
   * date is a mistake, not a combo. Carried on the selection so a hotel change
   * can drop the rooms that no longer belong to it (applyHotelRoomSelection)
   * rather than leaving them attached to a property that never had them, still
   * being priced.
   *
   * Optional only for rows written before combos were scoped to one hotel —
   * those are treated as belonging to no known property and are dropped on the
   * next hotel change rather than trusted. */
  hotelId?:      number | null;
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
      hotelId: v.hotelId != null && Number.isFinite(Number(v.hotelId)) ? Number(v.hotelId) : null,
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

/**
 * What a day's extra rooms contribute to its price, as a stable string.
 *
 * Compared against the value read back from the `extraRooms` JSONB column,
 * and that is the whole reason this exists. Postgres canonicalises jsonb: it
 * re-orders every object's keys (by key length, then bytewise) and the builder
 * sends them in the order they were written. `JSON.stringify(stored) !==
 * JSON.stringify(sent)` was therefore TRUE for two identical lists, on every
 * save, for any day carrying a second room type — so `hotelSelectionChanged`
 * reported a change that had not happened and dropped costing's per-day
 * correction for that day, silently, every time the exec saved. The same shape
 * of check, and the same defect, applied to extraCabs.
 *
 * Comparing only what actually prices — which rate rows, and how many of each —
 * fixes the ordering problem and makes the check true to its own name: a
 * re-typed label or a refreshed thumbnail is not a repriced night. Sorted, so
 * the order the exec happened to add two room types in is not a change either.
 */
export function extraRoomsPricingKey(value: unknown): string {
  return parseRoomSelections(value)
    .filter((r) => r.roomPricingId > 0)
    .map((r) => `${r.roomPricingId}x${Math.max(1, r.quantity)}`)
    .sort()
    .join("|");
}

/** The cab counterpart of extraRoomsPricingKey. Keeps the label in the key
 * because a fleet vehicle picked with no rate behind it (cabPricingId null —
 * see CabSelection) has nothing else to identify it by. */
export function extraCabsPricingKey(value: unknown): string {
  return parseCabSelections(value)
    .filter((c) => c.label.trim())
    .map((c) => `${c.cabPricingId ?? "unpriced"}:${c.label.trim()}x${Math.max(1, c.quantity)}`)
    .sort()
    .join("|");
}
