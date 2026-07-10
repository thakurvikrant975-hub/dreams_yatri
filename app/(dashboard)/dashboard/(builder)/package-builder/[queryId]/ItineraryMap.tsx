"use client";

import { useEffect, useRef, useState } from "react";
import type { StopInput, DayItinerary } from "../action";

// ─────────────────────────────────────────────────────────────────────────────
// Route + points-of-interest map for the itinerary preview. The builder only
// stores place names as text (starting point, stops, hotel/activity
// locations) — never coordinates — so every point is geocoded client-side via
// Mapbox's Geocoding API, then rendered on a Leaflet + Mapbox-tiles map
// (same stack as the admin RoutePreviewMap). Geocoding results are cached in
// module scope so re-renders and repeated hotel/activity names don't re-fetch.
// ─────────────────────────────────────────────────────────────────────────────

type PointKind = "start" | "stop" | "end" | "hotel" | "activity";

interface MapPoint {
  label: string;
  query: string;
  kind: PointKind;
}

interface GeocodedPoint extends MapPoint {
  lat: number;
  lng: number;
}

const KIND_COLOR: Record<PointKind, string> = {
  start:    "#16a34a", // green
  stop:     "#2563eb", // blue
  end:      "#dc2626", // red
  hotel:    "#d97706", // amber
  activity: "#9333ea", // purple
};

const KIND_LEGEND: Record<PointKind, string> = {
  start: "Starting point", stop: "Stop", end: "Ending point",
  hotel: "Hotel", activity: "Activity",
};

const KIND_SYMBOL: Record<PointKind, string> = {
  start: "S", stop: "•", end: "E", hotel: "H", activity: "A",
};

const geocodeCache = new Map<string, [number, number] | null>();

async function geocode(query: string, token: string): Promise<[number, number] | null> {
  const key = query.trim().toLowerCase();
  if (!key) return null;
  if (geocodeCache.has(key)) return geocodeCache.get(key) ?? null;
  try {
    // Dreams Yatri only operates Indian itineraries — without this, generic
    // activity/hotel names ("Cheeyappara Waterfall Stop") that aren't real
    // named places can fuzzy-match a similarly-worded location anywhere in
    // the world (observed: matches in Andorra and Canada), which blows out
    // the map's bounding box to a global zoom.
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
      `?access_token=${token}&limit=1&country=IN&proximity=78.9629,20.5937`,
    );
    if (!res.ok) { geocodeCache.set(key, null); return null; }
    const data = await res.json();
    const center = data.features?.[0]?.center as [number, number] | undefined; // [lng, lat]
    const result: [number, number] | null = center ? [center[1], center[0]] : null;
    geocodeCache.set(key, result);
    return result;
  } catch {
    geocodeCache.set(key, null);
    return null;
  }
}

function markerHtml(bg: string, symbol: string) {
  return `
    <div style="
      background:${bg}; color:#fff; border-radius:50%;
      width:28px; height:28px; display:flex; align-items:center; justify-content:center;
      font-size:12px; font-weight:800; border:3px solid #fff;
      box-shadow:0 2px 8px rgba(0,0,0,.4), 0 0 0 1px rgba(0,0,0,.08);
      font-family:system-ui,sans-serif;
    ">${symbol}</div>`;
}

function buildPoints(startingPoint: string, stops: StopInput[], itineraries: DayItinerary[]): MapPoint[] {
  const points: MapPoint[] = [];

  if (startingPoint.trim()) {
    points.push({ label: startingPoint, query: startingPoint, kind: "start" });
  }
  const namedStops = stops.filter((s) => s.name.trim());
  namedStops.forEach((s, i) => {
    const isEnd = i === namedStops.length - 1;
    points.push({ label: s.name, query: s.name, kind: isEnd ? "end" : "stop" });
  });
  // No stops at all, but a starting point — nothing else to route to.

  const seenHotels = new Set<string>();
  itineraries.forEach((day) => {
    const hotelName = day.accommodation.split(" — ")[0]?.trim();
    if (!hotelName || seenHotels.has(hotelName)) return;
    seenHotels.add(hotelName);
    const query = [hotelName, day.accommodationLocation].filter(Boolean).join(", ");
    points.push({ label: hotelName, query, kind: "hotel" });
  });

  const seenActivities = new Set<string>();
  let activityCount = 0;
  const MAX_ACTIVITIES = 12;
  for (const day of itineraries) {
    for (const a of day.activities) {
      if (activityCount >= MAX_ACTIVITIES) break;
      const title = a.title.trim();
      if (!title || seenActivities.has(title)) continue;
      seenActivities.add(title);
      activityCount++;
      const query = [title, day.accommodationLocation].filter(Boolean).join(", ");
      points.push({ label: title, query, kind: "activity" });
    }
    if (activityCount >= MAX_ACTIVITIES) break;
  }

  return points;
}

