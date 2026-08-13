"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Transfer and Experiences drawers.
//
// Same shape as the hotel drawer: one task per drawer, every write routed
// through day-mutations.ts so the result is identical to doing it from the
// right-hand panel. For the transfer that matters for the same reason it does
// for hotels — cabPricingId decides whether the day contributes to the cab
// subtotal at all, so "picked a vehicle" and "picked a *priced* vehicle" must
// stay the same distinction in both places.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  Car, Loader2, Search, Trash2, Plus, ArrowUp, ArrowDown, Users, MapPin,
  Sliders, ChevronDown, AlertTriangle,
} from "./builder-icons";
import { Input } from "@/app/(dashboard)/dashboard/(main)/components/ui/input";
import { Button } from "@/app/(dashboard)/dashboard/(main)/components/ui/button";
import { cn } from "@/app/lib/utils";
import {
  searchVehiclesForBuilder, searchCabsForBuilder, searchActivitiesForBuilder,
  type DayItinerary, type ActivityResult, type CabSortOption,
} from "../action";
import type { CabSelection } from "../room-cab-selections";
import { deriveDayLocations } from "@/app/lib/route-builder-utils";
import { LocationSearchSelect } from "@/app/(dashboard)/dashboard/(main)/components/location/LocationSearchSelect";
import { TRANSFER_TYPES, type LocationValue } from "@/app/(dashboard)/dashboard/(main)/components/location/location.types";
import { geocodeCity } from "./geocode-city";
import { useBuilder } from "./builder-context";
import { ApplyToDays } from "./ApplyToDays";
import { RouteMiniMap } from "./RouteMiniMap";
import { OptionRow, Segmented, Chip, Empty } from "./builder-ui";
import { routeBetween, type RouteEstimate } from "./route-directions";
import { invalidateStaleOverrides } from "./day-mutations";
import {
  applyVehicleSelection, removeTransport, isPricedVehicle, type AnyVehicleHit,
  addActivity, updateActivity, removeActivity, moveActivity,
  addExtraCab, updateExtraCab, removeExtraCab,
} from "./day-mutations";

// vehicles.type free text — matches VEHICLE_TYPE_LABELS in CabDirectoryTable.tsx.
const VEHICLE_TYPE_LABELS: Record<string, string> = {
  HATCHBACK: "Hatchback", SEDAN: "Sedan", SUV: "SUV",
  LUXURY_SEDAN: "Luxury Sedan", LUXURY_SUV: "Luxury SUV",
  TEMPO_TRAVELLER: "Tempo Traveller", MINI_BUS: "Mini Bus", BUS: "Bus",
  Rikshaw: "Rikshaw",
};
const VEHICLE_TYPE_CHIPS = Object.keys(VEHICLE_TYPE_LABELS);

const SEAT_FILTER_CHIPS = [4, 6, 8, 12, 20];

