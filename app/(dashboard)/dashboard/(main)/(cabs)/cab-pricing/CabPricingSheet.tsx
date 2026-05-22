"use client";

import { useState, useTransition, useEffect } from "react";
import {
  Plus, Pencil, Car, IndianRupee, Info, CalendarDays,
  Trash2, Sun, Moon, AlertTriangle,
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
  type CabScheduleType,
  type ScheduleInput,
  type VehicleEntryInput,
} from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────

type Vehicle = { id: number; name: string; type: string };

type PriceEntry = {
  vehicle_id:   number;
  pricing_type: CabPricingType;
  price:        string;
  cost_price:   string;
};

type ScheduleEntry = {
  tempId:        string;
  label:         string;
  schedule_type: CabScheduleType;
  pricing_type:  CabPricingType;
  price:         string;
  cost_price:    string;
  valid_from:    string;
  valid_to:      string;
};

// ── Helpers ───────────────────────────────────────────────────────────────

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  HATCHBACK: "Hatchback", SEDAN: "Sedan", SUV: "SUV",
  LUXURY_SEDAN: "Luxury Sedan", LUXURY_SUV: "Luxury SUV",
  TEMPO_TRAVELLER: "Tempo Traveller", MINI_BUS: "Mini Bus",
  BUS: "Bus", Rikshaw: "Rickshaw",
};

function uid() { return Math.random().toString(36).slice(2); }

// ── Shared sub-components ─────────────────────────────────────────────────

