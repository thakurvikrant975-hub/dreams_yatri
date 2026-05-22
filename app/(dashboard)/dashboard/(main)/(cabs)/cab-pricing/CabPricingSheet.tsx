"use client";

import { useState, useTransition, useEffect } from "react";
import { Plus, Pencil, Car, IndianRupee, Info } from "lucide-react";
import { Button }  from "../../components/ui/button";
import { Input }   from "../../components/ui/input";
import { Label }   from "../../components/ui/label";
import { Badge }   from "../../components/ui/badge";
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
} from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────

type Vehicle = { id: number; name: string; type: string };

type PriceEntry = {
  vehicle_id:   number;
  pricing_type: CabPricingType;
  price:        string;
  cost_price:   string;
};

// ── Helpers ───────────────────────────────────────────────────────────────

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  HATCHBACK:       "Hatchback",
  SEDAN:           "Sedan",
  SUV:             "SUV",
  LUXURY_SEDAN:    "Luxury Sedan",
  LUXURY_SUV:      "Luxury SUV",
  TEMPO_TRAVELLER: "Tempo Traveller",
  MINI_BUS:        "Mini Bus",
  BUS:             "Bus",
  Rikshaw:         "Rickshaw",
};

// ── Step definitions ──────────────────────────────────────────────────────

