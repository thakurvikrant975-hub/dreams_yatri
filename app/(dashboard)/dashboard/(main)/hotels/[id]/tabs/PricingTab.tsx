"use client";

import { useState, useTransition } from "react";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Switch } from "../../../components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "../../../components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "../../../components/ui/alert-dialog";
import {
  Plus, Pencil, Trash2, Loader2, Check, X,
  ChevronDown, ChevronRight, Users,
} from "lucide-react";
import { DateRangePicker } from "../../../components/ui/date-range-picker";
import { toast } from "sonner";
import { cn } from "@/app/lib/utils";
import {
  createRoomPricing, updateRoomPricing, deleteRoomPricing,
  upsertOccupancyPrice, deleteOccupancyPrice,
} from "../../actions";

// ── Types ─────────────────────────────────────────────────────────────────

type RoomOption = { id: number; name: string };
type MealType  = { id: number; name: string };
type DietType  = { id: number; name: string };

type OccupancyPrice = {
  id: number;
  pricing_id: number;
  occupancy: number;
  price_per_night: number;
  original_price: number | null;
};

type PricingPlan = {
  id: number;
  hotel_id: number;
  room_id: number;
  plan_name: string | null;
  meal_type_id: number | null;
  diet_type_id: number | null;
  price_per_night: number;
  original_price: number | null;
  extra_bed_rate: number | null;
  margin_percentage: number;
  gst_percentage: number;
  valid_from: Date | string | null;
  valid_to: Date | string | null;
  is_active: boolean;
  sort_order: number;
  room: { id: number; name: string } | null;
  meal_type: { id: number; name: string } | null;
  diet_type: { id: number; name: string } | null;
  occupancy_prices: OccupancyPrice[];
};

type OccupancyEntry = { occupancy: number; price: string; original: string };

type PricingFormState = {
  room_id: string;
  plan_name: string;
  meal_type_id: string;
  diet_type_id: string;
  price_per_night: string;
  original_price: string;
  extra_bed_rate: string;
  margin_percentage: string;
  gst_percentage: string;
  valid_from: string;
  valid_to: string;
  is_active: boolean;
  occupancy_prices: OccupancyEntry[];
};

const EMPTY_FORM: PricingFormState = {
  room_id: "",
  plan_name: "",
  meal_type_id: "",
  diet_type_id: "",
  price_per_night: "",
  original_price: "",
  extra_bed_rate: "",
  margin_percentage: "10",
  gst_percentage: "18",
  valid_from: "",
  valid_to: "",
  is_active: true,
  occupancy_prices: [],
};

const OCCUPANCY_LABELS: Record<number, string> = {
  1: "Single (1P)",
  2: "Double (2P)",
  3: "Triple (3P)",
  4: "Quad (4P)",
};

const OCCUPANCY_OPTIONS = Object.entries(OCCUPANCY_LABELS)
  .map(([k, v]) => ({ value: Number(k), label: v }))
  .sort((a, b) => a.value - b.value);

// ── Helpers ───────────────────────────────────────────────────────────────

function toISODate(val: Date | string | null): string {
  if (!val) return "";
  const d = typeof val === "string" ? new Date(val) : val;
  return d.toISOString().split("T")[0];
}

function toFormState(p: PricingPlan): PricingFormState {
  return {
    room_id: String(p.room_id),
    plan_name: p.plan_name ?? "",
    meal_type_id: p.meal_type_id ? String(p.meal_type_id) : "",
    diet_type_id: p.diet_type_id ? String(p.diet_type_id) : "",
    price_per_night: String(p.price_per_night),
    original_price: p.original_price ? String(p.original_price) : "",
    extra_bed_rate: p.extra_bed_rate ? String(p.extra_bed_rate) : "",
    margin_percentage: String(p.margin_percentage),
    gst_percentage: String(p.gst_percentage),
    valid_from: toISODate(p.valid_from),
    valid_to: toISODate(p.valid_to),
    is_active: p.is_active,
    occupancy_prices: [],
  };
}

