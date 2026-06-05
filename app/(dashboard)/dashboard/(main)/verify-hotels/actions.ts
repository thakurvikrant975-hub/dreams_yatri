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

export async function confirmHotelBooking(
    bookingHotelId: string,
    hotelId: number,
    notes?: string,
): Promise<{ success: true; allConfirmed: boolean } | { success: false; error: string }> {
    const gate = await requireMember();
    if (!gate.ok) return { success: false, error: gate.error };

    const bh = await db.bookingHotel.findUnique({
        where: { id: bookingHotelId },
        select: { bookingId: true, isConfirmed: true, dayNumber: true, cityName: true },
    });
    if (!bh) return { success: false, error: "Hotel booking entry not found." };
    if (bh.isConfirmed) return { success: false, error: "This hotel stay is already confirmed." };

    // Verify the hotel exists
    const hotel = await db.hotels.findUnique({ where: { id: hotelId }, select: { id: true, name: true } });
    if (!hotel) return { success: false, error: "Selected hotel not found." };

    await db.bookingHotel.update({
        where: { id: bookingHotelId },
        data: {
            isConfirmed: true,
            confirmedAt: new Date(),
            confirmedById: gate.member.id,
            hotelId,
            notes: notes?.trim() || null,
        },
    });

    const remaining = await db.bookingHotel.count({
        where: { bookingId: bh.bookingId, isConfirmed: false },
    });

    if (remaining === 0) {
        const booking = await db.booking.findUnique({
            where: { id: bh.bookingId },
            select: { status: true },
        });
        if (booking?.status === "HOTEL_VERIFICATION") {
            await db.$transaction([
                db.booking.update({
                    where: { id: bh.bookingId },
                    data: {
                        status: "HOTEL_CONFIRMED",
                        hotelConfirmedAt: new Date(),
                        hotelAgentName: gate.member.name,
                    },
                }),
                db.bookingTimeline.create({
                    data: {
                        bookingId: bh.bookingId,
                        action: "DEPARTMENT_CONFIRMED",
                        fromStatus: "HOTEL_VERIFICATION",
                        toStatus: "HOTEL_CONFIRMED",
                        note: `All hotels confirmed by ${gate.member.name}. Booking moved to Hotel Confirmed.`,
                        performedById: gate.member.id,
                        performedByName: gate.member.name,
                        departmentId: gate.member.department?.id ?? null,
                    },
                }),
            ]);
        }
        revalidatePath("/dashboard/verify-hotels");
        revalidatePath(`/dashboard/verify-hotels/${bh.bookingId}`);
        return { success: true, allConfirmed: true };
    }

    await db.bookingTimeline.create({
        data: {
            bookingId: bh.bookingId,
            action: "NOTE_ADDED",
            note: `Day ${bh.dayNumber} (${bh.cityName}) hotel confirmed as "${hotel.name}" by ${gate.member.name}.${notes?.trim() ? ` Notes: ${notes.trim()}` : ""}`,
            performedById: gate.member.id,
            performedByName: gate.member.name,
            departmentId: gate.member.department?.id ?? null,
        },
    });

    revalidatePath(`/dashboard/verify-hotels/${bh.bookingId}`);
    revalidatePath("/dashboard/verify-hotels");
    return { success: true, allConfirmed: false };
}
