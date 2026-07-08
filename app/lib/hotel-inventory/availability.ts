import "server-only";
import { db } from "@/app/lib/db";
import { Prisma } from "@/app/generated/prisma/client";

/**
 * Channel-management Phase 2 — hotel inventory engine.
 *
 * Atomic, overbooking-proof operations over the per-date `hotel_room_availability`
 * ledger (Phase 1). All reads/writes are keyed by room type + calendar night.
 *
 * Overbooking safety: holds use a single guarded SQL UPDATE per night
 * (`booked_units + n <= total_units AND NOT stop_sell`). Postgres evaluates each
 * row update atomically, so concurrent holds can never oversell. Multi-night
 * holds run inside one transaction — if any night can't be held, the whole hold
 * rolls back (no partial reservations).
 *
 * Pricing is NOT resolved here. `price_override` is surfaced; the base nightly
 * rate still comes from the existing season/weekend/occupancy engine and is
 * combined by a separate ARI resolver (follow-up).
 */

export type NightAvailability = {
  date: string; // YYYY-MM-DD
  totalUnits: number;
  bookedUnits: number;
  available: number; // stop_sell ? 0 : max(0, total - booked)
  stopSell: boolean;
  priceOverride: number | null;
  minLos: number | null;
  maxLos: number | null;
  closedToArrival: boolean;
  closedToDeparture: boolean;
};

export type StayEvaluation = { ok: boolean; reason?: string };

// ── Date helpers ──────────────────────────────────────────────────────────────

/** UTC-midnight Date for a YYYY-MM-DD string. */
function toUtcDate(d: string): Date {
  return new Date(`${d}T00:00:00.000Z`);
}

/** YYYY-MM-DD (UTC) for a Date. */
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * The nights of a stay: every date in [checkIn, checkOut). A guest checking in
 * on the 22nd and out on the 24th occupies the nights of the 22nd and 23rd.
 */
export function stayNights(checkIn: string, checkOut: string): string[] {
  const start = toUtcDate(checkIn);
  const end = toUtcDate(checkOut);
  const out: string[] = [];
  for (let t = start; t < end; t = new Date(t.getTime() + 86400000)) {
    out.push(ymd(t));
  }
  return out;
}

// ── Ensure rows exist ─────────────────────────────────────────────────────────

/**
 * Lazily create availability rows for the given nights, seeding `total_units`
 * from `hotel_rooms.num_rooms`. Existing rows are left untouched. Idempotent.
 */
export async function ensureAvailability(roomId: number, nights: string[]): Promise<void> {
  if (nights.length === 0) return;
  const room = await db.hotel_rooms.findUnique({
    where: { id: roomId },
    select: { hotel_id: true, num_rooms: true },
  });
  if (!room) throw new Error(`ensureAvailability: room ${roomId} not found`);
  await ensureAvailabilityTx(db, roomId, room.hotel_id, room.num_rooms, nights);
}

async function ensureAvailabilityTx(
  tx: Pick<Prisma.TransactionClient, "$executeRaw">,
  roomId: number,
  hotelId: number,
  totalUnits: number,
  nights: string[],
): Promise<void> {
  if (nights.length === 0) return;
  // One round-trip for the whole range instead of one per night — a
  // month-plus bulk edit was previously N sequential inserts against a
  // remote DB, which is where "bulk update feels slow" came from.
  await tx.$executeRaw`
    INSERT INTO "hotel_room_availability" ("hotel_id", "room_id", "date", "total_units", "booked_units", "updated_at")
    SELECT ${hotelId}, ${roomId}, unnest(${nights}::date[]), ${totalUnits}, 0, now()
    ON CONFLICT ("room_id", "date") DO NOTHING
  `;
}

// ── Read availability ─────────────────────────────────────────────────────────

/** Per-night availability for a room over a stay (creates missing rows first). */
export async function getRoomAvailability(
  roomId: number,
  checkIn: string,
  checkOut: string,
): Promise<NightAvailability[]> {
  const nights = stayNights(checkIn, checkOut);
  if (nights.length === 0) return [];
  await ensureAvailability(roomId, nights);

  const [room, rows] = await Promise.all([
    db.hotel_rooms.findUnique({ where: { id: roomId }, select: { is_bookable: true } }),
    db.hotel_room_availability.findMany({
      where: { room_id: roomId, date: { gte: toUtcDate(checkIn), lt: toUtcDate(checkOut) } },
      orderBy: { date: "asc" },
    }),
  ]);
  // A room closed for sale (owner toggle) shows zero availability regardless
  // of what any individual date row says — distinct from per-date stop_sell.
  const roomClosed = room?.is_bookable === false;

  return rows.map((r) => {
    const total = r.total_units;
    const booked = r.booked_units;
    const available = roomClosed || r.stop_sell ? 0 : Math.max(0, total - booked);
    return {
      date: ymd(r.date),
      totalUnits: total,
      bookedUnits: booked,
      available,
      stopSell: r.stop_sell,
      priceOverride: r.price_override ? Number(r.price_override) : null,
      minLos: r.min_los,
      maxLos: r.max_los,
      closedToArrival: r.closed_to_arrival,
      closedToDeparture: r.closed_to_departure,
    };
  });
}

