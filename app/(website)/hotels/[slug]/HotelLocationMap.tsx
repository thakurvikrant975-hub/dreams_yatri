"use client";

// Leaflet CSS — this component is always dynamically imported with ssr:false
// so this import is safe and only executes in the browser.
import "leaflet/dist/leaflet.css";

import { useEffect, useRef } from "react";
import type * as LeafletNS from "leaflet";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export default function HotelLocationMap({
  latitude,
  longitude,
  name,
  address,
}: {
  latitude: number;
  longitude: number;
  name: string;
  address: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

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
    };
  }, [latitude, longitude, name, address]);

  return <div ref={containerRef} className="h-full w-full" />;
}
