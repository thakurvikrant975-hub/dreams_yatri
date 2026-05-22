"use client";

import { useState, useTransition } from "react";
import { Car, Plus, Pencil, Trash2, Loader2, Check, X, ChevronDown, ChevronRight, Tag, Flame, Wind } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import { Badge } from "../../components/ui/badge";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "../../components/ui/select";
import { ImagePicker, type PickedImage } from "../../components/dashboard/ImagePicker";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "../../components/ui/alert-dialog";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "../../components/ui/card";
import { toast } from "sonner";
import {
  createVehicle, updateVehicle, toggleVehicleActive, deleteVehicle,
  createVehicleRate, updateVehicleRate, deleteVehicleRate,
  type VehicleFull, type VehicleRate,
} from "./actions";
import { TableEmptyState } from "../../components/dashboard/TableEmptyState";

// ── Constants ──────────────────────────────────────────────────────────────

const VEHICLE_TYPES = [
  { value: "HATCHBACK", label: "Hatchback" },
  { value: "SEDAN", label: "Sedan" },
  { value: "SUV", label: "SUV" },
  { value: "LUXURY_SEDAN", label: "Luxury Sedan" },
  { value: "LUXURY_SUV", label: "Luxury SUV" },
  { value: "TEMPO_TRAVELLER", label: "Tempo Traveller" },
  { value: "MINI_BUS", label: "Mini Bus" },
  { value: "BUS", label: "Bus" },
];

const FUEL_TYPES = [
  { value: "PETROL", label: "Petrol" },
  { value: "DIESEL", label: "Diesel" },
  { value: "CNG", label: "CNG" },
  { value: "ELECTRIC", label: "Electric" },
  { value: "HYBRID", label: "Hybrid" },
];

const RATE_TYPES = [
  { value: "PER_KM", label: "Per KM" },
  { value: "FLAT_TRIP", label: "Flat Trip" },
  { value: "PER_DAY", label: "Per Day" },
];

// ── Vehicle form ───────────────────────────────────────────────────────────

type VehicleFormState = {
  name: string;
  type: string;
  passenger_capacity: string;
  luggage_bags: string;
  has_ac: boolean;
  fuel_type: string;
  image_key: string;
  description: string;
};

const EMPTY_VEHICLE: VehicleFormState = {
  name: "", type: "SUV", passenger_capacity: "4",
  luggage_bags: "2", has_ac: false, fuel_type: "", image_key: "", description: "",
};

