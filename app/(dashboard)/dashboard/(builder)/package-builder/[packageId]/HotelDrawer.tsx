"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Hotel drawer — the two things an exec does to a day's stay.
//
//   replace — swap it for another property near the same stop
//   edit    — change what this stay includes (rooms, meals, times)
//
// Both write through day-mutations.ts / the builder context, never directly
// into form state, so the priced result is identical to picking the same room
// from the right-hand panel. That's not a style preference: the capacity
// fields a room selection snapshots feed planRoomOccupancy, so a second copy
// of that logic would show up as a wrong price rather than as an error.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Hotel, Loader2, MapPin, Search, Trash2, BedDouble, CheckIcon, CopyIcon } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { Input } from "@/app/(dashboard)/dashboard/(main)/components/ui/input";
import { Button } from "@/app/(dashboard)/dashboard/(main)/components/ui/button";
import {
  searchHotelRoomsForBuilder, getHotelRoomByIdForBuilder, type HotelRoomResult,
} from "../action";
import { geocodeCity } from "./geocode-city";
import { deriveDayLocations } from "@/app/lib/route-builder-utils";
import { planRoomOccupancy } from "@/app/lib/room-capacity";
import { useBuilder } from "./builder-context";
import { applyHotelRoomSelection, clearHotelSelection, invalidateStaleOverrides } from "./day-mutations";

// ─────────────────────────────────────────────────────────────────────────────
// Replace
// ─────────────────────────────────────────────────────────────────────────────

