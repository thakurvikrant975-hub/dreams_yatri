"use client";

import { useState, useTransition, useMemo } from "react";
import {
  Car, Plus, Pencil, Trash2, Loader2, Check, X,
  Flame, Wind, Users, Briefcase,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Switch } from "../../components/ui/switch";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "../../components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "../../components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "../../components/ui/alert-dialog";
import { ImagePicker, type PickedImage } from "../../components/dashboard/ImagePicker";
import { toast } from "sonner";
import { cn } from "@/app/lib/utils";
import {
  createVehicle, updateVehicle, toggleVehicleActive, deleteVehicle,
  type VehicleFull, type VehicleRate,
} from "./actions";
import { PageHeader } from "../../components/dashboard/PageHeader";

// ── Constants ──────────────────────────────────────────────────────────────

const VEHICLE_TYPES = [
  { value: "HATCHBACK",       label: "Hatchback" },
  { value: "SEDAN",           label: "Sedan" },
  { value: "SUV",             label: "SUV" },
  { value: "LUXURY_SEDAN",    label: "Luxury Sedan" },
  { value: "LUXURY_SUV",      label: "Luxury SUV" },
  { value: "TEMPO_TRAVELLER", label: "Tempo Traveller" },
  { value: "MINI_BUS",        label: "Mini Bus" },
  { value: "BUS",             label: "Bus" },
  { value: "COUPE",           label: "Coupe" },
  { value: "HYBRID",          label: "Hybrid" },
];

const FUEL_TYPES = [
  { value: "PETROL",   label: "Petrol" },
  { value: "DIESEL",   label: "Diesel" },
  { value: "CNG",      label: "CNG" },
  { value: "ELECTRIC", label: "Electric" },
  { value: "HYBRID",   label: "Hybrid" },
];

const RATE_TYPES = [
  { value: "PER_KM",    unit: "km" },
  { value: "FLAT_TRIP", unit: "trip" },
  { value: "PER_DAY",   unit: "day" },
];

const DESC_MAX = 400;

function typeBadgeClass(type: string) {
  switch (type) {
    case "LUXURY_SEDAN":
    case "LUXURY_SUV":      return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800";
    case "SUV":             return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800";
    case "TEMPO_TRAVELLER":
    case "MINI_BUS":
    case "BUS":             return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800";
    case "HYBRID":          return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800";
    case "COUPE":           return "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800";
    default:                return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800";
  }
}

// ── Types ──────────────────────────────────────────────────────────────────

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
  luggage_bags: "2", has_ac: true, fuel_type: "DIESEL", image_key: "", description: "",
};

// ── Feature Pill ───────────────────────────────────────────────────────────

function FeaturePill({
  icon, label, className,
}: { icon: React.ReactNode; label: string; className?: string }) {
  return (
    <div className={cn(
      "inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border bg-muted/40 text-muted-foreground",
      className,
    )}>
      {icon}
      <span>{label}</span>
    </div>
  );
}

// ── Vehicle Sheet ──────────────────────────────────────────────────────────

