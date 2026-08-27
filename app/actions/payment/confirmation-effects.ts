import "server-only";
import { db } from "@/app/lib/db";
import { notifyBookingConfirmed, notifyPaymentReceived } from "@/app/services/notifications/booking-notify";
import { confirmHotelReservationForBooking } from "./hotel-confirmation";
import { broadcastVerificationCounts } from "@/app/services/verification-counts.service";
import { publishBookingWon } from "@/app/lib/ably";

/**
 * Everything that must happen once a payment is genuinely captured, in one
 * place because there are two callers and they had drifted.
 *
 * `finalizeCapturedPayment` moves the money-facing rows and nothing else. What
 * follows it — emails, the ops handoff, the sales exec's notification, the
 * live badge counts — was written inline in the webhook and then only
 * partially copied into reconcile, which is the safety net for a webhook that
 * never arrives. The result was a booking rescued by reconcile silently
 * skipping the customer's confirmation email, their invoice, and the ops
 * handoff timeline note: the very booking least likely to have been noticed
 * was the one told to nobody.
 *
 * Every step is independently best-effort. The payment is already captured and
 * the booking already confirmed by the time this runs, so a failing email or a
 * missing ABLY_API_KEY must never turn a successful payment into an error.
 */
export async function runPaymentConfirmedEffects(args: {
    /** Whether this capture newly confirmed the booking (INITIAL purpose, not
     * a duplicate redelivery) — gates the confirmation email and ops handoff. */
    confirmInitial: boolean;
    /** Whether this was a genuinely new capture of any purpose (INITIAL /
     * TOPUP / BALANCE) — gates the payment receipt. */
    isNewCapture: boolean;
    bookingId?: string;
    paymentId: string;
}): Promise<void> {
    if (args.confirmInitial && args.bookingId) {
        try { await notifyBookingConfirmed(args.bookingId); } catch (e) { console.error("[confirmed] confirm-email failed", e); }
        try { await confirmHotelReservationForBooking(args.bookingId); } catch (e) { console.error("[confirmed] hotel confirm failed", e); }
        try { await notifySalesAgentBookingWon(args.bookingId); } catch (e) { console.error("[confirmed] sales notify failed", e); }
        // Newly ADVANCE_PAID/FULLY_PAID — the booking just entered the Verify
        // Hotels queue, so every open dashboard's badge should move now.
        try { await broadcastVerificationCounts(); } catch (e) { console.error("[confirmed] counts broadcast failed", e); }
    }
    if (args.isNewCapture) {
        try { await notifyPaymentReceived(args.paymentId); } catch (e) { console.error("[confirmed] invoice-email failed", e); }
    }
}

/**
 * Tells the exec who sold it, live, that their trip just landed.
 *
 * Addressed to `salesAgentId` — set at booking time from the lead's CURRENT
 * owner rather than whoever built the package, so credit follows a reassigned
 * query (see create-booking-from-custom-package). A booking that came in off
 * the website on its own has no sales agent and nobody to congratulate.
 *
 * The title is resolved here rather than in the browser: a catalogue booking
 * carries a `package` relation, a custom one carries none and is named by the
 * custom package the share link was built from, and the toast should not have
 * to know the difference.
 */
async function notifySalesAgentBookingWon(bookingId: string): Promise<void> {
    const b = await db.booking.findUnique({
        where: { id: bookingId },
        select: {
            id: true, bookingNumber: true, totalAmount_paise: true, currency: true,
            salesAgentId: true, packageUrl: true,
            package: { select: { title: true } },
            destination: { select: { name: true } },
            user: { select: { name: true } },
        },
    });
    if (!b?.salesAgentId) return;

    // A custom package has no `package` row; recover its title from the share
    // link the client booked through before falling back to the destination.
    let customTitle: string | null = null;
    const customId = b.packageUrl?.match(/^\/custom-package\/([^/?#]+)/)?.[1];
    if (!b.package?.title && customId) {
        customTitle = (await db.custom_packages.findUnique({
            where: { id: customId },
            select: { title: true },
        }))?.title ?? null;
    }

    await publishBookingWon(b.salesAgentId, {
        bookingId: b.id,
        bookingNumber: b.bookingNumber,
        packageTitle: b.package?.title ?? customTitle ?? b.destination?.name ?? "a trip",
        clientName: b.user?.name ?? null,
        amountPaise: b.totalAmount_paise,
        currency: b.currency,
    });
}
