"use client";

import { useState, useTransition } from "react";
import {
  Plus, Pencil, Car, IndianRupee,
  CalendarDays, AlertTriangle,
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
import { SeasonalRateCalendar, type SeasonalRateCalendarItem } from "../../components/ui/seasonal-rate-calendar";
import type { RateSeasonBase } from "../../components/ui/seasonal-rate-calendar-logic";

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
  label:           string;
  pricing_type:    CabPricingType;
  valid_from:      string;
  valid_to:        string;
  weekday_price:   string;
  weekend_enabled: boolean;
  weekend_price:   string;
  color:           string;
};

// ── Helpers ───────────────────────────────────────────────────────────────

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  HATCHBACK: "Hatchback", SEDAN: "Sedan", SUV: "SUV",
  LUXURY_SEDAN: "Luxury Sedan", LUXURY_SUV: "Luxury SUV",
  TEMPO_TRAVELLER: "Tempo Traveller", MINI_BUS: "Mini Bus",
  BUS: "Bus", Rikshaw: "Rickshaw",
};

function uid() { return Math.random().toString(36).slice(2); }

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
          seasonName:   s.label || null,
          color:        s.color || null,
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
            "px-2.5 transition-colors cursor-pointer", i > 0 && "border-l",
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
          <div className="flex flex-wrap gap-1.5 p-3 border rounded-xl bg-muted/20 max-h-60 overflow-y-auto">
            {filtered.map((v) => {
              const selected = selectedIds.has(v.id);
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onToggleVehicle(v)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all cursor-pointer",
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

// ── Calendar Rates section ────────────────────────────────────────────────
// Each selected vehicle is a distinct "item" in the shared calendar — seasons
// for one vehicle never leak into another's date ranges.

type CabRateSeason = RateSeasonBase & {
  pricingType:  CabPricingType;
  weekendPrice: number | null;
};

function toRateSeasons(vehicleSeasons: Record<string, SeasonEntry[]>): CabRateSeason[] {
  const all: CabRateSeason[] = [];
  for (const [vehicleId, seasons] of Object.entries(vehicleSeasons)) {
    for (const s of seasons) {
      if (!s.valid_from || !s.valid_to || !s.weekday_price) continue;
      all.push({
        id:           s.tempId,
        itemId:       vehicleId,
        label:        s.label || undefined,
        startDate:    s.valid_from,
        endDate:      s.valid_to,
        color:        s.color || "#f97316",
        rate:         Number(s.weekday_price) || 0,
        pricingType:  s.pricing_type,
        weekendPrice: s.weekend_enabled && s.weekend_price ? Number(s.weekend_price) : null,
      });
    }
  }
  return all;
}

function fromRateSeasons(rateSeasons: CabRateSeason[]): Record<string, SeasonEntry[]> {
  const map: Record<string, SeasonEntry[]> = {};
  for (const rs of rateSeasons) {
    const arr = map[rs.itemId] ?? (map[rs.itemId] = []);
    arr.push({
      tempId:          rs.id,
      label:           rs.label ?? "",
      pricing_type:    rs.pricingType ?? "PER_DAY",
      valid_from:      rs.startDate,
      valid_to:        rs.endDate,
      weekday_price:   String(rs.rate),
      weekend_enabled: rs.weekendPrice != null,
      weekend_price:   rs.weekendPrice != null ? String(rs.weekendPrice) : "",
      color:           rs.color,
    });
  }
  return map;
}

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
  const [open, setOpen] = useState(false);
  const [_activeItemId, setActiveItemId] = useState<string>("");

  const items: SeasonalRateCalendarItem[] = selectedVehicles.map((v) => {
    const entry = entries.find((e) => e.vehicle_id === v.id);
    return { id: String(v.id), label: v.name, baseRate: entry?.price ? Number(entry.price) : 0 };
  });

  const activeItemId = items.some((i) => i.id === _activeItemId) ? _activeItemId : items[0]?.id ?? "";
  const rateSeasons = toRateSeasons(vehicleSeasons);
  const totalSeasons = rateSeasons.length;

  if (!selectedVehicles.length) {
    return (
      <p className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-xl">
        Select vehicles in Base Rates above to configure seasonal pricing
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {totalSeasons > 0
          ? `${totalSeasons} season${totalSeasons !== 1 ? "s" : ""} configured across ${selectedVehicles.length} vehicle${selectedVehicles.length !== 1 ? "s" : ""}.`
          : "No seasonal rates yet — add one per vehicle below."}
      </p>

      <Button
        type="button" variant="outline" size="lg"
        className="w-full cursor-pointer h-9 text-xs gap-1.5 border-dashed"
        onClick={() => setOpen(true)}
      >
        <CalendarDays className="h-3.5 w-3.5" />
        {totalSeasons > 0 ? "Manage Seasonal Rates" : "Add Seasonal Rates"}
      </Button>

      <SeasonalRateCalendar<CabRateSeason>
        open={open}
        onOpenChange={setOpen}
        title="Seasonal Rate Calendar"
        subtitle="Cab Pricing"
        items={items}
        activeItemId={activeItemId}
        onActiveItemChange={setActiveItemId}
        seasons={rateSeasons}
        onSave={(next) => onChange(fromRateSeasons(next))}
        getDefaultDraft={(item) => {
          const entry = entries.find((e) => String(e.vehicle_id) === item.id);
          return { pricingType: entry?.pricing_type ?? "PER_DAY" };
        }}
        getSeasonWeekendRate={(s) => s.weekendPrice}
        renderExtraFields={({ draft, onChange: onExtraChange }) => (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-neutral-500 mb-0.5 block">Pricing type</label>
              <div className="flex rounded-md border overflow-hidden h-8 text-xs font-medium">
                {(["PER_DAY", "PER_KM"] as CabPricingType[]).map((t) => (
                  <button
                    key={t} type="button"
                    onClick={() => onExtraChange({ pricingType: t })}
                    className={cn(
                      "flex-1 transition-colors cursor-pointer",
                      draft.pricingType === t ? "bg-dashboard-primary text-white" : "bg-background text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {t === "PER_DAY" ? "/day" : "/km"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] text-neutral-500 mb-0.5 block">Weekend price (₹)</label>
              <Input
                type="number" min={0}
                placeholder="Same as weekday"
                value={draft.weekendPrice ?? ""}
                onChange={(e) => onExtraChange({ weekendPrice: e.target.value ? Number(e.target.value) : null })}
                className="h-8 text-xs bg-white"
              />
            </div>
          </div>
        )}
      />
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
                  hideRecent
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
    const map: Record<string, SeasonEntry[]> = {};
    for (const p of row.pricings) {
      if (p.seasons.length > 0) {
        map[String(p.vehicle_id)] = p.seasons.map((s) => ({
          tempId:          uid(),
          label:           s.season_name ?? "",
          pricing_type:    s.pricing_type,
          valid_from:      s.valid_from,
          valid_to:        s.valid_to,
          weekday_price:   String(s.weekday_price),
          weekend_enabled: s.weekend_price != null,
          weekend_price:   s.weekend_price != null ? String(s.weekend_price) : "",
          color:           s.color ?? "",
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
