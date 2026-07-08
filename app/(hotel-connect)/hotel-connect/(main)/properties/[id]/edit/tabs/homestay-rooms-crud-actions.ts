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

type HotelRow = {
  id: number;
  hs_bedroom_details: Prisma.JsonValue;
  hs_bathroom_details: Prisma.JsonValue;
  hs_kitchen_details: Prisma.JsonValue;
  hs_space_items: Prisma.JsonValue;
};

/**
 * Runs `fn` inside a transaction with the hotel row locked (`FOR UPDATE`) for
 * its duration. Every mutation here is a read-the-JSON-array-then-write-the-
 * whole-array — without a row lock, two concurrent calls (double-click, two
 * tabs) can both read the same array and the second write silently discards
 * the first.
 */
async function withLockedHotel<T>(
  hotelId: number,
  ownerId: string,
  fn: (tx: Prisma.TransactionClient, hotel: HotelRow) => Promise<T>,
): Promise<T | { notFound: true }> {
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<(HotelRow & { owner_id: string | null })[]>`
      SELECT id, owner_id, hs_bedroom_details, hs_bathroom_details, hs_kitchen_details, hs_space_items
      FROM hotels WHERE id = ${hotelId} FOR UPDATE
    `;
    const hotel = rows[0];
    if (!hotel || hotel.owner_id !== ownerId) return { notFound: true as const };
    return fn(tx, hotel);
  });
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

  // Guard against non-numeric input reaching Math.max/an Int column as NaN —
  // Math.max(1, NaN) is NaN, not 1.
  const safeBedrooms  = Number.isFinite(data.bedrooms)  ? data.bedrooms  : 1;
  const safeBathrooms = Number.isFinite(data.bathrooms) ? data.bathrooms : 1;
  const bedroomCount  = Math.min(50, Math.max(1, Math.trunc(safeBedrooms)));
  const bathroomCount = Math.min(50, Math.max(1, Math.trunc(safeBathrooms)));

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
    const rawCount = data.spaceCounts[st.key] ?? 0;
    const count = Number.isFinite(rawCount) ? Math.min(50, Math.max(0, Math.trunc(rawCount))) : 0;
    for (let i = 1; i <= count; i++) {
      const existing = existingSpaces.find(s => s.space_type === st.key && s.instance === i);
      spaceItems.push(existing ?? defaultSpace(st.key, st.label, i));
    }
  }

  const kitchenDetails = data.hasKitchen
    ? ((hotel.hs_kitchen_details as KitchenDetail | null) ?? defaultKitchen())
    : Prisma.DbNull;

  try {
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
  } catch (err) {
    console.error("[saveHomestayRoomCounts]", err);
    redirect(`/hotel-connect/properties/${hotelId}/edit?tab=4`);
  }

  redirect(`/hotel-connect/properties/${hotelId}/edit?tab=4`);
}

// ── Bedroom CRUD ───────────────────────────────────────────────────────────

export async function addHomestayBedroom(hotelId: number): Promise<{ n: number }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");

  const result = await withLockedHotel(hotelId, session.user.id, async (tx, hotel) => {
    const items = (hotel.hs_bedroom_details as BedroomDetail[] | null) ?? [];
    const n = items.length + 1;
    await tx.hotels.update({
      where: { id: hotelId },
      data: { hs_bedroom_details: [...items, defaultBedroom(n)], hs_bedrooms: n },
    });
    return { n };
  });
  if ("notFound" in result) redirect("/hotel-connect");
  return result;
}

export async function deleteHomestayBedroom(hotelId: number, n: number): Promise<{ error?: string }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");
  if (!Number.isInteger(n) || n < 1) {
    console.error("[deleteHomestayBedroom] invalid index:", n);
    return {};
  }

  let error: string | undefined;
  await withLockedHotel(hotelId, session.user.id, async (tx, hotel) => {
    const items = (hotel.hs_bedroom_details as BedroomDetail[] | null) ?? [];
    if (n > items.length) return; // stale/out-of-range request — no-op, nothing to delete
    // A homestay is always listed as a single "Entire property" unit built
    // from its bedrooms — Phase 1's counts form enforces min 1, so deleting
    // down to 0 here would silently break that invariant.
    if (items.length <= 1) {
      error = "A homestay must have at least one bedroom.";
      return;
    }
    const updated = items
      .filter((_, i) => i !== n - 1)
      .map((b, i) => ({ ...b, name: b.name.startsWith("Bedroom ") ? `Bedroom ${i + 1}` : b.name }));
    await tx.hotels.update({
      where: { id: hotelId },
      data: { hs_bedroom_details: updated, hs_bedrooms: updated.length },
    });
  });
  return { error };
}

// ── Bathroom CRUD ──────────────────────────────────────────────────────────

export async function addHomestayBathroom(hotelId: number): Promise<{ n: number }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");

  const result = await withLockedHotel(hotelId, session.user.id, async (tx, hotel) => {
    const items = (hotel.hs_bathroom_details as BathroomDetail[] | null) ?? [];
    const n = items.length + 1;
    await tx.hotels.update({
      where: { id: hotelId },
      data: { hs_bathroom_details: [...items, defaultBathroom(n)], hs_bathrooms: n },
    });
    return { n };
  });
  if ("notFound" in result) redirect("/hotel-connect");
  return result;
}

