"use server";

// Driving/walking directions + destination search for the Location &
// Surroundings map — reuses the same free OSM ecosystem as the landmarks
// feature (Overpass) rather than a paid/keyed provider like Google
// Directions.
//
// router.project-osrm.org's public demo only hosts a single car dataset and
// silently ignores whatever profile name is in the URL (verified: /foot/ and
// /walking/ return the identical car route). FOSSGIS's public instances at
// routing.openstreetmap.de host genuinely separate car and foot datasets, so
// that's what backs the walking profile below.
const OSRM_CAR_URL = "https://routing.openstreetmap.de/routed-car/route/v1/driving";
const OSRM_FOOT_URL = "https://routing.openstreetmap.de/routed-foot/route/v1/foot";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const FETCH_TIMEOUT_MS = 10_000;
const USER_AGENT = "DreamsYatri/1.0 (hotel route-directions feature)";

// Below this straight-line distance, a walking route is more useful/accurate
// than a driving one — hilly terrain especially can make the drive to a spot
// a few hundred metres away many times longer via the road network.
const WALK_THRESHOLD_M = 1500;

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

export type RouteResult = {
  geometry: [number, number][];
  distanceM: number;
  durationS: number;
  mode: "walking" | "driving";
};

export async function getRouteTo(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
): Promise<RouteResult | null> {
  const mode: "walking" | "driving" =
    haversineMeters(fromLat, fromLon, toLat, toLon) <= WALK_THRESHOLD_M ? "walking" : "driving";
  const base = mode === "walking" ? OSRM_FOOT_URL : OSRM_CAR_URL;

  try {
    const url = `${base}/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson`;
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      routes?: { geometry: { coordinates: [number, number][] }; distance: number; duration: number }[];
    };
    const route = data.routes?.[0];
    if (!route) return null;

    return {
      // OSRM returns [lon, lat] pairs — Leaflet wants [lat, lon].
      geometry: route.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
      distanceM: route.distance,
      durationS: route.duration,
      mode,
    };
  } catch (err) {
    console.error("[getRouteTo] OSRM fetch failed", err);
    return null;
  }
}

export type GeocodeResult = { lat: number; lon: number; label: string };

export async function geocodeDestination(
  query: string,
  biasLat: number,
  biasLon: number,
): Promise<GeocodeResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  try {
    // Soft bias toward the hotel's location (bounded=0 keeps it a
    // preference, not a hard filter) so "airport" resolves to the nearest
    // one instead of whichever ranks highest globally.
    const box = 0.5;
    const params = new URLSearchParams({
      q: trimmed,
      format: "json",
      limit: "1",
      viewbox: `${biasLon - box},${biasLat + box},${biasLon + box},${biasLat - box}`,
      bounded: "0",
    });

    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { lat: string; lon: string; display_name: string }[];
    const top = data[0];
    if (!top) return null;

    return {
      lat: parseFloat(top.lat),
      lon: parseFloat(top.lon),
      label: top.display_name.split(",").slice(0, 2).join(",").trim(),
    };
  } catch (err) {
    console.error("[geocodeDestination] Nominatim fetch failed", err);
    return null;
  }
}