const CAB_SORT_OPTIONS: { value: CabSortOption; label: string }[] = [
  { value: "price_asc",    label: "Price: Low to High" },
  { value: "price_desc",   label: "Price: High to Low" },
  { value: "distance_asc", label: "Distance: Nearest" },
  { value: "seats_desc",   label: "Seats: Most first" },
  { value: "name_asc",     label: "Name (A–Z)" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Transfer
// ─────────────────────────────────────────────────────────────────────────────

export function TransferView({ day }: { day: number }) {
  const { form, setForm, replaceDay, updateDay, closeDrawer } = useBuilder();
  const itin = form.itineraries.find((it) => it.day === day);

  // No stops at all means no scope to price cabs against — a warning
  // replaces the search entirely rather than silently dumping the whole
  // unscoped fleet catalog (which was the previous, confusing behavior).
  const noDestinations = form.stops.length === 0;
  const derivedCity = deriveDayLocations(form.stops, form.itineraries.length)[day - 1] ?? "";

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AnyVehicleHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState<CabSortOption>("price_asc");
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<string | null>(null);
  const [minSeats, setMinSeats] = useState<number | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount = (vehicleTypeFilter ? 1 : 0) + (minSeats ? 1 : 0);

  // A real pickup point the exec already chose on the map wins over a
  // geocoded guess of the day's stop name — see transportPickupLat/Lng.
  const coordsFromPickup = itin?.transportPickupLat != null && itin?.transportPickupLng != null
    ? { lat: itin.transportPickupLat, lng: itin.transportPickupLng } : null;
  const [geocoded, setGeocoded] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (coordsFromPickup || !derivedCity) { setGeocoded(null); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const c = await geocodeCity(derivedCity);
      if (!cancelled) setGeocoded(c);
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derivedCity, coordsFromPickup?.lat, coordsFromPickup?.lng]);
  const coords = coordsFromPickup ?? geocoded;

  // Priced cab rates near the day's destination first, sorted/filtered/
  // paginated server-side; the unscoped fleet catalog only as a last resort
  // when a typed name search comes back with no priced match. A fleet
  // vehicle carries no rate, so choosing one leaves the day out of the cab
  // subtotal — that's why it's never the default listing.
  const reqRef = useRef(0);
  useEffect(() => {
    if (noDestinations) { setResults([]); setTotal(0); return; }
    const token = ++reqRef.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const { rows, total: t } = await searchCabsForBuilder(
          derivedCity, query, coords, 1, vehicleTypeFilter, minSeats, sortBy,
        );
        if (token !== reqRef.current) return;
        if (rows.length > 0) {
          setResults(rows);
          setPage(1);
          setTotal(t);
        } else if (query.trim()) {
          const fleet = await searchVehiclesForBuilder(query);
          if (token !== reqRef.current) return;
          setResults(fleet);
          setPage(1);
          setTotal(0);
        } else {
          setResults([]);
          setTotal(0);
        }
      } catch {
        if (token === reqRef.current) toast.error("Couldn't load vehicles. Try again.");
      } finally {
        if (token === reqRef.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noDestinations, derivedCity, query, coords?.lat, coords?.lng, vehicleTypeFilter, minSeats, sortBy]);

  const hasMore = results.length < total;

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const { rows, total: t } = await searchCabsForBuilder(
        derivedCity, query, coords, nextPage, vehicleTypeFilter, minSeats, sortBy,
      );
      setResults((prev) => [...prev, ...rows]);
      setPage(nextPage);
      setTotal(t);
    } finally {
      setLoadingMore(false);
    }
  }

  if (!itin) return null;

  function pick(hit: AnyVehicleHit) {
    replaceDay(day, (it) => applyVehicleSelection(it, hit));
    toast.success(`Day ${day}: ${isPricedVehicle(hit) ? hit.vehicleName : hit.name}`);
  }

  function removeVehicle() {
    replaceDay(day, removeTransport);
    toast.success(`Day ${day}: transport removed`);
    closeDrawer();
  }

  /** Copies this day's vehicle onto the chosen days. The route fields are
   * deliberately NOT copied — pickup, drop and distance describe each day's
   * own journey, and stamping day 3's route across the trip would be wrong in
   * a way that quietly mis-prices every per-km day. */
  function applyVehicleToDays(days: number[]) {
    if (!itin?.transport) return;
    const source = itin;
    const target = new Set(days);
    setForm((f) => ({
      ...f,
      itineraries: f.itineraries.map((it) => (target.has(it.day)
        ? invalidateStaleOverrides(it, {
            ...it,
            transport: source.transport,
            transportPhoto: source.transportPhoto,
            transportVehicleType: source.transportVehicleType,
            transportSeats: source.transportSeats,
            cabPricingId: source.cabPricingId,
            cabQuantity: source.cabQuantity,
          })
        : it)),
    }));
    toast.success(`Applied to ${days.length} day${days.length !== 1 ? "s" : ""}`);
  }

  function removeVehicleFromDays(days: number[]) {
    const target = new Set(days);
    setForm((f) => ({
      ...f,
      itineraries: f.itineraries.map((it) =>
        target.has(it.day) ? invalidateStaleOverrides(it, removeTransport(it)) : it,
      ),
    }));
    toast.success(`Removed from ${days.length} day${days.length !== 1 ? "s" : ""}`);
  }

  /** Copies one extra (second/third/…) cab onto the chosen days — separate
   * from applyVehicleToDays above because each extra cab is its own choice,
   * independent of the primary vehicle's day range and any other extra cab's.
   * A target day that already carries this exact cab (matched by
   * cabPricingId, or by label for an unpriced fleet pick) gets its quantity
   * updated in place instead of a duplicate row piling up on repeat clicks. */
  function applyExtraCabToDays(source: CabSelection, days: number[]) {
    const target = new Set(days);
    setForm((f) => ({
      ...f,
      itineraries: f.itineraries.map((it) => {
        if (!target.has(it.day)) return it;
        const existing = it.extraCabs ?? [];
        const matchIdx = existing.findIndex((c) => (
          source.cabPricingId != null ? c.cabPricingId === source.cabPricingId : c.label === source.label
        ));
        const nextExtras = matchIdx >= 0
          ? existing.map((c, i) => (i === matchIdx ? { ...c, ...source } : c))
          : [...existing, source];
        return invalidateStaleOverrides(it, { ...it, extraCabs: nextExtras });
      }),
    }));
    toast.success(`Applied to ${days.length} day${days.length !== 1 ? "s" : ""}`);
  }

  return (
    <div className="p-5 space-y-5">
      {itin.transport && (
        <div className="rounded-xl border border-dashboard-base-300 p-3">
          <div className="flex items-start gap-2.5">
            <Car size={15} className="text-dashboard-primary shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{itin.transport}</p>
              <p className="text-xs text-dashboard-base-content/60">
                {itin.transportVehicleType}
                {itin.transportSeats != null && ` · ${itin.transportSeats} seats`}
              </p>
              {itin.cabPricingId == null && (
                <p className="text-[11px] text-dashboard-warning mt-1">
                  No rate linked — this vehicle won&apos;t be costed into the package.
                </p>
              )}
            </div>
            <Button
              type="button" size="sm" variant="outline"
              className="h-8 text-xs text-dashboard-error hover:text-dashboard-error shrink-0"
              onClick={removeVehicle}
            >
              <Trash2 size={12} /> Remove
            </Button>
          </div>
        </div>
      )}

      {itin.transport && (
        <div className="space-y-2">
          <ApplyToDays
            sourceDay={day}
            label="Use this vehicle on other days"
            confirmLabel="Apply"
            onApply={applyVehicleToDays}
          />
          <ApplyToDays
            sourceDay={day}
            label="Remove transport from other days"
            confirmLabel="Remove from"
            tone="danger"
            onApply={removeVehicleFromDays}
          />
        </div>
      )}

      {/* Route — describes the journey, not the vehicle, so it survives a swap. */}
      <RouteBlock day={day} />

      {itin.transport && (
        <label className="space-y-1 block">
          <span className="text-[11px] text-dashboard-base-content/60">Vehicles of this type</span>
          <Input
            type="number" min={1}
            value={itin.cabQuantity ?? ""}
            onChange={(e) => updateDay(day, {
              cabQuantity: e.target.value ? Math.max(1, parseInt(e.target.value, 10)) : null,
            })}
            placeholder="1" className="h-9 text-sm w-28"
          />
        </label>
      )}

      {(itin.extraCabs ?? []).length > 0 && (
        <div className="space-y-2">
          <label className="text-[11px] font-medium text-dashboard-base-content/60">
            Other vehicles this day
          </label>
          {(itin.extraCabs ?? []).map((c, i) => (
            <div key={i} className="space-y-1.5 rounded-lg border border-dashboard-base-300 p-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{c.label}</p>
                  <p className="text-[10px] text-dashboard-base-content/50">
                    {c.vehicleType}{c.seats != null && ` · ${c.seats} seats`}
                    {c.cabPricingId == null && " · no rate"}
                  </p>
                </div>
                <Input
                  type="number" min={1}
                  value={c.quantity}
                  onChange={(e) => replaceDay(day, (d) =>
                    updateExtraCab(d, i, { quantity: Math.max(1, parseInt(e.target.value, 10) || 1) }))}
                  className="h-8 w-16 text-sm shrink-0"
                  aria-label="Vehicles of this type"
                />
                <Button
                  type="button" size="sm" variant="ghost"
                  className="h-8 w-8 p-0 shrink-0 text-dashboard-error hover:text-dashboard-error"
                  onClick={() => replaceDay(day, (d) => removeExtraCab(d, i))}
                  aria-label="Remove this vehicle"
                >
                  <Trash2 size={13} />
                </Button>
              </div>
              <ApplyToDays
                sourceDay={day}
                label={`Use this ${c.label} on other days`}
                confirmLabel="Apply"
                onApply={(days) => applyExtraCabToDays(c, days)}
              />
            </div>
          ))}
        </div>
      )}

      {noDestinations ? (
        <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-3 flex items-start gap-2.5">
          <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-amber-800">Add destinations first</p>
            <p className="text-[11px] text-amber-700/90">
              Set the trip&apos;s stops under Route (Destinations &amp; Nights) so we can show cabs
              priced near where you&apos;re actually traveling.
            </p>
          </div>
        </div>
      ) : (
      <div className="space-y-2">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dashboard-base-content/40" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={derivedCity ? `Vehicles near ${derivedCity}…` : "Search vehicles…"}
            className="h-9 text-sm pl-7"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-dashboard-base-content/50 shrink-0">Sort</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as CabSortOption)}
            className="h-7 flex-1 min-w-0 text-[11px] rounded-md border border-dashboard-base-300 cursor-pointer bg-dashboard-base-100 px-1.5 outline-none"
          >
            {CAB_SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            aria-expanded={filtersOpen}
            className={cn(
              "flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-[11px] cursor-pointer font-medium transition-colors",
              filtersOpen || activeFilterCount > 0
                ? "border-dashboard-primary/40 bg-dashboard-primary/10 text-dashboard-primary"
                : "border-dashboard-base-300 text-dashboard-base-content/60 hover:bg-dashboard-base-200/60",
            )}
          >
            <Sliders size={11} />
            Filters
            {activeFilterCount > 0 && (
              <span className="flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-dashboard-primary px-1 text-[9px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown size={10} className={cn("transition-transform duration-150", filtersOpen && "rotate-180")} />
          </button>
        </div>

        {filtersOpen && (
          <div className="space-y-2 rounded-lg border border-dashboard-base-300 bg-dashboard-base-200/30 p-2.5">
            {activeFilterCount > 0 && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => { setVehicleTypeFilter(null); setMinSeats(null); }}
                  className="text-[10.5px] font-medium text-dashboard-error/75 hover:text-dashboard-error"
                >
                  Clear all
                </button>
              </div>
            )}

            <div className="flex items-start gap-2">
              <span className="w-12 shrink-0 pt-1 text-[10px] font-semibold uppercase tracking-wider text-dashboard-base-content/45">
                Type
              </span>
              <div className="flex flex-1 flex-wrap items-center gap-1.5">
                {VEHICLE_TYPE_CHIPS.map((t) => (
                  <Chip
                    key={t}
                    selected={vehicleTypeFilter === t}
                    onClick={() => setVehicleTypeFilter((f) => (f === t ? null : t))}
                  >
                    {VEHICLE_TYPE_LABELS[t]}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="flex items-start gap-2">
              <span className="w-12 shrink-0 pt-1 text-[10px] font-semibold uppercase tracking-wider text-dashboard-base-content/45">
                Seats
              </span>
              <div className="flex flex-1 flex-wrap items-center gap-1.5">
                {SEAT_FILTER_CHIPS.map((n) => (
                  <Chip
                    key={n}
                    selected={minSeats === n}
                    onClick={() => setMinSeats((f) => (f === n ? null : n))}
                  >
                    {n}+ seats
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-dashboard-base-content/50">
            <Loader2 size={15} className="animate-spin" /> Finding vehicles…
          </div>
        )}

        {!loading && results.length === 0 && (
          <Empty>
            No vehicles match near {derivedCity || "this stop"}. Try a different filter, or search by name.
          </Empty>
        )}

        {!loading && results.map((hit) => {
          const priced = isPricedVehicle(hit);
          const id = hit.id;
          const name = priced ? hit.vehicleName : hit.name;
          const isCurrent = priced && itin.cabPricingId === id;
          return (
            <div key={`${priced ? "p" : "v"}-${id}`} className="flex items-stretch gap-1.5">
            <div className="flex-1 min-w-0">
            <OptionRow
              selected={isCurrent}
              onClick={() => pick(hit)}
              leading={hit.thumbnail ? (
                <Image
                  src={hit.thumbnail}
                  alt={name}
                  width={56}
                  height={42}
                  className="h-10.5 w-14 rounded-lg object-cover border"
                />
              ) : (
                <div className="h-10.5 w-14 rounded-lg bg-dashboard-base-200 border border-dashboard-base-300 flex items-center justify-center">
                  <Car size={16} className="text-dashboard-base-content/30" />
                </div>
              )}
              title={name}
              meta={
                <>
                  <span className="flex items-center gap-1">
                    <Users size={9} /> {hit.passengerCapacity} seats{hit.hasAc ? " · AC" : ""}
                    {!priced && " · no rate"}
                  </span>
                  {priced && hit.cityName && (
                    <span className="flex items-center gap-1">
                      <MapPin size={9} /> {hit.cityName}
                    </span>
                  )}
                </>
              }
              trailing={priced ? (
                <>
                  <p className="text-[13px] font-bold tabular-nums">₹{hit.price.toLocaleString("en-IN")}</p>
                  <p className="text-[10px] text-dashboard-base-content/50">{hit.pricingType.toLowerCase().replace("_", " ")}</p>
                </>
              ) : undefined}
            />
            </div>
            {itin.transport && (
              <button
                type="button"
                onClick={() => replaceDay(day, (d) => addExtraCab(d, hit))}
                title="Add this as another, different cab for the day"
                className="shrink-0 self-center rounded-[7px] border border-dashed border-dashboard-base-300 px-2 py-1 text-[10px] font-medium text-dashboard-base-content/60 hover:bg-dashboard-base-200 transition-colors duration-[120ms]"
              >
                + Add another cab
              </button>
            )}
            </div>
          );
        })}

        {hasMore && !loading && (
          <Button
            type="button"
            className="w-full h-8 gap-1.5 text-xs bg-dashboard-primary text-dashboard-primary-content border-transparent hover:bg-dashboard-primary/90"
            onClick={loadMore} disabled={loadingMore}
          >
            {loadingMore ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            {loadingMore ? "Loading…" : `Load more · ${total - results.length} left`}
          </Button>
        )}
      </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Experiences
// ─────────────────────────────────────────────────────────────────────────────

export function ActivitiesView({ day }: { day: number }) {
  const { form, replaceDay } = useBuilder();
  // Search first: the catalog write-up and photos are better than anything an
  // exec would type under time pressure, and picking one fills both. Writing
  // by hand stays a full peer for the many activities not in the catalog.
  const [tab, setTab] = useState<"search" | "manual">("search");
  const itin = form.itineraries.find((it) => it.day === day);
  if (!itin) return null;

  // Explicitly DayItinerary rather than `typeof itin`: the `if (!itin)`
  // guard above narrows the value, but not the type this closure is
  // declared with, which would still include undefined.
  function mutate(fn: (d: DayItinerary) => DayItinerary) {
    replaceDay(day, fn);
  }

  return (
    <div className="p-5 space-y-3">
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "search", label: "From the catalog" },
          { value: "manual", label: "Write your own" },
        ]}
      />

      {tab === "search" && <ActivitySearch day={day} />}

      {itin.activities.length === 0 && tab === "manual" && (
        <p className="py-6 text-center text-sm text-dashboard-base-content/50">
          Nothing planned for this day yet.
        </p>
      )}

      {itin.activities.map((a, i) => (
        <div key={i} className="rounded-lg border border-dashboard-base-300 bg-dashboard-base-100 p-2.5 space-y-2">
          {/* Same shape as a route stop: index circle + the field itself in
              one row, actions right there instead of stranded below the
              content with nothing tying them to what they act on. */}
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-dashboard-primary/10 text-[10.5px] font-bold text-dashboard-primary">
              {i + 1}
            </span>
            <Input
              value={a.title}
              onChange={(e) => mutate((d) => updateActivity(d, i, { title: e.target.value }))}
              placeholder="Activity name…"
              className="h-9 text-sm font-semibold flex-1 min-w-0 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
            />
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                disabled={i === 0}
                onClick={() => mutate((d) => moveActivity(d, i, -1))}
                title="Move up"
                className="p-1.5 rounded-md hover:bg-dashboard-base-300 text-dashboard-base-content/50 hover:text-dashboard-base-content disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <ArrowUp size={13} />
              </button>
              <button
                type="button"
                disabled={i === itin.activities.length - 1}
                onClick={() => mutate((d) => moveActivity(d, i, 1))}
                title="Move down"
                className="p-1.5 rounded-md hover:bg-dashboard-base-300 text-dashboard-base-content/50 hover:text-dashboard-base-content disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <ArrowDown size={13} />
              </button>
              <button
                type="button"
                onClick={() => mutate((d) => removeActivity(d, i))}
                title="Remove this activity"
                className="p-1.5 rounded-md hover:bg-dashboard-error/10 text-dashboard-error/70 hover:text-dashboard-error transition-colors"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          <div className="pl-7">
            <textarea
              value={a.description}
              onChange={(e) => mutate((d) => updateActivity(d, i, { description: e.target.value }))}
              placeholder="Describe this experience…"
              rows={2}
              className="w-full rounded-md border border-dashboard-base-300 px-3 py-2 text-xs resize-y focus-visible:outline-2 focus-visible:outline-dashboard-primary/40"
            />
          </div>
        </div>
      ))}

      {tab === "manual" && (
        <Button
          type="button" variant="outline"
          className="w-full h-9 text-xs border-dashed"
          onClick={() => mutate((d) => addActivity(d))}
        >
          <Plus size={13} /> Add a blank experience
        </Button>
      )}

      <p className="text-[11px] text-dashboard-base-content/45 pt-1">
        Photos are added by clicking the activity&apos;s image tiles in the preview.
      </p>
    </div>
  );
}

/** Catalog activity search, scoped to the day's stop.
 *
 * Picking one fills the name, the catalog's own write-up and up to three
 * photos in a single action — which is the whole reason to search rather than
 * type: an exec under time pressure will not write the description, and a day
 * with a bare activity name reads badly on the client's document. */
function ActivitySearch({ day }: { day: number }) {
  const { form, replaceDay } = useBuilder();
  const city = deriveDayLocations(form.stops, form.itineraries.length)[day - 1] ?? "";
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ActivityResult[]>([]);
  const [loading, setLoading] = useState(false);

  const reqRef = useRef(0);
  useEffect(() => {
    if (!city && !query.trim()) { setResults([]); return; }
    const token = ++reqRef.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const rows = await searchActivitiesForBuilder(city, query);
        if (token === reqRef.current) setResults(rows);
      } catch {
        if (token === reqRef.current) toast.error("Couldn't load activities.");
      } finally {
        if (token === reqRef.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [city, query]);

  function pick(a: ActivityResult) {
    replaceDay(day, (d) => ({
      ...d,
      activities: [...d.activities, {
        title: a.name,
        description: a.description ?? "",
        photo: a.photos[0] ?? a.thumbnail ?? "",
        photos: a.photos.slice(0, 3),
        photoLabels: a.photoLabels.slice(0, 3),
      }],
    }));
    toast.success(`Added ${a.name}`);
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dashboard-base-content/40" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={city ? `Things to do near ${city}…` : "Search activities…"}
          className="h-9 text-sm pl-7"
        />
      </div>

      {loading && (
        <p className="py-6 text-center text-sm text-dashboard-base-content/50">Searching…</p>
      )}

      {!loading && results.length === 0 && (
        <p className="py-6 text-center text-sm text-dashboard-base-content/50">
          {city || query ? "Nothing in the catalog matches — write your own instead." : "Enter a city to see activities."}
        </p>
      )}

      <div className="space-y-1.5 max-h-72 overflow-y-auto">
        {!loading && results.map((a) => (
          <OptionRow
            key={a.id}
            onClick={() => pick(a)}
            title={a.name}
            description={a.description ?? undefined}
            meta={
              <>
                {a.category && <span>{a.category}</span>}
                {a.durationHours != null && <span>{a.durationHours}h</span>}
                {a.photos.length > 0 && <span>{a.photos.length} photo{a.photos.length !== 1 ? "s" : ""}</span>}
              </>
            }
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// The day's journey
//
// Two tabs, because both ways of getting these numbers are legitimate:
//
//   Search — pick real places, see them on a map, and let the routing API work
//            out road distance and drive time.
//   Manual — type all of it. Plenty of transfers don't route sensibly (a local
//            sightseeing day, a ferry leg, a road the API doesn't know is
//            shut), and the manual path is what everything already ran on.
//
// A computed estimate is never written straight into the day. It's shown with
// an Apply next to it, because the exec knows things the routing engine does
// not, and silently replacing a number they typed would be the worst outcome.
// ─────────────────────────────────────────────────────────────────────────────

function RouteBlock({ day }: { day: number }) {
  const { form, updateDay } = useBuilder();
  const itin = form.itineraries.find((it) => it.day === day);
  const [tab, setTab] = useState<"search" | "manual">("search");
  const [estimate, setEstimate] = useState<RouteEstimate | null>(null);
  const [routing, setRouting] = useState(false);

  const from = itin?.transportPickupLat != null && itin.transportPickupLng != null
    ? { lat: itin.transportPickupLat, lng: itin.transportPickupLng } : null;
  const to = itin?.transportDropLat != null && itin.transportDropLng != null
    ? { lat: itin.transportDropLat, lng: itin.transportDropLng } : null;

  // Only routes with two real points, and debounced — Directions is metered,
  // so a half-typed place name must never bill for a request.
  useEffect(() => {
    if (!from || !to) { setEstimate(null); return; }
    let cancelled = false;
    setRouting(true);
    const timer = setTimeout(async () => {
      const r = await routeBetween(from, to);
      if (!cancelled) { setEstimate(r); setRouting(false); }
    }, 500);
    return () => { cancelled = true; clearTimeout(timer); setRouting(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from?.lat, from?.lng, to?.lat, to?.lng]);

  if (!itin) return null;

  const differs = estimate && (
    itin.transportDistanceKm !== estimate.distanceKm ||
    itin.transportTravelTime !== estimate.travelTime
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-dashboard-base-content/50">
          Journey
        </p>
        <Segmented
          className="w-44"
          value={tab}
          onChange={setTab}
          options={[
            { value: "search", label: "On the map" },
            { value: "manual", label: "By hand" },
          ]}
        />
      </div>

      {tab === "search" ? (
        <>
          <div className="space-y-2">
            <div className="space-y-1">
              <span className="text-[11px] text-dashboard-base-content/60">Pickup</span>
              <LocationSearchSelect
                value={itin.transportPickup
                  ? { id: "pickup", name: itin.transportPickup, type: "AREA", breadcrumb: itin.transportPickup, slug: "", latitude: itin.transportPickupLat, longitude: itin.transportPickupLng }
                  : null}
                onChange={(loc: LocationValue | null) => updateDay(day, {
                  transportPickup: loc?.name ?? "",
                  transportPickupLat: loc?.latitude ?? null,
                  transportPickupLng: loc?.longitude ?? null,
                })}
                types={TRANSFER_TYPES}
                placeholder="Search a pickup location…"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] text-dashboard-base-content/60">Drop</span>
              <LocationSearchSelect
                value={itin.transportDrop
                  ? { id: "drop", name: itin.transportDrop, type: "AREA", breadcrumb: itin.transportDrop, slug: "", latitude: itin.transportDropLat, longitude: itin.transportDropLng }
                  : null}
                onChange={(loc: LocationValue | null) => updateDay(day, {
                  transportDrop: loc?.name ?? "",
                  transportDropLat: loc?.latitude ?? null,
                  transportDropLng: loc?.longitude ?? null,
                })}
                types={TRANSFER_TYPES}
                placeholder="Search a drop location…"
              />
            </div>
          </div>

          <RouteMiniMap from={from} to={to} line={estimate?.geometry} />

          {routing && (
            <p className="text-[11px] text-dashboard-base-content/50 flex items-center gap-1.5">
              <Loader2 size={11} className="animate-spin" /> Working out the drive…
            </p>
          )}

          {estimate && (
            <div className="rounded-lg border border-dashboard-base-300 p-2.5 space-y-2">
              <p className="text-[11px] text-dashboard-base-content/70">
                By road: <span className="font-semibold text-dashboard-base-content">
                  {estimate.distanceKm} km · {estimate.travelTime}
                </span>
              </p>
              {differs ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button" size="sm" className="h-7 text-[11px]"
                    onClick={() => updateDay(day, {
                      transportDistanceKm: estimate.distanceKm,
                      transportTravelTime: estimate.travelTime,
                    })}
                  >
                    Use these
                  </Button>
                  <span className="text-[10.5px] text-dashboard-base-content/45">
                    {itin.transportDistanceKm != null || itin.transportTravelTime
                      ? "Your own figures are kept until you apply this."
                      : "Nothing set yet for this day."}
                  </span>
                </div>
              ) : (
                <p className="text-[10.5px] text-dashboard-base-content/45">
                  Matches what&apos;s set for this day.
                </p>
              )}
            </div>
          )}

          {!from || !to ? (
            <p className="text-[11px] text-dashboard-base-content/45">
              Pick both ends to see the route and its drive time.
            </p>
          ) : null}
        </>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-[11px] text-dashboard-base-content/60">Pickup</span>
            <Input
              value={itin.transportPickup}
              onChange={(e) => updateDay(day, { transportPickup: e.target.value })}
              placeholder="From" className="h-9 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] text-dashboard-base-content/60">Drop</span>
            <Input
              value={itin.transportDrop}
              onChange={(e) => updateDay(day, { transportDrop: e.target.value })}
              placeholder="To" className="h-9 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] text-dashboard-base-content/60">Distance (km)</span>
            <Input
              type="number" min={0}
              value={itin.transportDistanceKm ?? ""}
              onChange={(e) => updateDay(day, {
                transportDistanceKm: e.target.value ? parseFloat(e.target.value) : null,
              })}
              placeholder="0" className="h-9 text-sm"
            />
            <span className="text-[10px] text-dashboard-base-content/45">Per-km rates price off this.</span>
          </label>
          <label className="space-y-1">
            <span className="text-[11px] text-dashboard-base-content/60">Drive time</span>
            <Input
              value={itin.transportTravelTime}
              onChange={(e) => updateDay(day, { transportTravelTime: e.target.value })}
              placeholder="e.g. 4h 30m" className="h-9 text-sm"
            />
          </label>
        </div>
      )}
    </div>
  );
}
