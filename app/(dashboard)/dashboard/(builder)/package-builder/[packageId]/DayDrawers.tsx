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
import { toast } from "sonner";
import {
  Car, Loader2, Search, Trash2, Plus, ArrowUp, ArrowDown, Users, Sparkles,
} from "lucide-react";
import { cn } from "@/app/lib/utils";
import { Input } from "@/app/(dashboard)/dashboard/(main)/components/ui/input";
import { Button } from "@/app/(dashboard)/dashboard/(main)/components/ui/button";
import {
  searchVehiclesForBuilder, searchCabsForBuilder, type DayItinerary,
} from "../action";
import { deriveDayLocations } from "@/app/lib/route-builder-utils";
import { LocationSearchSelect } from "@/app/(dashboard)/dashboard/(main)/components/location/LocationSearchSelect";
import { TRANSFER_TYPES, type LocationValue } from "@/app/(dashboard)/dashboard/(main)/components/location/location.types";
import { useBuilder } from "./builder-context";
import { ApplyToDays } from "./ApplyToDays";
import { invalidateStaleOverrides } from "./day-mutations";
import {
  applyVehicleSelection, clearVehicleSelection, isPricedVehicle, type AnyVehicleHit,
  addActivity, updateActivity, removeActivity, moveActivity,
  addExtraCab, updateExtraCab, removeExtraCab,
} from "./day-mutations";

// ─────────────────────────────────────────────────────────────────────────────
// Transfer
// ─────────────────────────────────────────────────────────────────────────────

