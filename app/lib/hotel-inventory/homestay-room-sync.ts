import "server-only";
import { db } from "@/app/lib/db";

const ENTIRE_PROPERTY_SLUG = "entire-property";

/**
 * Homestay/Villa properties are edited as a single unit — the wizard only
 * writes hs_bedrooms/hs_bathrooms/etc. and a hotel-level prop_base_rate onto
 * `hotels`, and never creates a `hotel_rooms` row. But every other system
 * (guest booking page, owner Rates & Availability calendar, the inventory
 * ledger/reservation engine) is keyed off `hotel_rooms`. Without this, a
 * homestay has zero rooms anywhere in the product.
 *
 * This provisions ONE canonical "Entire Property" room + pricing row from the
 * homestay's own fields, so it flows through the exact same pipeline as a
 * hotel room (no special-casing in the frontend or booking flow). Idempotent —
 * safe to call on every publish/re-publish; upserts by a fixed slug.
 */
export async function ensureHomestayRoom(hotelId: number): Promise<void> {
  const h = await db.hotels.findUnique({
    where: { id: hotelId },
    select: {
      property_category: true,
      hs_bedrooms: true,
      prop_base_rate: true,
      prop_extra_adult: true,
      prop_child_rate: true,
      prop_base_occupancy: true,
      prop_max_adults: true,
      prop_max_children: true,
      prop_max_occupancy: true,
      cancellation_policy: true,
    },
  });
  if (!h || h.property_category !== "HOMESTAY_VILLA" || h.prop_base_rate == null) return;

  const maxAdults = h.prop_max_adults ?? h.prop_base_occupancy ?? 2;
  const maxChildren = h.prop_max_children ?? 0;
  const maxOccupancy = h.prop_max_occupancy ?? maxAdults + maxChildren;
  const baseAdults = h.prop_base_occupancy ?? maxAdults;

  const room = await db.hotel_rooms.upsert({
    where: { hotel_id_slug: { hotel_id: hotelId, slug: ENTIRE_PROPERTY_SLUG } },
    create: {
      hotel_id: hotelId,
      name: "Entire Property",
      slug: ENTIRE_PROPERTY_SLUG,
      num_bedrooms: h.hs_bedrooms ?? undefined,
      num_rooms: 1,
      base_adults: baseAdults,
      base_children: 0,
      max_adults: maxAdults,
      max_children: maxChildren,
      max_occupancy: maxOccupancy,
      is_active: true,
      sort_order: 0,
    },
    update: {
      num_bedrooms: h.hs_bedrooms ?? undefined,
      base_adults: baseAdults,
      max_adults: maxAdults,
      max_children: maxChildren,
      max_occupancy: maxOccupancy,
      is_active: true,
    },
    select: { id: true },
  });

  const priceData = {
    price_per_night: h.prop_base_rate,
    extra_bed_rate: h.prop_extra_adult ?? undefined,
    extra_child_rate: h.prop_child_rate ?? undefined,
    cancellation_policy: h.cancellation_policy ?? undefined,
  };

  const existingPricing = await db.hotel_room_pricing.findFirst({
    where: { room_id: room.id, is_active: true },
    select: { id: true },
  });
  if (existingPricing) {
    await db.hotel_room_pricing.update({ where: { id: existingPricing.id }, data: priceData });
  } else {
    await db.hotel_room_pricing.create({
      data: {
        hotel_id: hotelId,
        room_id: room.id,
        plan_name: "Entire Property",
        is_active: true,
        sort_order: 0,
        ...priceData,
      },
    });
  }
}
