"use server";

// (main)/upcoming-guests/actions.ts
//
// Pre-travel reconfirmation — separate from verify-hotels/verify-cabs'
// initial confirmedAt. A hotel/cab that confirmed weeks ago can still
// cancel or change on short notice, so this records a fresh "we called the
// vendor and it still stands" check for bookings travelling soon.

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

function revalidateAll(bookingId: string) {
    revalidatePath("/dashboard/upcoming-guests");
    revalidatePath(`/dashboard/upcoming-guests/${bookingId}`);
}

export async function toggleHotelReconfirmed(
    bookingId: string,
    dayNumber: number,
): Promise<{ success: true; reconfirmed: boolean } | { success: false; error: string }> {
    const gate = await requireMember();
    if (!gate.ok) return { success: false, error: gate.error };

    const row = await db.bookingHotel.findUnique({
        where: { bookingId_dayNumber: { bookingId, dayNumber } },
        select: { id: true, isConfirmed: true, reconfirmedAt: true },
    });
    if (!row) return { success: false, error: "Hotel booking day not found." };
    if (!row.isConfirmed) return { success: false, error: "Confirm this hotel in Verify Hotels first." };

    const nextReconfirmed = row.reconfirmedAt == null;
    await db.bookingHotel.update({
        where: { id: row.id },
        data: nextReconfirmed
            ? { reconfirmedAt: new Date(), reconfirmedById: gate.member.id, reconfirmedByName: gate.member.name }
            : { reconfirmedAt: null, reconfirmedById: null, reconfirmedByName: null },
    });

    revalidateAll(bookingId);
    return { success: true, reconfirmed: nextReconfirmed };
}

export async function toggleCabReconfirmed(
    bookingId: string,
    legNumber: number,
): Promise<{ success: true; reconfirmed: boolean } | { success: false; error: string }> {
    const gate = await requireMember();
    if (!gate.ok) return { success: false, error: gate.error };

    const row = await db.bookingCab.findUnique({
        where: { bookingId_legNumber: { bookingId, legNumber } },
        select: { id: true, isConfirmed: true, reconfirmedAt: true },
    });
    if (!row) return { success: false, error: "Cab leg not found." };
    if (!row.isConfirmed) return { success: false, error: "Confirm this cab in Verify Cabs first." };

    const nextReconfirmed = row.reconfirmedAt == null;
    await db.bookingCab.update({
        where: { id: row.id },
        data: nextReconfirmed
            ? { reconfirmedAt: new Date(), reconfirmedById: gate.member.id, reconfirmedByName: gate.member.name }
            : { reconfirmedAt: null, reconfirmedById: null, reconfirmedByName: null },
    });

    revalidateAll(bookingId);
    return { success: true, reconfirmed: nextReconfirmed };
}
