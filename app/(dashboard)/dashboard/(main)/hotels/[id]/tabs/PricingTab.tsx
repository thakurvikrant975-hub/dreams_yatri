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
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from "../../../components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "../../../components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { createRoomPricing, updateRoomPricing, deleteRoomPricing } from "../../actions";

// ── Types ─────────────────────────────────────────────────────────────────

type RoomOption = { id: number; name: string };
type MealType  = { id: number; name: string };
type DietType  = { id: number; name: string };

type PricingPlan = {
  id: number;
  hotel_id: number;
  room_id: number | null;
  plan_name: string | null;
  meal_type_id: number | null;
  diet_type_id: number | null;
  price_per_night: number;
  original_price: number | null;
  extra_bed_rate: number | null;
  margin_percentage: number;
  is_active: boolean;
  sort_order: number;
  room: { id: number; name: string } | null;
  meal_type: { id: number; name: string } | null;
  diet_type: { id: number; name: string } | null;
};

type PricingFormState = {
  room_id: string;
  plan_name: string;
  meal_type_id: string;
  diet_type_id: string;
  price_per_night: string;
  original_price: string;
  extra_bed_rate: string;
  margin_percentage: string;
  is_active: boolean;
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
  is_active: true,
};

// ── Helpers ───────────────────────────────────────────────────────────────