export function ItineraryMap({ startingPoint, stops, itineraries }: {
  startingPoint: string;
  stops:         StopInput[];
  itineraries:   DayItinerary[];
}) {
  const mapRef         = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const [geocoded, setGeocoded] = useState<GeocodedPoint[] | null>(null);
  const [failed, setFailed]     = useState(false);

  const points = buildPoints(startingPoint, stops, itineraries);
  const pointsKey = points.map((p) => `${p.kind}:${p.query}`).join("|");

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token || points.length === 0) { setGeocoded([]); return; }

    let cancelled = false;
    setGeocoded(null);
    setFailed(false);

    (async () => {
      const results = await Promise.all(
        points.map(async (p) => {
          const coords = await geocode(p.query, token);
          return coords ? { ...p, lat: coords[0], lng: coords[1] } : null;
        }),
      );
      if (cancelled) return;
      const ok = results.filter((r): r is GeocodedPoint => r !== null);
      if (ok.length === 0) setFailed(true);
      setGeocoded(ok);
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsKey]);

  useEffect(() => {
    if (!mapRef.current || !geocoded || geocoded.length === 0) return;
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !mapRef.current) return;

      // @ts-expect-error leaflet default-icon hack — divIcon is used instead
      delete L.Icon.Default.prototype._getIconUrl;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapRef.current!, { zoomControl: true });
      mapInstanceRef.current = map;

      L.tileLayer(
        `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`,
        {
          attribution: "© <a href='https://www.mapbox.com/about/maps/'>Mapbox</a> © <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a>",
          tileSize: 512,
          zoomOffset: -1,
          maxZoom: 22,
        },
      ).addTo(map);

      // Route line through the geographic journey (start → stops → end) only —
      // hotels/activities are markers, not part of the travelled path.
      const routePoints = geocoded.filter((p) => p.kind === "start" || p.kind === "stop" || p.kind === "end");
      const routeCoords: [number, number][] = routePoints.map((p) => [p.lat, p.lng]);
      if (routeCoords.length > 1) {
        L.polyline(routeCoords, { color: "#ffffff", weight: 7, opacity: 0.9 }).addTo(map);
        L.polyline(routeCoords, { color: "#2563eb", weight: 3.5, dashArray: "9 6", opacity: 0.9 }).addTo(map);
      }

      geocoded.forEach((p) => {
        const icon = L.divIcon({
          className: "",
          html: markerHtml(KIND_COLOR[p.kind], KIND_SYMBOL[p.kind]),
          iconSize: [28, 28],
          iconAnchor: [14, 14],
          popupAnchor: [0, -16],
        });
        const popup = `<strong style="font-size:12px">${p.label}</strong><br/><span style="font-size:10px;color:#666">${KIND_LEGEND[p.kind]}</span>`;
        L.marker([p.lat, p.lng], { icon }).addTo(map).bindPopup(popup);
      });

      const allCoords: [number, number][] = geocoded.map((p) => [p.lat, p.lng]);
      if (allCoords.length > 1) {
        map.fitBounds(L.latLngBounds(allCoords), { padding: [36, 36] });
      } else {
        map.setView(allCoords[0], 11);
      }
    });

    return () => {
      cancelled = true;
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
    };
  }, [geocoded]);

  if (points.length === 0) return null;

  const usedKinds = Array.from(new Set((geocoded ?? []).map((p) => p.kind)));

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4" style={{ breakInside: "avoid" }}>
      <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-500 mb-3">Route Map</h3>

      {geocoded === null && (
        <div className="h-72 rounded-lg border border-dashed border-neutral-200 flex items-center justify-center">
          <p className="text-xs text-neutral-400">Loading map…</p>
        </div>
      )}

      {geocoded !== null && failed && (
        <div className="h-40 rounded-lg border border-dashed border-neutral-200 flex items-center justify-center">
          <p className="text-xs text-neutral-400">Couldn&apos;t locate any of these places on the map.</p>
        </div>
      )}

      {geocoded !== null && !failed && (
        <>
          <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
          <div className="relative">
            <div ref={mapRef} className="h-80 rounded-lg overflow-hidden border border-neutral-200" />
            {usedKinds.length > 0 && (
              <div className="absolute bottom-2 left-2 z-1000 flex flex-wrap items-center gap-2 rounded-md bg-white/95 backdrop-blur-sm px-2.5 py-1.5 shadow-sm border border-neutral-200 text-[10px] text-neutral-600">
                {usedKinds.map((k) => (
                  <span key={k} className="flex items-center gap-1">
                    <span className="inline-block size-2.5 rounded-full" style={{ background: KIND_COLOR[k] }} />
                    {KIND_LEGEND[k]}
                  </span>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
