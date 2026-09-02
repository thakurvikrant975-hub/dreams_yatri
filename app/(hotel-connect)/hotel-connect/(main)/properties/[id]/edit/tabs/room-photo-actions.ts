"use server";

import { redirect } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import { ownsRoom } from "@/app/lib/hotel-inventory/owns-room";
import { uploadToR2 } from "@/app/lib/r2/r2upload";
import { deleteFromR2 } from "@/app/lib/r2/r2delete";
import { describeSizeRejection, describeTypeRejection, describeUploadFailure } from "@/app/lib/upload-errors";

// Photos assigned to a specific room (hotel_room_images) — distinct from the
// Photos tab's hotel-wide, category/tag-based gallery (hotel_images). A guest
// picking "Deluxe Room" should see photos of that room, not just whichever
// property-wide photos happened to get tagged "Bedroom".

export type RoomPhoto = {
  id: number;
  url: string;
  thumbnail: string | null;
  is_primary: boolean;
  sort_order: number;
};

const MAX_ROOM_PHOTOS = 20;
const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB per file
const ALLOWED_TYPE_PREFIXES = ["image/"];

export async function listRoomPhotos(
  hotelId: number,
  roomId: number,
): Promise<{ error?: string; photos?: RoomPhoto[] }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");
  if (!(await ownsRoom(hotelId, roomId, session.user.id))) return { error: "Room not found." };

  const images = await db.hotel_room_images.findMany({
    where: { room_id: roomId },
    orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
  });

  return {
    photos: images.map((img) => ({
      id: img.id,
      url: img.url,
      thumbnail: img.thumbnail,
      is_primary: img.is_primary,
      sort_order: img.sort_order,
    })),
  };
}

export async function uploadRoomPhotos(
  hotelId: number,
  roomId: number,
  formData: FormData,
): Promise<{ error?: string; count?: number; photos?: RoomPhoto[] }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");
  if (!(await ownsRoom(hotelId, roomId, session.user.id))) return { error: "Room not found." };

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
    if (typeRejected.length) return { error: `Can't upload ${describeTypeRejection(typeRejected[0])} — only images are allowed.` };
    return { error: "No files selected." };
  }

  const existingCount = await db.hotel_room_images.count({ where: { room_id: roomId } });
  if (existingCount >= MAX_ROOM_PHOTOS) {
    return { error: `This room already has the maximum of ${MAX_ROOM_PHOTOS} photos.` };
  }
  const room = MAX_ROOM_PHOTOS - existingCount;
  const toUpload = valid.slice(0, room);

  let count = 0;
  const failed: string[] = [
    ...sizeRejected.map((f) => describeSizeRejection(f, MAX_FILE_BYTES)),
    ...typeRejected.map((f) => describeTypeRejection(f)),
  ];
  const created: RoomPhoto[] = [];

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
      const image = await db.hotel_room_images.create({
        data: {
          room_id: roomId,
          url,
          sort_order: existingCount + count,
          is_primary: isPrimary,
        },
      });
      created.push({
        id: image.id,
        url: image.url,
        thumbnail: image.thumbnail,
        is_primary: image.is_primary,
        sort_order: image.sort_order,
      });
      count++;
    } catch (err) {
      console.error("[uploadRoomPhotos] file error:", file.name, err);
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

export async function deleteRoomPhoto(
  hotelId: number,
  roomId: number,
  imageId: number,
): Promise<{ error?: string }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");
  if (!(await ownsRoom(hotelId, roomId, session.user.id))) return { error: "Room not found." };

  try {
    const image = await db.hotel_room_images.findFirst({
      where: { id: imageId, room_id: roomId },
      select: { id: true, url: true, is_primary: true },
    });
    if (!image) return { error: "Photo not found." };

    // Deliberately NOT deleting the R2 object here — see deleteHotelPhoto's
    // comment in photo-actions.ts. A package built off this room can have
    // frozen this exact URL into its itinerary snapshot; hard-deleting the
    // object breaks that PDF even though this delete has nothing to do with
    // it. Unlinking the DB row is enough to remove it from hotel-connect.
    await db.hotel_room_images.delete({ where: { id: imageId } });

    if (image.is_primary) {
      const next = await db.hotel_room_images.findFirst({
        where: { room_id: roomId },
        orderBy: [{ sort_order: "asc" }],
        select: { id: true },
      });
      if (next) {
        await db.hotel_room_images.update({ where: { id: next.id }, data: { is_primary: true } });
      }
    }

    return {};
  } catch (err) {
    console.error("[deleteRoomPhoto]", err);
    return { error: "Failed to delete photo." };
  }
}
