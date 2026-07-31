/**
 * The per-room guest split, and how it survives a URL hop.
 *
 * The package page lets a guest configure each room independently (2 adults +
 * a 5-year-old here, 1 adult there). The search surfaces used to carry only a
 * flat `adults` / `children` / `rooms` trio, so that split was lost the moment
 * anyone navigated — the package page had to guess it back by dividing adults
 * evenly across rooms. `pax` carries the real thing.
 *
 * Format: rooms separated by `_`, each `<adults>[-<age>.<age>…]`
 *   pax=2-5.7_1  →  room 1: 2 adults + children aged 5 and 7; room 2: 1 adult
 *
 * Only unreserved URL characters are used, so `URLSearchParams` leaves it
 * readable rather than percent-encoding it into noise.
 *
 * Pure module — imported by both server pages and client search bars.
 */

export type RoomGuests = { adults: number; childAges: number[] };

export const PAX_PARAM = "pax";

const MAX_ROOMS = 20;
const MAX_ADULTS_PER_ROOM = 20;
/** Children are "below 12"; the pickers offer 0–11. */
const CHILD_AGE_MAX = 11;

export const DEFAULT_ROOM_GUESTS: RoomGuests[] = [{ adults: 2, childAges: [] }];

// ── Derived totals ───────────────────────────────────────────────────────────

export function totalAdults(rooms: RoomGuests[]): number {
  return rooms.reduce((sum, r) => sum + r.adults, 0);
}

export function totalChildAges(rooms: RoomGuests[]): number[] {
  return rooms.flatMap((r) => r.childAges);
}

export function summarizeRoomGuests(rooms: RoomGuests[]): string {
  const adults = totalAdults(rooms);
  const children = totalChildAges(rooms).length;
  const parts = [`${adults} Adult${adults !== 1 ? "s" : ""}`];
  if (children) parts.push(`${children} Child${children !== 1 ? "ren" : ""}`);
  parts.push(`${rooms.length} Room${rooms.length !== 1 ? "s" : ""}`);
  return parts.join(", ");
}

// ── Encode / decode ──────────────────────────────────────────────────────────

export function encodeRoomGuests(rooms: RoomGuests[]): string {
  return rooms
    .map((r) => {
      // Ages are always chosen before a room can be applied, but never encode a
      // stray -1 as "-1" — it would decode back as a nonsense age.
      const ages = r.childAges.filter((a) => a >= 0 && a <= CHILD_AGE_MAX);
      return ages.length > 0 ? `${r.adults}-${ages.join(".")}` : String(r.adults);
    })
    .join("_");
}

/** Parse a `pax` value, or null when it's absent//malformed — callers then fall
 *  back to the flat adults/children/rooms trio. */
export function decodeRoomGuests(raw: string | null | undefined): RoomGuests[] | null {
  if (!raw) return null;

  // Digits only, deliberately: `Number("")` is 0, so a truncated "2-5." would
  // otherwise decode as a room holding a newborn that nobody selected. Any
  // malformation returns null and the caller falls back to the flat trio,
  // which is a better guess than a silently wrong party size.
  const isDigits = (s: string) => /^\d+$/.test(s);

  const rooms: RoomGuests[] = [];
  for (const part of raw.split("_")) {
    const [adultsRaw, agesRaw, ...extra] = part.split("-");
    if (extra.length > 0) return null;
    if (!isDigits(adultsRaw)) return null;

    const adults = Number(adultsRaw);
    if (adults < 1 || adults > MAX_ADULTS_PER_ROOM) return null;

    const childAges: number[] = [];
    if (agesRaw !== undefined) {
      if (agesRaw === "") return null;
      for (const ageRaw of agesRaw.split(".")) {
        if (!isDigits(ageRaw)) return null;
        const age = Number(ageRaw);
        if (age > CHILD_AGE_MAX) return null;
        childAges.push(age);
      }
    }
    rooms.push({ adults, childAges });
  }

  if (rooms.length === 0 || rooms.length > MAX_ROOMS) return null;
  return rooms;
}

/**
 * Best-effort split when only the flat trio is available (an old link, or a
 * surface that never captured a per-room breakdown). Room count is capped at
 * `adults` — every room needs at least one — so the split always sums back to
 * exactly `adults`.
 */
export function seedRoomGuests(
  adults?: number,
  childAges?: number[],
  rooms?: number,
): RoomGuests[] {
  const totalAdults = adults && adults > 0 ? adults : 2;
  const ages = childAges ?? [];
  const roomCount = Math.max(1, Math.min(rooms ?? 1, totalAdults));
  if (roomCount <= 1) return [{ adults: totalAdults, childAges: ages }];

  const base = Math.floor(totalAdults / roomCount);
  const remainder = totalAdults % roomCount;
  return Array.from({ length: roomCount }, (_, i) => ({
    adults: base + (i < remainder ? 1 : 0),
    childAges: i === 0 ? ages : [],
  }));
}

/** Read the room split out of a query string, preferring `pax` and falling
 *  back to the flat trio for links written before it existed. */
export function readRoomGuests(get: (key: string) => string | null | undefined): RoomGuests[] {
  const decoded = decodeRoomGuests(get(PAX_PARAM));
  if (decoded) return decoded;

  const adults = Number(get("adults"));
  const childrenRaw = get("children");
  const childAges = childrenRaw
    ? childrenRaw.split(",").map((n) => Number(n)).filter((n) => Number.isInteger(n) && n >= 0)
    : [];
  const rooms = Number(get("rooms"));

  return seedRoomGuests(
    Number.isFinite(adults) && adults > 0 ? adults : undefined,
    childAges,
    Number.isFinite(rooms) && rooms > 0 ? rooms : undefined,
  );
}

/**
 * Write the split onto a param set. `pax` is authoritative; the flat trio is
 * written alongside it because pricing, the quote/checkout flow and older links
 * all still read those — they stay exact totals of the same selection.
 */
export function writeRoomGuests(params: URLSearchParams, rooms: RoomGuests[]): URLSearchParams {
  const ages = totalChildAges(rooms);
  params.set(PAX_PARAM, encodeRoomGuests(rooms));
  params.set("adults", String(totalAdults(rooms)));
  if (ages.length > 0) params.set("children", ages.join(","));
  else params.delete("children");
  params.set("rooms", String(rooms.length));
  return params;
}

/** Query keys that carry a traveller selection — for links that forward it on. */
export const ROOM_GUEST_PARAM_KEYS = [PAX_PARAM, "adults", "children", "rooms"] as const;
