"use server";

import { redirect } from "next/navigation";
import { Prisma } from "@/app/generated/prisma/client";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import {
  ALL_AMENITY_KEYS, MANDATORY_CONFIG, GUEST_HOUSE_MANDATORY_CONFIG,
} from "./amenities-data";

export type AmenitiesState = { ok?: boolean; error?: string };

const MAX_STRING_LENGTH = 500;
const MAX_ARRAY_LENGTH = 30;

function capString(s: string): string {
  return s.slice(0, MAX_STRING_LENGTH);
}
function capArray(arr: string[]): string[] {
  return arr.slice(0, MAX_ARRAY_LENGTH).map(capString);
}

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
        property_amenities[key] = { yes: true, detail: capString(v.detail) };
      } else if (Array.isArray(v.pools)) {
        // Each pool needs the same fields SwimmingPoolModal itself requires
        // client-side (name/type/suitableFor) — a bypassed call shouldn't be
        // able to persist a pool that renders blank on the public listing.
        const pools = v.pools
          .filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null)
          .filter((p) => typeof p.id === "string" && typeof p.name === "string" && p.name.trim().length > 0
            && typeof p.type === "string" && p.type.trim().length > 0
            && typeof p.suitableFor === "string" && p.suitableFor.trim().length > 0)
          .slice(0, MAX_ARRAY_LENGTH)
          .map((p) => ({ ...p, name: capString(p.name as string) }));
        property_amenities[key] = { yes: true, pools: pools as Prisma.InputJsonValue[] };
      } else if (Array.isArray(v.selections)) {
        property_amenities[key] = { yes: true, selections: capArray(v.selections.filter((s) => typeof s === "string")) };
      } else if ("f1" in v || "f2" in v) {
        const out: Record<string, Prisma.InputJsonValue> = { yes: true };
        if ("f1" in v) {
          if (typeof v.f1 === "string") out.f1 = capString(v.f1);
          else if (Array.isArray(v.f1)) out.f1 = capArray((v.f1 as unknown[]).filter((s) => typeof s === "string") as string[]);
        }
        if ("f2" in v) {
          if (typeof v.f2 === "string") out.f2 = capString(v.f2);
          else if (Array.isArray(v.f2)) out.f2 = capArray((v.f2 as unknown[]).filter((s) => typeof s === "string") as string[]);
        }
        property_amenities[key] = out as Prisma.InputJsonValue;
      }
    }
  }

  const hotel = await db.hotels.findFirst({
    where: { id: hotelId, owner_id: session.user.id },
    select: { id: true, wizard_step: true, property_sub_type: true },
  });
  if (!hotel) return { error: "Property not found." };

  // Mirrors AmenitiesTab's own client-side gate — re-checked here so a
  // direct call to this action can't persist a listing with the mandatory
  // section left blank or under-answered.
  const mandatoryConfig = hotel.property_sub_type === "GUEST_HOUSE" ? GUEST_HOUSE_MANDATORY_CONFIG : MANDATORY_CONFIG;
  const isYes = (v: unknown) => v === true || (typeof v === "object" && v !== null && (v as Record<string, unknown>).yes === true);
  const unanswered = mandatoryConfig.filter((c) => property_amenities[c.name] === undefined);
  const yesCount = mandatoryConfig.filter((c) => isYes(property_amenities[c.name])).length;
  if (unanswered.length > 0) {
    return { error: `${unanswered.length} mandatory amenit${unanswered.length === 1 ? "y has" : "ies have"} no answer.` };
  }
  if (yesCount < 3) {
    return { error: `At least 3 mandatory amenities must be marked "Yes" (currently ${yesCount}).` };
  }

  try {
    await db.hotels.update({
      where: { id: hotelId },
      data: {
        property_amenities,
        wizard_step: Math.max(hotel.wizard_step, 4),
      },
    });
  } catch (err) {
    console.error("[saveAmenities]", err);
    return { error: "Failed to save amenities. Please try again." };
  }

  redirect(`/hotel-connect/properties/${hotelId}/edit?tab=4`);
}
