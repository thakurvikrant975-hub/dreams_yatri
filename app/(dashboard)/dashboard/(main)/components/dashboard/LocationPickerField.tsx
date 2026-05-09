"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MapPin, Map, Loader2, X, Check } from "lucide-react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { LocationSearchInput, type LocationResult } from "./LocationSearchInput";
import { cn } from "@/app/lib/utils";

// ── Reverse geocoding ──────────────────────────────────────────────────────

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

async function reverseGeocode(lat: number, lng: number): Promise<LocationResult> {
  if (TOKEN) {
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${TOKEN}&types=address,place,locality,district,region&limit=1&language=en`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const feature = data.features?.[0];
        if (feature) {
          return {
            place_name: feature.text || feature.place_name,
            place_id: feature.id,
            address: feature.place_name,
            latitude: lat,
            longitude: lng,
          };
        }
      }
    } catch {
      // fall through to coordinate fallback
    }
  }
  const coord = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  return { place_name: coord, place_id: "", address: coord, latitude: lat, longitude: lng };
}

// ── Map canvas with draggable pin ──────────────────────────────────────────

type PinPos = { lat: number; lng: number };

function MapPinCanvas({
  initialCenter,
  onPinMove,
}: {
  initialCenter: PinPos;
  onPinMove: (lat: number, lng: number) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const callbackRef = useRef(onPinMove);
  callbackRef.current = onPinMove;

  useEffect(() => {
    if (!mapRef.current) return;

    import("leaflet").then((L) => {
      // Fix default icon paths
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

      const map = L.map(mapRef.current!).setView(
        [initialCenter.lat, initialCenter.lng],
        initialCenter.lat === 20 && initialCenter.lng === 78 ? 5 : 12,
      );
      mapInstanceRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker([initialCenter.lat, initialCenter.lng], {
        draggable: true,
        icon: L.divIcon({
          className: "",
          html: `<div style="background:hsl(221,83%,53%);border:3px solid #fff;border-radius:50%;width:20px;height:20px;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
      }).addTo(map);

      marker.on("dragend", () => {
        const { lat, lng } = marker.getLatLng();
        callbackRef.current(lat, lng);
      });

      map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        callbackRef.current(lat, lng);
      });
    });

    return () => {
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div ref={mapRef} className="h-80 w-full rounded-lg border overflow-hidden" />
    </>
  );
}

// ── LocationPickerField ────────────────────────────────────────────────────

type Props = {
  value: LocationResult | null;
  onChange: (result: LocationResult | null) => void;
  placeholder?: string;
  className?: string;
};

export function LocationPickerField({
  value,
  onChange,
  placeholder = "Search location…",
  className,
}: Props) {
  const [mapOpen, setMapOpen] = useState(false);
  const [pendingPin, setPendingPin] = useState<PinPos>({ lat: 20, lng: 78 });
  const [reverseLoading, setReverseLoading] = useState(false);

  function openMap() {
    setPendingPin(
      value ? { lat: value.latitude, lng: value.longitude } : { lat: 20, lng: 78 },
    );
    setMapOpen(true);
  }

  const handlePinMove = useCallback((lat: number, lng: number) => {
    setPendingPin({ lat, lng });
  }, []);

  async function handleConfirmPin() {
    setReverseLoading(true);
    const result = await reverseGeocode(pendingPin.lat, pendingPin.lng);
    onChange(result);
    setReverseLoading(false);
    setMapOpen(false);
  }

  return (
    <div className={cn("space-y-1", className)}>
      <LocationSearchInput value={value} onChange={onChange} placeholder={placeholder} />

      <button
        type="button"
        onClick={openMap}
        className="flex items-center gap-1 text-[11px] text-primary hover:underline mt-0.5"
      >
        <Map className="h-3 w-3" />
        Or pin on map
      </button>

      <Dialog open={mapOpen} onOpenChange={setMapOpen}>
        <DialogContent className="max-w-2xl gap-4">
          <DialogHeader>
            <DialogTitle>Pin Location on Map</DialogTitle>
            <DialogDescription>
              Click anywhere or drag the pin to set the precise location
            </DialogDescription>
          </DialogHeader>

          {mapOpen && (
            <MapPinCanvas initialCenter={pendingPin} onPinMove={handlePinMove} />
          )}

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground font-mono">
              {pendingPin.lat.toFixed(5)}, {pendingPin.lng.toFixed(5)}
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setMapOpen(false)}>
                <X className="h-3.5 w-3.5 mr-1" /> Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmPin}
                disabled={reverseLoading}
              >
                {reverseLoading
                  ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Looking up…</>
                  : <><Check className="h-3.5 w-3.5 mr-1" />Use this location</>
                }
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
