"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/app/lib/db";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { confirmReservation, cancelReservation } from "@/app/lib/hotel-inventory/reservations";
import { getProvider } from "@/app/lib/payments/registry";
import type { GatewayId } from "@/app/lib/payments/types";
import { notifyGuestHotelConfirmed, notifyCancellation } from "@/app/services/notifications/booking-notify";

/**
 * Hotel-connect self-service accept/reject for a direct hotel-only booking
 * request (status HOTEL_VERIFICATION — see app/actions/payment/hotel-confirmation.ts).
 * Package bookings are untouched; they stay on the ops-mediated verify-hotels flow.
 */

type ActionResult = { success: true } | { success: false; error: string };

async function loadOwnedPendingBooking(bookingId: string, ownerId: string) {
    const booking = await db.booking.findUnique({
        where: { id: bookingId },
        select: {
            id: true, status: true, bookingNumber: true,
            payments: { select: { id: true, gateway: true, status: true, amount_paise: true, gatewayPaymentId: true, refundId: true } },
            hotelBookings: { select: { hotelId: true, hotel: { select: { owner_id: true } } } },
        },
    });
    if (!booking) return { ok: false as const, error: "Booking not found." };
    if (booking.status !== "HOTEL_VERIFICATION") return { ok: false as const, error: "This request has already been actioned." };
    const leg = booking.hotelBookings[0];
    if (!leg || leg.hotel.owner_id !== ownerId) return { ok: false as const, error: "You don't have access to this booking." };
    return { ok: true as const, booking, hotelId: leg.hotelId };
}

export async function acceptHotelBookingRequest(bookingId: string): Promise<ActionResult> {
    const session = await hotelConnectAuth();
    if (!session?.user?.id) return { success: false, error: "Not authenticated." };

    const gate = await loadOwnedPendingBooking(bookingId, session.user.id);
    if (!gate.ok) return { success: false, error: gate.error };

    const reservation = await db.hotel_reservation.findFirst({ where: { booking_id: bookingId }, select: { id: true } });
    if (!reservation) return { success: false, error: "No inventory hold found for this booking." };

    const confirmed = await confirmReservation(reservation.id);
    if (!confirmed.ok) return { success: false, error: confirmed.reason };

    const now = new Date();
    await db.$transaction([
        db.booking.update({ where: { id: bookingId }, data: { status: "CONFIRMED" } }),
        db.bookingHotel.updateMany({ where: { bookingId }, data: { isConfirmed: true, status: "CONFIRMED", confirmedAt: now } }),
    ]);

    try { await notifyGuestHotelConfirmed(bookingId); } catch (e) { console.error("[acceptHotelBookingRequest] notify", e); }

    revalidatePath("/hotel-connect/bookings");
    return { success: true };
}

export async function rejectHotelBookingRequest(bookingId: string, reason?: string): Promise<ActionResult> {
    const session = await hotelConnectAuth();
    if (!session?.user?.id) return { success: false, error: "Not authenticated." };

    const gate = await loadOwnedPendingBooking(bookingId, session.user.id);
    if (!gate.ok) return { success: false, error: gate.error };
    const { booking } = gate;

    // Full refund (100%, no cancellation fee) — this is the hotel declining,
    // not a guest-initiated cancellation, so the guest shouldn't lose anything.
    const captured = booking.payments.filter((p) => p.status === "FULLY_PAID" && p.gatewayPaymentId);
    const paidPaise = captured.reduce((sum, p) => sum + p.amount_paise, 0);

    try {
        for (const p of captured) {
            if (p.refundId) continue; // already refunded (idempotent retry)
            const res = await getProvider(p.gateway as GatewayId).refund({
                gatewayPaymentId: p.gatewayPaymentId!,
                amountPaise: p.amount_paise,
                idempotencyKey: `hotel-reject:${p.id}`,
            });
            await db.payment.update({ where: { id: p.id }, data: { refundId: res.refundId, refundAmount: (p.amount_paise / 100).toFixed(2) } });
        }
    } catch (e) {
        console.error("[rejectHotelBookingRequest] refund failed", e);
        return { success: false, error: "Could not process the refund. Please try again." };
    }

    const reservation = await db.hotel_reservation.findFirst({ where: { booking_id: bookingId }, select: { id: true } });
    if (reservation) {
        try { await cancelReservation(reservation.id); } catch (e) { console.error("[rejectHotelBookingRequest] release hold failed", e); }
    }

    await db.$transaction(async (tx) => {
        await tx.booking.update({
            where: { id: bookingId },
            data: { status: "REJECTED", cancelledAt: new Date(), cancelReason: reason?.trim() || "Hotel was unable to accommodate this booking." },
        });
        await tx.bookingHotel.updateMany({ where: { bookingId }, data: { status: "UNAVAILABLE" } });
        await tx.paymentInstallment.updateMany({
            where: { bookingId, status: { in: ["PENDING", "OVERDUE"] } },
            data: { status: "CANCELLED" },
        });
    });

    try { await notifyCancellation(bookingId, paidPaise, 0); } catch (e) { console.error("[rejectHotelBookingRequest] notify", e); }

    revalidatePath("/hotel-connect/bookings");
    return { success: true };
}
