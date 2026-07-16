import "server-only";
import { db } from "@/app/lib/db";
import { ownerBookingConfirmedEmail, ownerBookingCancelledEmail, ownerReviewReceivedEmail } from "./booking-emails";
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

/**
 * Hotel-owner-facing notification when a guest cancels a booking at their
 * property. One notification per affected hotel — a package booking can
 * span multiple hotels, each owner only needs to hear about their own stay.
 */
export async function notifyOwnerBookingCancelled(params: {
    hotelId: number;
    bookingNumber: string;
    checkInDate: Date;
    checkOutDate: Date;
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
                type: "BOOKING_CANCELLED",
                title: `Booking cancelled — ${hotel.name}`,
                body: `${isoDate(params.checkInDate)} → ${isoDate(params.checkOutDate)}`,
                link,
            },
        });
    } catch (e) {
        console.error("[notifyOwnerBookingCancelled] db row", e);
    }

    await sendBookingEmail(hotel.owner?.email, ownerBookingCancelledEmail({
        hotelName: hotel.name,
        bookingNumber: params.bookingNumber,
        checkInDate: isoDate(params.checkInDate),
        checkOutDate: isoDate(params.checkOutDate),
        bookingsUrl: `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}${link}`,
    }));
}

/** Hotel-owner-facing notification when a guest submits a review for their property. */
export async function notifyOwnerReviewReceived(params: {
    hotelId: number;
    guestName: string;
    rating: number;
    comment: string | null;
}): Promise<void> {
    const hotel = await db.hotels.findUnique({
        where: { id: params.hotelId },
        select: { name: true, owner_id: true, owner: { select: { email: true } } },
    });
    if (!hotel || !hotel.owner_id) return;

    const link = "/hotel-connect/reviews";

    try {
        await db.hotelOwnerNotification.create({
            data: {
                owner_id: hotel.owner_id,
                hotel_id: params.hotelId,
                type: "REVIEW_RECEIVED",
                title: `New ${params.rating}-star review — ${hotel.name}`,
                body: `${params.guestName}${params.comment ? `: "${params.comment.slice(0, 120)}${params.comment.length > 120 ? "…" : ""}"` : ""}`,
                link,
            },
        });
    } catch (e) {
        console.error("[notifyOwnerReviewReceived] db row", e);
    }

    await sendBookingEmail(hotel.owner?.email, ownerReviewReceivedEmail({
        hotelName: hotel.name,
        guestName: params.guestName,
        rating: params.rating,
        comment: params.comment,
        reviewsUrl: `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}${link}`,
    }));
}
