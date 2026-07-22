import "server-only";
import { db } from "@/app/lib/db";
import { bookingConfirmationEmail, cancellationEmail, hotelBookingConfirmedEmail, refundConfirmedEmail, opsNewBookingEmail, tripStatusEmail } from "./booking-emails";
import { sendBookingEmail, opsEmail } from "./send";
import { getSystemActorId } from "./system-actor";

/**
 * Post-commit, best-effort booking notifications. Each loads the needed data and
 * sends; failures are swallowed inside `sendBookingEmail`. Never call inside a tx.
 */

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const voucherUrl = (id: string) => `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/bookings/${id}/voucher`;

/** Package title, or the hotel's name for a direct hotel-only booking (no package). */
function tripTitle(b: { package: { title: string } | null; hotelBookings: { hotel: { name: string } }[] }): string {
    return b.package?.title ?? b.hotelBookings[0]?.hotel.name ?? "your booking";
}

/** Customer confirmation + receipt (and ops notification) after an INITIAL capture. */
export async function notifyBookingConfirmed(bookingId: string): Promise<void> {
    const b = await db.booking.findUnique({
        where: { id: bookingId },
        select: {
            bookingNumber: true, paymentPlan: true, startDate: true, endDate: true, travellers: true,
            totalAmount_paise: true, advanceAmount_paise: true, balanceAmount_paise: true, balanceDueDate: true,
            user: { select: { email: true } }, package: { select: { title: true } },
            hotelBookings: { take: 1, select: { hotel: { select: { name: true } } } },
        },
    });
    if (!b) return;

    const isFull = b.paymentPlan === "FULL";
    const packageTitle = tripTitle(b);
    const base = {
        bookingNumber: b.bookingNumber, packageTitle,
        travelStartDate: isoDate(b.startDate), travelEndDate: isoDate(b.endDate), travellers: b.travellers,
    };

    await sendBookingEmail(b.user?.email, bookingConfirmationEmail({
        ...base, isFull,
        paidPaise: isFull ? b.totalAmount_paise : b.advanceAmount_paise,
        balancePaise: isFull ? 0 : b.balanceAmount_paise,
        balanceDueDate: b.balanceDueDate ? isoDate(b.balanceDueDate) : null,
        voucherUrl: voucherUrl(bookingId),
    }));

    await sendBookingEmail(opsEmail(), opsNewBookingEmail({
        ...base, paidPaise: isFull ? b.totalAmount_paise : b.advanceAmount_paise,
    }));

    // Ops handoff record (always written, even when emails are disabled).
    try {
        const actorId = await getSystemActorId();
        await db.bookingTimeline.create({
            data: {
                bookingId, action: "NOTE_ADDED", performedById: actorId, performedByName: "System",
                note: `Payment received (${isFull ? "full" : "deposit"}) — booking confirmed, ready for ops.`,
            },
        });
    } catch (e) {
        console.error("[ops handoff] timeline failed", e);
    }
}

/** Guest-facing: the hotel accepted their (already-paid) direct hotel booking. */
export async function notifyGuestHotelConfirmed(bookingId: string): Promise<void> {
    const b = await db.booking.findUnique({
        where: { id: bookingId },
        select: { bookingNumber: true, user: { select: { email: true } }, hotelBookings: { take: 1, select: { hotel: { select: { name: true } } } } },
    });
    if (!b) return;
    await sendBookingEmail(b.user?.email, hotelBookingConfirmedEmail({
        bookingNumber: b.bookingNumber,
        hotelName: b.hotelBookings[0]?.hotel.name ?? "Your hotel",
        voucherUrl: voucherUrl(bookingId),
    }));
}

export async function notifyCancellation(bookingId: string, refundablePaise: number, feePaise: number): Promise<void> {
    const b = await db.booking.findUnique({ where: { id: bookingId }, select: { bookingNumber: true, user: { select: { email: true } }, package: { select: { title: true } }, hotelBookings: { take: 1, select: { hotel: { select: { name: true } } } } } });
    if (!b) return;
    await sendBookingEmail(b.user?.email, cancellationEmail({ bookingNumber: b.bookingNumber, packageTitle: tripTitle(b), refundablePaise, feePaise }));
}

export async function notifyRefund(bookingId: string, refundAmountPaise: number): Promise<void> {
    const b = await db.booking.findUnique({ where: { id: bookingId }, select: { bookingNumber: true, user: { select: { email: true } }, package: { select: { title: true } }, hotelBookings: { take: 1, select: { hotel: { select: { name: true } } } } } });
    if (!b) return;
    await sendBookingEmail(b.user?.email, refundConfirmedEmail({ bookingNumber: b.bookingNumber, packageTitle: tripTitle(b), refundAmountPaise }));
}

/** Fulfilment status update — trip fully confirmed (READY) or an item needs an alternative (ATTENTION). */
export async function notifyFulfillmentChange(bookingId: string, kind: "READY" | "ATTENTION", itemLabel?: string): Promise<void> {
    const b = await db.booking.findUnique({ where: { id: bookingId }, select: { bookingNumber: true, user: { select: { email: true } }, package: { select: { title: true } } } });
    if (!b) return;
    const statusUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/bookings/${bookingId}/status`;
    await sendBookingEmail(b.user?.email, tripStatusEmail({ kind, bookingNumber: b.bookingNumber, packageTitle: b.package?.title ?? "Your package", itemLabel, statusUrl }));
}
