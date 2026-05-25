"use client";

import { useState, useTransition } from "react";
import {
  Plus, Pencil, Car, IndianRupee,
  CalendarDays, Trash2, AlertTriangle,
  Info, Check, Loader2, X,
} from "lucide-react";
import { Button }  from "../../components/ui/button";
import { Input }   from "../../components/ui/input";
import { Label }   from "../../components/ui/label";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "../../components/ui/sheet";
import { toast }   from "sonner";
import { cn }      from "@/app/lib/utils";

import { LocationSearchSelect } from "../../components/location/LocationSearchSelect";
import type { LocationValue }   from "../../components/location/location.types";
import {
  PricingRangeCalendarPicker,
  type DateRange,
  type SeasonRange,
} from "../../components/ui/pricing-range-calendar";

import {
  upsertCabPricingForDestination,
  upsertCabPricingForCity,
  type CabPricingGroup,
  type CabPricingType,
  type SeasonInput,
  type VehicleEntryInput,
} from "./actions";

// ── Local types ───────────────────────────────────────────────────────────

type Vehicle = { id: number; name: string; type: string };

type PriceEntry = {
  vehicle_id:   number;
  pricing_type: CabPricingType;
  price:        string;
};

type SeasonEntry = {
  tempId:          string;
  pricing_type:    CabPricingType;
  valid_from:      string;
  valid_to:        string;
  weekday_price:   string;
  weekend_enabled: boolean;
  weekend_price:   string;
};

// ── Helpers ───────────────────────────────────────────────────────────────

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  HATCHBACK: "Hatchback", SEDAN: "Sedan", SUV: "SUV",
  LUXURY_SEDAN: "Luxury Sedan", LUXURY_SUV: "Luxury SUV",
  TEMPO_TRAVELLER: "Tempo Traveller", MINI_BUS: "Mini Bus",
  BUS: "Bus", Rikshaw: "Rickshaw",
};

function uid() { return Math.random().toString(36).slice(2); }

function overlappingSeasonIds(seasons: SeasonEntry[]): Set<string> {
  const withDates = seasons.filter((s) => s.valid_from && s.valid_to);
  const bad = new Set<string>();
  for (let i = 0; i < withDates.length; i++) {
    for (let j = i + 1; j < withDates.length; j++) {
      const a = withDates[i], b = withDates[j];
      if (a.valid_from <= b.valid_to && b.valid_from <= a.valid_to) {
        bad.add(a.tempId);
        bad.add(b.tempId);
      }
    }
  }
  return bad;
}

function buildPayload(entries: PriceEntry[], vehicleSeasons: Record<string, SeasonEntry[]>): VehicleEntryInput[] {
  return entries
    .filter((e) => e.price !== "")
    .map((e) => ({
      vehicleId:   e.vehicle_id,
      pricingType: e.pricing_type,
      price:       Number(e.price),
      costPrice:   null,
      seasons:     (vehicleSeasons[String(e.vehicle_id)] ?? [])
        .filter((s) => s.valid_from && s.valid_to && s.weekday_price)
        .map<SeasonInput>((s) => ({
          pricingType:  s.pricing_type,
          validFrom:    s.valid_from,
          validTo:      s.valid_to,
          weekdayPrice: Number(s.weekday_price),
          weekdayCost:  null,
          weekendPrice: s.weekend_enabled && s.weekend_price ? Number(s.weekend_price) : null,
          weekendCost:  null,
        })),
    }));
}

// ── /day | /km toggle ─────────────────────────────────────────────────────

