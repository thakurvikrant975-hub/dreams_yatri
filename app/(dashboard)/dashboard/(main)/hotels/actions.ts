"use server";

import { db } from "@/app/lib/db";
import { deleteFromR2 } from "@/app/lib/r2/r2delete";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ALL_SYSTEM_HOTEL_CATEGORIES, REQUIRED_HOTEL_CATEGORIES } from "@/app/lib/hotelImageCategories";

// ── Schemas ───────────────────────────────────────────────────────────────

const HotelSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  destination_id: z.coerce.number().int().positive("Destination is required"),
  thumbnail: z.string().optional(),
  category: z.string().optional(),
  star_rating: z.coerce.number().int().min(1).max(5).optional(),
  check_in_time: z.string().optional(),
  check_out_time: z.string().optional(),
  address: z.string().optional(),
  description: z.string().optional(),
  meta_title: z.string().optional(),
  meta_desc: z.string().optional(),
  is_active: z.boolean().default(true),
  latitude: z.coerce.number().nullable().optional(),
  longitude: z.coerce.number().nullable().optional(),
});

export type HotelFormState = {
  success: boolean;
  message: string;
  id?: number;
  errors?: Record<string, string[]>;
};

// ── Read ──────────────────────────────────────────────────────────────────

export async function getHotels() {
  return db.hotels.findMany({
    orderBy: { created_at: "desc" },
    include: {
      destination: { select: { id: true, name: true } },
      _count: {
        select: {
          hotelRooms: true,
          images: true,
        },
      },
    },
  });
}

export async function getHotelById(id: number) {
  // Guarantee required system categories exist (handles hotels created via seed or
  // before this feature was added — idempotent: only inserts what is missing).
  const existingSystemNames = await db.hotel_image_categories
    .findMany({ where: { hotel_id: id, is_system: true }, select: { name: true } })
    .then((rows) => new Set(rows.map((r) => r.name)));

  const missing = REQUIRED_HOTEL_CATEGORIES.filter((c) => !existingSystemNames.has(c.name));
  if (missing.length > 0) {
    await db.hotel_image_categories.createMany({
      data: missing.map((cat) => ({
        hotel_id: id,
        name: cat.name,
        is_required: cat.is_required,
        is_system: cat.is_system,
        sort_order: cat.sort_order,
      })),
    });
  }

  return db.hotels.findUnique({
    where: { id },
    include: {
      destination: { select: { id: true, name: true } },
      hotelRooms: {
        orderBy: { sort_order: "asc" },
        include: {
          images: { orderBy: { sort_order: "asc" } },
          pricing: {
            orderBy: { sort_order: "asc" },
            include: {
              meal_type: { select: { id: true, name: true } },
              diet_type: { select: { id: true, name: true } },
              occupancy_prices: { orderBy: { occupancy: "asc" } },
            },
          },
        },
      },
      room_pricing: {
        orderBy: { sort_order: "asc" },
        include: {
          room: { select: { id: true, name: true } },
          meal_type: { select: { id: true, name: true } },
          diet_type: { select: { id: true, name: true } },
          occupancy_prices: { orderBy: { occupancy: "asc" } },
        },
      },
      childPolicies: {
        orderBy: { sort_order: "asc" },
      },
      image_categories: {
        orderBy: { sort_order: "asc" },
        include: {
          images: { orderBy: { sort_order: "asc" } },
          room_pricing: { select: { id: true } },
        },
      },
    },
  });
}

export async function getRoomsByHotel(hotel_id: number) {
  return db.hotel_rooms.findMany({
    where: { hotel_id },
    orderBy: { sort_order: "asc" },
    select: { id: true, name: true },
  });
}

export async function getMealTypes() {
  return db.meal_types.findMany({ orderBy: { name: "asc" } });
}

export async function createMealType(name: string): Promise<HotelFormState> {
  const n = name.trim();
  if (!n) return { success: false, message: "Name is required." };
  try {
    await db.meal_types.create({ data: { name: n } });
    revalidatePath("/dashboard/hotels/meal-types");
    return { success: true, message: "Meal type added" };
  } catch {
    return { success: false, message: "Name already exists or DB error." };
  }
}

