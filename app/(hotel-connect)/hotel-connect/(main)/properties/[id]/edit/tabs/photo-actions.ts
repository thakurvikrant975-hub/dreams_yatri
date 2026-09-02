"use server";

import { redirect } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import { uploadToR2 } from "@/app/lib/r2/r2upload";
import { deleteFromR2 } from "@/app/lib/r2/r2delete";
import { describeSizeRejection, describeTypeRejection, describeUploadFailure } from "@/app/lib/upload-errors";

// ── Types ─────────────────────────────────────────────────────────────────────

export type HotelPhoto = {
  id: number;
  url: string | null;
  thumbnail: string | null;
  tags: string[];
  is_primary: boolean;
  category_id: number;
  sort_order: number;
};

export type PhotoCategory = {
  id: number;
  name: string;
  is_system: boolean;
  photos: HotelPhoto[];
};

// ── Upload limits ─────────────────────────────────────────────────────────────

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB per file
const MAX_PHOTOS_PER_HOTEL = 60;
const ALLOWED_TYPE_PREFIXES = ["image/", "video/"];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getDefaultCategory(hotelId: number): Promise<number> {
  const existing = await db.hotel_image_categories.findFirst({
    where: { hotel_id: hotelId, is_system: true, name: "Property" },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await db.hotel_image_categories.create({
    data: { hotel_id: hotelId, name: "Property", is_system: true, sort_order: 0 },
    select: { id: true },
  });
  return created.id;
}

async function assertOwner(hotelId: number, ownerId: string) {
  const hotel = await db.hotels.findFirst({
    where: { id: hotelId, owner_id: ownerId },
    select: { id: true },
  });
  return !!hotel;
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function fetchHotelPhotos(hotelId: number): Promise<{
  categories: PhotoCategory[];
}> {
  const raw = await db.hotel_image_categories.findMany({
    where: { hotel_id: hotelId },
    orderBy: { sort_order: "asc" },
    include: {
      images: {
        orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
      },
    },
  });

  const categories: PhotoCategory[] = raw.map((cat) => ({
    id: cat.id,
    name: cat.name,
    is_system: cat.is_system,
    photos: cat.images.map((img) => ({
      id: img.id,
      url: img.url,
      thumbnail: img.thumbnail,
      tags: img.tags as string[],
      is_primary: img.is_primary,
      category_id: img.category_id,
      sort_order: img.sort_order,
    })),
  }));

  return { categories };
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export async function uploadHotelPhotos(
  hotelId: number,
  formData: FormData,
  tags: string[] = [],
): Promise<{ error?: string; count?: number; photos?: HotelPhoto[] }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");
  if (!(await assertOwner(hotelId, session.user.id))) return { error: "Property not found." };

  const files = formData.getAll("photos") as File[];
  const sizeRejected = files.filter((f) => f.size > 0 && f.size > MAX_FILE_BYTES);
  const typeRejected = files.filter((f) =>
    f.size > 0 && f.size <= MAX_FILE_BYTES && !ALLOWED_TYPE_PREFIXES.some((p) => f.type.startsWith(p))
  );
  const valid = files.filter((f) =>
    f.size > 0 && f.size <= MAX_FILE_BYTES && ALLOWED_TYPE_PREFIXES.some((p) => f.type.startsWith(p))
  );
  if (!valid.length) {
    if (sizeRejected.length) return { error: `Can't upload ${describeSizeRejection(sizeRejected[0], MAX_FILE_BYTES)}.` };
    if (typeRejected.length) return { error: `Can't upload ${describeTypeRejection(typeRejected[0])} — only images or videos are allowed.` };
    return { error: "No files selected." };
  }

  const existingCount = await db.hotel_images.count({ where: { hotel_id: hotelId } });
  if (existingCount >= MAX_PHOTOS_PER_HOTEL) {
    return { error: `This property already has the maximum of ${MAX_PHOTOS_PER_HOTEL} photos.` };
  }
  const room = MAX_PHOTOS_PER_HOTEL - existingCount;
  const toUpload = valid.slice(0, room);

  const categoryId = await getDefaultCategory(hotelId);

  let count = 0;
  const failed: string[] = [
    ...sizeRejected.map((f) => describeSizeRejection(f, MAX_FILE_BYTES)),
    ...typeRejected.map((f) => describeTypeRejection(f)),
  ];
  const created: HotelPhoto[] = [];

  for (const file of toUpload) {
    let uploadedKey: string | null = null;
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const { key, url } = await uploadToR2({
        file: buffer,
        folder: "hotels",
        fileName: file.name,
        contentType: file.type || "image/jpeg",
      });
      uploadedKey = key;
      const isPrimary = existingCount === 0 && count === 0;
      const image = await db.hotel_images.create({
        data: {
          hotel_id: hotelId,
          category_id: categoryId,
          url,
          tags,
          sort_order: existingCount + count,
          is_primary: isPrimary,
        },
      });
      if (isPrimary) {
        await db.hotels.update({ where: { id: hotelId }, data: { thumbnail: url } });
      }
      created.push({
        id: image.id,
        url: image.url,
        thumbnail: image.thumbnail,
        tags: image.tags,
        is_primary: image.is_primary,
        category_id: image.category_id,
        sort_order: image.sort_order,
      });
      count++;
    } catch (err) {
      console.error("[uploadHotelPhotos] file error:", file.name, err);
      // If the DB record failed after the R2 upload already succeeded, don't
      // leave the object orphaned in the bucket.
      if (uploadedKey) {
        await deleteFromR2(uploadedKey).catch(() => {});
      }
      failed.push(describeUploadFailure(file, err));
    }
  }

  if (count === 0) {
    return { error: "No photos could be uploaded. Please check the files and try again." };
  }
  if (failed.length > 0) {
    return {
      count,
      photos: created,
      error: `${count} photo${count > 1 ? "s" : ""} uploaded. ${failed.length} failed — ${failed.join(", ")}`,
    };
  }
  return { count, photos: created };
}

export async function getPhotosByTag(hotelId: number, tag: string): Promise<HotelPhoto[]> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");
  if (!(await assertOwner(hotelId, session.user.id))) return [];

  const images = await db.hotel_images.findMany({
    where: { hotel_id: hotelId, tags: { has: tag } },
    orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
  });

  return images.map((img) => ({
    id: img.id,
    url: img.url,
    thumbnail: img.thumbnail,
    tags: img.tags,
    is_primary: img.is_primary,
    category_id: img.category_id,
    sort_order: img.sort_order,
  }));
}

export async function setCoverPhoto(
  hotelId: number,
  imageId: number,
): Promise<{ error?: string }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");
  if (!(await assertOwner(hotelId, session.user.id))) return { error: "Property not found." };

  try {
    const image = await db.hotel_images.findUnique({
      where: { id: imageId },
      select: { url: true },
    });
    await db.$transaction([
      db.hotel_images.updateMany({ where: { hotel_id: hotelId }, data: { is_primary: false } }),
      db.hotel_images.update({ where: { id: imageId }, data: { is_primary: true } }),
      db.hotels.update({ where: { id: hotelId }, data: { thumbnail: image?.url ?? null } }),
    ]);
    return {};
  } catch (err) {
    console.error("[setCoverPhoto]", err);
    return { error: "Failed to update cover photo." };
  }
}

