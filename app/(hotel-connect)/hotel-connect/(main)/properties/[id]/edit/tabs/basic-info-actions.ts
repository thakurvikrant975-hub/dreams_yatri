"use server";

import { redirect } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import { basicInfoSchema, type BasicInfoState } from "./basic-info-schema";

export async function saveBasicInfo(
  hotelId: number,
  _prev: BasicInfoState,
  formData: FormData
): Promise<BasicInfoState> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");

  const raw = {
    ...Object.fromEntries(formData.entries()),
    has_channel_manager:     formData.get("has_channel_manager")     === "on",
    whatsapp_same_as_mobile: formData.get("whatsapp_same_as_mobile") === "on",
  };

  const result = basicInfoSchema.safeParse(raw);
  if (!result.success) {
    return { fieldErrors: result.error.flatten().fieldErrors as BasicInfoState["fieldErrors"] };
  }

  const d = result.data;
  const ownerId = session.user.id;

  const hotel = await db.hotels.findFirst({
    where: { id: hotelId, owner_id: ownerId },
    select: { id: true, wizard_step: true },
  });
  if (!hotel) redirect("/hotel-connect");

  try {
    await db.hotels.update({
      where: { id: hotelId },
      data: {
        name:                    d.name,
        star_rating:             d.star_rating ?? null,
        year_built:              d.year_built ?? null,
        booking_since_year:      d.booking_since_year ?? null,
        has_channel_manager:     d.has_channel_manager,
        channel_manager_name:    d.has_channel_manager ? (d.channel_manager_name || null) : null,
        contact_email:           d.contact_email          || null,
        contact_mobile_cc:       d.contact_mobile_cc,
        contact_mobile:          d.contact_mobile          || null,
        whatsapp_same_as_mobile: d.whatsapp_same_as_mobile,
        contact_whatsapp:        d.whatsapp_same_as_mobile
                                   ? (d.contact_mobile || null)
                                   : (d.contact_whatsapp || null),
        contact_landline:        d.contact_landline        || null,
        wizard_step:             Math.max(hotel.wizard_step, 2),
      },
    });
  } catch (err) {
    console.error("[saveBasicInfo]", err);
    return { error: "Couldn't save your changes. Please try again." };
  }

  return { ok: true };
}