export async function updateMealType(id: number, name: string): Promise<HotelFormState> {
  const n = name.trim();
  if (!n) return { success: false, message: "Name is required." };
  try {
    await db.meal_types.update({ where: { id }, data: { name: n } });
    revalidatePath("/dashboard/hotels/meal-types");
    return { success: true, message: "Meal type updated" };
  } catch {
    return { success: false, message: "Name already exists or DB error." };
  }
}

export async function deleteMealType(id: number): Promise<HotelFormState> {
  try {
    await db.meal_types.delete({ where: { id } });
    revalidatePath("/dashboard/hotels/meal-types");
    return { success: true, message: "Meal type deleted" };
  } catch {
    return { success: false, message: "Cannot delete — may be in use by pricing plans." };
  }
}

export async function getDietTypes() {
  return db.diet_types.findMany({ orderBy: { name: "asc" } });
}

export async function createDietType(name: string): Promise<HotelFormState> {
  const n = name.trim();
  if (!n) return { success: false, message: "Name is required." };
  try {
    await db.diet_types.create({ data: { name: n } });
    revalidatePath("/dashboard/hotels/diet-types");
    return { success: true, message: "Diet type added" };
  } catch {
    return { success: false, message: "Name already exists or DB error." };
  }
}

export async function updateDietType(id: number, name: string): Promise<HotelFormState> {
  const n = name.trim();
  if (!n) return { success: false, message: "Name is required." };
  try {
    await db.diet_types.update({ where: { id }, data: { name: n } });
    revalidatePath("/dashboard/hotels/diet-types");
    return { success: true, message: "Diet type updated" };
  } catch {
    return { success: false, message: "Name already exists or DB error." };
  }
}

export async function deleteDietType(id: number): Promise<HotelFormState> {
  try {
    await db.diet_types.delete({ where: { id } });
    revalidatePath("/dashboard/hotels/diet-types");
    return { success: true, message: "Diet type deleted" };
  } catch {
    return { success: false, message: "Cannot delete — may be in use by pricing plans." };
  }
}

export async function getDestinationsForSelect() {
  return db.destinations.findMany({
    where: { is_active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, region: { select: { name: true } } },
  });
}

// ── Create Hotel ──────────────────────────────────────────────────────────

export async function createHotel(
  _prev: HotelFormState,
  formData: FormData,
): Promise<HotelFormState> {
  const raw = {
    name: formData.get("name"),
    slug: formData.get("slug"),
    destination_id: formData.get("destination_id"),
    thumbnail: formData.get("thumbnail") || undefined,
    category: formData.get("category") || undefined,
    star_rating: formData.get("star_rating") || undefined,
    check_in_time: formData.get("check_in_time") || undefined,
    check_out_time: formData.get("check_out_time") || undefined,
    address: formData.get("address") || undefined,
    description: formData.get("description") || undefined,
    meta_title: formData.get("meta_title") || undefined,
    meta_desc: formData.get("meta_desc") || undefined,
    is_active: formData.get("is_active") === "true",
    latitude: formData.get("latitude") || undefined,
    longitude: formData.get("longitude") || undefined,
  };

  const parsed = HotelSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      message: "Validation failed",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const existing = await db.hotels.findUnique({ where: { slug: parsed.data.slug } });
    if (existing) {
      return { success: false, message: "Slug already exists", errors: { slug: ["Slug taken"] } };
    }

    await db.$transaction(async (tx) => {
      const hotel = await tx.hotels.create({
        data: { ...parsed.data, stay_type: (formData.get("stay_type") as string) || null },
      });
      await tx.hotel_image_categories.createMany({
        data: ALL_SYSTEM_HOTEL_CATEGORIES.map((cat) => ({
          hotel_id: hotel.id,
          room_pricing_id: null,
          name: cat.name,
          is_required: cat.is_required,
          is_system: cat.is_system,
          sort_order: cat.sort_order,
        })),
      });
    });

    revalidatePath("/dashboard/hotels");
    return { success: true, message: "Hotel created successfully" };
  } catch {
    return { success: false, message: "Database error. Please try again." };
  }
}

// ── Update Hotel Details ──────────────────────────────────────────────────