export async function savePhotoTags(
  hotelId: number,
  imageId: number,
  tags: string[],
): Promise<{ error?: string }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");
  if (!(await assertOwner(hotelId, session.user.id))) return { error: "Property not found." };

  try {
    await db.hotel_images.update({
      where: { id: imageId, hotel_id: hotelId },
      data: { tags },
    });
    return {};
  } catch (err) {
    return { error: "Failed to save tags." };
  }
}

const MIN_TOTAL_PHOTOS = 6;
const MIN_ROOM_PHOTOS = 2;

export async function proceedPhotos(
  hotelId: number,
  _prev: { error?: string },
  _formData: FormData,
): Promise<{ error?: string }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");

  const hotel = await db.hotels.findFirst({
    where: { id: hotelId, owner_id: session.user.id },
    select: { id: true, wizard_step: true, property_category: true },
  });
  if (!hotel) return { error: "Property not found." };

  const totalImages = await db.hotel_images.count({ where: { hotel_id: hotelId } });
  if (totalImages === 0) return { error: "Upload at least one photo before continuing." };
  if (totalImages < MIN_TOTAL_PHOTOS) {
    return { error: `At least ${MIN_TOTAL_PHOTOS} photos are required. You've uploaded ${totalImages}.` };
  }

  const allImages = await db.hotel_images.findMany({
    where: { hotel_id: hotelId },
    select: { tags: true },
  });
  const untaggedCount = allImages.filter((img) => {
    const tags = img.tags as unknown[];
    return !Array.isArray(tags) || tags.length === 0;
  }).length;
  if (untaggedCount > 0) {
    return {
      error: `${untaggedCount} photo${untaggedCount > 1 ? "s are" : " is"} missing a tag. Add at least one tag to each photo.`,
    };
  }

  // Every active room needs its own photos in Room Images — a hotel-wide
  // "Bedroom" tag can't tell guests apart which room they're looking at.
  if (hotel.property_category !== "HOMESTAY_VILLA") {
    const rooms = await db.hotel_rooms.findMany({
      where: { hotel_id: hotelId, is_active: true },
      select: { id: true, name: true, _count: { select: { images: true } } },
    });
    const shortRoom = rooms.find((r) => r._count.images < MIN_ROOM_PHOTOS);
    if (shortRoom) {
      return {
        error: `"${shortRoom.name}" needs at least ${MIN_ROOM_PHOTOS} photos in Room Images (currently ${shortRoom._count.images}).`,
      };
    }
  }

  const nextStep = hotel.property_category === "HOMESTAY_VILLA" ? 6 : 6;
  await db.hotels.update({
    where: { id: hotelId },
    data: { wizard_step: Math.max(hotel.wizard_step, nextStep) },
  });

  redirect(`/hotel-connect/properties/${hotelId}/edit?tab=6`);
}

