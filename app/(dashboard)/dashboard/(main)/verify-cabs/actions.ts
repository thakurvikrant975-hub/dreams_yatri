"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/app/lib/db";
import { getCurrentMember } from "../lib/get-current-member";

type Member = NonNullable<Awaited<ReturnType<typeof getCurrentMember>>>;
async function requireMember(): Promise<{ ok: true; member: Member } | { ok: false; error: string }> {
    const member = await getCurrentMember();
    if (!member) return { ok: false, error: "Not authenticated." };
    if (!member.isActive) return { ok: false, error: "Your account is inactive." };
    return { ok: true, member };
}

type SnapTransfer = { pickup_name?: string | null; drop_name?: string | null };
type SnapCab = { day_from: number; day_to: number; vehicle_capacity?: number };
type SnapDay = { day: number; transfers?: SnapTransfer[] };
type Snapshot = { days?: SnapDay[]; cab_segments?: SnapCab[] };

export async function confirmCabLeg(
    bookingId: string,
    legNumber: number,
    {
        fromLocation,
        toLocation,
        driverName,
        driverPhone,
        vehicleNumber,
        notes,
    }: {
        fromLocation: string;
        toLocation: string;
        driverName?: string;
        driverPhone?: string;
        vehicleNumber?: string;
        notes?: string;
    },
): Promise<{ success: true; allConfirmed: boolean } | { success: false; error: string }> {
    const gate = await requireMember();
    if (!gate.ok) return { success: false, error: gate.error };

    const booking = await db.booking.findUnique({
        where: { id: bookingId },
        select: { status: true, priceSnapshot: true, cabType: true, startDate: true },
    });
    if (!booking) return { success: false, error: "Booking not found." };

    const snap = (booking.priceSnapshot ?? {}) as Snapshot;
    const snapDay = (snap.days ?? []).find((d) => d.day === legNumber);
    if (!snapDay || (snapDay.transfers ?? []).length === 0) {
        return { success: false, error: "No transfer found for this day." };
    }

    const seg = (snap.cab_segments ?? []).find((c) => legNumber >= c.day_from && legNumber <= c.day_to);
    const transferDate = new Date(booking.startDate.getTime() + (legNumber - 1) * 86_400_000);

    await db.bookingCab.upsert({
        where: { bookingId_legNumber: { bookingId, legNumber } },
        create: {
            bookingId, legNumber,
            fromLocation,
            toLocation,
            transferDate,
            cabType: booking.cabType,
            cabCount: 1,
            capacity: seg?.vehicle_capacity ?? 4,
            ratePerCab: 0,
            totalCost: 0,
            isConfirmed: true,
            status: "CONFIRMED",
            confirmedAt: new Date(),
            confirmedById: gate.member.id,
            driverName:    driverName?.trim()    || null,
            driverPhone:   driverPhone?.trim()   || null,
            vehicleNumber: vehicleNumber?.trim() || null,
            notes:         notes?.trim()         || null,
        },
        update: {
            isConfirmed: true,
            status: "CONFIRMED",
            confirmedAt: new Date(),
            confirmedById: gate.member.id,
            driverName:    driverName?.trim()    || null,
            driverPhone:   driverPhone?.trim()   || null,
            vehicleNumber: vehicleNumber?.trim() || null,
            notes:         notes?.trim()         || null,
        },
    });

    // Count transfer days in snapshot vs confirmed rows
    const totalTransferDays = (snap.days ?? []).filter((d) => (d.transfers ?? []).length > 0).length;
    const confirmedCount    = await db.bookingCab.count({ where: { bookingId, isConfirmed: true } });
    const allConfirmed      = totalTransferDays > 0 && confirmedCount >= totalTransferDays;

    const label = `${fromLocation} → ${toLocation}`;

    if (
        allConfirmed &&
        (booking.status === "CAB_VERIFICATION" || booking.status === "HOTEL_CONFIRMED")
    ) {
        await db.$transaction([
            db.booking.update({
                where: { id: bookingId },
                data: {
                    status: "CAB_CONFIRMED",
                    cabConfirmedAt: new Date(),
                    cabAgentName: gate.member.name,
                },
            }),
            db.bookingTimeline.create({
                data: {
                    bookingId,
                    action: "DEPARTMENT_CONFIRMED",
                    fromStatus: booking.status as "CAB_VERIFICATION" | "HOTEL_CONFIRMED",
                    toStatus: "CAB_CONFIRMED",
                    note: `All ${totalTransferDays} cab transfer${totalTransferDays !== 1 ? "s" : ""} confirmed by ${gate.member.name}. Booking moved to Cab Confirmed.`,
                    performedById: gate.member.id,
                    performedByName: gate.member.name,
                    departmentId: gate.member.department?.id ?? null,
                },
            }),
        ]);
    } else {
        await db.bookingTimeline.create({
            data: {
                bookingId,
                action: "NOTE_ADDED",
                note: `Day ${legNumber} cab "${label}" confirmed by ${gate.member.name}.${driverName?.trim() ? ` Driver: ${driverName.trim()}` : ""}${vehicleNumber?.trim() ? ` · Vehicle: ${vehicleNumber.trim()}` : ""}${notes?.trim() ? ` Notes: ${notes.trim()}` : ""}`,
                performedById: gate.member.id,
                performedByName: gate.member.name,
                departmentId: gate.member.department?.id ?? null,
            },
        });
    }

    revalidatePath(`/dashboard/verify-cabs/${bookingId}`);
    revalidatePath("/dashboard/verify-cabs");
    revalidatePath(`/dashboard/package-bookings/${bookingId}`);
    revalidatePath(`/bookings/${bookingId}/status`);
    return { success: true, allConfirmed };
}

