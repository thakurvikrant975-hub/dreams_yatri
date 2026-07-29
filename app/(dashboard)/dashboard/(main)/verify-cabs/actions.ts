"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/app/lib/db";
import { getCurrentMember } from "../lib/get-current-member";
import { broadcastVerificationCounts } from "@/app/services/verification-counts.service";
import { resolveCabPrice } from "@/app/services/cab-pricing-utils";

type Member = NonNullable<Awaited<ReturnType<typeof getCurrentMember>>>;
async function requireMember(): Promise<{ ok: true; member: Member } | { ok: false; error: string }> {
    const member = await getCurrentMember();
    if (!member) return { ok: false, error: "Not authenticated." };
    if (!member.isActive) return { ok: false, error: "Your account is inactive." };
    return { ok: true, member };
}

type SnapTransfer = { pickup_name?: string | null; drop_name?: string | null };
type SnapCab = { day_from: number; day_to: number; vehicle_capacity?: number; total?: number; price_used?: number };
type SnapDay = { day: number; transfers?: SnapTransfer[] };
type Snapshot = { days?: SnapDay[]; cab_segments?: SnapCab[] };

export type CabVehicleOption = {
    vehicleId: number;
    name: string;
    type: string;
    passengerCapacity: number;
    hasAc: boolean;
    pricingType: "PER_DAY" | "PER_KM";
    /** Resolved rate for the given date (weekend rate if that date falls on
     * a weekend and a season defines one, else the weekday/base rate). */
    rate: number;
    isSeasonal: boolean;
    /** Which destination/city this rate is scoped to — always shown so ops
     * knows a city-searched rate isn't necessarily the booking's own
     * destination. */
    cityLabel: string;
};

const CAB_PRICING_SELECT = {
    price: true, pricing_type: true,
    destination: { select: { name: true } },
    location: { select: { name: true } },
    vehicle: { select: { id: true, name: true, type: true, passenger_capacity: true, has_ac: true } },
    seasons: {
        where: { is_active: true },
        select: { pricing_type: true, valid_from: true, valid_to: true, weekday_price: true, weekend_price: true, is_active: true },
    },
} as const;

function toVehicleOption(
    r: {
        price: unknown; pricing_type: string;
        destination: { name: string } | null; location: { name: string } | null;
        vehicle: { id: number; name: string; type: string; passenger_capacity: number; has_ac: boolean };
        seasons: Parameters<typeof resolveCabPrice>[0]["seasons"];
    },
    date: Date | null,
): CabVehicleOption {
    const isWeekend = date ? (date.getDay() === 0 || date.getDay() === 6) : false;
    const resolved = resolveCabPrice({ pricing_type: r.pricing_type, price: r.price, seasons: r.seasons }, date);
    return {
        vehicleId: r.vehicle.id, name: r.vehicle.name, type: r.vehicle.type,
        passengerCapacity: r.vehicle.passenger_capacity, hasAc: r.vehicle.has_ac,
        pricingType: resolved.pricing_type,
        rate: isWeekend ? resolved.weekendPrice : resolved.weekdayPrice,
        isSeasonal: resolved.is_seasonal,
        cityLabel: r.destination?.name ?? r.location?.name ?? "—",
    };
}

/** Every vehicle with an active destination rate, priced for the given leg's
 * date (weekday/weekend + seasonal resolution — same engine the original
 * package price used) — powers the "Change Cab" vehicle picker. */
export async function getVehicleOptionsForDestination(
    destinationId: number,
    dateISO: string | null,
): Promise<CabVehicleOption[]> {
    const rows = await db.cab_pricing.findMany({
        where: { destination_id: destinationId, is_active: true, vehicle: { is_active: true } },
        select: CAB_PRICING_SELECT,
    });
    const date = dateISO ? new Date(`${dateISO}T00:00:00`) : null;
    return rows.map((r) => toVehicleOption(r, date)).sort((a, b) => a.rate - b.rate);
}

/** Fallback for when the booking's own destination has no configured rates
 * (or ops just wants a wider look) — search every active cab rate by
 * destination/city name. Requires 2+ characters so it never dumps the whole
 * catalog. */
