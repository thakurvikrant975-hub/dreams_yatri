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

type PointKind = "start" | "stop" | "end" | "hotel" | "activity" | "flight" | "train";

interface MapPoint {
  label: string;
  query: string;
  kind: PointKind;
}

interface GeocodedPoint extends MapPoint {
  lat: number;
  lng: number;
}

// start/stop/end share one color — the map shows travel order as numbers
// (1, 2, 3…), not a start/end distinction, so route points read as one series.
const KIND_COLOR: Record<PointKind, string> = {
  start:    "#2563eb", // blue
  stop:     "#2563eb", // blue
  end:      "#2563eb", // blue
  hotel:    "#d97706", // amber
  activity: "#9333ea", // purple
  flight:   "#0ea5e9", // sky
  train:    "#0d9488", // teal
};

const KIND_LEGEND: Record<PointKind, string> = {
  start: "Stop (in travel order)", stop: "Stop (in travel order)", end: "Stop (in travel order)",
  hotel: "Hotel", activity: "Activity", flight: "Flight arrival", train: "Train arrival",
};

const KIND_SYMBOL: Record<PointKind, string> = {
  start: "S", stop: "•", end: "E", hotel: "H", activity: "A", flight: "✈", train: "T",
};

/** Maps each route point (start/stop/end, in travel order) to its 1-based
 * stop number — e.g. Delhi(1) → Munnar(2) → Alappuzha(3) — so the map shows
 * the sequence travellers actually follow instead of a start/end distinction. */
function buildRouteOrder(points: MapPoint[]): Map<string, number> {
  const order = new Map<string, number>();
  let n = 0;
  for (const p of points) {
    if (p.kind === "start" || p.kind === "stop" || p.kind === "end") {
      n++;
      order.set(p.query.trim().toLowerCase(), n);
    }
  }
  return order;
}

/** Finds an existing point matching `label` (case-insensitive) and reuses its
 * coordinates/kind, or appends a new point with the given `kind` — so e.g. a
 * flight arriving into a city that's already a route stop doesn't get a
 * second, redundant marker. */
function ensurePoint(points: MapPoint[], label: string, kind: PointKind): MapPoint {
  const key = label.trim().toLowerCase();
  const existing = points.find((p) => p.query.trim().toLowerCase() === key);
  if (existing) return existing;
  const point: MapPoint = { label: label.trim(), query: label.trim(), kind };
  points.push(point);
  return point;
}

/** A flight/train leg only renders when both ends resolve to a real place —
 * "from" falls back to the starting point (you always begin the trip there),
 * but "to" has no safe default (it's genuinely ambiguous which city the
 * flight/train actually arrives in), so it's skipped without one. */
function buildLeg(
  included: boolean, fromRaw: string, toRaw: string, startingPoint: string,
  points: MapPoint[], kind: "flight" | "train",
): [MapPoint, MapPoint] | null {
  if (!included) return null;
  const fromQuery = fromRaw.trim() || startingPoint.trim();
  const toQuery = toRaw.trim();
  if (!fromQuery || !toQuery) return null;
  return [ensurePoint(points, fromQuery, kind), ensurePoint(points, toQuery, kind)];
}

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

