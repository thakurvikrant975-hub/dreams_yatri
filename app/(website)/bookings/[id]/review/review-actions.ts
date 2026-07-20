"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/app/lib/db";
import { getAuthenticatedUser } from "@/app/lib/functions/getAuthenticatedUser";
import { notifyOwnerReviewReceived } from "@/app/services/notifications/owner-notify";
import { uploadToR2 } from "@/app/lib/r2/r2upload";
import { deleteFromR2 } from "@/app/lib/r2/r2delete";
import { describeSizeRejection, describeTypeRejection } from "@/app/lib/upload-errors";

const MAX_COMMENT_LENGTH = 2000;
const MAX_REVIEW_PHOTOS = 6;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10MB per photo
const ALLOWED_TYPE_PREFIXES = ["image/"];

export type SubmitReviewResult = { ok: boolean; error?: string };

/** Uploads valid photos to R2, best-effort — rejected/failed files are silently dropped (not fatal to the review). */
async function uploadReviewPhotos(files: File[]): Promise<string[]> {
  const valid = files
    .filter((f) => f.size > 0)
    .filter((f) => f.size <= MAX_PHOTO_BYTES && ALLOWED_TYPE_PREFIXES.some((p) => f.type.startsWith(p)))
    .slice(0, MAX_REVIEW_PHOTOS);

  const urls: string[] = [];
  for (const file of valid) {
    let uploadedKey: string | null = null;
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const { key, url } = await uploadToR2({
        file: buffer,
        folder: "hotel-reviews",
        fileName: file.name,
        contentType: file.type || "image/jpeg",
      });
      uploadedKey = key;
      urls.push(url);
    } catch (err) {
      console.error("[submitHotelReview] photo upload failed:", file.name, err);
      if (uploadedKey) await deleteFromR2(uploadedKey).catch(() => {});
    }
  }
  return urls;
}

export async function submitHotelReview(
  bookingId: string,
  hotelId: number,
  rating: number,
  comment: string,
  formData?: FormData,
): Promise<SubmitReviewResult> {
  const user = await getAuthenticatedUser();
  if (!user?.id) return { ok: false, error: "Please log in to leave a review." };

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: "Rating must be between 1 and 5." };
  }
  const trimmedComment = comment.trim().slice(0, MAX_COMMENT_LENGTH);

  const files = (formData?.getAll("photos") as File[] | undefined)?.filter((f) => f.size > 0) ?? [];
  const oversized = files.find((f) => f.size > MAX_PHOTO_BYTES);
  if (oversized) return { ok: false, error: `Can't upload ${describeSizeRejection(oversized, MAX_PHOTO_BYTES)}.` };
  const wrongType = files.find((f) => !ALLOWED_TYPE_PREFIXES.some((p) => f.type.startsWith(p)));
  if (wrongType) return { ok: false, error: `Can't upload ${describeTypeRejection(wrongType)} — only images are allowed.` };

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

  const imageUrls = files.length > 0 ? await uploadReviewPhotos(files) : [];

  try {
    await db.hotel_review.create({
      data: {
        hotel_id: hotelId,
        booking_id: bookingId,
        user_id: user.id,
        rating,
        comment: trimmedComment || null,
        guest_name: guestName,
        images: imageUrls,
      },
    });
  } catch (err) {
    console.error("[submitHotelReview]", err);
    return { ok: false, error: "Failed to submit review. Please try again." };
  }

  try {
    await notifyOwnerReviewReceived({ hotelId, guestName, rating, comment: trimmedComment || null });
  } catch (err) {
    console.error("[submitHotelReview] owner notify", err);
  }

  revalidatePath(`/bookings/${bookingId}/review`);
  return { ok: true };
}
