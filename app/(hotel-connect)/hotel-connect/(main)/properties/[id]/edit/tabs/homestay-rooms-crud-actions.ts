"use server";

import { redirect } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import { Prisma } from "@/app/generated/prisma";
import { defaultBedroom, type BedroomDetail } from "../bedroom/[n]/bedroom-types";
import {
  defaultBathroom, defaultKitchen, defaultSpace,
  SPACE_TYPES,
  type BathroomDetail, type KitchenDetail, type SpaceItem,
} from "./homestay-rooms-types";

// ── Auth helper ────────────────────────────────────────────────────────────

async function getOwnerHotel(hotelId: number) {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");
  const hotel = await db.hotels.findFirst({
    where: { id: hotelId, owner_id: session.user.id },
    select: {
      id: true,
      hs_bedroom_details: true,
      hs_bathroom_details: true,
      hs_kitchen_details: true,
      hs_space_items: true,
    },
  });
  if (!hotel) redirect("/hotel-connect");
  return hotel;
}

// ── Phase 1: save counts + initialise detail arrays ────────────────────────

export async function saveHomestayRoomCounts(
  hotelId: number,
  data: {
    bedrooms: number;
    bathrooms: number;
    hasKitchen: boolean;
    spaceCounts: Record<string, number>;
  }
): Promise<void> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");

  const ownerId = session.user.id;
  const hotel = await db.hotels.findFirst({
    where: { id: hotelId, owner_id: ownerId },
    select: {
      id: true, wizard_step: true,
      hs_bedroom_details: true, hs_bathroom_details: true,
      hs_kitchen_details: true, hs_space_items: true,
    },
  });
  if (!hotel) redirect("/hotel-connect");

  const bedroomCount  = Math.max(1, data.bedrooms);
  const bathroomCount = Math.max(1, data.bathrooms);

  const existingBedrooms  = (hotel.hs_bedroom_details  as BedroomDetail[]  | null) ?? [];
  const existingBathrooms = (hotel.hs_bathroom_details as BathroomDetail[] | null) ?? [];
  const existingSpaces    = (hotel.hs_space_items      as SpaceItem[]      | null) ?? [];

  const newBedrooms: BedroomDetail[] = Array.from({ length: bedroomCount }, (_, i) =>
    existingBedrooms[i] ?? defaultBedroom(i + 1)
  );
  const newBathrooms: BathroomDetail[] = Array.from({ length: bathroomCount }, (_, i) =>
    existingBathrooms[i] ?? defaultBathroom(i + 1)
  );

  const spaceItems: SpaceItem[] = [];
  for (const st of SPACE_TYPES) {
    const count = data.spaceCounts[st.key] ?? 0;
    for (let i = 1; i <= count; i++) {
      const existing = existingSpaces.find(s => s.space_type === st.key && s.instance === i);
      spaceItems.push(existing ?? defaultSpace(st.key, st.label, i));
    }
  }

  const kitchenDetails = data.hasKitchen
    ? ((hotel.hs_kitchen_details as KitchenDetail | null) ?? defaultKitchen())
    : Prisma.DbNull;

  await db.hotels.update({
    where: { id: hotelId },
    data: {
      hs_bedrooms:         bedroomCount,
      hs_bathrooms:        bathroomCount,
      hs_has_kitchen:      data.hasKitchen,
      hs_bedroom_details:  newBedrooms,
      hs_bathroom_details: newBathrooms,
      hs_kitchen_details:  kitchenDetails,
      hs_space_items:      spaceItems,
      wizard_step:         Math.max(hotel.wizard_step, 3),
    },
  });

  redirect(`/hotel-connect/properties/${hotelId}/edit?tab=4`);
}

// ── Bedroom CRUD ───────────────────────────────────────────────────────────

export async function addHomestayBedroom(hotelId: number): Promise<{ n: number }> {
  const hotel = await getOwnerHotel(hotelId);
  const items = (hotel.hs_bedroom_details as BedroomDetail[] | null) ?? [];
  const n = items.length + 1;
  await db.hotels.update({
    where: { id: hotelId },
    data: { hs_bedroom_details: [...items, defaultBedroom(n)], hs_bedrooms: n },
  });
  return { n };
}

export async function deleteHomestayBedroom(hotelId: number, n: number): Promise<void> {
  const hotel = await getOwnerHotel(hotelId);
  const items = (hotel.hs_bedroom_details as BedroomDetail[] | null) ?? [];
  const updated = items
    .filter((_, i) => i !== n - 1)
    .map((b, i) => ({ ...b, name: b.name.startsWith("Bedroom ") ? `Bedroom ${i + 1}` : b.name }));
  await db.hotels.update({
    where: { id: hotelId },
    data: { hs_bedroom_details: updated, hs_bedrooms: updated.length },
  });
}

