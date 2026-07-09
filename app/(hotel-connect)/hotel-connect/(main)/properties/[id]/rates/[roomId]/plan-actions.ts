"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import { ownsRoom } from "@/app/lib/hotel-inventory/owns-room";
import { HotelCancellationPolicy } from "@/app/generated/prisma";

// ── List ──────────────────────────────────────────────────────────────────────

export type RatePlanSummary = {
  id: number;
  planName: string | null;
  mealTypeId: number | null;
  mealTypeName: string | null;
  dietTypeId: number | null;
  dietTypeName: string | null;
  cancellationPolicy: HotelCancellationPolicy | null;
  gstPercentage: number;
  basePrice: number;
  isActive: boolean;
  sortOrder: number;
};

export async function listRatePlans(
  hotelId: number,
  roomId: number,
): Promise<{ error?: string; plans?: RatePlanSummary[] }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");
  if (!(await ownsRoom(hotelId, roomId, session.user.id))) return { error: "Room not found." };

  // Not filtered to is_active — deactivated plans are still shown (greyed out,
  // with a reactivate action) rather than disappearing entirely.
  const rows = await db.hotel_room_pricing.findMany({
    where: { room_id: roomId },
    orderBy: { sort_order: "asc" },
    select: {
      id: true, plan_name: true, meal_type_id: true, diet_type_id: true,
      cancellation_policy: true, gst_percentage: true, price_per_night: true,
      is_active: true, sort_order: true,
      meal_type: { select: { name: true } },
      diet_type: { select: { name: true } },
    },
  });

  return {
    plans: rows.map((r) => ({
      id: r.id,
      planName: r.plan_name,
      mealTypeId: r.meal_type_id,
      mealTypeName: r.meal_type?.name ?? null,
      dietTypeId: r.diet_type_id,
      dietTypeName: r.diet_type?.name ?? null,
      cancellationPolicy: r.cancellation_policy,
      gstPercentage: Number(r.gst_percentage),
      basePrice: Number(r.price_per_night),
      isActive: r.is_active,
      sortOrder: r.sort_order,
    })),
  };
}

// ── Create / update identity ─────────────────────────────────────────────────

export type RatePlanInput = {
  planName: string;
  mealTypeId: number | null;
  dietTypeId: number | null;
  cancellationPolicy: HotelCancellationPolicy | null; // null = inherit hotel-level default
  gstPercentage: number;
  basePrice: number;
};

function validateRatePlanInput(input: RatePlanInput): string | null {
  if (!input.planName.trim()) return "Rate plan name is required.";
  if (!Number.isFinite(input.gstPercentage) || input.gstPercentage < 0 || input.gstPercentage > 100) {
    return "GST % must be between 0 and 100.";
  }
  if (!Number.isFinite(input.basePrice) || input.basePrice <= 0) {
    return "Base rate is required and must be a positive number.";
  }
  return null;
}

export async function createRatePlan(
  hotelId: number,
  roomId: number,
  input: RatePlanInput,
): Promise<{ error?: string; planId?: number }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");
  if (!(await ownsRoom(hotelId, roomId, session.user.id))) return { error: "Room not found." };

  const validationError = validateRatePlanInput(input);
  if (validationError) return { error: validationError };

  const maxSort = await db.hotel_room_pricing.aggregate({
    where: { room_id: roomId },
    _max: { sort_order: true },
  });

  const created = await db.hotel_room_pricing.create({
    data: {
      hotel_id: hotelId,
      room_id: roomId,
      plan_name: input.planName.trim(),
      meal_type_id: input.mealTypeId,
      diet_type_id: input.dietTypeId,
      cancellation_policy: input.cancellationPolicy,
      gst_percentage: input.gstPercentage,
      price_per_night: input.basePrice,
      sort_order: (maxSort._max.sort_order ?? -1) + 1,
      is_active: true,
    },
    select: { id: true },
  });

  revalidatePath(`/hotel-connect/properties/${hotelId}/rates`);
  revalidatePath(`/hotel-connect/properties/${hotelId}/calendar`);
  return { planId: created.id };
}

export async function updateRatePlanDetails(
  hotelId: number,
  roomId: number,
  pricingId: number,
  input: RatePlanInput,
): Promise<{ error?: string }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");
  if (!(await ownsRoom(hotelId, roomId, session.user.id))) return { error: "Room not found." };

  const validationError = validateRatePlanInput(input);
  if (validationError) return { error: validationError };

  const pricing = await db.hotel_room_pricing.findFirst({
    where: { id: pricingId, room_id: roomId },
    select: { id: true },
  });
  if (!pricing) return { error: "Rate plan not found." };

  await db.hotel_room_pricing.update({
    where: { id: pricingId },
    data: {
      plan_name: input.planName.trim(),
      meal_type_id: input.mealTypeId,
      diet_type_id: input.dietTypeId,
      cancellation_policy: input.cancellationPolicy,
      gst_percentage: input.gstPercentage,
      price_per_night: input.basePrice,
    },
  });

  revalidatePath(`/hotel-connect/properties/${hotelId}/rates`);
  revalidatePath(`/hotel-connect/properties/${hotelId}/calendar`);
  return {};
}

// ── Activate / deactivate ────────────────────────────────────────────────────

export async function setRatePlanActive(
  hotelId: number,
  roomId: number,
  pricingId: number,
  active: boolean,
): Promise<{ error?: string }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");
  if (!(await ownsRoom(hotelId, roomId, session.user.id))) return { error: "Room not found." };

  const pricing = await db.hotel_room_pricing.findFirst({
    where: { id: pricingId, room_id: roomId },
    select: { id: true },
  });
  if (!pricing) return { error: "Rate plan not found." };

  if (!active) {
    const activeCount = await db.hotel_room_pricing.count({
      where: { room_id: roomId, is_active: true },
    });
    if (activeCount <= 1) {
      return { error: "A room needs at least one active rate plan." };
    }
  }

  await db.hotel_room_pricing.update({
    where: { id: pricingId },
    data: { is_active: active },
  });

  revalidatePath(`/hotel-connect/properties/${hotelId}/rates`);
  revalidatePath(`/hotel-connect/properties/${hotelId}/calendar`);
  return {};
}