export async function deleteHomestayBathroom(hotelId: number, n: number): Promise<{ error?: string }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");
  if (!Number.isInteger(n) || n < 1) {
    console.error("[deleteHomestayBathroom] invalid index:", n);
    return {};
  }

  let error: string | undefined;
  await withLockedHotel(hotelId, session.user.id, async (tx, hotel) => {
    const items = (hotel.hs_bathroom_details as BathroomDetail[] | null) ?? [];
    if (n > items.length) return;
    // Mirrors deleteHomestayBedroom's guard — Phase 1's counts form enforces
    // a minimum of 1 bathroom, so this must too.
    if (items.length <= 1) {
      error = "A homestay must have at least one bathroom.";
      return;
    }
    const updated = items
      .filter((_, i) => i !== n - 1)
      .map((b, i) => ({ ...b, name: b.name.startsWith("Bathroom ") ? `Bathroom ${i + 1}` : b.name }));
    await tx.hotels.update({
      where: { id: hotelId },
      data: { hs_bathroom_details: updated, hs_bathrooms: updated.length },
    });
  });
  return { error };
}

export async function saveHomestayBathroomDetail(
  hotelId: number, n: number, data: Partial<BathroomDetail>
): Promise<{ ok: boolean }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");

  const result = await withLockedHotel(hotelId, session.user.id, async (tx, hotel) => {
    const items = (hotel.hs_bathroom_details as BathroomDetail[] | null) ?? [];
    const idx = n - 1;
    if (idx < 0 || idx >= items.length) return { ok: false };
    // Defense-in-depth — re-check fields with real invariants since this
    // action can be called directly with an arbitrary payload.
    const patch = { ...data };
    if (patch.size_value != null && (!Number.isFinite(patch.size_value) || patch.size_value < 0)) patch.size_value = null;
    if (patch.step_reached != null) patch.step_reached = Math.min(3, Math.max(0, Math.trunc(patch.step_reached)));

    const updated = [...items];
    // step_reached comes from the caller's patch (BathroomEditTab.tsx's advance()
    // already computes max(current, justCompletedStep)) — must not be clobbered
    // here, or progress resets to "step 1" on every save and the tab-level
    // completeness gate below never sees steps 2/3 as done.
    updated[idx] = { ...updated[idx], ...patch };
    await tx.hotels.update({ where: { id: hotelId }, data: { hs_bathroom_details: updated } });
    return { ok: true };
  });
  if ("notFound" in result) redirect("/hotel-connect");
  return result;
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
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");

  const result = await withLockedHotel(hotelId, session.user.id, async (tx, hotel) => {
    const current = (hotel.hs_kitchen_details as KitchenDetail | null) ?? defaultKitchen();
    await tx.hotels.update({
      where: { id: hotelId },
      data: { hs_kitchen_details: { ...current, ...data } },
    });
    return { ok: true };
  });
  if ("notFound" in result) redirect("/hotel-connect");
  return result;
}

// ── Space CRUD ─────────────────────────────────────────────────────────────

export async function addHomestaySpace(hotelId: number, spaceType: string): Promise<void> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");
  const typeDef = SPACE_TYPES.find(s => s.key === spaceType);
  if (!typeDef) return;

  await withLockedHotel(hotelId, session.user.id, async (tx, hotel) => {
    const items = (hotel.hs_space_items as SpaceItem[] | null) ?? [];
    const instance = items.filter(s => s.space_type === spaceType).length + 1;
    await tx.hotels.update({
      where: { id: hotelId },
      data: { hs_space_items: [...items, defaultSpace(spaceType, typeDef.label, instance)] },
    });
  });
}

export async function deleteHomestaySpace(hotelId: number, idx: number): Promise<void> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");
  if (!Number.isInteger(idx) || idx < 0) {
    console.error("[deleteHomestaySpace] invalid index:", idx);
    return;
  }

  await withLockedHotel(hotelId, session.user.id, async (tx, hotel) => {
    const items = (hotel.hs_space_items as SpaceItem[] | null) ?? [];
    const removed = items[idx];
    if (!removed) return;
    const remaining = items.filter((_, i) => i !== idx);
    const updated = remaining.map(s => {
      if (s.space_type !== removed.space_type) return s;
      const newInstance = remaining.filter(x => x.space_type === s.space_type).indexOf(s) + 1;
      return { ...s, instance: newInstance };
    });
    await tx.hotels.update({ where: { id: hotelId }, data: { hs_space_items: updated } });
  });
}

export async function saveHomestaySpaceDetail(
  hotelId: number, idx: number, data: Partial<SpaceItem>
): Promise<{ ok: boolean }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");

  const result = await withLockedHotel(hotelId, session.user.id, async (tx, hotel) => {
    const items = (hotel.hs_space_items as SpaceItem[] | null) ?? [];
    if (idx < 0 || idx >= items.length) return { ok: false };
    const updated = [...items];
    updated[idx] = { ...updated[idx], ...data, details_added: true };
    await tx.hotels.update({ where: { id: hotelId }, data: { hs_space_items: updated } });
    return { ok: true };
  });
  if ("notFound" in result) redirect("/hotel-connect");
  return result;
}
