"use client";

import { useState, useTransition } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Switch } from "../../../components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "../../../components/ui/select";
import { Plus, Car, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { upsertCabOptionAction } from "@/app/actions/packages/pricing.actions";
import type { PackageCabOption } from "@/app/types/packages";

type CabOptionSerialized = {
  id: number;
  package_id: number;
  cab_type: string;
  capacity: number;
  rate_per_cab: number;
  is_default: boolean;
  is_active: boolean;
};

const CAB_TYPES = [
  { value: "SEDAN", label: "Sedan" },
  { value: "HATCHBACK", label: "Hatchback" },
  { value: "SUV", label: "SUV" },
  { value: "INNOVA", label: "Innova" },
  { value: "ERTIGA", label: "Ertiga" },
  { value: "WAGON_R", label: "Wagon R" },
  { value: "BOLERO", label: "Bolero" },
  { value: "TEMPO_TRAVELLER", label: "Tempo Traveller" },
  { value: "MINI_VAN", label: "Mini Van" },
  { value: "BUS", label: "Bus" },
] as const;

type CabType = typeof CAB_TYPES[number]["value"];

type Props = {
  packageId: number;
  cabOptions: CabOptionSerialized[];
};

type FormState = {
  cab_type: CabType | "";
  capacity: string;
  rate_per_cab: string;
  is_default: boolean;
  is_active: boolean;
};

const EMPTY_FORM: FormState = {
  cab_type: "",
  capacity: "4",
  rate_per_cab: "",
  is_default: false,
  is_active: true,
};

export function CabsTab({ packageId, cabOptions: init }: Props) {
  const [options, setOptions] = useState(init);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isPending, startTransition] = useTransition();

  // Find existing option for the selected cab_type
  const existingForType = form.cab_type
    ? options.find(o => o.cab_type === form.cab_type)
    : null;

  function openNew() {
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(opt: CabOptionSerialized) {
    setForm({
      cab_type: opt.cab_type as CabType,
      capacity: String(opt.capacity),
      rate_per_cab: String(opt.rate_per_cab),
      is_default: opt.is_default,
      is_active: opt.is_active,
    });
    setShowForm(true);
  }

  function handleSave() {
    if (!form.cab_type) return toast.error("Cab type is required");
    const capacity = parseInt(form.capacity);
    const rate = parseFloat(form.rate_per_cab);
    if (isNaN(capacity) || capacity < 1) return toast.error("Invalid capacity");
    if (isNaN(rate) || rate <= 0) return toast.error("Invalid rate");

    startTransition(async () => {
      const res = await upsertCabOptionAction({
        package_id: packageId,
        cab_type: form.cab_type as CabType,
        capacity,
        rate_per_cab: rate,
        is_default: form.is_default,
        is_active: form.is_active,
      });

      if (res.success) {
        toast.success(existingForType ? "Cab option updated" : "Cab option added");
        const updated: CabOptionSerialized = {
          id: existingForType?.id ?? 0,
          package_id: packageId,
          cab_type: form.cab_type as CabType,
          capacity,
          rate_per_cab: rate,
          is_default: form.is_default,
          is_active: form.is_active,
        };
        setOptions(opts => {
          const exists = opts.find(o => o.cab_type === form.cab_type);
          const base = form.is_default ? opts.map(o => ({ ...o, is_default: false })) : opts;
          return exists
            ? base.map(o => o.cab_type === form.cab_type ? updated : o)
            : [...base, updated];
        });
        setShowForm(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Cab Options</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Available vehicle types for this package with per-cab rates
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" /> Add Cab
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {options.length === 0 && !showForm && (
            <div className="flex flex-col items-center py-10 text-center">
              <Car className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No cab options yet</p>
              <p className="text-xs text-muted-foreground">Add vehicle options and rates for this package</p>
            </div>
          )}

          {options.map(opt => (
            <div key={opt.cab_type} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <Car className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">
                      {CAB_TYPES.find(c => c.value === opt.cab_type)?.label ?? opt.cab_type}
                    </p>
                    {opt.is_default && <Badge variant="default" className="text-xs">Default</Badge>}
                    {!opt.is_active && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Capacity: {opt.capacity} · ₹{opt.rate_per_cab.toLocaleString()} / cab
                  </p>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => openEdit(opt)}>Edit</Button>
            </div>
          ))}

          {showForm && (
            <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
              <p className="text-sm font-medium">{existingForType ? "Edit Cab Option" : "New Cab Option"}</p>

              <div className="space-y-1.5">
                <Label className="text-xs">Vehicle Type</Label>
                <Select
                  value={form.cab_type}
                  onValueChange={v => setForm(f => ({ ...f, cab_type: v as CabType }))}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select vehicle type" />
                  </SelectTrigger>
                  <SelectContent>
                    {CAB_TYPES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Capacity (persons)</Label>
                  <Input
                    type="number" min={1} max={60}
                    value={form.capacity}
                    onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Rate per Cab (₹)</Label>
                  <Input
                    type="number" min={0} step={100}
                    value={form.rate_per_cab}
                    onChange={e => setForm(f => ({ ...f, rate_per_cab: e.target.value }))}
                    placeholder="e.g. 12000"
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_default} onCheckedChange={v => setForm(f => ({ ...f, is_default: v }))} />
                  <Label className="text-sm">Default</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
                  <Label className="text-sm">Active</Label>
                </div>
              </div>

              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} disabled={isPending}>
                  {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                  {existingForType ? "Update" : "Add"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); }}>Cancel</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
