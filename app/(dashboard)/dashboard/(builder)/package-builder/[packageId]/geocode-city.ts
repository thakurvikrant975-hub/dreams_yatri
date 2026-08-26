// Geocodes a day's search-city text (Mapbox, India-scoped) so hotel search
// results can show "X km from {city}".
//
// Cached in module scope — same pattern as ItineraryMap.tsx — since the same
// city gets searched repeatedly across days. Shared between the right-hand
// panel and the preview's hotel drawer specifically so they hit one cache
// rather than each geocoding the same city independently.

const cityGeocodeCache = new Map<string, { lat: number; lng: number } | null>();

// The catalog also holds HOTEL/ACTIVITY entries, and a property or attraction
// is routinely named after the town it's in — a hotel literally named
// "Nainital" sits ~8km from the actual town centre, which reads as a ~25km
// drive in the hills. That entry used to win outright: with no type filter,
// a bare "Nainital" query tied on exact-name-match against both it and the
// real CITY row, and the tie broke arbitrarily rather than toward the place
// this lookup actually means. Restricted here to the location types that are
// genuinely a place a stop/day is set in, never a property or POI within it.
const PLACE_TYPES = [
  "REGION", "SUBREGION", "COUNTRY", "STATE", "CITY", "DISTRICT", "AREA",
  "NEIGHBORHOOD", "VILLAGE", "LANDMARK", "BEACH", "MOUNTAIN", "ISLAND", "TOURISM_ZONE",
].join(",");

export async function geocodeCity(query: string): Promise<{ lat: number; lng: number } | null> {
  const key = query.trim().toLowerCase();
  if (!key) return null;
  if (cityGeocodeCache.has(key)) return cityGeocodeCache.get(key) ?? null;

  // The app's own Location catalog first — real coordinates for anywhere
  // already in it (added via the location picker, manual entry, or an
  // earlier Mapbox save), and it covers places Mapbox's `mapbox.places`
  // dataset can return NOTHING for even with a correct token — "Cherrapunji"
  // itself is a confirmed case, despite the catalog having it at the right
  // coordinates all along (it's how the hotel-inventory "near a location"
  // search already finds hotels there). Mapbox stays as the fallback for a
  // place that's genuinely not in the catalog yet.
  try {
    const res = await fetch(`/api/locations/search?q=${encodeURIComponent(query)}&limit=1&types=${PLACE_TYPES}`);
    if (res.ok) {
      const rows = await res.json() as { latitude: number | null; longitude: number | null }[];
      const hit = rows[0];
      if (hit?.latitude != null && hit?.longitude != null) {
        const result = { lat: hit.latitude, lng: hit.longitude };
        cityGeocodeCache.set(key, result);
        return result;
      }
    }
  } catch {
    // Falls through to Mapbox below.
  }

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) { cityGeocodeCache.set(key, null); return null; }
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
      `?access_token=${token}&limit=1&country=IN&proximity=78.9629,20.5937`,
    );
    if (!res.ok) { cityGeocodeCache.set(key, null); return null; }
    const data = await res.json();
    const center = data.features?.[0]?.center as [number, number] | undefined; // [lng, lat]
    const result = center ? { lat: center[1], lng: center[0] } : null;
    cityGeocodeCache.set(key, result);
    return result;
  } catch {
    cityGeocodeCache.set(key, null);
    return null;
  }
}
