"use server";

import { getAuthenticatedUser } from "@/app/lib/functions/getAuthenticatedUser";
import { db } from "@/app/lib/db";
import { verifyCheckoutSignature } from "@/app/lib/razorpay";
import { createBookingAndOrder } from "./create-booking.service";
import type { CreateBookingOrderResult, VerifyCheckoutResult } from "./types";

/**
 * Initiate a package booking + Razorpay order from a quote.
 * Auth is required (Booking.userId is non-null). The amount is server-derived.
 */
export async function createPackageBooking(quoteId: string): Promise<CreateBookingOrderResult> {
    const user = await getAuthenticatedUser();
    if (!user?.id) return { success: false, reason: "unauthenticated" };

    try {
        return await createBookingAndOrder({ quoteId, userId: user.id });
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
