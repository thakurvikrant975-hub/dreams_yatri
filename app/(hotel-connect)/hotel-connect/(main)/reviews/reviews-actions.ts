"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";

export type ReviewItem = {
  id: number;
  hotelId: number;
  hotelName: string;
  guestName: string;
  rating: number;
  comment: string | null;
  hostResponse: string | null;
  hostResponseAt: Date | null;
  createdAt: Date;
};

export type ReviewsData = {
  reviews: ReviewItem[];
  stats: { average: number; total: number; breakdown: Record<1 | 2 | 3 | 4 | 5, number> };
  completedBookings: number;
  hasProperties: boolean;
};

export async function getOwnerReviews(): Promise<ReviewsData> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");
  const ownerId = session.user.id;

  const hotels = await db.hotels.findMany({ where: { owner_id: ownerId }, select: { id: true } });
  const hotelIds = hotels.map((h) => h.id);
  const empty: ReviewsData = {
    reviews: [], stats: { average: 0, total: 0, breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } },
    completedBookings: 0, hasProperties: hotelIds.length > 0,
  };
  if (!hotelIds.length) return empty;

  const [rawReviews, completedBookings] = await Promise.all([
    db.hotel_review.findMany({
      where: { hotel_id: { in: hotelIds } },
      orderBy: { created_at: "desc" },
      select: {
        id: true, hotel_id: true, rating: true, comment: true, guest_name: true,
        host_response: true, host_response_at: true, created_at: true,
        hotel: { select: { name: true } },
      },
    }),
    db.bookingHotel.count({ where: { hotelId: { in: hotelIds }, booking: { status: "COMPLETED" } } }),
  ]);

  const breakdown: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of rawReviews) {
    if (r.rating >= 1 && r.rating <= 5) breakdown[r.rating as 1 | 2 | 3 | 4 | 5]++;
  }
  const total = rawReviews.length;
  const average = total > 0 ? rawReviews.reduce((s, r) => s + r.rating, 0) / total : 0;

  return {
    reviews: rawReviews.map((r) => ({
      id: r.id,
      hotelId: r.hotel_id,
      hotelName: r.hotel.name,
      guestName: r.guest_name,
      rating: r.rating,
      comment: r.comment,
      hostResponse: r.host_response,
      hostResponseAt: r.host_response_at,
      createdAt: r.created_at,
    })),
    stats: { average, total, breakdown },
    completedBookings,
    hasProperties: true,
  };
}

const MAX_RESPONSE_LENGTH = 2000;

export async function respondToReview(reviewId: number, response: string): Promise<{ ok: boolean; error?: string }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");

  const trimmed = response.trim();
  if (!trimmed) return { ok: false, error: "Response can't be empty." };
  if (trimmed.length > MAX_RESPONSE_LENGTH) return { ok: false, error: `Response is too long (max ${MAX_RESPONSE_LENGTH} characters).` };

  const review = await db.hotel_review.findFirst({
    where: { id: reviewId, hotel: { owner_id: session.user.id } },
    select: { id: true },
  });
  if (!review) return { ok: false, error: "Review not found." };

  await db.hotel_review.update({
    where: { id: reviewId },
    data: { host_response: trimmed, host_response_at: new Date() },
  });

  revalidatePath("/hotel-connect/reviews");
  return { ok: true };
}
