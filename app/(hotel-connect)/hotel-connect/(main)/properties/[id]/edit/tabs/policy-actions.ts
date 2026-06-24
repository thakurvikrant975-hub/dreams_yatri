"use server";

import { redirect } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import { HotelCancellationPolicy } from "@/app/generated/prisma";

export type PolicyState = { error?: string };

function parseBool(v: FormDataEntryValue | null): boolean | null {
  if (v === "yes") return true;
  if (v === "no") return false;
  return null;
}

function parseStrArray(v: FormDataEntryValue | null): string[] {
  if (!v || typeof v !== "string" || v.trim() === "") return [];
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

export async function savePolicies(
  hotelId: number,
  _prev: PolicyState,
  formData: FormData,
): Promise<PolicyState> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");

  const hotel = await db.hotels.findFirst({
    where: { id: hotelId, owner_id: session.user.id },
    select: { id: true, wizard_step: true },
  });
  if (!hotel) return { error: "Property not found." };

  const check_in_time  = (formData.get("check_in_time")  as string | null) || null;
  const check_out_time = (formData.get("check_out_time") as string | null) || null;

  const cpRaw = formData.get("cancellation_policy") as string | null;
  const cancellation_policy =
    cpRaw && Object.values(HotelCancellationPolicy).includes(cpRaw as HotelCancellationPolicy)
      ? (cpRaw as HotelCancellationPolicy)
      : null;

  const allow_unmarried_couples  = parseBool(formData.get("allow_unmarried_couples"));
  const show_couple_tag          = allow_unmarried_couples === true ? parseBool(formData.get("show_couple_tag")) : null;
  const allow_guests_below_18    = parseBool(formData.get("allow_guests_below_18"));
  const allow_male_only_groups   = parseBool(formData.get("allow_male_only_groups"));
  const allow_same_city_id       = parseBool(formData.get("allow_same_city_id"));

  const smoking_allowed          = parseBool(formData.get("smoking_allowed"));
  const parties_events_allowed   = parseBool(formData.get("parties_events_allowed"));
  const wheelchair_accessible    = parseBool(formData.get("wheelchair_accessible"));
  const allow_outside_visitors   = parseBool(formData.get("allow_outside_visitors"));

  const pets_on_property = parseBool(formData.get("pets_on_property"));
  const pets_allowed     = parseBool(formData.get("pets_allowed"));

  const allowed_pet_types     = pets_allowed === true ? parseStrArray(formData.get("allowed_pet_types"))   : [];
  const pet_extra_charges     = pets_allowed === true ? parseBool(formData.get("pet_extra_charges"))       : null;
  const pets_restricted_areas = pets_allowed === true ? (formData.get("pets_restricted_areas") as string | null) || null : null;
  const pets_without_leash    = pets_allowed === true ? parseBool(formData.get("pets_without_leash"))      : null;
  const pet_food_available    = pets_allowed === true ? parseBool(formData.get("pet_food_available"))      : null;

  const checkin_24_hours           = parseBool(formData.get("checkin_24_hours"));
  const acceptable_id_proofs       = parseStrArray(formData.get("acceptable_id_proofs"));

  const infant_free_occupancy      = parseBool(formData.get("infant_free_occupancy"));
  const infant_complimentary_food  = parseBool(formData.get("infant_complimentary_food"));
  const extra_bed_included         = parseBool(formData.get("extra_bed_included"));

  const extra_bed_adults_avail  = (formData.get("extra_bed_adults_avail") as string | null) || null;
  const extra_bed_adults_types  = extra_bed_adults_avail === "yes" ? parseStrArray(formData.get("extra_bed_adults_types")) : [];
  const extra_cot_charge_adult  = extra_bed_adults_avail === "yes" ? (formData.get("extra_cot_charge_adult") as string | null) || null : null;
  const extra_mattress_charge_adult = extra_bed_adults_avail === "yes" ? (formData.get("extra_mattress_charge_adult") as string | null) || null : null;
  const extra_sofa_charge_adult = extra_bed_adults_avail === "yes" ? (formData.get("extra_sofa_charge_adult") as string | null) || null : null;

  const extra_bed_kids_avail    = (formData.get("extra_bed_kids_avail") as string | null) || null;
  const extra_bed_kids_types    = extra_bed_kids_avail === "yes" ? parseStrArray(formData.get("extra_bed_kids_types")) : [];
  const extra_cot_charge_child  = extra_bed_kids_avail === "yes" ? (formData.get("extra_cot_charge_child") as string | null) || null : null;
  const extra_mattress_charge_child = extra_bed_kids_avail === "yes" ? (formData.get("extra_mattress_charge_child") as string | null) || null : null;
  const extra_sofa_charge_child = extra_bed_kids_avail === "yes" ? (formData.get("extra_sofa_charge_child") as string | null) || null : null;
  const extra_crib_charge_child = extra_bed_kids_avail === "yes" ? (formData.get("extra_crib_charge_child") as string | null) || null : null;

  const provide_bed_extra_adults = extra_bed_adults_avail === "yes" ? true : extra_bed_adults_avail === "no" ? false : null;
  const provide_bed_extra_kids   = extra_bed_kids_avail   === "yes" ? true : extra_bed_kids_avail   === "no" ? false : null;

  const meal_price_breakfast = (formData.get("meal_price_breakfast") as string | null) || null;
  const meal_price_lunch     = (formData.get("meal_price_lunch")     as string | null) || null;
  const meal_price_dinner    = (formData.get("meal_price_dinner")    as string | null) || null;

  await db.hotels.update({
    where: { id: hotelId },
    data: {
      check_in_time,
      check_out_time,
      cancellation_policy,
      allow_unmarried_couples,
      show_couple_tag,
      allow_guests_below_18,
      allow_male_only_groups,
      allow_same_city_id,
      smoking_allowed,
      parties_events_allowed,
      wheelchair_accessible,
      allow_outside_visitors,
      pets_on_property,
      pets_allowed,
      allowed_pet_types,
      pet_extra_charges,
      pets_restricted_areas,
      pets_without_leash,
      pet_food_available,
      checkin_24_hours,
      acceptable_id_proofs,
      infant_free_occupancy,
      infant_complimentary_food,
      extra_bed_included,
      provide_bed_extra_adults,
      provide_bed_extra_kids,
      extra_bed_adults_avail,
      extra_bed_adults_types,
      extra_cot_charge_adult,
      extra_mattress_charge_adult,
      extra_sofa_charge_adult,
      extra_bed_kids_avail,
      extra_bed_kids_types,
      extra_cot_charge_child,
      extra_mattress_charge_child,
      extra_sofa_charge_child,
      extra_crib_charge_child,
      meal_price_breakfast,
      meal_price_lunch,
      meal_price_dinner,
      wizard_step: Math.max(hotel.wizard_step, 6),
    },
  });

  redirect(`/hotel-connect/properties/${hotelId}/edit?tab=7`);
}
