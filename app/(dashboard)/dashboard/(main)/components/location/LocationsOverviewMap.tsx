"use client";

// Leaflet CSS — this component is always dynamically imported with ssr:false
// so this import is safe and only executes in the browser.
import "leaflet/dist/leaflet.css";

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import type { Map as LeafletMap, DivIcon } from "leaflet";

export type MapPoint = {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
};

interface Props {
  points: MapPoint[];
  onEdit?: (id: string) => void;
}

const INDIA_BOUNDS: [[number, number], [number, number]] = [
  [6.5, 68.0],
  [37.5, 97.5],
];

function FitToPoints({ points }: { points: MapPoint[] }) {
  const map = useMap();
  const doneRef = useRef(false);
  useEffect(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (points.length === 0) {
      map.fitBounds(INDIA_BOUNDS, { padding: [12, 12], animate: false });
      return;
    }
    if (points.length === 1) {
      map.setView([points[0].latitude, points[0].longitude], 10, { animate: false });
      return;
    }
    const bounds: [number, number][] = points.map((p) => [p.latitude, p.longitude]);
    map.fitBounds(bounds, { padding: [32, 32], animate: false });
  }, [map, points]);
  return null;
}

function createPinIcon(): DivIcon {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const L = require("leaflet") as typeof import("leaflet");
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width:18px;height:18px;
        background:#16a34a;
        border-radius:50%;
        border:3px solid white;
        box-shadow:0 2px 8px rgba(22,163,74,.6);
      "></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

export default function LocationsOverviewMap({ points, onEdit }: Props) {
  const mapRef = useRef<LeafletMap | null>(null);
  const icon = useMemo(() => createPinIcon(), []);

  const plottable = useMemo(
    () => points.filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)),
    [points],
  );

  return (
    <MapContainer
      center={[22.5, 80]}
      zoom={5}
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

      <FitToPoints points={plottable} />

      {plottable.map((p) => (
        <Marker key={p.id} position={[p.latitude, p.longitude]} icon={icon}>
          <Popup>
            <div className="space-y-1.5 text-xs">
              <p className="font-semibold text-sm">{p.name}</p>
              <p className="text-muted-foreground">{p.type}</p>
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(p.id)}
                  className="font-medium text-primary underline underline-offset-2 hover:no-underline"
                >
                  Edit this location
                </button>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
