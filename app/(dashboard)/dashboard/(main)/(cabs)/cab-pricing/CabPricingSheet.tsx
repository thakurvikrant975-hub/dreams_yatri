"use client";

import { useState, useTransition, useEffect } from "react";
import {
  Plus, Pencil, Car, IndianRupee, Info,
  CalendarDays, Trash2, AlertTriangle,
} from "lucide-react";
import { Button }  from "../../components/ui/button";
import { Input }   from "../../components/ui/input";
import { Label }   from "../../components/ui/label";
import { toast }   from "sonner";
import { cn }      from "@/app/lib/utils";

import {
  MultiStepSheet,
  useMultiStepSheet,
  type SheetStep,
} from "../../components/dashboard/MultiStepSheet";

import { SearchSelect } from "../../components/dashboard/SearchSelect";
import {
  searchDestinations,
  upsertCabPricingForDestination,
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
  cost_price:   string;
};

type SeasonEntry = {
  tempId:          string;
  pricing_type:    CabPricingType;
  valid_from:      string;
  valid_to:        string;
  weekday_price:   string;
  weekday_cost:    string;
  weekend_enabled: boolean;
  weekend_price:   string;
  weekend_cost:    string;
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

// ── Step definitions ──────────────────────────────────────────────────────

function buildSteps(isEdit: boolean): SheetStep[] {
  return [
    {
      id: "destination", title: "Destination",
      description: "Select the destination to configure pricing for",
      icon: <Car className="h-4 w-4" />,
      validate: (data) => data.destination_id ? null : "Please select a destination",
    },
    {
      id: "pricing", title: "Base Rates",
      description: "Set default price for each vehicle type",
      icon: <IndianRupee className="h-4 w-4" />,
      validate: (data) => {
        const entries = (data.entries as PriceEntry[]) ?? [];
        if (!entries.length) return "No active vehicles — add vehicles first";
        for (const e of entries) {
          const p = Number(e.price);
          if (!e.price || isNaN(p) || p <= 0) return "All base prices must be greater than ₹0";
        }
        return null;
      },
    },
    {
      id: "seasons", title: "Calendar Rates",
      description: "Add seasonal pricing with weekend overrides (optional)",
      icon: <CalendarDays className="h-4 w-4" />,
      optional: true,
      validate: (data) => {
        const map = (data.vehicle_seasons as Record<string, SeasonEntry[]>) ?? {};
        for (const seasons of Object.values(map)) {
          for (const s of seasons) {
            if (!s.valid_from) return "Each season needs a start date";
            if (!s.valid_to)   return "Each season needs an end date";
            if (s.valid_from > s.valid_to) return "Start date must be before end date";
            if (!s.weekday_price || Number(s.weekday_price) <= 0)
              return "Each season needs a weekday price greater than ₹0";
            if (s.weekend_enabled) {
              if (!s.weekend_price || Number(s.weekend_price) <= 0)
                return "Weekend price must be greater than ₹0 when enabled";
            }
          }
          if (overlappingSeasonIds(seasons).size > 0)
            return "Some seasons have overlapping date ranges — fix before saving";
        }
        return null;
      },
    },
  ];
}

// ── Step 1: Destination ───────────────────────────────────────────────────

function DestinationStep({ isEdit, lockedName, forCreate }: {
  isEdit: boolean; lockedName?: string; forCreate: boolean;
}) {
  const { stepData, setStepData } = useMultiStepSheet();
  const data          = stepData["destination"] ?? {};
  const destinationId = (data.destination_id as number | null) ?? null;

  if (isEdit) {
    return (
      <div className="space-y-1.5">
        <Label>Destination</Label>
        <div className="h-10 rounded-md border bg-muted px-3 flex items-center text-sm text-muted-foreground cursor-not-allowed">
          {lockedName}
        </div>
        <p className="text-xs text-muted-foreground">Delete and recreate to change destination.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label>Destination <span className="text-destructive">*</span></Label>
      <SearchSelect
        value={destinationId}
        onChange={(id) => setStepData("destination", { ...data, destination_id: id })}
        fetchOptions={(q) => searchDestinations(q, forCreate)}
        placeholder="Search destination…"
        initialLabel={(data._destinationLabel as string) ?? ""}
      />
      {forCreate && (
        <p className="text-xs text-muted-foreground">
          Only destinations without existing pricing are shown.
        </p>
      )}
    </div>
  );
}

// ── Step 2: Base Rates ────────────────────────────────────────────────────

function BaseRatesStep({ vehicles }: { vehicles: Vehicle[] }) {
  const { stepData, setStepData } = useMultiStepSheet();
  const data    = stepData["pricing"] ?? {};
  const entries = (data.entries as PriceEntry[]) ?? [];

  useEffect(() => {
    if (!entries.length && vehicles.length) {
      setStepData("pricing", {
        ...data,
        entries: vehicles.map((v) => ({
          vehicle_id: v.id, pricing_type: "PER_DAY" as CabPricingType, price: "", cost_price: "",
        })),
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicles]);

  function update<K extends keyof PriceEntry>(vehicleId: number, field: K, value: PriceEntry[K]) {
    setStepData("pricing", {
      ...data,
      entries: entries.map((e) => e.vehicle_id === vehicleId ? { ...e, [field]: value } : e),
    });
  }

  if (!vehicles.length) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
        <Info className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
        <p className="text-xs text-amber-700">No active vehicles. Add them in <strong>Vehicle Types</strong> first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-600" />
        <p className="text-xs text-blue-700">
          These are the default rates used when no season is configured for the travel date.
        </p>
      </div>

      <div className="grid grid-cols-[1fr_80px_130px_110px] gap-2 px-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vehicle</p>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Type</p>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Price (₹) *</p>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cost (₹)</p>
      </div>

      {vehicles.map((vehicle) => {
        const entry       = entries.find((e) => e.vehicle_id === vehicle.id);
        const priceVal    = entry?.price        ?? "";
        const costVal     = entry?.cost_price   ?? "";
        const pricingType = (entry?.pricing_type ?? "PER_DAY") as CabPricingType;
        const unit        = pricingType === "PER_DAY" ? "/day" : "/km";
        const isInvalid   = priceVal !== "" && (isNaN(Number(priceVal)) || Number(priceVal) <= 0);

        return (
          <div key={vehicle.id} className="grid grid-cols-[1fr_80px_130px_110px] gap-2 items-center rounded-lg border bg-muted/20 px-3 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <Car className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate leading-tight">{vehicle.name}</p>
                <span className="text-[10px] text-muted-foreground">
                  {VEHICLE_TYPE_LABELS[vehicle.type] ?? vehicle.type}
                </span>
              </div>
            </div>
            <PricingTypeToggle value={pricingType} onChange={(v) => update(vehicle.id, "pricing_type", v)} />
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">₹</span>
              <Input
                type="number" min={0} step={pricingType === "PER_KM" ? 1 : 100}
                placeholder="0" value={priceVal}
                onChange={(e) => update(vehicle.id, "price", e.target.value)}
                className={cn("h-8 pl-6 pr-9 text-sm", isInvalid && "border-destructive")}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">{unit}</span>
            </div>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">₹</span>
              <Input type="number" min={0} placeholder="opt." value={costVal}
                onChange={(e) => update(vehicle.id, "cost_price", e.target.value)}
                className="h-8 pl-6 text-sm"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Step 3: Calendar Rates ────────────────────────────────────────────────

function CalendarRatesStep({ vehicles }: { vehicles: Vehicle[] }) {
  const { stepData, setStepData } = useMultiStepSheet();
  const data           = stepData["seasons"]  ?? {};
  const baseData       = stepData["pricing"]  ?? {};
  const baseEntries    = (baseData.entries as PriceEntry[]) ?? [];
  const vehicleSeasons = (data.vehicle_seasons as Record<string, SeasonEntry[]>) ?? {};

  const [activeVehicleId, setActiveVehicleId] = useState<number | null>(vehicles[0]?.id ?? null);
  const [dateErrors, setDateErrors]           = useState<Record<string, string>>({});

  function setDateError(key: string, error: string | null) {
    setDateErrors((prev) => {
      if (!error) { const n = { ...prev }; delete n[key]; return n; }
      return { ...prev, [key]: error };
    });
  }

  function handleDateInput(
    vehicleId: number, tempId: string,
    field: "valid_from" | "valid_to",
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const { value, validity } = e.target;
    const key = `${tempId}-${field}`;
    if (!validity.valid && validity.badInput) {
      setDateError(key, "This date does not exist");
      updateSeason(vehicleId, tempId, { [field]: "" });
    } else {
      setDateError(key, null);
      updateSeason(vehicleId, tempId, { [field]: value });
    }
  }

  function getSeasons(vehicleId: number): SeasonEntry[] {
    return vehicleSeasons[String(vehicleId)] ?? [];
  }

  function setSeasons(vehicleId: number, seasons: SeasonEntry[]) {
    setStepData("seasons", { ...data, vehicle_seasons: { ...vehicleSeasons, [String(vehicleId)]: seasons } });
  }

  function addSeason(vehicleId: number) {
    const base = baseEntries.find((e) => e.vehicle_id === vehicleId);
    setSeasons(vehicleId, [
      ...getSeasons(vehicleId),
      {
        tempId: uid(),
        pricing_type:    (base?.pricing_type ?? "PER_DAY") as CabPricingType,
        valid_from: "", valid_to: "",
        weekday_price: "", weekday_cost: "",
        weekend_enabled: false,
        weekend_price: "", weekend_cost: "",
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
    setDateErrors((prev) => {
      const n = { ...prev };
      delete n[`${tempId}-valid_from`];
      delete n[`${tempId}-valid_to`];
      return n;
    });
  }

  const totalSeasons = Object.values(vehicleSeasons).reduce((s, arr) => s + arr.length, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-600" />
        <p className="text-xs text-blue-700">
          Define date-range seasons with a weekday rate. Optionally add a higher weekend rate within the same season.
          {totalSeasons > 0 && <span className="font-semibold"> {totalSeasons} season{totalSeasons !== 1 ? "s" : ""} configured.</span>}
        </p>
      </div>

      {/* Vehicle selector tabs */}
      <div className="flex flex-wrap gap-1.5">
        {vehicles.map((v) => {
          const count     = getSeasons(v.id).length;
          const hasConflict = overlappingSeasonIds(getSeasons(v.id)).size > 0;
          const isActive  = activeVehicleId === v.id;
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

      {/* Season cards */}
      {activeVehicleId !== null && (() => {
        const vehicle  = vehicles.find((v) => v.id === activeVehicleId)!;
        const seasons  = getSeasons(activeVehicleId);
        const base     = baseEntries.find((e) => e.vehicle_id === activeVehicleId);
        const overlapSet = overlappingSeasonIds(seasons);

        return (
          <div className="space-y-2">
            {seasons.length === 0 && (
              <p className="text-xs text-muted-foreground py-3 text-center">
                No seasons for <strong>{vehicle.name}</strong> yet.
              </p>
            )}

            {seasons.map((s) => {
              const unit        = s.pricing_type === "PER_DAY" ? "/day" : "/km";
              const hasOverlap  = overlapSet.has(s.tempId);
              const fromErr     = dateErrors[`${s.tempId}-valid_from`];
              const toErr       = dateErrors[`${s.tempId}-valid_to`];

              return (
                <div
                  key={s.tempId}
                  className={cn(
                    "rounded-lg border p-3 space-y-2.5",
                    hasOverlap ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/10",
                  )}
                >
                  {/* Overlap warning */}
                  {hasOverlap && (
                    <div className="flex items-center gap-1.5 text-[11px] text-destructive font-medium">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      Date range overlaps with another season — fix before saving.
                    </div>
                  )}

                  {/* Row 1: dates · pricing type · delete */}
                  <div className="flex items-start gap-2">
                    {/* From */}
                    <div className="flex-1 space-y-1">
                      <Label className="text-[11px] text-muted-foreground">From *</Label>
                      <Input
                        type="date" value={s.valid_from}
                        onChange={(e) => handleDateInput(activeVehicleId, s.tempId, "valid_from", e)}
                        className={cn("h-8 text-sm", (hasOverlap || fromErr) && "border-destructive")}
                      />
                      {fromErr && (
                        <p className="flex items-center gap-1 text-[11px] text-destructive">
                          <AlertTriangle className="h-3 w-3 shrink-0" />{fromErr}
                        </p>
                      )}
                    </div>

                    {/* To */}
                    <div className="flex-1 space-y-1">
                      <Label className="text-[11px] text-muted-foreground">To *</Label>
                      <Input
                        type="date" value={s.valid_to}
                        min={s.valid_from || undefined}
                        onChange={(e) => handleDateInput(activeVehicleId, s.tempId, "valid_to", e)}
                        className={cn("h-8 text-sm", (hasOverlap || toErr) && "border-destructive")}
                      />
                      {toErr && (
                        <p className="flex items-center gap-1 text-[11px] text-destructive">
                          <AlertTriangle className="h-3 w-3 shrink-0" />{toErr}
                        </p>
                      )}
                    </div>

                    {/* Pricing type + delete */}
                    <div className="flex items-end gap-2 pb-0.5 mt-5">
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

                  {/* Row 2: weekday rate */}
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">
                      Weekday Rate *
                      {base?.price && (
                        <span className="ml-1.5 text-muted-foreground/60">
                          (base: ₹{base.price}{base.pricing_type === "PER_KM" ? "/km" : "/day"})
                        </span>
                      )}
                    </Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
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
                      <div className="relative w-28">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">₹</span>
                        <Input
                          type="number" min={0} placeholder="cost opt."
                          value={s.weekday_cost}
                          onChange={(e) => updateSeason(activeVehicleId, s.tempId, { weekday_cost: e.target.value })}
                          className="h-8 pl-6 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Row 3: weekend toggle + rate */}
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => updateSeason(activeVehicleId, s.tempId, {
                        weekend_enabled: !s.weekend_enabled,
                        weekend_price: "",
                        weekend_cost: "",
                      })}
                      className="flex items-center gap-2 group"
                    >
                      <div className={cn(
                        "h-4 w-4 rounded border-2 flex items-center justify-center transition-colors",
                        s.weekend_enabled
                          ? "border-dashboard-primary bg-dashboard-primary"
                          : "border-muted-foreground/40 group-hover:border-dashboard-primary",
                      )}>
                        {s.weekend_enabled && (
                          <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="text-xs font-medium text-foreground">
                        Different rate for weekends (Sat &amp; Sun)
                      </span>
                    </button>

                    {s.weekend_enabled && (
                      <div className="flex gap-2 pl-6">
                        <div className="relative flex-1">
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
                        <div className="relative w-28">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">₹</span>
                          <Input
                            type="number" min={0} placeholder="cost opt."
                            value={s.weekend_cost}
                            onChange={(e) => updateSeason(activeVehicleId, s.tempId, { weekend_cost: e.target.value })}
                            className="h-8 pl-6 text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>
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

// ── Build payload from all step data ──────────────────────────────────────

function buildPayload(data: Record<string, unknown>): VehicleEntryInput[] {
  const entries      = (data.entries as PriceEntry[]) ?? [];
  const vehicleSeasonsMap = (data.vehicle_seasons as Record<string, SeasonEntry[]>) ?? {};

  return entries
    .filter((e) => e.price !== "")
    .map((e) => ({
      vehicleId:   e.vehicle_id,
      pricingType: e.pricing_type,
      price:       Number(e.price),
      costPrice:   e.cost_price ? Number(e.cost_price) : null,
      seasons:     (vehicleSeasonsMap[String(e.vehicle_id)] ?? [])
        .filter((s) => s.valid_from && s.valid_to && s.weekday_price)
        .map<SeasonInput>((s) => ({
          pricingType:  s.pricing_type,
          validFrom:    s.valid_from,
          validTo:      s.valid_to,
          weekdayPrice: Number(s.weekday_price),
          weekdayCost:  s.weekday_cost  ? Number(s.weekday_cost)  : null,
          weekendPrice: s.weekend_enabled && s.weekend_price ? Number(s.weekend_price) : null,
          weekendCost:  s.weekend_enabled && s.weekend_cost  ? Number(s.weekend_cost)  : null,
        })),
    }));
}

// ── Create Sheet ──────────────────────────────────────────────────────────

export function CreateCabPricingSheet({ vehicles }: { vehicles: Vehicle[] }) {
  const [open,      setOpen]         = useState(false);
  const [sheetKey,  setSheetKey]     = useState(0);
  const [isPending, startTransition] = useTransition();

  async function handleComplete(data: Record<string, unknown>) {
    const destinationId = data.destination_id as number;
    const payload       = buildPayload(data);
    startTransition(async () => {
      const result = await upsertCabPricingForDestination(destinationId, payload);
      if (result.success) {
        toast.success(result.message);
        setSheetKey((k) => k + 1);
        setOpen(false);
      } else {
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

      <MultiStepSheet
        key={sheetKey} open={open} onOpenChange={setOpen}
        title="Add Cab Pricing"
        description="Set vehicle rates and seasonal pricing for a destination"
        steps={buildSteps(false)}
        onComplete={handleComplete}
        isSubmitting={isPending}
        submitLabel="Save Pricing"
        initialStepData={{}}
      >
        <DestinationStep isEdit={false} forCreate />
        <BaseRatesStep vehicles={vehicles} />
        <CalendarRatesStep vehicles={vehicles} />
      </MultiStepSheet>
    </>
  );
}

// ── Edit Sheet ────────────────────────────────────────────────────────────

export function EditCabPricingSheet({ row, vehicles }: { row: CabPricingGroup; vehicles: Vehicle[] }) {
  const [open,      setOpen]         = useState(false);
  const [sheetKey,  setSheetKey]     = useState(0);
  const [isPending, startTransition] = useTransition();

  function buildInitial(): Record<string, Record<string, unknown>> {
    const entries: PriceEntry[] = vehicles.map((v) => {
      const ex = row.pricings.find((p) => p.vehicle_id === v.id);
      return {
        vehicle_id:   v.id,
        pricing_type: (ex?.pricing_type ?? "PER_DAY") as CabPricingType,
        price:        ex ? String(ex.price) : "",
        cost_price:   ex?.cost_price != null ? String(ex.cost_price) : "",
      };
    });

    const vehicle_seasons: Record<string, SeasonEntry[]> = {};
    for (const p of row.pricings) {
      if (p.seasons.length > 0) {
        vehicle_seasons[String(p.vehicle_id)] = p.seasons.map((s) => ({
          tempId:          uid(),
          pricing_type:    s.pricing_type,
          valid_from:      s.valid_from,
          valid_to:        s.valid_to,
          weekday_price:   String(s.weekday_price),
          weekday_cost:    s.weekday_cost  != null ? String(s.weekday_cost)  : "",
          weekend_enabled: s.weekend_price != null,
          weekend_price:   s.weekend_price != null ? String(s.weekend_price) : "",
          weekend_cost:    s.weekend_cost  != null ? String(s.weekend_cost)  : "",
        }));
      }
    }

    return {
      destination: { destination_id: row.destination_id, _destinationLabel: row.destination_name },
      pricing:     { entries },
      seasons:     { vehicle_seasons },
    };
  }

  async function handleComplete(data: Record<string, unknown>) {
    const payload = buildPayload(data);
    startTransition(async () => {
      const result = await upsertCabPricingForDestination(row.destination_id, payload);
      if (result.success) {
        toast.success(result.message);
        setOpen(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <>
      <Button variant="ghost" size="icon" className="h-8 w-8"
        onClick={() => { setSheetKey((k) => k + 1); setOpen(true); }}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>

      <MultiStepSheet
        key={sheetKey} open={open} onOpenChange={setOpen}
        title="Edit Cab Pricing"
        description={`Editing pricing for: ${row.destination_name}`}
        steps={buildSteps(true)}
        onComplete={handleComplete}
        isSubmitting={isPending}
        submitLabel="Save Changes"
        initialStepData={buildInitial()}
      >
        <DestinationStep isEdit lockedName={row.destination_name} forCreate={false} />
        <BaseRatesStep vehicles={vehicles} />
        <CalendarRatesStep vehicles={vehicles} />
      </MultiStepSheet>
    </>
  );
}
