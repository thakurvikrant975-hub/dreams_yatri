"use server";

import { getAuthenticatedUser } from "@/app/lib/functions/getAuthenticatedUser";
import { db } from "@/app/lib/db";
import { verifyCheckoutSignature } from "@/app/lib/razorpay";
import { createBooking, createOrderForBooking, createBookingAndOrder } from "./create-booking.service";
import { createHotelBooking } from "./create-hotel-booking.service";
import { createBookingFromCustomPackage } from "./create-booking-from-custom-package.service";
import { createBalanceOrderForBooking } from "./balance-payment.service";
import { cancelBooking, previewCancellation } from "./cancel-booking.service";
import { finalizeCapturedPayment } from "./finalize.service";
import { runPaymentConfirmedEffects } from "./confirmation-effects";
import { getProvider } from "@/app/lib/payments/registry";
import { changeTravelDate, previewDateChange } from "./change-date.service";
import type { CheckoutInput } from "@/app/actions/quote/checkout-schema";
import type { GatewayId } from "@/app/lib/payments/types";
import type { CreateBookingOrderResult, CreateBookingResult, VerifyCheckoutResult, CancelBookingResult, CancellationPreview, DateChangeResult, DateChangePreview } from "./types";

/**
 * Step 1 of checkout ("Proceed to Payment"): turn a quote into a Booking with
 * traveller/contact details and the chosen payment plan — no gateway charge yet.
 * Auth is required (Booking.userId is non-null). The amount is server-derived.
 */
export async function createBookingDraft(
    quoteId: string,
    opts?: { paymentChoice?: "FULL" | "DEPOSIT"; details?: CheckoutInput },
): Promise<CreateBookingResult> {
    const user = await getAuthenticatedUser();
    if (!user?.id) return { success: false, reason: "unauthenticated" };

    try {
        return await createBooking({ quoteId, userId: user.id, paymentChoice: opts?.paymentChoice, details: opts?.details });
    } catch (err) {
        console.error("[createBookingDraft] failed", err);
        return { success: false, reason: "error", message: "Could not start your booking. Please try again." };
    }
}

/**
 * Step 1 of checkout for a direct hotel-only booking (single room, no
 * package) — same contract as createBookingDraft, backed by
 * create-hotel-booking.service.ts instead of a catalog quote.
 */
export async function createHotelBookingDraft(params: {
    roomId: number;
    checkIn: string;
    checkOut: string;
    units?: number;
    pricingId?: number;
    holdKey: string;
    paymentChoice?: "FULL" | "DEPOSIT";
    details?: CheckoutInput;
}): Promise<CreateBookingResult> {
    const user = await getAuthenticatedUser();
    if (!user?.id) return { success: false, reason: "unauthenticated" };

    try {
        return await createHotelBooking({ ...params, userId: user.id });
    } catch (err) {
        console.error("[createHotelBookingDraft] failed", err);
        return { success: false, reason: "error", message: "Could not start your booking. Please try again." };
    }
}

/**
 * Same Step 1, for a custom (sales-exec-built) package instead of a catalog
 * quote — see create-booking-from-custom-package.service.ts. No traveller
 * details/payment-choice here: pax counts and contact info are already fixed
 * on the sales query, and the payment plan is always policy-derived.
 */
export async function createCustomPackageBookingDraft(
    customPackageId: string,
    /** The stay option the client picked on the published itinerary. Validated
     * inside the service — it arrives from a public page and decides the
     * amount charged. */
    stayOptionId?: string | null,
    /** The client's pick on the review step — pay the deposit now, or all of
     * it. Ignored when the policy already requires the full amount. */
    paymentChoice?: "FULL" | "DEPOSIT",
    /** The total shown on the review step — checked, not trusted. See the
     * service. */
    expectedTotal?: number | null,
): Promise<CreateBookingResult> {
    const user = await getAuthenticatedUser();
    if (!user?.id) return { success: false, reason: "unauthenticated" };

    try {
        return await createBookingFromCustomPackage({ customPackageId, userId: user.id, stayOptionId, paymentChoice, expectedTotal });
    } catch (err) {
        console.error("[createCustomPackageBookingDraft] failed", err);
        return { success: false, reason: "error", message: "Could not start your booking. Please try again." };
    }
}

/**
 * Step 2 of checkout (payment page): create the gateway charge for the booking's
 * pending first leg using the customer-chosen gateway. Owner-scoped.
 */
export async function startBookingPayment(
    bookingId: string,
    gateway?: GatewayId,
): Promise<CreateBookingOrderResult> {
    const user = await getAuthenticatedUser();
    if (!user?.id) return { success: false, reason: "unauthenticated" };

    try {
        return await createOrderForBooking({ bookingId, userId: user.id, gateway });
    } catch (err) {
        console.error("[startBookingPayment] failed", err);
        return { success: false, reason: "error", message: "Could not start payment. Please try again." };
    }
}

/**
 * Pay an outstanding balance on an already-active booking — e.g. the extra
 * amount added when ops swap a hotel/room for a costlier one. Owner-scoped.
 */
export async function startBalancePayment(
    bookingId: string,
    gateway?: GatewayId,
): Promise<CreateBookingOrderResult> {
    const user = await getAuthenticatedUser();
    if (!user?.id) return { success: false, reason: "unauthenticated" };

    try {
        return await createBalanceOrderForBooking({ bookingId, userId: user.id, gateway });
    } catch (err) {
        console.error("[startBalancePayment] failed", err);
        return { success: false, reason: "error", message: "Could not start payment. Please try again." };
    }
}

/**
 * Single-shot: create the booking and its order in one call (legacy/back-compat).
 * Auth is required (Booking.userId is non-null). The amount is server-derived.
 */