function VehicleSheet({
  open,
  onOpenChange,
  vehicle,
  defaultType,
  onSave,
  isSaving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: VehicleFull | null;
  defaultType: string;
  onSave: (form: VehicleFormState) => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<VehicleFormState>(
    vehicle
      ? {
          name: vehicle.name,
          type: vehicle.type,
          passenger_capacity: String(vehicle.passenger_capacity),
          luggage_bags: String(vehicle.luggage_bags),
          has_ac: vehicle.has_ac,
          fuel_type: vehicle.fuel_type ?? "",
          image_key: vehicle.image_key ?? "",
          description: vehicle.description ?? "",
        }
      : { ...EMPTY_VEHICLE, type: defaultType },
  );

  const [vehicleImages, setVehicleImages] = useState<PickedImage[]>(
    vehicle?.image_key
      ? [{
          id: "existing",
          key: vehicle.image_key,
          url: `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${vehicle.image_key}`,
          name: "vehicle",
          size: 0,
          status: "uploaded" as const,
        }]
      : [],
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
  const descLen = form.description.length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col gap-0 p-0 overflow-hidden">

        <SheetHeader className="px-5 pt-5 pb-4 border-b shrink-0">
          <SheetTitle className="text-base">
            {vehicle ? `Edit ${vehicle.name}` : "Add New Vehicle"}
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            {vehicle
              ? "Update vehicle details. Manage pricing rates from Cab Pricing."
              : "Add a new vehicle to your fleet."}
          </p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-5 space-y-5">

            {/* Name */}
            <div className="space-y-1.5">
              <Label>Vehicle Name <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. Toyota Innova Crysta"
                value={form.name}
                onChange={e => set("name", e.target.value)}
              />
            </div>

            {/* Type + Seats + Luggage */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Type <span className="text-destructive">*</span></Label>
                <Select value={form.type} onValueChange={v => set("type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VEHICLE_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Seats <span className="text-destructive">*</span></Label>
                <Input
                  type="number" min={1} max={60}
                  value={form.passenger_capacity}
                  onChange={e => set("passenger_capacity", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Luggage Bags</Label>
                <Input
                  type="number" min={0}
                  value={form.luggage_bags}
                  onChange={e => set("luggage_bags", e.target.value)}
                />
              </div>
            </div>

            {/* Fuel + AC */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Fuel Type</Label>
                <Select
                  value={form.fuel_type || "none"}
                  onValueChange={v => set("fuel_type", v === "none" ? "" : v)}
                >
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {FUEL_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch
                  id="sheet_has_ac"
                  checked={form.has_ac}
                  onCheckedChange={v => set("has_ac", v)}
                />
                <Label htmlFor="sheet_has_ac" className="cursor-pointer">Air Conditioning</Label>
              </div>
            </div>

            {/* Description — textarea with char counter */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Description</Label>
                <span className={cn(
                  "text-xs tabular-nums",
                  descLen >= DESC_MAX
                    ? "text-destructive font-medium"
                    : descLen > 350
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground",
                )}>
                  {descLen}/{DESC_MAX}
                </span>
              </div>
              <Textarea
                placeholder="e.g. Comfortable for long-distance tours and airport transfers"
                value={form.description}
                onChange={e => set("description", e.target.value.slice(0, DESC_MAX))}
                rows={3}
                className="resize-none"
              />
              {descLen >= DESC_MAX && (
                <p className="text-xs text-destructive">Maximum {DESC_MAX} characters reached.</p>
              )}
            </div>

            {/* Image */}
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

          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t bg-muted/20 shrink-0">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              disabled={!isValid || isSaving}
              onClick={() => onSave(form)}
              className="gap-2 min-w-32"
            >
              {isSaving
                ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
                : <><Check className="h-4 w-4" />{vehicle ? "Update Vehicle" : "Add Vehicle"}</>
              }
            </Button>
          </div>
        </div>

      </SheetContent>
    </Sheet>
  );
}

// ── Vehicle Card ───────────────────────────────────────────────────────────

function VehicleCard({
  vehicle,
  onEdit,
  onDelete,
  onToggle,
}: {
  vehicle: VehicleFull;
  onEdit: () => void;
  onDelete: (id: number) => void;
  onToggle: (id: number, val: boolean) => void;
}) {
  const [togglePending, startToggleTransition] = useTransition();

  const typeLabel = VEHICLE_TYPES.find(t => t.value === vehicle.type)?.label ?? vehicle.type;
  const fuelLabel = FUEL_TYPES.find(f => f.value === vehicle.fuel_type)?.label;
  const imageUrl  = vehicle.image_key
    ? `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${vehicle.image_key}`
    : null;
  const bestRate = vehicle.rates.reduce<VehicleRate | null>(
    (best, r) => (!best || r.price < best.price) ? r : best,
    null,
  );

  return (
    <div className={cn(
      "group flex flex-col rounded-2xl border bg-card overflow-hidden transition-all duration-200",
      "hover:shadow-md hover:-translate-y-0.5",
      !vehicle.is_active && "opacity-60",
    )}>

      {/* Image */}
      <div className="relative h-44 bg-gradient-to-br from-muted to-muted/60 overflow-hidden shrink-0">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={vehicle.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2 select-none">
            <Car className="h-12 w-12 text-muted-foreground/20" />
            <span className="text-[11px] text-muted-foreground/40">No image</span>
          </div>
        )}

        <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/50 to-transparent pointer-events-none" />

        {/* Type badge */}
        <span className={cn(
          "absolute top-2.5 left-2.5 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border",
          typeBadgeClass(vehicle.type),
        )}>
          {typeLabel}
        </span>

        {/* Active badge */}
        <span className={cn(
          "absolute top-2.5 right-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium backdrop-blur-sm",
          vehicle.is_active ? "bg-green-500/90 text-white" : "bg-black/50 text-white/80",
        )}>
          <span className={cn(
            "h-1.5 w-1.5 rounded-full",
            vehicle.is_active ? "bg-white" : "bg-white/50",
          )} />
          {vehicle.is_active ? "Active" : "Inactive"}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-4 gap-3">

        <div>
          <h3 className="font-semibold text-sm leading-snug">{vehicle.name}</h3>
          {vehicle.description && (
            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
              {vehicle.description}
            </p>
          )}
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-1">
          <FeaturePill
            icon={<Users className="h-3 w-3" />}
            label={`${vehicle.passenger_capacity} Seat${vehicle.passenger_capacity !== 1 ? "s" : ""}`}
          />
          <FeaturePill
            icon={<Briefcase className="h-3 w-3" />}
            label={`${vehicle.luggage_bags} Bag${vehicle.luggage_bags !== 1 ? "s" : ""}`}
          />
          {vehicle.has_ac && (
            <FeaturePill
              icon={<Wind className="h-3 w-3" />}
              label="AC"
              className="text-blue-700 border-blue-200 bg-blue-50 dark:text-blue-300 dark:border-blue-800 dark:bg-blue-950/40"
            />
          )}
          {fuelLabel && (
            <FeaturePill icon={<Flame className="h-3 w-3" />} label={fuelLabel} />
          )}
        </div>

        {/* Best rate */}
        <div className="mt-auto">
          {bestRate ? (
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold">
                ₹{bestRate.price.toLocaleString("en-IN")}
              </span>
              <span className="text-xs text-muted-foreground">
                /{RATE_TYPES.find(r => r.value === bestRate.rate_type)?.unit ?? "trip"}
              </span>
              {vehicle.rates.length > 1 && (
                <span className="text-[10px] text-muted-foreground ml-1">
                  +{vehicle.rates.length - 1} more
                </span>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/50 italic">No rates configured</p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 pb-4 flex items-center gap-2 border-t pt-3">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <Switch
            checked={vehicle.is_active}
            onCheckedChange={v =>
              startToggleTransition(async () => onToggle(vehicle.id, v))
            }
            disabled={togglePending}
            className="scale-90 shrink-0"
          />
          <span className="text-xs text-muted-foreground truncate">
            {vehicle.is_active ? "Active" : "Inactive"}
          </span>
        </div>

        <Button
          type="button" variant="ghost" size="icon"
          className="h-7 w-7 shrink-0"
          onClick={onEdit}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button" variant="ghost" size="icon"
              className="h-7 w-7 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
              disabled={togglePending}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Vehicle</AlertDialogTitle>
              <AlertDialogDescription>
                Delete <span className="font-semibold">{vehicle.name}</span>? This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDelete(vehicle.id)}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export function VehiclesClient({ initialVehicles }: { initialVehicles: VehicleFull[] }) {
  const [vehicles, setVehicles]         = useState(initialVehicles);
  const [isPending, startTransition]    = useTransition();
  const [sheetOpen, setSheetOpen]       = useState(false);
  const [sheetKey, setSheetKey]         = useState(0);
  const [editingVehicle, setEditingVehicle] = useState<VehicleFull | null>(null);
  const [defaultType, setDefaultType]   = useState("SUV");

  const vehiclesByType = useMemo(() => {
    const map = new Map<string, VehicleFull[]>();
    for (const v of vehicles) {
      if (!map.has(v.type)) map.set(v.type, []);
      map.get(v.type)!.push(v);
    }
    return map;
  }, [vehicles]);

  const orderedTypes = VEHICLE_TYPES.filter(t => vehiclesByType.has(t.value));

  function openAddSheet(type: string) {
    setEditingVehicle(null);
    setDefaultType(type);
    setSheetKey(k => k + 1);
    setSheetOpen(true);
  }

  function openEditSheet(vehicle: VehicleFull) {
    setEditingVehicle(vehicle);
    setSheetKey(k => k + 1);
    setSheetOpen(true);
  }

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

  function handleSaveVehicle(form: VehicleFormState) {
    startTransition(async () => {
      const payload = {
        name: form.name,
        type: form.type,
        passenger_capacity: Number(form.passenger_capacity),
        luggage_bags: Number(form.luggage_bags),
        has_ac: form.has_ac,
        image_key: form.image_key || null,
        fuel_type: form.fuel_type || null,
        description: form.description || null,
      };

      if (editingVehicle) {
        const res = await updateVehicle(editingVehicle.id, payload);
        if (res.success) {
          toast.success(res.message);
          setSheetOpen(false);
          handleUpdate({ ...editingVehicle, ...payload });
        } else {
          toast.error(res.message);
        }
      } else {
        const res = await createVehicle(payload);
        if (res.success) {
          toast.success(res.message);
          setSheetOpen(false);
          const newVehicle: VehicleFull = {
            id: Date.now(), ...payload, is_active: true, rates: [],
          };
          setVehicles(prev => [...prev, newVehicle]);
        } else {
          toast.error(res.message);
        }
      }
    });
  }

  return (
    <>
      <PageHeader
        title="Vehicles"
        description="Manage your vehicle fleet for tours and transfers"
        icon={Car}
        actions={
          <Button
            size="lg"
            className="rounded-md bg-dashboard-primary text-dashboard-base-100 py-2.5 px-4 hover:bg-dashboard-primary hover:scale-105 duration-300 hover:text-dashboard-base-100 border border-dashboard-primary"
            onClick={() => openAddSheet(defaultType)}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add Vehicle
          </Button>
        }
      />

      {vehicles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-5">
          <div className="h-20 w-20 rounded-2xl bg-muted flex items-center justify-center">
            <Car className="h-10 w-10 text-muted-foreground/30" />
          </div>
          <div className="text-center space-y-1">
            <h3 className="font-semibold text-base">No vehicles in your fleet</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Add sedans, SUVs, tempo travellers, and buses to manage tour transfers and cab pricing.
            </p>
          </div>
          <Button
            size="lg"
            className="rounded-md bg-dashboard-primary text-dashboard-base-100 py-2.5 px-4 hover:bg-dashboard-primary hover:scale-105 duration-300 hover:text-dashboard-base-100 border border-dashboard-primary"
            onClick={() => openAddSheet("SUV")}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add Your First Vehicle
          </Button>
        </div>
      ) : (
        <div className="space-y-10">
          {orderedTypes.map(type => {
            const typeVehicles = vehiclesByType.get(type.value) ?? [];
            return (
              <section key={type.value} className="space-y-4">

                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Car className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold tracking-tight leading-none">{type.label}</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {typeVehicles.length} vehicle{typeVehicles.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-8 text-sm shrink-0"
                    onClick={() => openAddSheet(type.value)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add {type.label}
                  </Button>
                </div>

                <div className="border-t" />

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {typeVehicles.map(v => (
                    <VehicleCard
                      key={v.id}
                      vehicle={v}
                      onEdit={() => openEditSheet(v)}
                      onDelete={handleDelete}
                      onToggle={handleToggle}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <VehicleSheet
        key={sheetKey}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        vehicle={editingVehicle}
        defaultType={defaultType}
        onSave={handleSaveVehicle}
        isSaving={isPending}
      />
    </>
  );
}