function PricingTypeToggle({ value, onChange }: { value: CabPricingType; onChange: (v: CabPricingType) => void }) {
  return (
    <div className="flex rounded-md border overflow-hidden h-7 text-xs font-medium shrink-0">
      {(["PER_DAY", "PER_KM"] as CabPricingType[]).map((t, i) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={cn(
            "px-2.5 transition-colors",
            i > 0 && "border-l",
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
      description: "Set base price for each vehicle type",
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
      id: "schedules", title: "Calendar Rates",
      description: "Add seasonal & weekend overrides (optional)",
      icon: <CalendarDays className="h-4 w-4" />,
      optional: true,
      validate: (data) => {
        const map = (data.vehicle_schedules as Record<string, ScheduleEntry[]>) ?? {};
        for (const entries of Object.values(map)) {
          for (const s of entries) {
            if (!s.label.trim()) return "Each rate override must have a label";
            const p = Number(s.price);
            if (!s.price || isNaN(p) || p <= 0) return "Each rate price must be greater than ₹0";
            if (s.schedule_type === "SEASONAL") {
              if (!s.valid_from) return "Seasonal rates need a start date";
              if (!s.valid_to)   return "Seasonal rates need an end date";
              if (s.valid_from > s.valid_to) return "Start date must be before end date";
            }
          }
          // Check for overlapping seasonal date ranges within the same vehicle
          if (overlappingIds(entries).size > 0) {
            return "Some seasonal rates have overlapping date ranges — fix before saving";
          }
        }
        return null;
      },
    },
  ];
}

// ── Step 1: Destination ───────────────────────────────────────────────────

function DestinationStep({ isEdit, lockedName }: { isEdit: boolean; lockedName?: string }) {
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
        fetchOptions={(q) => searchDestinations(q)}
        placeholder="Search destination…"
        initialLabel={(data._destinationLabel as string) ?? ""}
      />
      <p className="text-xs text-muted-foreground">Search and select the destination to configure pricing for</p>
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
          These are the default rates. Add seasonal or weekend overrides in the next step.
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

// ── Overlap detection helper ──────────────────────────────────────────────

function overlappingIds(schedules: ScheduleEntry[]): Set<string> {
  const seasonal = schedules.filter(
    (s) => s.schedule_type === "SEASONAL" && s.valid_from && s.valid_to,
  );
  const bad = new Set<string>();
  for (let i = 0; i < seasonal.length; i++) {
    for (let j = i + 1; j < seasonal.length; j++) {
      const a = seasonal[i], b = seasonal[j];
      if (a.valid_from <= b.valid_to && b.valid_from <= a.valid_to) {
        bad.add(a.tempId);
        bad.add(b.tempId);
      }
    }
  }
  return bad;
}

// ── Step 3: Calendar Rates ────────────────────────────────────────────────

function CalendarRatesStep({ vehicles }: { vehicles: Vehicle[] }) {
  const { stepData, setStepData } = useMultiStepSheet();
  const data             = stepData["schedules"] ?? {};
  const baseData         = stepData["pricing"]   ?? {};
  const baseEntries      = (baseData.entries as PriceEntry[]) ?? [];
  const vehicleSchedules = (data.vehicle_schedules as Record<string, ScheduleEntry[]>) ?? {};

  const [activeVehicleId, setActiveVehicleId] = useState<number | null>(vehicles[0]?.id ?? null);

  function getSchedules(vehicleId: number): ScheduleEntry[] {
    return vehicleSchedules[String(vehicleId)] ?? [];
  }

  function setSchedules(vehicleId: number, schedules: ScheduleEntry[]) {
    setStepData("schedules", {
      ...data,
      vehicle_schedules: { ...vehicleSchedules, [String(vehicleId)]: schedules },
    });
  }

  function addSchedule(vehicleId: number) {
    const base = baseEntries.find((e) => e.vehicle_id === vehicleId);
    setSchedules(vehicleId, [
      ...getSchedules(vehicleId),
      {
        tempId: uid(), label: "",
        schedule_type: "SEASONAL",
        pricing_type:  (base?.pricing_type ?? "PER_DAY") as CabPricingType,
        price: "", cost_price: "", valid_from: "", valid_to: "",
      },
    ]);
  }

  function updateSchedule(vehicleId: number, tempId: string, patch: Partial<ScheduleEntry>) {
    setSchedules(vehicleId, getSchedules(vehicleId).map((s) =>
      s.tempId === tempId ? { ...s, ...patch } : s,
    ));
  }

  function removeSchedule(vehicleId: number, tempId: string) {
    setSchedules(vehicleId, getSchedules(vehicleId).filter((s) => s.tempId !== tempId));
  }

  const totalSchedules = Object.values(vehicleSchedules).reduce((s, arr) => s + arr.length, 0);

  return (
    <div className="space-y-3">
      {/* Info banner */}
      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-600" />
        <p className="text-xs text-blue-700">
          Override base rates for seasons or weekends. Leave empty to keep using base rates.
          {totalSchedules > 0 && (
            <span className="font-semibold"> {totalSchedules} override{totalSchedules !== 1 ? "s" : ""} configured.</span>
          )}
        </p>
      </div>

      {/* Vehicle selector tabs */}
      <div className="flex flex-wrap gap-1.5">
        {vehicles.map((v) => {
          const count    = getSchedules(v.id).length;
          const isActive = activeVehicleId === v.id;
          const hasOverlap = overlappingIds(getSchedules(v.id)).size > 0;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setActiveVehicleId(v.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                hasOverlap
                  ? "border-destructive/50 bg-destructive/5 text-destructive"
                  : isActive
                  ? "border-dashboard-primary/50 bg-dashboard-primary/10 text-dashboard-primary"
                  : "border-dashboard-base-300 bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {hasOverlap && <AlertTriangle className="h-3 w-3" />}
              {v.name}
              {count > 0 && (
                <span className={cn(
                  "inline-flex items-center justify-center h-4 min-w-4 px-1 text-[10px] font-semibold rounded-full",
                  hasOverlap ? "bg-destructive text-white" : "bg-dashboard-primary text-white",
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Schedule cards for selected vehicle */}
      {activeVehicleId !== null && (() => {
        const vehicle   = vehicles.find((v) => v.id === activeVehicleId)!;
        const schedules = getSchedules(activeVehicleId);
        const base      = baseEntries.find((e) => e.vehicle_id === activeVehicleId);
        const basePrice = base?.price ?? "";
        const basePriceType = (base?.pricing_type ?? "PER_DAY") as CabPricingType;
        const overlapSet = overlappingIds(schedules);

        return (
          <div className="space-y-2">
            {schedules.length === 0 && (
              <p className="text-xs text-muted-foreground py-3 text-center">
                No overrides for <strong>{vehicle.name}</strong> yet.
              </p>
            )}

            {schedules.map((s) => {
              const isWeekend  = s.schedule_type === "WEEKEND";
              const unit       = s.pricing_type === "PER_DAY" ? "/day" : "/km";
              const hasOverlap = overlapSet.has(s.tempId);

              return (
                <div
                  key={s.tempId}
                  className={cn(
                    "rounded-lg border p-3 space-y-2",
                    hasOverlap
                      ? "border-destructive/40 bg-destructive/5"
                      : "border-border bg-muted/10",
                  )}
                >
                  {/* Overlap warning */}
                  {hasOverlap && (
                    <div className="flex items-center gap-1.5 text-[11px] text-destructive font-medium">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      Date range overlaps with another seasonal rate — fix before saving.
                    </div>
                  )}

                  {/* Row 1: label · Season/Weekend toggle · delete */}
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="e.g. Peak Season, Monsoon, Diwali Weekend"
                      value={s.label}
                      onChange={(e) => updateSchedule(activeVehicleId, s.tempId, { label: e.target.value })}
                      className="h-8 text-sm flex-1"
                    />
                    <div className="flex rounded-md border overflow-hidden h-8 text-xs font-medium shrink-0">
                      <button
                        type="button"
                        onClick={() => updateSchedule(activeVehicleId, s.tempId, {
                          schedule_type: "SEASONAL", valid_from: "", valid_to: "",
                        })}
                        className={cn(
                          "flex items-center gap-1 px-2.5 transition-colors",
                          !isWeekend
                            ? "bg-dashboard-primary text-white"
                            : "bg-background text-muted-foreground hover:bg-muted",
                        )}
                      >
                        <Sun className="h-3 w-3" /> Season
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSchedule(activeVehicleId, s.tempId, {
                          schedule_type: "WEEKEND", valid_from: "", valid_to: "",
                        })}
                        className={cn(
                          "flex items-center gap-1 px-2.5 border-l transition-colors",
                          isWeekend
                            ? "bg-dashboard-primary text-white"
                            : "bg-background text-muted-foreground hover:bg-muted",
                        )}
                      >
                        <Moon className="h-3 w-3" /> Weekend
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSchedule(activeVehicleId, s.tempId)}
                      className="text-destructive/60 hover:text-destructive transition-colors shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Row 2: date range (seasonal) OR weekend note */}
                  {!isWeekend ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">From *</Label>
                        <Input
                          type="date"
                          value={s.valid_from}
                          onChange={(e) =>
                            updateSchedule(activeVehicleId, s.tempId, { valid_from: e.target.value })
                          }
                          className={cn("h-8 text-sm", hasOverlap && "border-destructive")}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">To *</Label>
                        <Input
                          type="date"
                          value={s.valid_to}
                          min={s.valid_from || undefined}
                          onChange={(e) =>
                            updateSchedule(activeVehicleId, s.tempId, { valid_to: e.target.value })
                          }
                          className={cn("h-8 text-sm", hasOverlap && "border-destructive")}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      Applies every <span className="font-semibold">Saturday &amp; Sunday</span> year-round
                    </p>
                  )}

                  {/* Row 3: /day·/km toggle · price (base as placeholder) · cost */}
                  <div className="flex items-center gap-2">
                    <PricingTypeToggle
                      value={s.pricing_type}
                      onChange={(v) => updateSchedule(activeVehicleId, s.tempId, { pricing_type: v })}
                    />
                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">₹</span>
                      <Input
                        type="number"
                        min={0}
                        step={s.pricing_type === "PER_KM" ? 1 : 100}
                        placeholder={basePrice ? `${basePrice} (base)` : "0"}
                        value={s.price}
                        onChange={(e) => updateSchedule(activeVehicleId, s.tempId, { price: e.target.value })}
                        className="h-8 pl-6 pr-9 text-sm"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
                        {unit}
                      </span>
                    </div>
                    <div className="relative w-24">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">₹</span>
                      <Input
                        type="number"
                        min={0}
                        placeholder="cost"
                        value={s.cost_price}
                        onChange={(e) => updateSchedule(activeVehicleId, s.tempId, { cost_price: e.target.value })}
                        className="h-8 pl-6 text-sm"
                      />
                    </div>
                    {/* Base rate comparison badge */}
                    {basePrice && (
                      <div className="flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-0.5 shrink-0">
                        <span className="text-[10px] text-muted-foreground">base</span>
                        <span className="text-[11px] font-semibold text-foreground">
                          ₹{Number(basePrice).toLocaleString("en-IN")}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {basePriceType === "PER_KM" ? "/km" : "/day"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs gap-1.5 border-dashed mt-1"
              onClick={() => addSchedule(activeVehicleId)}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Rate Override for {vehicle.name}
            </Button>
          </div>
        );
      })()}
    </div>
  );
}

// ── Build payload from sheet data ─────────────────────────────────────────

function buildPayload(
  data: Record<string, unknown>,
  vehicles: Vehicle[],
): VehicleEntryInput[] {
  const entries      = (data.entries as PriceEntry[]) ?? [];
  const scheduleMap  = (data.vehicle_schedules as Record<string, ScheduleEntry[]>) ?? {};

  return entries
    .filter((e) => e.price !== "")
    .map((e) => ({
      vehicleId:   e.vehicle_id,
      pricingType: e.pricing_type,
      price:       Number(e.price),
      costPrice:   e.cost_price ? Number(e.cost_price) : null,
      schedules:   (scheduleMap[String(e.vehicle_id)] ?? []).map<ScheduleInput>((s) => ({
        label:        s.label,
        scheduleType: s.schedule_type,
        pricingType:  s.pricing_type,
        price:        Number(s.price),
        costPrice:    s.cost_price ? Number(s.cost_price) : null,
        validFrom:    s.schedule_type === "SEASONAL" && s.valid_from ? s.valid_from : null,
        validTo:      s.schedule_type === "SEASONAL" && s.valid_to   ? s.valid_to   : null,
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
    const payload       = buildPayload(data, vehicles);

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
        onClick={() => setOpen(true)}
        size="lg"
        className="rounded-md bg-dashboard-primary text-dashboard-base-100 py-2.5 px-4 hover:bg-dashboard-primary hover:scale-105 duration-300 hover:text-dashboard-base-100 border border-dashboard-primary"
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Pricing
      </Button>

      <MultiStepSheet
        key={sheetKey}
        open={open}
        onOpenChange={setOpen}
        title="Add Cab Pricing"
        description="Set vehicle prices and seasonal rates for a destination"
        steps={buildSteps(false)}
        onComplete={handleComplete}
        isSubmitting={isPending}
        submitLabel="Save Pricing"
        initialStepData={{}}
      >
        <DestinationStep isEdit={false} />
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

    // Pre-seed schedule data from existing vehicle pricing records
    const vehicle_schedules: Record<string, ScheduleEntry[]> = {};
    for (const p of row.pricings) {
      if (p.schedules.length > 0) {
        vehicle_schedules[String(p.vehicle_id)] = p.schedules.map((s) => ({
          tempId:        uid(),
          label:         s.label,
          schedule_type: s.schedule_type,
          pricing_type:  s.pricing_type,
          price:         String(s.price),
          cost_price:    s.cost_price != null ? String(s.cost_price) : "",
          valid_from:    s.valid_from ?? "",
          valid_to:      s.valid_to   ?? "",
        }));
      }
    }

    return {
      destination: {
        destination_id:    row.destination_id,
        _destinationLabel: row.destination_name,
      },
      pricing:   { entries },
      schedules: { vehicle_schedules },
    };
  }

  async function handleComplete(data: Record<string, unknown>) {
    const payload = buildPayload(data, vehicles);

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
        key={sheetKey}
        open={open}
        onOpenChange={setOpen}
        title="Edit Cab Pricing"
        description={`Editing pricing for: ${row.destination_name}`}
        steps={buildSteps(true)}
        onComplete={handleComplete}
        isSubmitting={isPending}
        submitLabel="Save Changes"
        initialStepData={buildInitial()}
      >
        <DestinationStep isEdit lockedName={row.destination_name} />
        <BaseRatesStep vehicles={vehicles} />
        <CalendarRatesStep vehicles={vehicles} />
      </MultiStepSheet>
    </>
  );
}
