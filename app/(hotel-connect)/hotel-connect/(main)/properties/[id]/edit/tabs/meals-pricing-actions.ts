"use server";

import { redirect } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";

export type MealsPricingState = { error?: string };

function parseIntField(v: FormDataEntryValue | null): number | null {
  if (!v || typeof v !== "string" || v.trim() === "") return null;
  const n = parseInt(v.trim(), 10);
  return isNaN(n) ? null : n;
}

function parseDecimalField(v: FormDataEntryValue | null): string | null {
  if (!v || typeof v !== "string" || v.trim() === "") return null;
  const n = parseFloat(v.trim());
  return isNaN(n) ? null : n.toFixed(2);
}

function parseDateField(v: FormDataEntryValue | null): Date | null {
  if (!v || typeof v !== "string" || v.trim() === "") return null;
  const d = new Date(v.trim());
  return isNaN(d.getTime()) ? null : d;
}

export async function saveMealsPricing(
  hotelId: number,
  _prev: MealsPricingState,
  formData: FormData,
): Promise<MealsPricingState> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");

  const hotel = await db.hotels.findFirst({
    where: { id: hotelId, owner_id: session.user.id },
    select: { id: true, wizard_step: true },
  });
  if (!hotel) return { error: "Property not found." };

  const prop_num_units      = parseIntField(formData.get("prop_num_units")) ?? 1;
  const prop_meal_option    = (formData.get("prop_meal_option") as string | null) || null;
  const prop_base_occupancy = parseIntField(formData.get("prop_base_occupancy"));
  const prop_max_adults     = parseIntField(formData.get("prop_max_adults"));
  const prop_max_children   = parseIntField(formData.get("prop_max_children"));
  const prop_max_occupancy  = parseIntField(formData.get("prop_max_occupancy"));
  const prop_avail_from     = parseDateField(formData.get("prop_avail_from"));
  const prop_avail_to       = parseDateField(formData.get("prop_avail_to"));
  const prop_base_rate      = parseDecimalField(formData.get("prop_base_rate"));
  const prop_extra_adult    = parseDecimalField(formData.get("prop_extra_adult"));
  const prop_child_rate     = parseDecimalField(formData.get("prop_child_rate"));

  await db.hotels.update({
    where: { id: hotelId },
    data: {
      prop_num_units,
      prop_meal_option,
      prop_base_occupancy,
      prop_max_adults,
      prop_max_children,
      prop_max_occupancy,
      prop_avail_from,
      prop_avail_to,
      prop_base_rate:   prop_base_rate   ?? undefined,
      prop_extra_adult: prop_extra_adult ?? undefined,
      prop_child_rate:  prop_child_rate  ?? undefined,
      wizard_step: Math.max(hotel.wizard_step, 6),
    },
  });

  redirect(`/hotel-connect/properties/${hotelId}/edit?tab=7`);
}
