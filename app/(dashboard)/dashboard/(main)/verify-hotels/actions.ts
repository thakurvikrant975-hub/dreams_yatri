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

type SnapHotel = { hotel_id: number; rooms_count: number; num_nights: number };
type SnapDay = { day: number; hotel: SnapHotel | null };
type Snapshot = { days?: SnapDay[] };

export async function confirmHotelStay(
    bookingId: string,
    dayNumber: number,
    hotelId: number,
    {
        cityName,
        checkInDate,
        checkOutDate,
        roomType,
        roomsCount,
        ratePerRoom,
        totalCost,
        notes,
    }: {
        cityName: string;
        checkInDate: string;
        checkOutDate: string;
        roomType: string;
        roomsCount: number;
        ratePerRoom: number;
        totalCost: number;
        notes?: string;
    },
): Promise<{ success: true; allConfirmed: boolean } | { success: false; error: string }> {
    const gate = await requireMember();
    if (!gate.ok) return { success: false, error: gate.error };

    const hotel = await db.hotels.findUnique({ where: { id: hotelId }, select: { id: true, name: true } });
    if (!hotel) return { success: false, error: "Selected hotel not found." };

    const booking = await db.booking.findUnique({
        where: { id: bookingId },
        select: { status: true, priceSnapshot: true },
    });
    if (!booking) return { success: false, error: "Booking not found." };

    // Upsert the BookingHotel record
    await db.bookingHotel.upsert({
        where: { bookingId_dayNumber: { bookingId, dayNumber } },
        create: {
            bookingId,
            dayNumber,
            cityName,
            checkInDate: new Date(checkInDate),
            checkOutDate: new Date(checkOutDate),
            hotelId,
            roomType,
            roomsCount,
            ratePerRoom,
            totalCost,
            isConfirmed: true,
            confirmedAt: new Date(),
            confirmedById: gate.member.id,
            notes: notes?.trim() || null,
        },
        update: {
            hotelId,
            roomType,
            roomsCount,
            ratePerRoom,
            totalCost,
            isConfirmed: true,
            confirmedAt: new Date(),
            confirmedById: gate.member.id,
            notes: notes?.trim() || null,
        },
    });

    // Count total hotel days in snapshot
    const snapshot = (booking.priceSnapshot ?? {}) as Snapshot;
    const totalHotelDays = (snapshot.days ?? []).filter((d) => d.hotel !== null).length;

    // Count confirmed BookingHotel records for this booking
    const confirmedCount = await db.bookingHotel.count({
        where: { bookingId, isConfirmed: true },
    });

    const allConfirmed = confirmedCount >= totalHotelDays && totalHotelDays > 0;

    if (allConfirmed && booking.status === "PENDING_REVIEW" || allConfirmed && booking.status === "HOTEL_VERIFICATION") {
        await db.$transaction([
            db.booking.update({
                where: { id: bookingId },
                data: {
                    status: "HOTEL_CONFIRMED",
                    hotelConfirmedAt: new Date(),
                    hotelAgentName: gate.member.name,
                },
            }),
            db.bookingTimeline.create({
                data: {
                    bookingId,
                    action: "DEPARTMENT_CONFIRMED",
                    fromStatus: booking.status as "PENDING_REVIEW" | "HOTEL_VERIFICATION",
                    toStatus: "HOTEL_CONFIRMED",
                    note: `All ${totalHotelDays} hotel stay${totalHotelDays !== 1 ? "s" : ""} confirmed by ${gate.member.name}. Booking moved to Hotel Confirmed.`,
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
                note: `Day ${dayNumber} (${cityName}) hotel confirmed as "${hotel.name}" by ${gate.member.name}.${notes?.trim() ? ` Notes: ${notes.trim()}` : ""}`,
                performedById: gate.member.id,
                performedByName: gate.member.name,
                departmentId: gate.member.department?.id ?? null,
            },
        });
    }

    revalidatePath(`/dashboard/verify-hotels/${bookingId}`);
    revalidatePath("/dashboard/verify-hotels");
    return { success: true, allConfirmed };
}