export async function updateHotelDetails(
  id: number,
  _prev: HotelFormState,
  formData: FormData,
): Promise<HotelFormState> {
  const raw = {
    name: formData.get("name"),
    slug: formData.get("slug"),
    destination_id: formData.get("destination_id"),
    thumbnail: formData.get("thumbnail") || undefined,
    category: formData.get("category") || undefined,
    star_rating: formData.get("star_rating") || undefined,
    check_in_time: formData.get("check_in_time") || undefined,
    check_out_time: formData.get("check_out_time") || undefined,
    address: formData.get("address") || undefined,
    description: formData.get("description") || undefined,
    meta_title: formData.get("meta_title") || undefined,
    meta_desc: formData.get("meta_desc") || undefined,
    is_active: formData.get("is_active") === "true",
    latitude: formData.get("latitude") || undefined,
    longitude: formData.get("longitude") || undefined,
  };

  const parsed = HotelSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      message: "Validation failed",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const current = await db.hotels.findUnique({ where: { id }, select: { thumbnail: true } });
    if (
      current?.thumbnail &&
      parsed.data.thumbnail &&
      parsed.data.thumbnail !== current.thumbnail
    ) {
      await deleteFromR2(current.thumbnail).catch(console.error);
    }

    await db.hotels.update({
      where: { id },
      data: { ...parsed.data, stay_type: (formData.get("stay_type") as string) || null },
    });
    revalidatePath("/dashboard/hotels");
    revalidatePath(`/dashboard/hotels/${id}`);
    return { success: true, message: "Hotel details updated" };
  } catch {
    return { success: false, message: "Database error. Please try again." };
  }
}

// ── Toggle Active ─────────────────────────────────────────────────────────

export async function toggleHotelActive(id: number, is_active: boolean) {
  await db.hotels.update({ where: { id }, data: { is_active } });
  revalidatePath("/dashboard/hotels");
}

// ── Delete Hotel ──────────────────────────────────────────────────────────

export async function deleteHotel(id: number): Promise<HotelFormState> {
  try {
    const hotel = await db.hotels.findUnique({
      where: { id },
      include: {
        images: { select: { url: true, thumbnail: true } },
        hotelRooms: { include: { images: { select: { url: true, thumbnail: true } } } },
        packages: { select: { id: true }, take: 1 },
      },
    });

    if (!hotel) return { success: false, message: "Hotel not found" };
    if (hotel.packages.length > 0) {
      return {
        success: false,
        message: "Cannot delete — hotel is linked to packages. Remove from packages first.",
      };
    }

    const roomImageKeys = hotel.hotelRooms.flatMap((r) =>
      r.images.flatMap((img) => [img.url, img.thumbnail].filter(Boolean) as string[])
    );
    const r2Keys = [
      ...new Set(
        [
          hotel.thumbnail,
          ...hotel.images.flatMap((img) => [img.url, img.thumbnail]),
          ...roomImageKeys,
        ].filter(Boolean) as string[]
      ),
    ];
    await Promise.all(r2Keys.map((key) => deleteFromR2(key).catch(console.error)));

    const roomIds = hotel.hotelRooms.map((r) => r.id);
    await db.$transaction([
      db.hotel_images.deleteMany({ where: { hotel_id: id } }),
      db.hotel_image_categories.deleteMany({ where: { hotel_id: id } }),
      ...(roomIds.length > 0
        ? [db.hotel_room_images.deleteMany({ where: { room_id: { in: roomIds } } })]
        : []),
      db.hotel_room_pricing.deleteMany({ where: { hotel_id: id } }),
      db.hotel_rooms.deleteMany({ where: { hotel_id: id } }),
      db.hotels.delete({ where: { id } }),
    ]);

    revalidatePath("/dashboard/hotels");
    return { success: true, message: "Hotel deleted" };
  } catch {
    return { success: false, message: "Database error. Please try again." };
  }
}

// ── Hotel Rooms (hotel_rooms) ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseJson(val: FormDataEntryValue | null): any {
  if (!val || val === "" || val === "null") return null;
  try {
    return JSON.parse(val as string);
  } catch {
    return null;
  }
}

