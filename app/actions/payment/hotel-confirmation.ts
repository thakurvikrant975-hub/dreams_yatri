import "server-only";
import { db } from "@/app/lib/db";
import { notifyOwnerBookingPendingApproval } from "@/app/services/notifications/owner-notify";

/**
 * Post-capture follow-up for a direct hotel-only booking: leaves the real
 * inventory hold as-is (still HELD — the hotel hasn't accepted yet) and moves
 * the booking into HOTEL_VERIFICATION so it shows up as an actionable request
 * in hotel-connect. The hotel then accepts or rejects it themselves
 * (app/(hotel-connect)/hotel-connect/(main)/bookings/actions.ts), which is
 * what actually flips the reservation to CONFIRMED (or releases it + refunds).
 *
 * Shared by the webhook (truth) and reconciliation (safety net) so both
 * payment-confirmation paths reach the same end state. Best-effort by design:
 * called AFTER the payment has already been finalized in its own transaction,
 * so a failure here must never undo or block that — callers wrap this in
 * try/catch, same as the existing notifyBookingConfirmed follow-up it sits
 * alongside. A no-op for package bookings (no linked hotel_reservation).
 */
export async function confirmHotelReservationForBooking(bookingId: string): Promise<void> {
    const reservation = await db.hotel_reservation.findFirst({
        where: { booking_id: bookingId },
        select: { id: true },
    });
    if (!reservation) return;

    const hotelBooking = await db.bookingHotel.findFirst({
        where: { bookingId },
        select: { hotelId: true, checkInDate: true, checkOutDate: true, roomType: true, roomsCount: true },
    });
    if (!hotelBooking) return;

    await db.$transaction([
        db.booking.update({ where: { id: bookingId }, data: { status: "HOTEL_VERIFICATION" } }),
        db.bookingHotel.updateMany({ where: { bookingId }, data: { status: "IN_PROCESS" } }),
    ]);

    const booking = await db.booking.findUnique({ where: { id: bookingId }, select: { bookingNumber: true } });
    if (booking) {
        await notifyOwnerBookingPendingApproval({
            hotelId: hotelBooking.hotelId,
            bookingNumber: booking.bookingNumber,
            checkInDate: hotelBooking.checkInDate,
            checkOutDate: hotelBooking.checkOutDate,
            roomType: hotelBooking.roomType,
            roomsCount: hotelBooking.roomsCount,
        });
    }
}
