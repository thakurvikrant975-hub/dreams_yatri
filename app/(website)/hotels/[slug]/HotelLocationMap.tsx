"use client";

// Leaflet CSS — this component is always dynamically imported with ssr:false
// so this import is safe and only executes in the browser.
import "leaflet/dist/leaflet.css";

import { useEffect, useRef } from "react";
import type * as LeafletNS from "leaflet";
import type { RouteResult } from "./route-actions";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatRouteDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds: number): string {
  const totalMin = Math.round(seconds / 60);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} m`;
}

export type MapDestination = {
  id: string;
  lat: number;
  lon: number;
  label: string;
  route: RouteResult | null;
};

export default function HotelLocationMap({
  latitude,
  longitude,
  name,
  address,
  destinations = [],
}: {
  latitude: number;
  longitude: number;
  name: string;
  address: string;
  destinations?: MapDestination[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletNS.Map | null>(null);
  const destLayerRef = useRef<LeafletNS.LayerGroup | null>(null);

  // Base map + fixed hotel marker — only rebuilt if the hotel's own
  // identity/coords change (never during a normal session).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // React 18 Strict Mode (dev only) double-invokes effects — mount,
    // cleanup, mount again — reusing the SAME DOM node. Leaflet stamps a
    // `_leaflet_id` flag on the container when it initializes and refuses to
    // reinitialize a node that still carries one from a prior instance.
    // Managing the map imperatively (instead of via react-leaflet's
    // <MapContainer>) lets us clear that flag defensively before creating a
    // new instance, so the second Strict Mode mount never crashes.
    delete (container as unknown as { _leaflet_id?: unknown })._leaflet_id;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require("leaflet") as typeof LeafletNS;

    const map = L.map(container, {
      center: [latitude, longitude],
      zoom: 15,
      scrollWheelZoom: false,
    });
    mapRef.current = map;

    L.tileLayer(`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`, {
      attribution: '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      tileSize: 512,
      zoomOffset: -1,
      maxZoom: 22,
    }).addTo(map);

    const icon = L.divIcon({
      className: "",
      html: `
        <div style="
          width:18px;height:18px;
          background:#dc2626;
          border-radius:50%;
          border:3px solid white;
          box-shadow:0 2px 8px rgba(220,38,38,.6);
        "></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    L.marker([latitude, longitude], { icon })
      .addTo(map)
      .bindPopup(
        `<div style="font-size:12px;line-height:1.4">
          <p style="font-weight:600;font-size:13px;margin:0 0 2px">${escapeHtml(name)}</p>
          <p style="color:#737373;margin:0">${escapeHtml(address)}</p>
        </div>`,
      );

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [latitude, longitude, name, address]);

  // Destination markers + route polylines + distance/duration labels —
  // redrawn whenever the selected destinations (or their resolved routes)
  // change, without tearing down the base map/tiles.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require("leaflet") as typeof LeafletNS;

    destLayerRef.current?.remove();
    destLayerRef.current = null;

    if (destinations.length === 0) {
      map.setView([latitude, longitude], 15);
      return;
    }

    const group = L.layerGroup().addTo(map);
    destLayerRef.current = group;

    const destIcon = L.divIcon({
      className: "",
      html: `
        <div style="
          width:16px;height:16px;
          background:#2563eb;
          border-radius:50%;
          border:3px solid white;
          box-shadow:0 2px 8px rgba(37,99,235,.6);
        "></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    const bounds: LeafletNS.LatLngBoundsExpression = [[latitude, longitude]];

    for (const dest of destinations) {
      L.marker([dest.lat, dest.lon], { icon: destIcon }).addTo(group).bindPopup(`<b>${escapeHtml(dest.label)}</b>`);
      (bounds as [number, number][]).push([dest.lat, dest.lon]);

      if (dest.route) {
        const isWalking = dest.route.mode === "walking";
        const line = L.polyline(dest.route.geometry, {
          color: isWalking ? "#059669" : "#2563eb",
          weight: 4,
          opacity: 0.8,
          dashArray: isWalking ? "2,10" : undefined,
        }).addTo(group);
        const mid = dest.route.geometry[Math.floor(dest.route.geometry.length / 2)];
        if (mid) {
          const verb = isWalking ? "walk" : "drive";
          line.bindTooltip(
            `${formatDuration(dest.route.durationS)} ${verb} &middot; ${formatRouteDistance(dest.route.distanceM)}`,
            { permanent: true, direction: "center", className: "route-duration-tooltip", offset: [0, 0] },
          ).openTooltip(mid);
        }
      }
    }

    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
  }, [destinations, latitude, longitude]);

  return (
    <>
      <style>{`
        .route-duration-tooltip {
          background: #111827;
          color: #fff;
          font-size: 11px;
          font-weight: 600;
          padding: 3px 9px;
          border-radius: 9999px;
          border: none;
          box-shadow: 0 2px 6px rgba(0,0,0,.25);
        }
        .route-duration-tooltip::before { display: none; }
      `}</style>
      <div ref={containerRef} className="h-full w-full" />
    </>
  );
}
