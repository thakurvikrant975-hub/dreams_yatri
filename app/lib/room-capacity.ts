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

/** Hard per-room adult cap — an extra bed is still a bed one adult occupies,
 *  it doesn't let a second adult share it the way a child can share an
 *  adult's bed, so this is never derived from beds+mattresses alone. */
function maxAdultsOf(r: RoomCapacityFields | null | undefined): number {
  return r?.max_adults ?? baseBedsOf(r);
}

function maxChildrenOf(r: RoomCapacityFields | null | undefined): number {
  return r?.max_children ?? 0;
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

/** How many rooms of this type a party of `adults` + `children` needs. Used
 *  when the caller gives no explicit room split.
 *
 *  The blended total (roomTotalCapacity = max_adults + max_children) is only
 *  a safe bound for a genuinely MIXED party — an all-adult party can't lean
 *  on the "+ max_children" headroom at all, since that headroom exists
 *  because children may share an adult's bed, and there's no equivalent
 *  sharing among adults. So this takes whichever of three constraints demands
 *  the most rooms: adults alone against max_adults, children alone against
 *  max_children, and the blended total against roomTotalCapacity — e.g. a
 *  room with max_adults 3 / max_children 2 (roomTotalCapacity 5) sleeps at
 *  most 3 people when every one of them is an adult, not 5. */
export function roomsNeededFor(
  adults: number,
  children: number,
  r: RoomCapacityFields | null | undefined,
): number {
  const a = Math.max(0, Math.floor(adults));
  const c = Math.max(0, Math.floor(children));
  if (a + c <= 0) return 1;
  const maxAdults = maxAdultsOf(r);
  const maxChildren = maxChildrenOf(r);
  const byAdults = a > 0 ? Math.ceil(a / Math.max(1, maxAdults)) : 0;
  const byChildren = c > 0 && maxChildren > 0 ? Math.ceil(c / maxChildren) : 0;
  const byTotal = Math.ceil((a + c) / roomTotalCapacity(r));
  return Math.max(1, byAdults, byChildren, byTotal);
}

/** Whether a single room of this type can actually hold `adults` + `children`
 *  together — the same three constraints as roomsNeededFor, collapsed to a
 *  one-room check. Used to validate an explicit per-room split a caller
 *  supplies (see PricingInput.rooms) instead of trusting the blended total
 *  alone, which is exactly the check that let an all-adult room end up
 *  overbooked relative to max_adults before this fix. */
export function roomFits(
  adults: number,
  children: number,
  r: RoomCapacityFields | null | undefined,
): boolean {
  return adults <= maxAdultsOf(r)
    && (children === 0 || children <= maxChildrenOf(r))
    && (adults + children) <= roomTotalCapacity(r);
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
