"use server";

// hotel-requests/actions.ts
//
// Fulfillment queue for custom-package days the sales exec flagged as
// "couldn't find a catalog hotel" (see the "Add Hotels by Team" button in
// the package builder's Hotel Info card, which sets custom_itineraries.
// hotelPending). The hotel team fills in a name/room/B2B price here.
//
// Filling does NOT send the package on to costing. Submitting is the sales
// exec's call and a one-way door — once a package is with costing the exec
// cannot edit it until it returns approved or rejected — so a filled hotel
// goes back to them to check, and they submit when the whole thing is ready.

import { revalidatePath } from "next/cache";
import { db } from "@/app/lib/db";
import { normalizeMealLabels } from "@/app/(dashboard)/dashboard/(builder)/package-builder/meals";
import { syncRecommendedStayFromDays } from "@/app/(dashboard)/dashboard/(builder)/package-builder/stay-options.sync";
import { getCurrentMember } from "../lib/get-current-member";
import { logTimeline } from "../(marketing)/queries/actions";
import { broadcastVerificationCounts } from "@/app/services/verification-counts.service";

type Member = NonNullable<Awaited<ReturnType<typeof getCurrentMember>>>;

async function requireMember(): Promise<{ ok: true; member: Member } | { ok: false; error: string }> {
    const member = await getCurrentMember();
    if (!member) return { ok: false, error: "Not authenticated." };
    if (!member.isActive) return { ok: false, error: "Your account is inactive." };
    return { ok: true, member };
}

export type FillHotelInput = {
    hotelName: string;
    roomName: string;
    roomsCount: number;
    /** Extra mattresses/rollaway beds the hotel needs to provide alongside
     * the rooms above — see custom_itineraries.manualExtraBeds. */
    extraBeds?: number;
    /** Per-mattress rate for extraBeds above — see manualExtraBedRate. */
    extraBedRate?: number;
    pricePerNight: number;
    roomSpecs?: string;
    checkIn?: string;
    checkOut?: string;
    /** Single hotel exterior/lobby photo — custom_itineraries.accommodationPhoto,
     * the same field a catalog room's own photo would populate, so it shows
     * up in the builder's Hotel Info card and the itinerary document exactly
     * like a catalog pick would. */
    hotelPhoto?: string;
    /** Up to 3 room photos — custom_itineraries.accommodationRoomPhotos. */
    roomPhotos?: string[];
    mealPlan?: string;
    /** Which meals are included (Breakfast/Lunch/Dinner/Tea & Snacks) — feeds
     * custom_itineraries.meals, the field the Day-wise Summary table and PDF
     * preview actually read (hotelMealPlan above is a separate free-text
     * label, not rendered anywhere in the itinerary document). */
    meals?: string[];
    /** Internal note for the sales exec (e.g. "confirmed by phone, no early
     * check-in") — shown in the builder's Hotel Info card, never in the
     * itinerary PDF. See custom_itineraries.hotelFillNote. */
    note?: string;
};

export async function fillPendingHotel(
    packageId: string,
    day: number,
    input: FillHotelInput,
): Promise<{ success: boolean; error?: string; allDaysFilled?: boolean }> {
    const auth = await requireMember();
    if (!auth.ok) return { success: false, error: auth.error };

    const hotelName = input.hotelName.trim();
    const roomName = input.roomName.trim();
    if (!hotelName) return { success: false, error: "Hotel name is required." };
    if (!(input.pricePerNight > 0)) return { success: false, error: "Enter a valid B2B price." };

    const row = await db.custom_itineraries.findFirst({
        where: { customPackageId: packageId, day },
        select: { id: true, hotelPending: true },
    });
    if (!row) return { success: false, error: "This day couldn't be found." };
    if (!row.hotelPending) return { success: false, error: "This day isn't awaiting a hotel fill." };

    await db.custom_itineraries.update({
        where: { id: row.id },
        data: {
            accommodation: roomName ? `${hotelName} — ${roomName}` : hotelName,
            accommodationRoomSpecs: input.roomSpecs?.trim() || null,
            accommodationPhoto: input.hotelPhoto?.trim() || null,
            accommodationRoomPhotos: (input.roomPhotos ?? []).map((p) => p.trim()).filter(Boolean).slice(0, 3),
            hotelCheckIn: input.checkIn?.trim() || null,
            hotelCheckOut: input.checkOut?.trim() || null,
            hotelMealPlan: input.mealPlan?.trim() || null,
            meals: normalizeMealLabels(input.meals),
            roomsCount: Math.max(1, Math.round(input.roomsCount) || 1),
            manualExtraBeds: Math.max(0, Math.round(input.extraBeds ?? 0)),
            manualExtraBedRate: input.extraBedRate ? Math.max(0, input.extraBedRate) : null,
            manualHotelPricePerNight: input.pricePerNight,
            hotelPending: false,
            hotelFilledAt: new Date(),
            hotelFilledById: auth.member.id,
            hotelFilledByName: auth.member.name,
            hotelFillNote: input.note?.trim() || null,
        },
    });

    // Costing prices a package from its stay options (custom_itinerary_stays),
    // not from the day row this fill writes. stay-options.sync.ts calls the day
    // row a compatibility surface for "everything not yet taught about options
    // — the v1 builder, the hotel-request workflow…", and nothing was teaching
    // it: a filled night reached costing with no price and was added up as ₹0
    // unless an exec happened to re-save the package in the builder.
    //
    // Observed in production on two nights, one of them filled through this
    // very form, so the classic version needs the sync as much as the new one.
    await syncRecommendedStayFromDays(packageId);

    const pkg = await db.custom_packages.findUnique({
        where: { id: packageId },
        select: { queryId: true },
    });

    const remainingPending = await db.custom_itineraries.count({
        where: { customPackageId: packageId, hotelPending: true },
    });
    // Deliberately does NOT advance the package to costing.
    //
    // It used to call markPackageReady here, which never once succeeded: that
    // action requires the sales exec who OWNS the package, and a fill is by
    // definition done by the hotel team — 528 fills in production, none by an
    // owner. So the "auto-submitted for costing review" line was never true.
    //
    // Removing it is also the behaviour that is actually wanted. Submitting is
    // the exec's decision, and it is a one-way door: once a package goes to
    // costing the exec cannot edit it again until it comes back approved or
    // rejected. A filled hotel should land back with the exec to check, and
    // they submit when the whole package is ready.
    const allDaysFilled = remainingPending === 0;

    if (pkg?.queryId) {
        await logTimeline(
            pkg.queryId,
            `Hotel filled for day ${day} by ${auth.member.name}${allDaysFilled ? " — every day is now filled, back to the exec to submit" : ""}`,
            auth.member.id, auth.member.name,
        );
    }

    await broadcastVerificationCounts();
    revalidatePath("/dashboard/hotel-requests");
    revalidatePath("/dashboard/hotel-requests-v2");
    revalidatePath(`/dashboard/hotel-requests/${packageId}`);
    revalidatePath(`/dashboard/package-builder/${packageId}`);
    revalidatePath(`/dashboard/package-builder-v2/${packageId}`);
    revalidatePath("/dashboard/verify-packages");
    revalidatePath("/dashboard/sales-query");

    return { success: true, allDaysFilled };
}

