"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Meals, add-ons and tickets.
//
// Two of these are package-level rather than day-level, which is the only
// interesting thing about them:
//
//   add-ons  carry a nullable `day`. A null one belongs to the trip; a numbered
//            one renders under that day's stay. The drawer is the same either
//            way — it just filters and stamps the day it was opened for.
//   tickets  are always package-level. A return flight isn't "day 6's flight",
//            and the document derives its route-map legs from the ticket list
//            (deriveTransportFields) rather than from any day.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { Plus, Trash2, Gift, Utensils } from "./builder-icons";
import { cn } from "@/app/lib/utils";
import { Input } from "@/app/(dashboard)/dashboard/(main)/components/ui/input";
import { Button } from "@/app/(dashboard)/dashboard/(main)/components/ui/button";
import { getHotelRoomByIdForBuilder, type TicketInput, type AddonInput } from "../action";
import { useBuilder } from "./builder-context";
import { NOTE_TONES, noteTone, type NoteTone } from "./ItineraryDocument";
import {
  emptyTicket, emptyAddon, computeDurationText, TICKET_TYPE_LABELS, recalcFromStops,
  stopLimitReason,
} from "./day-mutations";
import { RouteStopsEditor } from "./RouteStopsEditor";

// ─────────────────────────────────────────────────────────────────────────────
// Meals
// ─────────────────────────────────────────────────────────────────────────────

const STANDARD_MEALS = ["Breakfast", "Lunch", "Dinner"] as const;
const MEAL_KEY_LABELS: Record<string, string> = {
  breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner",
};