export async function createRoom(hotel_id: number, formData: FormData): Promise<HotelFormState> {
  try {
    const name = (formData.get("name") as string).trim();
    const slug = (formData.get("slug") as string).trim();
    if (!name || !slug) return { success: false, message: "Name and slug are required." };

    const exists = await db.hotel_rooms.findUnique({
      where: { hotel_id_slug: { hotel_id, slug } },
    });
    if (exists) return { success: false, message: "A room with this slug already exists." };

    const count = await db.hotel_rooms.count({ where: { hotel_id } });
    const room = await db.hotel_rooms.create({
      data: {
        hotel_id,
        name,
        slug,
        area_sqft: formData.get("area_sqft") ? Number(formData.get("area_sqft")) : null,
        bed_type: (formData.get("bed_type") as string) || null,
        view_type: (formData.get("view_type") as string) || null,
        max_occupancy: Number(formData.get("max_occupancy")) || 3,
        description: (formData.get("description") as string) || null,
        amenities: parseJson(formData.get("amenities")),
        features: parseJson(formData.get("features")),
        bathroom: parseJson(formData.get("bathroom")),
        facilities: parseJson(formData.get("facilities")),
        is_active: formData.get("is_active") === "true",
        sort_order: count,
      },
      select: { id: true },
    });

    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Room added", id: room.id };
  } catch {
    return { success: false, message: "Database error." };
  }
}

