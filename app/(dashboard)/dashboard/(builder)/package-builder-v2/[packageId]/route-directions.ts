"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Road distance and drive time between two points.
//
// Mapbox Directions, which is a METERED API — every call costs. Two rules
// follow from that and are enforced by the caller, not here:
//
//   • only route when both ends have real coordinates (a half-typed place name
//     must never fire a request), and
//   • debounce, so dragging through a list of search results doesn't bill for
//     each one.
//
// Results are cached in module scope keyed on the rounded coordinate pair, so
// re-opening the same day's drawer costs nothing.
// ─────────────────────────────────────────────────────────────────────────────

export type RouteEstimate = {
  /** Road distance in km, one decimal. */
  distanceKm: number;
  /** Drive time as the builder writes it elsewhere — "4h 30m". */
  travelTime: string;
  /** The driven line, for drawing on the map. [lng, lat] pairs, as Mapbox
   * returns them and as Leaflet does NOT — the caller flips them. */
  geometry: [number, number][];
};

const cache = new Map<string, RouteEstimate | null>();

/** Rounded so trivially different coordinates for the same place share a cache
 * entry — ~11m at 4dp, far finer than any pickup point needs. */
function key(a: Point, b: Point): string {
  const r = (n: number) => n.toFixed(4);
  return `${r(a.lat)},${r(a.lng)}|${r(b.lat)},${r(b.lng)}`;
}

export type Point = { lat: number; lng: number };

function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Routes by road between two points. Null when there's no token, no route, or
 * the request fails — the caller keeps whatever the exec typed rather than
 * blanking it.
 */
export async function routeBetween(from: Point, to: Point): Promise<RouteEstimate | null> {
  const k = key(from, to);
  if (cache.has(k)) return cache.get(k) ?? null;

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;

  try {
    const res = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/` +
      `${from.lng},${from.lat};${to.lng},${to.lat}` +
      `?access_token=${token}&overview=simplified&geometries=geojson`,
    );
    if (!res.ok) { cache.set(k, null); return null; }
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) { cache.set(k, null); return null; }

    const estimate: RouteEstimate = {
      distanceKm: Math.round((route.distance / 1000) * 10) / 10,
      travelTime: formatDuration(route.duration),
      geometry: (route.geometry?.coordinates ?? []) as [number, number][],
    };
    cache.set(k, estimate);
    return estimate;
  } catch {
    cache.set(k, null);
    return null;
  }
}
