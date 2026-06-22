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
): Promise<{ error?: string; count?: number }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");
  if (!(await assertOwner(hotelId, session.user.id))) return { error: "Property not found." };

  const files = formData.getAll("photos") as File[];
  const valid = files.filter((f) => f.size > 0);
  if (!valid.length) return { error: "No files selected." };

  const categoryId = await getDefaultCategory(hotelId);
  const existingCount = await db.hotel_images.count({ where: { hotel_id: hotelId } });

  let count = 0;
  try {
    for (const file of valid) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const { url } = await uploadToR2({
        file: buffer,
        folder: "hotels",
        fileName: file.name,
        contentType: file.type || "image/jpeg",
      });
      await db.hotel_images.create({
        data: {
          hotel_id: hotelId,
          category_id: categoryId,
          url,
          tags: [],
          sort_order: existingCount + count,
          is_primary: existingCount === 0 && count === 0,
        },
      });
      count++;
    }
    return { count };
  } catch (err) {
    console.error("[uploadHotelPhotos]", err);
    return { error: err instanceof Error ? err.message : "Upload failed." };
  }
}

export async function setCoverPhoto(
  hotelId: number,
  imageId: number,
): Promise<{ error?: string }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");
  if (!(await assertOwner(hotelId, session.user.id))) return { error: "Property not found." };

  try {
    await db.$transaction([
      db.hotel_images.updateMany({ where: { hotel_id: hotelId }, data: { is_primary: false } }),
      db.hotel_images.update({ where: { id: imageId }, data: { is_primary: true } }),
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
      select: { id: true, url: true },
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
    return {};
  } catch (err) {
    console.error("[deleteHotelPhoto]", err);
    return { error: "Failed to delete photo." };
  }
}
