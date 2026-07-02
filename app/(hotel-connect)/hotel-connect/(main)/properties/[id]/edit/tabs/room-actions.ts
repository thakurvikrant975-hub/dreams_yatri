"use server";

import { redirect } from "next/navigation";
import { Prisma } from "@/app/generated/prisma/client";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import { fullRoomSchema, type FullRoomData, type RoomState } from "./room-schema";

export type RoomEditPayload = {
  room_type: string;      view_type: string;
  area: string;           area_unit: string;
  name: string;           num_bedrooms: string;
  num_living_rooms: string; num_rooms: string;
  description: string;
  bedroom_beds:      { beds: { type: string; count: number }[] }[];
  living_room_beds:  { beds: { type: string; count: number }[] }[];
  base_adults: number; max_adults: number;
  base_children: number; max_children: number; max_occupancy: number;
  extra_bed: boolean; extra_bed_capacity: number; child_cot_available: boolean;
  bathrooms: { type: string; attached_to: string }[];
  meal_plan: string;
  base_rate: string; extra_adult_charge: string; paid_child_charge: string;
  rate_start_date: string; rate_end_date: string;
  room_amenities:       string[];
  room_amenity_details: Record<string, string | string[]>;
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createRoom(
  hotelId: number,
  data: unknown,
): Promise<RoomState & { roomId?: number }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");

  const parsed = fullRoomSchema.safeParse(data);
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors as Partial<Record<keyof FullRoomData, string[]>>,
    };
  }

  const hotel = await db.hotels.findFirst({
    where: { id: hotelId, owner_id: session.user.id },
    select: { id: true, wizard_step: true },
  });
  if (!hotel) return { error: "Property not found." };

  const d = parsed.data;

  try {

  // Build structured beds JSONB from per-bedroom data
  const bedsJson = [
    ...d.bedroom_beds.map((br, i) => ({
      label: `Bedroom ${i + 1}`,
      kind: "bedroom",
      beds: br.beds,
    })),
    ...(d.living_room_beds ?? []).map((lr, i) => ({
      label: `Living Room ${i + 1}`,
      kind: "living_room",
      beds: lr.beds,
    })),
  ];

  // First bedroom's first bed → legacy single-bed columns
  const firstBed = d.bedroom_beds[0]?.beds[0];

  // Unique slug generation
  const baseSlug = slugify(d.name);
  let slug = baseSlug;
  let counter = 1;
  while (await db.hotel_rooms.findFirst({ where: { hotel_id: hotelId, slug } })) {
    slug = `${baseSlug}-${counter++}`;
  }

  const area = typeof d.area === "number" ? d.area : null;

  const room = await db.hotel_rooms.create({
    data: {
      hotel_id:            hotelId,
      name:                d.name,
      slug,
      room_type:           d.room_type,
      view_type:           d.view_type   || null,
      area_sqft:           d.area_unit === "sqft" ? area : null,
      area_unit:           d.area_unit,
      num_bedrooms:        d.num_bedrooms,
      num_living_rooms:    typeof d.num_living_rooms === "number" ? d.num_living_rooms : null,
      num_rooms:           d.num_rooms,
      description:         d.description || null,
      beds:                bedsJson      as Prisma.InputJsonValue,
      bed_type:            firstBed?.type  ?? null,
      bed_count:           firstBed?.count ?? 1,
      base_adults:         d.base_adults,
      max_adults:          d.max_adults,
      base_children:       d.base_children,
      max_children:        d.max_children,
      max_occupancy:       d.max_occupancy,
      extra_bed_capacity:  d.extra_bed ? d.extra_bed_capacity : 0,
      child_cot_available: d.child_cot_available,
      bathroom:            d.bathrooms as Prisma.InputJsonValue,
      meal_plan:           d.meal_plan,
      amenities:           { selected: d.room_amenities, details: d.room_amenity_details } as Prisma.InputJsonValue,
      room_wizard_step:    5,
    },
    select: { id: true },
  });

  // Create initial pricing record
  await db.hotel_room_pricing.create({
    data: {
      hotel_id:        hotelId,
      room_id:         room.id,
      plan_name:       d.meal_plan,
      price_per_night: d.base_rate,
      extra_bed_rate:  d.extra_adult_charge ?? null,
      extra_child_rate: d.paid_child_charge ?? null,
      valid_from:      new Date(d.rate_start_date),
      valid_to:        new Date(d.rate_end_date),
    },
  });

  // Advance hotel wizard step to unlock Tab 5
  await db.hotels.update({
    where: { id: hotelId },
    data:  { wizard_step: Math.max(4, hotel.wizard_step) },
  });

  return { roomId: room.id };
  } catch (err) {
    console.error("[createRoom]", err);
    return { error: err instanceof Error ? err.message : "Failed to save room. Please try again." };
  }
}

