"use server";

import { getAuthenticatedUser } from "@/app/lib/functions/getAuthenticatedUser";
import { createBookingAndOrder } from "./create-booking.service";
import type { CreateBookingOrderResult } from "./types";

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