export function MealsView({ day }: { day: number }) {
  const { form, updateDay } = useBuilder();
  const itin = form.itineraries.find((it) => it.day === day);
  const roomPricingId = itin?.roomPricingId ?? null;

  // A catalog room's meal plan is ground truth for what's actually served —
  // re-fetched here (not trusted from itin.meals) since that field used to be
  // freely hand-editable and could still be holding a meal this room never
  // actually included. Corrects it in place the moment the drawer opens, so
  // stale hand-added meals from before this fix get fixed too, not just
  // blocked going forward.
  const [roomMeals, setRoomMeals] = useState<string[] | null>(null);
  useEffect(() => {
    if (roomPricingId == null) { setRoomMeals(null); return; }
    let cancelled = false;
    getHotelRoomByIdForBuilder(roomPricingId, null).then((room) => {
      if (cancelled || !room) return;
      setRoomMeals(room.coveredMeals.map((k) => MEAL_KEY_LABELS[k]).filter((v): v is string => !!v));
    });
    return () => { cancelled = true; };
  }, [roomPricingId]);

  useEffect(() => {
    if (roomMeals == null || !itin) return;
    const current = [...itin.meals].sort().join(",");
    const real = [...roomMeals].sort().join(",");
    if (current !== real) updateDay(day, { meals: roomMeals });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomMeals]);

  if (!itin) return null;

  const hasCatalogRoom = roomPricingId != null;

  function toggle(meal: string) {
    if (hasCatalogRoom) return;
    const has = itin!.meals.includes(meal);
    updateDay(day, {
      meals: has ? itin!.meals.filter((m) => m !== meal) : [...itin!.meals, meal],
    });
  }

  const visibleMeals = hasCatalogRoom
    ? STANDARD_MEALS.filter((meal) => itin.meals.includes(meal))
    : STANDARD_MEALS;

  return (
    <div className="p-5 space-y-4">
      <div className="space-y-2">
        {visibleMeals.map((meal) => {
          const on = itin.meals.includes(meal);
          return (
            <button
              key={meal}
              type="button"
              disabled={hasCatalogRoom}
              onClick={() => toggle(meal)}
              className={cn(
                "w-full flex items-center gap-2.5 rounded-xl border p-3 text-left transition-colors",
                on
                  ? "border-dashboard-primary bg-dashboard-primary/5"
                  : "border-dashboard-base-300 hover:bg-dashboard-base-200/50",
                hasCatalogRoom && "cursor-default",
              )}
            >
              <Utensils size={13} className={on ? "text-dashboard-primary" : "text-dashboard-base-content/40"} />
              <span className="text-sm font-medium flex-1">{meal}</span>
              <span className="text-[11px] text-dashboard-base-content/50">{on ? "Included" : "Not included"}</span>
            </button>
          );
        })}
        {hasCatalogRoom && visibleMeals.length === 0 && (
          <p className="py-4 text-center text-[11px] text-dashboard-base-content/50">
            This room&apos;s rate doesn&apos;t include any meals.
          </p>
        )}
      </div>
      <p className="text-[11px] text-dashboard-base-content/45">
        {hasCatalogRoom
          ? "Set by the picked room's meal plan — replace the room (or switch it to a hand-typed stay) to change what's included here."
          : "No catalog room is picked for this day, so meals are set by hand."}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add-ons
// ─────────────────────────────────────────────────────────────────────────────

export function AddonsView({ day }: { day: number | null }) {
  const { form, setForm } = useBuilder();

  // Only the add-ons belonging to this scope. Editing by filtered position
  // would write to the wrong row, so every row keeps its index in the real
  // form.addOns array and mutates through that.
  const rows = form.addOns
    .map((a, index) => ({ a, index }))
    .filter(({ a }) => (a.day ?? null) === day);

  function patch(index: number, next: Partial<AddonInput>) {
    setForm((f) => ({
      ...f,
      addOns: f.addOns.map((a, i) => (i === index ? { ...a, ...next } : a)),
    }));
  }

  function remove(index: number) {
    setForm((f) => ({ ...f, addOns: f.addOns.filter((_, i) => i !== index) }));
  }

  return (
    <div className="p-5 space-y-3">
      {rows.length === 0 && (
        <p className="py-6 text-center text-sm text-dashboard-base-content/50">
          {day == null ? "No add-ons on this package yet." : `Nothing extra on day ${day} yet.`}
        </p>
      )}

      {rows.map(({ a, index }) => (
        <div key={index} className="rounded-xl border border-dashboard-base-300 p-3 space-y-2">
          <div className="flex items-start gap-2">
            <Gift size={13} className="text-dashboard-primary shrink-0 mt-2.5" />
            <Input
              value={a.name}
              onChange={(e) => patch(index, { name: e.target.value })}
              placeholder="e.g. Honeymoon kit, Inner Line Permit…"
              className="h-9 text-sm font-medium"
            />
            <Button
              type="button" size="sm" variant="ghost"
              className="h-9 w-9 p-0 shrink-0 text-dashboard-error hover:text-dashboard-error"
              onClick={() => remove(index)}
              aria-label="Remove add-on"
            >
              <Trash2 size={13} />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 pl-6">
            <label className="space-y-1">
              <span className="text-[11px] text-dashboard-base-content/60">Price (per unit)</span>
              <Input
                type="number" min={0}
                value={a.price ?? ""}
                onChange={(e) => patch(index, { price: e.target.value ? parseFloat(e.target.value) : null })}
                placeholder="0" className="h-9 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-dashboard-base-content/60">Quantity</span>
              <Input
                type="number" min={1}
                value={a.quantity}
                onChange={(e) => patch(index, { quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                className="h-9 text-sm"
              />
            </label>
          </div>
          <div className="pl-6">
            <Input
              value={a.notes}
              onChange={(e) => patch(index, { notes: e.target.value })}
              placeholder="What's included…"
              className="h-9 text-xs"
            />
          </div>
        </div>
      ))}

      <Button
        type="button" variant="outline" className="w-full h-9 text-xs border-dashed"
        onClick={() => setForm((f) => ({ ...f, addOns: [...f.addOns, emptyAddon(day)] }))}
      >
        <Plus size={13} /> Add an add-on
      </Button>

      <p className="text-[11px] text-dashboard-base-content/45 pt-1">
        The client sees the name and what&apos;s included — never the per-unit price.
        Price × quantity feeds the package total at the standard margin.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tickets
// ─────────────────────────────────────────────────────────────────────────────

export function TicketsView({ type }: { type: TicketInput["type"] }) {
  const { form, setForm } = useBuilder();

  // Rows keep their index in the real tickets array — editing by filtered
  // position would write to a leg of a different type.
  const rows = form.tickets
    .map((t, index) => ({ t, index }))
    .filter(({ t }) => t.type === type);
  const label = TICKET_TYPE_LABELS[type];

  function patch(index: number, next: Partial<TicketInput>) {
    setForm((f) => ({
      ...f,
      tickets: f.tickets.map((t, i) => {
        if (i !== index) return t;
        const merged = { ...t, ...next };
        // Journey length is derived, never typed — recompute whenever either
        // time moves, exactly as the right-hand panel's editor does.
        if (next.departureTime !== undefined || next.arrivalTime !== undefined) {
          merged.durationText = computeDurationText(merged.departureTime, merged.arrivalTime);
        }
        return merged;
      }),
    }));
  }

  function remove(index: number) {
    setForm((f) => ({ ...f, tickets: f.tickets.filter((_, i) => i !== index) }));
  }

  return (
    <div className="p-5 space-y-3">
      {rows.length === 0 && (
        <p className="py-6 text-center text-sm text-dashboard-base-content/50">
          No {label.toLowerCase()} legs yet.
        </p>
      )}

      {rows.map(({ t, index: i }) => (
        <div key={i} className="rounded-xl border border-dashboard-base-300 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold flex-1 text-dashboard-base-content/60">
              {t.provider || t.fromPlace || `${label} leg`}
            </span>
            <Button
              type="button" size="sm" variant="ghost"
              className="h-7 w-7 p-0 text-dashboard-error hover:text-dashboard-error"
              onClick={() => remove(i)}
              aria-label="Remove ticket"
            >
              <Trash2 size={13} />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Input value={t.provider} onChange={(e) => patch(i, { provider: e.target.value })}
              placeholder="Airline / operator" className="h-9 text-sm" />
            <Input value={t.ticketNumber} onChange={(e) => patch(i, { ticketNumber: e.target.value })}
              placeholder="PNR / ticket no." className="h-9 text-sm" />
            <Input value={t.fromPlace} onChange={(e) => patch(i, { fromPlace: e.target.value })}
              placeholder="From" className="h-9 text-sm" />
            <Input value={t.toPlace} onChange={(e) => patch(i, { toPlace: e.target.value })}
              placeholder="To" className="h-9 text-sm" />
            <label className="space-y-1">
              <span className="text-[11px] text-dashboard-base-content/60">Travel date</span>
              <Input type="date" value={t.travelDate} onChange={(e) => patch(i, { travelDate: e.target.value })}
                className="h-9 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-dashboard-base-content/60">Tickets</span>
              <Input type="number" min={1} value={t.ticketCount}
                onChange={(e) => patch(i, { ticketCount: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                className="h-9 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-dashboard-base-content/60">Departs</span>
              <Input type="time" value={t.departureTime}
                onChange={(e) => patch(i, { departureTime: e.target.value })} className="h-9 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-dashboard-base-content/60">Arrives</span>
              <Input type="time" value={t.arrivalTime}
                onChange={(e) => patch(i, { arrivalTime: e.target.value })} className="h-9 text-sm" />
            </label>
          </div>

          {/* Nearly every leg carries the whole party, so that's the default and
              the fields stay out of the way until a leg genuinely differs.
              Zeroes are the "not specified" sentinel emptyTicket already
              writes, so "everyone" needs no extra column to represent. */}
          <TicketPax
            ticket={t}
            packagePax={{ adults: form.adults, children: form.children, infants: form.infants }}
            onChange={(next) => patch(i, next)}
          />

          <Input
            value={t.notes}
            onChange={(e) => patch(i, { notes: e.target.value })}
            placeholder="Note for this leg — baggage, terminal, meal preference…"
            className="h-8 text-xs"
          />

          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-dashboard-base-content/50">
              {t.durationText ? `Journey ${t.durationText}` : "Journey length fills in from the times"}
            </span>
            <label className="flex items-center gap-1.5">
              <span className="text-[11px] text-dashboard-base-content/60">Fare</span>
              <Input
                type="number" min={0}
                value={t.fare ?? ""}
                onChange={(e) => patch(i, { fare: e.target.value ? parseFloat(e.target.value) : null })}
                placeholder="0" className="h-8 text-sm w-28"
              />
            </label>
          </div>
        </div>
      ))}

      <Button
        type="button" variant="outline" className="w-full h-9 text-xs border-dashed"
        onClick={() => setForm((f) => ({ ...f, tickets: [...f.tickets, emptyTicket(type)] }))}
      >
        <Plus size={12} /> Add another {label.toLowerCase()} leg
      </Button>

      <p className="text-[11px] text-dashboard-base-content/45 pt-1">
        The client sees the leg and its times; the fare stays internal and is priced
        into the package total.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Day note
//
// A note is optional and absent by default — a day with nothing to say should
// show nothing at all, on the client's copy AND in the builder. That's why
// this is a drawer rather than an always-present inline placeholder: there is
// no note to click until one exists, so the way in has to live in the day menu.
//
// Once a note exists it's also editable inline in the document, through the
// same fields. Both routes write via applyFieldEdit / updateDay.
// ─────────────────────────────────────────────────────────────────────────────

export function NoteView({ day }: { day: number }) {
  const { form, updateDay, closeDrawer } = useBuilder();
  const itin = form.itineraries.find((it) => it.day === day);
  if (!itin) return null;

  const tone = noteTone(itin.notesType);
  const hasNote = !!(itin.notes.trim() || (itin.notesTitle ?? "").trim());

  function clear() {
    updateDay(day, { notes: "", notesTitle: null, notesType: null });
    closeDrawer();
  }

  return (
    <div className="p-5 space-y-4">
      <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-dashboard-base-content/60">Title</label>
        <Input
          value={itin.notesTitle ?? ""}
          onChange={(e) => updateDay(day, { notesTitle: e.target.value || null })}
          placeholder={NOTE_TONES[tone].label}
          className="h-9 text-sm"
        />
        <p className="text-[11px] text-dashboard-base-content/45">
          Left blank, the note is headed &quot;{NOTE_TONES[tone].label}&quot; after its tone.
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-dashboard-base-content/60">Note</label>
        <textarea
          value={itin.notes}
          onChange={(e) => updateDay(day, { notes: e.target.value })}
          placeholder="e.g. Carry photo ID — permits are checked at the Rohtang barrier."
          rows={4}
          className="w-full rounded-md border border-dashboard-base-300 px-3 py-2 text-xs resize-y focus-visible:outline-2 focus-visible:outline-dashboard-primary/40"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-dashboard-base-content/60">Tone</label>
        <div className="grid grid-cols-5 gap-1.5">
          {(Object.keys(NOTE_TONES) as NoteTone[]).map((key) => {
            const opt = NOTE_TONES[key];
            const active = key === tone;
            return (
              <button
                key={key}
                type="button"
                onClick={() => updateDay(day, { notesType: key })}
                aria-pressed={active}
                className={cn(
                  "rounded-lg px-2 py-2 text-[10px] font-semibold transition-transform",
                  active ? "scale-[1.03]" : "opacity-60 hover:opacity-100",
                )}
                style={{
                  backgroundColor: opt.bg,
                  border: `1px solid ${active ? opt.icon : opt.border}`,
                  color: opt.ink,
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {hasNote && (
        <Button
          type="button" variant="ghost"
          className="h-9 text-xs text-dashboard-error hover:text-dashboard-error"
          onClick={clear}
        >
          <Trash2 size={12} /> Remove this note
        </Button>
      )}
    </div>
  );
}

/** Who's on a leg.
 *
 * Almost every leg carries the whole party, so asking for a breakdown per leg
 * is three inputs of pure tax for the common case. This shows the package's
 * travellers as the default and only reveals the fields when someone says this
 * leg differs — the same shape TicketCard reads when rendering.
 */
function TicketPax({ ticket, packagePax, onChange }: {
  ticket: TicketInput;
  packagePax: { adults: number; children: number; infants: number };
  onChange: (next: Partial<TicketInput>) => void;
}) {
  const custom = !!(ticket.adults || ticket.children || ticket.infants);

  const packageLine = [
    packagePax.adults ? `${packagePax.adults} adult${packagePax.adults !== 1 ? "s" : ""}` : null,
    packagePax.children ? `${packagePax.children} child${packagePax.children !== 1 ? "ren" : ""}` : null,
    packagePax.infants ? `${packagePax.infants} infant${packagePax.infants !== 1 ? "s" : ""}` : null,
  ].filter(Boolean).join(", ");

  if (!custom) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md bg-dashboard-base-200/50 px-2.5 py-1.5">
        <span className="text-[11px] text-dashboard-base-content/70">
          All travellers{packageLine ? ` · ${packageLine}` : ""}
        </span>
        <button
          type="button"
          // Seeds from the package so the exec adjusts down from the real
          // party rather than typing it out from zero.
          onClick={() => onChange({ ...packagePax })}
          className="text-[10px] font-medium text-dashboard-primary hover:underline shrink-0"
        >
          Only some
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 rounded-md bg-dashboard-base-200/50 px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-dashboard-base-content/70">Travellers on this leg</span>
        <button
          type="button"
          onClick={() => onChange({ adults: 0, children: 0, infants: 0 })}
          className="text-[10px] font-medium text-dashboard-primary hover:underline shrink-0"
        >
          All travellers
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(["adults", "children", "infants"] as const).map((k) => (
          <label key={k} className="space-y-0.5">
            <span className="text-[10px] text-dashboard-base-content/55 capitalize">{k}</span>
            <Input
              type="number" min={0}
              value={ticket[k]}
              onChange={(e) => onChange({ [k]: Math.max(0, parseInt(e.target.value, 10) || 0) })}
              className="h-8 text-sm"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Destinations (route stops)
//
// The most load-bearing list in the builder despite looking like decoration:
// deriveDayLocations turns these into the default search city for every hotel
// and cab drawer, they set totalDays/totalNights, and they're what the "Places
// You Gonna Visit" strip on the client's document is built from.
// ─────────────────────────────────────────────────────────────────────────────

export function StopsView() {
  const { form, setForm } = useBuilder();

  return (
    <div className="p-5 space-y-4">
      <RouteStopsEditor
        stops={form.stops}
        onChange={(stops) => setForm((f) => ({ ...f, stops, ...recalcFromStops(stops) }))}
        limitReason={stopLimitReason(form.stops.length, form.itineraries.length)}
        dayCount={form.itineraries.length}
      />
      <div className="rounded-lg bg-dashboard-base-200/50 px-3 py-2.5 space-y-1">
        <p className="text-[11px] text-dashboard-base-content/70">
          {form.totalDays} day{form.totalDays !== 1 ? "s" : ""} · {form.totalNights} night
          {form.totalNights !== 1 ? "s" : ""}
        </p>
        <p className="text-[11px] text-dashboard-base-content/45">
          Nights here set the trip length, and each day&apos;s hotel and cab search
          defaults to the stop it falls under — so getting these right saves typing a
          city on every day.
        </p>
      </div>
    </div>
  );
}
