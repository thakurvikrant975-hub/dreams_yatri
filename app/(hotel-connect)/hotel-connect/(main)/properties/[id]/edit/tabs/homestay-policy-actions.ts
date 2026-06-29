"use server";

import { redirect } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import { HotelCancellationPolicy } from "@/app/generated/prisma";

export type HomestayPolicyState = { error?: string };

function parseBool(v: FormDataEntryValue | null): boolean | null {
  if (v === "yes") return true;
  if (v === "no") return false;
  return null;
}

function parseStrArray(v: FormDataEntryValue | null): string[] {
  if (!v || typeof v !== "string" || v.trim() === "") return [];
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

export async function saveHomestayPolicy(
  hotelId: number,
  _prev: HomestayPolicyState,
  formData: FormData,
): Promise<HomestayPolicyState> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");

  const hotel = await db.hotels.findFirst({
    where: { id: hotelId, owner_id: session.user.id },
    select: { id: true, wizard_step: true },
  });
  if (!hotel) return { error: "Property not found." };

  const cpRaw = formData.get("cancellation_policy") as string | null;
  const cancellation_policy =
    cpRaw && Object.values(HotelCancellationPolicy).includes(cpRaw as HotelCancellationPolicy)
      ? (cpRaw as HotelCancellationPolicy)
      : null;

  await db.hotels.update({
    where: { id: hotelId },
    data: {
      // Check-in/out times
      check_in_time:         (formData.get("check_in_time")  as string | null) || null,
      check_out_time:        (formData.get("check_out_time") as string | null) || null,
      has_check_in_end_time: parseBool(formData.get("has_check_in_end_time")),
      check_in_end_time:     (formData.get("check_in_end_time") as string | null) || null,
      // Cancellation
      cancellation_policy,
      // Guest profile
      allow_unmarried_couples: parseBool(formData.get("allow_unmarried_couples")),
      show_couple_tag:         parseBool(formData.get("show_couple_tag")),
      allow_guests_below_18:   parseBool(formData.get("allow_guests_below_18")),
      allow_male_only_groups:  parseBool(formData.get("allow_male_only_groups")),
      acceptable_id_proofs:    parseStrArray(formData.get("acceptable_id_proofs")),
      allow_same_city_id:      parseBool(formData.get("allow_same_city_id")),
      // Property restrictions
      smoking_allowed:          parseBool(formData.get("smoking_allowed")),
      smoking_areas:            (formData.get("smoking_areas") as string | null) || null,
      parties_events_allowed:   parseBool(formData.get("parties_events_allowed")),
      wheelchair_accessible:    parseBool(formData.get("wheelchair_accessible")),
      entry_exit_restrictions:  parseBool(formData.get("entry_exit_restrictions")),
      allow_outside_visitors:   parseBool(formData.get("allow_outside_visitors")),
      noise_policy:             (formData.get("noise_policy") as string | null) || null,
      // Pet policy
      pets_on_property:   parseBool(formData.get("pets_on_property")),
      pets_allowed:       parseBool(formData.get("pets_allowed")),
      allowed_pet_types:  parseStrArray(formData.get("allowed_pet_types")),
      pet_extra_charges:  parseBool(formData.get("pet_extra_charges")),
      pet_charge_amount:  (formData.get("pet_charge_amount") as string | null) || null,
      pet_food_available: parseBool(formData.get("pet_food_available")),
      pets_restricted_areas: (formData.get("pets_restricted_areas") as string | null) || null,
      pets_without_leash: parseBool(formData.get("pets_without_leash")),
      pet_count:          formData.get("pet_count") ? parseInt(formData.get("pet_count") as string, 10) || null : null,
      // Food & kitchen
      food_kitchen_available: parseBool(formData.get("food_kitchen_available")),
      // Caretaker
      caretaker_stays:          parseBool(formData.get("caretaker_stays")),
      caretaker_details:        (formData.get("caretaker_details") as string | null) || null,
      caretaker_availability:   (formData.get("caretaker_availability") as string | null) || null,
      caretaker_services:       parseStrArray(formData.get("caretaker_services")),
      caretaker_knowledge:      parseStrArray(formData.get("caretaker_knowledge")),
      caretaker_helps_cleaning: parseBool(formData.get("caretaker_helps_cleaning")),
      // Key exchange
      self_checkin_smart_door: parseBool(formData.get("self_checkin_smart_door")),
      host_greets_helps:       parseBool(formData.get("host_greets_helps")),
      caretaker_greets_helps:  parseBool(formData.get("caretaker_greets_helps")),
      building_staff_keys:     parseBool(formData.get("building_staff_keys")),
      // 24-hour check-in
      checkin_24_hours: parseBool(formData.get("checkin_24_hours")),
      // Custom policy
      custom_policy: (formData.get("custom_policy") as string | null) || null,
      // Step
      wizard_step: Math.max(hotel.wizard_step, 7),
    },
  });

  redirect(`/hotel-connect/properties/${hotelId}/edit?tab=8`);
}
