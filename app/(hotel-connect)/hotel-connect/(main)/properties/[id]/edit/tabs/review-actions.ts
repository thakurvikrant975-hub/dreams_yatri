"use server";

import { redirect } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";

export async function submitForReview(hotelId: number) {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");

  const hotel = await db.hotels.findFirst({
    where: { id: hotelId, owner_id: session.user.id },
    select: { id: true, listing_status: true, wizard_step: true, property_category: true },
  });

  const requiredStep = hotel?.property_category === "HOMESTAY_VILLA" ? 8 : 7;
  if (!hotel || hotel.listing_status !== "DRAFT" || hotel.wizard_step < requiredStep) return;

  await db.hotels.update({
    where: { id: hotelId },
    data: {
      listing_status: "SUBMITTED",
      submitted_at: new Date(),
    },
  });

  const lastTab = requiredStep;
  redirect(`/hotel-connect/properties/${hotelId}/edit?tab=${lastTab}`);
}