export async function fetchRoomForEdit(
  hotelId: number,
  roomId: number,
): Promise<{ payload?: RoomEditPayload; error?: string }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");

  try {
    const room = await db.hotel_rooms.findFirst({
      where: { id: roomId, hotel_id: hotelId },
      include: {
        pricing: { orderBy: { created_at: "asc" }, take: 1 },
        hotel:   { select: { owner_id: true } },
      },
    });

    if (!room || room.hotel.owner_id !== session.user.id) return { error: "Room not found." };

    type BedGroup = { kind: string; beds: { type: string; count: number }[] };
    const allBeds = (room.beds as BedGroup[] | null) ?? [];
    const bedroom_beds     = allBeds.filter((b) => b.kind === "bedroom").map((b) => ({ beds: b.beds }));
    const living_room_beds = allBeds.filter((b) => b.kind === "living_room").map((b) => ({ beds: b.beds }));

    const pricing = room.pricing[0];

    const payload: RoomEditPayload = {
      room_type:          room.room_type         ?? "",
      view_type:          room.view_type          ?? "",
      area:               room.area_sqft?.toString() ?? "",
      area_unit:          (room.area_unit as string) ?? "sqft",
      name:               room.name,
      num_bedrooms:       room.num_bedrooms?.toString()    ?? "1",
      num_living_rooms:   room.num_living_rooms?.toString() ?? "",
      num_rooms:          room.num_rooms.toString(),
      description:        room.description ?? "",
      bedroom_beds:       bedroom_beds.length > 0 ? bedroom_beds : [{ beds: [{ type: "King", count: 1 }] }],
      living_room_beds,
      base_adults:        room.base_adults,
      max_adults:         room.max_adults,
      base_children:      room.base_children,
      max_children:       room.max_children,
      max_occupancy:      room.max_occupancy,
      extra_bed:          room.extra_bed_capacity > 0,
      extra_bed_capacity: room.extra_bed_capacity,
      child_cot_available: room.child_cot_available,
      bathrooms: (room.bathroom as { type: string; attached_to: string }[] | null)
                    ?? [{ type: "bathroom", attached_to: "bedroom_1" }],
      meal_plan:          room.meal_plan ?? "",
      base_rate:          pricing?.price_per_night?.toString()  ?? "",
      extra_adult_charge: pricing?.extra_bed_rate?.toString()   ?? "",
      paid_child_charge:  pricing?.extra_child_rate?.toString() ?? "",
      rate_start_date:    pricing?.valid_from?.toISOString().split("T")[0] ?? "",
      rate_end_date:      pricing?.valid_to?.toISOString().split("T")[0]   ?? "",
      room_amenities:     (() => {
        const raw = room.amenities as string[] | { selected?: string[]; details?: Record<string, string | string[]> } | null;
        if (Array.isArray(raw)) return raw;
        return (raw?.selected as string[]) ?? [];
      })(),
      room_amenity_details: (() => {
        const raw = room.amenities as string[] | { selected?: string[]; details?: Record<string, string | string[]> } | null;
        if (Array.isArray(raw) || !raw) return {};
        return (raw.details as Record<string, string | string[]>) ?? {};
      })(),
    };

    return { payload };
  } catch (err) {
    console.error("[fetchRoomForEdit]", err);
    return { error: "Failed to load room." };
  }
}