function buildSteps(isEdit: boolean): SheetStep[] {
  return [
    {
      id:          "destination",
      title:       "Destination",
      description: "Select the destination to configure pricing for",
      icon:        <Car className="h-4 w-4" />,
      validate: (data) => {
        if (!data.destination_id) return "Please select a destination";
        return null;
      },
    },
    {
      id:          "pricing",
      title:       "Vehicle Pricing",
      description: "Set price type and rate for each vehicle",
      icon:        <IndianRupee className="h-4 w-4" />,
      validate: (data) => {
        const entries = (data.entries as PriceEntry[]) ?? [];
        if (entries.length === 0) return "No active vehicles found — add vehicles first";
        for (const e of entries) {
          const p = Number(e.price);
          if (!e.price || isNaN(p) || p <= 0) {
            return "All prices must be greater than ₹0";
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
        <p className="text-xs text-muted-foreground">
          Destination cannot be changed while editing. Delete and recreate to change.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label>
        Destination <span className="text-destructive">*</span>
      </Label>
      <SearchSelect
        value={destinationId}
        onChange={(id) => setStepData("destination", { ...data, destination_id: id })}
        fetchOptions={(q) => searchDestinations(q)}
        placeholder="Search destination…"
        initialLabel={(data._destinationLabel as string) ?? ""}
      />
      <p className="text-xs text-muted-foreground">
        Search and select the destination to configure cab pricing for
      </p>
    </div>
  );
}

// ── Pricing type toggle ───────────────────────────────────────────────────

function PricingTypeToggle({
  value,
  onChange,
}: {
  value:    CabPricingType;
  onChange: (v: CabPricingType) => void;
}) {
  return (
    <div className="flex rounded-md border overflow-hidden h-7 text-xs font-medium shrink-0">
      <button
        type="button"
        onClick={() => onChange("PER_DAY")}
        className={cn(
          "px-2.5 transition-colors",
          value === "PER_DAY"
            ? "bg-dashboard-primary text-white"
            : "bg-background text-muted-foreground hover:bg-muted",
        )}
      >
        /day
      </button>
      <button
        type="button"
        onClick={() => onChange("PER_KM")}
        className={cn(
          "px-2.5 border-l transition-colors",
          value === "PER_KM"
            ? "bg-dashboard-primary text-white"
            : "bg-background text-muted-foreground hover:bg-muted",
        )}
      >
        /km
      </button>
    </div>
  );
}

// ── Step 2: Vehicle Pricing ───────────────────────────────────────────────

function PricingStep({ vehicles }: { vehicles: Vehicle[] }) {
  const { stepData, setStepData } = useMultiStepSheet();
  const data    = stepData["pricing"] ?? {};
  const entries = (data.entries as PriceEntry[]) ?? [];

  useEffect(() => {
    if (entries.length === 0 && vehicles.length > 0) {
      setStepData("pricing", {
        ...data,
        entries: vehicles.map((v) => ({
          vehicle_id:   v.id,
          pricing_type: "PER_DAY" as CabPricingType,
          price:        "",
          cost_price:   "",
        })),
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicles]);

  function updateEntry<K extends keyof PriceEntry>(vehicleId: number, field: K, value: PriceEntry[K]) {
    setStepData("pricing", {
      ...data,
      entries: entries.map((e) =>
        e.vehicle_id === vehicleId ? { ...e, [field]: value } : e,
      ),
    });
  }

  if (vehicles.length === 0) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20 px-3 py-3">
        <Info className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
        <p className="text-xs text-amber-700 dark:text-amber-300">
          No active vehicles found. Add vehicle types in{" "}
          <strong>Cab Management → Vehicle Types</strong> first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-900/20 px-3 py-2.5">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-600" />
        <p className="text-xs text-blue-700 dark:text-blue-300">
          Use <strong>/day</strong> for flat daily rates (hill circuits, local sightseeing) or{" "}
          <strong>/km</strong> for distance-based fares.
        </p>
      </div>

      {/* Column headers */}
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
        const isInvalid   = priceVal !== "" && (isNaN(Number(priceVal)) || Number(priceVal) <= 0);
        const unit        = pricingType === "PER_DAY" ? "/day" : "/km";

        return (
          <div
            key={vehicle.id}
            className="grid grid-cols-[1fr_80px_130px_110px] gap-2 items-center rounded-lg border bg-muted/20 px-3 py-2.5"
          >
            {/* Vehicle info */}
            <div className="flex items-center gap-2 min-w-0">
              <Car className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate leading-tight">{vehicle.name}</p>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 mt-0.5">
                  {VEHICLE_TYPE_LABELS[vehicle.type] ?? vehicle.type}
                </Badge>
              </div>
            </div>

            {/* /day vs /km toggle */}
            <PricingTypeToggle
              value={pricingType}
              onChange={(v) => updateEntry(vehicle.id, "pricing_type", v)}
            />

            {/* Price input */}
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">₹</span>
              <Input
                type="number"
                min={0}
                step={pricingType === "PER_KM" ? 1 : 100}
                placeholder="0"
                value={priceVal}
                onChange={(e) => updateEntry(vehicle.id, "price", e.target.value)}
                className={cn(
                  "h-8 pl-6 pr-9 text-sm",
                  isInvalid && "border-destructive focus-visible:ring-destructive",
                )}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground select-none pointer-events-none">
                {unit}
              </span>
            </div>

            {/* Cost price */}
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">₹</span>
              <Input
                type="number"
                min={0}
                step={pricingType === "PER_KM" ? 1 : 100}
                placeholder="opt."
                value={costVal}
                onChange={(e) => updateEntry(vehicle.id, "cost_price", e.target.value)}
                className="h-8 pl-6 text-sm"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Create Sheet ──────────────────────────────────────────────────────────

export function CreateCabPricingSheet({ vehicles }: { vehicles: Vehicle[] }) {
  const [open,      setOpen]         = useState(false);
  const [sheetKey,  setSheetKey]     = useState(0);
  const [isPending, startTransition] = useTransition();

  const steps = buildSteps(false);

  async function handleComplete(data: Record<string, unknown>) {
    const destinationId = data.destination_id as number;
    const entries       = (data.entries as PriceEntry[]) ?? [];
    const payload       = entries
      .filter((e) => e.price !== "")
      .map((e) => ({
        vehicleId:   e.vehicle_id,
        pricingType: e.pricing_type,
        price:       Number(e.price),
        costPrice:   e.cost_price ? Number(e.cost_price) : null,
      }));

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
        description="Set vehicle prices for a destination"
        steps={steps}
        onComplete={handleComplete}
        isSubmitting={isPending}
        submitLabel="Save Pricing"
        initialStepData={{}}
      >
        <DestinationStep isEdit={false} />
        <PricingStep vehicles={vehicles} />
      </MultiStepSheet>
    </>
  );
}

// ── Edit Sheet ────────────────────────────────────────────────────────────

export function EditCabPricingSheet({
  row,
  vehicles,
}: {
  row:      CabPricingGroup;
  vehicles: Vehicle[];
}) {
  const [open,      setOpen]         = useState(false);
  const [sheetKey,  setSheetKey]     = useState(0);
  const [isPending, startTransition] = useTransition();

  const steps = buildSteps(true);

  function buildInitial(): Record<string, Record<string, unknown>> {
    const entries: PriceEntry[] = vehicles.map((v) => {
      const existing = row.pricings.find((p) => p.vehicle_id === v.id);
      return {
        vehicle_id:   v.id,
        pricing_type: (existing?.pricing_type ?? "PER_DAY") as CabPricingType,
        price:        existing ? String(existing.price) : "",
        cost_price:   existing?.cost_price != null ? String(existing.cost_price) : "",
      };
    });
    return {
      destination: {
        destination_id:    row.destination_id,
        _destinationLabel: row.destination_name,
      },
      pricing: { entries },
    };
  }

  async function handleComplete(data: Record<string, unknown>) {
    const entries = (data.entries as PriceEntry[]) ?? [];
    const payload = entries
      .filter((e) => e.price !== "")
      .map((e) => ({
        vehicleId:   e.vehicle_id,
        pricingType: e.pricing_type,
        price:       Number(e.price),
        costPrice:   e.cost_price ? Number(e.cost_price) : null,
      }));

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
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
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
        steps={steps}
        onComplete={handleComplete}
        isSubmitting={isPending}
        submitLabel="Save Changes"
        initialStepData={buildInitial()}
      >
        <DestinationStep isEdit lockedName={row.destination_name} />
        <PricingStep vehicles={vehicles} />
      </MultiStepSheet>
    </>
  );
}
