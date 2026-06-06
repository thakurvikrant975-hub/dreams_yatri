"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/app/lib/db";
import { getCurrentMember } from "../lib/get-current-member";
import { getBookingFulfillment } from "@/app/services/fulfillment/status.service";
import { notifyFulfillmentChange } from "@/app/services/notifications/booking-notify";

/**
 * Admin fulfilment actions (Status tracking, Phase 3).
 *
 * Sets the per-item fulfilment status (+ optional voucher URL) for a booking's
 * hotel / transfer / activity, creating the BookingHotel / BookingCab /
 * BookingActivity row from the snapshot on first write. Gated to active team
 * members; every change is written to the BookingTimeline.
 */

type Member = NonNullable<Awaited<ReturnType<typeof getCurrentMember>>>;
async function requireMember(): Promise<{ ok: true; member: Member } | { ok: false; error: string }> {
    const member = await getCurrentMember();
    if (!member) return { ok: false, error: "Not authenticated." };
    if (!member.isActive) return { ok: false, error: "Your account is inactive." };
    return { ok: true, member };
}

type SettableStatus = "IN_PROCESS" | "CONFIRMED" | "UNAVAILABLE";
type Kind = "HOTEL" | "TRANSFER" | "ACTIVITY";

type SnapHotel = { hotel_id?: number; hotel_name?: string; hotel_city?: string | null; room_name?: string | null; num_nights?: number; rooms_count?: number; price_per_room?: number; total?: number };
type SnapActivity = { id?: number; name?: string; is_optional?: boolean; total?: number; variant_id?: number | null };
type SnapTransfer = { pickup_name?: string | null; drop_name?: string | null };
type SnapCab = { day_from: number; day_to: number; vehicle_capacity?: number };
type SnapDay = { day: number; hotel?: SnapHotel | null; activities?: SnapActivity[]; transfers?: SnapTransfer[] };
type Snapshot = { days?: SnapDay[]; cab_segments?: SnapCab[] };

function isoOfDay(start: Date, day: number): Date {
    return new Date(start.getTime() + (day - 1) * 86_400_000);
}

export async function setItemFulfillment(params: {
    bookingId: string;
    kind: Kind;
    day: number;
    activityId?: number | null; // required for ACTIVITY
    status: SettableStatus;
    voucherUrl?: string | null;
}): Promise<{ success: true } | { success: false; error: string }> {
    const gate = await requireMember();
    if (!gate.ok) return { success: false, error: gate.error };
    const { bookingId, kind, day, status } = params;
    const voucherUrl = params.voucherUrl?.trim() || null;
    const confirmed = status === "CONFIRMED";
    const stamp = { confirmedAt: confirmed ? new Date() : null, confirmedById: confirmed ? gate.member.id : null };

    const booking = await db.booking.findUnique({
        where: { id: bookingId },
        select: { id: true, startDate: true, cabType: true, priceSnapshot: true },
    });
    if (!booking) return { success: false, error: "Booking not found." };

    const snap = (booking.priceSnapshot ?? {}) as Snapshot;
    const sday = (snap.days ?? []).find((d) => d.day === day);
    if (!sday) return { success: false, error: "Day not found in this booking." };

    let label = "";
    try {
        if (kind === "HOTEL") {
            const h = sday.hotel;
            if (!h?.hotel_id) return { success: false, error: "No hotel on this day." };
            const nights = h.num_nights ?? 1;
            await db.bookingHotel.upsert({
                where: { bookingId_dayNumber: { bookingId, dayNumber: day } },
                create: {
                    bookingId, dayNumber: day,
                    cityName: h.hotel_city ?? "",
                    checkInDate: isoOfDay(booking.startDate, day),
                    checkOutDate: isoOfDay(booking.startDate, day + nights),
                    hotelId: h.hotel_id,
                    roomType: h.room_name ?? "",
                    roomsCount: h.rooms_count ?? 1,
                    ratePerRoom: h.price_per_room ?? 0,
                    totalCost: h.total ?? 0,
                    status, isConfirmed: confirmed, voucherUrl, ...stamp,
                },
                update: { status, isConfirmed: confirmed, voucherUrl, ...stamp },
            });
            label = h.hotel_name ?? "Hotel";
        } else if (kind === "ACTIVITY") {
            const aid = params.activityId;
            const a = (sday.activities ?? []).find((x) => x.id === aid);
            if (!a || aid == null) return { success: false, error: "Activity not found on this day." };
            await db.bookingActivity.upsert({
                where: { bookingId_dayNumber_activityId: { bookingId, dayNumber: day, activityId: aid } },
                create: {
                    bookingId, dayNumber: day, activityId: aid, variantId: a.variant_id ?? null,
                    name: a.name ?? "Activity", isPaid: (a.total ?? 0) > 0,
                    status, voucherUrl, ...stamp,
                },
                update: { status, voucherUrl, ...stamp },
            });
            label = a.name ?? "Activity";
        } else {
            // TRANSFER — one cab row per day (legNumber = day)
            const transfers = sday.transfers ?? [];
            if (transfers.length === 0) return { success: false, error: "No transfer on this day." };
            const seg = (snap.cab_segments ?? []).find((c) => day >= c.day_from && day <= c.day_to);
            await db.bookingCab.upsert({
                where: { bookingId_legNumber: { bookingId, legNumber: day } },
                create: {
                    bookingId, legNumber: day,
                    fromLocation: transfers[0].pickup_name ?? "",
                    toLocation: transfers[transfers.length - 1].drop_name ?? "",
                    transferDate: isoOfDay(booking.startDate, day),
                    cabType: booking.cabType,
                    cabCount: 1,
                    capacity: seg?.vehicle_capacity ?? 4,
                    ratePerCab: 0,
                    totalCost: 0,
                    status, isConfirmed: confirmed, voucherUrl, ...stamp,
                },
                update: { status, isConfirmed: confirmed, voucherUrl, ...stamp },
            });
            label = `${transfers[0].pickup_name ?? "—"} → ${transfers[transfers.length - 1].drop_name ?? "—"}`;
        }
    } catch (e) {
        console.error("[setItemFulfillment]", e);
        return { success: false, error: "Could not update this item. Please try again." };
    }

    const verb = status === "CONFIRMED" ? "confirmed" : status === "UNAVAILABLE" ? "marked unavailable" : "set in process";
    try {
        await db.bookingTimeline.create({
            data: {
                bookingId,
                action: status === "CONFIRMED" ? "DEPARTMENT_CONFIRMED" : status === "UNAVAILABLE" ? "DEPARTMENT_FLAGGED" : "NOTE_ADDED",
                note: `Day ${day} ${kind.toLowerCase()} "${label}" ${verb} by ${gate.member.name}.${voucherUrl ? " Voucher attached." : ""}`,
                performedById: gate.member.id,
                performedByName: gate.member.name,
                departmentId: gate.member.department?.id ?? null,
            },
        });
    } catch (e) {
        console.error("[setItemFulfillment] timeline", e);
    }

    // Customer notifications (best-effort, gated by NOTIFICATIONS_ENABLED).
    try {
        if (status === "UNAVAILABLE") {
            await notifyFulfillmentChange(bookingId, "ATTENTION", label);
        } else if (status === "CONFIRMED") {
            const f = await getBookingFulfillment(bookingId);
            if (f?.overall === "READY") await notifyFulfillmentChange(bookingId, "READY");
        }
    } catch (e) {
        console.error("[setItemFulfillment] notify", e);
    }

    revalidatePath(`/dashboard/package-bookings/${bookingId}`);
    revalidatePath(`/bookings/${bookingId}/status`);
    return { success: true };
}