export async function updateRoom(
  hotelId: number,
  roomId: number,
  data: unknown,
): Promise<RoomState & { roomId?: number }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");

  const parsed = fullRoomSchema.safeParse(data);
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors as Partial<Record<keyof FullRoomData, string[]>>,
    };
  }

  const hotel = await db.hotels.findFirst({
    where: { id: hotelId, owner_id: session.user.id },
    select: { id: true },
  });
  if (!hotel) return { error: "Property not found." };

  const d = parsed.data;

  try {
    const bedsJson = [
      ...d.bedroom_beds.map((br, i) => ({ label: `Bedroom ${i + 1}`, kind: "bedroom", beds: br.beds })),
      ...(d.living_room_beds ?? []).map((lr, i) => ({ label: `Living Room ${i + 1}`, kind: "living_room", beds: lr.beds })),
    ];
    const firstBed = d.bedroom_beds[0]?.beds[0];
    const area = typeof d.area === "number" ? d.area : null;

    await db.hotel_rooms.update({
      where: { id: roomId, hotel_id: hotelId },
      data: {
        name:                d.name,
        room_type:           d.room_type,
        view_type:           d.view_type    || null,
        area_sqft:           d.area_unit === "sqft" ? area : null,
        area_unit:           d.area_unit,
        num_bedrooms:        d.num_bedrooms,
        num_living_rooms:    typeof d.num_living_rooms === "number" ? d.num_living_rooms : null,
        num_rooms:           d.num_rooms,
        description:         d.description  || null,
        beds:                bedsJson       as Prisma.InputJsonValue,
        bed_type:            firstBed?.type  ?? null,
        bed_count:           firstBed?.count ?? 1,
        base_adults:         d.base_adults,
        max_adults:          d.max_adults,
        base_children:       d.base_children,
        max_children:        d.max_children,
        max_occupancy:       d.max_occupancy,
        extra_bed_capacity:  d.extra_bed ? d.extra_bed_capacity : 0,
        child_cot_available: d.child_cot_available,
        bathroom:            d.bathrooms    as Prisma.InputJsonValue,
        meal_plan:           d.meal_plan,
        amenities:           { selected: d.room_amenities, details: d.room_amenity_details } as Prisma.InputJsonValue,
      },
    });

    const pricingData = {
      plan_name:        d.meal_plan,
      price_per_night:  d.base_rate,
      extra_bed_rate:   d.extra_adult_charge ?? null,
      extra_child_rate: d.paid_child_charge  ?? null,
      valid_from:       new Date(d.rate_start_date),
      valid_to:         new Date(d.rate_end_date),
    };

    const existingPricing = await db.hotel_room_pricing.findFirst({
      where: { room_id: roomId },
      orderBy: { created_at: "asc" },
      select: { id: true },
    });

    if (existingPricing) {
      await db.hotel_room_pricing.update({ where: { id: existingPricing.id }, data: pricingData });
    } else {
      await db.hotel_room_pricing.create({ data: { hotel_id: hotelId, room_id: roomId, ...pricingData } });
    }

    return { roomId };
  } catch (err) {
    console.error("[updateRoom]", err);
    return { error: err instanceof Error ? err.message : "Failed to update room. Please try again." };
  }
}

export async function deleteRoom(
  hotelId: number,
  roomId: number,
): Promise<{ error?: string }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");

  const hotel = await db.hotels.findFirst({
    where: { id: hotelId, owner_id: session.user.id },
    select: { id: true },
  });
  if (!hotel) return { error: "Property not found." };

  await db.hotel_rooms.update({
    where: { id: roomId, hotel_id: hotelId },
    data:  { is_active: false },
  });

  return {};
}
