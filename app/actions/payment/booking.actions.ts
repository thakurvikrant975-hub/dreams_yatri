"use server";

import { getAuthenticatedUser } from "@/app/lib/functions/getAuthenticatedUser";
import { db } from "@/app/lib/db";
import { verifyCheckoutSignature } from "@/app/lib/razorpay";
import { createBooking, createOrderForBooking, createBookingAndOrder } from "./create-booking.service";
import { createBalanceOrderForBooking } from "./balance-payment.service";
import { cancelBooking, previewCancellation } from "./cancel-booking.service";
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
 * Verify the browser checkout callback signature (defense-in-depth / UX). Stores
 * the signature on the Payment but does NOT finalize money — the webhook owns
 * that. Returns the bookingId so the client can route to the confirmation page.
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
        select: { id: true, userId: true, bookingId: true },
    });
    if (!payment || payment.userId !== user.id) return { success: false, reason: "not_found" };

    await db.payment.update({ where: { id: payment.id }, data: { gatewaySignature: input.signature } });
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