export function ItineraryMap({
  startingPoint, stops, itineraries,
  flightsIncluded, flightFrom, flightTo,
  trainIncluded, trainFrom, trainTo,
}: {
  startingPoint:   string;
  stops:           StopInput[];
  itineraries:     DayItinerary[];
  flightsIncluded: boolean;
  flightFrom:      string;
  flightTo:        string;
  trainIncluded:   boolean;
  trainFrom:       string;
  trainTo:         string;
}) {
  const mapRef         = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const [geocoded, setGeocoded]     = useState<GeocodedPoint[] | null>(null);
  const [failed, setFailed]         = useState(false);
  const [routeSource, setRouteSource] = useState<"road" | "straight" | null>(null);

  const points = buildPoints(startingPoint, stops, itineraries);
  // Legs are computed against (and can extend) `points`, so they must run
  // before pointsKey/geocoding — a flight/train arrival city not already a
  // stop needs its own marker geocoded too.
  const flightLeg = buildLeg(flightsIncluded, flightFrom, flightTo, startingPoint, points, "flight");
  const trainLeg  = buildLeg(trainIncluded, trainFrom, trainTo, startingPoint, points, "train");
  const routeOrder = buildRouteOrder(points);
  const pointsKey = points.map((p) => `${p.kind}:${p.query}`).join("|");
  const legsKey = `${flightLeg?.[0].query ?? ""}>${flightLeg?.[1].query ?? ""}|${trainLeg?.[0].query ?? ""}>${trainLeg?.[1].query ?? ""}`;

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
    setRouteSource(null);

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
      // Draw a straight-line placeholder immediately, then swap it for the
      // real road route once Mapbox Directions responds (below).
      // The starting point drops out of the *driving* route when a flight or
      // train leg already covers that hop (Mumbai -> Kerala isn't a drive).
      const startCoveredBySpecialLeg = flightLeg?.[0].kind === "start" || trainLeg?.[0].kind === "start";
      const routePoints = geocoded.filter((p) =>
        p.kind === "stop" || p.kind === "end" || (p.kind === "start" && !startCoveredBySpecialLeg),
      );
      const routeCoords: [number, number][] = routePoints.map((p) => [p.lat, p.lng]);
      let outlineLine = routeCoords.length > 1
        ? L.polyline(routeCoords, { color: "#ffffff", weight: 7, opacity: 0.9 }).addTo(map)
        : null;
      let routeLine = routeCoords.length > 1
        ? L.polyline(routeCoords, { color: "#2563eb", weight: 3.5, dashArray: "9 6", opacity: 0.9 }).addTo(map)
        : null;

      geocoded.forEach((p) => {
        const isRoutePoint = p.kind === "start" || p.kind === "stop" || p.kind === "end";
        const stopNumber = routeOrder.get(p.query.trim().toLowerCase());
        const symbol = isRoutePoint && stopNumber != null ? String(stopNumber) : KIND_SYMBOL[p.kind];
        const icon = L.divIcon({
          className: "",
          html: markerHtml(KIND_COLOR[p.kind], symbol),
          iconSize: [28, 28],
          iconAnchor: [14, 14],
          popupAnchor: [0, -16],
        });
        const legendText = isRoutePoint && stopNumber != null ? `Stop ${stopNumber}` : KIND_LEGEND[p.kind];
        const popup = `<strong style="font-size:12px">${p.label}</strong><br/><span style="font-size:10px;color:#666">${legendText}</span>`;
        L.marker([p.lat, p.lng], { icon }).addTo(map).bindPopup(popup);
      });

      // Flight/train legs — dashed straight lines in their own color, never
      // routed by road (a plane/train doesn't follow the highway network).
      const drawLeg = (leg: [MapPoint, MapPoint] | null, color: string, symbol: string) => {
        if (!leg) return;
        const from = geocoded.find((p) => p.query === leg[0].query);
        const to = geocoded.find((p) => p.query === leg[1].query);
        if (!from || !to) return;
        const legCoords: [number, number][] = [[from.lat, from.lng], [to.lat, to.lng]];
        L.polyline(legCoords, { color: "#ffffff", weight: 6, opacity: 0.85 }).addTo(map);
        L.polyline(legCoords, { color, weight: 3, dashArray: "2 8", opacity: 0.95 }).addTo(map);
        const mid: [number, number] = [(from.lat + to.lat) / 2, (from.lng + to.lng) / 2];
        L.marker(mid, {
          icon: L.divIcon({
            className: "", html: markerHtml(color, symbol),
            iconSize: [22, 22], iconAnchor: [11, 11],
          }),
        }).addTo(map).bindPopup(`<span style="font-size:11px">${leg[0].label} → ${leg[1].label}</span>`);
      };
      drawLeg(flightLeg, KIND_COLOR.flight, "✈");
      drawLeg(trainLeg, KIND_COLOR.train, "T");

      const allCoords: [number, number][] = geocoded.map((p) => [p.lat, p.lng]);
      if (allCoords.length > 1) {
        map.fitBounds(L.latLngBounds(allCoords), { padding: [36, 36] });
      } else {
        map.setView(allCoords[0], 11);
      }

      // ── Mapbox road route — replaces the straight-line placeholder above
      // once it loads, so point-to-point travel follows real roads. ─────────
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      if (token && routePoints.length >= 2) {
        const mbCoords = routePoints.map((p) => `${p.lng},${p.lat}`).join(";");
        fetch(
          `https://api.mapbox.com/directions/v5/mapbox/driving/${mbCoords}` +
          `?access_token=${token}&geometries=geojson&overview=full&steps=false`,
        )
          .then((r) => r.json())
          .then((data) => {
            if (cancelled || !mapInstanceRef.current) return;
            const route = data.routes?.[0];
            if (route?.geometry?.coordinates) {
              outlineLine?.remove();
              routeLine?.remove();

              const roadCoords = (route.geometry.coordinates as [number, number][]).map(
                ([lng, lat]) => [lat, lng] as [number, number],
              );

              outlineLine = L.polyline(roadCoords, { color: "#ffffff", weight: 8, opacity: 0.95 }).addTo(mapInstanceRef.current);
              routeLine = L.polyline(roadCoords, { color: "#2563eb", weight: 4, opacity: 1 }).addTo(mapInstanceRef.current);

              mapInstanceRef.current.eachLayer((layer) => {
                if ((layer as import("leaflet").Marker).getIcon) {
                  (layer as unknown as { bringToFront?: () => void }).bringToFront?.();
                }
              });

              setRouteSource("road");
            } else {
              setRouteSource("straight");
            }
          })
          .catch(() => setRouteSource("straight"));
      } else if (routeCoords.length > 1) {
        setRouteSource("straight");
      }
    });

    return () => {
      cancelled = true;
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
    };
    // legsKey below catches flight/train fields changing (toggled off, or
    // From/To edited) even when the geocoded point set itself is unchanged.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geocoded, legsKey]);

  if (points.length === 0) return null;

  // Marker kinds actually present, plus flight/train legs even when they
  // reuse an existing start/stop/end marker (so the line color still gets a
  // legend entry). start/stop/end collapse into one "stop" entry — they're
  // no longer visually distinct, just numbered in travel order.
  const usedKinds = Array.from(new Set([
    ...(geocoded ?? []).map((p) => (p.kind === "start" || p.kind === "end" ? "stop" : p.kind)),
    ...(flightLeg ? (["flight"] as const) : []),
    ...(trainLeg ? (["train"] as const) : []),
  ]));

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
                {routeSource && (
                  <span className="flex items-center gap-1 pl-2 border-l border-neutral-200">
                    <span className="inline-block w-4 h-0.5 rounded-full bg-[#2563eb]" />
                    {routeSource === "road" ? "Road route" : "Estimated path"}
                  </span>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
