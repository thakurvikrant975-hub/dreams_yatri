"use server";

import { redirect } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";

export async function submitForReview(hotelId: number) {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");

  const hotel = await db.hotels.findFirst({
    where: { id: hotelId, owner_id: session.user.id },
    select: { id: true, listing_status: true, wizard_step: true },
  });

  if (!hotel || hotel.listing_status !== "DRAFT" || hotel.wizard_step < 6) return;

  await db.hotels.update({
    where: { id: hotelId },
    data: {
      listing_status: "SUBMITTED",
      submitted_at: new Date(),
    },
  });

  redirect(`/hotel-connect/properties/${hotelId}/edit?tab=6`);
}
