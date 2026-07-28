"use client";

import { useState, useTransition, useEffect } from "react";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "../../../components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Loader2, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/app/lib/utils";
import {
  createRoomPricingWithSeasons, updateRoomPricingWithSeasons, deleteRoomPricing,
  upsertOccupancyPrice, deleteOccupancyPrice,
} from "../../actions";
import {
  PricingForm, EMPTY_FORM, toFormState,
  buildSeasonsInput, buildOptimisticSeasons, combinedOccupancyEntries,
  type PricingPlan, type MealType, type DietType, type PricingFormState,
} from "./PricingTab";

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
  function emptyFormForNewPlan(): PricingFormState {
    const last = plans[plans.length - 1];
    return {
      ...EMPTY_FORM,
      room_id: String(room.id),
      margin_percentage: last ? String(last.margin_percentage) : EMPTY_FORM.margin_percentage,
      gst_percentage: last ? String(last.gst_percentage) : EMPTY_FORM.gst_percentage,
    };
  }

  function handleAdd(form: PricingFormState) {
    startTransition(async () => {
      const seasons = buildSeasonsInput(form);

      const result = await createRoomPricingWithSeasons(hotelId, {
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

      const planId = result.id!;
      const savedPrices: PricingPlan["occupancy_prices"] = [];
      for (const entry of combinedOccupancyEntries(form)) {
        if (entry.price && Number(entry.price) > 0) {
          const r = await upsertOccupancyPrice(planId, hotelId, entry.occupancy, Number(entry.price),
            entry.original ? Number(entry.original) : null,
            entry.weekendPrice ? Number(entry.weekendPrice) : null);
          if (r.success) {
            savedPrices.push({
              id: Date.now() + savedPrices.length,
              pricing_id: planId,
              occupancy: entry.occupancy,
              price_per_night: Number(entry.price),
              original_price: entry.original ? Number(entry.original) : null,
              weekend_price_per_night: entry.weekendPrice ? Number(entry.weekendPrice) : null,
            });
          }
        }
      }

      toast.success(result.message);
      setAdding(false);

      const mealId = form.meal_type_id && form.meal_type_id !== "none" ? Number(form.meal_type_id) : null;
      const dietId = form.diet_type_id && form.diet_type_id !== "none" ? Number(form.diet_type_id) : null;
      const now = Date.now();

      setPlans(prev => [
        ...prev,
        {
          id: planId,
          hotel_id: hotelId,
          room_id: room.id,
          plan_name: form.plan_name || null,
          meal_type_id: mealId,
          diet_type_id: dietId,
          price_per_night: Number(form.base_price_per_night) || Number(seasons[0]?.price_per_night) || 0,
          original_price: null,
          extra_bed_rate: form.base_extra_bed_rate ? Number(form.base_extra_bed_rate) : null,
          weekend_price_per_night: form.base_weekend_price_per_night ? Number(form.base_weekend_price_per_night) : null,
          weekend_extra_bed_rate: form.base_weekend_extra_bed_rate ? Number(form.base_weekend_extra_bed_rate) : null,
          margin_percentage: Number(form.margin_percentage),
          gst_percentage: Number(form.gst_percentage),
          notes: form.notes.trim() || null,
          valid_from: null,
          valid_to: null,
          is_active: form.is_active,
          sort_order: prev.length,
          room: { id: room.id, name: room.name },
          meal_type: mealTypes.find(m => m.id === mealId) ?? null,
          diet_type: dietTypes.find(d => d.id === dietId) ?? null,
          occupancy_prices: savedPrices,
          seasons: buildOptimisticSeasons(seasons, planId, now),
        },
      ]);
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
        <PricingForm
          initial={emptyFormForNewPlan()}
          rooms={roomOption}
          mealTypes={mealTypes}
          dietTypes={dietTypes}
          onSave={handleAdd}
          onCancel={() => setAdding(false)}
          isSaving={isPending}
          isNew
          hotelId={hotelId}
          allPlans={plans}
          onSiblingSeasonsUpdated={handleSeasonsUpdated}
          hideRoomField
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
