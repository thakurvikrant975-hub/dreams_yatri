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

  // Defense-in-depth — the client already constrains these (Steppers, numeric
  // input filtering), but this action can be called directly with an
  // arbitrary payload, so re-check the fields with real invariants.
  const patch = { ...data };
  if (patch.base_adults != null) patch.base_adults = Math.min(50, Math.max(1, Math.trunc(patch.base_adults)));
  if (patch.max_adults != null) patch.max_adults = Math.min(50, Math.max(patch.base_adults ?? 1, Math.trunc(patch.max_adults)));
  if (patch.size_value != null && (!Number.isFinite(patch.size_value) || patch.size_value < 0)) patch.size_value = null;
  if (patch.step_reached != null) patch.step_reached = Math.min(4, Math.max(0, Math.trunc(patch.step_reached)));

  const existing = (hotel.hs_bedroom_details as BedroomDetail[] | null) ?? [];
  const updated: BedroomDetail[] = Array.from({ length: total }, (_, i) =>
    existing[i] ?? defaultBedroom(i + 1)
  );
  updated[idx] = { ...updated[idx], ...patch };

  try {
    await db.hotels.update({
      where: { id: hotelId },
      data: { hs_bedroom_details: updated },
    });
  } catch (err) {
    console.error("[saveBedroomStep]", err);
    return { ok: false };
  }

  return { ok: true };
}