export function HotelReplaceView({ day }: { day: number }) {
  const { form, setForm, replaceDay, openDrawer, closeDrawer } = useBuilder();
  const itin = form.itineraries.find((it) => it.day === day);

  // The stop this day is assigned to by the route builder — the default search
  // scope, same derivation the right-hand panel uses.
  const derivedCity = deriveDayLocations(form.stops, form.itineraries.length)[day - 1] ?? "";
  const [city, setCity] = useState(derivedCity);
  const [query, setQuery] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [results, setResults] = useState<HotelRoomResult[]>([]);
  const [loading, setLoading] = useState(false);

  // Geocode the city so results can be ordered by, and show, distance from
  // town — the single most useful signal when swapping a property.
  useEffect(() => {
    if (!city) { setCoords(null); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const c = await geocodeCity(city);
      if (!cancelled) setCoords(c);
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [city]);

  // Debounced search. A stale response from an earlier keystroke must never
  // overwrite a newer one, hence the request token.
  const reqRef = useRef(0);
  useEffect(() => {
    if (!city && !query.trim()) { setResults([]); return; }
    const token = ++reqRef.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const rows = await searchHotelRoomsForBuilder(city, query, coords, 1, null, null, null, "price_asc");
        if (token === reqRef.current) setResults(rows);
      } catch {
        if (token === reqRef.current) toast.error("Couldn't load hotels. Try again.");
      } finally {
        if (token === reqRef.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [city, query, coords]);

  if (!itin) return null;

  function pick(room: HotelRoomResult) {
    replaceDay(day, (it) => applyHotelRoomSelection(it, room));
    toast.success(`Day ${day}: ${room.hotelName}`);
    // Straight into the details view — picking a property is almost always
    // followed by setting how many rooms of it are needed.
    openDrawer({ kind: "hotel-edit", day });
  }

  /** Applies the currently-picked room to every day, for a multi-night stay in
   * one place. Mirrors the right panel's "All days" action.
   *
   * Re-fetches the room by id rather than looking for it in `results`: the
   * current pick is frequently NOT in the visible list (different city typed
   * into the search, or simply further down than this page of results), and
   * failing in that case would make the action look broken at random. */
  async function applyToAllDays() {
    const current = itin?.roomPricingId;
    if (current == null) return;
    const source = await getHotelRoomByIdForBuilder(current, coords);
    if (!source) {
      toast.error("Couldn't load that room. Pick it again to apply it everywhere.");
      return;
    }
    setForm((f) => ({
      ...f,
      // Every day changes here, so this can't go through replaceDay(day, …) —
      // the invalidation is applied per day instead, for the same reason.
      itineraries: f.itineraries.map((it) =>
        invalidateStaleOverrides(it, applyHotelRoomSelection(it, source)),
      ),
    }));
    toast.success(`Applied to all ${form.itineraries.length} days`);
    closeDrawer();
  }

  return (
    <div className="p-5 space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-[11px] font-medium text-dashboard-base-content/60">Near</span>
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="h-9 text-sm" />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-medium text-dashboard-base-content/60">Search</span>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dashboard-base-content/40" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Hotel name…"
              className="h-9 text-sm pl-7"
            />
          </div>
        </label>
      </div>

      {itin.roomPricingId != null && form.itineraries.length > 1 && (
        <button
          type="button"
          onClick={applyToAllDays}
          className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-dashboard-base-300 py-2 text-xs font-medium text-dashboard-base-content/70 hover:bg-dashboard-base-200/50"
        >
          <CopyIcon size={12} /> Use this day&apos;s hotel for every day
        </button>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-dashboard-base-content/50">
          <Loader2 size={15} className="animate-spin" /> Finding stays…
        </div>
      )}

      {!loading && results.length === 0 && (
        <p className="py-10 text-center text-sm text-dashboard-base-content/50">
          {city || query ? "No stays match. Try a different city or name." : "Enter a city to see stays."}
        </p>
      )}

      <div className="space-y-2">
        {!loading && results.map((room) => {
          const isCurrent = room.id === itin.roomPricingId;
          // What this option would actually cost for THIS party — the same
          // calculation the priced total uses, so the number shown while
          // choosing is the number that lands on the quote.
          const plan = planRoomOccupancy(form.adults, form.children, {
            max_occupancy: room.roomCapacity,
            extra_bed_capacity: room.extraBedCapacity,
            max_adults: room.maxAdults,
            max_children: room.maxChildren,
          }, itin.roomsCount);
          const nightly = room.pricePerNight * plan.rooms;

          return (
            <button
              key={room.id}
              type="button"
              onClick={() => pick(room)}
              className={cn(
                "w-full text-left rounded-xl border p-3 transition-colors",
                isCurrent
                  ? "border-dashboard-primary bg-dashboard-primary/5"
                  : "border-dashboard-base-300 hover:bg-dashboard-base-200/50",
              )}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold truncate">{room.hotelName}</p>
                    {isCurrent && <CheckIcon size={13} className="text-dashboard-primary shrink-0" />}
                  </div>
                  <p className="text-xs text-dashboard-base-content/60 truncate">{room.roomName}</p>
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-1 text-[11px] text-dashboard-base-content/50">
                    {room.starRating && <span>{room.starRating}</span>}
                    {room.distanceKm != null && (
                      <span className="flex items-center gap-0.5">
                        <MapPin size={9} /> {room.distanceKm.toFixed(1)} km
                      </span>
                    )}
                    <span className="flex items-center gap-0.5">
                      <BedDouble size={9} /> {plan.rooms} room{plan.rooms !== 1 ? "s" : ""}
                      {plan.mattresses > 0 && ` · ${plan.mattresses} mattress${plan.mattresses !== 1 ? "es" : ""}`}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold tabular-nums">₹{nightly.toLocaleString("en-IN")}</p>
                  <p className="text-[10px] text-dashboard-base-content/50">per night</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit
// ─────────────────────────────────────────────────────────────────────────────

export function HotelEditView({ day }: { day: number }) {
  const { form, replaceDay, updateDay, openDrawer, closeDrawer } = useBuilder();
  const itin = form.itineraries.find((it) => it.day === day);
  if (!itin) return null;

  const hasCatalogRoom = itin.roomPricingId != null;
  const plan = planRoomOccupancy(form.adults, form.children, {
    max_occupancy: itin.accommodationRoomCapacity,
    extra_bed_capacity: itin.accommodationExtraBedCapacity,
    max_adults: itin.accommodationMaxAdults,
    max_children: itin.accommodationMaxChildren,
  }, itin.roomsCount);

  function removeHotel() {
    replaceDay(day, clearHotelSelection);
    toast.success(`Day ${day}: stay removed`);
    closeDrawer();
  }

  return (
    <div className="p-5 space-y-5">
      <div className="rounded-xl border border-dashboard-base-300 p-3">
        <div className="flex items-start gap-2.5">
          <Hotel size={15} className="text-dashboard-primary shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{itin.accommodation || "No stay chosen yet"}</p>
            {itin.accommodationLocation && (
              <p className="text-xs text-dashboard-base-content/60">{itin.accommodationLocation}</p>
            )}
            {itin.accommodationRoomSpecs && (
              <p className="text-[11px] text-dashboard-base-content/50 mt-0.5">{itin.accommodationRoomSpecs}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <Button
            type="button" size="sm" variant="outline" className="flex-1 h-8 text-xs"
            onClick={() => openDrawer({ kind: "hotel-replace", day })}
          >
            {hasCatalogRoom ? "Replace" : "Choose a stay"}
          </Button>
          {hasCatalogRoom && (
            <Button
              type="button" size="sm" variant="outline"
              className="h-8 text-xs text-dashboard-error hover:text-dashboard-error"
              onClick={removeHotel}
            >
              <Trash2 size={12} /> Remove
            </Button>
          )}
        </div>
      </div>

      {hasCatalogRoom && (
        <>
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-dashboard-base-content/60">Rooms needed</label>
            <Input
              type="number" min={1}
              value={itin.roomsCount ?? ""}
              placeholder={String(plan.rooms)}
              onChange={(e) => updateDay(day, {
                roomsCount: e.target.value ? Math.max(1, parseInt(e.target.value, 10)) : null,
              })}
              className="h-9 text-sm w-28"
            />
            <p className="text-[11px] text-dashboard-base-content/50">
              Leave blank to auto-compute. For {form.adults} adult{form.adults !== 1 ? "s" : ""}
              {form.children > 0 ? `, ${form.children} child${form.children !== 1 ? "ren" : ""}` : ""}:{" "}
              <span className="font-medium text-dashboard-primary">
                {plan.rooms} room{plan.rooms !== 1 ? "s" : ""}
                {plan.mattresses > 0 && ` · ${plan.mattresses} mattress${plan.mattresses !== 1 ? "es" : ""}`}
              </span>
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-dashboard-base-content/60">Meal plan</label>
            <Input
              value={itin.hotelMealPlan}
              onChange={(e) => updateDay(day, { hotelMealPlan: e.target.value })}
              placeholder="e.g. MAP — Breakfast &amp; Dinner"
              className="h-9 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-dashboard-base-content/60">Check-in</label>
              <Input
                value={itin.hotelCheckIn}
                onChange={(e) => updateDay(day, { hotelCheckIn: e.target.value })}
                placeholder="2:00 PM"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-dashboard-base-content/60">Check-out</label>
              <Input
                value={itin.hotelCheckOut}
                onChange={(e) => updateDay(day, { hotelCheckOut: e.target.value })}
                placeholder="11:00 AM"
                className="h-9 text-sm"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
