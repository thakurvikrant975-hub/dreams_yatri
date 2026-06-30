"use server";

import { redirect } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import { locationSchema, type LocationState } from "./location-schema";

export async function saveLocation(
  hotelId: number,
  _prev: LocationState,
  formData: FormData,
): Promise<LocationState> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");

  const raw = {
    address:   formData.get("address"),
    landmark:  formData.get("landmark") || "",
    city:      formData.get("city"),
    state:     formData.get("state"),
    country:   formData.get("country"),
    pincode:   formData.get("pincode"),
    latitude:  formData.get("latitude"),
    longitude: formData.get("longitude"),
  };

  const parsed = locationSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { address, landmark, city, state, country, pincode, latitude, longitude } = parsed.data;

  const hotel = await db.hotels.findFirst({
    where: { id: hotelId, owner_id: session.user.id },
    select: { id: true, wizard_step: true },
  });
  if (!hotel) return { error: "Property not found." };

  try {
    await db.hotels.update({
      where: { id: hotelId },
      data: {
        address,
        landmark: landmark || null,
        city,
        state,
        country,
        pincode,
        latitude,
        longitude,
        wizard_step: Math.max(hotel.wizard_step, 3),
      },
    });
  } catch (err) {
    console.error("[saveLocation]", err);
    return { error: "Failed to save location. Please try again." };
  }

  redirect(`/hotel-connect/properties/${hotelId}/edit?tab=3`);
}