export async function searchVehicleOptionsByCity(
    query: string,
    dateISO: string | null,
): Promise<CabVehicleOption[]> {
    const q = query.trim();
    if (q.length < 2) return [];

    const rows = await db.cab_pricing.findMany({
        where: {
            is_active: true,
            vehicle: { is_active: true },
            OR: [
                { destination: { name: { contains: q, mode: "insensitive" } } },
                { location: { name: { contains: q, mode: "insensitive" } } },
            ],
        },
        select: CAB_PRICING_SELECT,
        take: 40,
    });
    const date = dateISO ? new Date(`${dateISO}T00:00:00`) : null;
    return rows.map((r) => toVehicleOption(r, date)).sort((a, b) => a.rate - b.rate);
}

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
        newVehicleName,
        ratePerCab,
        totalCost,
    }: {
        fromLocation: string;
        toLocation: string;
        driverName?: string;
        driverPhone?: string;
        vehicleNumber?: string;
        notes?: string;
        /** Set only when ops picked a different vehicle via "Change Cab" —
         * folded into `notes` (BookingCab has no dedicated vehicle-name
         * column) and logged to the timeline for the audit trail. */
        newVehicleName?: string;
        /** Recomputed per-day rate / total for the newly selected vehicle.
         * Omit to keep confirming at the original snapshot price. */
        ratePerCab?: number;
        totalCost?: number;
    },
): Promise<{ success: true; allConfirmed: boolean } | { success: false; error: string }> {
    const gate = await requireMember();
    if (!gate.ok) return { success: false, error: gate.error };

    const booking = await db.booking.findUnique({
        where: { id: bookingId },
        select: { status: true, priceSnapshot: true, cabType: true, startDate: true, totalAmount_paise: true, balanceAmount_paise: true },
    });
    if (!booking) return { success: false, error: "Booking not found." };

    const snap = (booking.priceSnapshot ?? {}) as Snapshot;
    const snapDay = (snap.days ?? []).find((d) => d.day === legNumber);
    if (!snapDay || (snapDay.transfers ?? []).length === 0) {
        return { success: false, error: "No transfer found for this day." };
    }

    const seg = (snap.cab_segments ?? []).find((c) => legNumber >= c.day_from && legNumber <= c.day_to);
    const transferDate = new Date(booking.startDate.getTime() + (legNumber - 1) * 86_400_000);

    // `seg.total` is the WHOLE segment's cost (a segment can span several
    // consecutive days behind one vehicle) — never this single day's share.
    // Split evenly across the segment's day span before using it as this
    // leg's baseline, or every first confirmation would wrongly apply a
    // multi-day cost as a one-day delta.
    const segDayCost = seg?.total ? seg.total / Math.max(1, seg.day_to - seg.day_from + 1) : 0;

    // Baseline: an already-confirmed row's own cost, or the snapshot's
    // original per-leg cost on first confirmation — round both sides UP to a
    // whole rupee first so the delta (and the updated booking totals) can
    // never land on a fractional rupee (same discipline as hotel repricing).
    const existingRow = await db.bookingCab.findUnique({
        where: { bookingId_legNumber: { bookingId, legNumber } },
        select: { totalCost: true, ratePerCab: true },
    });
    const baselineCost = existingRow != null ? Number(existingRow.totalCost) : segDayCost;
    const newCost = totalCost ?? (existingRow != null ? Number(existingRow.totalCost) : segDayCost);
    const newRate = ratePerCab ?? (existingRow != null ? Number(existingRow.ratePerCab) : (seg?.price_used ?? 0));
    const totalCostRounded = Math.ceil(newCost);
    const baselineCostRounded = Math.ceil(baselineCost);
    const deltaPaise = (totalCostRounded - baselineCostRounded) * 100;

    const vehicleChangeNote = newVehicleName ? `Cab changed to ${newVehicleName}.` : null;
    const combinedNotes = [vehicleChangeNote, notes?.trim() || null].filter(Boolean).join(" ") || null;

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
            ratePerCab: newRate,
            totalCost: totalCostRounded,
            isConfirmed: true,
            status: "CONFIRMED",
            confirmedAt: new Date(),
            confirmedById: gate.member.id,
            driverName:    driverName?.trim()    || null,
            driverPhone:   driverPhone?.trim()   || null,
            vehicleNumber: vehicleNumber?.trim() || null,
            notes:         combinedNotes,
        },
        update: {
            isConfirmed: true,
            status: "CONFIRMED",
            confirmedAt: new Date(),
            confirmedById: gate.member.id,
            ratePerCab: newRate,
            totalCost: totalCostRounded,
            driverName:    driverName?.trim()    || null,
            driverPhone:   driverPhone?.trim()   || null,
            vehicleNumber: vehicleNumber?.trim() || null,
            notes:         combinedNotes,
        },
    });

    // Price change → adjust the booking's running total/balance (clamped at
    // zero, same as the hotel repricing flow).
    if (deltaPaise !== 0) {
        await db.booking.update({
            where: { id: bookingId },
            data: {
                totalAmount_paise: booking.totalAmount_paise + deltaPaise,
                balanceAmount_paise: Math.max(0, booking.balanceAmount_paise + deltaPaise),
            },
        });
        const diffAmount = `₹${Math.round(Math.abs(deltaPaise) / 100).toLocaleString("en-IN")}`;
        await db.bookingTimeline.create({
            data: {
                bookingId,
                action: "NOTE_ADDED",
                note: `[PRICE CHANGE] Day ${legNumber}: ${vehicleChangeNote ?? "Cab re-confirmed"} Cost ${deltaPaise > 0 ? "increased" : "decreased"} by ${diffAmount} (vs baseline) by ${gate.member.name}.`,
                performedById: gate.member.id,
                performedByName: gate.member.name,
                departmentId: gate.member.department?.id ?? null,
            },
        });
    }

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
        await broadcastVerificationCounts();
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
        await broadcastVerificationCounts();
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
