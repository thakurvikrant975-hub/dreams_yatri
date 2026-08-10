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
import {
  Hotel, Loader2, MapPin, Search, Trash2, BedDouble, CheckIcon, Clock, Send, Plus, Star,
} from "./builder-icons";
import { Input } from "@/app/(dashboard)/dashboard/(main)/components/ui/input";
import { Button } from "@/app/(dashboard)/dashboard/(main)/components/ui/button";
import {
  searchHotelRoomsForBuilder, getHotelRoomByIdForBuilder, type HotelRoomResult,
} from "../action";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/app/(dashboard)/dashboard/(main)/components/ui/dropdown-menu";
import { ChevronDown } from "./builder-icons";
import { geocodeCity } from "./geocode-city";
import { getMealTypes } from "@/app/(dashboard)/dashboard/(main)/hotels/actions";
import { deriveDayLocations } from "@/app/lib/route-builder-utils";
import { planRoomOccupancy } from "@/app/lib/room-capacity";
import { useBuilder } from "./builder-context";
import { ApplyToDays } from "./ApplyToDays";
import { Field, OptionRow, Chip, Empty, Segmented, Group, Card } from "./builder-ui";
import {
  applyHotelRoomSelection, removeStay, invalidateStaleOverrides,
  beginHotelRequest, submitHotelRequest, cancelHotelRequest, STAY_TYPE_LABELS,
  addExtraRoom, updateExtraRoom, removeExtraRoom, beginManualHotel,
  stayRun, validateStayAssignment,
} from "./day-mutations";

// ─────────────────────────────────────────────────────────────────────────────
// Replace
// ─────────────────────────────────────────────────────────────────────────────