export async function updateRoom(
  id: number,
  hotel_id: number,
  formData: FormData,
): Promise<HotelFormState> {
  try {
    const name = (formData.get("name") as string).trim();
    if (!name) return { success: false, message: "Name is required." };

    await db.hotel_rooms.update({
      where: { id },
      data: {
        name,
        area_sqft: formData.get("area_sqft") ? Number(formData.get("area_sqft")) : null,
        bed_type: (formData.get("bed_type") as string) || null,
        view_type: (formData.get("view_type") as string) || null,
        max_occupancy: Number(formData.get("max_occupancy")) || 3,
        description: (formData.get("description") as string) || null,
        amenities: parseJson(formData.get("amenities")),
        features: parseJson(formData.get("features")),
        bathroom: parseJson(formData.get("bathroom")),
        facilities: parseJson(formData.get("facilities")),
        is_active: formData.get("is_active") === "true",
      },
    });

    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Room updated" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

export async function deleteRoom(id: number, hotel_id: number): Promise<HotelFormState> {
  try {
    const room = await db.hotel_rooms.findUnique({
      where: { id },
      include: { images: { select: { url: true, thumbnail: true } } },
    });
    if (!room) return { success: false, message: "Room not found" };

    const r2Keys = [
      ...new Set(
        room.images.flatMap((img) => [img.url, img.thumbnail].filter(Boolean) as string[])
      ),
    ];
    await Promise.all(r2Keys.map((key) => deleteFromR2(key).catch(console.error)));

    await db.$transaction([
      db.hotel_room_pricing.deleteMany({ where: { room_id: id } }),
      db.hotel_room_images.deleteMany({ where: { room_id: id } }),
      db.hotel_rooms.delete({ where: { id } }),
    ]);

    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Room deleted" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

// ── Room Pricing (hotel_room_pricing) ─────────────────────────────────────

export async function createRoomPricing(
  hotel_id: number,
  formData: FormData,
): Promise<HotelFormState> {
  try {
    const room_id = Number(formData.get("room_id"));
    if (!room_id) return { success: false, message: "Room is required." };
    const price = Number(formData.get("price_per_night"));
    if (!price || price <= 0) return { success: false, message: "Valid base price is required." };

    const validFrom = formData.get("valid_from") as string;
    const validTo = formData.get("valid_to") as string;
    const count = await db.hotel_room_pricing.count({ where: { hotel_id } });

    await db.hotel_room_pricing.create({
      data: {
        hotel_id,
        room_id,
        plan_name: (formData.get("plan_name") as string) || null,
        meal_type_id: formData.get("meal_type_id") ? Number(formData.get("meal_type_id")) : null,
        diet_type_id: formData.get("diet_type_id") ? Number(formData.get("diet_type_id")) : null,
        price_per_night: price,
        original_price: formData.get("original_price") ? Number(formData.get("original_price")) : null,
        extra_bed_rate: formData.get("extra_bed_rate") ? Number(formData.get("extra_bed_rate")) : null,
        margin_percentage: Number(formData.get("margin_percentage")) || 10,
        gst_percentage: Number(formData.get("gst_percentage")) || 18,
        valid_from: validFrom ? new Date(validFrom) : null,
        valid_to: validTo ? new Date(validTo) : null,
        is_active: formData.get("is_active") === "true",
        sort_order: count,
      },
    });

    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Pricing plan added" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

export async function updateRoomPricing(
  id: number,
  hotel_id: number,
  formData: FormData,
): Promise<HotelFormState> {
  try {
    const room_id = Number(formData.get("room_id"));
    if (!room_id) return { success: false, message: "Room is required." };
    const price = Number(formData.get("price_per_night"));
    if (!price || price <= 0) return { success: false, message: "Valid base price is required." };

    const validFrom = formData.get("valid_from") as string;
    const validTo = formData.get("valid_to") as string;

    await db.hotel_room_pricing.update({
      where: { id },
      data: {
        room_id,
        plan_name: (formData.get("plan_name") as string) || null,
        meal_type_id: formData.get("meal_type_id") ? Number(formData.get("meal_type_id")) : null,
        diet_type_id: formData.get("diet_type_id") ? Number(formData.get("diet_type_id")) : null,
        price_per_night: price,
        original_price: formData.get("original_price") ? Number(formData.get("original_price")) : null,
        extra_bed_rate: formData.get("extra_bed_rate") ? Number(formData.get("extra_bed_rate")) : null,
        margin_percentage: Number(formData.get("margin_percentage")) || 10,
        gst_percentage: Number(formData.get("gst_percentage")) || 18,
        valid_from: validFrom ? new Date(validFrom) : null,
        valid_to: validTo ? new Date(validTo) : null,
        is_active: formData.get("is_active") === "true",
      },
    });

    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Pricing plan updated" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

export async function deleteRoomPricing(id: number, hotel_id: number): Promise<HotelFormState> {
  try {
    await db.hotel_room_pricing.delete({ where: { id } });
    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Pricing plan deleted" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

// ── Occupancy Prices ──────────────────────────────────────────────────────

export async function upsertOccupancyPrice(
  pricing_id: number,
  hotel_id: number,
  occupancy: number,
  price_per_night: number,
  original_price?: number | null,
): Promise<HotelFormState> {
  try {
    await db.hotel_room_occupancy_prices.upsert({
      where: { pricing_id_occupancy: { pricing_id, occupancy } },
      create: { pricing_id, occupancy, price_per_night, original_price: original_price ?? null },
      update: { price_per_night, original_price: original_price ?? null },
    });
    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Occupancy price saved" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

export async function deleteOccupancyPrice(id: number, hotel_id: number): Promise<HotelFormState> {
  try {
    await db.hotel_room_occupancy_prices.delete({ where: { id } });
    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Occupancy price removed" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

// ── Child Policies ────────────────────────────────────────────────────────

export async function getChildPolicies(hotel_id: number) {
  return db.hotel_child_policies.findMany({
    where: { hotel_id },
    orderBy: { sort_order: "asc" },
  });
}

export async function createChildPolicy(
  hotel_id: number,
  data: {
    age_from: number;
    age_to: number;
    charge_type: string;
    price?: number | null;
    description?: string | null;
    is_active: boolean;
  },
): Promise<HotelFormState> {
  try {
    const count = await db.hotel_child_policies.count({ where: { hotel_id } });
    await db.hotel_child_policies.create({
      data: { hotel_id, ...data, sort_order: count },
    });
    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Child policy added" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

export async function updateChildPolicy(
  id: number,
  hotel_id: number,
  data: {
    age_from: number;
    age_to: number;
    charge_type: string;
    price?: number | null;
    description?: string | null;
    is_active: boolean;
  },
): Promise<HotelFormState> {
  try {
    await db.hotel_child_policies.update({ where: { id }, data });
    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Child policy updated" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

export async function deleteChildPolicy(id: number, hotel_id: number): Promise<HotelFormState> {
  try {
    await db.hotel_child_policies.delete({ where: { id } });
    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Child policy deleted" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

// ── Room Images (hotel_room_images) ───────────────────────────────────────

export async function createRoomImages(
  room_id: number,
  hotel_id: number,
  images: { url: string; thumbnail?: string; alt?: string }[],
): Promise<HotelFormState> {
  try {
    const existingCount = await db.hotel_room_images.count({ where: { room_id } });
    await db.hotel_room_images.createMany({
      data: images.map((img, i) => ({
        room_id,
        url: img.url,
        thumbnail: img.thumbnail || img.url,
        alt: img.alt || null,
        sort_order: existingCount + i,
        is_primary: existingCount === 0 && i === 0,
      })),
    });
    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Images added" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

export async function deleteRoomImage(
  id: number,
  room_id: number,
  hotel_id: number,
  url: string,
  thumbnail?: string,
): Promise<HotelFormState> {
  try {
    const keys = [...new Set([url, thumbnail].filter(Boolean) as string[])];
    await Promise.all(keys.map((k) => deleteFromR2(k).catch(console.error)));
    await db.hotel_room_images.delete({ where: { id } });
    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Image deleted" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

export async function setPrimaryRoomImage(
  id: number,
  room_id: number,
  hotel_id: number,
): Promise<HotelFormState> {
  try {
    await db.$transaction([
      db.hotel_room_images.updateMany({ where: { room_id }, data: { is_primary: false } }),
      db.hotel_room_images.update({ where: { id }, data: { is_primary: true } }),
    ]);
    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Primary image set" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

// ── Image Categories ──────────────────────────────────────────────────────

export async function createImageCategory(
  hotel_id: number,
  name: string,
): Promise<HotelFormState> {
  try {
    const count = await db.hotel_image_categories.count({ where: { hotel_id } });
    await db.hotel_image_categories.create({
      data: { hotel_id, name, is_required: false, is_system: false, sort_order: count },
    });
    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Category added" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

export async function deleteImageCategory(
  id: number,
  hotel_id: number,
): Promise<HotelFormState> {
  try {
    const category = await db.hotel_image_categories.findUnique({
      where: { id },
      include: { images: { select: { url: true, thumbnail: true } } },
    });
    if (!category) return { success: false, message: "Category not found" };
    if (category.is_required)
      return { success: false, message: "Required categories cannot be deleted" };

    const r2Keys = [
      ...new Set(
        category.images.flatMap((img) => [img.url, img.thumbnail].filter(Boolean) as string[])
      ),
    ];
    await Promise.all(r2Keys.map((key) => deleteFromR2(key).catch(console.error)));

    await db.$transaction([
      db.hotel_images.deleteMany({ where: { category_id: id } }),
      db.hotel_image_categories.delete({ where: { id } }),
    ]);

    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Category deleted" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

// ── Hotel Images ──────────────────────────────────────────────────────────

export async function addHotelImages(
  hotel_id: number,
  category_id: number,
  images: { url: string; thumbnail?: string; alt?: string }[],
): Promise<HotelFormState> {
  try {
    const existingInCategory = await db.hotel_images.count({ where: { category_id } });
    const totalInHotel = await db.hotel_images.count({ where: { hotel_id } });

    await db.hotel_images.createMany({
      data: images.map((img, i) => ({
        hotel_id,
        category_id,
        url: img.url,
        thumbnail: img.thumbnail || img.url,
        alt: img.alt || null,
        sort_order: existingInCategory + i,
        is_primary: totalInHotel === 0 && i === 0,
      })),
    });

    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Images added" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

export async function deleteHotelImage(
  id: number,
  hotel_id: number,
  url: string,
  thumbnail?: string,
): Promise<HotelFormState> {
  try {
    const keys = [...new Set([url, thumbnail].filter(Boolean) as string[])];
    await Promise.all(keys.map((k) => deleteFromR2(k).catch(console.error)));
    await db.hotel_images.delete({ where: { id } });
    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Image deleted" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

export async function setPrimaryImage(id: number, hotel_id: number): Promise<HotelFormState> {
  try {
    await db.$transaction([
      db.hotel_images.updateMany({ where: { hotel_id }, data: { is_primary: false } }),
      db.hotel_images.update({ where: { id }, data: { is_primary: true } }),
    ]);
    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Primary image set" };
  } catch {
    return { success: false, message: "Database error." };
  }
}
