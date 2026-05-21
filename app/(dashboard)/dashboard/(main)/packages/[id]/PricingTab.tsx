"use client";

import { useState, useTransition } from "react";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Switch } from "../../components/ui/switch";
import { Label } from "../../components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "../../components/ui/alert-dialog";
import { Loader2, Check, Percent, Settings2, Car, Plus, Trash2, Wind } from "lucide-react";
import { toast } from "sonner";
import { handleUpsertPackagePricing } from "@/app/actions/packages/pricing.actions";
import { upsertCabPricing, deleteCabPricing, toggleCabPricingActive } from "@/app/actions/packages/cab-pricing.actions";

// ── Types ──────────────────────────────────────────────────────────────────

type Duration = { id: number; label: string; days: number; nights: number };
type StayCategory = { id: number; label: string; slug: string };
type SavedPricing = {
  id: number;
  duration_id: number;
  stay_category_id: number;
  margin_percentage: number;
  gst_percentage: number;
};

type RouteOption = { id: number; name: string; durationLabel: string };

type VehicleOption = {
  id: number;
  name: string;
  type: string;
  passenger_capacity: number;
  has_ac: boolean;
  fuel_type: string | null;
};

type CabPricingRow = {
  id: number;
  route_id: number;
  vehicle_id: number;
  sell_price: number;
  cost_price: number | null;
  sort_order: number;
  is_active: boolean;
  vehicle: VehicleOption | null;
};

type PricingTabProps = {
  packageId: number;
  durations: Duration[];
  stayCategories: StayCategory[];
  initialPricings: SavedPricing[];
  routes: RouteOption[];
  initialCabPricings: CabPricingRow[];
  availableVehicles: VehicleOption[];
};

// ── Margin/GST row ─────────────────────────────────────────────────────────

