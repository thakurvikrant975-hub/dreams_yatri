"use server";

import { redirect } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import type { BathroomDetail, KitchenDetail, SpaceItem } from "./homestay-rooms-types";
import type { BedroomDetail } from "../bedroom/[n]/bedroom-types";

export type HomestayRoomsState = { ok?: boolean; error?: string };

export async function saveHomestayRooms(
  hotelId: number,
  _prev: HomestayRoomsState,
  _formData: FormData
): Promise<HomestayRoomsState> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");

  const ownerId = session.user.id;
  const hotel = await db.hotels.findFirst({
    where: { id: hotelId, owner_id: ownerId },
    select: {
      id: true, wizard_step: true, hs_has_kitchen: true,
      hs_bedroom_details: true, hs_bathroom_details: true,
      hs_kitchen_details: true, hs_space_items: true,
    },
  });
  if (!hotel) redirect("/hotel-connect");

  const bedrooms  = (hotel.hs_bedroom_details  as BedroomDetail[]  | null) ?? [];
  const bathrooms = (hotel.hs_bathroom_details as BathroomDetail[] | null) ?? [];
  const kitchen   = hotel.hs_kitchen_details as KitchenDetail | null;
  const spaces    = (hotel.hs_space_items      as SpaceItem[]      | null) ?? [];

  const incompleteBedrooms  = bedrooms.filter((b) => (b.step_reached ?? 0) < 4).length;
  const incompleteBathrooms = bathrooms.filter((b) => (b.step_reached ?? 0) < 1).length;
  const kitchenMissing      = hotel.hs_has_kitchen && !kitchen?.type;
  const incompleteSpaces    = spaces.filter((s) => !s.details_added).length;

  if (incompleteBedrooms > 0 || incompleteBathrooms > 0 || kitchenMissing || incompleteSpaces > 0) {
    const missing: string[] = [];
    if (incompleteBedrooms > 0) missing.push(`${incompleteBedrooms} bedroom${incompleteBedrooms > 1 ? "s" : ""}`);
    if (incompleteBathrooms > 0) missing.push(`${incompleteBathrooms} bathroom${incompleteBathrooms > 1 ? "s" : ""}`);
    if (kitchenMissing) missing.push("kitchen");
    if (incompleteSpaces > 0) missing.push(`${incompleteSpaces} additional space${incompleteSpaces > 1 ? "s" : ""}`);
    return { error: `Please add details for: ${missing.join(", ")} before continuing.` };
  }

  await db.hotels.update({
    where: { id: hotelId },
    data: { wizard_step: Math.max(hotel.wizard_step, 4) },
  });

  return { ok: true };
}
