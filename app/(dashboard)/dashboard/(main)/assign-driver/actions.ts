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

export type DriverOption = {
    id: number;
    name: string;
    mobile: string;
    vehicle_reg_number: string | null;
    city: string | null;
    state: string | null;
    is_verified: boolean;
    avg_rating: number | null;
    vehicle: { id: number; name: string } | null;
};

type SnapCab = { day_from: number; day_to: number; vehicle_capacity?: number };
type SnapDay = { day: number; transfers?: { pickup_name?: string | null; drop_name?: string | null }[] };
type Snapshot = { days?: SnapDay[]; cab_segments?: SnapCab[] };

// ── Driver queries ─────────────────────────────────────────────────────────────

export async function getDriversForVehicle(vehicleId: number | null): Promise<DriverOption[]> {
    const where = vehicleId != null ? { vehicle_id: vehicleId, is_active: true } : { is_active: true };
    const drivers = await db.cab_drivers.findMany({
        where,
        select: {
            id: true, name: true, mobile: true,
            vehicle_reg_number: true, city: true, state: true,
            is_verified: true, avg_rating: true,
            vehicle: { select: { id: true, name: true } },
        },
        orderBy: [{ is_verified: "desc" }, { avg_rating: "desc" }, { name: "asc" }],
        take: 60,
    });
    return drivers.map((d) => ({
        ...d,
        avg_rating: d.avg_rating != null ? Number(d.avg_rating) : null,
    }));
}

// ── Assign a registered driver to a cab leg ────────────────────────────────────

export async function assignDriverToLeg(
    bookingId: string,
    legNumber: number,
    driverId: number,
    opts: { fromLocation: string; toLocation: string; notes?: string },
): Promise<{ success: true; allConfirmed: boolean } | { success: false; error: string }> {
    const gate = await requireMember();
    if (!gate.ok) return { success: false, error: gate.error };

    const [driver, booking] = await Promise.all([
        db.cab_drivers.findUnique({
            where: { id: driverId },
            select: { name: true, mobile: true, vehicle_reg_number: true },
        }),
        db.booking.findUnique({
            where: { id: bookingId },
            select: { status: true, priceSnapshot: true, cabType: true, startDate: true },
        }),
    ]);
    if (!driver) return { success: false, error: "Driver not found." };
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
            fromLocation: opts.fromLocation,
            toLocation: opts.toLocation,
            transferDate,
            cabType: booking.cabType,
            cabCount: 1,
            capacity: seg?.vehicle_capacity ?? 4,
            ratePerCab: 0, totalCost: 0,
            isConfirmed: true,
            status: "CONFIRMED",
            confirmedAt: new Date(),
            confirmedById: gate.member.id,
            driverName: driver.name,
            driverPhone: driver.mobile,
            vehicleNumber: driver.vehicle_reg_number ?? null,
            notes: opts.notes?.trim() || null,
        },
        update: {
            isConfirmed: true,
            status: "CONFIRMED",
            confirmedAt: new Date(),
            confirmedById: gate.member.id,
            driverName: driver.name,
            driverPhone: driver.mobile,
            vehicleNumber: driver.vehicle_reg_number ?? null,
            notes: opts.notes?.trim() || null,
        },
    });

    const totalTransferDays = (snap.days ?? []).filter((d) => (d.transfers ?? []).length > 0).length;
    const confirmedCount = await db.bookingCab.count({ where: { bookingId, isConfirmed: true } });
    const allConfirmed = totalTransferDays > 0 && confirmedCount >= totalTransferDays;

    const label = `${opts.fromLocation} → ${opts.toLocation}`;

    if (allConfirmed && (booking.status === "CAB_VERIFICATION" || booking.status === "HOTEL_CONFIRMED")) {
        await db.$transaction([
            db.booking.update({
                where: { id: bookingId },
                data: { status: "CAB_CONFIRMED", cabConfirmedAt: new Date(), cabAgentName: gate.member.name },
            }),
            db.bookingTimeline.create({
                data: {
                    bookingId,
                    action: "DEPARTMENT_CONFIRMED",
                    fromStatus: booking.status as "CAB_VERIFICATION" | "HOTEL_CONFIRMED",
                    toStatus: "CAB_CONFIRMED",
                    note: `All ${totalTransferDays} cab transfer${totalTransferDays !== 1 ? "s" : ""} confirmed. Driver ${driver.name} (${driver.mobile}) assigned. Booking moved to Cab Confirmed.`,
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
                note: `Day ${legNumber} cab "${label}" — driver assigned: ${driver.name} (${driver.mobile})${driver.vehicle_reg_number ? ` · Vehicle: ${driver.vehicle_reg_number}` : ""} by ${gate.member.name}.`,
                performedById: gate.member.id,
                performedByName: gate.member.name,
                departmentId: gate.member.department?.id ?? null,
            },
        });
    }

    revalidatePath(`/dashboard/assign-driver/${bookingId}`);
    revalidatePath("/dashboard/assign-driver");
    revalidatePath(`/dashboard/verify-cabs/${bookingId}`);
    revalidatePath(`/dashboard/package-bookings/${bookingId}`);
    revalidatePath(`/bookings/${bookingId}/status`);
    return { success: true, allConfirmed };
}

// ── Unassign driver from a leg ──────────────────────────────────────────────

export async function unassignDriverFromLeg(
    bookingId: string,
    legNumber: number,
): Promise<{ success: true } | { success: false; error: string }> {
    const gate = await requireMember();
    if (!gate.ok) return { success: false, error: gate.error };

    await db.bookingCab.updateMany({
        where: { bookingId, legNumber },
        data: {
            driverName: null,
            driverPhone: null,
            vehicleNumber: null,
            isConfirmed: false,
            status: "PENDING",
            confirmedAt: null,
            confirmedById: null,
        },
    });

    await db.bookingTimeline.create({
        data: {
            bookingId,
            action: "NOTE_ADDED",
            note: `Day ${legNumber} driver unassigned by ${gate.member.name}.`,
            performedById: gate.member.id,
            performedByName: gate.member.name,
            departmentId: gate.member.department?.id ?? null,
        },
    });

    revalidatePath(`/dashboard/assign-driver/${bookingId}`);
    revalidatePath("/dashboard/assign-driver");
    return { success: true };
}
