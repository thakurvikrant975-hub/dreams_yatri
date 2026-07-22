import "server-only";
import { db } from "@/app/lib/db";

/**
 * Ensure a hotel has a HOTEL-type Location row (with geo-coordinates) linked
 * via hotels.location_id — the same record the rest of the app (destinations,
 * cab routes, activities) uses for location data. Hotel-connect's own
 * location step (location-actions.ts) already creates this when an owner
 * saves their location; this is the identical upsert as a safety net for
 * hotels that reach checkout without ever having gone through that step
 * (e.g. ops-created properties). No-op if the hotel already has a linked
 * Location row, or has no lat/lng yet to seed one with.
 */
export async function ensureHotelLocation(hotelId: number): Promise<void> {
    const hotel = await db.hotels.findUnique({
        where: { id: hotelId },
        select: { id: true, name: true, location_id: true, latitude: true, longitude: true },
    });
    if (!hotel || hotel.location_id || hotel.latitude == null || hotel.longitude == null) return;

    const location = await db.location.create({
        data: {
            type: "HOTEL",
            name: hotel.name,
            slug: `hotel-${hotel.id}`,
            latitude: hotel.latitude,
            longitude: hotel.longitude,
            is_active: false,
            is_searchable: false,
        },
        select: { id: true },
    });
    await db.hotels.update({ where: { id: hotel.id }, data: { location_id: location.id } });
}