function toFormState(p: PricingPlan): PricingFormState {
  return {
    room_id: p.room_id ? String(p.room_id) : "",
    plan_name: p.plan_name ?? "",
    meal_type_id: p.meal_type_id ? String(p.meal_type_id) : "",
    diet_type_id: p.diet_type_id ? String(p.diet_type_id) : "",
    price_per_night: String(p.price_per_night),
    original_price: p.original_price ? String(p.original_price) : "",
    extra_bed_rate: p.extra_bed_rate ? String(p.extra_bed_rate) : "",
    margin_percentage: String(p.margin_percentage),
    is_active: p.is_active,
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
}: {
  initial: PricingFormState;
  rooms: RoomOption[];
  mealTypes: MealType[];
  dietTypes: DietType[];
  onSave: (form: PricingFormState) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<PricingFormState>(initial);
  function update<K extends keyof PricingFormState>(key: K, value: PricingFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const isValid = !!form.price_per_night && Number(form.price_per_night) > 0;

  return (
    <div className="border rounded-xl p-4 space-y-4 bg-muted/20">
      {/* Row 1: Room + Plan name */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Room</Label>
          <Select value={form.room_id} onValueChange={(v) => update("room_id", v)}>
            <SelectTrigger><SelectValue placeholder="Select room (optional)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— No specific room —</SelectItem>
              {rooms.map((r) => (
                <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Plan Name</Label>
          <Input
            placeholder="e.g. With Breakfast, Non-Veg Plan"
            value={form.plan_name}
            onChange={(e) => update("plan_name", e.target.value)}
          />
        </div>
      </div>

      {/* Row 2: Meal + Diet */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Meal Type</Label>
          <Select value={form.meal_type_id} onValueChange={(v) => update("meal_type_id", v)}>
            <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {mealTypes.map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Diet Type</Label>
          <Select value={form.diet_type_id} onValueChange={(v) => update("diet_type_id", v)}>
            <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {dietTypes.map((d) => (
                <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 3: Prices */}
      <div className="grid grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <Label>Price / Night (₹) <span className="text-destructive">*</span></Label>
          <Input
            type="number"
            placeholder="3500"
            value={form.price_per_night}
            onChange={(e) => update("price_per_night", e.target.value)}
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label>Original Price (₹)</Label>
          <Input
            type="number"
            placeholder="4500"
            value={form.original_price}
            onChange={(e) => update("original_price", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Extra Bed Rate (₹)</Label>
          <Input
            type="number"
            placeholder="800"
            value={form.extra_bed_rate}
            onChange={(e) => update("extra_bed_rate", e.target.value)}
          />
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
      </div>

      {/* Row 4: Active + Buttons */}
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
        toast.success(result.message);
        setAdding(false);
        const roomId = form.room_id && form.room_id !== "none" ? Number(form.room_id) : null;
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
            is_active: form.is_active,
            sort_order: prev.length,
            room: rooms.find((r) => r.id === roomId) ?? null,
            meal_type: mealTypes.find((m) => m.id === mealId) ?? null,
            diet_type: dietTypes.find((d) => d.id === dietId) ?? null,
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
        const roomId = form.room_id && form.room_id !== "none" ? Number(form.room_id) : null;
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

  // Group pricing by room for display
  const unassigned = pricing.filter((p) => !p.room_id);
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
              {pricing.length} plan{pricing.length !== 1 ? "s" : ""} · Each plan links to a room, meal and diet type
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
        {/* Add form */}
        {adding && (
          <PricingForm
            initial={EMPTY_FORM}
            rooms={rooms}
            mealTypes={mealTypes}
            dietTypes={dietTypes}
            onSave={handleAdd}
            onCancel={() => setAdding(false)}
            isSaving={isPending}
          />
        )}

        {pricing.length > 0 ? (
          <div className="space-y-6">
            {/* Plans per room */}
            {byRoom.map(({ room, plans }) => (
              <div key={room.id} className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  {room.name}
                </p>
                <PricingTable
                  plans={plans}
                  editId={editId}
                  rooms={rooms}
                  mealTypes={mealTypes}
                  dietTypes={dietTypes}
                  isPending={isPending}
                  onEdit={setEditId}
                  onSaveEdit={handleEdit}
                  onCancelEdit={() => setEditId(null)}
                  onDelete={handleDelete}
                />
              </div>
            ))}

            {/* Unassigned plans */}
            {unassigned.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  Unassigned
                </p>
                <PricingTable
                  plans={unassigned}
                  editId={editId}
                  rooms={rooms}
                  mealTypes={mealTypes}
                  dietTypes={dietTypes}
                  isPending={isPending}
                  onEdit={setEditId}
                  onSaveEdit={handleEdit}
                  onCancelEdit={() => setEditId(null)}
                  onDelete={handleDelete}
                />
              </div>
            )}
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

// ── Pricing Table ─────────────────────────────────────────────────────────

function PricingTable({
  plans,
  editId,
  rooms,
  mealTypes,
  dietTypes,
  isPending,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
}: {
  plans: PricingPlan[];
  editId: number | null;
  rooms: RoomOption[];
  mealTypes: MealType[];
  dietTypes: DietType[];
  isPending: boolean;
  onEdit: (id: number) => void;
  onSaveEdit: (id: number, form: PricingFormState) => void;
  onCancelEdit: () => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Plan</TableHead>
            <TableHead>Meal</TableHead>
            <TableHead>Diet</TableHead>
            <TableHead className="text-right">Price / Night</TableHead>
            <TableHead className="text-right">Margin</TableHead>
            <TableHead className="text-center">Active</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {plans.map((plan) =>
            editId === plan.id ? (
              <TableRow key={plan.id}>
                <TableCell colSpan={7} className="p-0">
                  <div className="p-3">
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
                </TableCell>
              </TableRow>
            ) : (
              <TableRow key={plan.id} className="hover:bg-muted/30">
                <TableCell>
                  <div>
                    <p className="font-medium text-sm">
                      {plan.plan_name || <span className="text-muted-foreground italic text-xs">No name</span>}
                    </p>
                    {plan.extra_bed_rate && (
                      <p className="text-xs text-muted-foreground">
                        Extra bed: ₹{plan.extra_bed_rate.toLocaleString()}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {plan.meal_type ? (
                    <Badge variant="outline" className="text-xs">{plan.meal_type.name}</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {plan.diet_type ? (
                    <Badge variant="secondary" className="text-xs">{plan.diet_type.name}</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <p className="font-semibold text-sm">₹{plan.price_per_night.toLocaleString()}</p>
                  {plan.original_price && (
                    <p className="text-xs text-muted-foreground line-through">
                      ₹{plan.original_price.toLocaleString()}
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {plan.margin_percentage}%
                </TableCell>
                <TableCell className="text-center">
                  <div
                    className={`h-2 w-2 rounded-full mx-auto ${plan.is_active ? "bg-green-500" : "bg-muted-foreground"}`}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onEdit(plan.id)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
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
                            Delete{" "}
                            <span className="font-semibold">
                              {plan.plan_name || "this pricing plan"}
                            </span>
                            ? This cannot be undone.
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
                </TableCell>
              </TableRow>
            )
          )}
        </TableBody>
      </Table>
    </div>
  );
}
