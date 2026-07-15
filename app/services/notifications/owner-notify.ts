import "server-only";
import { db } from "@/app/lib/db";
import { ownerBookingConfirmedEmail } from "./booking-emails";
import { sendBookingEmail } from "./send";

/**
 * Hotel-owner-facing notification for a confirmed booking at their property.
 * Best-effort, mirrors booking-notify.ts's guest-facing calls: the in-app row
 * is always written (bell icon needs it regardless of email config), the
 * email is a separate best-effort send gated by NOTIFICATIONS_ENABLED inside
 * sendBookingEmail. Never call inside a tx — callers already treat this as a
 * post-commit side effect.
 */
export async function notifyOwnerBookingConfirmed(params: {
    hotelId: number;
    bookingNumber: string;
    checkInDate: Date;
    checkOutDate: Date;
    roomType: string;
    roomsCount: number;
}): Promise<void> {
    const hotel = await db.hotels.findUnique({
        where: { id: params.hotelId },
        select: { name: true, owner_id: true, owner: { select: { email: true } } },
    });
    if (!hotel || !hotel.owner_id) return;

    const isoDate = (d: Date) => d.toISOString().slice(0, 10);
    const link = "/hotel-connect/bookings";

    try {
        await db.hotelOwnerNotification.create({
            data: {
                owner_id: hotel.owner_id,
                hotel_id: params.hotelId,
                type: "BOOKING_CONFIRMED",
                title: `New confirmed booking — ${hotel.name}`,
                body: `${params.roomType} · ${isoDate(params.checkInDate)} → ${isoDate(params.checkOutDate)} · ${params.roomsCount} room${params.roomsCount === 1 ? "" : "s"}`,
                link,
            },
        });
    } catch (e) {
        console.error("[notifyOwnerBookingConfirmed] db row", e);
    }

    await sendBookingEmail(hotel.owner?.email, ownerBookingConfirmedEmail({
        hotelName: hotel.name,
        bookingNumber: params.bookingNumber,
        checkInDate: isoDate(params.checkInDate),
        checkOutDate: isoDate(params.checkOutDate),
        roomType: params.roomType,
        roomsCount: params.roomsCount,
        bookingsUrl: `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}${link}`,
    }));
}
