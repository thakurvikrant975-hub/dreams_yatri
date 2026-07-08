import "server-only";
import { db } from "@/app/lib/db";
import { Prisma, type hotel_reservation } from "@/app/generated/prisma/client";
import { stayNights, holdNightsTx, releaseNightsTx, HoldConflict, getRoomAvailability, evaluateStay } from "./availability";
import { enqueueAriPushIfConnected } from "./sync";

/** Best-effort ARI push after inventory changes — never breaks the reservation. */
async function pushAri(hotelId: number, roomId: number, checkIn: string, checkOut: string) {
  try {
    await enqueueAriPushIfConnected(hotelId, roomId, checkIn, checkOut);
  } catch (err) {
    console.error("[reservations] enqueue ARI push failed:", err);
  }
}

/**
 * Channel-management Phase 2 — reservation engine.
 *
 * A reservation holds inventory *and* records who booked it, atomically:
 * the availability decrement and the `hotel_reservation` row are written in the
 * same transaction, so a failed hold leaves no reservation and a failed insert
 * rolls back the hold.
 *
 * Idempotency: `holdKey` (unique) dedupes double-creates — the same OTA webhook
 * delivered twice yields one reservation, held once. Cancellation is exactly-once
 * via the `released_at` guard, so a re-delivered cancel never double-releases.
 */

export type CreateReservationInput = {
  roomId: number;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD (exclusive)
  holdKey: string; // caller idempotency key
  units?: number; // default 1
  source?: string; // 'direct' | 'booking.com' | 'mmt' | ...  default 'direct'
  status?: "HELD" | "CONFIRMED"; // default HELD (direct); CONFIRMED for OTA-paid
  externalRef?: string | null;
  guest?: { name?: string; email?: string; phone?: string };
  money?: { currency?: string; gross?: number; net?: number; commission?: number };
  bookingId?: string | null;
  notes?: string | null;
};

export type CreateReservationResult =
  | { ok: true; reservation: hotel_reservation; deduped: boolean }
  | { ok: false; reason: string };

export type CancelReservationResult =
  | { ok: true; reservation: hotel_reservation; alreadyReleased: boolean }
  | { ok: false; reason: string };

function toDate(d: string): Date {
  return new Date(`${d}T00:00:00.000Z`);
}
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Atomically hold inventory and create a reservation. Idempotent on `holdKey`:
 * a repeat call returns the existing reservation without holding again.
 */
export async function createReservation(input: CreateReservationInput): Promise<CreateReservationResult> {
  const nights = stayNights(input.checkIn, input.checkOut);
  if (nights.length === 0) return { ok: false, reason: "No nights in range" };
  const units = input.units ?? 1;
  if (units <= 0) return { ok: false, reason: "Units must be positive" };

  const room = await db.hotel_rooms.findUnique({
    where: { id: input.roomId },
    select: { hotel_id: true, num_rooms: true },
  });
  if (!room) return { ok: false, reason: "Room not found" };

  // Min/max LOS and closed-to-arrival/departure are shown to hosts in the
  // calendar as if they were enforced, but holdNightsTx below only guards
  // unit-count + stop-sell — a 1-night booking could silently bypass a
  // 3-night minimum. Check the real restrictions before holding — but skip
  // this for an idempotent retry of an already-existing reservation (a
  // restriction added after the original hold shouldn't retroactively
  // invalidate a booking that already succeeded).
  const alreadyExists = await db.hotel_reservation.findUnique({ where: { hold_key: input.holdKey } });
  if (!alreadyExists) {
    const nightsAvail = await getRoomAvailability(input.roomId, input.checkIn, input.checkOut);
    const evalResult = evaluateStay(nightsAvail, units);
    if (!evalResult.ok) return { ok: false, reason: evalResult.reason! };
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const existing = await tx.hotel_reservation.findUnique({ where: { hold_key: input.holdKey } });
      if (existing) return { reservation: existing, deduped: true };

      // Throws HoldConflict on sell-out → rolls back the whole transaction.
      await holdNightsTx(tx, input.roomId, room.hotel_id, room.num_rooms, nights, units);

      const status = input.status ?? "HELD";
      const reservation = await tx.hotel_reservation.create({
        data: {
          hotel_id: room.hotel_id,
          room_id: input.roomId,
          check_in: toDate(input.checkIn),
          check_out: toDate(input.checkOut),
          units,
          status,
          source: input.source ?? "direct",
          external_ref: input.externalRef ?? null,
          hold_key: input.holdKey,
          guest_name: input.guest?.name ?? null,
          guest_email: input.guest?.email ?? null,
          guest_phone: input.guest?.phone ?? null,
          currency: input.money?.currency ?? "INR",
          gross_amount: input.money?.gross ?? null,
          net_amount: input.money?.net ?? null,
          commission: input.money?.commission ?? null,
          booking_id: input.bookingId ?? null,
          notes: input.notes ?? null,
          confirmed_at: status === "CONFIRMED" ? new Date() : null,
        },
      });
      return { reservation, deduped: false };
    });
    if (!result.deduped) await pushAri(room.hotel_id, input.roomId, input.checkIn, input.checkOut);
    return { ok: true, ...result };
  } catch (err) {
    if (err instanceof HoldConflict) return { ok: false, reason: `No inventory on ${err.night}` };
    // Concurrent create with the same holdKey: the loser's insert violates the
    // unique constraint and its transaction (incl. the hold) rolls back. Return
    // the winner's reservation as a dedupe.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existing = await db.hotel_reservation.findUnique({ where: { hold_key: input.holdKey } });
      if (existing) return { ok: true, reservation: existing, deduped: true };
    }
    throw err;
  }
}

/** Mark a HELD reservation CONFIRMED (e.g. after payment). Idempotent. */
export async function confirmReservation(id: string): Promise<CancelReservationResult> {
  const r = await db.hotel_reservation.findUnique({ where: { id } });
  if (!r) return { ok: false, reason: "Reservation not found" };
  if (r.status === "CANCELLED") return { ok: false, reason: "Reservation is cancelled" };
  if (r.status === "CONFIRMED") return { ok: true, reservation: r, alreadyReleased: false };
  const updated = await db.hotel_reservation.update({
    where: { id },
    data: { status: "CONFIRMED", confirmed_at: new Date() },
  });
  return { ok: true, reservation: updated, alreadyReleased: false };
}

/**
 * Cancel a reservation and release its inventory — exactly once. A second call
 * (or a re-delivered webhook) is a no-op: `released_at` guards the release.
 */
export async function cancelReservation(id: string): Promise<CancelReservationResult> {
  try {
    const result = await db.$transaction(async (tx) => {
      const r = await tx.hotel_reservation.findUnique({ where: { id } });
      if (!r) return { notFound: true as const };
      if (r.released_at || r.status === "CANCELLED") {
        return { reservation: r, alreadyReleased: true };
      }
      await releaseNightsTx(tx, r.room_id, stayNights(ymd(r.check_in), ymd(r.check_out)), r.units);
      const updated = await tx.hotel_reservation.update({
        where: { id },
        data: { status: "CANCELLED", cancelled_at: new Date(), released_at: new Date() },
      });
      return { reservation: updated, alreadyReleased: false };
    });
    if ("notFound" in result) return { ok: false, reason: "Reservation not found" };
    const r = result.reservation;
    if (!result.alreadyReleased) await pushAri(r.hotel_id, r.room_id, ymd(r.check_in), ymd(r.check_out));
    return { ok: true, reservation: r, alreadyReleased: result.alreadyReleased };
  } catch (err) {
    throw err;
  }
}
