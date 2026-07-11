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

  try {
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
  } catch (err) {
    console.error("[createRatePlan]", err);
    return { error: "Couldn't create the rate plan. Please try again." };
  }
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

  try {
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
  } catch (err) {
    console.error("[updateRatePlanDetails]", err);
    return { error: "Couldn't save the rate plan. Please try again." };
  }

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

  try {
    await db.hotel_room_pricing.update({
      where: { id: pricingId },
      data: { is_active: active },
    });
  } catch (err) {
    console.error("[setRatePlanActive]", err);
    return { error: "Couldn't update the rate plan. Please try again." };
  }

  revalidatePath(`/hotel-connect/properties/${hotelId}/rates`);
  revalidatePath(`/hotel-connect/properties/${hotelId}/calendar`);
  return {};
}

// ── Default (non-seasonal) rates & inventory ─────────────────────────────────
//
// The pricing engine (app/lib/hotel-inventory/rates.ts) already falls back to
// a plan's base price_per_night/occupancy_prices/extra_bed_rate/extra_child_rate
// whenever no season matches a date — these ARE the "default rates" a guest is
// quoted for any date the owner hasn't set up a season for. There was just no
// screen to edit the occupancy-tiered/child/extra-adult values directly; only
// the flat price_per_night was settable outside of a date-ranged season.
// "Default Inventory" is the same idea for hotel_rooms.num_rooms, which
// ensureAvailability() already uses whenever a date's ledger row doesn't
// exist yet.

export type DefaultRatesDetail = {
  basePrice: number; // occupancy = 2, i.e. price_per_night itself
  occupancyPrices: Record<number, number | null>; // keyed by occupancy, excludes 2
  extraChildRate: number | null;
  extraAdultRate: number | null;
  maxAdults: number;
};

export async function getDefaultRates(
  hotelId: number,
  roomId: number,
  pricingId: number,
): Promise<{ error?: string; detail?: DefaultRatesDetail }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");
  if (!(await ownsRoom(hotelId, roomId, session.user.id))) return { error: "Room not found." };

  const room = await db.hotel_rooms.findFirst({
    where: { id: roomId, hotel_id: hotelId },
    select: { max_adults: true },
  });
  if (!room) return { error: "Room not found." };

  const pricing = await db.hotel_room_pricing.findFirst({
    where: { id: pricingId, room_id: roomId },
    select: {
      price_per_night: true, extra_bed_rate: true, extra_child_rate: true,
      occupancy_prices: { select: { occupancy: true, price_per_night: true } },
    },
  });
  if (!pricing) return { error: "Rate plan not found." };

  const occupancyPrices: Record<number, number | null> = {};
  for (const o of pricing.occupancy_prices) occupancyPrices[o.occupancy] = Number(o.price_per_night);

  return {
    detail: {
      basePrice: Number(pricing.price_per_night),
      occupancyPrices,
      extraChildRate: pricing.extra_child_rate != null ? Number(pricing.extra_child_rate) : null,
      extraAdultRate: pricing.extra_bed_rate != null ? Number(pricing.extra_bed_rate) : null,
      maxAdults: room.max_adults,
    },
  };
}

export type DefaultRatesInput = {
  basePrice: number;
  occupancyPrices: Record<number, number | null>; // null clears that tier's override
  extraChildRate: number | null;
  extraAdultRate: number | null;
};

export async function saveDefaultRates(
  hotelId: number,
  roomId: number,
  pricingId: number,
  input: DefaultRatesInput,
): Promise<{ error?: string }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");
  if (!(await ownsRoom(hotelId, roomId, session.user.id))) return { error: "Room not found." };

  if (!Number.isFinite(input.basePrice) || input.basePrice <= 0) {
    return { error: "Base rate (2 adults) is required and must be a positive number." };
  }
  const extraChecks: [string, number | null][] = [
    ["Extra adult charge", input.extraAdultRate],
    ["Paid child rate", input.extraChildRate],
  ];
  for (const [label, v] of extraChecks) {
    if (v != null && (!Number.isFinite(v) || v < 0)) return { error: `${label} must be zero or a positive number.` };
  }
  for (const [occStr, price] of Object.entries(input.occupancyPrices)) {
    if (price != null && (!Number.isFinite(price) || price <= 0)) {
      return { error: `Rate for ${occStr} adults must be a positive number.` };
    }
  }

  const pricing = await db.hotel_room_pricing.findFirst({
    where: { id: pricingId, room_id: roomId },
    select: { id: true },
  });
  if (!pricing) return { error: "Rate plan not found." };

  try {
    await db.$transaction(async (tx) => {
      await tx.hotel_room_pricing.update({
        where: { id: pricingId },
        data: {
          price_per_night: input.basePrice,
          extra_bed_rate: input.extraAdultRate,
          extra_child_rate: input.extraChildRate,
        },
      });

      for (const [occStr, price] of Object.entries(input.occupancyPrices)) {
        const occupancy = Number(occStr);
        if (price == null) {
          await tx.hotel_room_occupancy_prices.deleteMany({ where: { pricing_id: pricingId, occupancy } });
        } else {
          await tx.hotel_room_occupancy_prices.upsert({
            where: { pricing_id_occupancy: { pricing_id: pricingId, occupancy } },
            update: { price_per_night: price },
            create: { pricing_id: pricingId, occupancy, price_per_night: price },
          });
        }
      }
    });
  } catch (err) {
    console.error("[saveDefaultRates]", err);
    return { error: "Couldn't save the default rates. Please try again." };
  }

  revalidatePath(`/hotel-connect/properties/${hotelId}/rates`);
  revalidatePath(`/hotel-connect/properties/${hotelId}/calendar`);
  return {};
}

// ── Default inventory (hotel_rooms.num_rooms) ────────────────────────────────

export async function setDefaultInventory(
  hotelId: number,
  roomId: number,
  numRooms: number,
): Promise<{ error?: string }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");
  if (!(await ownsRoom(hotelId, roomId, session.user.id))) return { error: "Room not found." };

  if (!Number.isInteger(numRooms) || numRooms < 1) {
    return { error: "Default inventory must be a whole number of at least 1." };
  }

  try {
    await db.hotel_rooms.update({
      where: { id: roomId },
      data: { num_rooms: numRooms },
    });
  } catch (err) {
    console.error("[setDefaultInventory]", err);
    return { error: "Couldn't save the default inventory. Please try again." };
  }

  revalidatePath(`/hotel-connect/properties/${hotelId}/rates`);
  revalidatePath(`/hotel-connect/properties/${hotelId}/rates/default`);
  return {};
}
