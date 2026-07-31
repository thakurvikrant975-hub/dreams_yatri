// ── Room capacity semantics ─────────────────────────────────────────────────
//
// The hotel_rooms column names are misleading, so state them once here — every
// capacity decision in the app should come through this module rather than
// re-deriving from the raw columns:
//
//   max_occupancy      — BASE adults on standard beds, charged at the room rate
//                        with no surcharge. Despite the name this is NOT the
//                        room's total capacity.
//   extra_bed_capacity — additional mattresses / rollaway beds available per
//                        room, each charged at extra_bed_rate.
//   max_adults         — hard cap on adults, inclusive of those on extra beds.
//   max_children       — children the room can take. Children may SHARE adult
//                        beds (that is exactly how the hotel dashboard labels
//                        the field), so they do not each require an extra bed.
//
// The hotel dashboard shows owners a computed "Max Occupancy" of
// `max_adults + max_children` (see the Guest Occupancy section of
// dashboard/(main)/hotels/[id]/tabs/RoomsTab.tsx). That total — not the
// `max_occupancy` column — is what a room genuinely holds, and it is what
// pricing must honour, otherwise a guest's own room split gets silently
// re-split into more rooms than they asked for and the price jumps.

export type RoomCapacityFields = {
  max_occupancy?: number | null;
  extra_bed_capacity?: number | null;
  max_adults?: number | null;
  max_children?: number | null;
};

// A room with nothing configured is assumed to sleep 2 on beds + 1 extra bed,
// matching what the pricing engine has always fallen back to.
const FALLBACK_BASE_BEDS = 2;
const FALLBACK_EXTRA_BEDS = 1;

function baseBedsOf(r: RoomCapacityFields | null | undefined): number {
  return r?.max_occupancy ?? FALLBACK_BASE_BEDS;
}

function extraBedsOf(r: RoomCapacityFields | null | undefined): number {
  return r?.extra_bed_capacity ?? FALLBACK_EXTRA_BEDS;
}

/** Total guests one room of this type can hold (adults + children) — the same
 *  number the hotel dashboard shows owners as "Max Occupancy". Floored at the
 *  physical bed count so a partially-configured room never reports fewer
 *  guests than it has beds for. */
export function roomTotalCapacity(r: RoomCapacityFields | null | undefined): number {
  const baseBeds = baseBedsOf(r);
  const extraBeds = extraBedsOf(r);
  const maxAdults = r?.max_adults ?? baseBeds;
  const maxChildren = r?.max_children ?? 0;
  return Math.max(1, maxAdults + maxChildren, baseBeds + extraBeds);
}

/** Chargeable extra mattresses for ONE room at a given headcount: guests past
 *  the base beds, but never more than the room physically has. Guests beyond
 *  that share a bed (see max_children above) and so carry no extra-bed charge. */
export function roomExtraBedsUsed(
  headcount: number,
  r: RoomCapacityFields | null | undefined,
): number {
  return Math.min(extraBedsOf(r), Math.max(0, headcount - baseBedsOf(r)));
}

/** How many rooms of this type a party of `persons` needs, at this room's real
 *  total capacity. Used when the caller gives no explicit room split. */
export function roomsNeededFor(
  persons: number,
  r: RoomCapacityFields | null | undefined,
): number {
  return Math.max(1, Math.ceil(Math.max(persons, 1) / roomTotalCapacity(r)));
}

/** Spread `persons` as evenly as possible across `rooms` rooms — (7, 2) → [4, 3].
 *  Lets a derived room split be costed through exactly the same per-room code
 *  path as an explicit one, so occupancy tiers and mattress counts can never
 *  disagree between the two. */
export function splitPersonsAcrossRooms(persons: number, rooms: number): number[] {
  const n = Math.max(1, Math.floor(rooms));
  const total = Math.max(Math.floor(persons), 1);
  const base = Math.floor(total / n);
  const remainder = total % n;
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
}