// ── Bathroom CRUD ──────────────────────────────────────────────────────────

export async function addHomestayBathroom(hotelId: number): Promise<{ n: number }> {
  const hotel = await getOwnerHotel(hotelId);
  const items = (hotel.hs_bathroom_details as BathroomDetail[] | null) ?? [];
  const n = items.length + 1;
  await db.hotels.update({
    where: { id: hotelId },
    data: { hs_bathroom_details: [...items, defaultBathroom(n)], hs_bathrooms: n },
  });
  return { n };
}

export async function deleteHomestayBathroom(hotelId: number, n: number): Promise<void> {
  const hotel = await getOwnerHotel(hotelId);
  const items = (hotel.hs_bathroom_details as BathroomDetail[] | null) ?? [];
  const updated = items
    .filter((_, i) => i !== n - 1)
    .map((b, i) => ({ ...b, name: b.name.startsWith("Bathroom ") ? `Bathroom ${i + 1}` : b.name }));
  await db.hotels.update({
    where: { id: hotelId },
    data: { hs_bathroom_details: updated, hs_bathrooms: updated.length },
  });
}

export async function saveHomestayBathroomDetail(
  hotelId: number, n: number, data: Partial<BathroomDetail>
): Promise<{ ok: boolean }> {
  const hotel = await getOwnerHotel(hotelId);
  const items = (hotel.hs_bathroom_details as BathroomDetail[] | null) ?? [];
  const idx = n - 1;
  if (idx < 0 || idx >= items.length) return { ok: false };
  const updated = [...items];
  updated[idx] = { ...updated[idx], ...data, step_reached: 1 };
  await db.hotels.update({ where: { id: hotelId }, data: { hs_bathroom_details: updated } });
  return { ok: true };
}

// ── Kitchen CRUD ───────────────────────────────────────────────────────────

export async function addHomestayKitchen(hotelId: number): Promise<void> {
  await getOwnerHotel(hotelId);
  await db.hotels.update({
    where: { id: hotelId },
    data: { hs_kitchen_details: defaultKitchen(), hs_has_kitchen: true },
  });
}

export async function removeHomestayKitchen(hotelId: number): Promise<void> {
  await getOwnerHotel(hotelId);
  await db.hotels.update({
    where: { id: hotelId },
    data: { hs_kitchen_details: Prisma.DbNull, hs_has_kitchen: false },
  });
}

export async function saveHomestayKitchenDetail(
  hotelId: number, data: Partial<KitchenDetail>
): Promise<{ ok: boolean }> {
  const hotel = await getOwnerHotel(hotelId);
  const current = (hotel.hs_kitchen_details as KitchenDetail | null) ?? defaultKitchen();
  await db.hotels.update({
    where: { id: hotelId },
    data: { hs_kitchen_details: { ...current, ...data } },
  });
  return { ok: true };
}

// ── Space CRUD ─────────────────────────────────────────────────────────────

export async function addHomestaySpace(hotelId: number, spaceType: string): Promise<void> {
  const hotel = await getOwnerHotel(hotelId);
  const items = (hotel.hs_space_items as SpaceItem[] | null) ?? [];
  const typeDef = SPACE_TYPES.find(s => s.key === spaceType);
  if (!typeDef) return;
  const instance = items.filter(s => s.space_type === spaceType).length + 1;
  await db.hotels.update({
    where: { id: hotelId },
    data: { hs_space_items: [...items, defaultSpace(spaceType, typeDef.label, instance)] },
  });
}

export async function deleteHomestaySpace(hotelId: number, idx: number): Promise<void> {
  const hotel = await getOwnerHotel(hotelId);
  const items = (hotel.hs_space_items as SpaceItem[] | null) ?? [];
  const removed = items[idx];
  if (!removed) return;
  const remaining = items.filter((_, i) => i !== idx);
  const updated = remaining.map(s => {
    if (s.space_type !== removed.space_type) return s;
    const newInstance = remaining.filter(x => x.space_type === s.space_type).indexOf(s) + 1;
    return { ...s, instance: newInstance };
  });
  await db.hotels.update({ where: { id: hotelId }, data: { hs_space_items: updated } });
}

export async function saveHomestaySpaceDetail(
  hotelId: number, idx: number, data: Partial<SpaceItem>
): Promise<{ ok: boolean }> {
  const hotel = await getOwnerHotel(hotelId);
  const items = (hotel.hs_space_items as SpaceItem[] | null) ?? [];
  if (idx < 0 || idx >= items.length) return { ok: false };
  const updated = [...items];
  updated[idx] = { ...updated[idx], ...data, details_added: true };
  await db.hotels.update({ where: { id: hotelId }, data: { hs_space_items: updated } });
  return { ok: true };
}
