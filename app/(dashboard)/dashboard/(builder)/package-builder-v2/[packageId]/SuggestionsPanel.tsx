"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Suggestions — the catalog, scoped to where the trip actually goes.
//
// Three sections in the rail (Hotels, Activities, Cabs) that all work the same
// way: pick a destination, optionally search inside it, then either drag a card
// onto a day in the document or click it to apply to the selected day.
//
// The point of separating these from the per-day drawers is that they're a
// different motion. A drawer answers "day 4 needs a hotel, find me one"; this
// answers "what have we got in Gulmarg" — you browse first and decide which day
// it belongs to second, which is why the day is chosen by where you drop rather
// than by which drawer you opened.
//
// Dragging is the headline interaction but never the only one. It's the wrong
// input on a trackpad for a long list, and it's unavailable to anyone driving
// by keyboard, so every card also applies to the currently-selected day on
// click — the same day the layers rail and the Itinerary section are showing.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Search, Loader2, GripVertical, BedDouble, Users, Clock, MapPin, Car } from "./builder-icons";
import { Input } from "@/app/(dashboard)/dashboard/(main)/components/ui/input";
import { cn } from "@/app/lib/utils";
import {
  searchHotelRoomsForBuilder, searchActivitiesForBuilder, searchCabsForBuilder,
  type HotelRoomResult, type ActivityResult, type CabPricingResult,
} from "@/app/(dashboard)/dashboard/(builder)/package-builder/action";
import { deriveDayLocations } from "@/app/lib/route-builder-utils";
import { useBuilder } from "./builder-context";
import {
  applyHotelRoomSelection, applyVehicleSelection, continuesStayFrom,
} from "./day-mutations";
import { dragSourceProps, type CatalogDrag } from "./builder-dnd";
import { Empty, Hint, Chip } from "./builder-ui";
import { dayCalendarDate } from "./ItineraryDocument";

function toLocalISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared scaffolding
// ─────────────────────────────────────────────────────────────────────────────

/** Every destination the trip visits, plus the day currently selected.
 *
 * Defaults the scope to the selected day's own stop, so opening Hotels while
 * working on day 4 shows day 4's city without a click. Kept as state after
 * that: browsing Srinagar's hotels while day 4 is selected is a legitimate
 * thing to want, and resetting the scope every time the selection moved would
 * make it impossible. */
function useScope() {
  const { form, selectedDay } = useBuilder();
  const dayCities = deriveDayLocations(form.stops, form.itineraries.length);
  const cityForSelected = dayCities[selectedDay - 1] ?? "";

  const stops = form.stops.map((s) => s.name).filter(Boolean);
  const [city, setCity] = useState(cityForSelected);

  // Follow the selection only while the exec hasn't pinned a different scope.
  // Compared against the city last auto-applied rather than a "touched" flag,
  // so picking the day's own city by hand doesn't count as pinning it.
  //
  // Adjusted during render behind a changed-check — React's own shape for
  // "derive state from a prop" — rather than in an effect, which would render
  // one frame with the previous city's results before correcting itself.
  const [autoCity, setAutoCity] = useState(cityForSelected);
  if (cityForSelected !== autoCity) {
    setAutoCity(cityForSelected);
    if (city === autoCity) setCity(cityForSelected);
  }

  return { city, setCity, stops, selectedDay };
}

function ScopeBar({ city, setCity, stops }: {
  city: string; setCity: (c: string) => void; stops: string[];
}) {
  if (stops.length === 0) {
    return <Hint>No destinations set yet — add them in the Destinations section and these will scope to the trip.</Hint>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {stops.map((s) => (
        <Chip key={s} selected={city === s} onClick={() => setCity(s)}>{s}</Chip>
      ))}
      {/* Clearing the scope searches the whole catalog, which is what you want
          when the client asks for something the route doesn't cover. */}
      <Chip selected={city === ""} onClick={() => setCity("")}>Anywhere</Chip>
    </div>
  );
}

function SearchField({ value, onChange, placeholder, loading }: {
  value: string; onChange: (v: string) => void; placeholder: string; loading: boolean;
}) {
  return (
    <div className="relative">
      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dashboard-base-content/40" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 text-sm pl-7 pr-8"
      />
      {loading && (
        <Loader2 size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-dashboard-base-content/40" />
      )}
    </div>
  );
}

/**
 * Debounced catalog fetch with last-write-wins.
 *
 * The token check is what stops a slow request for "gul" from landing after a
 * fast one for "gulmarg" and replacing the right results with stale ones —
 * every drawer in the builder does this and it's the same bug each time if it's
 * left out.
 */
