import "server-only";
import { db } from "@/app/lib/db";

// ── Nearby landmarks (attractions / food & shopping / transport) ────────────
//
// Sourced from OpenStreetMap's Overpass API (free, no key) rather than Google
// Places — the app has already standardized on OSM/Leaflet for the map, and
// Overpass needs no billing account. Results are cached in `hotel_landmark`
// per hotel so the guest page never blocks on a live external call after the
// first successful fetch for that hotel.

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const FETCH_TIMEOUT_MS = 15_000;
const MAX_PER_CATEGORY = 8;

export type LandmarkCategory = "Tourist Attractions" | "Food & Shopping" | "Transport";

type OverpassElement = {
  lat: number;
  lon: number;
  tags?: Record<string, string>;
};

/** Everything in one request — cheaper than N round-trips and immune to one
 *  clause's radius making the whole fetch slower than a single shared budget. */
const OVERPASS_QUERY = `
  node["tourism"~"attraction|museum|gallery|zoo|theme_park|viewpoint"](around:5000,{lat},{lon});
  node["historic"~"castle|fort|ruins|monument|archaeological_site|palace"](around:5000,{lat},{lon});
  node["amenity"~"restaurant|cafe|fast_food"](around:2000,{lat},{lon});
  node["shop"~"mall|supermarket"](around:2500,{lat},{lon});
  node["railway"="station"](around:8000,{lat},{lon});
  node["amenity"="bus_station"](around:8000,{lat},{lon});
  node["aeroway"="aerodrome"](around:40000,{lat},{lon});
`;

// historic= covers memorial plaques and small statues too (e.g. "Gandhi
// 1869-1948") — real OSM data, but too granular to lead a guest-facing
// "attractions" list with, so the query above only asks for the more
// substantial historic sub-types (castle/fort/ruins/monument/etc).
function categorize(tags: Record<string, string>): LandmarkCategory | null {
  if (tags.railway === "station" || tags.amenity === "bus_station" || tags.aeroway === "aerodrome") {
    return "Transport";
  }
  if (tags.amenity === "restaurant" || tags.amenity === "cafe" || tags.amenity === "fast_food" || tags.shop === "mall" || tags.shop === "supermarket") {
    return "Food & Shopping";
  }
  if (tags.tourism || tags.historic) return "Tourist Attractions";
  return null;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

type FetchedLandmark = { category: LandmarkCategory; name: string; distanceM: number; lat: number; lon: number };

async function fetchFromOverpass(latitude: number, longitude: number): Promise<FetchedLandmark[]> {
  const query = `[out:json][timeout:25];(${OVERPASS_QUERY.replaceAll("{lat}", String(latitude)).replaceAll("{lon}", String(longitude))});out body;`;

  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    body: `data=${encodeURIComponent(query)}`,
    // Overpass's Apache front-end 406s requests with no (or a bot-flagged)
    // User-Agent — a descriptive one, per Overpass's usage policy, is required.
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "DreamsYatri/1.0 (hotel nearby-landmarks feature)",
      "Accept": "*/*",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);

  const data = (await res.json()) as { elements?: OverpassElement[] };
  const byCategory = new Map<LandmarkCategory, FetchedLandmark[]>();

  for (const el of data.elements ?? []) {
    // OSM sometimes stores multiple values in one field separated by ";"
    // (e.g. "Alfa restaurant;Tourist information") — take just the first.
    const name = el.tags?.name?.split(";")[0]?.trim();
    if (!name) continue;
    const category = categorize(el.tags!);
    if (!category) continue;

    const list = byCategory.get(category) ?? [];
    list.push({
      category,
      name,
      distanceM: Math.round(haversineMeters(latitude, longitude, el.lat, el.lon)),
      lat: el.lat,
      lon: el.lon,
    });
    byCategory.set(category, list);
  }

  const result: FetchedLandmark[] = [];
  for (const list of byCategory.values()) {
    const seen = new Set<string>();
    const deduped = list
      .sort((a, b) => a.distanceM - b.distanceM)
      .filter((lm) => (seen.has(lm.name) ? false : (seen.add(lm.name), true)))
      .slice(0, MAX_PER_CATEGORY);
    result.push(...deduped);
  }
  return result;
}

/**
 * Cached-or-fetched nearby landmarks for a hotel. Reads hotel_landmark first;
 * on a cold cache, fetches live from Overpass, stores the result (best
 * effort — a storage failure still returns the fetched data for this
 * request), and returns it. A failed/timed-out fetch returns an empty array
 * without caching, so the next request tries again instead of getting stuck
 * on a permanent empty cache.
 */
export type LandmarkItem = { name: string; distance: string; lat: number | null; lon: number | null };

export async function getOrFetchLandmarks(
  hotelId: number,
  latitude: number,
  longitude: number,
): Promise<{ category: string; items: LandmarkItem[] }[]> {
  const cached = await db.hotel_landmark.findMany({
    where: { hotel_id: hotelId },
    orderBy: { distance_m: "asc" },
  });

  type Row = { category: string; name: string; distance_m: number; lat: number | null; lon: number | null };

  let rows: Row[] = cached.map((row) => ({
    category: row.category,
    name: row.name,
    distance_m: row.distance_m,
    lat: row.lat != null ? Number(row.lat) : null,
    lon: row.lon != null ? Number(row.lon) : null,
  }));

  if (rows.length === 0) {
    try {
      const flat = await fetchFromOverpass(latitude, longitude);
      if (flat.length > 0) {
        await db.hotel_landmark.createMany({
          data: flat.map((lm) => ({
            hotel_id: hotelId,
            category: lm.category,
            name: lm.name,
            distance_m: lm.distanceM,
            lat: lm.lat,
            lon: lm.lon,
          })),
        });
      }
      rows = flat.map((lm) => ({
        category: lm.category,
        name: lm.name,
        distance_m: lm.distanceM,
        lat: lm.lat,
        lon: lm.lon,
      }));
    } catch (err) {
      console.error("[getOrFetchLandmarks] Overpass fetch failed", err);
      return [];
    }
  }

  const byCategory = new Map<string, LandmarkItem[]>();
  for (const row of rows) {
    if (!byCategory.has(row.category)) byCategory.set(row.category, []);
    byCategory.get(row.category)!.push({
      name: row.name,
      distance: formatDistance(row.distance_m),
      lat: row.lat,
      lon: row.lon,
    });
  }

  // Stable, guest-friendly tab order regardless of fetch/insertion order.
  const order: LandmarkCategory[] = ["Tourist Attractions", "Food & Shopping", "Transport"];
  return order
    .filter((c) => byCategory.has(c))
    .map((category) => ({ category, items: byCategory.get(category)! }));
}