type RejectResult = { success: boolean; error?: string; count?: number };

async function afterReject(packageId: string) {
    await broadcastVerificationCounts();
    revalidatePath("/dashboard/hotel-requests");
    revalidatePath("/dashboard/hotel-requests-v2");
    revalidatePath(`/dashboard/hotel-requests/${packageId}`);
    revalidatePath(`/dashboard/package-builder/${packageId}`);
    revalidatePath(`/dashboard/package-builder-v2/${packageId}`);
    revalidatePath("/dashboard/sales-query");
}

/** Declines a single pending day — the hotel team couldn't source anything
 * that fits. Deliberately leaves hotelPending true (see the field's doc
 * comment in schema.prisma): the day stays in this queue, flagged rejected,
 * until the sales exec edits and resubmits the request from the builder. */
export async function rejectPendingHotel(
    packageId: string,
    day: number,
    reason: string,
): Promise<RejectResult> {
    const auth = await requireMember();
    if (!auth.ok) return { success: false, error: auth.error };

    const note = reason.trim();
    if (!note) return { success: false, error: "A reason is required to reject a hotel request." };

    const row = await db.custom_itineraries.findFirst({
        where: { customPackageId: packageId, day },
        select: { id: true, hotelPending: true },
    });
    if (!row) return { success: false, error: "This day couldn't be found." };
    if (!row.hotelPending) return { success: false, error: "This day isn't awaiting a hotel fill." };

    await db.custom_itineraries.update({
        where: { id: row.id },
        data: {
            hotelRejectedAt: new Date(),
            hotelRejectedById: auth.member.id,
            hotelRejectedByName: auth.member.name,
            hotelRejectionNote: note,
            hotelRejectedNotifiedAt: null,
        },
    });

    const pkg = await db.custom_packages.findUnique({ where: { id: packageId }, select: { queryId: true } });
    if (pkg?.queryId) {
        await logTimeline(
            pkg.queryId,
            `Hotel request rejected for day ${day} by ${auth.member.name}: ${note}`,
            auth.member.id, auth.member.name,
        );
    }

    await afterReject(packageId);
    return { success: true };
}

/** Declines every currently-pending day on the package at once, with one
 * shared reason — for when nothing in the whole request is fulfillable
 * (wrong budget, wrong destination entirely) rather than a single day. */
export async function rejectAllPendingHotels(
    packageId: string,
    reason: string,
): Promise<RejectResult> {
    const auth = await requireMember();
    if (!auth.ok) return { success: false, error: auth.error };

    const note = reason.trim();
    if (!note) return { success: false, error: "A reason is required to reject these hotel requests." };

    const rows = await db.custom_itineraries.findMany({
        where: { customPackageId: packageId, hotelPending: true, hotelRejectedAt: null },
        select: { id: true, day: true },
    });
    if (rows.length === 0) return { success: false, error: "No pending hotel requests on this package." };

    await db.custom_itineraries.updateMany({
        where: { id: { in: rows.map((r) => r.id) } },
        data: {
            hotelRejectedAt: new Date(),
            hotelRejectedById: auth.member.id,
            hotelRejectedByName: auth.member.name,
            hotelRejectionNote: note,
            hotelRejectedNotifiedAt: null,
        },
    });

    const pkg = await db.custom_packages.findUnique({ where: { id: packageId }, select: { queryId: true } });
    if (pkg?.queryId) {
        const days = rows.map((r) => r.day).sort((a, b) => a - b).join(", ");
        await logTimeline(
            pkg.queryId,
            `Hotel requests rejected for ${rows.length} day${rows.length !== 1 ? "s" : ""} (Day ${days}) by ${auth.member.name}: ${note}`,
            auth.member.id, auth.member.name,
        );
    }

    await afterReject(packageId);
    return { success: true, count: rows.length };
}
