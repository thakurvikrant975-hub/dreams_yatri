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

// ── Component ──────────────────────────────────────────────────────────────

export function RoutePreviewMap({ stops }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const [roadLegs, setRoadLegs] = useState<RoadLeg[] | null>(null);

  const validStops = stops.filter((s) => s.latitude && s.longitude);

  useEffect(() => {
    if (!mapRef.current || validStops.length === 0) return;

    setRoadLegs(null);
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !mapRef.current) return;

      // @ts-expect-error leaflet icon hack
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const coords: [number, number][] = validStops.map((s) => [s.latitude, s.longitude]);
      const map = L.map(mapRef.current!).setView(coords[0], 7);
      mapInstanceRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 18,
      }).addTo(map);

      // Initial dashed polyline (haversine straight-line, replaced when Mapbox loads)
      let polyline = L.polyline(coords, {
        color: "hsl(var(--primary))",
        weight: 3,
        dashArray: "6 4",
        opacity: 0.7,
      }).addTo(map);

      // Numbered markers
      coords.forEach(([lat, lng], i) => {
        const icon = L.divIcon({
          className: "",
          html: `<div style="background:hsl(var(--primary));color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,.3)">${i + 1}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        L.marker([lat, lng], { icon })
          .addTo(map)
          .bindPopup(
            `<strong>${validStops[i].place_name}</strong><br/>${validStops[i].stay_days} night${validStops[i].stay_days !== 1 ? "s" : ""}`,
          );
      });

      if (coords.length > 1) map.fitBounds(L.latLngBounds(coords), { padding: [40, 40] });

      // Fetch Mapbox road route to replace straight-line polyline
      const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      if (TOKEN && validStops.length >= 2) {
        const mbCoords = validStops.map((s) => `${s.longitude},${s.latitude}`).join(";");
        fetch(
          `https://api.mapbox.com/directions/v5/mapbox/driving/${mbCoords}?access_token=${TOKEN}&geometries=geojson&overview=full&steps=false`,
        )
          .then((r) => r.json())
          .then((data) => {
            if (cancelled || !mapInstanceRef.current) return;
            const route = data.routes?.[0];
            if (route?.geometry?.coordinates) {
              polyline.remove();
              const roadCoords = (route.geometry.coordinates as [number, number][]).map(
                ([lng, lat]) => [lat, lng] as [number, number],
              );
              polyline = L.polyline(roadCoords, {
                color: "hsl(var(--primary))",
                weight: 3,
              }).addTo(mapInstanceRef.current!);
              setRoadLegs(
                route.legs.map((leg: { distance: number; duration: number }) => ({
                  distance_km: Math.round(leg.distance / 1000),
                  duration_min: Math.round(leg.duration / 60),
                })),
              );
            }
          })
          .catch(() => {});
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
      {/* Per-leg distance + duration table */}
      {validStops.length > 1 && (
        <div className="rounded-lg border divide-y text-sm">
          {validStops.slice(0, -1).map((stop, i) => {
            const next = validStops[i + 1];
            const leg = roadLegs?.[i];
            const km = leg?.distance_km ?? Math.round(haversineKm(stop.latitude, stop.longitude, next.latitude, next.longitude));
            const isRoad = !!leg;
            const dMin = leg?.duration_min;
            return (
              <div key={i} className="flex items-center justify-between px-3 py-2">
                <span className="text-muted-foreground text-xs">
                  {stop.place_name} → {next.place_name}
                </span>
                <span className="font-medium tabular-nums text-xs flex items-center gap-1.5">
                  {km} km
                  {!isRoad && (
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
      <div ref={mapRef} className="h-72 rounded-lg overflow-hidden border" />
    </div>
  );
}
