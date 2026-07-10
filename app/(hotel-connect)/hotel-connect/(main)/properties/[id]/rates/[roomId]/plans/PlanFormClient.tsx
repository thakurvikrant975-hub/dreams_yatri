"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cancellationLabel, type CancellationPolicy } from "@/app/lib/hotel-inventory/cancellation";
import { createRatePlan, updateRatePlanDetails, setRatePlanActive, type RatePlanInput } from "../plan-actions";
import { RateField } from "../../rate-fields";

const CANCELLATION_POLICIES: CancellationPolicy[] = [
  "FREE_TILL_CHECKIN", "FREE_TILL_24H", "FREE_TILL_48H", "FREE_TILL_72H", "FREE_TILL_7D", "NON_REFUNDABLE",
];

export type MealTypeOption = { id: number; name: string };
export type DietTypeOption = { id: number; name: string };

export type PlanFormInitial = {
  planId: number;
  planName: string;
  mealTypeId: number | null;
  dietTypeId: number | null;
  cancellationPolicy: CancellationPolicy | null;
  gstPercentage: number;
  basePrice: number;
  isActive: boolean;
};

const ROOM_ONLY_MEAL_NAME = "EP (Room Only)";

export default function PlanFormClient({
  hotelId,
  roomId,
  mealTypes,
  dietTypes,
  initial,
}: {
  hotelId: number;
  roomId: number;
  mealTypes: MealTypeOption[];
  dietTypes: DietTypeOption[];
  initial: PlanFormInitial | null;
}) {
  const router = useRouter();
  const isEdit = initial != null;

  const [planName, setPlanName] = useState(initial?.planName ?? "");
  const [nameTouched, setNameTouched] = useState(isEdit);
  const [mealTypeId, setMealTypeId] = useState<number | null>(initial?.mealTypeId ?? null);
  const [dietTypeId, setDietTypeId] = useState<number | null>(initial?.dietTypeId ?? null);
  const [cancellationPolicy, setCancellationPolicy] = useState<CancellationPolicy | "">(initial?.cancellationPolicy ?? "");
  const [gstPercentage, setGstPercentage] = useState(String(initial?.gstPercentage ?? 18));
  const [basePrice, setBasePrice] = useState<number | null>(initial?.basePrice ?? null);

  const [saving, startSave] = useTransition();
  const [deactivating, startDeactivate] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  const selectedMeal = mealTypes.find((m) => m.id === mealTypeId);
  const isRoomOnly = !selectedMeal || selectedMeal.name === ROOM_ONLY_MEAL_NAME;

  function onMealTypeChange(raw: string) {
    const id = raw === "" ? null : Number(raw);
    setMealTypeId(id);
    const meal = mealTypes.find((m) => m.id === id);
    // Auto-suggest a plan name from the meal type until the owner types their own.
    if (!nameTouched) setPlanName(meal ? meal.name : "");
    if (meal?.name === ROOM_ONLY_MEAL_NAME || !meal) setDietTypeId(null);
  }

  function handleSubmit() {
    setError(null);
    if (!planName.trim()) { setError("Rate plan name is required."); return; }
    if (basePrice == null || basePrice <= 0) { setError("Base rate is required and must be a positive number."); return; }
    const gst = Number(gstPercentage);
    if (!Number.isFinite(gst) || gst < 0 || gst > 100) { setError("GST % must be between 0 and 100."); return; }

    const input: RatePlanInput = {
      planName: planName.trim(),
      mealTypeId,
      dietTypeId,
      cancellationPolicy: cancellationPolicy === "" ? null : cancellationPolicy,
      gstPercentage: gst,
      basePrice,
    };

    startSave(async () => {
      const result = isEdit
        ? await updateRatePlanDetails(hotelId, roomId, initial!.planId, input)
        : await createRatePlan(hotelId, roomId, input);
      if (result.error) { setError(result.error); return; }
      router.push(`/hotel-connect/properties/${hotelId}/rates`);
    });
  }

  function handleDeactivate() {
    if (!initial) return;
    setError(null);
    startDeactivate(async () => {
      const result = await setRatePlanActive(hotelId, roomId, initial.planId, false);
      if (result.error) { setError(result.error); return; }
      setIsActive(false);
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/hotel-connect/properties/${hotelId}/rates`} className="text-xs text-neutral-400 hover:text-neutral-600">
          ← Back to Rates &amp; Availability
        </Link>
        <h1 className="text-lg font-bold text-neutral-800 mt-1">{isEdit ? "Edit Rate Plan" : "Add Rate Plan"}</h1>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-800 mb-1">Rate Plan Name *</label>
          <input
            type="text"
            value={planName}
            onChange={(e) => { setPlanName(e.target.value); setNameTouched(true); }}
            placeholder="e.g. Room With Free Breakfast"
            className="h-10 w-full rounded-lg border border-neutral-300 px-3 text-sm outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-800 mb-1">Meal Plan</label>
          <select
            value={mealTypeId ?? ""}
            onChange={(e) => onMealTypeChange(e.target.value)}
            className="h-10 w-full rounded-lg border border-neutral-300 px-3 text-sm bg-white outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="">Room Only (no meals)</option>
            {mealTypes.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-800 mb-1">Diet Type</label>
          <select
            value={dietTypeId ?? ""}
            onChange={(e) => setDietTypeId(e.target.value === "" ? null : Number(e.target.value))}
            disabled={isRoomOnly}
            className="h-10 w-full rounded-lg border border-neutral-300 px-3 text-sm bg-white outline-none focus:ring-2 focus:ring-primary-500/20 disabled:bg-neutral-50 disabled:text-neutral-400"
          >
            <option value="">Not specified</option>
            {dietTypes.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-800 mb-1">Cancellation Policy</label>
          <select
            value={cancellationPolicy}
            onChange={(e) => setCancellationPolicy(e.target.value as CancellationPolicy | "")}
            className="h-10 w-full rounded-lg border border-neutral-300 px-3 text-sm bg-white outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="">Same as hotel policy</option>
            {CANCELLATION_POLICIES.map((p) => (
              <option key={p} value={p}>{cancellationLabel(p)}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between py-1">
          <label className="text-sm font-medium text-neutral-800">GST %</label>
          <input
            type="number"
            min={0}
            max={100}
            step="1"
            value={gstPercentage}
            onChange={(e) => setGstPercentage(e.target.value)}
            className="h-10 w-24 rounded-lg border border-neutral-300 px-2.5 text-sm text-right outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>

        <div className="border-t border-neutral-100 pt-1">
          <RateField value={basePrice} title="Base Rate" subtitle="Per night, 2 adults" onChange={(v) => setBasePrice(v.trim() === "" ? null : Number(v))} />
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="h-11 px-6 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold disabled:opacity-60"
          >
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Rate Plan"}
          </button>
        </div>
        {isEdit && isActive && (
          <button
            onClick={handleDeactivate}
            disabled={deactivating}
            className="h-11 px-4 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold disabled:opacity-60"
          >
            {deactivating ? "…" : "Deactivate Plan"}
          </button>
        )}
        {isEdit && !isActive && (
          <span className="text-xs text-neutral-400 font-medium">This plan is deactivated.</span>
        )}
      </div>
    </div>
  );
}