function VehicleForm({
  initial,
  onSave,
  onCancel,
  isSaving,
}: {
  initial: VehicleFormState;
  onSave: (form: VehicleFormState) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState(initial);
  const [vehicleImages, setVehicleImages] = useState<PickedImage[]>(
    initial.image_key
      ? [{ id: "existing", key: initial.image_key, url: `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${initial.image_key}`, name: "vehicle", size: 0, status: "uploaded" as const }]
      : []
  );
  function set<K extends keyof VehicleFormState>(k: K, v: VehicleFormState[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }
  function handleImagesChange(images: PickedImage[]) {
    setVehicleImages(images);
    const uploaded = images.find(img => img.status === "uploaded" && img.key);
    set("image_key", uploaded?.key ?? "");
  }
  const isValid = !!form.name && !!form.type && Number(form.passenger_capacity) > 0;

  return (
    <div className="border rounded-xl p-4 space-y-4 bg-muted/20">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="space-y-1.5 col-span-2">
          <Label>Name <span className="text-destructive">*</span></Label>
          <Input placeholder="e.g. Toyota Innova Crysta" value={form.name} onChange={e => set("name", e.target.value)} autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label>Type <span className="text-destructive">*</span></Label>
          <Select value={form.type} onValueChange={v => set("type", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {VEHICLE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Passenger Capacity <span className="text-destructive">*</span></Label>
          <Input type="number" min={1} value={form.passenger_capacity} onChange={e => set("passenger_capacity", e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <Label>Luggage Bags</Label>
          <Input type="number" min={0} value={form.luggage_bags} onChange={e => set("luggage_bags", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Fuel Type</Label>
          <Select value={form.fuel_type || "none"} onValueChange={v => set("fuel_type", v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not specified</SelectItem>
              {FUEL_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Input placeholder="Optional notes…" value={form.description} onChange={e => set("description", e.target.value)} />
        </div>
        <div className="flex items-center gap-2 pt-6">
          <Switch id="has_ac" checked={form.has_ac} onCheckedChange={v => set("has_ac", v)} />
          <Label htmlFor="has_ac" className="cursor-pointer">Air Conditioning</Label>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Vehicle Image</Label>
        <ImagePicker
          folder="vehicles"
          value={vehicleImages}
          onChange={handleImagesChange}
          maxFiles={1}
          label="Upload Vehicle Photo"
          hint="JPG, PNG, WebP"
        />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isSaving}>
          <X className="mr-1 h-3.5 w-3.5" /> Cancel
        </Button>
        <Button type="button" size="sm" disabled={!isValid || isSaving} onClick={() => onSave(form)}>
          {isSaving
            ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Saving…</>
            : <><Check className="mr-1.5 h-3.5 w-3.5" />Save Vehicle</>
          }
        </Button>
      </div>
    </div>
  );
}

// ── Rate form ──────────────────────────────────────────────────────────────

type RateFormState = { label: string; rate_type: string; price: string; cost_price: string };
const EMPTY_RATE: RateFormState = { label: "", rate_type: "FLAT_TRIP", price: "", cost_price: "" };

function RateForm({
  initial,
  onSave,
  onCancel,
  isSaving,
}: {
  initial: RateFormState;
  onSave: (form: RateFormState) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState(initial);
  function set<K extends keyof RateFormState>(k: K, v: string) {
    setForm(f => ({ ...f, [k]: v }));
  }
  const isValid = !!form.label && !!form.price && Number(form.price) >= 0;

  return (
    <div className="border rounded-lg p-3 space-y-3 bg-muted/10">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="space-y-1 col-span-2">
          <Label className="text-xs">Label <span className="text-destructive">*</span></Label>
          <Input className="h-8 text-sm" placeholder="e.g. Local Half Day" value={form.label} onChange={e => set("label", e.target.value)} autoFocus />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Rate Type</Label>
          <Select value={form.rate_type} onValueChange={v => set("rate_type", v)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RATE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Sell Price (₹) <span className="text-destructive">*</span></Label>
          <Input className="h-8 text-sm" type="number" min={0} placeholder="0" value={form.price} onChange={e => set("price", e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Cost Price (₹)</Label>
          <Input className="h-8 text-sm" type="number" min={0} placeholder="0" value={form.cost_price} onChange={e => set("cost_price", e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isSaving}>
          <X className="mr-1 h-3 w-3" /> Cancel
        </Button>
        <Button type="button" size="sm" disabled={!isValid || isSaving} onClick={() => onSave(form)}>
          {isSaving ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Saving…</> : <><Check className="mr-1 h-3 w-3" />Save Rate</>}
        </Button>
      </div>
    </div>
  );
}

// ── Rate row ───────────────────────────────────────────────────────────────

function RateRow({
  rate,
  onEdit,
  onDelete,
  isPending,
}: {
  rate: VehicleRate;
  onEdit: () => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  const rateTypeLabel = RATE_TYPES.find(t => t.value === rate.rate_type)?.label ?? rate.rate_type;
  return (
    <div className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm">
      <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="font-medium text-sm">{rate.label}</span>
        <span className="ml-2 text-xs text-muted-foreground">{rateTypeLabel}</span>
      </div>
      <div className="text-xs text-right">
        <div className="font-medium">₹{rate.price.toLocaleString("en-IN")}</div>
        {rate.cost_price != null && <div className="text-muted-foreground">Cost: ₹{rate.cost_price.toLocaleString("en-IN")}</div>}
      </div>
      <div className="flex gap-1 shrink-0">
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
          <Pencil className="h-3 w-3" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" disabled={isPending}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Rate</AlertDialogTitle>
              <AlertDialogDescription>Delete rate <span className="font-semibold">{rate.label}</span>? This cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete} className="bg-destructive text-white hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// ── Vehicle card ───────────────────────────────────────────────────────────

function VehicleCard({
  vehicle,
  onUpdate,
  onDelete,
  onToggle,
}: {
  vehicle: VehicleFull;
  onUpdate: (updated: VehicleFull) => void;
  onDelete: (id: number) => void;
  onToggle: (id: number, val: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(false);
  const [addingRate, setAddingRate] = useState(false);
  const [editRateId, setEditRateId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const typeLabel = VEHICLE_TYPES.find(t => t.value === vehicle.type)?.label ?? vehicle.type;

  function handleSaveVehicle(form: VehicleFormState) {
    startTransition(async () => {
      const res = await updateVehicle(vehicle.id, {
        name: form.name,
        type: form.type,
        passenger_capacity: Number(form.passenger_capacity),
        luggage_bags: Number(form.luggage_bags),
        has_ac: form.has_ac,
        image_key: form.image_key || null,
        fuel_type: form.fuel_type || null,
        description: form.description || null,
      });
      if (res.success) {
        toast.success(res.message);
        setEditingVehicle(false);
        onUpdate({ ...vehicle, name: form.name, type: form.type, passenger_capacity: Number(form.passenger_capacity), luggage_bags: Number(form.luggage_bags), has_ac: form.has_ac, image_key: form.image_key || null, fuel_type: form.fuel_type || null, description: form.description || null });
      } else {
        toast.error(res.message);
      }
    });
  }

  function handleAddRate(form: RateFormState) {
    startTransition(async () => {
      const res = await createVehicleRate(vehicle.id, {
        label: form.label,
        rate_type: form.rate_type,
        price: Number(form.price),
        cost_price: form.cost_price ? Number(form.cost_price) : null,
      });
      if (res.success) {
        toast.success(res.message);
        setAddingRate(false);
        // Optimistic: add a temp rate (will be refreshed on next load)
        const newRate: VehicleRate = {
          id: Date.now(), label: form.label, rate_type: form.rate_type,
          price: Number(form.price), cost_price: form.cost_price ? Number(form.cost_price) : null, is_active: true,
        };
        onUpdate({ ...vehicle, rates: [...vehicle.rates, newRate] });
      } else {
        toast.error(res.message);
      }
    });
  }

  function handleEditRate(rateId: number, form: RateFormState) {
    startTransition(async () => {
      const res = await updateVehicleRate(rateId, {
        label: form.label,
        rate_type: form.rate_type,
        price: Number(form.price),
        cost_price: form.cost_price ? Number(form.cost_price) : null,
      });
      if (res.success) {
        toast.success(res.message);
        setEditRateId(null);
        onUpdate({ ...vehicle, rates: vehicle.rates.map(r => r.id === rateId ? { ...r, label: form.label, rate_type: form.rate_type, price: Number(form.price), cost_price: form.cost_price ? Number(form.cost_price) : null } : r) });
      } else {
        toast.error(res.message);
      }
    });
  }

  function handleDeleteRate(rateId: number) {
    startTransition(async () => {
      const res = await deleteVehicleRate(rateId);
      if (res.success) {
        toast.success(res.message);
        onUpdate({ ...vehicle, rates: vehicle.rates.filter(r => r.id !== rateId) });
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <div className="border rounded-xl overflow-hidden">
      {editingVehicle ? (
        <div className="p-4">
          <VehicleForm
            initial={{ name: vehicle.name, type: vehicle.type, passenger_capacity: String(vehicle.passenger_capacity), luggage_bags: String(vehicle.luggage_bags), has_ac: vehicle.has_ac, fuel_type: vehicle.fuel_type ?? "", image_key: vehicle.image_key ?? "", description: vehicle.description ?? "" }}
            onSave={handleSaveVehicle}
            onCancel={() => setEditingVehicle(false)}
            isSaving={isPending}
          />
        </div>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3">
          <button type="button" onClick={() => setExpanded(!expanded)} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          <Car className="h-4 w-4 text-blue-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{vehicle.name}</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{typeLabel}</Badge>
              {vehicle.fuel_type && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-0.5"><Flame className="h-2.5 w-2.5" />{FUEL_TYPES.find(f => f.value === vehicle.fuel_type)?.label ?? vehicle.fuel_type}</Badge>}
              {vehicle.has_ac && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-0.5"><Wind className="h-2.5 w-2.5" />AC</Badge>}
              <span className="text-xs text-muted-foreground">{vehicle.passenger_capacity} pax · {vehicle.luggage_bags} bags</span>
              {vehicle.rates.length > 0 && <span className="text-xs text-muted-foreground">· {vehicle.rates.length} rate{vehicle.rates.length !== 1 ? "s" : ""}</span>}
            </div>
            {vehicle.description && <p className="text-xs text-muted-foreground mt-0.5">{vehicle.description}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Switch checked={vehicle.is_active} onCheckedChange={v => onToggle(vehicle.id, v)} disabled={isPending} />
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingVehicle(true)}>
              <Pencil className="h-3 w-3" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" disabled={isPending}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Vehicle</AlertDialogTitle>
                  <AlertDialogDescription>Delete <span className="font-semibold">{vehicle.name}</span>? This cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(vehicle.id)} className="bg-destructive text-white hover:bg-destructive/90">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}

      {/* Rates panel */}
      {expanded && !editingVehicle && (
        <div className="border-t px-4 py-3 space-y-2 bg-muted/20">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Rates</p>
            {!addingRate && editRateId === null && (
              <Button size="sm" variant="outline" className="h-6 text-xs gap-1" onClick={() => setAddingRate(true)}>
                <Plus className="h-3 w-3" /> Add Rate
              </Button>
            )}
          </div>

          {addingRate && (
            <RateForm initial={EMPTY_RATE} onSave={handleAddRate} onCancel={() => setAddingRate(false)} isSaving={isPending} />
          )}

          {vehicle.rates.length > 0 ? (
            <div className="space-y-1.5">
              {vehicle.rates.map(rate =>
                editRateId === rate.id ? (
                  <RateForm
                    key={rate.id}
                    initial={{ label: rate.label, rate_type: rate.rate_type, price: String(rate.price), cost_price: rate.cost_price != null ? String(rate.cost_price) : "" }}
                    onSave={form => handleEditRate(rate.id, form)}
                    onCancel={() => setEditRateId(null)}
                    isSaving={isPending}
                  />
                ) : (
                  <RateRow
                    key={rate.id}
                    rate={rate}
                    onEdit={() => setEditRateId(rate.id)}
                    onDelete={() => handleDeleteRate(rate.id)}
                    isPending={isPending}
                  />
                )
              )}
            </div>
          ) : !addingRate && (
            <p className="text-xs text-muted-foreground py-2 text-center">No rates defined</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export function VehiclesClient({ initialVehicles }: { initialVehicles: VehicleFull[] }) {
  const [vehicles, setVehicles] = useState(initialVehicles);
  const [adding, setAdding] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleUpdate(updated: VehicleFull) {
    setVehicles(prev => prev.map(v => v.id === updated.id ? updated : v));
  }

  function handleToggle(id: number, val: boolean) {
    startTransition(async () => {
      await toggleVehicleActive(id, val);
      setVehicles(prev => prev.map(v => v.id === id ? { ...v, is_active: val } : v));
    });
  }

  function handleDelete(id: number) {
    startTransition(async () => {
      const res = await deleteVehicle(id);
      if (res.success) {
        toast.success(res.message);
        setVehicles(prev => prev.filter(v => v.id !== id));
      } else {
        toast.error(res.message);
      }
    });
  }

  function handleAddVehicle(form: VehicleFormState) {
    startTransition(async () => {
      const res = await createVehicle({
        name: form.name,
        type: form.type,
        passenger_capacity: Number(form.passenger_capacity),
        luggage_bags: Number(form.luggage_bags),
        has_ac: form.has_ac,
        image_key: form.image_key || null,
        fuel_type: form.fuel_type || null,
        description: form.description || null,
      });
      if (res.success) {
        toast.success(res.message);
        setAdding(false);
        const newVehicle: VehicleFull = {
          id: Date.now(), name: form.name, type: form.type,
          passenger_capacity: Number(form.passenger_capacity),
          luggage_bags: Number(form.luggage_bags),
          has_ac: form.has_ac, image_key: form.image_key || null, fuel_type: form.fuel_type || null,
          description: form.description || null,
          is_active: true, rates: [],
        };
        setVehicles(prev => [...prev, newVehicle]);
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Car className="h-4 w-4" /> Vehicle Catalog
            </CardTitle>
            <CardDescription>
              Define vehicle types with capacity and base rates for itinerary transfers.
            </CardDescription>
          </div>
          {!adding && (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Vehicle
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {adding && (
          <VehicleForm
            initial={EMPTY_VEHICLE}
            onSave={handleAddVehicle}
            onCancel={() => setAdding(false)}
            isSaving={isPending}
          />
        )}

        {vehicles.length > 0 ? (
          <div className="space-y-2">
            {vehicles.map(v => (
              <VehicleCard
                key={v.id}
                vehicle={v}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onToggle={handleToggle}
              />
            ))}
          </div>
        ) : !adding && (
          <TableEmptyState
            title="No vehicles defined"
            description="Add vehicles like Innova, Tempo Traveller, or Bus with capacity info"
          />

        )}
      </CardContent>
    </Card>
  );
}