function useCatalog<T>(
  fetcher: () => Promise<T[]>,
  deps: unknown[],
  enabled: boolean,
  errorMessage: string,
) {
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const reqRef = useRef(0);

  useEffect(() => {
    if (!enabled) { setResults([]); return; }
    const token = ++reqRef.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const rows = await fetcher();
        if (token === reqRef.current) setResults(rows);
      } catch {
        if (token === reqRef.current) toast.error(errorMessage);
      } finally {
        if (token === reqRef.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { results, loading };
}

/** A draggable suggestion. The grip is decoration — the whole card drags — but
 * without it nothing on screen says so, and an interaction nobody discovers is
 * the same as one that doesn't exist. */
function SuggestionCard({ drag, onApply, applyTitle, thumbnail, fallbackIcon, title, meta, trailing }: {
  drag: CatalogDrag;
  onApply: () => void;
  applyTitle: string;
  thumbnail: string | null;
  /** Shown in the thumbnail slot when there's no photo — e.g. a vehicle icon
   * for cabs. Defaults to a plain empty swatch when omitted. */
  fallbackIcon?: React.ReactNode;
  title: string;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div
      {...dragSourceProps(drag)}
      onClick={onApply}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onApply(); }
      }}
      role="button"
      tabIndex={0}
      title={applyTitle}
      className={cn(
        "group flex items-start gap-2.5 rounded-[10px] border border-dashboard-base-300 p-2",
        "cursor-grab active:cursor-grabbing transition-colors duration-[120ms]",
        "hover:border-dashboard-primary/40 hover:bg-dashboard-primary/[0.04]",
        "focus-visible:outline-2 focus-visible:outline-dashboard-primary/50",
      )}
    >
      <GripVertical
        size={13}
        className="shrink-0 mt-0.5 text-dashboard-base-content/20 group-hover:text-dashboard-base-content/45"
      />
      {thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnail}
          alt=""
          draggable={false}
          className="size-10 shrink-0 rounded-md object-cover bg-dashboard-base-200"
        />
      ) : (
        <span className="size-10 shrink-0 rounded-md bg-dashboard-base-200 flex items-center justify-center">
          {fallbackIcon}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-dashboard-base-content truncate">{title}</p>
        {meta && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[10.5px] text-dashboard-base-content/50">
            {meta}
          </div>
        )}
      </div>
      {trailing && <div className="shrink-0 text-right">{trailing}</div>}
    </div>
  );
}

