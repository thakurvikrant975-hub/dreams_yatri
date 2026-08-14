"use client";

// Route stops — the destinations this trip visits and how many nights at each.
//
// More load-bearing than it looks: deriveDayLocations turns these into the
// default search city for every hotel and cab drawer, so a wrong stop quietly
// makes every subsequent search wrong rather than visibly failing. Extracted
// from page.tsx unchanged, so the Trip Setup panel and the right-hand panel
// share one copy while the latter is being retired.

import { useState } from "react";
import { Plus, Trash2, MapPin, Pencil, AlertTriangle } from "./builder-icons";
import { Button } from "@/app/(dashboard)/dashboard/(main)/components/ui/button";
import { Input } from "@/app/(dashboard)/dashboard/(main)/components/ui/input";
import { LocationSearchSelect } from "@/app/(dashboard)/dashboard/(main)/components/location/LocationSearchSelect";
import { ROUTE_STOP_TYPES, type LocationValue } from "@/app/(dashboard)/dashboard/(main)/components/location/location.types";
import type { StopInput } from "@/app/(dashboard)/dashboard/(builder)/package-builder/action";

export function RouteStopsEditor({ stops, onChange, limitReason, dayCount }: {
  stops: StopInput[];
  onChange: (v: StopInput[]) => void;
  /** Why another stop can't be added, or undefined when one can. Passed in
   * rather than computed here: this editor is also used by Trip Setup, and
   * only the caller knows how many days the trip currently has. */
  limitReason?: string | null;
  /** The itinerary's actual day count — e.g. after adding a day from the
   * layers rail without touching the route. Passed in for the same reason as
   * limitReason: only the caller knows it. Omit to skip the mismatch check. */
  dayCount?: number;
}) {
  // Per-row toggle: pick from the real locations catalog (default) vs a
  // plain free-text field, for places not in the catalog yet.
  const [manualRows, setManualRows] = useState<Set<number>>(new Set());

  function addStop() {
    onChange([...stops, { name: "", nights: 1 }]);
  }
  function updateStop(idx: number, patch: Partial<StopInput>) {
    onChange(stops.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }
  function removeStop(idx: number) {
    onChange(stops.filter((_, i) => i !== idx));
    setManualRows((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => { if (i < idx) next.add(i); else if (i > idx) next.add(i - 1); });
      return next;
    });
  }
  function toggleManualRow(idx: number) {
    setManualRows((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  const totalNights = stops.reduce((sum, s) => sum + (s.nights || 0), 0);
  const impliedDays = totalNights + 1;
  // A day added straight from the layers rail (or one deleted there) doesn't
  // touch these nights, so the two can silently drift apart — flag it rather
  // than let the route quietly describe a trip shorter or longer than the one
  // actually built.
  const dayMismatch = dayCount != null && stops.length > 0 && impliedDays !== dayCount;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-dashboard-base-content/90 flex items-center gap-1">
          <MapPin size={11} /> Route (Destinations & Nights)
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addStop}
          disabled={!!limitReason}
          title={limitReason ?? undefined}
          className="h-6 px-2 text-[11px] gap-1 border-dashboard-base-300 rounded-md"
        >
          <Plus size={11} /> Add Stop
        </Button>
      </div>

      <div className="space-y-2">
        {stops.map((stop, idx) => {
          const isManual = manualRows.has(idx);
          return (
            <div key={idx} className="rounded-lg border border-dashboard-base-300 bg-dashboard-base-100 p-2.5 space-y-2">
              {/* Destination gets its own full-width row — cramming the
                  nights input and both action buttons in alongside it (the
                  old layout) left the location field too narrow to show
                  more than a few letters of most place names. */}
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-dashboard-primary/10 text-[10.5px] font-bold text-dashboard-primary">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  {isManual ? (
                    <Input
                      value={stop.name}
                      onChange={(e) => updateStop(idx, { name: e.target.value })}
                      placeholder="Type a destination name…"
                      className="text-sm h-9 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
                    />
                  ) : (
                    <LocationSearchSelect
                      value={stop.name ? { id: `stop-${idx}`, name: stop.name, type: "CITY", breadcrumb: stop.name, slug: "" } : null}
                      onChange={(loc: LocationValue | null) => updateStop(idx, { name: loc?.name ?? "" })}
                      types={ROUTE_STOP_TYPES}
                      placeholder="Search a location…"
                      hideTypeBadge
                    />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => toggleManualRow(idx)}
                  title={isManual ? "Choose from locations" : "Can't find it? Type it instead"}
                  className="p-1.5 rounded-md hover:bg-dashboard-base-300 text-dashboard-base-content/50 hover:text-dashboard-base-content transition-colors shrink-0"
                >
                  {isManual ? <MapPin size={13} /> : <Pencil size={13} />}
                </button>
                <button
                  type="button"
                  onClick={() => removeStop(idx)}
                  title="Remove this stop"
                  className="p-1.5 rounded-md hover:bg-dashboard-error/10 text-dashboard-error/70 hover:text-dashboard-error transition-colors shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              <div className="flex items-center gap-2 pl-7">
                <span className="text-[10.5px] font-semibold uppercase tracking-wide text-dashboard-base-content/45">
                  Nights
                </span>
                <Input
                  type="number" min={0}
                  value={stop.nights}
                  onChange={(e) => updateStop(idx, { nights: +e.target.value })}
                  className="text-sm h-7 w-16 text-center border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
                />
              </div>
            </div>
          );
        })}
        {stops.length === 0 && (
          <p className="text-xs text-dashboard-base-content/40 italic">
            No stops added — Duration & Destination(s) below stay manually editable.
          </p>
        )}
      </div>

      {stops.length > 0 && (
        <p className="text-[11px] text-dashboard-base-content/50 mt-1.5">
          Auto duration: <span className="font-semibold text-dashboard-base-content">{impliedDays}D / {totalNights}N</span> — syncs Duration & Destination(s) below
        </p>
      )}

      {dayMismatch && (
        <p className="flex items-start gap-1.5 text-[11px] text-dashboard-warning bg-dashboard-warning/10 border border-dashboard-warning/25 rounded-md px-2 py-1.5 mt-1.5">
          <AlertTriangle size={12} className="shrink-0 mt-0.5" />
          <span>
            Nights add up to {impliedDays}D / {totalNights}N, but this trip has {dayCount} day{dayCount !== 1 ? "s" : ""}.
            Adjust the nights above so they match.
          </span>
        </p>
      )}
    </div>
  );
}
