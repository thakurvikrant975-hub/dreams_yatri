"use client";

import { useEffect, useRef } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

type Stop = {
  place_name: string;
  latitude: number;
  longitude: number;
  stay_days: number;
};

type Props = {
  stops: Stop[];
};

// ── Haversine distance ─────────────────────────────────────────────────────

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

  const validStops = stops.filter((s) => s.latitude && s.longitude);

  useEffect(() => {
    if (!mapRef.current || validStops.length === 0) return;

    // Leaflet must run client-side only
    import("leaflet").then((L) => {
      // Fix default icon paths (bundler issue)
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

      // Draw polyline
      L.polyline(coords, { color: "hsl(var(--primary))", weight: 3, dashArray: "6 4" }).addTo(map);

      // Add numbered markers
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
            `<strong>${validStops[i].place_name}</strong><br/>${validStops[i].stay_days} night${validStops[i].stay_days > 1 ? "s" : ""}`,
          );
      });

      // Fit bounds
      if (coords.length > 1) map.fitBounds(L.latLngBounds(coords), { padding: [40, 40] });
    });

    return () => {
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
      {/* Distance table */}
      {validStops.length > 1 && (
        <div className="rounded-lg border divide-y text-sm">
          {validStops.slice(0, -1).map((stop, i) => {
            const next = validStops[i + 1];
            const km = haversineKm(stop.latitude, stop.longitude, next.latitude, next.longitude);
            return (
              <div key={i} className="flex items-center justify-between px-3 py-2">
                <span className="text-muted-foreground">
                  {stop.place_name} → {next.place_name}
                </span>
                <span className="font-medium tabular-nums">~{Math.round(km)} km</span>
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
