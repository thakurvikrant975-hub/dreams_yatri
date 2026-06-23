"use server";

import { redirect } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import { PropertySubType, PropertyCategory } from "@/app/generated/prisma";

const CATEGORY_MAP: Record<PropertySubType, PropertyCategory> = {
  HOTEL:       PropertyCategory.HOTEL,
  RESORT:      PropertyCategory.HOTEL,
  GUEST_HOUSE: PropertyCategory.HOTEL,
  HOUSEBOAT:   PropertyCategory.HOTEL,
  HOMESTAY:    PropertyCategory.HOMESTAY_VILLA,
  VILLA:       PropertyCategory.HOMESTAY_VILLA,
  APARTMENT:   PropertyCategory.HOMESTAY_VILLA,
};

export async function createDraftProperty(subType: PropertySubType) {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");

  const ownerId = session.user.id;

  const ownerExists = await db.hotelOwner.findUnique({
    where: { id: ownerId },
    select: { id: true },
  });
  if (!ownerExists) redirect("/hotel-connect/login");

  const slug = `draft-${ownerId.slice(-8)}-${Date.now()}`;

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

  redirect(`/hotel-connect/properties/${hotel.id}/edit`);
}
