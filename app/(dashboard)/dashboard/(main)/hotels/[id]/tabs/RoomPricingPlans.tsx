"use client";

import { useState, useTransition, useEffect } from "react";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { Switch } from "../../../components/ui/switch";
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
import { Plus, Pencil, Trash2, Loader2, CalendarDays, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/app/lib/utils";
import {
  createRoomPricingWithSeasons, updateRoomPricingWithSeasons, deleteRoomPricing,
  upsertOccupancyPrice, deleteOccupancyPrice,
} from "../../actions";
import {
  PricingForm, toFormState,
  buildSeasonsInput, buildOptimisticSeasons, combinedOccupancyEntries, buildAutoName,
  type PricingPlan, type MealType, type DietType, type PricingFormState,
} from "./PricingTab";

// ── Batch add — one form, several {meal type, price} variants at once ──────

type BatchRow = {
  tempId: string;
  meal_type_id: string; // "" (unselected) | "none" (Room Only) | numeric string
  plan_name: string;
  plan_name_touched: boolean; // stops auto-fill once the admin edits it directly
  price: string;
};

function newBatchRow(): BatchRow {
  return { tempId: Math.random().toString(36).slice(2), meal_type_id: "", plan_name: "", plan_name_touched: false, price: "" };
}

function AddPlanBatchForm({
  room,
  mealTypes,
  dietTypes,
  defaultMargin,
  defaultGst,
  onSave,
  onCancel,
  isSaving,
}: {
  room: { id: number; name: string };
  mealTypes: MealType[];
  dietTypes: DietType[];
  defaultMargin: string;
  defaultGst: string;
  onSave: (rows: BatchRow[], shared: { diet_type_id: string; margin_percentage: string; gst_percentage: string; notes: string; is_active: boolean }) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [rows, setRows] = useState<BatchRow[]>([newBatchRow()]);
  const [dietTypeId, setDietTypeId] = useState("");
  const [margin, setMargin] = useState(defaultMargin);
  const [gst, setGst] = useState(defaultGst);
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);

  function updateRow(tempId: string, patch: Partial<BatchRow>) {
    setRows(prev => prev.map(r => (r.tempId === tempId ? { ...r, ...patch } : r)));
  }

  function handleMealChange(tempId: string, mealId: string) {
    const mealType = mealTypes.find(m => String(m.id) === mealId) ?? null;
    setRows(prev => prev.map(r => {
      if (r.tempId !== tempId) return r;
      const autoName = buildAutoName(room.name, mealId === "none" ? null : mealType);
      return { ...r, meal_type_id: mealId, plan_name: r.plan_name_touched ? r.plan_name : autoName };
    }));
  }

  function handleNameChange(tempId: string, name: string) {
    updateRow(tempId, { plan_name: name, plan_name_touched: true });
  }

  function removeRow(tempId: string) {
    setRows(prev => (prev.length > 1 ? prev.filter(r => r.tempId !== tempId) : prev));
  }

  const validRowCount = rows.filter(r => r.meal_type_id && Number(r.price) > 0).length;

  return (
    <div className="border border-dashboard-base-content/20 rounded-xl p-4 space-y-4 bg-dashboard-base-200/60">
      <p className="text-xs text-dashboard-base-content/50">
        Add every meal-plan variant for <span className="font-semibold">{room.name}</span> in one go — margin, GST, diet type and notes below apply to all of them.
      </p>

      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={row.tempId} className="grid grid-cols-[1fr_1fr_140px_auto] gap-2 items-start">
            <div className="space-y-1">
              {i === 0 && <Label className="text-xs text-dashboard-base-content/60">Meal Type <span className="text-dashboard-error">*</span></Label>}
              <Select value={row.meal_type_id} onValueChange={v => handleMealChange(row.tempId, v)}>
                <SelectTrigger className={cn("h-9 bg-dashboard-base-100 border-dashboard-base-content/20 cursor-pointer text-sm", !row.meal_type_id && "border-dashboard-error/40")}>
                  <SelectValue placeholder="Select meal plan…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="cursor-pointer">Room Only (EP)</SelectItem>
                  {mealTypes.map(m => <SelectItem key={m.id} value={String(m.id)} className="cursor-pointer">{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              {i === 0 && <Label className="text-xs text-dashboard-base-content/60">Plan Name <span className="text-xs font-normal">(auto-filled)</span></Label>}
              <Input value={row.plan_name} onChange={e => handleNameChange(row.tempId, e.target.value)}
                placeholder="e.g. Deluxe Room with Breakfast"
                className="h-9 bg-dashboard-base-100 border-dashboard-base-content/20 text-sm" />
            </div>
            <div className="space-y-1">
              {i === 0 && <Label className="text-xs text-dashboard-base-content/60">Price/Night (₹) <span className="text-dashboard-error">*</span></Label>}
              <Input type="number" value={row.price} onChange={e => updateRow(row.tempId, { price: e.target.value })}
                placeholder="e.g. 3000"
                className="h-9 bg-dashboard-base-100 border-dashboard-base-content/20 text-sm" />
            </div>
            <div className={cn("flex", i === 0 ? "pt-6" : "pt-0")}>
              <Button type="button" variant="ghost" size="icon"
                className="h-9 w-9 text-dashboard-base-content/40 hover:text-dashboard-error hover:bg-dashboard-error/10 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                disabled={rows.length === 1} onClick={() => removeRow(row.tempId)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" size="sm"
        className="h-8 gap-1 text-xs cursor-pointer"
        onClick={() => setRows(prev => [...prev, newBatchRow()])}>
        <Plus className="h-3 w-3" /> Add another variant
      </Button>

      {/* Shared fields — apply to every variant in this batch */}
      <div className="border-t border-dashboard-base-content/10 pt-3 grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm text-dashboard-base-content">Diet Type</Label>
          <Select value={dietTypeId} onValueChange={setDietTypeId}>
            <SelectTrigger className="bg-dashboard-base-100 border-dashboard-base-content/20 cursor-pointer">
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="cursor-pointer">Any</SelectItem>
              {dietTypes.map(d => <SelectItem key={d.id} value={String(d.id)} className="cursor-pointer">{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm text-dashboard-base-content">Margin %</Label>
          <Input type="number" min={0} max={100} value={margin} onChange={e => setMargin(e.target.value)}
            className="bg-dashboard-base-100 border-dashboard-base-content/20" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm text-dashboard-base-content">GST %</Label>
          <Input type="number" min={0} max={28} value={gst} onChange={e => setGst(e.target.value)}
            className="bg-dashboard-base-100 border-dashboard-base-content/20" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm text-dashboard-base-content">Notes <span className="text-xs font-normal text-dashboard-base-content/50">(optional, internal only)</span></Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          placeholder="Applies to all variants added in this batch"
          className="bg-dashboard-base-100 border-dashboard-base-content/20 text-sm resize-y" />
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-dashboard-base-content/10">
        <div className="flex items-center gap-2">
          <Switch checked={isActive} onCheckedChange={setIsActive} />
          <span className="text-sm text-dashboard-base-content/60">Active</span>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isSaving}
            className="text-dashboard-base-content/60 hover:text-dashboard-base-content hover:bg-dashboard-base-300 cursor-pointer">
            Cancel
          </Button>
          <Button type="button" size="sm" disabled={validRowCount === 0 || isSaving}
            onClick={() => onSave(rows, { diet_type_id: dietTypeId, margin_percentage: margin, gst_percentage: gst, notes, is_active: isActive })}
            className="bg-dashboard-primary text-dashboard-primary-content hover:bg-dashboard-primary/90 cursor-pointer">
            {isSaving
              ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Saving…</>
              : `Save ${validRowCount || ""} Plan${validRowCount === 1 ? "" : "s"}`.replace("  ", " ")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// A room's plans are entirely self-contained here (seasons stay scoped to
// this one room per the "across rows, not rooms" design — no cross-room
// templates), so this component owns its own local copy of the room's plan
// list rather than bubbling every change back up to RoomsTab.
export function RoomPricingPlans({
  hotelId,
  room,
  plans: initialPlans,
  mealTypes,
  dietTypes,
  onPlansChanged,
}: {
  hotelId: number;
  room: { id: number; name: string };
  plans: PricingPlan[];
  mealTypes: MealType[];
  dietTypes: DietType[];
  /** Bubbles the room's plan list up so the collapsed row's plan-count badge
   * (owned by the parent RoomRow, mirroring RoomImagesSection/onImagesChanged)
   * stays accurate without a page refresh. */
  onPlansChanged?: (plans: PricingPlan[]) => void;
}) {
  const [plans, setPlans] = useState<PricingPlan[]>(initialPlans);
  // Notify the parent RoomRow after commit, not during — calling a parent
  // setState from inside this component's own state updater (synchronously,
  // mid-render) trips React's "setState while rendering a different
  // component" guard.
  useEffect(() => {
    onPlansChanged?.(plans);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans]);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const roomOption = [{ id: room.id, name: room.name }];

  // New plans inherit the room's most-recently-added plan's margin/GST
  // instead of re-asking — most of a room's plans share the same commercial
  // terms, only the meal inclusion and price actually change between them.
  const lastPlan = plans[plans.length - 1];
  const defaultMargin = lastPlan ? String(lastPlan.margin_percentage) : "10";
  const defaultGst = lastPlan ? String(lastPlan.gst_percentage) : "18";

  function handleAddBatch(
    rows: BatchRow[],
    shared: { diet_type_id: string; margin_percentage: string; gst_percentage: string; notes: string; is_active: boolean },
  ) {
    const validRows = rows.filter(r => r.meal_type_id && Number(r.price) > 0);
    if (validRows.length === 0) return;

    startTransition(async () => {
      const dietId = shared.diet_type_id && shared.diet_type_id !== "none" ? Number(shared.diet_type_id) : null;
      const margin = Number(shared.margin_percentage) || 10;
      const gst = Number(shared.gst_percentage) || 18;
      const notes = shared.notes.trim() || null;

      const created: PricingPlan[] = [];
      let failures = 0;

      for (const row of validRows) {
        const mealId = row.meal_type_id !== "none" ? Number(row.meal_type_id) : null;
        const result = await createRoomPricingWithSeasons(hotelId, {
          room_id: room.id,
          plan_name: row.plan_name || null,
          meal_type_id: mealId,
          diet_type_id: dietId,
          price_per_night: Number(row.price),
          margin_percentage: margin,
          gst_percentage: gst,
          is_active: shared.is_active,
          notes,
          seasons: [],
        });

        if (!result.success) { failures++; continue; }

        created.push({
          id: result.id!,
          hotel_id: hotelId,
          room_id: room.id,
          plan_name: row.plan_name || null,
          meal_type_id: mealId,
          diet_type_id: dietId,
          price_per_night: Number(row.price),
          original_price: null,
          extra_bed_rate: null,
          weekend_price_per_night: null,
          weekend_extra_bed_rate: null,
          margin_percentage: margin,
          gst_percentage: gst,
          notes,
          valid_from: null,
          valid_to: null,
          is_active: shared.is_active,
          sort_order: plans.length + created.length,
          room: { id: room.id, name: room.name },
          meal_type: mealTypes.find(m => m.id === mealId) ?? null,
          diet_type: dietTypes.find(d => d.id === dietId) ?? null,
          occupancy_prices: [],
          seasons: [],
        });
      }

      if (created.length > 0) {
        toast.success(
          failures > 0
            ? `${created.length} plan${created.length === 1 ? "" : "s"} added, ${failures} failed`
            : `${created.length} plan${created.length === 1 ? "" : "s"} added`,
        );
        setPlans(prev => [...prev, ...created]);
        setAdding(false);
      } else {
        toast.error("Couldn't save any plans — please try again.");
      }
    });
  }

  function handleEdit(id: number, form: PricingFormState) {
    startTransition(async () => {
      const seasons = buildSeasonsInput(form);

      const result = await updateRoomPricingWithSeasons(id, hotelId, {
        room_id: room.id,
        plan_name: form.plan_name || null,
        meal_type_id: form.meal_type_id && form.meal_type_id !== "none" ? Number(form.meal_type_id) : null,
        diet_type_id: form.diet_type_id && form.diet_type_id !== "none" ? Number(form.diet_type_id) : null,
        price_per_night: Number(form.base_price_per_night) || null,
        extra_bed_rate: form.base_extra_bed_rate ? Number(form.base_extra_bed_rate) : null,
        weekend_price_per_night: form.base_weekend_price_per_night ? Number(form.base_weekend_price_per_night) : null,
        weekend_extra_bed_rate: form.base_weekend_extra_bed_rate ? Number(form.base_weekend_extra_bed_rate) : null,
        margin_percentage: Number(form.margin_percentage) || 10,
        gst_percentage: Number(form.gst_percentage) || 18,
        is_active: form.is_active,
        notes: form.notes.trim() || null,
        seasons,
      });

      if (!result.success) { toast.error(result.message); return; }

      const existingPlan = plans.find(p => p.id === id);
      const initialOccMap = new Map((existingPlan?.occupancy_prices ?? []).map(op => [op.occupancy, op]));
      const finalMap = new Map(
        combinedOccupancyEntries(form)
          .filter(e => e.price && Number(e.price) > 0)
          .map(e => [e.occupancy, e]),
      );
      const updatedPrices: PricingPlan["occupancy_prices"] = [];
      for (const [occ, entry] of finalMap) {
        const r = await upsertOccupancyPrice(id, hotelId, occ, Number(entry.price), entry.original ? Number(entry.original) : null,
          entry.weekendPrice ? Number(entry.weekendPrice) : null);
        if (r.success) {
          updatedPrices.push({
            id: initialOccMap.get(occ)?.id ?? Date.now() + occ,
            pricing_id: id,
            occupancy: occ,
            price_per_night: Number(entry.price),
            original_price: entry.original ? Number(entry.original) : null,
            weekend_price_per_night: entry.weekendPrice ? Number(entry.weekendPrice) : null,
          });
        }
      }
      for (const [occ, op] of initialOccMap) {
        if (!finalMap.has(occ)) await deleteOccupancyPrice(op.id, hotelId);
      }

      toast.success(result.message);
      setEditId(null);

      const mealId = form.meal_type_id && form.meal_type_id !== "none" ? Number(form.meal_type_id) : null;
      const dietId = form.diet_type_id && form.diet_type_id !== "none" ? Number(form.diet_type_id) : null;
      const now = Date.now();

      setPlans(prev =>
        prev.map(p =>
          p.id === id ? {
            ...p,
            plan_name: form.plan_name || null,
            meal_type_id: mealId,
            diet_type_id: dietId,
            price_per_night: Number(form.base_price_per_night) || Number(seasons[0]?.price_per_night) || p.price_per_night,
            extra_bed_rate: form.base_extra_bed_rate ? Number(form.base_extra_bed_rate) : null,
            weekend_price_per_night: form.base_weekend_price_per_night ? Number(form.base_weekend_price_per_night) : null,
            weekend_extra_bed_rate: form.base_weekend_extra_bed_rate ? Number(form.base_weekend_extra_bed_rate) : null,
            occupancy_prices: updatedPrices,
            margin_percentage: Number(form.margin_percentage),
            gst_percentage: Number(form.gst_percentage),
            notes: form.notes.trim() || null,
            is_active: form.is_active,
            meal_type: mealTypes.find(m => m.id === mealId) ?? null,
            diet_type: dietTypes.find(d => d.id === dietId) ?? null,
            seasons: buildOptimisticSeasons(seasons, id, now),
          } : p,
        ),
      );
    });
  }

  function handleDelete(id: number) {
    startTransition(async () => {
      const result = await deleteRoomPricing(id, hotelId);
      if (result.success) {
        toast.success(result.message);
        setPlans(prev => prev.filter(p => p.id !== id));
      } else {
        toast.error(result.message);
      }
    });
  }

  function handleSeasonsUpdated(planId: number, seasons: PricingPlan["seasons"]) {
    setPlans(prev => prev.map(p => (p.id === planId ? { ...p, seasons } : p)));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-dashboard-base-content/50 uppercase tracking-wider">
          Pricing Plans ({plans.length})
        </p>
        {!adding && editId === null && (
          <Button type="button" size="sm" variant="outline"
            className="h-7 gap-1 text-xs cursor-pointer"
            onClick={() => setAdding(true)}>
            <Plus className="h-3 w-3" /> Add Plan
          </Button>
        )}
      </div>

      {adding && (
        <AddPlanBatchForm
          room={room}
          mealTypes={mealTypes}
          dietTypes={dietTypes}
          defaultMargin={defaultMargin}
          defaultGst={defaultGst}
          onSave={handleAddBatch}
          onCancel={() => setAdding(false)}
          isSaving={isPending}
        />
      )}

      <div className="space-y-2">
        {plans.map(plan =>
          editId === plan.id ? (
            <PricingForm
              key={plan.id}
              initial={toFormState(plan)}
              rooms={roomOption}
              mealTypes={mealTypes}
              dietTypes={dietTypes}
              onSave={form => handleEdit(plan.id, form)}
              onCancel={() => setEditId(null)}
              isSaving={isPending}
              planId={plan.id}
              hotelId={hotelId}
              allPlans={plans}
              onSiblingSeasonsUpdated={handleSeasonsUpdated}
              hideRoomField
            />
          ) : (
            <div key={plan.id} className="flex items-center gap-3 rounded-lg border border-dashboard-base-content/15 bg-dashboard-base-100 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-dashboard-base-content truncate">
                    {plan.plan_name || "Unnamed plan"}
                  </p>
                  {!plan.is_active && (
                    <Badge className="text-[10px] px-1.5 py-0 bg-dashboard-base-300 text-dashboard-base-content/50 border border-dashboard-base-content/20">Inactive</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-dashboard-base-content/50">
                  <span>{plan.meal_type?.name ?? "Room Only (EP)"}</span>
                  <span>·</span>
                  <span className="font-semibold text-dashboard-base-content">₹{plan.price_per_night.toLocaleString("en-IN")}/night</span>
                  {plan.seasons.length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" /> {plan.seasons.length} season{plan.seasons.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button type="button" variant="ghost" size="icon"
                  className="h-7 w-7 text-dashboard-base-content/50 hover:text-dashboard-primary hover:bg-dashboard-primary/10 cursor-pointer"
                  onClick={() => setEditId(plan.id)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="ghost" size="icon"
                      className="h-7 w-7 text-dashboard-base-content/50 hover:text-dashboard-error hover:bg-dashboard-error/10 cursor-pointer"
                      disabled={isPending}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Plan</AlertDialogTitle>
                      <AlertDialogDescription>
                        Delete <span className="font-semibold">{plan.plan_name || "this plan"}</span>? This will also remove its seasonal rates and occupancy prices.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(plan.id)}
                        className="bg-dashboard-error text-dashboard-error-content hover:bg-dashboard-error/90 cursor-pointer">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ),
        )}
      </div>

      {plans.length === 0 && !adding && (
        <div className={cn(
          "flex flex-col items-center justify-center py-8 rounded-lg border border-dashed",
          "border-dashboard-warning/40 bg-dashboard-warning/5",
        )}>
          <p className="text-xs font-medium text-dashboard-base-content/60">No pricing plans yet — this room can&apos;t be booked</p>
          <p className="text-[11px] text-dashboard-base-content/40 mt-1">Click &ldquo;Add Plan&rdquo; to set its first rate</p>
        </div>
      )}

      {isPending && (
        <div className="flex items-center gap-1.5 text-[11px] text-dashboard-base-content/40">
          <Loader2 className="h-3 w-3 animate-spin" /> Saving…
        </div>
      )}
    </div>
  );
}
