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
import { resolveStayPhoto } from "@/app/lib/imageUrl";
import { normalizeMealLabels } from "@/app/(dashboard)/dashboard/(builder)/package-builder/meals";
import { getCurrentMember } from "../lib/get-current-member";
import { logTimeline } from "../(marketing)/queries/actions";
import { broadcastVerificationCounts } from "@/app/services/verification-counts.service";
import { syncRecommendedStayFromDays } from "@/app/(dashboard)/dashboard/(builder)/package-builder/stay-options.sync";

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
    /**
     * The catalog rate this fill was taken from, when the admin picked one out
     * of the hotel search rather than typing a hotel in by hand.
     *
     * Linking it is the whole point of searching first: the day stops being a
     * name and a number that live only on this package and starts pointing at
     * a real hotel_room_pricing row, so pricing runs through the catalog
     * branch of computeBuilderHotelPricing (which takes precedence over
     * manualHotelPricePerNight) and the property is already there the next
     * time someone needs it.
     *
     * Only sent when the admin left the catalog's own price alone. The moment
     * they type a different rate, the form drops the link and submits as a
     * manual fill, because a negotiated price that isn't the catalog price
     * must not be silently replaced by the catalog price at costing time.
     */
    roomPricingId?: number | null;
    /**
     * Further pending days on the same package this stay also covers.
     *
     * One property booked for three nights is one phone call and one rate, but
     * the queue renders a form per pending day, so it used to be three identical
     * re-entries of the same hotel, room, price, meal plan and photos. The extra
     * days are filled from the same submit and share the one catalog link.
     *
     * Rooms and mattresses are the exception: those come from what the exec
     * asked for on each individual day, which can legitimately differ night to
     * night, so each day keeps its own rather than inheriting this form's.
     */
    alsoDays?: number[];
};

/** Not exported: a "use server" module's exports must all be async
 * functions, and this is only ever needed inside this file. */
type FillHotelResult = {
    success: boolean; error?: string; allDaysFilled?: boolean; filledDays?: number[];
    /** Days that saved but still cannot be priced — costing would show ₹0. */
    unpricedDays?: number[];
};

/**
 * A server action that THROWS is a very different thing from one that returns
 * an error. Next re-throws it on the client, and it travels past this route's
 * own error boundary out to the unstyled global-error page — the blank white
 * screen the hotel team hits mid-fill, from which the only way back is a
 * reload and then re-navigating to the queue from scratch.
 *
 * Nothing that can go wrong in here is unrecoverable from the caller's point
 * of view, so it is all reported instead. The wrapper is separate from the
 * work so the work below can go on reading as one straight-line procedure.
 */
export async function fillPendingHotel(
    packageId: string,
    day: number,
    input: FillHotelInput,
): Promise<FillHotelResult> {
    try {
        return await runFillPendingHotel(packageId, day, input);
    } catch (e) {
        console.error("[fillPendingHotel]", { packageId, day }, e);
        return {
            success: false,
            error: "Something went wrong saving this hotel. Reload the page to see what did save, "
                + "then try again — and tell the dev team if it keeps happening.",
        };
    }
}

