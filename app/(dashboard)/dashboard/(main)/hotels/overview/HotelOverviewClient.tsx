"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  MapPin, Search, X, Building2, Globe2, Map,
  BedDouble, CheckCircle2, XCircle, ChevronRight, Filter,
} from "lucide-react";
import { cn } from "@/app/lib/utils";
import { CATEGORIES } from "../constants";
import { HotelTeamSheet } from "./HotelTeamSheet";

const UNCATEGORIZED = "__uncategorized__";

// ── Types ──────────────────────────────────────────────────────────────────

type Hotel = {
  id: number;
  name: string;
  slug: string;
  thumbnail: string | null;
  category: string | null;
  stay_type: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  is_active: boolean;
  destination: { name: string; latitude?: unknown; longitude?: unknown } | null;
  lat: number | null;
  lng: number | null;
  _count: { hotelRooms: number; images: number };
};

type GroupDimension = "country" | "state" | "city" | "category" | "star";

// ── Constants ──────────────────────────────────────────────────────────────

const R2_BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";

function thumb(key: string | null) {
  if (!key) return null;
  return key.startsWith("http") ? key : `${R2_BASE}/${key}`;
}

function catLabel(value: string | null) {
  if (!value) return "Uncategorized";
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

function starLabel(st: string | null): string {
  return st ?? "Unrated";
}

const STAR_ORDER = ["1 Star", "2 Star", "3 Star", "4 Star", "5 Star", "Unrated"];

// ── Category color mapping ──────────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  hotel:              "#3b82f6",
  resort:             "#8b5cf6",
  homestay:           "#10b981",
  apartment:          "#f59e0b",
  serviced_apartment: "#f97316",
  villa:              "#ec4899",
  guest_house:        "#6366f1",
  hostel:             "#14b8a6",
  houseboat:          "#0ea5e9",
  boutique_hotel:     "#a855f7",
  heritage_hotel:     "#d97706",
  luxury_hotel:       "#e11d48",
  camp:               "#84cc16",
  glamping:           "#06b6d4",
};

function categoryColor(cat: string | null) {
  return cat ? (CAT_COLORS[cat] ?? "#64748b") : "#64748b";
}

// ── Map Component (Leaflet) ────────────────────────────────────────────────

