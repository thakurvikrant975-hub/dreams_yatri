"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { CheckIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { MapPinIcon } from "@phosphor-icons/react";
import { cn } from "@/app/lib/utils";
import { Card } from "@/app/components/ui/Card";
import { getRouteTo, geocodeDestination } from "./route-actions";
import type { MapDestination } from "./HotelLocationMap";

const HotelLocationMap = dynamic(() => import("./HotelLocationMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-neutral-100" />,
});

type LandmarkItem = { name: string; distance: string; lat?: number | null; lon?: number | null };
type LandmarkGroup = { category: string; items: LandmarkItem[] };

// Cap simultaneous routes so the map doesn't turn into a tangle of polylines.
const MAX_SELECTED = 6;

export default function LocationSurroundings({
  name,
  address,
  city,
  latitude,
  longitude,
  approximate,
  landmarks,
}: {
  name: string;
  address: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  /** Pin is the locality centre, not a surveyed address — say so on the map. */
  approximate?: boolean;
  landmarks: LandmarkGroup[];
}) {
  const [landmarkTab, setLandmarkTab] = useState(0);
  const [selected, setSelected] = useState<Map<string, MapDestination>>(new Map());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const hasCoords = latitude != null && longitude != null;
  const groups = landmarks.filter((l) => l.items.length > 0);
  const hasLandmarks = groups.length > 0;

  async function fetchRoute(id: string, lat: number, lon: number) {
    if (!hasCoords) return;
    const route = await getRouteTo(latitude, longitude, lat, lon);
    setSelected((prev) => {
      if (!prev.has(id)) return prev; // removed while the route was loading
      const next = new Map(prev);
      next.set(id, { ...next.get(id)!, route });
      return next;
    });
  }

  function toggleLandmark(item: LandmarkItem) {
    if (!hasCoords || item.lat == null || item.lon == null) return;
    const id = `lm:${item.lat},${item.lon}`;

    if (selected.has(id)) {
      setSelected((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      return;
    }
    if (selected.size >= MAX_SELECTED) return;

    const lat = item.lat;
    const lon = item.lon;
    setSelected((prev) => {
      const next = new Map(prev);
      next.set(id, { id, lat, lon, label: item.name, route: null });
      return next;
    });
    fetchRoute(id, lat, lon);
  }

  function removeDestination(id: string) {
    setSelected((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }

  async function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q || !hasCoords || searchLoading) return;
    if (selected.size >= MAX_SELECTED) {
      setSearchError(`You can compare up to ${MAX_SELECTED} destinations at once.`);
      return;
    }

    setSearchLoading(true);
    setSearchError(null);
    const geo = await geocodeDestination(q, latitude, longitude);
    setSearchLoading(false);

    if (!geo) {
      setSearchError("No results found for that location.");
      return;
    }

    const id = `search:${geo.lat},${geo.lon}`;
    setSelected((prev) => {
      const next = new Map(prev);
      next.set(id, { id, lat: geo.lat, lon: geo.lon, label: geo.label, route: null });
      return next;
    });
    setSearchQuery("");
    fetchRoute(id, geo.lat, geo.lon);
  }

  const destinations = Array.from(selected.values());

  return (
    <Card className="py-4 px-5">
      <div className="flex items-start gap-2 mb-4 pb-4 border-b border-neutral-200">
        <MapPinIcon weight="fill" className="w-5 h-5 text-primary-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-neutral-800">{name}</p>
          <p className="text-sm text-neutral-500">{address}</p>
        </div>
      </div>

      <div className={cn("grid gap-8", hasLandmarks ? "md:grid-cols-[420px_1fr]" : "sm:grid-cols-1")}>
        {hasLandmarks && (
          <div>
            {hasCoords && (
              <form onSubmit={handleSearchSubmit} className="mb-3">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setSearchError(null); }}
                    placeholder={`Search distance from any location${city ? ` in ${city}` : ""}`}
                    className="w-full text-xs pl-8 pr-3 py-2 rounded-lg border border-neutral-200 focus:outline-none focus:ring-1 focus:ring-primary-400 focus:border-primary-400"
                  />
                </div>
                {searchError && <p className="text-[11px] text-red-500 mt-1">{searchError}</p>}
              </form>
            )}

            <div className="flex gap-1 mb-3 border-b border-neutral-200">
              {groups.map((l, i) => (
                <button
                  key={l.category}
                  onClick={() => setLandmarkTab(i)}
                  className={cn(
                    "text-xs font-semibold px-2 py-2 border-b-2 -mb-px transition-colors",
                    landmarkTab === i ? "border-primary-500 text-primary-500" : "border-transparent text-neutral-500"
                  )}
                >
                  {l.category}
                </button>
              ))}
            </div>
            <ul className="space-y-2.5">
              {groups[landmarkTab]?.items.map((it) => {
                const routable = hasCoords && it.lat != null && it.lon != null;
                const id = routable ? `lm:${it.lat},${it.lon}` : null;
                const isSelected = !!id && selected.has(id);
                return (
                  <li key={it.name} className="flex items-center justify-between gap-2 text-sm">
                    {routable ? (
                      <button
                        type="button"
                        onClick={() => toggleLandmark(it)}
                        className="flex items-center gap-2 flex-1 text-left group"
                      >
                        <span
                          className={cn(
                            "w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors",
                            isSelected ? "bg-primary-500 border-primary-500" : "border-neutral-300 group-hover:border-primary-400"
                          )}
                        >
                          {isSelected && <CheckIcon className="w-3 h-3 text-white" />}
                        </span>
                        <span className="flex items-center gap-1.5 text-neutral-600">
                          <MapPinIcon weight="fill" className="w-3.5 h-3.5 text-neutral-400" /> {it.name}
                        </span>
                      </button>
                    ) : (
                      <span className="flex items-center gap-1.5 text-neutral-600 pl-6">
                        <MapPinIcon weight="fill" className="w-3.5 h-3.5 text-neutral-400" /> {it.name}
                      </span>
                    )}
                    <span className="text-xs font-semibold text-neutral-500 shrink-0">{it.distance}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div>
          {destinations.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {destinations.map((d) => (
                <span
                  key={d.id}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold bg-neutral-50 text-neutral-500 border border-neutral-200 rounded-full pl-3 pr-1.5 py-1"
                >
                  {d.route == null && (
                    <span className="w-3 h-3 rounded-full border-2 border-primary-300 border-t-neutral-500 animate-spin" />
                  )}
                  <span className="max-w-[160px] truncate">{d.label}</span>
                  <button
                    type="button"
                    onClick={() => removeDestination(d.id)}
                    className="rounded-full hover:bg-primary-100 p-0.5"
                    aria-label={`Remove ${d.label}`}
                  >
                    <XMarkIcon className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="relative isolate h-64 md:h-92 rounded-2xl overflow-hidden bg-neutral-100 border border-neutral-200">
            {hasCoords ? (
              <HotelLocationMap
                latitude={latitude}
                longitude={longitude}
                name={name}
                address={address}
                destinations={destinations}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="flex flex-col items-center gap-1 bg-white/90 rounded-xl px-4 py-3 shadow">
                  <MapPinIcon className="w-6 h-6 text-primary-600" />
                  <span className="text-xs font-semibold text-neutral-700">{address}</span>
                </span>
              </div>
            )}
            {/* Top-right: the zoom control owns the top-left corner and
                "Get Directions" the bottom-right. */}
            {hasCoords && approximate && (
              <span className="absolute top-2 right-2 z-400 max-w-3/5 rounded-lg bg-white/95 px-2.5 py-1.5 text-[11px] font-medium text-neutral-600 shadow">
                Approximate location — exact address shared on booking
              </span>
            )}
            {hasCoords && (
              <a
                href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute bottom-2 right-2 z-400 flex items-center gap-1 text-xs font-semibold bg-white text-primary-600 rounded-lg px-2.5 py-1.5 shadow hover:bg-primary-50 transition-colors"
              >
                <MapPinIcon className="w-3.5 h-3.5" /> Get Directions
              </a>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