async function runFillPendingHotel(
    packageId: string,
    day: number,
    input: FillHotelInput,
): Promise<FillHotelResult> {
    const auth = await requireMember();
    if (!auth.ok) return { success: false, error: auth.error };

    const hotelName = input.hotelName.trim();
    const roomName = input.roomName.trim();
    if (!hotelName) return { success: false, error: "Hotel name is required." };
    if (!(input.pricePerNight > 0)) return { success: false, error: "Enter a valid B2B price." };

    // A stale link is worse than no link: the picker's results could have been
    // deactivated between the search and the submit, and a day pointing at a
    // dead rate prices as zero rather than failing loudly.
    let linkedPricingId: number | null = null;
    if (input.roomPricingId != null) {
        const rate = await db.hotel_room_pricing.findFirst({
            where: { id: input.roomPricingId, is_active: true, hotel: { is_active: true } },
            select: { id: true },
        });
        if (!rate) {
            return { success: false, error: "That catalog rate is no longer available — search again or fill it in by hand." };
        }
        linkedPricingId = rate.id;
    }

    const days = Array.from(new Set([day, ...(input.alsoDays ?? [])]));
    const rows = await db.custom_itineraries.findMany({
        where: { customPackageId: packageId, day: { in: days } },
        select: {
            id: true, day: true, hotelPending: true,
            roomsCount: true, manualExtraBeds: true, hotelMealPlan: true,
        },
    });
    const primary = rows.find((r) => r.day === day);
    if (!primary) return { success: false, error: "This day couldn't be found." };
    if (!primary.hotelPending) return { success: false, error: "This day isn't awaiting a hotel fill." };

    // A day that stopped being pending between render and submit — someone else
    // in the queue got to it — is dropped rather than overwritten.
    const targets = rows.filter((r) => r.hotelPending);

    const typedRooms = Math.max(1, Math.round(input.roomsCount) || 1);
    const typedBeds = Math.max(0, Math.round(input.extraBeds ?? 0));

    await db.$transaction(targets.map((target) => db.custom_itineraries.update({
        where: { id: target.id },
        data: {
            accommodation: roomName ? `${hotelName} — ${roomName}` : hotelName,
            accommodationRoomSpecs: input.roomSpecs?.trim() || null,
            // Resolved here rather than trusted from the form. A day row is
            // rendered raw by the builder, the PDF and the client-facing page,
            // so a bare storage key arriving from any client is a photo that
            // silently fails to load — see resolveStayPhoto. A value that is
            // already a URL passes through untouched.
            accommodationPhoto: resolveStayPhoto(input.hotelPhoto?.trim()) || null,
            accommodationRoomPhotos: (input.roomPhotos ?? [])
                .map((p) => resolveStayPhoto(p.trim()))
                .filter(Boolean)
                .slice(0, 3),
            hotelCheckIn: input.checkIn?.trim() || null,
            hotelCheckOut: input.checkOut?.trim() || null,
            // Same rule as the counts below: the meal plan is part of what the
            // exec asked for on each night and can differ between them, so a day
            // carried along keeps its own rather than inheriting this form's.
            hotelMealPlan: target.day === day
                ? (input.mealPlan?.trim() || null)
                : (target.hotelMealPlan ?? input.mealPlan?.trim() ?? null),
            meals: normalizeMealLabels(input.meals),
            // The form's own day takes what was typed; a day carried along keeps
            // the count its own request asked for, falling back to the typed one.
            roomsCount: target.day === day ? typedRooms : (target.roomsCount ?? typedRooms),
            manualExtraBeds: target.day === day ? typedBeds : (target.manualExtraBeds ?? typedBeds),
            manualExtraBedRate: input.extraBedRate ? Math.max(0, input.extraBedRate) : null,
            manualHotelPricePerNight: input.pricePerNight,
            // Kept alongside the manual fields rather than instead of them:
            // computeBuilderHotelPricing prefers roomPricingId, so the manual
            // price becomes an inert fallback, while the accommodation name and
            // specs above stay as the snapshot the sold document renders from.
            roomPricingId: linkedPricingId,
            hotelPending: false,
            hotelFilledAt: new Date(),
            hotelFilledById: auth.member.id,
            hotelFilledByName: auth.member.name,
            hotelFillNote: input.note?.trim() || null,
        },
    })));

    // ── The day row is only half the story ──────────────────────────────────
    //
    // Costing prices a package from its stay OPTIONS (custom_itinerary_stays),
    // not from the day rows this fill writes. stay-options.sync.ts says as much
    // in its header: the day row is a compatibility surface for "everything not
    // yet taught about options — the v1 builder, the hotel-request workflow…".
    //
    // Nothing was teaching it. A filled day left its stay row still pending with
    // no price, and since every package in production uses stay options, the
    // costing manager showed the night at ₹0 — the hotel was there on the day,
    // and worth nothing where the money is added up. It only ever came right if
    // an exec happened to re-save the package in the builder afterwards, which
    // is exactly what a fill that auto-advances to costing skips.
    await syncRecommendedStayFromDays(packageId);

    // Belt and braces: prove the nights this fill just wrote can actually be
    // priced, rather than trusting that they can. A stay row with no rate, no
    // manual price and no override is the ₹0 the costing manager reports, and
    // the admin who filled it is the only person able to put it right while the
    // hotel is still on the phone.
    const filledDayNumbers = targets.map((t) => t.day);
    const unpriced = await db.custom_itinerary_stays.findMany({
        where: {
            itinerary: { customPackageId: packageId, day: { in: filledDayNumbers } },
            stayOption: { isRecommended: true },
            roomPricingId: null,
            manualHotelPricePerNight: null,
            hotelPriceOverride: null,
        },
        select: { itinerary: { select: { day: true } } },
    });

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
            `Hotel filled for ${targets.length > 1 ? `days ${targets.map((t) => t.day).sort((a, b) => a - b).join(", ")}` : `day ${day}`}`
            + ` by ${auth.member.name}${allDaysFilled ? " — every day is now filled, back to the exec to submit" : ""}`,
            auth.member.id, auth.member.name,
        );
    }

    await broadcastVerificationCounts();
    revalidatePath("/dashboard/hotel-requests-v2");
    revalidatePath("/dashboard/hotel-requests");
    revalidatePath(`/dashboard/hotel-requests-v2/${packageId}`);
    revalidatePath(`/dashboard/package-builder/${packageId}`);
    revalidatePath("/dashboard/verify-packages");
    revalidatePath("/dashboard/sales-query");

    return {
        success: true, allDaysFilled,
        filledDays: targets.map((t) => t.day).sort((a, b) => a - b),
        unpricedDays: unpriced.map((u) => u.itinerary.day).sort((a, b) => a - b),
    };
}

type RejectResult = { success: boolean; error?: string; count?: number };

async function afterReject(packageId: string) {
    await broadcastVerificationCounts();
    revalidatePath("/dashboard/hotel-requests-v2");
    revalidatePath("/dashboard/hotel-requests");
    revalidatePath(`/dashboard/hotel-requests-v2/${packageId}`);
    revalidatePath(`/dashboard/package-builder/${packageId}`);
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
    try {
        return await runRejectPendingHotel(packageId, day, reason);
    } catch (e) {
        // Same reasoning as fillPendingHotel's wrapper — see the comment there.
        console.error("[rejectPendingHotel]", { packageId, day }, e);
        return { success: false, error: "Something went wrong rejecting this day. Reload the page and try again." };
    }
}

async function runRejectPendingHotel(
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
    try {
        return await runRejectAllPendingHotels(packageId, reason);
    } catch (e) {
        // Same reasoning as fillPendingHotel's wrapper — see the comment there.
        console.error("[rejectAllPendingHotels]", { packageId }, e);
        return { success: false, error: "Something went wrong rejecting these days. Reload the page and try again." };
    }
}

async function runRejectAllPendingHotels(
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
