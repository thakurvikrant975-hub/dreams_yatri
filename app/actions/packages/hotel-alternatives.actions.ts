"use server";

import { db } from "@/app/lib/db";
import {
  ROOM_PRICING_DISPLAY_SELECT,
  mapRoomPricingRowToOption,
  type RoomOption,
} from "./fetch-page-data";
import { haversineMeters } from "@/app/lib/hotel-inventory/geo";
import { getRouteTo } from "@/app/(website)/hotels/[slug]/route-actions";

/** Other room/plan options at the SAME hotel — for "Change Room". */
export async function fetchRoomAlternatives(hotelId: number, take = 12): Promise<RoomOption[]> {
  const rows = await db.hotel_room_pricing.findMany({
    where: { hotel_id: hotelId, is_active: true },
    orderBy: { price_per_night: "asc" },
    select: ROOM_PRICING_DISPLAY_SELECT,
    take,
  });
  return rows.map(mapRoomPricingRowToOption);
}

// "Nearby" means within this road distance — not straight-line, not same destination_id.
const MAX_ROAD_DISTANCE_M = 22_000;
// Caps how many hotels get an actual OSRM road-routing call per sidebar open —
// route-actions.ts's OSRM instance is a free public service, not a paid/keyed
// one, so this list-filter use (vs. its usual single interactive route) stays
// deliberately bounded rather than routing every straight-line candidate.
const MAX_ROUTING_CANDIDATES = 15;

type HotelPosition = {
  latitude: unknown;
  longitude: unknown;
  location: { latitude: unknown; longitude: unknown } | null;
};

/** A hotel's real position can live in two places depending on how it was
 *  created: `hotels.latitude/longitude` (set by the hotel-connect owner
 *  wizard), or via `hotels.location_id` → `locations.latitude/longitude`
 *  (ops-created package hotels, which geocode a dedicated point-type
 *  Location row per hotel instead). Prefer the hotel's own value, fall back
 *  to its linked location. */
function resolveHotelCoords(h: HotelPosition): { lat: number; lon: number } | null {
  const lat = h.latitude != null ? Number(h.latitude) : h.location?.latitude != null ? Number(h.location.latitude) : null;
  const lon = h.longitude != null ? Number(h.longitude) : h.location?.longitude != null ? Number(h.location.longitude) : null;
  return lat != null && lon != null ? { lat, lon } : null;
}

/** Other hotels within 22km BY ROAD — for "Change Hotel". Each hotel is
 *  represented by its cheapest active room_pricing row. The current hotel is
 *  excluded — it isn't itself an "alternative", and its own cheapest room can
 *  differ from the exact one actually booked for this stay, which would show
 *  a misleading price delta against itself.
 *
 *  Two-pass distance check: straight-line (haversine) first as a cheap,
 *  mathematically safe pre-filter — road distance is never shorter than
 *  straight-line, so anything beyond 22km straight-line can never qualify by
 *  road either. Only the shortlist that survives gets an actual OSRM
 *  road-routing call for the real distance.
 *
 *  Eligibility spans both hotel "worlds" this app has: hotel-connect
 *  properties (LIVE = owner-published, real) and ops-created package hotels
 *  (no owner_id — listing_status is a hotel-connect-only workflow field that
 *  simply never gets touched for these, so it can't be used to gate them).
 *  A hotel with no resolvable position (neither source) can't be placed on
 *  this map and is excluded — no destination_id or other fallback. */
export async function fetchHotelAlternatives(hotelId: number, take = 10): Promise<RoomOption[]> {
  const current = await db.hotels.findUnique({
    where: { id: hotelId },
    select: { latitude: true, longitude: true, stay_type: true, location: { select: { latitude: true, longitude: true } } },
  });
  const currentCoords = current ? resolveHotelCoords(current) : null;
  if (!current || !currentCoords) return [];

  const { lat: curLat, lon: curLon } = currentCoords;

  const candidates = await db.hotels.findMany({
    where: {
      id: { not: hotelId },
      is_active: true,
      OR: [{ listing_status: "LIVE" }, { owner_id: null }],
    },
    select: {
      id: true,
      latitude: true,
      longitude: true,
      stay_type: true,
      location: { select: { latitude: true, longitude: true } },
    },
  });

  const shortlist = candidates
    .map((h) => {
      const coords = resolveHotelCoords(h);
      if (!coords) return null;
      return { id: h.id, lat: coords.lat, lon: coords.lon, stay_type: h.stay_type, straightLineM: haversineMeters(curLat, curLon, coords.lat, coords.lon) };
    })
    .filter((h): h is NonNullable<typeof h> => h !== null && h.straightLineM <= MAX_ROAD_DISTANCE_M)
    .sort((a, b) => a.straightLineM - b.straightLineM)
    .slice(0, MAX_ROUTING_CANDIDATES);

  const withRoadDistance = await Promise.all(
    shortlist.map(async (h) => {
      const route = await getRouteTo(curLat, curLon, h.lat, h.lon);
      return { ...h, roadDistanceM: route?.distanceM ?? null };
    }),
  );

  const withinRoadDistance = withRoadDistance.filter(
    (h) => h.roadDistanceM != null && h.roadDistanceM <= MAX_ROAD_DISTANCE_M,
  );

  // Prefer the same star tier, then nearest by actual road distance.
  withinRoadDistance.sort((a, b) => {
    const aTier = a.stay_type === current.stay_type ? 0 : 1;
    const bTier = b.stay_type === current.stay_type ? 0 : 1;
    if (aTier !== bTier) return aTier - bTier;
    return (a.roadDistanceM ?? 0) - (b.roadDistanceM ?? 0);
  });

  const finalHotelIds = withinRoadDistance.slice(0, take).map((h) => h.id);
  if (finalHotelIds.length === 0) return [];

  const rows = await db.hotel_room_pricing.findMany({
    where: { hotel_id: { in: finalHotelIds }, is_active: true },
    orderBy: { price_per_night: "asc" },
    select: ROOM_PRICING_DISPLAY_SELECT,
  });

  const cheapestByHotel = new Map<number, (typeof rows)[number]>();
  for (const r of rows) {
    if (!cheapestByHotel.has(r.hotel.id)) cheapestByHotel.set(r.hotel.id, r);
  }

  return finalHotelIds
    .map((id) => cheapestByHotel.get(id))
    .filter((r): r is NonNullable<typeof r> => !!r)
    .map(mapRoomPricingRowToOption);
}
