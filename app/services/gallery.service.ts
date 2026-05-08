import { db } from "@/app/lib/db";

// ── Types ──────────────────────────────────────────────────────────────────

export type GallerySlot = {
  id: number;
  position: number;
  image_url: string;
  source_type: "PACKAGE" | "HOTEL" | "ACTIVITY" | "ROOM";
  source_id: number | null;
  label: string | null;
};

export type SourceImage = {
  id: number;
  url: string;
  thumbnail: string | null;
  group_label: string;
  source_id: number;
};

export type GallerySourceImages = {
  PACKAGE: SourceImage[];
  HOTEL: SourceImage[];
  ACTIVITY: SourceImage[];
  ROOM: SourceImage[];
};

// ── Read ───────────────────────────────────────────────────────────────────

export async function getPackageGallery(packageId: number): Promise<(GallerySlot | null)[]> {
  const rows = await db.package_gallery.findMany({
    where: { package_id: packageId },
    orderBy: { position: "asc" },
  });
  const map = new Map(rows.map((r) => [r.position, r]));
  return Array.from({ length: 5 }, (_, i) => {
    const row = map.get(i + 1);
    if (!row) return null;
    return {
      id: row.id,
      position: row.position,
      image_url: row.image_url,
      source_type: row.source_type as GallerySlot["source_type"],
      source_id: row.source_id,
      label: row.label,
    };
  });
}

// ── Source image browsers ──────────────────────────────────────────────────

export async function getPackageSourceImages(packageId: number): Promise<GallerySourceImages> {
  const [packageImgs, hotelImgs, activityImgs, roomImgs] = await Promise.all([
    // PACKAGE images
    db.package_images.findMany({
      where: { package_id: packageId },
      orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
      select: { id: true, url: true, thumbnail: true },
    }),

    // HOTEL images — hotels via itinerary_stays → room_pricing → hotel → hotel_images
    db.hotel_images.findMany({
      where: {
        url: { not: null },
        hotel: {
          room_pricing: {
            some: {
              itineraryStays: {
                some: {
                  itinerary: { package_id: packageId },
                },
              },
            },
          },
        },
      },
      select: {
        id: true,
        url: true,
        thumbnail: true,
        hotel: { select: { id: true, name: true } },
      },
      orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
    }),

    // ACTIVITY images — activities via itinerary_activities for this package
    db.activity_images.findMany({
      where: {
        activity: {
          itinerary_activities: {
            some: {
              itinerary: { package_id: packageId },
            },
          },
        },
      },
      select: {
        id: true,
        url: true,
        thumbnail: true,
        activity: { select: { id: true, name: true } },
      },
      orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
    }),

    // ROOM images — hotel_room_images via itinerary_stays → room_pricing → room
    db.hotel_room_images.findMany({
      where: {
        room: {
          pricing: {
            some: {
              itineraryStays: {
                some: {
                  itinerary: { package_id: packageId },
                },
              },
            },
          },
        },
      },
      select: {
        id: true,
        url: true,
        thumbnail: true,
        room: { select: { id: true, name: true } },
      },
      orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
    }),
  ]);

  return {
    PACKAGE: packageImgs.map((img) => ({
      id: img.id,
      url: img.url,
      thumbnail: img.thumbnail,
      group_label: "Package Images",
      source_id: img.id,
    })),
    HOTEL: hotelImgs
      .filter((img) => img.url != null)
      .map((img) => ({
        id: img.id,
        url: img.url as string,
        thumbnail: img.thumbnail,
        group_label: img.hotel.name,
        source_id: img.hotel.id,
      })),
    ACTIVITY: activityImgs.map((img) => ({
      id: img.id,
      url: img.url,
      thumbnail: img.thumbnail,
      group_label: img.activity.name,
      source_id: img.activity.id,
    })),
    ROOM: roomImgs.map((img) => ({
      id: img.id,
      url: img.url,
      thumbnail: img.thumbnail,
      group_label: img.room.name,
      source_id: img.room.id,
    })),
  };
}

// ── Write ──────────────────────────────────────────────────────────────────

export async function upsertGallerySlot(
  packageId: number,
  position: number,
  imageUrl: string,
  sourceType: GallerySlot["source_type"],
  sourceId: number | null,
) {
  return db.package_gallery.upsert({
    where: { package_id_position: { package_id: packageId, position } },
    create: { package_id: packageId, position, image_url: imageUrl, source_type: sourceType, source_id: sourceId },
    update: { image_url: imageUrl, source_type: sourceType, source_id: sourceId },
  });
}

export async function clearGallerySlot(packageId: number, position: number) {
  await db.package_gallery.deleteMany({ where: { package_id: packageId, position } });
}

export async function updateGallerySlotLabel(packageId: number, position: number, label: string) {
  await db.package_gallery.updateMany({
    where: { package_id: packageId, position },
    data: { label: label.trim() || null },
  });
}