/**
 * Pure check: can `units` rooms be booked for this stay?
 * Verifies units on every night, LOS bounds, and CTA/CTD on the boundary nights.
 */
export function evaluateStay(nights: NightAvailability[], units: number): StayEvaluation {
  if (nights.length === 0) return { ok: false, reason: "No nights in range" };
  const los = nights.length;

  for (const n of nights) {
    if (n.stopSell) return { ok: false, reason: `Sold out on ${n.date}` };
    if (n.available < units) return { ok: false, reason: `Only ${n.available} left on ${n.date}` };
    if (n.minLos && los < n.minLos) return { ok: false, reason: `Minimum stay ${n.minLos} nights` };
    if (n.maxLos && los > n.maxLos) return { ok: false, reason: `Maximum stay ${n.maxLos} nights` };
  }
  if (nights[0].closedToArrival) return { ok: false, reason: `No arrivals on ${nights[0].date}` };
  if (nights[nights.length - 1].closedToDeparture) {
    return { ok: false, reason: `No departures after ${nights[nights.length - 1].date}` };
  }
  return { ok: true };
}

/** Read-only convenience: is this stay bookable for `units` rooms? */
export async function checkStayAvailable(
  roomId: number,
  checkIn: string,
  checkOut: string,
  units: number,
): Promise<StayEvaluation> {
  const nights = await getRoomAvailability(roomId, checkIn, checkOut);
  return evaluateStay(nights, units);
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Atomically hold `units` rooms for every night of the stay. All-or-nothing:
 * if any night lacks inventory (or is stop-sell), nothing is held.
 * Returns { ok: false, reason } on failure — never throws for a normal sell-out.
 */
export async function holdInventory(
  roomId: number,
  checkIn: string,
  checkOut: string,
  units: number,
): Promise<StayEvaluation> {
  const nights = stayNights(checkIn, checkOut);
  if (nights.length === 0) return { ok: false, reason: "No nights in range" };
  if (units <= 0) return { ok: false, reason: "Units must be positive" };

  const room = await db.hotel_rooms.findUnique({
    where: { id: roomId },
    select: { hotel_id: true, num_rooms: true, is_bookable: true },
  });
  if (!room) return { ok: false, reason: "Room not found" };
  if (!room.is_bookable) return { ok: false, reason: "Room is closed for sale" };

  // holdNightsTx only guards unit-count + stop-sell — check the real
  // min/max-LOS and CTA/CTD restrictions before holding (mirrors the same
  // check in reservations.ts's createReservation).
  const nightsAvail = await getRoomAvailability(roomId, checkIn, checkOut);
  const evalResult = evaluateStay(nightsAvail, units);
  if (!evalResult.ok) return evalResult;

  try {
    await db.$transaction((tx) =>
      holdNightsTx(tx, roomId, room.hotel_id, room.num_rooms, nights, units),
    );
    return { ok: true };
  } catch (err) {
    if (err instanceof HoldConflict) {
      return { ok: false, reason: `No inventory on ${err.night}` };
    }
    throw err;
  }
}

export class HoldConflict extends Error {
  constructor(public night: string) {
    super(`Hold conflict on ${night}`);
  }
}

type TxClient = Pick<Prisma.TransactionClient, "$executeRaw">;

/**
 * Transaction-aware hold: ensures rows then guard-updates each night. Throws
 * {@link HoldConflict} if any night can't be held (caller's tx rolls back).
 * Use this to hold inventory *and* write a reservation row in one transaction.
 */
export async function holdNightsTx(
  tx: TxClient,
  roomId: number,
  hotelId: number,
  numRooms: number,
  nights: string[],
  units: number,
): Promise<void> {
  await ensureAvailabilityTx(tx, roomId, hotelId, numRooms, nights);
  for (const night of nights) {
    const affected = await tx.$executeRaw`
      UPDATE "hotel_room_availability"
      SET "booked_units" = "booked_units" + ${units}, "updated_at" = now()
      WHERE "room_id" = ${roomId}
        AND "date" = ${night}::date
        AND "stop_sell" = false
        AND "booked_units" + ${units} <= "total_units"
    `;
    if (affected !== 1) throw new HoldConflict(night);
  }
}

/** Transaction-aware release: never drops below zero. */
export async function releaseNightsTx(
  tx: TxClient,
  roomId: number,
  nights: string[],
  units: number,
): Promise<void> {
  for (const night of nights) {
    await tx.$executeRaw`
      UPDATE "hotel_room_availability"
      SET "booked_units" = GREATEST(0, "booked_units" - ${units}), "updated_at" = now()
      WHERE "room_id" = ${roomId} AND "date" = ${night}::date
    `;
  }
}

/**
 * Release `units` back for every night of the stay (on cancellation / no-show).
 * Never drops below zero. For exactly-once release keyed by a reservation, use
 * the reservation engine (`reservations.ts`) instead of calling this directly.
 */
export async function releaseInventory(
  roomId: number,
  checkIn: string,
  checkOut: string,
  units: number,
): Promise<void> {
  const nights = stayNights(checkIn, checkOut);
  if (nights.length === 0 || units <= 0) return;
  await db.$transaction((tx) => releaseNightsTx(tx, roomId, nights, units));
}
