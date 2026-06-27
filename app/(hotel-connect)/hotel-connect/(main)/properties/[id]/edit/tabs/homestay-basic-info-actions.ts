"use server";

import { redirect } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import { homestayBasicInfoSchema, type HomestayBasicInfoState } from "./homestay-basic-info-schema";

export async function saveHomestayBasicInfo(
  hotelId: number,
  _prev: HomestayBasicInfoState,
  formData: FormData
): Promise<HomestayBasicInfoState> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");

  const raw = {
    ...Object.fromEntries(formData.entries()),
    whatsapp_same_as_mobile: formData.get("whatsapp_same_as_mobile") === "on",
  };

  const result = homestayBasicInfoSchema.safeParse(raw);
  if (!result.success) {
    return { fieldErrors: result.error.flatten().fieldErrors as HomestayBasicInfoState["fieldErrors"] };
  }

  const d = result.data;
  const ownerId = session.user.id;

  const hotel = await db.hotels.findFirst({
    where: { id: hotelId, owner_id: ownerId },
    select: { id: true, wizard_step: true },
  });
  if (!hotel) redirect("/hotel-connect");

  await db.hotels.update({
    where: { id: hotelId },
    data: {
      name:                    d.name,
      year_built:              d.year_built ?? null,
      booking_since_year:      d.booking_since_year ?? null,
      hosted_as:               d.hosted_as ?? null,
      host_lives_at_property:  d.host_lives_at_property,
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

  return { ok: true };
}
