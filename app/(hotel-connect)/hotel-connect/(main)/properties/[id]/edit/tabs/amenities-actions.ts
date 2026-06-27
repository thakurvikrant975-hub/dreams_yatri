"use server";

import { redirect } from "next/navigation";
import { Prisma } from "@/app/generated/prisma/client";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import { ALL_AMENITY_KEYS } from "./amenities-data";

export type AmenitiesState = { ok?: boolean; error?: string };

export async function saveAmenities(
  hotelId: number,
  _prev: AmenitiesState,
  formData: FormData,
): Promise<AmenitiesState> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");

  let raw: Record<string, unknown> = {};
  try {
    raw = JSON.parse(formData.get("amenities_json") as string ?? "{}");
  } catch {
    return { error: "Invalid amenities data." };
  }

  // Validate and keep only known amenity keys with valid values
  const property_amenities: Record<string, Prisma.InputJsonValue> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (!ALL_AMENITY_KEYS.has(key)) continue;

    if (typeof val === "boolean") {
      property_amenities[key] = val;
    } else if (
      val !== null &&
      typeof val === "object" &&
      (val as Record<string, unknown>).yes === true
    ) {
      const v = val as Record<string, unknown>;
      if (typeof v.detail === "string") {
        property_amenities[key] = { yes: true, detail: v.detail };
      } else if (Array.isArray(v.pools)) {
        property_amenities[key] = { yes: true, pools: v.pools };
      } else if (Array.isArray(v.selections)) {
        property_amenities[key] = { yes: true, selections: v.selections.filter((s) => typeof s === "string") };
      } else if ("f1" in v || "f2" in v) {
        const out: Record<string, Prisma.InputJsonValue> = { yes: true };
        if ("f1" in v) {
          if (typeof v.f1 === "string") out.f1 = v.f1;
          else if (Array.isArray(v.f1)) out.f1 = (v.f1 as unknown[]).filter((s) => typeof s === "string") as string[];
        }
        if ("f2" in v) {
          if (typeof v.f2 === "string") out.f2 = v.f2;
          else if (Array.isArray(v.f2)) out.f2 = (v.f2 as unknown[]).filter((s) => typeof s === "string") as string[];
        }
        property_amenities[key] = out as Prisma.InputJsonValue;
      }
    }
  }

  const hotel = await db.hotels.findFirst({
    where: { id: hotelId, owner_id: session.user.id },
    select: { id: true, wizard_step: true },
  });
  if (!hotel) return { error: "Property not found." };

  await db.hotels.update({
    where: { id: hotelId },
    data: {
      property_amenities,
      wizard_step: Math.max(3, hotel.wizard_step),
    },
  });

  return { ok: true };
}
