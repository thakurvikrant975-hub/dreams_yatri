"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Coffee, Sun, Moon, UtensilsCrossed, Hotel, Activity, Plus, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../components/ui/tooltip";
import { cn } from "@/app/lib/utils";
import {
  handleUpdateStayActiveMeals,
  handleGetHotelMealPricings,
} from "@/app/actions/packages/itinerary-builder.actions";
import type { HotelMealOption, StayItem, ActivityItem } from "@/app/services/itinerary-builder.service";

// ── Slot definitions (time order) ──────────────────────────────────────────
const MEAL_SLOTS = [
  { key: "breakfast",      label: "Breakfast",      Icon: Coffee },
  { key: "morning_snacks", label: "Morning Snacks", Icon: Coffee },
  { key: "lunch",          label: "Lunch",          Icon: Sun },
  { key: "evening_snacks", label: "Evening Snacks", Icon: UtensilsCrossed },
  { key: "dinner",         label: "Dinner",         Icon: Moon },
] as const;

const STANDARD_SLOTS = new Set(["breakfast", "lunch", "dinner"]);

// slot key → hotel_meal_pricing.meal_type (uppercase)
const SLOT_HOTEL_TYPE: Record<string, string> = {
  breakfast: "BREAKFAST", lunch: "LUNCH", dinner: "DINNER",
  morning_snacks: "MORNING_SNACKS", evening_snacks: "EVENING_SNACKS",
};

/** "BREAKFAST" | "Morning Snacks" → "breakfast" | "morning_snacks" */
function normalizeMealKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "_");
}

