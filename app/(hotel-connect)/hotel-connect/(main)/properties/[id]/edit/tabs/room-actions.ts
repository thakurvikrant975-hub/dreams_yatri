"use server";

import { redirect } from "next/navigation";
import { Prisma } from "@/app/generated/prisma/client";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import { fullRoomSchema, type FullRoomData, type RoomState } from "./room-schema";

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
      amenities:           d.room_amenities as Prisma.InputJsonValue,
      room_wizard_step:    5,
    },
    select: { id: true },
  });

  // Advance hotel wizard step to unlock Tab 5
  await db.hotels.update({
    where: { id: hotelId },
    data:  { wizard_step: Math.max(4, hotel.wizard_step) },
  });

  return { roomId: room.id };
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