function PricingTypeToggle({ value, onChange }: { value: CabPricingType; onChange: (v: CabPricingType) => void }) {
  return (
    <div className="flex rounded-md border overflow-hidden h-7 text-xs font-medium shrink-0">
      {(["PER_DAY", "PER_KM"] as CabPricingType[]).map((t, i) => (
        <button
          key={t} type="button" onClick={() => onChange(t)}
          className={cn(
            "px-2.5 transition-colors", i > 0 && "border-l",
            value === t ? "bg-dashboard-primary text-white" : "bg-background text-muted-foreground hover:bg-muted",
          )}
        >
          {t === "PER_DAY" ? "/day" : "/km"}
        </button>
      ))}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────

function SectionHeader({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-sm">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

// ── Base Rates section ────────────────────────────────────────────────────

function BaseRatesSection({
  vehicles,
  entries,
  onChange,
  onToggleVehicle,
}: {
  vehicles: Vehicle[];
  entries: PriceEntry[];
  onChange: (entries: PriceEntry[]) => void;
  onToggleVehicle: (vehicle: Vehicle) => void;
}) {
  const [search, setSearch] = useState("");

  const selectedIds = new Set(entries.map((e) => e.vehicle_id));

  const filtered = search.trim()
    ? vehicles.filter((v) => {
        const q = search.toLowerCase();
        return (
          v.name.toLowerCase().includes(q) ||
          (VEHICLE_TYPE_LABELS[v.type] ?? v.type).toLowerCase().includes(q)
        );
      })
    : vehicles;

  function update<K extends keyof PriceEntry>(vehicleId: number, field: K, value: PriceEntry[K]) {
    onChange(entries.map((e) => (e.vehicle_id === vehicleId ? { ...e, [field]: value } : e)));
  }

  if (!vehicles.length) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
        <Info className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
        <p className="text-xs text-amber-700">
          No active vehicles. Add them in <strong>Vehicle Types</strong> first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Info */}
      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-600" />
        <p className="text-xs text-blue-700">
          Default rates used when no season is active for the travel date.
        </p>
      </div>

      {/* Vehicle search & picker */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Select Vehicles
          </Label>
          {selectedIds.size > 0 && (
            <span className="text-[11px] text-muted-foreground">
              {selectedIds.size} of {vehicles.length} selected
            </span>
          )}
        </div>

        <Input
          placeholder="Search by name or type…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm"
        />

        {filtered.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 p-3 border rounded-xl bg-muted/20 max-h-44 overflow-y-auto">
            {filtered.map((v) => {
              const selected = selectedIds.has(v.id);
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onToggleVehicle(v)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all",
                    selected
                      ? "bg-green-100 border-green-400 text-green-800 dark:bg-green-900/40 dark:border-green-600 dark:text-green-300"
                      : "bg-background border-border text-muted-foreground hover:border-dashboard-primary/60 hover:text-foreground",
                  )}
                >
                  {selected && <Check className="h-3 w-3 shrink-0" />}
                  <span>{v.name}</span>
                  <span className="opacity-50">·</span>
                  <span className="opacity-60">{VEHICLE_TYPE_LABELS[v.type] ?? v.type}</span>
                </button>
              );
            })}
          </div>
        ) : search ? (
          <p className="text-xs text-center text-muted-foreground py-3 border rounded-xl">
            No vehicles match &ldquo;{search}&rdquo;
          </p>
        ) : null}
      </div>

      {/* Selected vehicles — price inputs */}
      {entries.length > 0 ? (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_80px_144px_28px] gap-2 px-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Vehicle ({entries.length})
            </p>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Type</p>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Price (₹) *</p>
            <span />
          </div>

          {entries.map((entry) => {
            const vehicle = vehicles.find((v) => v.id === entry.vehicle_id);
            if (!vehicle) return null;

            const priceVal    = entry.price ?? "";
            const pricingType = (entry.pricing_type ?? "PER_DAY") as CabPricingType;
            const unit        = pricingType === "PER_DAY" ? "/day" : "/km";
            const isInvalid   = priceVal !== "" && (isNaN(Number(priceVal)) || Number(priceVal) <= 0);

            return (
              <div
                key={vehicle.id}
                className="grid grid-cols-[1fr_80px_144px_28px] gap-2 items-center rounded-lg border bg-muted/20 px-3 py-2.5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Car className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate leading-tight">{vehicle.name}</p>
                    <span className="text-[10px] text-muted-foreground">
                      {VEHICLE_TYPE_LABELS[vehicle.type] ?? vehicle.type}
                    </span>
                  </div>
                </div>

                <PricingTypeToggle
                  value={pricingType}
                  onChange={(v) => update(vehicle.id, "pricing_type", v)}
                />

                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">₹</span>
                  <Input
                    type="number" min={0} step={pricingType === "PER_KM" ? 1 : 100}
                    placeholder="0" value={priceVal}
                    onChange={(e) => update(vehicle.id, "price", e.target.value)}
                    className={cn("h-8 pl-6 pr-9 text-sm", isInvalid && "border-destructive")}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
                    {unit}
                  </span>
                </div>

                {/* Quick-deselect */}
                <button
                  type="button"
                  onClick={() => onToggleVehicle(vehicle)}
                  className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Remove vehicle"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-xl">
          Search and click vehicles above to configure their base rates
        </p>
      )}
    </div>
  );
}

// ── Date helpers (year-agnostic: all seasons stored as 2000-MM-DD) ────────

function toDateObj(str: string): Date | undefined {
  if (!str) return undefined;
  const normalized = "2000" + str.slice(4);
  const d = new Date(normalized + "T00:00:00");
  return isNaN(d.getTime()) ? undefined : d;
}

function fromDateObj(d: Date | undefined): string {
  if (!d) return "";
  const m   = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `2000-${m}-${day}`;
}

function fmtMonthDay(dateStr: string): string {
  const d = toDateObj(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ── Calendar Rates section ────────────────────────────────────────────────

function CalendarRatesSection({
  vehicles,
  entries,
  vehicleSeasons,
  onChange,
}: {
  vehicles: Vehicle[];
  entries: PriceEntry[];
  vehicleSeasons: Record<string, SeasonEntry[]>;
  onChange: (seasons: Record<string, SeasonEntry[]>) => void;
}) {
  // Only show vehicles that the user has selected in Base Rates
  const selectedVehicles = vehicles.filter((v) => entries.some((e) => e.vehicle_id === v.id));

  const [_activeId, setActiveVehicleId] = useState<number | null>(null);

  // If the explicitly chosen tab was deselected, fall back to first available
  const activeVehicleId =
    selectedVehicles.some((v) => v.id === _activeId)
      ? _activeId
      : selectedVehicles[0]?.id ?? null;

  function getSeasons(vehicleId: number): SeasonEntry[] {
    return vehicleSeasons[String(vehicleId)] ?? [];
  }

  function setSeasons(vehicleId: number, seasons: SeasonEntry[]) {
    onChange({ ...vehicleSeasons, [String(vehicleId)]: seasons });
  }

  function addSeason(vehicleId: number) {
    const base = entries.find((e) => e.vehicle_id === vehicleId);
    setSeasons(vehicleId, [
      ...getSeasons(vehicleId),
      {
        tempId:          uid(),
        pricing_type:    (base?.pricing_type ?? "PER_DAY") as CabPricingType,
        valid_from:      "",
        valid_to:        "",
        weekday_price:   "",
        weekend_enabled: false,
        weekend_price:   "",
      },
    ]);
  }

  function updateSeason(vehicleId: number, tempId: string, patch: Partial<SeasonEntry>) {
    setSeasons(vehicleId, getSeasons(vehicleId).map((s) =>
      s.tempId === tempId ? { ...s, ...patch } : s,
    ));
  }

  function removeSeason(vehicleId: number, tempId: string) {
    setSeasons(vehicleId, getSeasons(vehicleId).filter((s) => s.tempId !== tempId));
  }

  function handleRangeChange(vehicleId: number, tempId: string, range: DateRange | undefined) {
    updateSeason(vehicleId, tempId, {
      valid_from: fromDateObj(range?.from),
      valid_to:   fromDateObj(range?.to),
    });
  }

  const totalSeasons = Object.values(vehicleSeasons).reduce((s, arr) => s + arr.length, 0);

  if (!selectedVehicles.length) {
    return (
      <p className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-xl">
        Select vehicles in Base Rates above to configure seasonal pricing
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-600" />
        <p className="text-xs text-blue-700">
          Click a start date then an end date on the calendar to set the season range.
          {totalSeasons > 0 && (
            <span className="font-semibold"> {totalSeasons} season{totalSeasons !== 1 ? "s" : ""} configured.</span>
          )}
        </p>
      </div>

      {/* Vehicle tabs — only selected vehicles */}
      <div className="flex flex-wrap gap-1.5">
        {selectedVehicles.map((v) => {
          const count       = getSeasons(v.id).length;
          const hasConflict = overlappingSeasonIds(getSeasons(v.id)).size > 0;
          const isActive    = activeVehicleId === v.id;
          return (
            <button
              key={v.id} type="button"
              onClick={() => setActiveVehicleId(v.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                hasConflict
                  ? "border-destructive/50 bg-destructive/5 text-destructive"
                  : isActive
                  ? "border-dashboard-primary/50 bg-dashboard-primary/10 text-dashboard-primary"
                  : "border-dashboard-base-300 bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {hasConflict && <AlertTriangle className="h-3 w-3" />}
              {v.name}
              {count > 0 && (
                <span className={cn(
                  "inline-flex items-center justify-center h-4 min-w-4 px-1 text-[10px] font-semibold rounded-full",
                  hasConflict ? "bg-destructive text-white" : "bg-dashboard-primary text-white",
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Season cards for active vehicle */}
      {activeVehicleId !== null && (() => {
        const vehicle    = selectedVehicles.find((v) => v.id === activeVehicleId)!;
        const seasons    = getSeasons(activeVehicleId);
        const base       = entries.find((e) => e.vehicle_id === activeVehicleId);
        const overlapSet = overlappingSeasonIds(seasons);

        return (
          <div className="space-y-3">
            {seasons.length === 0 && (
              <p className="text-xs text-muted-foreground py-3 text-center">
                No seasons for <strong>{vehicle.name}</strong> yet.
              </p>
            )}

            {seasons.map((s) => {
              const unit       = s.pricing_type === "PER_DAY" ? "/day" : "/km";
              const hasOverlap = overlapSet.has(s.tempId);
              const rangeValue: DateRange = {
                from: toDateObj(s.valid_from),
                to:   toDateObj(s.valid_to),
              };

              const calendarSeasons: SeasonRange[] = seasons
                .filter((x) => x.valid_from && x.valid_to && x.weekday_price)
                .map((x) => ({
                  from:           x.valid_from.slice(5),
                  to:             x.valid_to.slice(5),
                  weekdayPrice:   Number(x.weekday_price),
                  weekendPrice:   x.weekend_enabled && x.weekend_price ? Number(x.weekend_price) : null,
                  weekendEnabled: x.weekend_enabled,
                }));

              const rangeLabel = s.valid_from && s.valid_to
                ? `${fmtMonthDay(s.valid_from)} → ${fmtMonthDay(s.valid_to)}`
                : s.valid_from
                ? `From ${fmtMonthDay(s.valid_from)}`
                : "No dates selected";

              return (
                <div
                  key={s.tempId}
                  className={cn(
                    "rounded-xl border p-4 space-y-3",
                    hasOverlap ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/10",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className={cn(
                        "text-xs font-medium truncate",
                        s.valid_from ? "text-foreground" : "text-muted-foreground",
                      )}>
                        {rangeLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <PricingTypeToggle
                        value={s.pricing_type}
                        onChange={(v) => updateSeason(activeVehicleId, s.tempId, { pricing_type: v })}
                      />
                      <button
                        type="button"
                        onClick={() => removeSeason(activeVehicleId, s.tempId)}
                        className="text-destructive/60 hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {hasOverlap && (
                    <div className="flex items-center gap-1.5 text-[11px] text-destructive font-medium">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      Date range overlaps with another season — fix before saving.
                    </div>
                  )}

                  <div className="flex items-end gap-3">
                    {/* Weekday rate */}
                    <div className="flex-1 space-y-1">
                      <Label className="text-[11px] text-muted-foreground">
                        Weekday Rate *
                        {base?.price && (
                          <span className="ml-1.5 text-muted-foreground/60">
                            (base ₹{base.price}{base.pricing_type === "PER_KM" ? "/km" : "/day"})
                          </span>
                        )}
                      </Label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">₹</span>
                        <Input
                          type="number" min={0} step={s.pricing_type === "PER_KM" ? 1 : 100}
                          placeholder={base?.price || "0"}
                          value={s.weekday_price}
                          onChange={(e) => updateSeason(activeVehicleId, s.tempId, { weekday_price: e.target.value })}
                          className="h-8 pl-6 pr-9 text-sm"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">{unit}</span>
                      </div>
                    </div>

                    {/* Weekend toggle + rate */}
                    <div className="flex-1 space-y-1">
                      <button
                        type="button"
                        onClick={() => updateSeason(activeVehicleId, s.tempId, {
                          weekend_enabled: !s.weekend_enabled,
                          weekend_price: "",
                        })}
                        className="flex items-center gap-1.5 group"
                      >
                        <div className={cn(
                          "h-3.5 w-3.5 rounded border-2 flex items-center justify-center transition-colors shrink-0",
                          s.weekend_enabled
                            ? "border-dashboard-primary bg-dashboard-primary"
                            : "border-muted-foreground/40 group-hover:border-dashboard-primary",
                        )}>
                          {s.weekend_enabled && (
                            <svg className="h-2 w-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className="text-[11px] font-medium text-muted-foreground">Weekend rate</span>
                      </button>

                      {s.weekend_enabled ? (
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">₹</span>
                          <Input
                            type="number" min={0} step={s.pricing_type === "PER_KM" ? 1 : 100}
                            placeholder={s.weekday_price || "0"}
                            value={s.weekend_price}
                            onChange={(e) => updateSeason(activeVehicleId, s.tempId, { weekend_price: e.target.value })}
                            className="h-8 pl-6 pr-9 text-sm"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">{unit}</span>
                        </div>
                      ) : (
                        <div className="h-8 rounded-md border border-dashed bg-muted/20 flex items-center px-3">
                          <span className="text-[11px] text-muted-foreground/50">Same as weekday</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <PricingRangeCalendarPicker
                    value={rangeValue}
                    onChange={(range) => handleRangeChange(activeVehicleId, s.tempId, range)}
                    seasons={calendarSeasons}
                    basePrice={base?.price ? Number(base.price) : 0}
                    placeholder="Select season date range"
                    error={hasOverlap}
                  />
                </div>
              );
            })}

            <Button
              type="button" variant="outline" size="sm"
              className="w-full h-8 text-xs gap-1.5 border-dashed mt-1"
              onClick={() => addSeason(activeVehicleId)}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Season for {vehicle.name}
            </Button>
          </div>
        );
      })()}
    </div>
  );
}

// ── Shared form validation ────────────────────────────────────────────────

function validateForm(
  cityOrLocked: LocationValue | null | string,
  entries: PriceEntry[],
  vehicleSeasons: Record<string, SeasonEntry[]>,
): string | null {
  if (!cityOrLocked) return "Please select a city";
  if (!entries.length) return "Please select at least one vehicle to configure pricing";
  for (const e of entries) {
    const p = Number(e.price);
    if (!e.price || isNaN(p) || p <= 0) return "All selected vehicles must have a base price greater than ₹0";
  }
  for (const [, seasons] of Object.entries(vehicleSeasons)) {
    for (const s of seasons) {
      if (!s.valid_from) return "Each season needs a start date";
      if (!s.valid_to)   return "Each season needs an end date";
      if (s.valid_from > s.valid_to) return "Start date must be before end date";
      if (!s.weekday_price || Number(s.weekday_price) <= 0)
        return "Each season needs a weekday price greater than ₹0";
      if (s.weekend_enabled && (!s.weekend_price || Number(s.weekend_price) <= 0))
        return "Weekend price must be greater than ₹0 when enabled";
    }
    if (overlappingSeasonIds(seasons).size > 0)
      return "Some seasons have overlapping date ranges — fix before saving";
  }
  return null;
}

// ── Create Sheet ──────────────────────────────────────────────────────────

export function CreateCabPricingSheet({ vehicles }: { vehicles: Vehicle[] }) {
  const [open,      setOpen]         = useState(false);
  const [sheetKey,  setSheetKey]     = useState(0);
  const [isPending, startTransition] = useTransition();

  const [cityValue,      setCityValue]      = useState<LocationValue | null>(null);
  const [entries,        setEntries]        = useState<PriceEntry[]>([]);
  const [vehicleSeasons, setVehicleSeasons] = useState<Record<string, SeasonEntry[]>>({});
  const [formError,      setFormError]      = useState<string | null>(null);

  function handleToggleVehicle(vehicle: Vehicle) {
    const isSelected = entries.some((e) => e.vehicle_id === vehicle.id);
    if (isSelected) {
      setEntries((prev) => prev.filter((e) => e.vehicle_id !== vehicle.id));
      setVehicleSeasons((prev) => {
        const next = { ...prev };
        delete next[String(vehicle.id)];
        return next;
      });
    } else {
      setEntries((prev) => [
        ...prev,
        { vehicle_id: vehicle.id, pricing_type: "PER_DAY" as CabPricingType, price: "" },
      ]);
    }
    setFormError(null);
  }

  function reset() {
    setCityValue(null);
    setEntries([]);
    setVehicleSeasons({});
    setFormError(null);
    setSheetKey((k) => k + 1);
  }

  function handleSubmit() {
    const error = validateForm(cityValue, entries, vehicleSeasons);
    if (error) { setFormError(error); return; }
    setFormError(null);

    const payload = buildPayload(entries, vehicleSeasons);
    startTransition(async () => {
      const result = await upsertCabPricingForCity(cityValue!.id, cityValue!.name, payload);
      if (result.success) {
        toast.success(result.message);
        reset();
        setOpen(false);
      } else {
        setFormError(result.message);
        toast.error(result.message);
      }
    });
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)} size="lg"
        className="rounded-md bg-dashboard-primary text-dashboard-base-100 py-2.5 px-4 hover:bg-dashboard-primary hover:scale-105 duration-300 hover:text-dashboard-base-100 border border-dashboard-primary"
      >
        <Plus className="mr-2 h-4 w-4" /> Add Pricing
      </Button>

      <Sheet key={sheetKey} open={open} onOpenChange={(o) => { if (!o) reset(); setOpen(o); }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col gap-0 p-0">

          <SheetHeader className="px-5 pt-5 pb-4 border-b shrink-0">
            <SheetTitle className="text-base">Add Cab Pricing</SheetTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Set vehicle rates and seasonal pricing for a city</p>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

            {/* City */}
            <div>
              <SectionHeader
                icon={<Car className="h-4 w-4" />}
                title="City"
                description="Select the city to configure cab pricing for"
              />
              <div className="space-y-1.5">
                <Label>City <span className="text-destructive">*</span></Label>
                <LocationSearchSelect
                  value={cityValue}
                  onChange={(v) => { setCityValue(v); setFormError(null); }}
                  types={["CITY"]}
                  placeholder="Search city…"
                  extraParams={{ destinationsOnly: "true", excludePricedCabs: "true" }}
                  disableExternalSearch
                />
              </div>
            </div>

            <div className="border-t" />

            {/* Base Rates */}
            <div>
              <SectionHeader
                icon={<IndianRupee className="h-4 w-4" />}
                title="Base Rates"
                description="Search and select vehicles, then set their default rates"
              />
              <BaseRatesSection
                vehicles={vehicles}
                entries={entries}
                onChange={setEntries}
                onToggleVehicle={handleToggleVehicle}
              />
            </div>

            <div className="border-t" />

            {/* Calendar Rates */}
            <div>
              <SectionHeader
                icon={<CalendarDays className="h-4 w-4" />}
                title="Calendar Rates"
                description="Add seasonal pricing with weekend overrides (optional)"
              />
              <CalendarRatesSection
                vehicles={vehicles}
                entries={entries}
                vehicleSeasons={vehicleSeasons}
                onChange={setVehicleSeasons}
              />
            </div>

          </div>

          <div className="px-5 py-4 border-t bg-muted/30 shrink-0 space-y-3">
            {formError && (
              <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg px-3 py-2.5 text-sm">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{formError}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isPending} className="gap-2 min-w-28">
                {isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
                ) : (
                  <><Check className="h-4 w-4" />Save Pricing</>
                )}
              </Button>
            </div>
          </div>

        </SheetContent>
      </Sheet>
    </>
  );
}

// ── Edit Sheet ────────────────────────────────────────────────────────────

export function EditCabPricingSheet({ row, vehicles }: { row: CabPricingGroup; vehicles: Vehicle[] }) {
  const [open,      setOpen]         = useState(false);
  const [sheetKey,  setSheetKey]     = useState(0);
  const [isPending, startTransition] = useTransition();

  const [formError, setFormError] = useState<string | null>(null);

  function buildInitialEntries(): PriceEntry[] {
    // Only include vehicles that actually have existing pricing data
    return row.pricings
      .filter((p) => vehicles.some((v) => v.id === p.vehicle_id))
      .map((p) => ({
        vehicle_id:   p.vehicle_id,
        pricing_type: p.pricing_type as CabPricingType,
        price:        String(p.price),
      }));
  }

  function buildInitialSeasons(): Record<string, SeasonEntry[]> {
    const toYear2000 = (d: string) => (d ? "2000" + d.slice(4) : "");
    const map: Record<string, SeasonEntry[]> = {};
    for (const p of row.pricings) {
      if (p.seasons.length > 0) {
        map[String(p.vehicle_id)] = p.seasons.map((s) => ({
          tempId:          uid(),
          pricing_type:    s.pricing_type,
          valid_from:      toYear2000(s.valid_from),
          valid_to:        toYear2000(s.valid_to),
          weekday_price:   String(s.weekday_price),
          weekend_enabled: s.weekend_price != null,
          weekend_price:   s.weekend_price != null ? String(s.weekend_price) : "",
        }));
      }
    }
    return map;
  }

  const [entries,        setEntries]        = useState<PriceEntry[]>(() => buildInitialEntries());
  const [vehicleSeasons, setVehicleSeasons] = useState<Record<string, SeasonEntry[]>>(() => buildInitialSeasons());

  function handleToggleVehicle(vehicle: Vehicle) {
    const isSelected = entries.some((e) => e.vehicle_id === vehicle.id);
    if (isSelected) {
      setEntries((prev) => prev.filter((e) => e.vehicle_id !== vehicle.id));
      setVehicleSeasons((prev) => {
        const next = { ...prev };
        delete next[String(vehicle.id)];
        return next;
      });
    } else {
      setEntries((prev) => [
        ...prev,
        { vehicle_id: vehicle.id, pricing_type: "PER_DAY" as CabPricingType, price: "" },
      ]);
    }
    setFormError(null);
  }

  function handleSubmit() {
    const error = validateForm(row.destination_name, entries, vehicleSeasons);
    if (error) { setFormError(error); return; }
    setFormError(null);

    const payload = buildPayload(entries, vehicleSeasons);
    startTransition(async () => {
      const result = await upsertCabPricingForDestination(row.destination_id, payload);
      if (result.success) {
        toast.success(result.message);
        setOpen(false);
      } else {
        setFormError(result.message);
        toast.error(result.message);
      }
    });
  }

  return (
    <>
      <Button
        variant="ghost" size="icon" className="h-8 w-8"
        onClick={() => {
          setSheetKey((k) => k + 1);
          setEntries(buildInitialEntries());
          setVehicleSeasons(buildInitialSeasons());
          setFormError(null);
          setOpen(true);
        }}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>

      <Sheet key={sheetKey} open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col gap-0 p-0">

          <SheetHeader className="px-5 pt-5 pb-4 border-b shrink-0">
            <SheetTitle className="text-base">Edit Cab Pricing</SheetTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Editing pricing for: {row.destination_name}</p>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

            {/* Locked city */}
            <div>
              <SectionHeader
                icon={<Car className="h-4 w-4" />}
                title="City"
                description="City for which pricing is configured"
              />
              <div className="space-y-1.5">
                <Label>City</Label>
                <div className="h-10 rounded-md border bg-muted px-3 flex items-center text-sm text-muted-foreground cursor-not-allowed">
                  {row.destination_name}
                </div>
                <p className="text-xs text-muted-foreground">Delete and recreate to change the city.</p>
              </div>
            </div>

            <div className="border-t" />

            {/* Base Rates */}
            <div>
              <SectionHeader
                icon={<IndianRupee className="h-4 w-4" />}
                title="Base Rates"
                description="Search and select vehicles, then set their default rates"
              />
              <BaseRatesSection
                vehicles={vehicles}
                entries={entries}
                onChange={setEntries}
                onToggleVehicle={handleToggleVehicle}
              />
            </div>

            <div className="border-t" />

            {/* Calendar Rates */}
            <div>
              <SectionHeader
                icon={<CalendarDays className="h-4 w-4" />}
                title="Calendar Rates"
                description="Add seasonal pricing with weekend overrides (optional)"
              />
              <CalendarRatesSection
                vehicles={vehicles}
                entries={entries}
                vehicleSeasons={vehicleSeasons}
                onChange={setVehicleSeasons}
              />
            </div>
          </div>

          <div className="px-5 py-4 border-t bg-muted/30 shrink-0 space-y-3">
            {formError && (
              <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg px-3 py-2.5 text-sm">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{formError}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isPending} className="gap-2 min-w-28">
                {isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
                ) : (
                  <><Check className="h-4 w-4" />Save Changes</>
                )}
              </Button>
            </div>
          </div>

        </SheetContent>
      </Sheet>
    </>
  );
}
