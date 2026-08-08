"use client";

// A small map of one day's drive: pickup, drop, and the road between them.
//
// Leaflet, loaded dynamically — same approach as ItineraryMap, which is what
// keeps a fairly heavy library out of the initial bundle for the many packages
// nobody opens the transport drawer on.

import { useEffect, useRef } from "react";

export function RouteMiniMap({ from, to, line }: {
  from: { lat: number; lng: number } | null;
  to: { lat: number; lng: number } | null;
  /** Driven route as [lng, lat] pairs, straight from Mapbox. Leaflet wants
   * [lat, lng], so it's flipped here rather than at the call site. */
  line?: [number, number][];
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);

  useEffect(() => {
    if (!hostRef.current || (!from && !to)) return;
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !hostRef.current) return;

      if (!mapRef.current) {
        mapRef.current = L.map(hostRef.current, {
          zoomControl: false,
          attributionControl: false,
          scrollWheelZoom: false,
        });
        L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
          maxZoom: 18,
        }).addTo(mapRef.current);
      }
      const map = mapRef.current;

      // Clear everything but the tiles before redrawing.
      map.eachLayer((layer) => {
        if (!(layer instanceof L.TileLayer)) map.removeLayer(layer);
      });

      const dot = (color: string) => L.divIcon({
        className: "",
        html: `<span style="display:block;width:11px;height:11px;border-radius:9999px;background:${color};box-shadow:0 0 0 3px rgba(255,255,255,.9)"></span>`,
        iconSize: [11, 11],
        iconAnchor: [6, 6],
      });

      const points: [number, number][] = [];
      if (from) { L.marker([from.lat, from.lng], { icon: dot("#0F8A5F") }).addTo(map); points.push([from.lat, from.lng]); }
      if (to) { L.marker([to.lat, to.lng], { icon: dot("#c0392b") }).addTo(map); points.push([to.lat, to.lng]); }

      if (line && line.length > 1) {
        const latlngs = line.map(([lng, lat]) => [lat, lng] as [number, number]);
        L.polyline(latlngs, { color: "#ffffff", weight: 6, opacity: 0.9 }).addTo(map);
        L.polyline(latlngs, { color: "#c0392b", weight: 3, opacity: 0.95 }).addTo(map);
        map.fitBounds(L.latLngBounds(latlngs), { padding: [18, 18] });
      } else if (points.length === 2) {
        map.fitBounds(L.latLngBounds(points), { padding: [24, 24] });
      } else if (points.length === 1) {
        map.setView(points[0], 11);
      }
      // Leaflet mis-measures inside a drawer that animates open.
      setTimeout(() => map.invalidateSize(), 60);
    });

    return () => { cancelled = true; };
  }, [from, to, line]);

  useEffect(() => () => { mapRef.current?.remove(); mapRef.current = null; }, []);

  if (!from && !to) return null;
  return (
    <div
      ref={hostRef}
      className="h-40 w-full rounded-xl overflow-hidden border border-dashboard-base-300"
    />
  );
}
