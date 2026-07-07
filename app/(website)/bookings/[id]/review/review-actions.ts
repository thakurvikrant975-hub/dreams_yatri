"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/app/lib/db";
import { getAuthenticatedUser } from "@/app/lib/functions/getAuthenticatedUser";

const MAX_COMMENT_LENGTH = 2000;

export type SubmitReviewResult = { ok: boolean; error?: string };

export async function submitHotelReview(
  bookingId: string,
  hotelId: number,
  rating: number,
  comment: string,
): Promise<SubmitReviewResult> {
  const user = await getAuthenticatedUser();
  if (!user?.id) return { ok: false, error: "Please log in to leave a review." };

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: "Rating must be between 1 and 5." };
  }
  const trimmedComment = comment.trim().slice(0, MAX_COMMENT_LENGTH);

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      userId: true,
      status: true,
      contactEmail: true,
      travellersList: { where: { isLead: true }, take: 1, select: { fullName: true, firstName: true } },
      hotelBookings: { where: { hotelId }, select: { id: true }, take: 1 },
    },
  });
  if (!booking || booking.userId !== user.id) return { ok: false, error: "Booking not found." };
  if (booking.status !== "COMPLETED") return { ok: false, error: "You can only review completed stays." };
  if (booking.hotelBookings.length === 0) return { ok: false, error: "This property isn't part of your booking." };

  const existing = await db.hotel_review.findUnique({
    where: { booking_id_hotel_id: { booking_id: bookingId, hotel_id: hotelId } },
    select: { id: true },
  });
  if (existing) return { ok: false, error: "You've already reviewed this stay." };

  const lead = booking.travellersList[0];
  const guestName = lead?.fullName ?? lead?.firstName ?? user.name ?? booking.contactEmail ?? "Guest";

  try {
    await db.hotel_review.create({
      data: {
        hotel_id: hotelId,
        booking_id: bookingId,
        user_id: user.id,
        rating,
        comment: trimmedComment || null,
        guest_name: guestName,
      },
    });
  } catch (err) {
    console.error("[submitHotelReview]", err);
    return { ok: false, error: "Failed to submit review. Please try again." };
  }

  revalidatePath(`/bookings/${bookingId}/review`);
  return { ok: true };
}
