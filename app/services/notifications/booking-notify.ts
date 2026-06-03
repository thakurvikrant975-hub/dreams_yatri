import "server-only";
import { db } from "@/app/lib/db";
import { bookingConfirmationEmail, cancellationEmail, refundConfirmedEmail, opsNewBookingEmail } from "./booking-emails";
import { sendBookingEmail, opsEmail } from "./send";

/**
 * Post-commit, best-effort booking notifications. Each loads the needed data and
 * sends; failures are swallowed inside `sendBookingEmail`. Never call inside a tx.
 */

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const voucherUrl = (id: string) => `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/bookings/${id}/voucher`;

/** Customer confirmation + receipt (and ops notification) after an INITIAL capture. */
export async function notifyBookingConfirmed(bookingId: string): Promise<void> {
    const b = await db.booking.findUnique({
        where: { id: bookingId },
        select: {
            bookingNumber: true, paymentPlan: true, startDate: true, endDate: true, travellers: true,
            totalAmount_paise: true, advanceAmount_paise: true, balanceAmount_paise: true, balanceDueDate: true,
            user: { select: { email: true } }, package: { select: { title: true } },
        },
    });
    if (!b) return;

    const isFull = b.paymentPlan === "FULL";
    const packageTitle = b.package?.title ?? "Your package";
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
}

export async function notifyCancellation(bookingId: string, refundablePaise: number, feePaise: number): Promise<void> {
    const b = await db.booking.findUnique({ where: { id: bookingId }, select: { bookingNumber: true, user: { select: { email: true } }, package: { select: { title: true } } } });
    if (!b) return;
    await sendBookingEmail(b.user?.email, cancellationEmail({ bookingNumber: b.bookingNumber, packageTitle: b.package?.title ?? "Your package", refundablePaise, feePaise }));
}

export async function notifyRefund(bookingId: string, refundAmountPaise: number): Promise<void> {
    const b = await db.booking.findUnique({ where: { id: bookingId }, select: { bookingNumber: true, user: { select: { email: true } }, package: { select: { title: true } } } });
    if (!b) return;
    await sendBookingEmail(b.user?.email, refundConfirmedEmail({ bookingNumber: b.bookingNumber, packageTitle: b.package?.title ?? "Your package", refundAmountPaise }));
}