function buildFormData(form: PricingFormState): FormData {
  const fd = new FormData();
  fd.append("room_id",           form.room_id);
  fd.append("plan_name",         form.plan_name);
  fd.append("meal_type_id",      form.meal_type_id);
  fd.append("diet_type_id",      form.diet_type_id);
  fd.append("price_per_night",   form.price_per_night);
  fd.append("original_price",    form.original_price);
  fd.append("extra_bed_rate",    form.extra_bed_rate);
  fd.append("margin_percentage", form.margin_percentage);
  fd.append("gst_percentage",    form.gst_percentage);
  fd.append("valid_from",        form.valid_from);
  fd.append("valid_to",          form.valid_to);
  fd.append("is_active",         String(form.is_active));
  return fd;
}

// ── Pricing Form ──────────────────────────────────────────────────────────

function PricingForm({
  initial,
  rooms,
  mealTypes,
  dietTypes,
  onSave,
  onCancel,
  isSaving,
  isNew = false,
}: {
  initial: PricingFormState;
  rooms: RoomOption[];
  mealTypes: MealType[];
  dietTypes: DietType[];
  onSave: (form: PricingFormState) => void;
  onCancel: () => void;
  isSaving: boolean;
  isNew?: boolean;
}) {
  const [form, setForm] = useState<PricingFormState>(initial);
  function update<K extends keyof PricingFormState>(key: K, value: PricingFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const isValid = !!form.room_id && !!form.price_per_night && Number(form.price_per_night) > 0
    && !!form.valid_from && !!form.valid_to;

  return (
    <div className="border rounded-xl p-4 space-y-4 bg-muted/20">
      {/* Row 1: Room + Plan name */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Room <span className="text-destructive">*</span></Label>
          <Select value={form.room_id} onValueChange={(v) => update("room_id", v)}>
            <SelectTrigger><SelectValue placeholder="Select room" /></SelectTrigger>
            <SelectContent>
              {rooms.map((r) => (
                <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Plan Name</Label>
          <Input
            placeholder="e.g. Luxury Queen Room Riverside"
            value={form.plan_name}
            onChange={(e) => { const v = e.target.value; update("plan_name", v.charAt(0).toUpperCase() + v.slice(1)); }}
          />
        </div>
      </div>

      {/* Row 2: Meal + Diet */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Meal Type</Label>
          <Select value={form.meal_type_id} onValueChange={(v) => update("meal_type_id", v)}>
            <SelectTrigger><SelectValue placeholder="None (EP)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None (EP — Room Only)</SelectItem>
              {mealTypes.map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Diet Type</Label>
          <Select value={form.diet_type_id} onValueChange={(v) => update("diet_type_id", v)}>
            <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Any</SelectItem>
              {dietTypes.map((d) => (
                <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 3: Base price + Extra bed + Margin */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Base Price / Night (₹) <span className="text-destructive">*</span></Label>
          <Input
            type="number"
            placeholder="4500"
            value={form.price_per_night}
            onChange={(e) => update("price_per_night", e.target.value)}
            autoFocus
          />
          <p className="text-[10px] text-muted-foreground">Used when no occupancy price set</p>
        </div>
        <div className="space-y-1.5">
          <Label>Original Price (₹)</Label>
          <Input
            type="number"
            placeholder="6000"
            value={form.original_price}
            onChange={(e) => update("original_price", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Extra Bed Rate (₹)</Label>
          <Input
            type="number"
            placeholder="1200"
            value={form.extra_bed_rate}
            onChange={(e) => update("extra_bed_rate", e.target.value)}
          />
        </div>
      </div>

      {/* Row 4: Seasonal dates + Margin + GST */}
      <div className="grid grid-cols-4 gap-3">
        <div className="space-y-1.5 col-span-2">
          <Label>
            Valid Period <span className="text-destructive">*</span>
          </Label>
          <DateRangePicker
            from={form.valid_from}
            to={form.valid_to}
            onFromChange={v => update("valid_from", v)}
            onToChange={v => update("valid_to", v)}
            error={!form.valid_from || !form.valid_to}
          />
          {(!form.valid_from || !form.valid_to) && (
            <p className="text-[10px] text-destructive">Both dates required to save</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>Margin %</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={form.margin_percentage}
            onChange={(e) => update("margin_percentage", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>GST %</Label>
          <Input
            type="number"
            min={0}
            max={28}
            value={form.gst_percentage}
            onChange={(e) => update("gst_percentage", e.target.value)}
          />
          <p className="text-[10px] text-muted-foreground">12% (&lt;₹7500) / 18% (≥₹7500)</p>
        </div>
      </div>

      {isNew && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Occupancy Prices <span className="font-normal normal-case">(optional — overrides base price)</span>
          </p>
          {OCCUPANCY_OPTIONS.map((occ) => {
            const entry = form.occupancy_prices.find((e) => e.occupancy === occ.value);
            return (
              <div key={occ.value} className="flex items-center gap-2">
                <span className="text-xs w-24 shrink-0 text-muted-foreground">{occ.label}</span>
                <Input
                  type="number"
                  className="h-7 text-xs w-28"
                  placeholder="Price"
                  value={entry?.price ?? ""}
                  onChange={(e) => {
                    const price = e.target.value;
                    const existing = form.occupancy_prices.filter((x) => x.occupancy !== occ.value);
                    if (price) {
                      update("occupancy_prices", [...existing, { occupancy: occ.value, price, original: entry?.original ?? "" }]);
                    } else {
                      update("occupancy_prices", existing);
                    }
                  }}
                />
                <Input
                  type="number"
                  className="h-7 text-xs w-28"
                  placeholder="MRP (optional)"
                  value={entry?.original ?? ""}
                  onChange={(e) => {
                    const original = e.target.value;
                    const existing = form.occupancy_prices.filter((x) => x.occupancy !== occ.value);
                    if (entry?.price) {
                      update("occupancy_prices", [...existing, { occupancy: occ.value, price: entry.price, original }]);
                    }
                  }}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Row 5: Active + Buttons */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <Switch checked={form.is_active} onCheckedChange={(v) => update("is_active", v)} />
          <span className="text-sm text-muted-foreground">Active</span>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isSaving}>
            <X className="mr-1 h-3.5 w-3.5" /> Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!isValid || isSaving}
            onClick={() => onSave(form)}
          >
            {isSaving
              ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Saving...</>
              : <><Check className="mr-1.5 h-3.5 w-3.5" />Save Plan</>
            }
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Occupancy Prices ──────────────────────────────────────────────────────

function OccupancyPricesPanel({
  plan,
  hotelId,
  onUpdated,
}: {
  plan: PricingPlan;
  hotelId: number;
  onUpdated: (prices: OccupancyPrice[]) => void;
}) {
  const [saving, setSaving] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [editOccupancy, setEditOccupancy] = useState<number | null>(null);
  const [addOccupancy, setAddOccupancy] = useState<string>("");
  const [addPrice, setAddPrice] = useState("");
  const [addOriginal, setAddOriginal] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editOriginal, setEditOriginal] = useState("");

  const existingOccupancies = new Set(plan.occupancy_prices.map((p) => p.occupancy));
  const availableOccupancies = [1, 2, 3, 4].filter((o) => !existingOccupancies.has(o));

  async function handleUpsert(occupancy: number, price: string, original: string, existingId?: number) {
    const p = Number(price);
    if (!p || p <= 0) { toast.error("Valid price required"); return; }
    setSaving(occupancy);
    const res = await upsertOccupancyPrice(
      plan.id, hotelId, occupancy, p,
      original ? Number(original) : null,
    );
    setSaving(null);
    if (!res.success) { toast.error(res.message); return; }
    const newEntry: OccupancyPrice = {
      id: existingId ?? Date.now(),
      pricing_id: plan.id,
      occupancy,
      price_per_night: p,
      original_price: original ? Number(original) : null,
    };
    onUpdated(
      existingId
        ? plan.occupancy_prices.map((op) => (op.occupancy === occupancy ? newEntry : op))
        : [...plan.occupancy_prices, newEntry].sort((a, b) => a.occupancy - b.occupancy),
    );
    setEditOccupancy(null);
    setAddOccupancy("");
    setAddPrice("");
    setAddOriginal("");
    toast.success("Occupancy price saved");
  }

  async function handleDelete(entry: OccupancyPrice) {
    setDeleting(entry.id);
    const res = await deleteOccupancyPrice(entry.id, hotelId);
    setDeleting(null);
    if (!res.success) { toast.error(res.message); return; }
    onUpdated(plan.occupancy_prices.filter((op) => op.id !== entry.id));
    toast.success("Removed");
  }

  return (
    <div className="px-4 pb-4 pt-1 space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        <Users className="h-3 w-3" /> Occupancy Prices
      </p>

      {/* Existing rows */}
      {plan.occupancy_prices.map((op) => (
        <div key={op.occupancy} className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-1.5">
          <span className="text-xs font-medium w-24 shrink-0">{OCCUPANCY_LABELS[op.occupancy] ?? `${op.occupancy}P`}</span>

          {editOccupancy === op.occupancy ? (
            <>
              <Input
                type="number"
                className="h-7 text-xs w-28"
                placeholder="Price"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                autoFocus
              />
              <Input
                type="number"
                className="h-7 text-xs w-28"
                placeholder="MRP (optional)"
                value={editOriginal}
                onChange={(e) => setEditOriginal(e.target.value)}
              />
              <Button
                type="button" size="sm" variant="ghost" className="h-7 px-2"
                disabled={saving === op.occupancy}
                onClick={() => handleUpsert(op.occupancy, editPrice, editOriginal, op.id)}
              >
                {saving === op.occupancy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditOccupancy(null)}>
                <X className="h-3 w-3" />
              </Button>
            </>
          ) : (
            <>
              <span className="text-sm font-semibold flex-1">₹{op.price_per_night.toLocaleString()}</span>
              {op.original_price && (
                <span className="text-xs text-muted-foreground line-through">₹{op.original_price.toLocaleString()}</span>
              )}
              <Button
                type="button" size="icon" variant="ghost" className="h-6 w-6 ml-auto"
                onClick={() => { setEditOccupancy(op.occupancy); setEditPrice(String(op.price_per_night)); setEditOriginal(op.original_price ? String(op.original_price) : ""); }}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                type="button" size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive"
                disabled={deleting === op.id}
                onClick={() => handleDelete(op)}
              >
                {deleting === op.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              </Button>
            </>
          )}
        </div>
      ))}

      {/* Add new occupancy row */}
      {availableOccupancies.length > 0 && (
        <div className="flex items-center gap-2">
          <Select value={addOccupancy} onValueChange={setAddOccupancy}>
            <SelectTrigger className="h-7 text-xs w-32">
              <SelectValue placeholder="Add…" />
            </SelectTrigger>
            <SelectContent>
              {availableOccupancies.map((o) => (
                <SelectItem key={o} value={String(o)}>{OCCUPANCY_LABELS[o] ?? `${o}P`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {addOccupancy && (
            <>
              <Input
                type="number"
                className="h-7 text-xs w-28"
                placeholder="Price / night"
                value={addPrice}
                onChange={(e) => setAddPrice(e.target.value)}
                autoFocus
              />
              <Input
                type="number"
                className="h-7 text-xs w-28"
                placeholder="MRP (optional)"
                value={addOriginal}
                onChange={(e) => setAddOriginal(e.target.value)}
              />
              <Button
                type="button" size="sm" variant="outline" className="h-7 px-2 text-xs"
                disabled={saving === Number(addOccupancy)}
                onClick={() => handleUpsert(Number(addOccupancy), addPrice, addOriginal)}
              >
                {saving === Number(addOccupancy) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              </Button>
            </>
          )}
        </div>
      )}

      {plan.occupancy_prices.length === 0 && !addOccupancy && (
        <p className="text-[10px] text-muted-foreground/60 italic">
          No occupancy prices yet — base price will be used. Add occupancy prices for single/double/triple rates.
        </p>
      )}
    </div>
  );
}

// ── Plan Row ──────────────────────────────────────────────────────────────

function PlanRow({
  plan,
  hotelId,
  editId,
  rooms,
  mealTypes,
  dietTypes,
  isPending,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onOccupancyUpdated,
}: {
  plan: PricingPlan;
  hotelId: number;
  editId: number | null;
  rooms: RoomOption[];
  mealTypes: MealType[];
  dietTypes: DietType[];
  isPending: boolean;
  onEdit: (id: number) => void;
  onSaveEdit: (id: number, form: PricingFormState) => void;
  onCancelEdit: () => void;
  onDelete: (id: number) => void;
  onOccupancyUpdated: (planId: number, prices: OccupancyPrice[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (editId === plan.id) {
    return (
      <div className="p-3 border rounded-lg">
        <PricingForm
          initial={toFormState(plan)}
          rooms={rooms}
          mealTypes={mealTypes}
          dietTypes={dietTypes}
          onSave={(form) => onSaveEdit(plan.id, form)}
          onCancel={onCancelEdit}
          isSaving={isPending}
        />
      </div>
    );
  }

  const hasSeason = plan.valid_from || plan.valid_to;
  const occupancySummary = plan.occupancy_prices
    .map((op) => `${op.occupancy}P: ₹${op.price_per_night.toLocaleString()}`)
    .join(" · ");

  return (
    <div className={cn("border rounded-lg overflow-hidden", !plan.is_active && "opacity-60")}>
      {/* Plan header row */}
      <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/20">
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium">
              {plan.plan_name || <span className="text-muted-foreground italic text-xs">Unnamed plan</span>}
            </p>
            {plan.meal_type && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{plan.meal_type.name}</Badge>
            )}
            {plan.diet_type && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{plan.diet_type.name}</Badge>
            )}
            {!plan.is_active && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">Inactive</Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <p className="text-xs text-muted-foreground">
              Base: <span className="font-semibold text-foreground">₹{plan.price_per_night.toLocaleString()}</span>/night
              {plan.original_price && (
                <span className="line-through ml-1 text-muted-foreground/70">₹{plan.original_price.toLocaleString()}</span>
              )}
            </p>
            {plan.extra_bed_rate && (
              <p className="text-xs text-muted-foreground">Extra bed: ₹{plan.extra_bed_rate.toLocaleString()}</p>
            )}
            {occupancySummary && (
              <p className="text-[10px] text-primary/80">{occupancySummary}</p>
            )}
            {hasSeason && (
              <p className="text-[10px] text-orange-600/80">
                {plan.valid_from ? toISODate(plan.valid_from) : "∞"} – {plan.valid_to ? toISODate(plan.valid_to) : "∞"}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end shrink-0 gap-0.5">
          <p className="text-xs text-muted-foreground">{plan.margin_percentage}% margin</p>
          <p className="text-[10px] text-muted-foreground/70">GST {plan.gst_percentage}%</p>
        </div>

        <div className="flex gap-1 shrink-0">
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(plan.id)}>
            <Pencil className="h-3 w-3" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button" variant="ghost" size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                disabled={isPending}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Plan</AlertDialogTitle>
                <AlertDialogDescription>
                  Delete <span className="font-semibold">{plan.plan_name || "this pricing plan"}</span>? All occupancy prices will also be deleted. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(plan.id)}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Expanded: occupancy prices */}
      {expanded && (
        <div className="border-t bg-muted/10">
          <OccupancyPricesPanel
            plan={plan}
            hotelId={hotelId}
            onUpdated={(prices) => onOccupancyUpdated(plan.id, prices)}
          />
        </div>
      )}
    </div>
  );
}

// ── Main PricingTab ───────────────────────────────────────────────────────

export function PricingTab({
  hotel_id,
  rooms,
  pricing: initialPricing,
  mealTypes,
  dietTypes,
}: {
  hotel_id: number;
  rooms: RoomOption[];
  pricing: PricingPlan[];
  mealTypes: MealType[];
  dietTypes: DietType[];
}) {
  const [pricing, setPricing] = useState<PricingPlan[]>(initialPricing);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAdd(form: PricingFormState) {
    startTransition(async () => {
      const result = await createRoomPricing(hotel_id, buildFormData(form));
      if (result.success) {
        const planId = result.id!;
        const savedPrices: OccupancyPrice[] = [];
        for (const entry of form.occupancy_prices) {
          if (entry.price && Number(entry.price) > 0) {
            const r = await upsertOccupancyPrice(
              planId,
              hotel_id,
              entry.occupancy,
              Number(entry.price),
              entry.original ? Number(entry.original) : null,
            );
            if (r.success) {
              savedPrices.push({
                id: Date.now() + savedPrices.length,
                pricing_id: planId,
                occupancy: entry.occupancy,
                price_per_night: Number(entry.price),
                original_price: entry.original ? Number(entry.original) : null,
              });
            }
          }
        }
        toast.success(result.message);
        setAdding(false);
        const roomId = Number(form.room_id);
        const mealId = form.meal_type_id && form.meal_type_id !== "none" ? Number(form.meal_type_id) : null;
        const dietId = form.diet_type_id && form.diet_type_id !== "none" ? Number(form.diet_type_id) : null;
        setPricing((prev) => [
          ...prev,
          {
            id: Date.now(),
            hotel_id,
            room_id: roomId,
            plan_name: form.plan_name || null,
            meal_type_id: mealId,
            diet_type_id: dietId,
            price_per_night: Number(form.price_per_night),
            original_price: form.original_price ? Number(form.original_price) : null,
            extra_bed_rate: form.extra_bed_rate ? Number(form.extra_bed_rate) : null,
            margin_percentage: Number(form.margin_percentage),
            gst_percentage: Number(form.gst_percentage),
            valid_from: form.valid_from || null,
            valid_to: form.valid_to || null,
            is_active: form.is_active,
            sort_order: prev.length,
            room: rooms.find((r) => r.id === roomId) ?? null,
            meal_type: mealTypes.find((m) => m.id === mealId) ?? null,
            diet_type: dietTypes.find((d) => d.id === dietId) ?? null,
            occupancy_prices: savedPrices,
          },
        ]);
      } else {
        toast.error(result.message);
      }
    });
  }

  function handleEdit(id: number, form: PricingFormState) {
    startTransition(async () => {
      const result = await updateRoomPricing(id, hotel_id, buildFormData(form));
      if (result.success) {
        toast.success(result.message);
        setEditId(null);
        const roomId = Number(form.room_id);
        const mealId = form.meal_type_id && form.meal_type_id !== "none" ? Number(form.meal_type_id) : null;
        const dietId = form.diet_type_id && form.diet_type_id !== "none" ? Number(form.diet_type_id) : null;
        setPricing((prev) =>
          prev.map((p) =>
            p.id === id
              ? {
                  ...p,
                  room_id: roomId,
                  plan_name: form.plan_name || null,
                  meal_type_id: mealId,
                  diet_type_id: dietId,
                  price_per_night: Number(form.price_per_night),
                  original_price: form.original_price ? Number(form.original_price) : null,
                  extra_bed_rate: form.extra_bed_rate ? Number(form.extra_bed_rate) : null,
                  margin_percentage: Number(form.margin_percentage),
                  gst_percentage: Number(form.gst_percentage),
                  valid_from: form.valid_from || null,
                  valid_to: form.valid_to || null,
                  is_active: form.is_active,
                  room: rooms.find((r) => r.id === roomId) ?? null,
                  meal_type: mealTypes.find((m) => m.id === mealId) ?? null,
                  diet_type: dietTypes.find((d) => d.id === dietId) ?? null,
                }
              : p
          )
        );
      } else {
        toast.error(result.message);
      }
    });
  }

  function handleDelete(id: number) {
    startTransition(async () => {
      const result = await deleteRoomPricing(id, hotel_id);
      if (result.success) {
        toast.success(result.message);
        setPricing((prev) => prev.filter((p) => p.id !== id));
      } else {
        toast.error(result.message);
      }
    });
  }

  function handleOccupancyUpdated(planId: number, prices: OccupancyPrice[]) {
    setPricing((prev) =>
      prev.map((p) => (p.id === planId ? { ...p, occupancy_prices: prices } : p))
    );
  }

  const byRoom = rooms.map((room) => ({
    room,
    plans: pricing.filter((p) => p.room_id === room.id),
  })).filter((g) => g.plans.length > 0);

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Pricing Plans</CardTitle>
            <CardDescription>
              {pricing.length} plan{pricing.length !== 1 ? "s" : ""} · Room required · Expand a plan to set occupancy prices
            </CardDescription>
          </div>
          {!adding && editId === null && (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Plan
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {adding && (
          <PricingForm
            initial={EMPTY_FORM}
            rooms={rooms}
            mealTypes={mealTypes}
            dietTypes={dietTypes}
            onSave={handleAdd}
            onCancel={() => setAdding(false)}
            isSaving={isPending}
            isNew
          />
        )}

        {byRoom.length > 0 ? (
          <div className="space-y-6">
            {byRoom.map(({ room, plans }) => (
              <div key={room.id} className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  {room.name}
                </p>
                <div className="space-y-2">
                  {plans.map((plan) => (
                    <PlanRow
                      key={plan.id}
                      plan={plan}
                      hotelId={hotel_id}
                      editId={editId}
                      rooms={rooms}
                      mealTypes={mealTypes}
                      dietTypes={dietTypes}
                      isPending={isPending}
                      onEdit={setEditId}
                      onSaveEdit={handleEdit}
                      onCancelEdit={() => setEditId(null)}
                      onDelete={handleDelete}
                      onOccupancyUpdated={handleOccupancyUpdated}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : !adding && (
          <div className="text-center py-10 text-muted-foreground">
            <p className="text-sm">No pricing plans yet</p>
            <p className="text-xs mt-1">Click "Add Plan" to create your first pricing plan</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
