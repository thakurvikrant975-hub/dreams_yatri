"use server";

import { db } from "@/app/lib/db";
import { deleteFromR2 } from "@/app/lib/r2/r2delete";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  ALL_SYSTEM_HOTEL_CATEGORIES,
  getRoomCategoryName,
} from "@/app/lib/hotelImageCategories"

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
});

export type HotelFormState = {
  success: boolean;
  message: string;
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
          room_pricing: true,
          images: true,
          packages: true,
        },
      },
    },
  });
}

export async function getHotelById(id: number) {
  return db.hotels.findUnique({
    where: { id },
    include: {
      destination: { select: { id: true, name: true } },
      room_pricing: { orderBy: { sort_order: "asc" } },
      image_categories: {
        orderBy: { sort_order: "asc" },
        include: {
          images: { orderBy: { sort_order: "asc" } },
          room_pricing: { select: { id: true, room_type: true } },
        },
      },
    },
  });
}

export async function getDestinationsForSelect() {
  return db.destinations.findMany({
    where: { is_active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, region: { select: { name: true } } },
  });
}

// ── Create ────────────────────────────────────────────────────────────────

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
  };

  const parsed = HotelSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      message: "Validation failed",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const roomsRaw: any[] = JSON.parse(formData.get("rooms") as string || "[]");

  try {
    const existing = await db.hotels.findUnique({ where: { slug: parsed.data.slug } });
    if (existing) {
      return { success: false, message: "Slug already exists", errors: { slug: ["Slug taken"] } };
    }

    await db.$transaction(async (tx) => {
      // 1. Create hotel
      const hotel = await tx.hotels.create({ data: parsed.data });

      // 2. Create room pricing rows and track created rooms
      const createdRooms: { id: number; room_type: string }[] = [];
      for (const [i, r] of roomsRaw.entries()) {
        const room = await tx.hotel_room_pricing.create({
          data: {
            hotel_id: hotel.id,
            room_type: r.room_type,
            description: r.description || null,
            occupancy: Number(r.occupancy) || 2,
            price_per_night: Number(r.price_per_night),
            original_price: r.original_price ? Number(r.original_price) : null,
            season: r.season || "all",
            margin_percentage: Number(r.margin_percentage) || 10,
            sort_order: i,
            is_active: true,
            amenities: r.amenities || [],
          },
        });
        createdRooms.push({ id: room.id, room_type: room.room_type });
      }

      // 3. Create system hotel-level image categories
      await tx.hotel_image_categories.createMany({
        data: ALL_SYSTEM_HOTEL_CATEGORIES.map(cat => ({
          hotel_id: hotel.id,
          room_pricing_id: null,
          name: cat.name,
          is_required: cat.is_required,
          is_system: cat.is_system,
          sort_order: cat.sort_order,
        })),
      });

      // 4. Create one image category per room type
      if (createdRooms.length > 0) {
        await tx.hotel_image_categories.createMany({
          data: createdRooms.map((room, i) => ({
            hotel_id: hotel.id,
            room_pricing_id: room.id,
            name: getRoomCategoryName(room.room_type),
            is_required: false,
            is_system: true,
            sort_order: ALL_SYSTEM_HOTEL_CATEGORIES.length + i,
          })),
        });
      }
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
    const current = await db.hotels.findUnique({
      where: { id },
      select: { thumbnail: true },
    });

    // If thumbnail replaced — delete old from R2
    if (
      current?.thumbnail &&
      parsed.data.thumbnail &&
      parsed.data.thumbnail !== current.thumbnail
    ) {
      await deleteFromR2(current.thumbnail).catch(console.error);
    }

    await db.hotels.update({ where: { id }, data: parsed.data });
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

    // Collect all R2 keys: hotel thumbnail + all image urls + image thumbnails
    const r2Keys = [
      ...new Set([
        hotel.thumbnail,
        ...hotel.images.flatMap(img => [img.url, img.thumbnail]),
      ].filter(Boolean) as string[]),
    ];

    await Promise.all(r2Keys.map(key => deleteFromR2(key).catch(console.error)));

    // Delete in FK-safe order
    await db.$transaction([
      db.hotel_images.deleteMany({ where: { hotel_id: id } }),
      db.hotel_image_categories.deleteMany({ where: { hotel_id: id } }),
      db.hotel_room_pricing.deleteMany({ where: { hotel_id: id } }),
      db.hotels.delete({ where: { id } }),
    ]);

    revalidatePath("/dashboard/hotels");
    return { success: true, message: "Hotel deleted" };
  } catch {
    return { success: false, message: "Database error. Please try again." };
  }
}

// ── Room Pricing ──────────────────────────────────────────────────────────

export async function createRoom(hotel_id: number, formData: FormData): Promise<HotelFormState> {
  try {
    const room = await db.hotel_room_pricing.create({
      data: {
        hotel_id,
        room_type: formData.get("room_type") as string,
        description: (formData.get("description") as string) || null,
        occupancy: Number(formData.get("occupancy")) || 2,
        price_per_night: Number(formData.get("price_per_night")),
        original_price: formData.get("original_price") ? Number(formData.get("original_price")) : null,
        season: (formData.get("season") as string) || "all",
        margin_percentage: Number(formData.get("margin_percentage")) || 10,
        sort_order: Number(formData.get("sort_order")) || 0,
        is_active: formData.get("is_active") === "true",
        amenities: JSON.parse((formData.get("amenities") as string) || "[]"),
      },
    });

    // Auto-create image category for this room
    const count = await db.hotel_image_categories.count({ where: { hotel_id } });
    await db.hotel_image_categories.create({
      data: {
        hotel_id,
        room_pricing_id: room.id,
        name: getRoomCategoryName(room.room_type),
        is_required: false,
        is_system: true,
        sort_order: count,
      },
    });

    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Room added" };
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
    const room = await db.hotel_room_pricing.update({
      where: { id },
      data: {
        room_type: formData.get("room_type") as string,
        description: (formData.get("description") as string) || null,
        occupancy: Number(formData.get("occupancy")) || 2,
        price_per_night: Number(formData.get("price_per_night")),
        original_price: formData.get("original_price") ? Number(formData.get("original_price")) : null,
        season: (formData.get("season") as string) || "all",
        margin_percentage: Number(formData.get("margin_percentage")) || 10,
        is_active: formData.get("is_active") === "true",
        amenities: JSON.parse((formData.get("amenities") as string) || "[]"),
      },
    });

    // Sync category name if room_type changed
    await db.hotel_image_categories.updateMany({
      where: { hotel_id, room_pricing_id: id },
      data: { name: getRoomCategoryName(room.room_type) },
    });

    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Room updated" };
  } catch {
    return { success: false, message: "Database error." };
  }
}

export async function deleteRoom(id: number, hotel_id: number): Promise<HotelFormState> {
  try {
    // Find room's image category + its images
    const category = await db.hotel_image_categories.findFirst({
      where: { hotel_id, room_pricing_id: id },
      include: { images: { select: { url: true, thumbnail: true } } },
    });

    if (category) {
      const r2Keys = [
        ...new Set(
          category.images.flatMap(img =>
            [img.url, img.thumbnail].filter(Boolean) as string[]
          )
        ),
      ];
      await Promise.all(r2Keys.map(key => deleteFromR2(key).catch(console.error)));

      await db.$transaction([
        db.hotel_images.deleteMany({ where: { category_id: category.id } }),
        db.hotel_image_categories.delete({ where: { id: category.id } }),
        db.hotel_room_pricing.delete({ where: { id } }),
      ]);
    } else {
      await db.hotel_room_pricing.delete({ where: { id } });
    }

    revalidatePath(`/dashboard/hotels/${hotel_id}`);
    return { success: true, message: "Room deleted" };
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
      data: {
        hotel_id,
        name,
        is_required: false,
        is_system: false,
        sort_order: count,
      },
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
    if (category.is_required) return { success: false, message: "Required categories cannot be deleted" };

    const r2Keys = [
      ...new Set(
        category.images.flatMap(img =>
          [img.url, img.thumbnail].filter(Boolean) as string[]
        )
      ),
    ];
    await Promise.all(r2Keys.map(key => deleteFromR2(key).catch(console.error)));

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
    await Promise.all(keys.map(k => deleteFromR2(k).catch(console.error)));
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