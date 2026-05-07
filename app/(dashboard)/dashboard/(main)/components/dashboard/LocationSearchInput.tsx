"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MapPin, Loader2, X } from "lucide-react";
import { cn } from "@/app/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

export type LocationResult = {
  place_name: string;
  place_id: string;
  address: string;
  latitude: number;
  longitude: number;
};

type Props = {
  value: LocationResult | null;
  onChange: (result: LocationResult | null) => void;
  placeholder?: string;
  className?: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

async function geocode(query: string): Promise<LocationResult[]> {
  if (!TOKEN || query.trim().length < 2) return [];
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${TOKEN}&types=place,locality,district,region,poi&limit=6&language=en`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.features ?? []).map(
    (f: { text: string; id: string; place_name: string; center: [number, number] }) => ({
      place_name: f.text,
      place_id: f.id,
      address: f.place_name,
      latitude: f.center[1],
      longitude: f.center[0],
    }),
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export function LocationSearchInput({ value, onChange, placeholder = "Search location…", className }: Props) {
  const [query, setQuery] = useState(value?.place_name ?? "");
  const [results, setResults] = useState<LocationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync external value changes
  useEffect(() => {
    setQuery(value?.place_name ?? "");
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const search = useCallback(async (q: string) => {
    setLoading(true);
    const res = await geocode(q);
    setResults(res);
    setLoading(false);
    setOpen(res.length > 0);
  }, []);

  function handleChange(q: string) {
    setQuery(q);
    onChange(null); // clear selection while typing
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(() => search(q), 300);
  }

  function handleSelect(result: LocationResult) {
    setQuery(result.place_name);
    onChange(result);
    setOpen(false);
    setResults([]);
  }

  function handleClear() {
    setQuery("");
    onChange(null);
    setResults([]);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "w-full rounded-md border border-input bg-background text-sm py-2 pl-8 pr-8",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
            value && "text-foreground font-medium",
          )}
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
        {!loading && query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 flex items-center justify-center rounded hover:bg-muted"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Coordinates hint when selected */}
      {value && (
        <p className="text-[10px] text-muted-foreground mt-0.5 truncate px-0.5">
          {value.latitude.toFixed(4)}, {value.longitude.toFixed(4)} · {value.address}
        </p>
      )}

      {/* Dropdown */}
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md text-sm">
          {results.map((r) => (
            <li key={r.place_id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(r)}
                className="w-full text-left px-3 py-2 hover:bg-accent flex items-start gap-2"
              >
                <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="font-medium truncate">{r.place_name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{r.address}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!TOKEN && (
        <p className="text-[11px] text-destructive mt-0.5">
          NEXT_PUBLIC_MAPBOX_TOKEN not set
        </p>
      )}
    </div>
  );
}