/**
 * Confirm every unconfirmed cab leg for a booking in one shot,
 * applying the same driver / vehicle details to all of them.
 */
export async function confirmAllCabLegs(
    bookingId: string,
    {
        driverName,
        driverPhone,
        vehicleNumber,
        notes,
    }: {
        driverName?: string;
        driverPhone?: string;
        vehicleNumber?: string;
        notes?: string;
    },
): Promise<{ success: true; count: number } | { success: false; error: string }> {
    const gate = await requireMember();
    if (!gate.ok) return { success: false, error: gate.error };

    const booking = await db.booking.findUnique({
        where: { id: bookingId },
        select: { status: true, priceSnapshot: true, cabType: true, startDate: true },
    });
    if (!booking) return { success: false, error: "Booking not found." };

    const snap = (booking.priceSnapshot ?? {}) as Snapshot;
    const transferDays = (snap.days ?? []).filter((d) => (d.transfers ?? []).length > 0);
    if (transferDays.length === 0) return { success: false, error: "No transfers found in this booking." };

    // Only confirm legs that are not yet confirmed
    const existingConfirmed = await db.bookingCab.findMany({
        where: { bookingId, isConfirmed: true },
        select: { legNumber: true },
    });
    const alreadyDone = new Set(existingConfirmed.map((c) => c.legNumber));
    const pending = transferDays.filter((d) => !alreadyDone.has(d.day));

    if (pending.length === 0) return { success: false, error: "All transfers are already confirmed." };

    const now = new Date();
    const driverNameClean    = driverName?.trim()    || null;
    const driverPhoneClean   = driverPhone?.trim()   || null;
    const vehicleNumberClean = vehicleNumber?.trim() || null;
    const notesClean         = notes?.trim()         || null;

    // Upsert all pending legs in parallel
    await Promise.all(
        pending.map((d) => {
            const transfers   = d.transfers ?? [];
            const fromLocation = transfers[0]?.pickup_name ?? "";
            const toLocation   = transfers[transfers.length - 1]?.drop_name ?? "";
            const seg          = (snap.cab_segments ?? []).find((c) => d.day >= c.day_from && d.day <= c.day_to);
            const transferDate = new Date(booking.startDate.getTime() + (d.day - 1) * 86_400_000);

            return db.bookingCab.upsert({
                where: { bookingId_legNumber: { bookingId, legNumber: d.day } },
                create: {
                    bookingId, legNumber: d.day,
                    fromLocation, toLocation, transferDate,
                    cabType: booking.cabType, cabCount: 1,
                    capacity: seg?.vehicle_capacity ?? 4,
                    ratePerCab: 0, totalCost: 0,
                    isConfirmed: true, status: "CONFIRMED",
                    confirmedAt: now, confirmedById: gate.member.id,
                    driverName: driverNameClean, driverPhone: driverPhoneClean,
                    vehicleNumber: vehicleNumberClean, notes: notesClean,
                },
                update: {
                    isConfirmed: true, status: "CONFIRMED",
                    confirmedAt: now, confirmedById: gate.member.id,
                    driverName: driverNameClean, driverPhone: driverPhoneClean,
                    vehicleNumber: vehicleNumberClean, notes: notesClean,
                },
            });
        }),
    );

    // Check if all legs are now confirmed
    const totalTransferDays = transferDays.length;
    const confirmedCount    = await db.bookingCab.count({ where: { bookingId, isConfirmed: true } });
    const allConfirmed      = confirmedCount >= totalTransferDays;

    const driverLabel = driverNameClean ? ` Driver: ${driverNameClean}` : "";
    const vehicleLabel = vehicleNumberClean ? ` · Vehicle: ${vehicleNumberClean}` : "";

    if (allConfirmed && (booking.status === "CAB_VERIFICATION" || booking.status === "HOTEL_CONFIRMED")) {
        await db.$transaction([
            db.booking.update({
                where: { id: bookingId },
                data: { status: "CAB_CONFIRMED", cabConfirmedAt: now, cabAgentName: gate.member.name },
            }),
            db.bookingTimeline.create({
                data: {
                    bookingId, action: "DEPARTMENT_CONFIRMED",
                    fromStatus: booking.status as "CAB_VERIFICATION" | "HOTEL_CONFIRMED",
                    toStatus: "CAB_CONFIRMED",
                    note: `All ${totalTransferDays} cab transfer${totalTransferDays !== 1 ? "s" : ""} confirmed in bulk by ${gate.member.name}.${driverLabel}${vehicleLabel} Booking moved to Cab Confirmed.`,
                    performedById: gate.member.id, performedByName: gate.member.name,
                    departmentId: gate.member.department?.id ?? null,
                },
            }),
        ]);
    } else {
        await db.bookingTimeline.create({
            data: {
                bookingId, action: "NOTE_ADDED",
                note: `${pending.length} cab transfer${pending.length !== 1 ? "s" : ""} confirmed in bulk by ${gate.member.name}.${driverLabel}${vehicleLabel}${notesClean ? ` Notes: ${notesClean}` : ""}`,
                performedById: gate.member.id, performedByName: gate.member.name,
                departmentId: gate.member.department?.id ?? null,
            },
        });
    }

    revalidatePath(`/dashboard/verify-cabs/${bookingId}`);
    revalidatePath("/dashboard/verify-cabs");
    revalidatePath(`/dashboard/package-bookings/${bookingId}`);
    revalidatePath(`/bookings/${bookingId}/status`);
    return { success: true, count: pending.length };
}