function inr(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

/** Shared frame: scope, search, then the list. */
function SuggestionsFrame({ children, scope, search, count, emptyHint }: {
  children: React.ReactNode;
  scope: React.ReactNode;
  search: React.ReactNode;
  count: number;
  emptyHint: string;
}) {
  const { selectedDay } = useBuilder();
  return (
    <div className="p-4 space-y-3">
      {scope}
      {search}
      <p className="text-[10.5px] text-dashboard-base-content/45">
        Drag onto a day, or click to apply to <span className="font-semibold text-dashboard-base-content/65">day {selectedDay}</span>.
      </p>
      {count === 0 ? <Empty>{emptyHint}</Empty> : <div className="space-y-1.5">{children}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hotels
// ─────────────────────────────────────────────────────────────────────────────

export function HotelSuggestionsView() {
  const { form, replaceDay, selectedDay } = useBuilder();
  const { city, setCity, stops } = useScope();
  const [query, setQuery] = useState("");

  // The selected day's actual date, so the price shown matches what applying
  // this room to that day would actually cost (season/weekend rate, not the
  // flat catalog rate) — same resolution the builder's billing itself uses.
  const dayDate = form.travelDate ? dayCalendarDate(form.travelDate, selectedDay) : null;
  const dayDateISO = dayDate ? toLocalISODate(dayDate) : null;

  const { results, loading } = useCatalog<HotelRoomResult>(
    () => searchHotelRoomsForBuilder(city, query, null, 1, null, null, null, "price_asc", null, dayDateISO).then((r) => r.rows),
    [city, query, dayDateISO],
    !!city || !!query.trim(),
    "Couldn't load hotels.",
  );

  function apply(room: HotelRoomResult) {
    const blocked = continuesStayFrom(form.itineraries, selectedDay);
    if (blocked) {
      toast.error(`Day ${selectedDay}'s stay is part of a booking that starts on day ${blocked}. Change it there.`);
      return;
    }
    replaceDay(selectedDay, (it) => applyHotelRoomSelection(it, room));
    toast.success(`Day ${selectedDay}: ${room.hotelName}`);
  }

  return (
    <SuggestionsFrame
      scope={<ScopeBar city={city} setCity={setCity} stops={stops} />}
      search={<SearchField value={query} onChange={setQuery} loading={loading} placeholder={city ? `Hotels in ${city}…` : "Search hotels…"} />}
      count={results.length}
      emptyHint={loading ? "Looking…" : "No rooms match. Try another destination or a hotel name."}
    >
      {results.map((r) => (
        <SuggestionCard
          key={r.id}
          drag={{ kind: "hotel", item: r }}
          onApply={() => apply(r)}
          applyTitle={`Drag onto a day, or click to set day ${selectedDay}'s stay`}
          thumbnail={r.thumbnail ?? r.hotelPhoto}
          title={r.hotelName}
          meta={
            <>
              <span className="flex items-center gap-1"><BedDouble size={9} />{r.roomName}</span>
              {r.starRating && <span>{r.starRating}</span>}
              {r.mealPlanName && <span>{r.mealPlanName}</span>}
            </>
          }
          trailing={
            <span className="text-[11px] font-semibold tabular-nums text-dashboard-base-content/75">
              {inr(r.pricePerNight)}
              <span className="block text-[9px] font-normal text-dashboard-base-content/40">/night</span>
            </span>
          }
        />
      ))}
    </SuggestionsFrame>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Activities
// ─────────────────────────────────────────────────────────────────────────────

export function ActivitySuggestionsView() {
  const { replaceDay, selectedDay } = useBuilder();
  const { city, setCity, stops } = useScope();
  const [query, setQuery] = useState("");

  const { results, loading } = useCatalog<ActivityResult>(
    () => searchActivitiesForBuilder(city, query),
    [city, query],
    !!city || !!query.trim(),
    "Couldn't load activities.",
  );

  function apply(a: ActivityResult) {
    replaceDay(selectedDay, (it) => ({
      ...it,
      activities: [...it.activities, {
        title: a.name,
        description: a.description ?? "",
        photo: a.photos[0] ?? a.thumbnail ?? "",
        photos: a.photos.slice(0, 3),
        photoLabels: a.photoLabels.slice(0, 3),
      }],
    }));
    toast.success(`Day ${selectedDay}: ${a.name}`);
  }

  return (
    <SuggestionsFrame
      scope={<ScopeBar city={city} setCity={setCity} stops={stops} />}
      search={<SearchField value={query} onChange={setQuery} loading={loading} placeholder={city ? `Things to do in ${city}…` : "Search activities…"} />}
      count={results.length}
      emptyHint={loading ? "Looking…" : "Nothing in the catalog for this destination yet."}
    >
      {results.map((a) => (
        <SuggestionCard
          key={a.id}
          drag={{ kind: "activity", item: a }}
          onApply={() => apply(a)}
          applyTitle={`Drag onto a day, or click to add to day ${selectedDay}`}
          thumbnail={a.thumbnail ?? a.photos[0] ?? null}
          title={a.name}
          meta={
            <>
              {a.category && <span>{a.category}</span>}
              {a.durationHours != null && (
                <span className="flex items-center gap-1"><Clock size={9} />{a.durationHours}h</span>
              )}
            </>
          }
        />
      ))}
    </SuggestionsFrame>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cabs
// ─────────────────────────────────────────────────────────────────────────────

export function CabSuggestionsView() {
  const { replaceDay, selectedDay } = useBuilder();
  const { city, setCity, stops } = useScope();
  const [query, setQuery] = useState("");

  const { results, loading } = useCatalog<CabPricingResult>(
    () => searchCabsForBuilder(city, query, null).then((r) => r.rows),
    [city, query],
    !!city || !!query.trim(),
    "Couldn't load cabs.",
  );

  function apply(hit: CabPricingResult) {
    replaceDay(selectedDay, (it) => applyVehicleSelection(it, hit));
    toast.success(`Day ${selectedDay}: ${hit.vehicleName}`);
  }

  return (
    <SuggestionsFrame
      scope={<ScopeBar city={city} setCity={setCity} stops={stops} />}
      search={<SearchField value={query} onChange={setQuery} loading={loading} placeholder={city ? `Cabs priced for ${city}…` : "Search vehicles…"} />}
      count={results.length}
      emptyHint={loading ? "Looking…" : "No priced cabs for this destination. The per-day transport editor can still search the fleet."}
    >
      {results.map((c) => (
        <SuggestionCard
          key={c.id}
          drag={{ kind: "cab", item: c }}
          onApply={() => apply(c)}
          applyTitle={`Drag onto a day, or click to set day ${selectedDay}'s transport`}
          thumbnail={c.thumbnail}
          fallbackIcon={<Car size={16} className="text-dashboard-base-content/30" />}
          title={c.vehicleName}
          meta={
            <>
              <span className="flex items-center gap-1"><Users size={9} />{c.passengerCapacity}</span>
              {c.hasAc && <span>AC</span>}
              {/* Always shown, not just on a fallback-city mismatch — this is
                  which destination's cab inventory these rates come from, and
                  an exec browsing several cities in one trip needs that even
                  when it happens to match the current scope. */}
              {c.cityName && (
                <span className="flex items-center gap-1"><MapPin size={9} />{c.cityName}</span>
              )}
            </>
          }
          trailing={
            <span className="text-[11px] font-semibold tabular-nums text-dashboard-base-content/75">
              {inr(c.price)}
              <span className="block text-[9px] font-normal text-dashboard-base-content/40">{c.pricingType}</span>
            </span>
          }
        />
      ))}
    </SuggestionsFrame>
  );
}
