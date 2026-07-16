"use client";

// Leaflet CSS — this component is always dynamically imported with ssr:false
// so this import is safe and only executes in the browser.
import "leaflet/dist/leaflet.css";

import { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import type { DivIcon } from "leaflet";

function createPinIcon(): DivIcon {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const L = require("leaflet") as typeof import("leaflet");
  return L.divIcon({
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
  const icon = useMemo(() => createPinIcon(), []);

  return (
    <MapContainer
      center={[latitude, longitude]}
      zoom={15}
      scrollWheelZoom={false}
      className="h-full w-full"
    >
      <TileLayer
        url={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`}
        attribution='&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        tileSize={512}
        zoomOffset={-1}
        maxZoom={22}
      />
      <Marker position={[latitude, longitude]} icon={icon}>
        <Popup>
          <div className="space-y-1 text-xs">
            <p className="font-semibold text-sm">{name}</p>
            <p className="text-neutral-500">{address}</p>
          </div>
        </Popup>
      </Marker>
    </MapContainer>
  );
}
