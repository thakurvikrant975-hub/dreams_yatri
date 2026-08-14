// Geocodes a day's search-city text (Mapbox, India-scoped) so hotel search
// results can show "X km from {city}".
//
// Cached in module scope — same pattern as ItineraryMap.tsx — since the same
// city gets searched repeatedly across days. Shared between the right-hand
// panel and the preview's hotel drawer specifically so they hit one cache
// rather than each geocoding the same city independently.

const cityGeocodeCache = new Map<string, { lat: number; lng: number } | null>();

export async function geocodeCity(query: string): Promise<{ lat: number; lng: number } | null> {
  const key = query.trim().toLowerCase();
  if (!key) return null;
  if (cityGeocodeCache.has(key)) return cityGeocodeCache.get(key) ?? null;
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;
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
