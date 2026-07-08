"use server";

import { redirect } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import { PropertySubType, PropertyCategory } from "@/app/generated/prisma";

const CATEGORY_MAP: Record<PropertySubType, PropertyCategory> = {
  // Hotel category
  HOTEL:       PropertyCategory.HOTEL,
  RESORT:      PropertyCategory.HOTEL,
  LODGE:       PropertyCategory.HOTEL,
  GUEST_HOUSE: PropertyCategory.HOTEL,
  PALACE:      PropertyCategory.HOTEL,
  HOUSEBOAT:   PropertyCategory.HOTEL,
  MOTEL:       PropertyCategory.HOTEL,
  // Homestays & Villas category
  VILLA:            PropertyCategory.HOMESTAY_VILLA,
  HOMESTAY:         PropertyCategory.HOMESTAY_VILLA,
  COTTAGE:          PropertyCategory.HOMESTAY_VILLA,
  APARTMENT:        PropertyCategory.HOMESTAY_VILLA,
  APART_HOTEL:      PropertyCategory.HOMESTAY_VILLA,
  HOSTEL:           PropertyCategory.HOMESTAY_VILLA,
  BED_AND_BREAKFAST: PropertyCategory.HOMESTAY_VILLA,
  FARMHOUSE:        PropertyCategory.HOMESTAY_VILLA,
  CAMP:             PropertyCategory.HOMESTAY_VILLA,
  BEACH_HUT:        PropertyCategory.HOMESTAY_VILLA,
  TREEHOUSE:        PropertyCategory.HOMESTAY_VILLA,
  DHARAMSHALA:      PropertyCategory.HOMESTAY_VILLA,
  ASHRAM:           PropertyCategory.HOMESTAY_VILLA,
  HOLIDAY_HOME:     PropertyCategory.HOMESTAY_VILLA,
  RV:               PropertyCategory.HOMESTAY_VILLA,
  LUXURY_CAMPS:     PropertyCategory.HOMESTAY_VILLA,
};

export async function createDraftProperty(
  subType: PropertySubType,
): Promise<{ error?: string }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");

  const ownerId = session.user.id;

  const ownerExists = await db.hotelOwner.findUnique({
    where: { id: ownerId },
    select: { id: true },
  });
  if (!ownerExists) redirect("/hotel-connect/login");

  const slug = `draft-${ownerId.slice(-8)}-${Date.now()}`;

  let hotelId: number;
  try {
    const hotel = await db.hotels.create({
      data: {
        name: "My Property",
        slug,
        owner_id: ownerId,
        property_sub_type: subType,
        property_category: CATEGORY_MAP[subType],
        listing_status: "DRAFT",
        wizard_step: 1,
      },
      select: { id: true },
    });
    hotelId = hotel.id;
  } catch (err) {
    console.error("[createDraftProperty]", err);
    return { error: "Failed to create your listing. Please try again." };
  }

  redirect(`/hotel-connect/properties/${hotelId}/edit`);
}