export function HotelReplaceView({ day }: { day: number }) {
  const { form, setForm, replaceDay, openDrawer } = useBuilder();
  const itin = form.itineraries.find((it) => it.day === day);

  // The stop this day is assigned to by the route builder — the default search
  // scope, same derivation the right-hand panel uses.
  const derivedCity = deriveDayLocations(form.stops, form.itineraries.length)[day - 1] ?? "";
  const [city, setCity] = useState(derivedCity);
  const [query, setQuery] = useState("");
  /** Which of the two the single field is driving. Location is the default
   * because a day already knows its stop — most searches are "what's near
   * here", and reaching for a name is the exception. */
  const [mode, setMode] = useState<"location" | "name">("location");
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

  /** Copies this day's room onto the chosen days — a stay usually spans a
   * stretch rather than the whole trip, which is why this takes a selection.
   *
   * Re-fetches the room by id rather than looking for it in `results`: the
   * current pick is frequently NOT in the visible list (different city typed
   * into the search, or simply further down this page of results), and failing
   * in that case would make the action look broken at random. */
  async function applyToDays(days: number[]) {
    const current = itin?.roomPricingId;
    if (current == null) return;
    const source = await getHotelRoomByIdForBuilder(current, coords);
    if (!source) {
      toast.error("Couldn't load that room. Pick it again to apply it elsewhere.");
      return;
    }
    const target = new Set(days);
    setForm((f) => ({
      ...f,
      // Several days change at once, so this can't go through
      // replaceDay(day, …) — the override invalidation is applied per day
      // instead, for exactly the same reason it exists there.
      itineraries: f.itineraries.map((it) =>
        target.has(it.day)
          ? invalidateStaleOverrides(it, applyHotelRoomSelection(it, source))
          : it,
      ),
    }));
    toast.success(`Applied to ${days.length} day${days.length !== 1 ? "s" : ""}`);
  }


  return (
    <div className="p-5 space-y-4">
      {/* One field, with the dropdown saying what it searches. Two side-by-side
          inputs made you decide which box to type in before you'd decided what
          you were looking for; this way the question comes first and there's
          only ever one place to type. */}
      <div className="flex items-stretch rounded-lg border border-dashboard-base-300 focus-within:ring-2 focus-within:ring-dashboard-primary/25 overflow-hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1 px-2.5 text-[11px] font-medium text-dashboard-base-content/70 bg-dashboard-base-200/60 border-r border-dashboard-base-300 hover:bg-dashboard-base-200 shrink-0"
            >
              {mode === "location" ? <MapPin size={12} /> : <Hotel size={12} />}
              {mode === "location" ? "Location" : "Hotel name"}
              <ChevronDown size={11} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuItem onSelect={() => setMode("location")}>
              <MapPin size={13} /> Search by location
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setMode("name")}>
              <Hotel size={13} /> Search by hotel name
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="relative flex-1 min-w-0">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dashboard-base-content/40" />
          <input
            value={mode === "location" ? city : query}
            onChange={(e) => (mode === "location" ? setCity(e.target.value) : setQuery(e.target.value))}
            placeholder={mode === "location" ? "City or area…" : "Hotel name…"}
            className="w-full h-9 text-sm pl-7 pr-2 bg-transparent outline-none"
          />
        </div>
      </div>
      {mode === "name" && city && (
        <p className="text-[11px] text-dashboard-base-content/45 -mt-2">
          Searching everywhere by name. Results still show distance from {city}.
        </p>
      )}

      {/* The escape hatch this view exists to offer: nothing in the catalog
          fits, so hand the day over instead of leaving it empty. */}
      <button
        type="button"
        onClick={() => {
          replaceDay(day, beginHotelRequest);
          openDrawer({ kind: "hotel-request", day });
        }}
        className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-amber-300 bg-amber-50 py-2 text-xs font-medium text-amber-800 hover:bg-amber-100"
      >
        <Clock size={12} /> Can&apos;t find one? Request from the hotel team
      </button>

      {itin.roomPricingId != null && (
        <ApplyToDays
          sourceDay={day}
          label="Use this day's hotel on other days"
          confirmLabel="Apply"
          onApply={applyToDays}
        />
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-dashboard-base-content/50">
          <Loader2 size={15} className="animate-spin" /> Finding stays…
        </div>
      )}

      {!loading && results.length === 0 && (
        <Empty>
          {city || query
            ? "Nothing matches. Try a different area or name — or hand the day to the hotel team."
            : "Choose an area to see what's available."}
        </Empty>
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
            <OptionRow
              key={room.id}
              selected={isCurrent}
              onClick={() => pick(room)}
              title={
                <span className="flex items-center gap-1.5">
                  {room.hotelName}
                  {isCurrent && <CheckIcon size={12} className="text-dashboard-primary shrink-0" />}
                </span>
              }
              description={room.roomName}
              meta={
                <>
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
                </>
              }
              trailing={
                <>
                  <p className="text-[13px] font-bold tabular-nums">₹{nightly.toLocaleString("en-IN")}</p>
                  <p className="text-[10px] text-dashboard-base-content/50">per night</p>
                </>
              }
            />
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit
// ─────────────────────────────────────────────────────────────────────────────

/** A hotel's star rating as stars, not prose.
 *
 * The catalog stores it free-text on hotels.stay_type — "4 Star", "3-star",
 * sometimes something that isn't a rating at all ("Boutique"). A number gets
 * glyphs; anything else is shown as written rather than guessed at. */
function StarRating({ raw }: { raw: string }) {
  const value = raw.trim();
  if (!value) return null;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1 || n > 7) {
    return (
      <span className="text-[10.5px] font-medium text-dashboard-base-content/55">{value}</span>
    );
  }
  return (
    <span className="flex items-center gap-0.5" title={value} aria-label={value}>
      {Array.from({ length: n }, (_, i) => (
        <Star key={i} size={10} className="text-amber-500" />
      ))}
    </span>
  );
}

/**
 * The stay editor for one day.
 *
 * Two tabs, because a stay is genuinely one of two things and the fields
 * differ completely. A catalog room owns its name, rates and occupancy caps
 * and is priced from a real hotel_room_pricing row; a hand-typed one owns
 * nothing but what was entered and is priced from the figures beside it. The
 * old single column showed the catalog card, then the hand-typed block, then
 * catalog-only fields below that, with a "Or enter a hotel by hand" link
 * buried in the middle — so which mode you were in had to be inferred from
 * which controls happened to be visible.
 *
 * Handing the day to the hotel team is deliberately NOT a third tab. It isn't
 * a way of describing the stay, it's a way of not describing it yet, and it
 * takes the day out of the exec's hands — that belongs below the fold, behind
 * a confirmation, not level with the two modes.
 */
export function HotelEditView({ day }: { day: number }) {
  const { form, setForm, replaceDay, updateDay, openDrawer, closeDrawer } = useBuilder();
  // Declared before the early return below — hooks can't sit behind a guard.
  const [requesting, setRequesting] = useState(false);
  const itin = form.itineraries.find((it) => it.day === day);
  if (!itin) return null;

  const hasCatalogRoom = itin.roomPricingId != null;
  const plan = planRoomOccupancy(form.adults, form.children, {
    max_occupancy: itin.accommodationRoomCapacity,
    extra_bed_capacity: itin.accommodationExtraBedCapacity,
    max_adults: itin.accommodationMaxAdults,
    max_children: itin.accommodationMaxChildren,
  }, itin.roomsCount);

  function removeStayFromDays(days: number[]) {
    const target = new Set(days);
    setForm((f) => ({
      ...f,
      itineraries: f.itineraries.map((it) =>
        target.has(it.day) ? invalidateStaleOverrides(it, removeStay(it)) : it,
      ),
    }));
    toast.success(`Removed from ${days.length} day${days.length !== 1 ? "s" : ""}`);
  }

  function removeHotel() {
    replaceDay(day, removeStay);
    toast.success(`Day ${day}: stay removed`);
    closeDrawer();
  }

  if (itin.hotelPending) {
    // A day awaiting the team has no room to show details for — send the
    // exec straight to the request itself.
    return <HotelRequestView day={day} />;
  }

  // The tab IS the day's state rather than a separate selection, so it can't
  // disagree with what's stored. Switching to "by hand" releases the catalog
  // room, because the two are mutually exclusive — the pricing engine takes
  // its manual branch only when roomPricingId is null.
  const tab: "catalog" | "hand" = hasCatalogRoom ? "catalog" : "hand";

  function switchTab(next: "catalog" | "hand") {
    if (next === tab) return;
    if (next === "hand") {
      replaceDay(day, beginManualHotel);
      toast.success("Switched to a hand-typed stay — the catalog room was released.");
    } else {
      openDrawer({ kind: "hotel-replace", day });
    }
  }

  return (
    <div className="p-5 space-y-4">
      <Segmented
        value={tab}
        onChange={switchTab}
        options={[
          { value: "catalog", label: "From the catalog" },
          { value: "hand", label: "By hand" },
        ]}
      />

      {tab === "catalog" ? (
        <>
          <Card className="p-3">
            <div className="flex items-start gap-2.5">
              <Hotel size={15} className="text-dashboard-primary shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{itin.accommodation}</p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                  <StarRating raw={itin.accommodationStarRating} />
                  {itin.accommodationLocation && (
                    <span className="text-xs text-dashboard-base-content/60">
                      {itin.accommodationLocation}
                    </span>
                  )}
                </div>
                {itin.accommodationRoomSpecs && (
                  <p className="text-[11px] text-dashboard-base-content/50 mt-0.5">
                    {itin.accommodationRoomSpecs}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <Button
                type="button" size="sm" variant="outline" className="flex-1 h-8 text-xs"
                onClick={() => openDrawer({ kind: "hotel-replace", day })}
              >
                Replace
              </Button>
              <Button
                type="button" size="sm" variant="outline"
                className="h-8 text-xs text-dashboard-error hover:text-dashboard-error"
                onClick={removeHotel}
              >
                <Trash2 size={12} /> Remove
              </Button>
            </div>
          </Card>

          <StayNights day={day} />

          <Group label="This night">
            <Field
              label="Rooms needed"
              hint={`Leave blank to auto-compute. For ${form.adults} adult${form.adults !== 1 ? "s" : ""}${form.children > 0 ? `, ${form.children} child${form.children !== 1 ? "ren" : ""}` : ""}: ${plan.rooms} room${plan.rooms !== 1 ? "s" : ""}${plan.mattresses > 0 ? ` · ${plan.mattresses} mattress${plan.mattresses !== 1 ? "es" : ""}` : ""}`}
            >
              <Input
                type="number" min={1}
                value={itin.roomsCount ?? ""}
                placeholder={String(plan.rooms)}
                onChange={(e) => updateDay(day, {
                  roomsCount: e.target.value ? Math.max(1, parseInt(e.target.value, 10)) : null,
                })}
                className="h-9 text-sm w-28"
              />
            </Field>

            <Field label="Meal plan">
              <Input
                value={itin.hotelMealPlan}
                onChange={(e) => updateDay(day, { hotelMealPlan: e.target.value })}
                placeholder="e.g. MAP — Breakfast &amp; Dinner"
                className="h-9 text-sm"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Check-in">
                <Input
                  value={itin.hotelCheckIn}
                  onChange={(e) => updateDay(day, { hotelCheckIn: e.target.value })}
                  placeholder="2:00 PM" className="h-9 text-sm"
                />
              </Field>
              <Field label="Check-out">
                <Input
                  value={itin.hotelCheckOut}
                  onChange={(e) => updateDay(day, { hotelCheckOut: e.target.value })}
                  placeholder="11:00 AM" className="h-9 text-sm"
                />
              </Field>
            </div>
          </Group>

          <ExtraRoomsEditor day={day} />

          <ApplyToDays
            sourceDay={day}
            label="Remove this stay from other days"
            confirmLabel="Remove from"
            tone="danger"
            onApply={removeStayFromDays}
          />
        </>
      ) : (
        <Group
          label="Hotel entered by hand"
          hint="Priced from these figures rather than a catalog rate: rooms × price, plus mattresses × rate."
        >
          <Field label="Hotel &amp; room">
            <Input
              value={itin.accommodation}
              onChange={(e) => updateDay(day, { accommodation: e.target.value })}
              placeholder="e.g. Snow Valley Resorts — Deluxe"
              className="h-9 text-sm"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Location">
              <Input
                value={itin.accommodationLocation}
                onChange={(e) => updateDay(day, { accommodationLocation: e.target.value })}
                placeholder="City, State" className="h-9 text-sm"
              />
            </Field>
            <Field label="Room specs">
              <Input
                value={itin.accommodationRoomSpecs}
                onChange={(e) => updateDay(day, { accommodationRoomSpecs: e.target.value })}
                placeholder="1 Double Bed | Mountain View" className="h-9 text-sm"
              />
            </Field>
            <Field label="Rooms">
              <Input
                type="number" min={1}
                value={itin.roomsCount ?? ""}
                onChange={(e) => updateDay(day, {
                  roomsCount: e.target.value ? Math.max(1, parseInt(e.target.value, 10)) : null,
                })}
                placeholder="1" className="h-9 text-sm"
              />
            </Field>
            <Field label="Mattresses">
              <Input
                type="number" min={0}
                value={itin.manualExtraBeds ?? ""}
                onChange={(e) => updateDay(day, {
                  manualExtraBeds: e.target.value ? Math.max(0, parseInt(e.target.value, 10)) : null,
                })}
                placeholder="0" className="h-9 text-sm"
              />
            </Field>
            <Field label="Price / night">
              <Input
                type="number" min={0}
                value={itin.manualHotelPricePerNight ?? ""}
                onChange={(e) => updateDay(day, {
                  manualHotelPricePerNight: e.target.value ? parseFloat(e.target.value) : null,
                })}
                placeholder="0" className="h-9 text-sm"
              />
            </Field>
            <Field label="Rate / mattress">
              <Input
                type="number" min={0}
                value={itin.manualExtraBedRate ?? ""}
                onChange={(e) => updateDay(day, {
                  manualExtraBedRate: e.target.value ? parseFloat(e.target.value) : null,
                })}
                placeholder="0" className="h-9 text-sm"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Check-in">
              <Input
                value={itin.hotelCheckIn}
                onChange={(e) => updateDay(day, { hotelCheckIn: e.target.value })}
                placeholder="2:00 PM" className="h-9 text-sm"
              />
            </Field>
            <Field label="Check-out">
              <Input
                value={itin.hotelCheckOut}
                onChange={(e) => updateDay(day, { hotelCheckOut: e.target.value })}
                placeholder="11:00 AM" className="h-9 text-sm"
              />
            </Field>
          </div>
        </Group>
      )}

      {/* Below both tabs, because it is neither mode: it hands the day to the
          hotel team and takes it out of the exec's hands. Asks first — a
          request and a booked room are mutually exclusive and share columns,
          so confirming is what stops one click discarding a chosen room. */}
      <div className="pt-3 border-t border-dashboard-base-300">
        {requesting ? (
          <div className="space-y-2">
            <p className="text-[11px] text-amber-800">
              {hasCatalogRoom
                ? `This clears ${itin.accommodation || "the chosen room"} for day ${day} and puts it in the hotel team's queue.`
                : `Day ${day} goes into the hotel team's queue.`}
            </p>
            <div className="flex gap-2">
              <Button
                type="button" size="sm"
                className="h-8 text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() => {
                  replaceDay(day, beginHotelRequest);
                  openDrawer({ kind: "hotel-request", day });
                }}
              >
                <Clock size={12} /> Yes, request from team
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-8 text-xs"
                onClick={() => setRequesting(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setRequesting(true)}
            className="flex items-center gap-1.5 text-[11px] font-medium text-amber-800 hover:underline"
          >
            <Clock size={11} /> Can&apos;t find a suitable one? Request from the hotel team
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// "Add Hotels by Team" request
//
// Restores the flow the right-hand panel already has: when nothing in the
// catalog fits, hand the day to the hotel team instead of leaving it blank.
// Same three states as the panel — compose, submitted (locked), editing — and
// the same fields, because the hotel team's fill page reads them back and
// prefills from them (see FillHotelForm).
// ─────────────────────────────────────────────────────────────────────────────

export function HotelRequestView({ day }: { day: number }) {
  const { form, replaceDay, openDrawer, closeDrawer } = useBuilder();
  const itin = form.itineraries.find((it) => it.day === day);

  const [mealTypes, setMealTypes] = useState<{ id: number; name: string }[]>([]);
  // Composing means "form open". A submitted request re-opens the form via
  // Edit; hotelPending stays true throughout that, so it can't be inferred
  // from the day alone.
  const [composing, setComposing] = useState(!itin?.hotelPending);

  useEffect(() => {
    let cancelled = false;
    getMealTypes().then((rows) => { if (!cancelled) setMealTypes(rows); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!itin) return null;

  function submit() {
    replaceDay(day, submitHotelRequest);
    setComposing(false);
    toast.success(`Day ${day} sent to the hotel team`);
  }

  function withdraw() {
    replaceDay(day, cancelHotelRequest);
    toast.success(`Day ${day}: request withdrawn`);
    openDrawer({ kind: "hotel-replace", day });
  }

  // ── Submitted, not being edited ──────────────────────────────────────────
  if (itin.hotelPending && !composing) {
    const chips = [
      itin.hotelRequestType ? (STAY_TYPE_LABELS[itin.hotelRequestType] ?? itin.hotelRequestType) : null,
      itin.roomsCount != null ? `${itin.roomsCount} room${itin.roomsCount !== 1 ? "s" : ""}` : null,
      (itin.manualExtraBeds ?? 0) > 0
        ? `${itin.manualExtraBeds} mattress${itin.manualExtraBeds !== 1 ? "es" : ""}` : null,
      itin.hotelMealPlan || null,
    ].filter((v): v is string => !!v);

    return (
      <div className="p-5 space-y-4">
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-2.5">
          <div className="flex items-center gap-1.5 text-amber-800 text-sm font-semibold">
            <Clock size={14} /> Pending — awaiting hotel team
          </div>
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {chips.map((c) => (
                <span key={c} className="inline-flex items-center rounded-full bg-white border border-amber-300 text-amber-800 text-[11px] font-medium px-2 py-0.5">
                  {c}
                </span>
              ))}
            </div>
          )}
          {itin.hotelPendingNote && (
            <p className="text-[11px] text-amber-800/90 bg-white/70 border border-amber-200 rounded-md px-2 py-1.5">
              &quot;{itin.hotelPendingNote}&quot;
            </p>
          )}
          <p className="text-[11px] text-amber-700/80">
            This day is in the hotel team&apos;s queue. Submitting for costing review is
            blocked until they fill it in.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Button type="button" variant="outline" className="h-9 text-xs" onClick={() => setComposing(true)}>
            Edit request
          </Button>
          <Button
            type="button" variant="ghost"
            className="h-9 text-xs text-dashboard-error hover:text-dashboard-error"
            onClick={withdraw}
          >
            Withdraw — search for a hotel instead
          </Button>
        </div>
      </div>
    );
  }

  // ── Compose / edit ───────────────────────────────────────────────────────
  return (
    <div className="p-5 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="text-[11px] text-dashboard-base-content/60">Hotel type</span>
          <select
            value={itin.hotelRequestType ?? ""}
            onChange={(e) => replaceDay(day, (d) => ({ ...d, hotelRequestType: e.target.value || null }))}
            className="w-full text-sm h-9 rounded-md border border-dashboard-base-300 bg-transparent px-2"
          >
            <option value="">Any</option>
            {Object.entries(STAY_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[11px] text-dashboard-base-content/60">Meal plan</span>
          <select
            value={itin.hotelMealPlan}
            onChange={(e) => replaceDay(day, (d) => ({ ...d, hotelMealPlan: e.target.value }))}
            className="w-full text-sm h-9 rounded-md border border-dashboard-base-300 bg-transparent px-2"
          >
            <option value="">Any</option>
            {mealTypes.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[11px] text-dashboard-base-content/60">Rooms needed</span>
          <Input
            type="number" min={1}
            value={itin.roomsCount ?? ""}
            onChange={(e) => replaceDay(day, (d) => ({
              ...d, roomsCount: e.target.value ? Math.max(1, parseInt(e.target.value, 10)) : null,
            }))}
            placeholder="1" className="h-9 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] text-dashboard-base-content/60 flex items-center gap-1">
            <BedDouble size={11} /> Mattresses needed
          </span>
          <Input
            type="number" min={0}
            value={itin.manualExtraBeds ?? ""}
            onChange={(e) => replaceDay(day, (d) => ({
              ...d, manualExtraBeds: e.target.value ? Math.max(0, parseInt(e.target.value, 10)) : null,
            }))}
            placeholder="0" className="h-9 text-sm"
          />
        </label>
      </div>

      <label className="space-y-1 block">
        <span className="text-[11px] text-dashboard-base-content/60">Request message</span>
        <textarea
          value={itin.hotelPendingNote}
          onChange={(e) => replaceDay(day, (d) => ({ ...d, hotelPendingNote: e.target.value }))}
          placeholder="Budget, why nothing fit, preferred area, special requirements…"
          rows={3}
          className="w-full rounded-md border border-dashboard-base-300 px-3 py-2 text-xs resize-y focus-visible:outline-2 focus-visible:outline-dashboard-primary/40"
        />
      </label>

      <div className="flex items-center gap-2">
        <Button type="button" className="h-9 text-xs gap-1.5 flex-1" onClick={submit}>
          <Send size={12} /> {itin.hotelPending ? "Update request" : "Send to hotel team"}
        </Button>
        <Button
          type="button" variant="ghost" className="h-9 text-xs"
          onClick={() => (itin.hotelPending ? setComposing(false) : closeDrawer())}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Extra rooms
//
// A night is really "these rooms", not "this room" — the split between the
// primary roomPricingId and an extraRooms list is an artifact of how the old
// panel was laid out, not of how a booking works. The drawer presents them as
// one list, with the primary first and unremovable (removing it is "remove the
// stay", which is a different action).
// ─────────────────────────────────────────────────────────────────────────────

function ExtraRoomsEditor({ day }: { day: number }) {
  const { form, replaceDay } = useBuilder();
  const itin = form.itineraries.find((it) => it.day === day);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<HotelRoomResult[]>([]);
  const [loading, setLoading] = useState(false);

  const city = deriveDayLocations(form.stops, form.itineraries.length)[day - 1] ?? "";

  useEffect(() => {
    if (!adding) return;
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const rows = await searchHotelRoomsForBuilder(city, query, null, 1, null, null, null, "price_asc");
        if (!cancelled) setResults(rows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [adding, city, query]);

  if (!itin) return null;
  const extras = itin.extraRooms ?? [];

  return (
    <div className="space-y-2">
      <label className="text-[11px] font-medium text-dashboard-base-content/60">
        Other room types this night
      </label>

      {extras.length === 0 && !adding && (
        <p className="text-[11px] text-dashboard-base-content/45">
          Everyone is in the room above. Add another type if the party splits across
          different rooms.
        </p>
      )}

      {extras.map((r, i) => (
        <div key={i} className="flex items-center gap-2 rounded-lg border border-dashboard-base-300 p-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{r.label}</p>
            {r.roomSpecs && (
              <p className="text-[10px] text-dashboard-base-content/50 truncate">{r.roomSpecs}</p>
            )}
          </div>
          <Input
            type="number" min={1}
            value={r.quantity}
            onChange={(e) => replaceDay(day, (d) =>
              updateExtraRoom(d, i, { quantity: Math.max(1, parseInt(e.target.value, 10) || 1) }))}
            className="h-8 w-16 text-sm shrink-0"
            aria-label="Rooms of this type"
          />
          <Button
            type="button" size="sm" variant="ghost"
            className="h-8 w-8 p-0 shrink-0 text-dashboard-error hover:text-dashboard-error"
            onClick={() => replaceDay(day, (d) => removeExtraRoom(d, i))}
            aria-label="Remove this room type"
          >
            <Trash2 size={13} />
          </Button>
        </div>
      ))}

      {adding ? (
        <div className="space-y-2 rounded-lg border border-dashboard-base-300 p-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={city ? `Another room near ${city}…` : "Search a room type…"}
            className="h-8 text-sm"
            autoFocus
          />
          {loading && (
            <p className="text-[11px] text-dashboard-base-content/50 py-2 text-center">Searching…</p>
          )}
          <div className="max-h-56 overflow-y-auto space-y-1">
            {!loading && results.map((room) => (
              <button
                key={room.id}
                type="button"
                onClick={() => {
                  replaceDay(day, (d) => addExtraRoom(d, room));
                  setAdding(false); setQuery("");
                }}
                className="w-full text-left rounded-md px-2 py-1.5 hover:bg-dashboard-base-200/60"
              >
                <p className="text-xs font-medium truncate">{room.hotelName} — {room.roomName}</p>
                <p className="text-[10px] text-dashboard-base-content/50">
                  ₹{room.pricePerNight.toLocaleString("en-IN")} / night
                </p>
              </button>
            ))}
          </div>
          <Button type="button" size="sm" variant="ghost" className="h-7 text-xs w-full"
            onClick={() => { setAdding(false); setQuery(""); }}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" className="w-full h-8 text-xs border-dashed"
          onClick={() => setAdding(true)}>
          <Plus size={12} /> Add another room type
        </Button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Which nights this stay covers
//
// A package is normally a few consecutive nights per hotel, so this is the
// control that turns "pick the same hotel three times" into one action. The run
// is derived from the days rather than stored (see stayRun), so it stays
// compatible with everything already saved and the pricing engine keeps
// costing each night on its own date.
// ─────────────────────────────────────────────────────────────────────────────

function StayNights({ day }: { day: number }) {
  const { form, setForm } = useBuilder();
  const itin = form.itineraries.find((it) => it.day === day);
  const [picked, setPicked] = useState<number[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!itin) return null;

  const run = stayRun(form.itineraries, day);
  const selection = picked ?? run;

  function toggle(d: number) {
    setError(null);
    setPicked((p) => {
      const base = p ?? run;
      return base.includes(d) ? base.filter((x) => x !== d) : [...base, d].sort((a, b) => a - b);
    });
  }

  async function apply() {
    const check = validateStayAssignment(form.itineraries, selection);
    if (!check.ok) { setError(check.reason); return; }

    const source = await getHotelRoomByIdForBuilder(itin!.roomPricingId!, null);
    if (!source) { setError("Couldn't load this room. Pick it again."); return; }

    const target = new Set(check.days);
    setForm((f) => ({
      ...f,
      itineraries: f.itineraries.map((it) => {
        if (target.has(it.day)) {
          return invalidateStaleOverrides(it, applyHotelRoomSelection(it, source));
        }
        // Dropped from the run — clear it, so unticking a night actually
        // releases it rather than leaving the hotel silently attached.
        if (run.includes(it.day)) {
          return invalidateStaleOverrides(it, removeStay(it));
        }
        return it;
      }),
    }));
    setPicked(null);
    toast.success(
      check.days.length === 1
        ? `Day ${check.days[0]}`
        : `Nights ${check.days[0]}–${check.days[check.days.length - 1]}`,
    );
  }

  const dirty = picked !== null && picked.join() !== run.join();

  return (
    <div className="space-y-2 rounded-xl border border-dashboard-base-300 p-3">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[11px] font-medium text-dashboard-base-content/60">
          Nights at this hotel
        </label>
        <span className="text-[10px] text-dashboard-base-content/45">
          {run.length} night{run.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {form.itineraries.map((it) => {
          const on = selection.includes(it.day);
          // A night already held by a DIFFERENT hotel — still selectable
          // (re-assigning is how you fix a mistake), but marked so it's a
          // deliberate act rather than an accident.
          const takenByOther = !on && it.roomPricingId != null && !run.includes(it.day);
          return (
            <Chip
              key={it.day}
              selected={on}
              tone={takenByOther ? "warning" : "primary"}
              onClick={() => toggle(it.day)}
              title={takenByOther ? `Day ${it.day} currently has another hotel` : undefined}
            >
              {it.day}
            </Chip>
          );
        })}
      </div>

      {error && <p className="text-[11px] text-dashboard-error">{error}</p>}

      {dirty && (
        <div className="flex gap-2">
          <Button type="button" size="sm" className="h-8 text-xs flex-1" onClick={apply}>
            Apply to {selection.length} night{selection.length !== 1 ? "s" : ""}
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-8 text-xs"
            onClick={() => { setPicked(null); setError(null); }}>
            Reset
          </Button>
        </div>
      )}
    </div>
  );
}