export function TransferView({ day }: { day: number }) {
  const { form, setForm, replaceDay, updateDay, closeDrawer } = useBuilder();
  const itin = form.itineraries.find((it) => it.day === day);

  const derivedCity = deriveDayLocations(form.stops, form.itineraries.length)[day - 1] ?? "";
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AnyVehicleHit[]>([]);
  const [loading, setLoading] = useState(false);

  // Priced cab rates for the day's city first; the unscoped fleet catalog only
  // as a fallback, matching the right panel's fetchCabOptions. A fleet vehicle
  // carries no rate, so choosing one leaves the day out of the cab subtotal.
  const reqRef = useRef(0);
  useEffect(() => {
    const token = ++reqRef.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const priced = derivedCity
          ? await searchCabsForBuilder(derivedCity, query, null)
          : [];
        const rows: AnyVehicleHit[] = priced.length > 0
          ? priced
          : await searchVehiclesForBuilder(query);
        if (token === reqRef.current) setResults(rows);
      } catch {
        if (token === reqRef.current) toast.error("Couldn't load vehicles. Try again.");
      } finally {
        if (token === reqRef.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [derivedCity, query]);

  if (!itin) return null;

  function pick(hit: AnyVehicleHit) {
    replaceDay(day, (it) => applyVehicleSelection(it, hit));
    toast.success(`Day ${day}: ${isPricedVehicle(hit) ? hit.vehicleName : hit.name}`);
  }

  function removeVehicle() {
    replaceDay(day, clearVehicleSelection);
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
        target.has(it.day) ? invalidateStaleOverrides(it, clearVehicleSelection(it)) : it,
      ),
    }));
    toast.success(`Removed from ${days.length} day${days.length !== 1 ? "s" : ""}`);
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
      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-dashboard-base-content/50">Route</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1 col-span-2">
            <span className="text-[11px] text-dashboard-base-content/60">Pickup</span>
            {/* A searching control, not a text box. transportPickupLat/Lng are
                written nowhere else in the app, and both the cab rate search
                and the route map read them — a plain input would leave the
                name updating while the coordinates silently went stale. */}
            <LocationSearchSelect
              value={itin.transportPickup
                ? {
                    id: "pickup", name: itin.transportPickup, type: "AREA",
                    breadcrumb: itin.transportPickup, slug: "",
                    latitude: itin.transportPickupLat, longitude: itin.transportPickupLng,
                  }
                : null}
              onChange={(loc: LocationValue | null) => updateDay(day, {
                transportPickup:    loc?.name ?? "",
                transportPickupLat: loc?.latitude ?? null,
                transportPickupLng: loc?.longitude ?? null,
              })}
              types={TRANSFER_TYPES}
              placeholder="Search a pickup location…"
            />
            {itin.transportPickupLat != null && (
              <span className="text-[10px] text-dashboard-base-content/45">
                Located — cab rates below are matched against this exact point.
              </span>
            )}
          </div>
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
            <span className="text-[11px] text-dashboard-base-content/60">Vehicles of this type</span>
            <Input
              type="number" min={1}
              value={itin.cabQuantity ?? ""}
              onChange={(e) => updateDay(day, {
                cabQuantity: e.target.value ? Math.max(1, parseInt(e.target.value, 10)) : null,
              })}
              placeholder="1" className="h-9 text-sm"
            />
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
      </div>

      {(itin.extraCabs ?? []).length > 0 && (
        <div className="space-y-2">
          <label className="text-[11px] font-medium text-dashboard-base-content/60">
            Other vehicles this day
          </label>
          {(itin.extraCabs ?? []).map((c, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-dashboard-base-300 p-2">
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
          ))}
        </div>
      )}

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

        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-dashboard-base-content/50">
            <Loader2 size={15} className="animate-spin" /> Finding vehicles…
          </div>
        )}

        {!loading && results.length === 0 && (
          <p className="py-8 text-center text-sm text-dashboard-base-content/50">No vehicles match.</p>
        )}

        {!loading && results.map((hit) => {
          const priced = isPricedVehicle(hit);
          const id = hit.id;
          const name = priced ? hit.vehicleName : hit.name;
          const isCurrent = priced && itin.cabPricingId === id;
          return (
            <button
              key={`${priced ? "p" : "v"}-${id}`}
              type="button"
              onClick={() => pick(hit)}
              className={cn(
                "w-full text-left rounded-xl border p-3 transition-colors flex items-center gap-3",
                isCurrent
                  ? "border-dashboard-primary bg-dashboard-primary/5"
                  : "border-dashboard-base-300 hover:bg-dashboard-base-200/50",
              )}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{name}</p>
                <p className="text-[11px] text-dashboard-base-content/55 flex items-center gap-1.5">
                  <Users size={9} /> {hit.passengerCapacity} seats{hit.hasAc ? " · AC" : ""}
                  {!priced && " · no rate"}
                </p>
              </div>
              {priced && (
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold tabular-nums">₹{hit.price.toLocaleString("en-IN")}</p>
                  <p className="text-[10px] text-dashboard-base-content/50">{hit.pricingType.toLowerCase().replace("_", " ")}</p>
                </div>
              )}
              {/* A day can need two vehicle types at once, so a result is not
                  only "replace what's there" — see addExtraCab. */}
              {itin.transport && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); replaceDay(day, (d) => addExtraCab(d, hit)); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault(); e.stopPropagation();
                      replaceDay(day, (d) => addExtraCab(d, hit));
                    }
                  }}
                  title="Add alongside the current vehicle"
                  className="shrink-0 rounded-md border border-dashed border-dashboard-base-300 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-dashboard-base-content/60 hover:bg-dashboard-base-200"
                >
                  + Also
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Experiences
// ─────────────────────────────────────────────────────────────────────────────

export function ActivitiesView({ day }: { day: number }) {
  const { form, replaceDay } = useBuilder();
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
      {itin.activities.length === 0 && (
        <p className="py-6 text-center text-sm text-dashboard-base-content/50">
          Nothing planned for this day yet.
        </p>
      )}

      {itin.activities.map((a, i) => (
        <div key={i} className="rounded-xl border border-dashboard-base-300 p-3 space-y-2">
          <div className="flex items-start gap-2">
            <Sparkles size={13} className="text-dashboard-primary shrink-0 mt-2" />
            <div className="flex-1 min-w-0 space-y-2">
              <Input
                value={a.title}
                onChange={(e) => mutate((d) => updateActivity(d, i, { title: e.target.value }))}
                placeholder="Activity name…"
                className="h-9 text-sm font-medium"
              />
              <textarea
                value={a.description}
                onChange={(e) => mutate((d) => updateActivity(d, i, { description: e.target.value }))}
                placeholder="Describe this experience…"
                rows={2}
                className="w-full rounded-md border border-dashboard-base-300 px-3 py-2 text-xs resize-y focus-visible:outline-2 focus-visible:outline-dashboard-primary/40"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-1">
            <Button
              type="button" size="sm" variant="ghost" className="h-7 w-7 p-0"
              disabled={i === 0}
              onClick={() => mutate((d) => moveActivity(d, i, -1))}
              aria-label="Move up"
            >
              <ArrowUp size={13} />
            </Button>
            <Button
              type="button" size="sm" variant="ghost" className="h-7 w-7 p-0"
              disabled={i === itin.activities.length - 1}
              onClick={() => mutate((d) => moveActivity(d, i, 1))}
              aria-label="Move down"
            >
              <ArrowDown size={13} />
            </Button>
            <Button
              type="button" size="sm" variant="ghost"
              className="h-7 w-7 p-0 text-dashboard-error hover:text-dashboard-error"
              onClick={() => mutate((d) => removeActivity(d, i))}
              aria-label="Remove activity"
            >
              <Trash2 size={13} />
            </Button>
          </div>
        </div>
      ))}

      <Button
        type="button" variant="outline"
        className="w-full h-9 text-xs border-dashed"
        onClick={() => mutate((d) => addActivity(d))}
      >
        <Plus size={13} /> Add an experience
      </Button>

      <p className="text-[11px] text-dashboard-base-content/45 pt-1">
        Photos are added by clicking the activity&apos;s image tiles in the preview.
      </p>
    </div>
  );
}
