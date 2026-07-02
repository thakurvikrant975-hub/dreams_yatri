"use server";

import { redirect } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import { defaultBedroom, type BedroomDetail } from "./bedroom-types";

export type { BedroomDetail } from "./bedroom-types";

export async function saveBedroomStep(
  hotelId: number,
  n: number,
  data: Partial<BedroomDetail>
): Promise<{ ok: boolean }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");

  const ownerId = session.user.id;
  const hotel = await db.hotels.findFirst({
    where: { id: hotelId, owner_id: ownerId },
    select: { id: true, hs_bedrooms: true, hs_bedroom_details: true },
  });
  if (!hotel) return { ok: false };

  const total = hotel.hs_bedrooms ?? 1;
  const idx = n - 1;
  if (idx < 0 || idx >= total) return { ok: false };

  const existing = (hotel.hs_bedroom_details as BedroomDetail[] | null) ?? [];
  const updated: BedroomDetail[] = Array.from({ length: total }, (_, i) =>
    existing[i] ?? defaultBedroom(i + 1)
  );
  updated[idx] = { ...updated[idx], ...data };

  await db.hotels.update({
    where: { id: hotelId },
    data: { hs_bedroom_details: updated },
  });

  return { ok: true };
}
