"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/app/lib/db";
import { getAuthenticatedUser } from "@/app/lib/functions/getAuthenticatedUser";
import { getSystemActorId } from "@/app/services/notifications/system-actor";

/**
 * Customer picks one of the ops-proposed alternatives for an unavailable item
 * (Status tracking, Phase 4.2). Owner-scoped. Applies the swap in place on the
 * fulfilment row (→ IN_PROCESS for ops to confirm) and marks the offer CHOSEN.
 * No price change in v1 (the locked decision).
 */

type Option = { id?: string; label?: string; hotelId?: number; activityId?: number; vehicleId?: number };

export async function chooseReplacement(
    offerId: string,
    optionId: string,
): Promise<{ success: true } | { success: false; error: string }> {
    const user = await getAuthenticatedUser();
    if (!user?.id) return { success: false, error: "Please log in to continue." };

    const offer = await db.replacementOffer.findUnique({
        where: { id: offerId },
        select: { id: true, bookingId: true, kind: true, day: true, activityId: true, options: true, status: true, booking: { select: { userId: true } } },
    });
    if (!offer || offer.booking.userId !== user.id) return { success: false, error: "Offer not found." };
    if (offer.status !== "PROPOSED") return { success: false, error: "This choice has already been made." };

    const opts = (Array.isArray(offer.options) ? offer.options : []) as Option[];
    const chosen = opts.find((o) => o.id === optionId);
    if (!chosen) return { success: false, error: "That option is no longer available." };

    try {
        if (offer.kind === "HOTEL" && chosen.hotelId) {
            await db.bookingHotel.update({
                where: { bookingId_dayNumber: { bookingId: offer.bookingId, dayNumber: offer.day } },
                data: { hotelId: chosen.hotelId, roomType: chosen.label ?? "", status: "IN_PROCESS", isConfirmed: false, voucherUrl: null, confirmedAt: null, confirmedById: null },
            });
        } else if (offer.kind === "ACTIVITY" && offer.activityId != null) {
            await db.bookingActivity.update({
                where: { bookingId_dayNumber_activityId: { bookingId: offer.bookingId, dayNumber: offer.day, activityId: offer.activityId } },
                data: { name: chosen.label ?? undefined, status: "IN_PROCESS", voucherUrl: null, confirmedAt: null, confirmedById: null },
            });
        } else if (offer.kind === "TRANSFER") {
            await db.bookingCab.update({
                where: { bookingId_legNumber: { bookingId: offer.bookingId, legNumber: offer.day } },
                data: { status: "IN_PROCESS", isConfirmed: false, voucherUrl: null, confirmedAt: null, confirmedById: null },
            });
        }
    } catch (e) {
        console.error("[chooseReplacement] apply swap", e);
        return { success: false, error: "Could not apply your choice. Please try again." };
    }

    await db.replacementOffer.update({ where: { id: offerId }, data: { status: "CHOSEN", chosenOptionId: optionId, chosenAt: new Date() } });

    try {
        const actorId = await getSystemActorId();
        await db.bookingTimeline.create({
            data: {
                bookingId: offer.bookingId, action: "NOTE_ADDED",
                note: `Customer selected "${chosen.label ?? optionId}" as the replacement for the Day ${offer.day} ${offer.kind.toLowerCase()}. Now in process.`,
                performedById: actorId, performedByName: "Customer",
            },
        });
    } catch (e) { console.error("[chooseReplacement] timeline", e); }

    revalidatePath(`/bookings/${offer.bookingId}/status`);
    revalidatePath(`/dashboard/package-bookings/${offer.bookingId}`);
    return { success: true };
}
