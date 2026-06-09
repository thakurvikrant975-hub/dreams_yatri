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

/** One leg that will be written to BookingCab. */
export type SegmentLeg = {
    legNumber: number;
    fromLocation: string;
    toLocation: string;
};

type SnapCab = { day_from: number; day_to: number; vehicle_capacity?: number };
type SnapDay = { day: number; transfers?: { pickup_name?: string | null; drop_name?: string | null }[] };
type Snapshot = { days?: SnapDay[]; cab_segments?: SnapCab[] };

// ── Internal helper: upsert driver on multiple legs ────────────────────────────

async function _assignDriver(
    bookingId: string,
    legs: SegmentLeg[],
    driver: { name: string; mobile: string; vehicle_reg_number: string | null },
    booking: { status: string; priceSnapshot: unknown; cabType: string; startDate: Date },
    memberId: string,
    memberName: string,
    memberDeptId: string | null | undefined,
): Promise<{ success: true; allConfirmed: boolean }> {
    const snap = (booking.priceSnapshot ?? {}) as Snapshot;
    const now = new Date();

    await Promise.all(
        legs.map((leg) => {
            const seg = (snap.cab_segments ?? []).find(
                (c) => leg.legNumber >= c.day_from && leg.legNumber <= c.day_to,
            );
            const transferDate = new Date(booking.startDate.getTime() + (leg.legNumber - 1) * 86_400_000);
            return db.bookingCab.upsert({
                where: { bookingId_legNumber: { bookingId, legNumber: leg.legNumber } },
                create: {
                    bookingId, legNumber: leg.legNumber,
                    fromLocation: leg.fromLocation,
                    toLocation:   leg.toLocation,
                    transferDate,
                    cabType:   booking.cabType as never,
                    cabCount:  1,
                    capacity:  seg?.vehicle_capacity ?? 4,
                    ratePerCab: 0, totalCost: 0,
                    isConfirmed: true, status: "CONFIRMED",
                    confirmedAt: now, confirmedById: memberId,
                    driverName:    driver.name,
                    driverPhone:   driver.mobile,
                    vehicleNumber: driver.vehicle_reg_number ?? null,
                },
                update: {
                    isConfirmed: true, status: "CONFIRMED",
                    confirmedAt: now, confirmedById: memberId,
                    driverName:    driver.name,
                    driverPhone:   driver.mobile,
                    vehicleNumber: driver.vehicle_reg_number ?? null,
                },
            });
        }),
    );

    const totalTransferDays = (snap.days ?? []).filter((d) => (d.transfers ?? []).length > 0).length;
    const confirmedCount    = await db.bookingCab.count({ where: { bookingId, driverName: { not: null } } });
    const allConfirmed      = totalTransferDays > 0 && confirmedCount >= totalTransferDays;

    if (allConfirmed && (booking.status === "CAB_VERIFICATION" || booking.status === "HOTEL_CONFIRMED")) {
        await db.$transaction([
            db.booking.update({
                where: { id: bookingId },
                data: { status: "CAB_CONFIRMED", cabConfirmedAt: now, cabAgentName: memberName },
            }),
            db.bookingTimeline.create({
                data: {
                    bookingId,
                    action: "DEPARTMENT_CONFIRMED",
                    fromStatus: booking.status as "CAB_VERIFICATION" | "HOTEL_CONFIRMED",
                    toStatus:   "CAB_CONFIRMED",
                    note: `All ${totalTransferDays} transfer${totalTransferDays !== 1 ? "s" : ""} assigned to driver ${driver.name} (${driver.mobile}) by ${memberName}. Booking moved to Cab Confirmed.`,
                    performedById:   memberId,
                    performedByName: memberName,
                    departmentId:    memberDeptId ?? null,
                },
            }),
        ]);
    } else {
        await db.bookingTimeline.create({
            data: {
                bookingId, action: "NOTE_ADDED",
                note: `${legs.length} leg${legs.length !== 1 ? "s" : ""} (days ${legs.map((l) => l.legNumber).join(", ")}) — driver assigned: ${driver.name} (${driver.mobile})${driver.vehicle_reg_number ? ` · ${driver.vehicle_reg_number}` : ""} by ${memberName}.`,
                performedById:   memberId,
                performedByName: memberName,
                departmentId:    memberDeptId ?? null,
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

// ── Assign a registered driver to one or more legs (segment) ──────────────────

export async function assignDriverToSegment(
    bookingId: string,
    legs: SegmentLeg[],
    driverId: number,
): Promise<{ success: true; allConfirmed: boolean } | { success: false; error: string }> {
    const gate = await requireMember();
    if (!gate.ok) return { success: false, error: gate.error };
    if (legs.length === 0) return { success: false, error: "No legs provided." };

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
    if (!driver)  return { success: false, error: "Driver not found." };
    if (!booking) return { success: false, error: "Booking not found." };

    return _assignDriver(bookingId, legs, driver, booking, gate.member.id, gate.member.name, gate.member.department?.id);
}

// ── Assign one driver to every transfer leg in the booking ────────────────────

export async function assignDriverToAllLegs(
    bookingId: string,
    driverId: number,
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
    if (!driver)  return { success: false, error: "Driver not found." };
    if (!booking) return { success: false, error: "Booking not found." };

    const snap = (booking.priceSnapshot ?? {}) as Snapshot;
    const transferDays = (snap.days ?? []).filter((d) => (d.transfers ?? []).length > 0);
    if (transferDays.length === 0) return { success: false, error: "No transfer days found." };

    const legs: SegmentLeg[] = transferDays.map((d) => ({
        legNumber:    d.day,
        fromLocation: d.transfers![0]?.pickup_name ?? "",
        toLocation:   d.transfers![d.transfers!.length - 1]?.drop_name ?? "",
    }));

    return _assignDriver(bookingId, legs, driver, booking, gate.member.id, gate.member.name, gate.member.department?.id);
}

// ── Unassign driver from one or more legs ────────────────────────────────────

export async function unassignDriverFromSegment(
    bookingId: string,
    legNumbers: number[],
): Promise<{ success: true } | { success: false; error: string }> {
    const gate = await requireMember();
    if (!gate.ok) return { success: false, error: gate.error };

    await db.bookingCab.updateMany({
        where: { bookingId, legNumber: { in: legNumbers } },
        data: {
            driverName: null, driverPhone: null, vehicleNumber: null,
            isConfirmed: false, status: "PENDING",
            confirmedAt: null, confirmedById: null,
        },
    });

    await db.bookingTimeline.create({
        data: {
            bookingId, action: "NOTE_ADDED",
            note: `Driver unassigned from day${legNumbers.length !== 1 ? "s" : ""} ${legNumbers.join(", ")} by ${gate.member.name}.`,
            performedById:   gate.member.id,
            performedByName: gate.member.name,
            departmentId:    gate.member.department?.id ?? null,
        },
    });

    revalidatePath(`/dashboard/assign-driver/${bookingId}`);
    revalidatePath("/dashboard/assign-driver");
    return { success: true };
}
