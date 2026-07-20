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
const MAX_ROAD_DISTANCE_M = 50_000;
// Caps how many hotels get an actual OSRM road-routing call per sidebar open —
// route-actions.ts's OSRM instance is a free public service, not a paid/keyed
// one, so this list-filter use (vs. its usual single interactive route) stays
// deliberately bounded rather than routing every straight-line candidate.
const MAX_ROUTING_CANDIDATES = 15;

/** Other live hotels within 50km BY ROAD — for "Change Hotel". Each hotel is
 *  represented by its cheapest active room_pricing row. The current hotel is
 *  included (not excluded, distance 0) so the sidebar can show it with a
 *  "Selected" state, consistent with how Change Vehicle lists the
 *  currently-selected cab inline.
 *
 *  Two-pass distance check: straight-line (haversine) first as a cheap,
 *  mathematically safe pre-filter — road distance is never shorter than
 *  straight-line, so anything beyond 50km straight-line can never qualify by
 *  road either. Only the shortlist that survives gets an actual OSRM
 *  road-routing call for the real distance.
 *
 *  Hotels without saved coordinates (currently most of the catalog) can't be
 *  placed on this map at all and are excluded — there is no destination_id
 *  or other fallback here by design. */
export async function fetchHotelAlternatives(hotelId: number, take = 10): Promise<RoomOption[]> {
  const current = await db.hotels.findUnique({
    where: { id: hotelId },
    select: { latitude: true, longitude: true, stay_type: true },
  });
  if (!current?.latitude || !current?.longitude) return [];

  const curLat = Number(current.latitude);
  const curLon = Number(current.longitude);

  const candidates = await db.hotels.findMany({
    where: {
      listing_status: "LIVE",
      is_active: true,
      latitude: { not: null },
      longitude: { not: null },
    },
    select: { id: true, latitude: true, longitude: true, stay_type: true },
  });

  const shortlist = candidates
    .map((h) => ({
      id: h.id,
      lat: Number(h.latitude),
      lon: Number(h.longitude),
      stay_type: h.stay_type,
      straightLineM: h.id === hotelId ? 0 : haversineMeters(curLat, curLon, Number(h.latitude), Number(h.longitude)),
    }))
    .filter((h) => h.id === hotelId || h.straightLineM <= MAX_ROAD_DISTANCE_M)
    .sort((a, b) => a.straightLineM - b.straightLineM)
    .slice(0, MAX_ROUTING_CANDIDATES);

  const withRoadDistance = await Promise.all(
    shortlist.map(async (h) => {
      if (h.id === hotelId) return { ...h, roadDistanceM: 0 };
      const route = await getRouteTo(curLat, curLon, h.lat, h.lon);
      return { ...h, roadDistanceM: route?.distanceM ?? null };
    }),
  );

  const withinRoadDistance = withRoadDistance.filter(
    (h) => h.id === hotelId || (h.roadDistanceM != null && h.roadDistanceM <= MAX_ROAD_DISTANCE_M),
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