// ── Source chip ─────────────────────────────────────────────────────────────
function SourceChip({
  on, neutral, dotClass, disabled, onClick, title, children,
}: {
  on: boolean;
  neutral?: boolean;
  dotClass?: string;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={cn(
              "relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium select-none transition-all",
              on
                ? neutral
                  ? "bg-foreground/5 border-foreground/30 text-foreground"
                  : "bg-primary/10 border-primary/40 text-foreground shadow-sm"
                : "bg-muted/40 border-muted-foreground/15 text-muted-foreground opacity-60",
              !disabled && "cursor-pointer hover:opacity-100",
            )}
          >
            {on && dotClass && <span className={cn("absolute top-1 right-1 h-1.5 w-1.5 rounded-full", dotClass)} />}
            {children}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[220px] text-xs leading-snug">{title}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ── Meals editor ──────────────────────────────────────────────────────────
export default function MealsEditor({
  meals,
  onChange,
  excludedMeals,
  onExcludedChange,
  stays,
  onStaysChange,
  previousDayStays,
  packageId,
  activities,
  disabled,
  sectionRef,
}: {
  meals: string[];
  onChange: (meals: string[]) => void;
  excludedMeals: string[];
  onExcludedChange: (excluded: string[]) => void;
  stays: StayItem[];
  onStaysChange: (stays: StayItem[]) => void;
  previousDayStays: StayItem[];
  packageId: number;
  activities: ActivityItem[];
  disabled?: boolean;
  sectionRef?: React.Ref<HTMLDivElement>;
}) {
  const [savingStayId, setSavingStayId] = useState<number | null>(null);
  // Local copy so optimistic toggles on the previous day's breakfast work
  // without waiting for the parent. Sidebar remounts per-day (key), so fresh.
  const [localPrevStays, setLocalPrevStays] = useState<StayItem[]>(previousDayStays);
  const [mealPricingsByHotel, setMealPricingsByHotel] = useState<Record<number, HotelMealOption[]>>({});

  const excludedSet = useMemo(() => new Set(excludedMeals), [excludedMeals]);

  // Load à-la-carte meal pricings for every hotel referenced today / yesterday
  useEffect(() => {
    const ids = new Set<number>();
    for (const s of [...stays, ...localPrevStays]) ids.add(s.room_pricing.hotel.id);
    ids.forEach((id) => {
      setMealPricingsByHotel((cur) => {
        if (cur[id]) return cur;
        handleGetHotelMealPricings(id).then((res) => {
          if (res.success) setMealPricingsByHotel((p) => (p[id] ? p : { ...p, [id]: res.data }));
        });
        return cur;
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stays, localPrevStays]);

  const multiCat = useMemo(
    () => new Set([...stays, ...localPrevStays].map((s) => s.stay_category_id)).size > 1,
    [stays, localPrevStays],
  );

  // activity providers per slot key
  const activityProviders = useMemo(() => {
    const map: Record<string, ActivityItem[]> = {};
    for (const a of activities) {
      for (const raw of a.activity.included_meals) {
        (map[normalizeMealKey(raw)] ??= []).push(a);
      }
    }
    return map;
  }, [activities]);

  // Breakfast comes from the previous night's hotel; everything else from tonight's.
  const relevantStays = (slot: string): StayItem[] => (slot === "breakfast" ? localPrevStays : stays);

  function hotelOffer(stay: StayItem, slot: string): { offered: boolean; covered: boolean; price: number | null } {
    const covered = (stay.room_pricing.meal_type?.covered_meals ?? []).some((c) => normalizeMealKey(c) === slot);
    const pricing = (mealPricingsByHotel[stay.room_pricing.hotel.id] ?? []).find((o) => o.meal_type === SLOT_HOTEL_TYPE[slot]);
    return { offered: covered || !!pricing, covered, price: pricing ? pricing.price : null };
  }

  async function toggleHotelMeal(stay: StayItem, slot: string, forceOff = false) {
    const has = stay.active_meals.includes(slot);
    if (forceOff && !has) return;
    const next = forceOff || has ? stay.active_meals.filter((m) => m !== slot) : [...stay.active_meals, slot];
    const isPrev = localPrevStays.some((s) => s.id === stay.id);
    if (isPrev) setLocalPrevStays((prev) => prev.map((s) => (s.id === stay.id ? { ...s, active_meals: next } : s)));
    else onStaysChange(stays.map((s) => (s.id === stay.id ? { ...s, active_meals: next } : s)));
    setSavingStayId(stay.id);
    await handleUpdateStayActiveMeals(stay.id, next, packageId);
    setSavingStayId(null);
  }

  const toggleActivity = (slot: string) => {
    const on = !excludedSet.has(slot);
    onExcludedChange(on ? [...excludedMeals, slot] : excludedMeals.filter((e) => e !== slot));
  };

  const toggleManual = (slot: string) =>
    onChange(meals.includes(slot) ? meals.filter((m) => m !== slot) : [...meals, slot]);

  async function selectNone(slot: string) {
    for (const s of relevantStays(slot)) {
      if (s.active_meals.includes(slot)) await toggleHotelMeal(s, slot, true);
    }
    if ((activityProviders[slot]?.length ?? 0) > 0 && !excludedSet.has(slot)) {
      onExcludedChange([...excludedMeals, slot]);
    }
    if (meals.includes(slot)) onChange(meals.filter((m) => m !== slot));
  }

  const hotelOn = (stay: StayItem, slot: string) => stay.active_meals.includes(slot);
  const activityOn = (slot: string) => (activityProviders[slot]?.length ?? 0) > 0 && !excludedSet.has(slot);
  const manualOn = (slot: string) => meals.includes(slot);
  const anyOn = (slot: string) =>
    relevantStays(slot).some((s) => hotelOn(s, slot)) || activityOn(slot) || manualOn(slot);

  const effectiveCount = useMemo(
    () => MEAL_SLOTS.filter((s) => anyOn(s.key)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stays, localPrevStays, excludedSet, meals, activityProviders],
  );

  return (
    <div ref={sectionRef} className="px-5 pt-4 pb-4 border-b space-y-3 scroll-mt-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <UtensilsCrossed className="h-3 w-3 text-muted-foreground" />
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Meals</p>
        </div>
        {effectiveCount > 0 && (
          <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">
            {effectiveCount} meal{effectiveCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="space-y-2.5">
        {MEAL_SLOTS.map(({ key: slot, label, Icon }) => {
          const rStays = relevantStays(slot);
          const hotelOpts = rStays.map((s) => ({ stay: s, ...hotelOffer(s, slot) })).filter((h) => h.offered);
          const acts = activityProviders[slot] ?? [];
          const hasSource = hotelOpts.length > 0 || acts.length > 0;

          // Snacks: only show when a source can actually provide them.
          if (!STANDARD_SLOTS.has(slot) && !hasSource) return null;

          const isSaving = rStays.some((s) => savingStayId === s.id);
          const none = !anyOn(slot);

          return (
            <div key={slot} className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Icon className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] font-bold uppercase tracking-wide text-foreground/70">{label}</span>
                {slot === "breakfast" && hotelOpts.length > 0 && (
                  <span className="text-[9px] text-muted-foreground/50">· from previous night</span>
                )}
                {isSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {/* Hotel sources — per stay category */}
                {hotelOpts.map(({ stay, covered, price }) => (
                  <SourceChip
                    key={`h-${stay.id}`}
                    on={hotelOn(stay, slot)}
                    disabled={disabled || isSaving}
                    dotClass="bg-blue-400"
                    onClick={() => toggleHotelMeal(stay, slot)}
                    title={`${stay.room_pricing.hotel.name}${covered ? " · included in room plan" : price != null ? ` · +₹${price.toLocaleString("en-IN")} / person` : ""} · click to ${hotelOn(stay, slot) ? "remove" : "add"}`}
                  >
                    <Hotel className="h-3 w-3 shrink-0" />
                    <span className="truncate max-w-[7rem]">
                      {multiCat ? stay.stay_category.label : stay.room_pricing.hotel.name}
                    </span>
                    {(covered || price != null) && (
                      <span className="text-[9px] font-semibold opacity-70">
                        {covered ? "incl." : `+₹${price!.toLocaleString("en-IN")}`}
                      </span>
                    )}
                  </SourceChip>
                ))}

                {/* Activity sources — day level */}
                {acts.map((a) => (
                  <SourceChip
                    key={`a-${a.id}`}
                    on={activityOn(slot)}
                    disabled={disabled}
                    dotClass="bg-amber-400"
                    onClick={() => toggleActivity(slot)}
                    title={`${a.activity.name}${activityOn(slot) ? " · click to exclude" : " · click to include"}`}
                  >
                    <Activity className="h-3 w-3 shrink-0" />
                    <span className="truncate max-w-[7rem]">{a.activity.name}</span>
                  </SourceChip>
                ))}

                {/* Manual — only when neither hotel nor activity offers it */}
                {!hasSource && (
                  <SourceChip
                    on={manualOn(slot)}
                    disabled={disabled}
                    dotClass="bg-emerald-400"
                    onClick={() => toggleManual(slot)}
                    title="Mark this meal as included (manual)"
                  >
                    <Plus className="h-3 w-3 shrink-0" />
                    <span>Included</span>
                  </SourceChip>
                )}

                {/* None */}
                <SourceChip
                  on={none}
                  neutral
                  disabled={disabled || isSaving}
                  onClick={() => { if (!none) selectNone(slot); }}
                  title="Not included"
                >
                  <span>None</span>
                </SourceChip>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 pt-0.5">
        <span className="flex items-center gap-1 text-[9px] text-muted-foreground/40"><span className="h-2 w-2 rounded-full bg-blue-400 inline-block" /> Hotel</span>
        <span className="flex items-center gap-1 text-[9px] text-muted-foreground/40"><span className="h-2 w-2 rounded-full bg-amber-400 inline-block" /> Activity</span>
        <span className="flex items-center gap-1 text-[9px] text-muted-foreground/40"><span className="h-2 w-2 rounded-full bg-emerald-400 inline-block" /> Manual</span>
      </div>
    </div>
  );
}