export async function deleteHotelPhoto(
  hotelId: number,
  imageId: number,
): Promise<{ error?: string }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");
  if (!(await assertOwner(hotelId, session.user.id))) return { error: "Property not found." };

  try {
    const image = await db.hotel_images.findFirst({
      where: { id: imageId, hotel_id: hotelId },
      select: { id: true, url: true, is_primary: true },
    });
    if (!image) return { error: "Photo not found." };

    // Deliberately NOT deleting the R2 object here. A hotel photo's URL gets
    // copied by value into every package snapshot built while it was live
    // (package-builder/action.ts freezes it into custom_package_stops.image /
    // hotelPhoto / accommodationPhoto as a plain string, not a live
    // reference) — a package built last month can still point at this exact
    // URL. Hard-deleting the object out from under it turned a routine
    // "owner tidies up their photo list" action into a blank image in
    // whatever client-facing PDFs had already been exported, sometimes many
    // of them at once for a popular hotel. Unlinking it from hotel_images is
    // enough to remove it from hotel-connect; the orphaned object just sits
    // in the bucket (cheap) instead of breaking history (expensive).
    await db.hotel_images.delete({ where: { id: imageId } });

    if (image.is_primary) {
      const next = await db.hotel_images.findFirst({
        where: { hotel_id: hotelId },
        orderBy: [{ sort_order: "asc" }],
        select: { id: true, url: true },
      });
      // Reset all rows first (matches setCoverPhoto's pattern) so a concurrent
      // setCoverPhoto call can't race this into leaving two rows is_primary.
      await db.$transaction([
        db.hotel_images.updateMany({ where: { hotel_id: hotelId }, data: { is_primary: false } }),
        ...(next ? [db.hotel_images.update({ where: { id: next.id }, data: { is_primary: true } })] : []),
        db.hotels.update({ where: { id: hotelId }, data: { thumbnail: next?.url ?? null } }),
      ]);
    }

    return {};
  } catch (err) {
    console.error("[deleteHotelPhoto]", err);
    return { error: "Failed to delete photo." };
  }
}
