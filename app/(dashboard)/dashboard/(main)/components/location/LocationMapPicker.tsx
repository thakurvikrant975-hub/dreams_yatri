"use client";

// Leaflet CSS — this component is always dynamically imported with ssr:false
// so this import is safe and only executes in the browser.
import "leaflet/dist/leaflet.css";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import type { Map as LeafletMap, DivIcon } from "leaflet";

interface Props {
  lat: number;
  lng: number;
  onPin: (lat: number, lng: number) => void;
}

// India's full bounding box — includes J&K (north), Kanyakumari (south),
// Arunachal Pradesh (east) and Gujarat/Kutch (west).
const INDIA_BOUNDS: [[number, number], [number, number]] = [
  [6.5,  68.0],   // SW — south of Kanyakumari + Lakshadweep buffer
  [37.5, 97.5],   // NE — top of Kashmir + Arunachal Pradesh
];

// Fit India on first mount (via useMap inside the MapContainer tree).
// doneRef prevents re-fitting on internal re-renders; each mount of this
// component gets its own ref so fullscreen remounts correctly show India.
function FitIndiaBounds() {
  const map = useMap();
  const doneRef = useRef(false);
  useEffect(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    map.fitBounds(INDIA_BOUNDS, { padding: [12, 12], animate: false });
  }, [map]);
  return null;
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

// ClickHandler sets userPinnedRef *before* calling onPin so that the useEffect
// below can distinguish a user map-click from an external coordinate change.
function ClickHandler({
  onPin,
  onUserPin,
}: {
  onPin: (lat: number, lng: number) => void;
  onUserPin: () => void;
}) {
  useMapEvents({
    click(e) {
      onUserPin();
      onPin(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function LocationMapPicker({ lat, lng, onPin }: Props) {
  const mapRef = useRef<LeafletMap | null>(null);
  const iconRef = useRef<DivIcon | null>(null);

  // When true, the next lat/lng change came from the user clicking/dragging
  // on the map itself — skip panTo because they're already looking at the pin.
  // When false, the change is external (text inputs / Google Maps URL) — pan.
  const userPinnedRef = useRef(false);

  // Create icon once
  if (!iconRef.current) {
    iconRef.current = createPinIcon();
  }

  // Pan (WITHOUT zooming) only for external coord changes.
  // User map interactions set userPinnedRef so we skip the pan there.
  useEffect(() => {
    if (userPinnedRef.current) {
      userPinnedRef.current = false;
      return;
    }
    mapRef.current?.panTo([lat, lng], { animate: true });
  }, [lat, lng]);

  return (
    <MapContainer
      center={[lat, lng]}
      zoom={5}                  // placeholder — overridden by FitIndiaBounds on mount
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

      {/* Fit full India view on every fresh mount */}
      <FitIndiaBounds />

      <ClickHandler
        onPin={onPin}
        onUserPin={() => { userPinnedRef.current = true; }}
      />

      {iconRef.current && (
        <Marker
          position={[lat, lng]}
          draggable
          icon={iconRef.current}
          eventHandlers={{
            dragend(e) {
              // Mark as user-initiated before the state update propagates
              userPinnedRef.current = true;
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