function PricingRow({
  packageId,
  durationId,
  stayCategory,
  initialMargin,
  initialGst,
  hasConfig,
}: {
  packageId: number;
  durationId: number;
  stayCategory: StayCategory;
  initialMargin: number;
  initialGst: number;
  hasConfig: boolean;
}) {
  const [margin, setMargin] = useState(String(initialMargin));
  const [gst, setGst] = useState(String(initialGst));
  const [saved, setSaved] = useState(hasConfig);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    const m = parseFloat(margin);
    const g = parseFloat(gst);
    if (isNaN(m) || isNaN(g) || m < 0 || g < 0) {
      toast.error("Enter valid non-negative percentages");
      return;
    }
    startTransition(async () => {
      const result = await handleUpsertPackagePricing({
        package_id: packageId,
        duration_id: durationId,
        stay_category_id: stayCategory.id,
        margin_percentage: m,
        gst_percentage: g,
      });
      if (result.success) {
        setSaved(true);
        toast.success(`${stayCategory.label} pricing saved`);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-3 py-3 border-b last:border-0">
      <div className="w-36 min-w-0 shrink-0">
        <span className="text-sm font-medium truncate block">{stayCategory.label}</span>
        {!hasConfig && !saved && (
          <span className="text-[10px] text-amber-500 font-medium">Not configured</span>
        )}
      </div>

      <div className="flex items-center gap-2 flex-1">
        <div className="relative w-28">
          <Input
            type="number" min="0" max="100" step="0.5"
            value={margin}
            onChange={(e) => { setMargin(e.target.value); setSaved(false); }}
            className="pr-7 text-sm h-8" placeholder="10"
          />
          <Percent className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
        </div>

        <span className="text-xs text-muted-foreground">+</span>

        <div className="relative w-28">
          <Input
            type="number" min="0" max="100" step="0.5"
            value={gst}
            onChange={(e) => { setGst(e.target.value); setSaved(false); }}
            className="pr-7 text-sm h-8" placeholder="5"
          />
          <Percent className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
        </div>

        <span className="text-xs text-muted-foreground hidden sm:block">GST</span>

        <Button
          size="sm"
          variant={saved ? "outline" : "default"}
          onClick={handleSave}
          disabled={isPending || saved}
          className="h-8 w-20 shrink-0"
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : saved ? (
            <><Check className="h-3.5 w-3.5 mr-1 text-green-600" /><span className="text-green-600">Saved</span></>
          ) : "Save"}
        </Button>
      </div>
    </div>
  );
}

// ── Cab pricing row ────────────────────────────────────────────────────────

function CabRow({
  row,
  packageId,
  onDelete,
  onToggle,
}: {
  row: CabPricingRow;
  packageId: number;
  onDelete: (id: number) => void;
  onToggle: (id: number, val: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-3 py-2.5 border-b last:border-0">
      <Car className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium">{row.vehicle?.name ?? `Vehicle #${row.vehicle_id}`}</span>
          {row.vehicle?.has_ac && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-0.5"><Wind className="h-2.5 w-2.5" />AC</Badge>}
          <span className="text-xs text-muted-foreground">{row.vehicle?.passenger_capacity} pax</span>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs font-semibold text-green-700">₹{row.sell_price.toLocaleString("en-IN")}</span>
          {row.cost_price != null && <span className="text-xs text-muted-foreground">Cost: ₹{row.cost_price.toLocaleString("en-IN")}</span>}
        </div>
      </div>
      <Switch
        checked={row.is_active}
        onCheckedChange={(v) => {
          startTransition(async () => {
            const res = await toggleCabPricingActive(row.id, v, packageId);
            if (res.success) onToggle(row.id, v);
            else toast.error(res.error);
          });
        }}
        disabled={isPending}
      />
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" disabled={isPending}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Cab Option</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <span className="font-semibold">{row.vehicle?.name}</span> from this route&apos;s cab options?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                startTransition(async () => {
                  const res = await deleteCabPricing(row.id, packageId);
                  if (res.success) onDelete(row.id);
                  else toast.error(res.error);
                });
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Add cab form ───────────────────────────────────────────────────────────

function AddCabForm({
  packageId,
  routeId,
  availableVehicles,
  existingVehicleIds,
  onAdded,
  onCancel,
}: {
  packageId: number;
  routeId: number;
  availableVehicles: VehicleOption[];
  existingVehicleIds: Set<number>;
  onAdded: (row: CabPricingRow) => void;
  onCancel: () => void;
}) {
  const [vehicleId, setVehicleId] = useState<string>("");
  const [sellPrice, setSellPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [isPending, startTransition] = useTransition();

  const eligible = availableVehicles.filter((v) => !existingVehicleIds.has(v.id));
  const isValid = !!vehicleId && !!sellPrice && Number(sellPrice) >= 0;

  function handleAdd() {
    startTransition(async () => {
      const res = await upsertCabPricing({
        package_id: packageId,
        route_id: routeId,
        vehicle_id: Number(vehicleId),
        sell_price: Number(sellPrice),
        cost_price: costPrice ? Number(costPrice) : null,
      });
      if (res.success) {
        const vehicle = availableVehicles.find((v) => v.id === Number(vehicleId))!;
        onAdded({
          id: res.id,
          route_id: routeId,
          vehicle_id: Number(vehicleId),
          sell_price: Number(sellPrice),
          cost_price: costPrice ? Number(costPrice) : null,
          sort_order: 0,
          is_active: true,
          vehicle,
        });
        toast.success("Cab option added");
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="border rounded-lg p-3 space-y-3 bg-muted/10">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="space-y-1 col-span-2">
          <Label className="text-xs">Vehicle <span className="text-destructive">*</span></Label>
          <Select value={vehicleId} onValueChange={setVehicleId}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select vehicle…" /></SelectTrigger>
            <SelectContent>
              {eligible.length === 0
                ? <SelectItem value="__none" disabled>All vehicles added</SelectItem>
                : eligible.map((v) => (
                    <SelectItem key={v.id} value={String(v.id)}>
                      {v.name} ({v.passenger_capacity} pax{v.has_ac ? " · AC" : ""})
                    </SelectItem>
                  ))
              }
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Sell Price (₹) <span className="text-destructive">*</span></Label>
          <Input className="h-8 text-sm" type="number" min={0} placeholder="0" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Cost Price (₹)</Label>
          <Input className="h-8 text-sm" type="number" min={0} placeholder="0" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>Cancel</Button>
        <Button type="button" size="sm" disabled={!isValid || isPending} onClick={handleAdd}>
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Check className="h-3.5 w-3.5 mr-1" />Add</>}
        </Button>
      </div>
    </div>
  );
}

// ── Cab options section per route ──────────────────────────────────────────

function CabOptionsSection({
  packageId,
  route,
  initialRows,
  availableVehicles,
}: {
  packageId: number;
  route: RouteOption;
  initialRows: CabPricingRow[];
  availableVehicles: VehicleOption[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [adding, setAdding] = useState(false);

  const existingVehicleIds = new Set(rows.map((r) => r.vehicle_id));

  return (
    <Card key={route.id} className="mb-3">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-semibold">{route.name}</CardTitle>
            <Badge variant="outline" className="text-xs">{route.durationLabel}</Badge>
          </div>
          {!adding && availableVehicles.some((v) => !existingVehicleIds.has(v.id)) && (
            <Button size="sm" variant="outline" className="h-6 text-xs gap-1" onClick={() => setAdding(true)}>
              <Plus className="h-3 w-3" /> Add Vehicle
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pt-0 pb-3">
        {adding && (
          <div className="mb-3">
            <AddCabForm
              packageId={packageId}
              routeId={route.id}
              availableVehicles={availableVehicles}
              existingVehicleIds={existingVehicleIds}
              onAdded={(row) => { setRows((prev) => [...prev, row]); setAdding(false); }}
              onCancel={() => setAdding(false)}
            />
          </div>
        )}
        {rows.length > 0 ? (
          rows.map((row) => (
            <CabRow
              key={row.id}
              row={row}
              packageId={packageId}
              onDelete={(id) => setRows((prev) => prev.filter((r) => r.id !== id))}
              onToggle={(id, val) => setRows((prev) => prev.map((r) => r.id === id ? { ...r, is_active: val } : r))}
            />
          ))
        ) : !adding && (
          <p className="text-xs text-muted-foreground py-2 text-center">No cab options configured for this route</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function PricingTab({
  packageId,
  durations,
  stayCategories,
  initialPricings,
  routes,
  initialCabPricings,
  availableVehicles,
}: PricingTabProps) {
  if (durations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 rounded-xl border border-dashed bg-muted/30">
        <Settings2 className="h-8 w-8 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">No durations found</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Add durations in the Route Builder tab first.</p>
      </div>
    );
  }

  if (stayCategories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 rounded-xl border border-dashed bg-muted/30">
        <Settings2 className="h-8 w-8 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">No stay categories found</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Add stay categories in the Itinerary Builder tab first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 bg-dashboard-base-100 p-8 rounded-xl shadow-lg border border-dashboard-base-content/20">
      {/* ── Margin & GST ── */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">Margin &amp; GST Configuration</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Set the margin percentage and GST rate for each duration &amp; stay category combination.
          </p>
        </div>

        <div className="flex items-center gap-3 px-4 py-2 bg-muted/40 rounded-lg text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <span className="w-36 shrink-0">Stay Category</span>
          <div className="flex items-center gap-2 flex-1">
            <span className="w-28 text-center">Margin %</span>
            <span className="w-5" />
            <span className="w-28 text-center">GST %</span>
          </div>
        </div>

        {durations.map((duration) => (
          <Card key={duration.id}>
            <CardHeader className="py-3 px-4">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold">{duration.label}</CardTitle>
                <Badge variant="outline" className="text-xs">{duration.nights}N / {duration.days}D</Badge>
              </div>
            </CardHeader>
            <CardContent className="px-4 pt-0 pb-1">
              {stayCategories.map((cat) => {
                const existing = initialPricings.find(
                  (p) => p.duration_id === duration.id && p.stay_category_id === cat.id
                );
                return (
                  <PricingRow
                    key={`${duration.id}-${cat.id}`}
                    packageId={packageId}
                    durationId={duration.id}
                    stayCategory={cat}
                    initialMargin={existing?.margin_percentage ?? 10}
                    initialGst={existing?.gst_percentage ?? 5}
                    hasConfig={!!existing}
                  />
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Cab Options ── */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Car className="h-4 w-4" /> Cab Options
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure available vehicles and flat prices per route variant. Customers select a cab during enquiry.
          </p>
        </div>

        {routes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 rounded-xl border border-dashed bg-muted/30">
            <Car className="h-7 w-7 text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground">Add route variants first to configure cab options.</p>
          </div>
        ) : availableVehicles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 rounded-xl border border-dashed bg-muted/30">
            <Car className="h-7 w-7 text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground">No active vehicles found. Add vehicles in the Cabs page.</p>
          </div>
        ) : (
          routes.map((route) => (
            <CabOptionsSection
              key={route.id}
              packageId={packageId}
              route={route}
              initialRows={initialCabPricings.filter((c) => c.route_id === route.id)}
              availableVehicles={availableVehicles}
            />
          ))
        )}
      </div>
    </div>
  );
}