function HotelMap({
  hotels,
  focusedId,
  onHotelClick,
}: {
  hotels: Hotel[];
  focusedId: number | null;
  onHotelClick: (id: number) => void;
}) {
  const mapRef         = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const markersRef     = useRef<globalThis.Map<number, import("leaflet").Marker>>(new globalThis.Map());

  const withCoords = useMemo(
    () => hotels.filter((h) => h.lat && h.lng),
    [hotels],
  );

  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !mapRef.current) return;

      // @ts-expect-error leaflet icon hack
      delete L.Icon.Default.prototype._getIconUrl;

      if (!mapInstanceRef.current) {
        mapInstanceRef.current = L.map(mapRef.current!, {
          zoomControl: true,
          scrollWheelZoom: true,
        });

        L.tileLayer(
          `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`,
          {
            attribution: "© Mapbox © OpenStreetMap",
            tileSize: 512,
            zoomOffset: -1,
            maxZoom: 22,
          },
        ).addTo(mapInstanceRef.current);
      }

      const map = mapInstanceRef.current!;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();

      if (withCoords.length === 0) {
        map.setView([20.5937, 78.9629], 5);
        return;
      }

      withCoords.forEach((h) => {
        const color = categoryColor(h.category);
        const imgUrl = thumb(h.thumbnail);
        const stars  = starLabel(h.stay_type);

        const iconHtml = `
          <div style="
            width:38px;height:38px;border-radius:50%;
            background:${color};
            border:3px solid #fff;
            box-shadow:0 2px 10px rgba(0,0,0,0.4);
            display:flex;align-items:center;justify-content:center;
            cursor:pointer;overflow:hidden;
            transition:transform 0.15s;
          ">
            ${imgUrl
              ? `<img src="${imgUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
              : `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#fff" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`
            }
          </div>`;

        const popupHtml = `
          <div style="width:220px;font-family:system-ui,sans-serif;">
            ${imgUrl
              ? `<img src="${imgUrl}" style="width:100%;height:120px;object-fit:cover;border-radius:8px 8px 0 0;" />`
              : `<div style="width:100%;height:80px;background:${color}22;display:flex;align-items:center;justify-content:center;border-radius:8px 8px 0 0;"><span style="font-size:28px;">🏨</span></div>`
            }
            <div style="padding:10px 12px;">
              <p style="font-weight:700;font-size:14px;margin:0 0 4px;color:#0f172a;">${h.name}</p>
              <p style="font-size:12px;margin:0 0 2px;color:#64748b;">${catLabel(h.category)}</p>
              <p style="font-size:12px;margin:0 0 6px;color:#94a3b8;">${[h.city, h.state, h.country].filter(Boolean).join(", ") || "—"}</p>
              <div style="display:flex;align-items:center;gap:8px;font-size:11px;color:#64748b;">
                <span>⭐ ${stars}</span>
                <span>🚪 ${h._count.hotelRooms} rooms</span>
                <span style="color:${h.is_active ? "#16a34a" : "#dc2626"};">${h.is_active ? "✓ Active" : "✗ Inactive"}</span>
              </div>
              <a href="/dashboard/hotels/${h.id}" style="display:inline-block;margin-top:8px;font-size:12px;color:#3b82f6;text-decoration:none;font-weight:600;">View Hotel →</a>
            </div>
          </div>`;

        const marker = L.marker([h.lat!, h.lng!], {
          icon: L.divIcon({ className: "", html: iconHtml, iconSize: [38, 38], iconAnchor: [19, 19] }),
        })
          .bindPopup(popupHtml, { maxWidth: 240, className: "hotel-map-popup" })
          .on("click", () => onHotelClick(h.id))
          .addTo(map);

        markersRef.current.set(h.id, marker);
      });

      // Fit bounds
      const bounds = L.latLngBounds(withCoords.map((h) => [h.lat!, h.lng!] as [number, number]));
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 });
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withCoords]);

  // Pan to focused hotel
  useEffect(() => {
    if (!focusedId || !mapInstanceRef.current) return;
    const marker = markersRef.current.get(focusedId);
    if (!marker) return;
    mapInstanceRef.current.setView(marker.getLatLng(), 14, { animate: true });
    marker.openPopup();
  }, [focusedId]);

  return (
    <div
      ref={mapRef}
      className="w-full h-full rounded-none"
      style={{ minHeight: 500 }}
    />
  );
}

// ── Hotel Card ─────────────────────────────────────────────────────────────

function HotelCard({
  hotel,
  active,
  onClick,
}: {
  hotel: Hotel;
  active: boolean;
  onClick: () => void;
}) {
  const imgUrl = thumb(hotel.thumbnail);
  const stars  = starLabel(hotel.stay_type);
  const color  = categoryColor(hotel.category);

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex gap-3 p-3 rounded-xl border cursor-pointer transition-all",
        active
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border hover:border-border/80 hover:bg-accent/30",
      )}
    >
      {/* Image */}
      <div
        className="h-16 w-20 shrink-0 rounded-lg overflow-hidden"
        style={{ background: `${color}22` }}
      >
        {imgUrl ? (
          <img src={imgUrl} alt={hotel.name} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <Building2 className="h-5 w-5" style={{ color }} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1">
          <p className="text-sm font-semibold text-foreground truncate">{hotel.name}</p>
          <span
            className={cn(
              "shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full",
              hotel.is_active
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
            )}
          >
            {hotel.is_active ? "Active" : "Inactive"}
          </span>
        </div>

        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {catLabel(hotel.category)} · {stars}
        </p>

        <div className="flex items-center gap-1.5 mt-1.5">
          <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground truncate">
            {[hotel.city, hotel.state].filter(Boolean).join(", ") || hotel.country || "—"}
          </span>
        </div>

        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <BedDouble className="h-3 w-3" />
            {hotel._count.hotelRooms} room{hotel._count.hotelRooms !== 1 ? "s" : ""}
          </span>
          {hotel.lat && hotel.lng && (
            <span className="text-xs text-blue-500 flex items-center gap-1">
              <Map className="h-3 w-3" /> On map
            </span>
          )}
        </div>
      </div>

      <Link
        href={`/dashboard/hotels/${hotel.id}`}
        onClick={(e) => e.stopPropagation()}
        className="shrink-0 self-center text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

// ── Filter Pill ────────────────────────────────────────────────────────────

function Pill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap",
        active
          ? "bg-primary text-primary-foreground border-primary shadow-sm"
          : "bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
      )}
    >
      {label}
      <span
        className={cn(
          "text-[10px] px-1.5 py-0.5 rounded-full font-semibold",
          active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}

// ── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-card border rounded-xl px-4 py-3">
      <div
        className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${accent}18`, color: accent }}
      >
        {icon}
      </div>
      <div>
        <p className="text-lg font-bold text-foreground leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function HotelOverviewClient({ hotels }: { hotels: Hotel[] }) {
  const [search,          setSearch]          = useState("");
  const [groupBy,         setGroupBy]         = useState<GroupDimension>("country");
  const [selCountry,      setSelCountry]      = useState<string | null>(null);
  const [selState,        setSelState]        = useState<string | null>(null);
  const [selCity,         setSelCity]         = useState<string | null>(null);
  const [selCategory,     setSelCategory]     = useState<string | null>(null);
  const [selStar,         setSelStar]         = useState<string | null>(null);
  const [focusedId,       setFocusedId]       = useState<number | null>(null);
  const [mapVisible,      setMapVisible]      = useState(true);

  // ── Derived groups ───────────────────────────────────────────────────────

  const countries  = useMemo(() => [...new Set(hotels.map((h) => h.country).filter(Boolean) as string[])].sort(), [hotels]);
  const states     = useMemo(() => {
    const src = selCountry ? hotels.filter((h) => h.country === selCountry) : hotels;
    return [...new Set(src.map((h) => h.state).filter(Boolean) as string[])].sort();
  }, [hotels, selCountry]);
  const cities     = useMemo(() => {
    const src = selState ? hotels.filter((h) => h.state === selState) : (selCountry ? hotels.filter((h) => h.country === selCountry) : hotels);
    return [...new Set(src.map((h) => h.city).filter(Boolean) as string[])].sort();
  }, [hotels, selCountry, selState]);
  const categories = useMemo(() => {
    const vals = [...new Set(hotels.map((h) => h.category).filter(Boolean) as string[])].sort();
    return hotels.some((h) => !h.category) ? [...vals, UNCATEGORIZED] : vals;
  }, [hotels]);
  const stars      = useMemo(() => {
    const vals = [...new Set(hotels.map((h) => starLabel(h.stay_type)))];
    return vals.sort((a, b) => STAR_ORDER.indexOf(a) - STAR_ORDER.indexOf(b));
  }, [hotels]);

  // ── Filtered hotels ──────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = hotels;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (h) =>
          h.name.toLowerCase().includes(q) ||
          (h.city  ?? "").toLowerCase().includes(q) ||
          (h.state ?? "").toLowerCase().includes(q) ||
          (h.country ?? "").toLowerCase().includes(q),
      );
    }
    if (selCountry)  list = list.filter((h) => h.country  === selCountry);
    if (selState)    list = list.filter((h) => h.state    === selState);
    if (selCity)     list = list.filter((h) => h.city     === selCity);
    if (selCategory) list = list.filter((h) => (selCategory === UNCATEGORIZED ? !h.category : h.category === selCategory));
    if (selStar)     list = list.filter((h) => starLabel(h.stay_type) === selStar);
    return list;
  }, [hotels, search, selCountry, selState, selCity, selCategory, selStar]);

  // ── Stats ────────────────────────────────────────────────────────────────

  const stats = useMemo(() => ({
    total:      hotels.length,
    active:     hotels.filter((h) => h.is_active).length,
    countries:  countries.length,
    states:     [...new Set(hotels.map((h) => h.state).filter(Boolean))].length,
    cities:     [...new Set(hotels.map((h) => h.city).filter(Boolean))].length,
    onMap:      hotels.filter((h) => h.lat && h.lng).length,
  }), [hotels, countries]);

  // ── Grouped pills for the active dimension ───────────────────────────────

  function countIn(dim: GroupDimension, val: string) {
    return filtered.filter((h) => {
      if (dim === "country")  return h.country  === val;
      if (dim === "state")    return h.state    === val;
      if (dim === "city")     return h.city     === val;
      if (dim === "category") return val === UNCATEGORIZED ? !h.category : h.category === val;
      if (dim === "star")     return starLabel(h.stay_type) === val;
      return false;
    }).length;
  }

  // Switching which dimension you're browsing by resets the other dimensions'
  // selections — otherwise a leftover filter from a previous tab silently keeps
  // narrowing the list while its pills are no longer visible anywhere.
  function switchGroupBy(dim: GroupDimension) {
    setGroupBy(dim);
    setSelCountry(null);
    setSelState(null);
    setSelCity(null);
    setSelCategory(null);
    setSelStar(null);
  }

  function clearFilters() {
    setSelCountry(null);
    setSelState(null);
    setSelCity(null);
    setSelCategory(null);
    setSelStar(null);
    setSearch("");
  }

  const hasFilter = !!(selCountry || selState || selCity || selCategory || selStar || search);

  return (
    <div
      className="flex flex-col bg-card border rounded-xl overflow-hidden"
      style={{ height: "calc(100vh - 130px)" }}
    >

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="border-b bg-card px-6 py-4 shrink-0">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Hotel Directory
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {filtered.length} of {stats.total} hotels · organized by location &amp; category
            </p>
          </div>

          <div className="flex items-center gap-2">
            <HotelTeamSheet totalHotels={stats.total} />

            <button
              type="button"
              onClick={() => setMapVisible((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
                mapVisible ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <Map className="h-3.5 w-3.5" />
              {mapVisible ? "Hide Map" : "Show Map"}
            </button>

            <Link
              href="/dashboard/hotels/new"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              + Add Hotel
            </Link>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-4">
          <StatCard label="Total Hotels"  value={stats.total}     icon={<Building2 className="h-4 w-4" />} accent="#3b82f6" />
          <StatCard label="Active"        value={stats.active}    icon={<CheckCircle2 className="h-4 w-4" />} accent="#16a34a" />
          <StatCard label="Inactive"      value={stats.total - stats.active} icon={<XCircle className="h-4 w-4" />} accent="#dc2626" />
          <StatCard label="Countries"     value={stats.countries} icon={<Globe2 className="h-4 w-4" />} accent="#8b5cf6" />
          <StatCard label="Cities"        value={stats.cities}    icon={<MapPin className="h-4 w-4" />} accent="#f59e0b" />
          <StatCard label="On Map"        value={stats.onMap}     icon={<Map className="h-4 w-4" />} accent="#0ea5e9" />
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* ── Left panel ──────────────────────────────────────────────── */}
        <div className="w-100 shrink-0 flex flex-col border-r overflow-hidden">

          {/* Search + clear */}
          <div className="px-4 py-3 border-b space-y-3 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search hotel, city, state, country…"
                className="w-full pl-8 pr-8 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>

            {hasFilter && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-1.5 text-xs text-destructive hover:text-destructive/80 transition-colors"
              >
                <X className="h-3 w-3" /> Clear all filters
              </button>
            )}
          </div>

          {/* Group-by dimension tabs */}
          <div className="px-4 py-2 border-b shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
              <Filter className="h-3 w-3" /> Group &amp; Filter by
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {(["country", "state", "city", "category", "star"] as GroupDimension[]).map((dim) => (
                <button
                  key={dim}
                  type="button"
                  onClick={() => switchGroupBy(dim)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-medium border transition-colors capitalize",
                    groupBy === dim
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40",
                  )}
                >
                  {dim === "star" ? "Star Rating" : dim}
                </button>
              ))}
            </div>
          </div>

          {/* Dimension pills */}
          <div className="px-4 py-2.5 border-b shrink-0">
            <div className="flex gap-1.5 flex-wrap">
              {/* All pill */}
              <Pill
                label="All"
                count={filtered.length}
                active={
                  groupBy === "country"  ? !selCountry  :
                  groupBy === "state"    ? !selState    :
                  groupBy === "city"     ? !selCity     :
                  groupBy === "category" ? !selCategory :
                  !selStar
                }
                onClick={() => {
                  if (groupBy === "country")  setSelCountry(null);
                  if (groupBy === "state")    setSelState(null);
                  if (groupBy === "city")     setSelCity(null);
                  if (groupBy === "category") setSelCategory(null);
                  if (groupBy === "star")     setSelStar(null);
                }}
              />

              {groupBy === "country"  && countries.map((v)  => (
                <Pill key={v} label={v} count={countIn("country", v)}
                  active={selCountry === v}
                  onClick={() => { setSelCountry(selCountry === v ? null : v); setSelState(null); setSelCity(null); }} />
              ))}
              {groupBy === "state"    && states.map((v)    => (
                <Pill key={v} label={v} count={countIn("state", v)}
                  active={selState === v}
                  onClick={() => { setSelState(selState === v ? null : v); setSelCity(null); }} />
              ))}
              {groupBy === "city"     && cities.map((v)     => (
                <Pill key={v} label={v} count={countIn("city", v)}
                  active={selCity === v}
                  onClick={() => setSelCity(selCity === v ? null : v)} />
              ))}
              {groupBy === "category" && categories.map((v) => (
                <Pill key={v} label={v === UNCATEGORIZED ? "Uncategorized" : catLabel(v)} count={countIn("category", v)}
                  active={selCategory === v}
                  onClick={() => setSelCategory(selCategory === v ? null : v)} />
              ))}
              {groupBy === "star"     && stars.map((v)      => (
                <Pill key={v} label={v} count={countIn("star", v)}
                  active={selStar === v}
                  onClick={() => setSelStar(selStar === v ? null : v)} />
              ))}
            </div>
          </div>

          {/* Active filter breadcrumb */}
          {(selCountry || selState || selCity) && (
            <div className="px-4 py-2 border-b shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground">
              {selCountry && (
                <>
                  <Globe2 className="h-3 w-3" />
                  <span className="font-medium text-foreground">{selCountry}</span>
                </>
              )}
              {selState && (
                <>
                  <ChevronRight className="h-3 w-3" />
                  <span className="font-medium text-foreground">{selState}</span>
                </>
              )}
              {selCity && (
                <>
                  <ChevronRight className="h-3 w-3" />
                  <span className="font-medium text-foreground">{selCity}</span>
                </>
              )}
            </div>
          )}

          {/* Hotel list */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Building2 className="h-8 w-8 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No hotels found</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Try adjusting your filters</p>
              </div>
            ) : (
              filtered.map((h) => (
                <HotelCard
                  key={h.id}
                  hotel={h}
                  active={focusedId === h.id}
                  onClick={() => setFocusedId(focusedId === h.id ? null : h.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Map panel ───────────────────────────────────────────────── */}
        {mapVisible && (
          <div className="flex-1 relative overflow-hidden">
            <HotelMap
              hotels={filtered}
              focusedId={focusedId}
              onHotelClick={(id) => setFocusedId(focusedId === id ? null : id)}
            />

            {/* Map overlay: no-coords notice */}
            {filtered.length > 0 && filtered.filter((h) => h.lat && h.lng).length === 0 && (
              <div className="absolute inset-x-0 top-4 flex justify-center pointer-events-none">
                <div className="bg-background/95 backdrop-blur-sm border rounded-xl px-4 py-2.5 text-center shadow-md flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                    <MapPin className="h-3.5 w-3.5 text-amber-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-medium text-foreground">No location pins yet</p>
                    <p className="text-[11px] text-muted-foreground">
                      {filtered.length} hotel{filtered.length !== 1 ? "s" : ""} in view need{filtered.length === 1 ? "s" : ""} a map location
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Count badge */}
            {filtered.filter((h) => h.lat && h.lng).length > 0 && (
              <div className="absolute top-3 right-3 bg-background/90 backdrop-blur-sm border rounded-lg px-3 py-1.5 text-xs font-medium text-foreground shadow-sm flex items-center gap-1.5">
                <MapPin className="h-3 w-3 text-primary" />
                {filtered.filter((h) => h.lat && h.lng).length} pinned
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
