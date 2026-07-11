"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cancellationLabel, type CancellationPolicy } from "@/app/lib/hotel-inventory/cancellation";
import { createRatePlan, updateRatePlanDetails, setRatePlanActive, type RatePlanInput } from "../plan-actions";
import { RateField } from "../../rate-fields";
import { SearchSelect } from "@/app/(hotel-connect)/hotel-connect/(main)/components/ui/search-select";
import { Input } from "@/app/(hotel-connect)/hotel-connect/(main)/components/ui/input";
import { Label } from "@/app/(hotel-connect)/hotel-connect/(main)/components/ui/label";
import SectionCard from "@/app/(hotel-connect)/hotel-connect/(main)/components/SectionCard";
import { Button } from "@/app/components/ui/Button";

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
          ← Back to Rates &amp; Inventory
        </Link>
        <h1 className="text-lg font-bold text-neutral-800 mt-1">{isEdit ? "Edit Rate Plan" : "Add Rate Plan"}</h1>
      </div>

      <SectionCard title="Rate Plan Details">
        <div>
          <Label className="mb-1 normal-case tracking-normal text-sm text-neutral-800">Rate Plan Name *</Label>
          <Input
            type="text"
            value={planName}
            onChange={(e) => { setPlanName(e.target.value); setNameTouched(true); }}
            placeholder="e.g. Room With Free Breakfast"
          />
        </div>

        <div>
          <Label className="mb-1 normal-case tracking-normal text-sm text-neutral-800">Meal Plan</Label>
          <SearchSelect
            options={[{ value: "", label: "Room Only (no meals)" }, ...mealTypes.map((m) => ({ value: String(m.id), label: m.name }))]}
            value={mealTypeId != null ? String(mealTypeId) : ""}
            onChange={onMealTypeChange}
          />
        </div>

        <div>
          <Label className="mb-1 normal-case tracking-normal text-sm text-neutral-800">Diet Type</Label>
          <SearchSelect
            options={[{ value: "", label: "Not specified" }, ...dietTypes.map((d) => ({ value: String(d.id), label: d.name }))]}
            value={dietTypeId != null ? String(dietTypeId) : ""}
            onChange={(v) => setDietTypeId(v === "" ? null : Number(v))}
            disabled={isRoomOnly}
          />
        </div>

        <div>
          <Label className="mb-1 normal-case tracking-normal text-sm text-neutral-800">Cancellation Policy</Label>
          <SearchSelect
            options={[{ value: "", label: "Same as hotel policy" }, ...CANCELLATION_POLICIES.map((p) => ({ value: p, label: cancellationLabel(p) }))]}
            value={cancellationPolicy || ""}
            onChange={(v) => setCancellationPolicy(v as CancellationPolicy | "")}
            showSearch={false}
          />
        </div>

        <div className="flex items-center justify-between py-1">
          <Label className="normal-case tracking-normal text-sm text-neutral-800">GST %</Label>
          <Input
            type="number"
            min={0}
            max={100}
            step="1"
            value={gstPercentage}
            onChange={(e) => setGstPercentage(e.target.value)}
            className="w-24 text-right"
          />
        </div>

        <div className="border-t border-neutral-100 pt-1">
          <RateField value={basePrice} title="Base Rate" subtitle="Per night, 2 adults" onChange={(v) => setBasePrice(v.trim() === "" ? null : Number(v))} />
        </div>
      </SectionCard>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="primary" size="lg" onClick={handleSubmit} loading={saving}>
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Rate Plan"}
          </Button>
        </div>
        {isEdit && isActive && (
          <Button variant="ghost" size="lg" onClick={handleDeactivate} loading={deactivating}>
            {deactivating ? "…" : "Deactivate Plan"}
          </Button>
        )}
        {isEdit && !isActive && (
          <span className="text-xs text-neutral-400 font-medium">This plan is deactivated.</span>
        )}
      </div>
    </div>
  );
}
