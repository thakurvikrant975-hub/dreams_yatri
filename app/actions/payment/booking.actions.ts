"use server";

import { getAuthenticatedUser } from "@/app/lib/functions/getAuthenticatedUser";
import { db } from "@/app/lib/db";
import { verifyCheckoutSignature } from "@/app/lib/razorpay";
import { createBookingAndOrder } from "./create-booking.service";
import { cancelBooking, previewCancellation } from "./cancel-booking.service";
import { changeTravelDate, previewDateChange } from "./change-date.service";
import type { CreateBookingOrderResult, VerifyCheckoutResult, CancelBookingResult, CancellationPreview, DateChangeResult, DateChangePreview } from "./types";

/**
 * Initiate a package booking + Razorpay order from a quote.
 * Auth is required (Booking.userId is non-null). The amount is server-derived.
 */
export async function createPackageBooking(quoteId: string, paymentChoice?: "FULL" | "DEPOSIT"): Promise<CreateBookingOrderResult> {
    const user = await getAuthenticatedUser();
    if (!user?.id) return { success: false, reason: "unauthenticated" };

    try {
        return await createBookingAndOrder({ quoteId, userId: user.id, paymentChoice });
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
