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
}

/** Same pattern as RoomSelection, for an additional cab on the same day
 * (e.g. one Sedan + one SUV). cabPricingId is null when picked from the
 * unscoped fleet catalog (no real rate to reference), matching the primary
 * cabPricingId's own null case. */
export interface CabSelection {
  cabPricingId: number | null;
  label:        string;
  quantity:     number;
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
    }));
}
