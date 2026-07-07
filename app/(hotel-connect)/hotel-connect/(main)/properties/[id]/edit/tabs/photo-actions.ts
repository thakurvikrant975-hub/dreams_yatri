"use server";

import { redirect } from "next/navigation";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import { uploadToR2 } from "@/app/lib/r2/r2upload";
import { r2, R2_BUCKET } from "@/app/lib/r2/r2";

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
  const valid = files.filter((f) => f.size > 0);
  if (!valid.length) return { error: "No files selected." };

  const categoryId = await getDefaultCategory(hotelId);
  const existingCount = await db.hotel_images.count({ where: { hotel_id: hotelId } });

  let count = 0;
  const failed: string[] = [];
  const created: HotelPhoto[] = [];

  for (const file of valid) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const { url } = await uploadToR2({
        file: buffer,
        folder: "hotels",
        fileName: file.name,
        contentType: file.type || "image/jpeg",
      });
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
      failed.push(file.name);
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
const MIN_ROOM_TAGGED_PHOTOS = 2;
const ROOM_TAG = "Bedroom";

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

  const roomTaggedCount = allImages.filter((img) =>
    (img.tags as string[]).includes(ROOM_TAG)
  ).length;
  if (roomTaggedCount < MIN_ROOM_TAGGED_PHOTOS) {
    return {
      error: `At least ${MIN_ROOM_TAGGED_PHOTOS} photos tagged "${ROOM_TAG}" are required (currently ${roomTaggedCount}).`,
    };
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

    if (image.url) {
      const base = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "").replace(/\/$/, "");
      const key = image.url.startsWith(base + "/") ? image.url.slice(base.length + 1) : null;
      if (key) {
        try {
          await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
        } catch {
          // best-effort — DB record still removed
        }
      }
    }

    await db.hotel_images.delete({ where: { id: imageId } });

    if (image.is_primary) {
      const next = await db.hotel_images.findFirst({
        where: { hotel_id: hotelId },
        orderBy: [{ sort_order: "asc" }],
        select: { id: true, url: true },
      });
      await db.$transaction([
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
