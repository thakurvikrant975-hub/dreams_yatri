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
    select: { id: true, name: true, wizard_step: true, location_id: true },
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

    // Mirror the pinned coordinates into a HOTEL-type Location row so this
    // property's geo-point exists in the same table the rest of the app
    // (destinations, cab routes, activities) uses for location data.
    // is_active: false keeps it out of the general city/destination search
    // endpoints (app/api/locations/search's Postgres fallback path filters
    // only on is_active, not is_searchable) — this row exists purely to be
    // referenced via hotels.location_id, not to be found by name search.
    if (hotel.location_id) {
      await db.location.update({
        where: { id: hotel.location_id },
        data: { name: hotel.name, latitude, longitude },
      });
    } else {
      const hotelLocation = await db.location.create({
        data: {
          type: "HOTEL",
          name: hotel.name,
          slug: `hotel-${hotelId}`,
          latitude,
          longitude,
          is_active: false,
          is_searchable: false,
        },
        select: { id: true },
      });
      await db.hotels.update({
        where: { id: hotelId },
        data: { location_id: hotelLocation.id },
      });
    }
  } catch (err) {
    console.error("[saveLocation]", err);
    return { error: "Failed to save location. Please try again." };
  }

  redirect(`/hotel-connect/properties/${hotelId}/edit?tab=3`);
}
