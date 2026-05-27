"use client";

import { useEffect, useRef, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

type Stop = {
  place_name: string;
  latitude: number;
  longitude: number;
  stay_days: number;
};

type RoadLeg = {
  distance_km: number;
  duration_min: number;
};

type Props = {
  stops: Stop[];
};

// ── Constants ──────────────────────────────────────────────────────────────

const ROUTE_COLOR   = "#2563eb";   // blue-600  — road line fill
const OUTLINE_COLOR = "#ffffff";   // white     — road line outline
const MARKER_COLORS = [
  "#2563eb", // blue   — general stops
];
// First stop = green, last stop = red, middle = blue
const FIRST_COLOR = "#16a34a";  // green-600
const LAST_COLOR  = "#dc2626";  // red-600
const MID_COLOR   = "#2563eb";  // blue-600

// ── Haversine fallback ─────────────────────────────────────────────────────

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Marker HTML builder ────────────────────────────────────────────────────
// CSS variables don't resolve inside Leaflet divIcon innerHTML — use hardcoded colors.

function markerHtml(label: string, bg: string) {
  return `
    <div style="
      background:${bg};
      color:#fff;
      border-radius:50%;
      width:34px;
      height:34px;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:13px;
      font-weight:800;
      border:3px solid #fff;
      box-shadow:0 2px 10px rgba(0,0,0,0.45),0 0 0 1px rgba(0,0,0,0.12);
      letter-spacing:-0.5px;
      font-family:system-ui,sans-serif;
    ">${label}</div>`;
}

function stopColor(index: number, total: number): string {
  if (total === 1) return MID_COLOR;
  if (index === 0) return FIRST_COLOR;
  if (index === total - 1) return LAST_COLOR;
  return MID_COLOR;
}

// ── Component ──────────────────────────────────────────────────────────────

export function RoutePreviewMap({ stops }: Props) {
  const mapRef         = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const [roadLegs, setRoadLegs]   = useState<RoadLeg[] | null>(null);
  const [routeSource, setRouteSource] = useState<"road" | "straight" | null>(null);

  const validStops = stops.filter((s) => s.latitude && s.longitude);

  useEffect(() => {
    if (!mapRef.current || validStops.length === 0) return;

    setRoadLegs(null);
    setRouteSource(null);
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !mapRef.current) return;

      // Remove default icon setup (not needed with divIcon)
      // @ts-expect-error leaflet icon hack
      delete L.Icon.Default.prototype._getIconUrl;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const coords: [number, number][] = validStops.map((s) => [s.latitude, s.longitude]);
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

      // ── Two-layer straight-line fallback ─────────────────────────────────
      // Outline (white, thick) sits below; colored dashed line on top.
      let outlineLine = coords.length > 1
        ? L.polyline(coords, { color: OUTLINE_COLOR, weight: 8, opacity: 0.9 }).addTo(map)
        : null;
      let routeLine = coords.length > 1
        ? L.polyline(coords, {
            color: ROUTE_COLOR, weight: 4,
            dashArray: "10 6", opacity: 0.85,
          }).addTo(map)
        : null;

      // ── Numbered markers ─────────────────────────────────────────────────
      coords.forEach(([lat, lng], i) => {
        const color = stopColor(i, coords.length);
        const icon = L.divIcon({
          className: "",
          html: markerHtml(String(i + 1), color),
          iconSize:   [34, 34],
          iconAnchor: [17, 17],
          popupAnchor: [0, -20],
        });
        const popup = [
          `<strong style="font-size:13px">${validStops[i].place_name}</strong>`,
          i === 0 ? `<span style="color:#16a34a;font-size:11px">▶ Start</span>` :
          i === coords.length - 1 ? `<span style="color:#dc2626;font-size:11px">⏹ End</span>` : "",
          `<span style="font-size:11px;color:#666">${validStops[i].stay_days} night${validStops[i].stay_days !== 1 ? "s" : ""}</span>`,
        ].filter(Boolean).join("<br/>");

        L.marker([lat, lng], { icon }).addTo(map).bindPopup(popup);
      });

      if (coords.length > 1) {
        map.fitBounds(L.latLngBounds(coords), { padding: [48, 48] });
      } else {
        map.setView(coords[0], 10);
      }

      // ── Mapbox road route — replaces straight-line once loaded ────────────
      const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      if (TOKEN && validStops.length >= 2) {
        const mbCoords = validStops.map((s) => `${s.longitude},${s.latitude}`).join(";");
        fetch(
          `https://api.mapbox.com/directions/v5/mapbox/driving/${mbCoords}` +
          `?access_token=${TOKEN}&geometries=geojson&overview=full&steps=false`,
        )
          .then((r) => r.json())
          .then((data) => {
            if (cancelled || !mapInstanceRef.current) return;
            const route = data.routes?.[0];
            if (route?.geometry?.coordinates) {
              // Remove straight-line placeholders
              outlineLine?.remove();
              routeLine?.remove();

              const roadCoords = (route.geometry.coordinates as [number, number][]).map(
                ([lng, lat]) => [lat, lng] as [number, number],
              );

              // Two-layer road: white outline underneath, solid blue on top
              outlineLine = L.polyline(roadCoords, {
                color: OUTLINE_COLOR, weight: 9, opacity: 0.95,
              }).addTo(mapInstanceRef.current);
              routeLine = L.polyline(roadCoords, {
                color: ROUTE_COLOR, weight: 5, opacity: 1,
              }).addTo(mapInstanceRef.current);

              // Bring markers to front so they sit above the route line
              mapInstanceRef.current.eachLayer((layer) => {
                if ((layer as import("leaflet").Marker).getIcon) {
                  (layer as import("leaflet").Marker).bringToFront?.();
                }
              });

              setRoadLegs(
                route.legs.map((leg: { distance: number; duration: number }) => ({
                  distance_km: Math.round(leg.distance / 1000),
                  duration_min: Math.round(leg.duration / 60),
                })),
              );
              setRouteSource("road");
            }
          })
          .catch(() => { setRouteSource("straight"); });
      } else {
        setRouteSource("straight");
      }
    });

    return () => {
      cancelled = true;
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(validStops)]);

  if (validStops.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 rounded-lg border border-dashed bg-muted/30">
        <p className="text-sm text-muted-foreground">Add stops with coordinates to see preview</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Per-leg distance + duration */}
      {validStops.length > 1 && (
        <div className="rounded-lg border divide-y text-sm overflow-hidden">
          {validStops.slice(0, -1).map((stop, i) => {
            const next = validStops[i + 1];
            const leg  = roadLegs?.[i];
            const km   = leg?.distance_km
              ?? Math.round(haversineKm(stop.latitude, stop.longitude, next.latitude, next.longitude));
            const dMin = leg?.duration_min;
            return (
              <div key={i} className="flex items-center justify-between px-3 py-2 bg-background">
                <span className="text-muted-foreground text-xs flex items-center gap-1.5">
                  <span
                    className="inline-flex items-center justify-center rounded-full text-white text-[9px] font-bold shrink-0"
                    style={{ background: stopColor(i, validStops.length), width: 18, height: 18 }}
                  >
                    {i + 1}
                  </span>
                  {stop.place_name}
                  <span className="text-muted-foreground/40">→</span>
                  <span
                    className="inline-flex items-center justify-center rounded-full text-white text-[9px] font-bold shrink-0"
                    style={{ background: stopColor(i + 1, validStops.length), width: 18, height: 18 }}
                  >
                    {i + 2}
                  </span>
                  {next.place_name}
                </span>
                <span className="font-medium tabular-nums text-xs flex items-center gap-1.5 shrink-0">
                  {km} km
                  {routeSource === "straight" && (
                    <span className="text-muted-foreground/50 text-[10px] font-normal">est.</span>
                  )}
                  {dMin != null && (
                    <span className="text-muted-foreground/60 font-normal">
                      · {Math.floor(dMin / 60)}h{dMin % 60 > 0 ? ` ${dMin % 60}m` : ""}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Map */}
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div className="relative">
        <div ref={mapRef} className="h-72 rounded-lg overflow-hidden border" />
        {/* Legend */}
        {validStops.length > 1 && (
          <div className="absolute bottom-2 left-2 z-1000 flex items-center gap-2 rounded-md bg-white/90 backdrop-blur-sm px-2.5 py-1.5 shadow-sm border text-[10px] text-foreground/70">
            <span className="inline-block w-5 h-0.5 rounded-full" style={{ background: ROUTE_COLOR }} />
            {routeSource === "road" ? "Road route" : "Estimated path"}
          </div>
        )}
      </div>
    </div>
  );
}
