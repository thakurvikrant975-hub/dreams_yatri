import "server-only";
import { db } from "@/app/lib/db";
import { bookingConfirmationEmail, cancellationEmail, hotelBookingConfirmedEmail, refundConfirmedEmail, opsNewBookingEmail, tripStatusEmail } from "./booking-emails";
import { sendBookingEmail, opsEmail } from "./send";
import { getSystemActorId } from "./system-actor";
import { formatPaiseRoundedUp } from "@/app/lib/money";
import { paymentInvoiceTemplate, paymentInvoiceTextTemplate } from "@/app/components/email-template/paymentInvoiceTemplate";
import { hotelsAndCabsConfirmedTemplate, hotelsAndCabsConfirmedTextTemplate } from "@/app/components/email-template/hotelsAndCabsConfirmedTemplate";

/**
 * Post-commit, best-effort booking notifications. Each loads the needed data and
 * sends; failures are swallowed inside `sendBookingEmail`. Never call inside a tx.
 */

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
// Falls back to the real production domain, not an empty string — an unset
// NEXT_PUBLIC_BASE_URL previously produced a bare "/bookings/id/voucher" with
// no host at all, which is not a valid link outside the app itself.
const SITE_URL = () => process.env.NEXT_PUBLIC_BASE_URL ?? "https://dreamsyatri.org";
const voucherUrl = (id: string) => `${SITE_URL()}/bookings/${id}/voucher`;
const bookingStatusUrl = (id: string) => `${SITE_URL()}/bookings/${id}/status`;

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

/** Customer-facing: every hotel and cab for the booking has just been verified
 *  by ops (the verify-hotels / verify-cabs dashboard pipeline reaching
 *  CAB_CONFIRMED — the last stage that pipeline currently advances a booking
 *  to). Distinct from `notifyFulfillmentChange`'s READY email, which also
 *  waits on activities. */
export async function notifyHotelsAndCabsConfirmed(bookingId: string): Promise<void> {
    const b = await db.booking.findUnique({
        where: { id: bookingId },
        select: {
            bookingNumber: true, startDate: true, endDate: true, travellers: true,
            contactEmail: true, user: { select: { name: true, email: true } },
            package: { select: { title: true } },
        },
    });
    if (!b) return;

    const fmtDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    const templateParams = {
        clientName: b.user?.name ?? "Traveller",
        bookingNumber: b.bookingNumber,
        packageTitle: b.package?.title ?? "Your package",
        travelDateStr: `${fmtDate(b.startDate)} – ${fmtDate(b.endDate)}`,
        paxLine: `${b.travellers} Traveller${b.travellers !== 1 ? "s" : ""}`,
        voucherUrl: voucherUrl(bookingId),
        statusUrl: bookingStatusUrl(bookingId),
    };

    await sendBookingEmail(b.user?.email ?? b.contactEmail, {
        subject: `Hotels & cabs confirmed — ${templateParams.packageTitle} (${templateParams.bookingNumber})`,
        html: hotelsAndCabsConfirmedTemplate(templateParams),
        text: hotelsAndCabsConfirmedTextTemplate(templateParams),
    });
}

/** Fulfilment status update — trip fully confirmed (READY) or an item needs an alternative (ATTENTION). */
export async function notifyFulfillmentChange(bookingId: string, kind: "READY" | "ATTENTION", itemLabel?: string): Promise<void> {
    const b = await db.booking.findUnique({ where: { id: bookingId }, select: { bookingNumber: true, user: { select: { email: true } }, package: { select: { title: true } } } });
    if (!b) return;
    await sendBookingEmail(b.user?.email, tripStatusEmail({ kind, bookingNumber: b.bookingNumber, packageTitle: b.package?.title ?? "Your package", itemLabel, statusUrl: bookingStatusUrl(bookingId) }));
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
    UPI: "UPI", CARD: "Card", NET_BANKING: "Net Banking", WALLET: "Wallet", EMI: "EMI", CASH: "Cash",
};

/** Payment receipt — fires on every successful capture (INITIAL, TOPUP, and BALANCE alike), not just the first. */
export async function notifyPaymentReceived(paymentId: string): Promise<void> {
    const p = await db.payment.findUnique({
        where: { id: paymentId },
        select: {
            amount_paise: true, method: true, paidAt: true, gatewayPaymentId: true,
            booking: { select: { id: true, bookingNumber: true } },
            user: { select: { name: true, email: true } },
        },
    });
    if (!p || !p.booking) return;

    const paidAtStr = (p.paidAt ?? new Date()).toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });

    const params = {
        clientName:    p.user?.name ?? "Traveller",
        bookingNumber: p.booking.bookingNumber,
        amountStr:     formatPaiseRoundedUp(p.amount_paise),
        paidAtStr,
        paymentMethod: p.method ? PAYMENT_METHOD_LABELS[p.method] ?? p.method : "—",
        transactionId: p.gatewayPaymentId ?? "—",
        bookingUrl:    bookingStatusUrl(p.booking.id),
    };

    await sendBookingEmail(p.user?.email, {
        subject: `Payment Received — Booking ${p.booking.bookingNumber}`,
        html:    paymentInvoiceTemplate(params),
        text:    paymentInvoiceTextTemplate(params),
    });
}
