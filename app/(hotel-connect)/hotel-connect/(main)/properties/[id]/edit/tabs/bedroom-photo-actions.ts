"use server";

import { redirect } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import { uploadToR2 } from "@/app/lib/r2/r2upload";
import { describeSizeRejection, describeTypeRejection, describeUploadFailure } from "@/app/lib/upload-errors";
import { defaultBedroom, type BedroomDetail } from "../bedroom/[n]/bedroom-types";

// Homestay bedrooms have no dedicated DB row/table (they're a JSON array on
// hotels.hs_bedroom_details, indexed positionally) — so unlike hotel rooms
// (hotel_room_images, FK'd to hotel_rooms.id) bedroom photos are just a
// `photos: string[]` field patched into that same JSON entry.

const MAX_BEDROOM_PHOTOS = 20;
const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB per file
const ALLOWED_TYPE_PREFIXES = ["image/"];

async function loadBedrooms(hotelId: number, ownerId: string) {
  const hotel = await db.hotels.findFirst({
    where: { id: hotelId, owner_id: ownerId },
    select: { id: true, hs_bedrooms: true, hs_bedroom_details: true },
  });
  if (!hotel) return null;

  const total = hotel.hs_bedrooms ?? 1;
  const existing = (hotel.hs_bedroom_details as BedroomDetail[] | null) ?? [];
  const list: BedroomDetail[] = Array.from({ length: total }, (_, i) => existing[i] ?? defaultBedroom(i + 1));
  return { list };
}

export async function listBedroomPhotos(
  hotelId: number,
  bedroomIndex: number,
): Promise<{ error?: string; photos?: string[] }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");

  const data = await loadBedrooms(hotelId, session.user.id);
  if (!data) return { error: "Property not found." };
  const bedroom = data.list[bedroomIndex];
  if (!bedroom) return { error: "Bedroom not found." };

  return { photos: bedroom.photos ?? [] };
}

export async function uploadBedroomPhotos(
  hotelId: number,
  bedroomIndex: number,
  formData: FormData,
): Promise<{ error?: string; photos?: string[] }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");

  const data = await loadBedrooms(hotelId, session.user.id);
  if (!data) return { error: "Property not found." };
  if (!data.list[bedroomIndex]) return { error: "Bedroom not found." };

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

  const existingPhotos = data.list[bedroomIndex].photos ?? [];
  const room = MAX_BEDROOM_PHOTOS - existingPhotos.length;
  if (room <= 0) return { error: `This bedroom already has the maximum of ${MAX_BEDROOM_PHOTOS} photos.` };
  const toUpload = valid.slice(0, room);

  const uploaded: string[] = [];
  const failed: string[] = [
    ...sizeRejected.map((f) => describeSizeRejection(f, MAX_FILE_BYTES)),
    ...typeRejected.map((f) => describeTypeRejection(f)),
  ];

  for (const file of toUpload) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const { url } = await uploadToR2({
        file: buffer,
        folder: "hotels",
        fileName: file.name,
        contentType: file.type || "image/jpeg",
      });
      uploaded.push(url);
    } catch (err) {
      console.error("[uploadBedroomPhotos] file error:", file.name, err);
      failed.push(describeUploadFailure(file, err));
    }
  }

  if (!uploaded.length) {
    return { error: "No photos could be uploaded. Please check the files and try again." };
  }

  data.list[bedroomIndex] = { ...data.list[bedroomIndex], photos: [...existingPhotos, ...uploaded] };
  try {
    await db.hotels.update({ where: { id: hotelId }, data: { hs_bedroom_details: data.list } });
  } catch (err) {
    console.error("[uploadBedroomPhotos] save error:", err);
    return { error: "Failed to save uploaded photos." };
  }

  if (failed.length > 0) {
    return {
      photos: uploaded,
      error: `${uploaded.length} photo${uploaded.length > 1 ? "s" : ""} uploaded. ${failed.length} failed — ${failed.join(", ")}`,
    };
  }
  return { photos: uploaded };
}

export async function deleteBedroomPhoto(
  hotelId: number,
  bedroomIndex: number,
  url: string,
): Promise<{ error?: string }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");

  const data = await loadBedrooms(hotelId, session.user.id);
  if (!data) return { error: "Property not found." };
  if (!data.list[bedroomIndex]) return { error: "Bedroom not found." };

  try {
    // Deliberately NOT deleting the R2 object here — see deleteHotelPhoto's
    // comment in photo-actions.ts. A package built off this homestay can
    // have frozen this exact URL into its itinerary snapshot; hard-deleting
    // the object breaks that PDF even though this delete has nothing to do
    // with it. Dropping it from hs_bedroom_details is enough to remove it
    // from hotel-connect.
    const existingPhotos = data.list[bedroomIndex].photos ?? [];
    data.list[bedroomIndex] = { ...data.list[bedroomIndex], photos: existingPhotos.filter((p) => p !== url) };

    await db.hotels.update({ where: { id: hotelId }, data: { hs_bedroom_details: data.list } });
    return {};
  } catch (err) {
    console.error("[deleteBedroomPhoto]", err);
    return { error: "Failed to delete photo." };
  }
}
