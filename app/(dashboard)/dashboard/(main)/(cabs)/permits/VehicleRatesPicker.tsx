"use client";

import { useState } from "react";
import { Plus, X, MapPin, Loader2, Car } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { cn } from "@/app/lib/utils";

import { getCabPricingCities, getVehiclesForCabPricingCities } from "./actions";
import type { CabPricingCityOption, PermitVehicleRate } from "./permit.types";

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  HATCHBACK: "Hatchback", SEDAN: "Sedan", SUV: "SUV",
  LUXURY_SEDAN: "Luxury Sedan", LUXURY_SUV: "Luxury SUV",
  TEMPO_TRAVELLER: "Tempo Traveller", MINI_BUS: "Mini Bus", BUS: "Bus",
  Rikshaw: "Rickshaw",
};

export function VehicleRatesPicker({
  permitLocationId,
  value,
  onChange,
}: {
  permitLocationId: string | null;
  value:            PermitVehicleRate[];
  onChange:         (rates: PermitVehicleRate[]) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cities, setCities]         = useState<CabPricingCityOption[]>([]);
  const [page, setPage]             = useState(1);
  const [hasMore, setHasMore]       = useState(false);
  const [loading, setLoading]       = useState(false);
  const [adding, setAdding]         = useState(false);
  const [selected, setSelected]     = useState<Set<string>>(new Set());

  async function loadCities(nextPage: number) {
    setLoading(true);
    try {
      const res = await getCabPricingCities(permitLocationId, nextPage);
      setCities((prev) => (nextPage === 1 ? res.cities : [...prev, ...res.cities]));
      setHasMore(res.hasMore);
      setPage(nextPage);
    } finally {
      setLoading(false);
    }
  }

  function openPicker() {
    setPickerOpen(true);
    setSelected(new Set());
    loadCities(1);
  }

  function closePicker() {
    setPickerOpen(false);
    setCities([]);
    setSelected(new Set());
    setPage(1);
    setHasMore(false);
  }

  function toggleCity(cityKey: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cityKey)) next.delete(cityKey); else next.add(cityKey);
      return next;
    });
  }

  async function addSelectedCities() {
    if (selected.size === 0) return;
    setAdding(true);
    try {
      const candidates = await getVehiclesForCabPricingCities([...selected]);
      const existingIds = new Set(value.map((v) => v.vehicle_id));
      const additions: PermitVehicleRate[] = candidates
        .filter((c) => !existingIds.has(c.vehicle_id))
        .map((c) => ({
          vehicle_id:         c.vehicle_id,
          vehicle_name:       c.vehicle_name,
          vehicle_type:       c.vehicle_type,
          passenger_capacity: c.passenger_capacity,
          has_ac:             c.has_ac,
          thumbnail:          c.thumbnail,
          price_per_km:       0,
        }));
      onChange([...value, ...additions]);
      closePicker();
    } finally {
      setAdding(false);
    }
  }

  function setRate(vehicleId: number, priceStr: string) {
    const price = priceStr === "" ? 0 : parseFloat(priceStr);
    onChange(value.map((v) => (v.vehicle_id === vehicleId ? { ...v, price_per_km: isNaN(price) ? 0 : price } : v)));
  }

  function removeVehicle(vehicleId: number) {
    onChange(value.filter((v) => v.vehicle_id !== vehicleId));
  }

  return (
    <div className="space-y-3">
      {!pickerOpen ? (
        <Button type="button" variant="outline" size="sm" onClick={openPicker} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add Vehicles
        </Button>
      ) : (
        <div className="rounded-lg border bg-muted/20">
          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground">
              Select cities to pull priced vehicles from
              {!permitLocationId && (
                <span className="block text-[11px] text-muted-foreground/70 mt-0.5">
                  Set a permit location above to sort these by distance
                </span>
              )}
            </p>
            <button type="button" onClick={closePicker} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto divide-y">
            {cities.length === 0 && loading && (
              <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading cities…
              </div>
            )}
            {cities.length === 0 && !loading && (
              <p className="py-6 text-center text-xs text-muted-foreground">No priced cities found</p>
            )}
            {cities.map((c) => (
              <label
                key={c.cityKey}
                className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-muted/40"
              >
                <input
                  type="checkbox"
                  checked={selected.has(c.cityKey)}
                  onChange={() => toggleCity(c.cityKey)}
                  className="h-3.5 w-3.5 accent-primary shrink-0"
                />
                <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">
                    {c.cityName}{c.stateName ? `, ${c.stateName}` : ""}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {c.vehicleCount} vehicle{c.vehicleCount !== 1 ? "s" : ""}
                    {c.distanceKm != null ? ` · ${c.distanceKm} km away` : ""}
                  </p>
                </div>
              </label>
            ))}
          </div>

          {hasMore && (
            <div className="px-3 py-2 border-t">
              <Button
                type="button" variant="ghost" size="sm"
                className="w-full text-xs"
                disabled={loading}
                onClick={() => loadCities(page + 1)}
              >
                {loading ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}

          <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/30">
            <p className="text-[11px] text-muted-foreground">
              {selected.size} selected
            </p>
            <Button
              type="button" size="sm"
              disabled={selected.size === 0 || adding}
              onClick={addSelectedCities}
              className="gap-1.5"
            >
              {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Add Selected {selected.size > 0 ? `(${selected.size})` : ""}
            </Button>
          </div>
        </div>
      )}

      {value.length > 0 ? (
        <div className="space-y-1.5">
          {value.map((v) => (
            <div
              key={v.vehicle_id}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-3 py-2",
              )}
            >
              <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                {v.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element -- small fixed thumbnail, not worth next/image here
                  <img src={v.thumbnail} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Car className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{v.vehicle_name}</p>
                <p className="text-xs text-muted-foreground">
                  {VEHICLE_TYPE_LABELS[v.vehicle_type] ?? v.vehicle_type} · {v.passenger_capacity} seats{v.has_ac ? " · AC" : ""}
                </p>
              </div>
              <div className="relative shrink-0 w-28">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
                <Input
                  type="number" min="0" step="0.01"
                  className="pl-6 h-8 text-sm"
                  value={v.price_per_km || ""}
                  onChange={(e) => setRate(v.vehicle_id, e.target.value)}
                  placeholder="0"
                />
              </div>
              <span className="text-[11px] text-muted-foreground shrink-0">/km</span>
              <button
                type="button"
                onClick={() => removeVehicle(v.vehicle_id)}
                className="text-muted-foreground hover:text-destructive shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        !pickerOpen && (
          <p className="text-xs text-muted-foreground/70 italic">
            No vehicles added yet — use &quot;Add Vehicles&quot; to pull real cab pricing by city.
          </p>
        )
      )}
    </div>
  );
}
