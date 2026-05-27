"use client";

// Leaflet CSS — this component is always dynamically imported with ssr:false
// so this import is safe and only executes in the browser.
import "leaflet/dist/leaflet.css";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import type { Map as LeafletMap, DivIcon } from "leaflet";

interface Props {
  lat: number;
  lng: number;
  onPin: (lat: number, lng: number) => void;
}

// Custom circular pin icon — avoids the broken default leaflet icon in Next.js
function createPinIcon(): DivIcon {
  // L is only available client-side; we import it dynamically inside the function
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const L = require("leaflet") as typeof import("leaflet");
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width:22px;height:22px;
        background:#2563eb;
        border-radius:50%;
        border:3px solid white;
        box-shadow:0 2px 10px rgba(37,99,235,.6);
      "></div>`,
    iconSize:   [22, 22],
    iconAnchor: [11, 11],
  });
}

function ClickHandler({ onPin }: { onPin: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPin(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function LocationMapPicker({ lat, lng, onPin }: Props) {
  const mapRef = useRef<LeafletMap | null>(null);
  const iconRef = useRef<DivIcon | null>(null);

  // Create icon once
  if (!iconRef.current) {
    iconRef.current = createPinIcon();
  }

  // Fly map to new coords when they change externally
  useEffect(() => {
    mapRef.current?.panTo([lat, lng], { animate: true });
  }, [lat, lng]);

  return (
    <MapContainer
      center={[lat, lng]}
      zoom={13}
      scrollWheelZoom
      className="h-full w-full rounded-xl"
      ref={mapRef}
    >
      <TileLayer
        url={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`}
        attribution='&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        tileSize={512}
        zoomOffset={-1}
        maxZoom={22}
      />
      <ClickHandler onPin={onPin} />
      {iconRef.current && (
        <Marker
          position={[lat, lng]}
          draggable
          icon={iconRef.current}
          eventHandlers={{
            dragend(e) {
              const m = e.target as { getLatLng(): { lat: number; lng: number } };
              const pos = m.getLatLng();
              onPin(pos.lat, pos.lng);
            },
          }}
        />
      )}
    </MapContainer>
  );
}