export async function createPackageBooking(
    quoteId: string,
    opts?: { paymentChoice?: "FULL" | "DEPOSIT"; details?: CheckoutInput; gateway?: GatewayId },
): Promise<CreateBookingOrderResult> {
    const user = await getAuthenticatedUser();
    if (!user?.id) return { success: false, reason: "unauthenticated" };

    try {
        return await createBookingAndOrder({ quoteId, userId: user.id, paymentChoice: opts?.paymentChoice, details: opts?.details, gateway: opts?.gateway });
    } catch (err) {
        console.error("[createPackageBooking] failed", err);
        return { success: false, reason: "error", message: "Could not start your booking. Please try again." };
    }
}

/**
 * The browser coming back from checkout — and, now, the moment the booking is
 * actually confirmed.
 *
 * This used to verify the signature, store it, and stop, on the principle that
 * "the webhook owns the money". The principle is sound and the webhook still
 * owns it; the problem was that nothing else did. With the webhook the only
 * path that could finalize, a webhook that never arrived — wrong URL, a secret
 * rotated on one side, an event not subscribed — left a customer who had
 * genuinely paid staring at "Confirming your payment…" indefinitely, with
 * their money taken and no invoice, no confirmation email, no notification to
 * the exec who sold it and no handoff to ops. Every one of those hangs off
 * runPaymentConfirmedEffects, which only runs when a payment is finalized.
 * One missing webhook silently disabled all of it.
 *
 * So this is now a third finalize path beside the webhook and the reconcile
 * cron, and the fastest of the three: the customer is confirmed while the page
 * is still loading rather than up to 15 minutes later. All three call the same
 * finalizeCapturedPayment inside a transaction, which is idempotent — whichever
 * arrives second gets "already" and does nothing.
 *
 * Two things it does NOT do:
 *
 *   · trust the caller. The signature is HMAC(order_id|payment_id) with our
 *     key secret, so only Razorpay could have produced it — but it proves the
 *     payment exists, not that the money settled. A payment left `authorized`
 *     rather than `captured` would otherwise mark a booking paid against funds
 *     nobody has taken, so the gateway is asked directly before anything moves.
 *
 *   · own the outcome. If the state is anything but captured this returns
 *     success with the bookingId and lets the confirmation page keep polling —
 *     the webhook and the cron are still behind it. A slow capture is not an
 *     error to show the customer.
 */
export async function verifyCheckoutPayment(input: {
    orderId: string;
    paymentId: string;
    signature: string;
}): Promise<VerifyCheckoutResult> {
    const user = await getAuthenticatedUser();
    if (!user?.id) return { success: false, reason: "unauthenticated" };

    if (!verifyCheckoutSignature(input)) return { success: false, reason: "invalid_signature" };

    const payment = await db.payment.findUnique({
        where: { gatewayOrderId: input.orderId },
        select: { id: true, userId: true, bookingId: true, gateway: true },
    });
    if (!payment || payment.userId !== user.id) return { success: false, reason: "not_found" };

    await db.payment.update({ where: { id: payment.id }, data: { gatewaySignature: input.signature } });

    // Best-effort throughout: the money is already taken and the webhook and
    // the reconcile cron both still cover this booking. Nothing below may turn
    // a successful payment into an error on the customer's screen.
    try {
        const status = await getProvider(payment.gateway as GatewayId).fetchChargeStatus(input.orderId);
        if (status.state === "captured" && status.gatewayPaymentId) {
            const fin = await db.$transaction((tx) =>
                finalizeCapturedPayment(tx, {
                    paymentId: payment.id,
                    gatewayPaymentId: status.gatewayPaymentId!,
                    method: status.method ?? null,
                    webhookEventId: null,
                }),
            );
            // The same effects the webhook and reconcile run, from the same
            // helper rather than a copy — see the note on its own definition
            // about the two callers that had already drifted apart once.
            await runPaymentConfirmedEffects({
                confirmInitial: fin.result === "finalized" && fin.purpose === "INITIAL",
                isNewCapture: fin.result === "finalized",
                bookingId: fin.result === "finalized" ? fin.bookingId : undefined,
                paymentId: payment.id,
            });
        }
    } catch (err) {
        console.error("[verifyCheckoutPayment] finalize failed", err);
    }

    return { success: true, bookingId: payment.bookingId };
}

/** Refund preview for the cancel dialog (owner-scoped). */
export async function getCancellationPreview(bookingId: string): Promise<CancellationPreview | null> {
    const user = await getAuthenticatedUser();
    if (!user?.id) return null;
    return previewCancellation(bookingId, user.id);
}

/** Cancel the user's own booking (policy-driven refund). */
export async function requestCancellation(bookingId: string, reason?: string): Promise<CancelBookingResult> {
    const user = await getAuthenticatedUser();
    if (!user?.id) return { success: false, reason: "unauthenticated" };
    return cancelBooking({ bookingId, reason, byUserId: user.id });
}

/** Preview a date change (re-price + settlement direction) for the dialog. */
export async function getDateChangePreview(bookingId: string, newDate: string): Promise<DateChangePreview | null> {
    const user = await getAuthenticatedUser();
    if (!user?.id) return null;
    return previewDateChange(bookingId, newDate, user.id);
}

/** Apply a date change to the user's own booking. */
export async function requestDateChange(bookingId: string, newDate: string): Promise<DateChangeResult> {
    const user = await getAuthenticatedUser();
    if (!user?.id) return { success: false, reason: "unauthenticated" };
    return changeTravelDate({ bookingId, newDate, byUserId: user.id });
}
