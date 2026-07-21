"use client";

import { useState, useTransition } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Switch } from "../../../components/ui/switch";
import { Badge } from "../../../components/ui/badge";
import { Textarea } from "../../../components/ui/textarea";
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
  ChevronDown, ChevronRight, AlertTriangle,
  CalendarDays, Info, UtensilsCrossed, Package,
} from "lucide-react";
import {
  PricingRangeCalendarPicker,
  type DateRange,
  type SeasonRange,
} from "../../../components/ui/pricing-range-calendar";
import { toast } from "sonner";
import { cn } from "@/app/lib/utils";
import {
  createMealPricing, updateMealPricing, deleteMealPricing,
  createAddon, updateAddon, deleteAddon,
  type HotelMealPricing, type MealPricingInput, type MealSeasonInput,
  type HotelAddon, type AddonInput,
} from "../../actions";

// ── Constants ─────────────────────────────────────────────────────────────────

export const PRESET_MEALS = [
  { value: "BREAKFAST",      label: "Breakfast" },
  { value: "LUNCH",          label: "Lunch" },
  { value: "DINNER",         label: "Dinner" },
  { value: "MORNING_SNACKS", label: "Morning Snacks" },
  { value: "EVENING_SNACKS", label: "Evening Snacks" },
  { value: "CUSTOM",         label: "Custom…" },
] as const;

const CHARGE_TYPES = [
  { value: "PER_PERSON",  label: "Per Person",  suffix: "/person" },
  { value: "PER_ROOM",    label: "Per Room",    suffix: "/room" },
  { value: "PER_BOOKING", label: "Per Booking", suffix: "/booking" },
] as const;

// ── Shared types ──────────────────────────────────────────────────────────────

type SeasonEntry = {
  tempId:        string;
  valid_from:    string;
  valid_to:      string;
  price:         string;
  weekend_price: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2); }

function toISODate(val: Date | string | null | undefined): string {
  if (!val) return "";
  const d = typeof val === "string" ? new Date(val) : val;
  return isNaN(d.getTime()) ? "" : d.toISOString().split("T")[0];
}

function toDateObj(str: string): Date | undefined {
  if (!str) return undefined;
  const d = new Date(str + "T00:00:00");
  return isNaN(d.getTime()) ? undefined : d;
}

function fromDateObj(d: Date | undefined): string {
  if (!d) return "";
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Existing DB rows may have year-2000 placeholder dates — upgrade to current year on load
function upgradeYearIfPlaceholder(isoDate: string): string {
  if (!isoDate || !isoDate.startsWith("2000-")) return isoDate;
  return `${new Date().getFullYear()}${isoDate.slice(4)}`;
}

function fmtMonthDay(dateStr: string): string {
  const d = toDateObj(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function overlappingIds(seasons: SeasonEntry[]): Set<string> {
  const withDates = seasons.filter((s) => s.valid_from && s.valid_to);
  const out = new Set<string>();
  for (let i = 0; i < withDates.length; i++) {
    for (let j = i + 1; j < withDates.length; j++) {
      const a = withDates[i], b = withDates[j];
      if (a.valid_from <= b.valid_to && b.valid_from <= a.valid_to) {
        out.add(a.tempId);
        out.add(b.tempId);
      }
    }
  }
  return out;
}

function chargeSuffix(type: string) {
  return CHARGE_TYPES.find((c) => c.value === type)?.suffix ?? "";
}

const EMPTY_SEASON: Omit<SeasonEntry, "tempId"> = {
  valid_from: "", valid_to: "", price: "", weekend_price: "",
};

// ── SeasonsInlineList (shared) ────────────────────────────────────────────────

function SeasonsInlineList({
  seasons,
  onChange,
  basePrice = 0,
}: {
  seasons:    SeasonEntry[];
  onChange:   (s: SeasonEntry[]) => void;
  basePrice?: number;
}) {
  const overlapping = overlappingIds(seasons);

  const calendarSeasons: SeasonRange[] = seasons
    .filter((x) => x.valid_from && x.valid_to && Number(x.price) > 0)
    .map((x) => ({
      from:           x.valid_from,
      to:             x.valid_to,
      weekdayPrice:   Number(x.price),
      weekendPrice:   x.weekend_price ? Number(x.weekend_price) : null,
      weekendEnabled: !!x.weekend_price,
    }));

  function addSeason() {
    onChange([...seasons, { ...EMPTY_SEASON, tempId: uid() }]);
  }
  function updSeason<K extends keyof Omit<SeasonEntry, "tempId">>(
    tempId: string, key: K, value: Omit<SeasonEntry, "tempId">[K],
  ) {
    onChange(seasons.map((s) => s.tempId === tempId ? { ...s, [key]: value } : s));
  }
  function removeSeason(tempId: string) {
    onChange(seasons.filter((s) => s.tempId !== tempId));
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-dashboard-base-content/60 flex items-center gap-1.5">
        <CalendarDays className="h-3.5 w-3.5" />
        Seasonal Pricing
        <span className="font-normal normal-case text-dashboard-base-content/40">— optional</span>
      </p>

      {overlapping.size > 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashboard-error/30 bg-dashboard-error/5 px-3 py-2 text-xs text-dashboard-error">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Overlapping seasons detected. Fix before saving.
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-dashboard-info/40 bg-dashboard-info/10 px-3 py-2 text-xs text-dashboard-base-content/70">
          <Info className="h-3.5 w-3.5 shrink-0 text-dashboard-secondary" />
          Click a start date then an end date on the calendar to set the season range.
        </div>
      )}

      {seasons.map((s) => {
        const hasOverlap = overlapping.has(s.tempId);
        const dateRange: DateRange | undefined =
          s.valid_from && s.valid_to
            ? { from: toDateObj(s.valid_from), to: toDateObj(s.valid_to) }
            : s.valid_from ? { from: toDateObj(s.valid_from), to: undefined } : undefined;
        const rangeLabel = s.valid_from && s.valid_to
          ? `${fmtMonthDay(s.valid_from)} → ${fmtMonthDay(s.valid_to)}` : "";
        const priceInvalid = s.price !== "" && (isNaN(Number(s.price)) || Number(s.price) <= 0);

        return (
          <div
            key={s.tempId}
            className={cn(
              "border rounded-xl p-3 space-y-3",
              hasOverlap
                ? "border-dashboard-error/40 bg-dashboard-error/5"
                : "border-dashboard-base-content/20 bg-dashboard-base-200/50",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-dashboard-base-content/70">
                {rangeLabel || "New season"}
              </span>
              <div className="flex items-center gap-1">
                {hasOverlap && (
                  <span className="text-[10px] text-dashboard-error flex items-center gap-0.5">
                    <AlertTriangle className="h-3 w-3" /> Overlap
                  </span>
                )}
                <Button
                  type="button" size="icon" variant="ghost"
                  className="h-6 w-6 text-dashboard-error hover:text-dashboard-error hover:bg-dashboard-error/10 cursor-pointer"
                  onClick={() => removeSeason(s.tempId)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-dashboard-base-content/70">
                  Weekday Price (₹) <span className="text-dashboard-error">*</span>
                </Label>
                <Input
                  type="number"
                  className={cn("h-8 text-sm bg-dashboard-base-100 border-dashboard-base-content/20", priceInvalid && "border-dashboard-error/50")}
                  placeholder="e.g. 150"
                  value={s.price}
                  onChange={(e) => updSeason(s.tempId, "price", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 h-4.5">
                  <input
                    type="checkbox"
                    id={`wknd-${s.tempId}`}
                    checked={!!s.weekend_price}
                    onChange={(e) => updSeason(s.tempId, "weekend_price", e.target.checked ? s.price : "")}
                    className="h-3.5 w-3.5 accent-dashboard-primary cursor-pointer"
                  />
                  <Label htmlFor={`wknd-${s.tempId}`} className="text-xs text-dashboard-base-content/70 cursor-pointer">
                    Weekend (Sat &amp; Sun)
                    {s.price && <span className="text-dashboard-base-content/40 ml-1">(base ₹{Number(s.price).toLocaleString("en-IN")})</span>}
                  </Label>
                </div>
                {s.weekend_price !== "" && (
                  <Input
                    type="number"
                    className="h-8 text-sm bg-dashboard-base-100 border-dashboard-base-content/20"
                    placeholder="Same as weekday"
                    value={s.weekend_price}
                    onChange={(e) => updSeason(s.tempId, "weekend_price", e.target.value)}
                  />
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-dashboard-base-content/70">
                Date Range <span className="text-dashboard-error">*</span>
              </Label>
              <PricingRangeCalendarPicker
                value={dateRange}
                onChange={(range) => {
                  onChange(seasons.map((s2) =>
                    s2.tempId === s.tempId
                      ? { ...s2, valid_from: fromDateObj(range?.from), valid_to: fromDateObj(range?.to) }
                      : s2,
                  ));
                }}
                seasons={calendarSeasons}
                basePrice={basePrice}
                error={hasOverlap}
              />
            </div>
          </div>
        );
      })}

      <Button
        type="button" variant="outline" size="sm"
        className="h-8 text-xs gap-1.5 w-full border-dashed border-dashboard-base-content/30 bg-dashboard-base-100 text-dashboard-base-content/60 hover:bg-dashboard-base-200 hover:text-dashboard-base-content cursor-pointer"
        onClick={addSeason}
      >
        <Plus className="h-3.5 w-3.5" /> Add Season
      </Button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MEALS SECTION
// ══════════════════════════════════════════════════════════════════════════════

type MealFormState = {
  meal_type:     string;
  label:         string;
  price:         string;
  weekend_price: string;
  veg_price:     string;
  non_veg_price: string;
  veg_non_veg:   boolean;
  is_active:     boolean;
  seasons:       SeasonEntry[];
};

const EMPTY_MEAL_FORM: MealFormState = {
  meal_type: "", label: "", price: "", weekend_price: "",
  veg_price: "", non_veg_price: "", veg_non_veg: false,
  is_active: true, seasons: [],
};

function toMealFormState(m: HotelMealPricing): MealFormState {
  const hasVegNonVeg = !!(m.veg_price || m.non_veg_price);
  return {
    meal_type:     m.meal_type,
    label:         m.label,
    price:         String(m.price),
    weekend_price: m.weekend_price ? String(m.weekend_price) : "",
    veg_price:     m.veg_price ? String(m.veg_price) : "",
    non_veg_price: m.non_veg_price ? String(m.non_veg_price) : "",
    veg_non_veg:   hasVegNonVeg,
    is_active:     m.is_active,
    seasons:       m.seasons.map((s) => ({
      tempId:        uid(),
      valid_from:    upgradeYearIfPlaceholder(toISODate(s.valid_from)),
      valid_to:      upgradeYearIfPlaceholder(toISODate(s.valid_to)),
      price:         String(s.price),
      weekend_price: s.weekend_price ? String(s.weekend_price) : "",
    })),
  };
}

function buildMealInput(form: MealFormState): MealPricingInput {
  const vegPrice    = form.veg_non_veg && form.veg_price     ? Number(form.veg_price)     : null;
  const nonVegPrice = form.veg_non_veg && form.non_veg_price ? Number(form.non_veg_price)  : null;
  return {
    meal_type:     form.meal_type,
    label:         form.label.trim(),
    price:         form.veg_non_veg ? Number(vegPrice ?? nonVegPrice) : Number(form.price),
    weekend_price: form.weekend_price ? Number(form.weekend_price) : null,
    veg_price:     vegPrice,
    non_veg_price: nonVegPrice,
    is_active:     form.is_active,
    seasons:       form.seasons
      .filter((s) => s.valid_from && s.valid_to && Number(s.price) > 0)
      .map((s) => ({
        season_name:   `${fmtMonthDay(s.valid_from)} → ${fmtMonthDay(s.valid_to)}`,
        valid_from:    s.valid_from,
        valid_to:      s.valid_to,
        price:         Number(s.price),
        weekend_price: s.weekend_price ? Number(s.weekend_price) : null,
        is_active:     true,
      } satisfies MealSeasonInput & { season_name: string })),
  };
}

function MealForm({
  initial,
  onSave,
  onCancel,
  isSaving,
  usedMealTypes = new Set<string>(),
}: {
  initial:        MealFormState;
  onSave:         (form: MealFormState) => void;
  onCancel:       () => void;
  isSaving:       boolean;
  usedMealTypes?: Set<string>;
}) {
  const [form, setForm] = useState<MealFormState>(initial);
  function upd<K extends keyof MealFormState>(k: K, v: MealFormState[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  const overlaps = overlappingIds(form.seasons);
  const vegPriceInvalid    = form.veg_price !== ""     && Number(form.veg_price) <= 0;
  const nonVegPriceInvalid = form.non_veg_price !== "" && Number(form.non_veg_price) <= 0;
  const priceValid = form.veg_non_veg
    ? ((!!form.veg_price || !!form.non_veg_price) && !vegPriceInvalid && !nonVegPriceInvalid)
    : (!!form.price && Number(form.price) > 0);
  const isValid =
    !!form.meal_type && !!form.label.trim() &&
    priceValid &&
    overlaps.size === 0 &&
    form.seasons.every((s) => !s.valid_from || (s.valid_from && s.valid_to && Number(s.price) > 0));

  return (
    <div className="border border-dashboard-base-content/20 rounded-xl p-4 space-y-4 bg-dashboard-base-200/60 shadow-sm">
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-dashboard-base-content">
          Meal Type <span className="text-dashboard-error">*</span>
        </Label>
        <Select
          value={form.meal_type}
          onValueChange={(v) => {
            const preset = PRESET_MEALS.find((m) => m.value === v);
            upd("meal_type", v);
            if (preset && v !== "CUSTOM") upd("label", preset.label);
            else if (v === "CUSTOM") upd("label", "");
          }}
        >
          <SelectTrigger className="bg-dashboard-base-100 border-dashboard-base-content/20 text-dashboard-base-content cursor-pointer">
            <SelectValue placeholder="Select meal type…" />
          </SelectTrigger>
          <SelectContent>
            {PRESET_MEALS.map((m) => {
              const alreadyUsed = m.value !== "CUSTOM" && usedMealTypes.has(m.value);
              return (
                <SelectItem
                  key={m.value}
                  value={m.value}
                  disabled={alreadyUsed}
                  className={cn("cursor-pointer", alreadyUsed && "opacity-40 cursor-not-allowed")}
                >
                  <span>{m.label}</span>
                  {alreadyUsed && (
                    <span className="ml-1.5 text-[10px] text-dashboard-base-content/40">· already added</span>
                  )}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {form.meal_type === "CUSTOM" && (
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-dashboard-base-content">
            Name <span className="text-dashboard-error">*</span>
          </Label>
          <Input
            placeholder="e.g. Evening High Tea"
            value={form.label}
            onChange={(e) => upd("label", e.target.value)}
            autoFocus
            className="bg-dashboard-base-100 border-dashboard-base-content/20"
          />
        </div>
      )}

      {/* Veg / Non-Veg toggle */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox" id="meal-veg-nonveg"
          checked={form.veg_non_veg}
          onChange={(e) => upd("veg_non_veg", e.target.checked)}
          className="h-3.5 w-3.5 accent-dashboard-primary cursor-pointer"
        />
        <Label htmlFor="meal-veg-nonveg" className="text-sm font-medium text-dashboard-base-content cursor-pointer">
          Different rates for Veg &amp; Non-Veg
        </Label>
      </div>

      {form.veg_non_veg ? (
        <div className="space-y-1.5">
          <p className="text-xs text-dashboard-base-content/50">
            Leave a price blank if the hotel doesn&rsquo;t offer that option — at least one is required.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-dashboard-base-content">
                Veg Price (₹/person)
              </Label>
              <Input
                type="number" min={0} placeholder="Not offered"
                value={form.veg_price}
                onChange={(e) => upd("veg_price", e.target.value)}
                className="bg-dashboard-base-100 border-dashboard-base-content/20"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-dashboard-base-content">
                Non-Veg Price (₹/person)
              </Label>
              <Input
                type="number" min={0} placeholder="Not offered"
                value={form.non_veg_price}
                onChange={(e) => upd("non_veg_price", e.target.value)}
                className="bg-dashboard-base-100 border-dashboard-base-content/20"
              />
            </div>
          </div>
          {!form.veg_price && !form.non_veg_price && (
            <p className="text-xs text-dashboard-error">Enter at least one of Veg or Non-Veg price.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-dashboard-base-content">
              Weekday Price (₹/person) <span className="text-dashboard-error">*</span>
            </Label>
            <Input
              type="number" min={0} placeholder="150"
              value={form.price}
              onChange={(e) => upd("price", e.target.value)}
              className="bg-dashboard-base-100 border-dashboard-base-content/20"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 h-5">
              <input
                type="checkbox" id="meal-weekend"
                checked={!!form.weekend_price}
                onChange={(e) => upd("weekend_price", e.target.checked ? form.price : "")}
                className="h-3.5 w-3.5 accent-dashboard-primary cursor-pointer"
              />
              <Label htmlFor="meal-weekend" className="text-sm font-medium text-dashboard-base-content cursor-pointer">
                Weekend rate (Sat &amp; Sun)
                {form.price && (
                  <span className="text-xs text-dashboard-base-content/50 ml-1">
                    (base ₹{Number(form.price).toLocaleString("en-IN")})
                  </span>
                )}
              </Label>
            </div>
            {form.weekend_price !== "" && (
              <Input
                type="number" min={0} placeholder="Same as weekday"
                value={form.weekend_price}
                onChange={(e) => upd("weekend_price", e.target.value)}
                className="bg-dashboard-base-100 border-dashboard-base-content/20"
              />
            )}
          </div>
        </div>
      )}

      <div className="border-t border-dashboard-base-content/10 pt-4">
        <SeasonsInlineList
          seasons={form.seasons}
          onChange={(s) => upd("seasons", s)}
          basePrice={form.veg_non_veg ? (Number(form.veg_price) || Number(form.non_veg_price) || 0) : (Number(form.price) || 0)}
        />
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-dashboard-base-content/10">
        <div className="flex items-center gap-2">
          <Switch checked={form.is_active} onCheckedChange={(v) => upd("is_active", v)} />
          <span className="text-sm text-dashboard-base-content/60">Active</span>
        </div>
        <div className="flex gap-2">
          <Button
            type="button" variant="ghost" size="sm"
            onClick={onCancel} disabled={isSaving}
            className="text-dashboard-base-content/60 hover:text-dashboard-base-content hover:bg-dashboard-base-300 cursor-pointer"
          >
            <X className="mr-1 h-3.5 w-3.5" /> Cancel
          </Button>
          <Button
            type="button" size="sm"
            disabled={!isValid || isSaving}
            onClick={() => onSave(form)}
            className="bg-dashboard-primary text-dashboard-primary-content hover:bg-dashboard-primary/90 cursor-pointer"
          >
            {isSaving
              ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Saving…</>
              : <><Check className="mr-1.5 h-3.5 w-3.5" />Save Meal</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MealCard({
  meal, onEdit, onDelete, isDeleting,
}: {
  meal:       HotelMealPricing;
  onEdit:     () => void;
  onDelete:   () => void;
  isDeleting: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-dashboard-base-content/20 rounded-xl overflow-hidden bg-dashboard-base-100 shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 hover:bg-dashboard-base-200 transition-colors">
        <button
          type="button"
          onClick={() => setOpen((p) => !p)}
          className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
        >
          {open
            ? <ChevronDown className="h-4 w-4 text-dashboard-base-content/40 shrink-0" />
            : <ChevronRight className="h-4 w-4 text-dashboard-base-content/40 shrink-0" />}
          <UtensilsCrossed className="h-4 w-4 text-dashboard-primary/60 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-dashboard-base-content truncate">{meal.label}</p>
              {!meal.is_active && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Inactive</Badge>
              )}
            </div>
            <p className="text-xs text-dashboard-base-content/50">
              {meal.veg_price && meal.non_veg_price
                ? `Veg ₹${meal.veg_price.toLocaleString("en-IN")} · Non-veg ₹${meal.non_veg_price.toLocaleString("en-IN")}/person`
                : meal.veg_price
                ? `Veg ₹${meal.veg_price.toLocaleString("en-IN")}/person`
                : meal.non_veg_price
                ? `Non-veg ₹${meal.non_veg_price.toLocaleString("en-IN")}/person`
                : `₹${meal.price.toLocaleString("en-IN")}/person weekday`}
              {meal.weekend_price ? ` · ₹${meal.weekend_price.toLocaleString("en-IN")} weekend` : ""}
              {meal.seasons.length > 0
                ? ` · ${meal.seasons.length} season${meal.seasons.length !== 1 ? "s" : ""}`
                : ""}
            </p>
          </div>
        </button>
        <div className="flex items-center gap-1 shrink-0 ml-3">
          <Button
            size="sm" variant="ghost"
            className="h-7 w-7 p-0 text-dashboard-base-content/50 hover:text-dashboard-primary hover:bg-dashboard-primary/10 cursor-pointer"
            onClick={onEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm" variant="ghost"
                className="h-7 w-7 p-0 text-dashboard-base-content/50 hover:text-dashboard-error hover:bg-dashboard-error/10 cursor-pointer"
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete &ldquo;{meal.label}&rdquo;?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove this meal pricing and all its seasons.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDelete}
                  className="bg-dashboard-error text-dashboard-error-content hover:bg-dashboard-error/90 cursor-pointer"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {open && meal.seasons.length > 0 && (
        <div className="px-4 pb-4 pt-2 border-t border-dashboard-base-content/10 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-dashboard-base-content/50 mb-2">
            Seasonal Pricing
          </p>
          {meal.seasons.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between text-xs bg-dashboard-base-200 rounded-lg px-3 py-1.5"
            >
              <span className="text-dashboard-base-content/60">{s.season_name}</span>
              <span className="font-medium text-dashboard-base-content">
                ₹{s.price.toLocaleString("en-IN")}
                {s.weekend_price && (
                  <span className="text-dashboard-base-content/50 ml-1.5">
                    · ₹{s.weekend_price.toLocaleString("en-IN")} wknd
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ADD-ONS SECTION
// ══════════════════════════════════════════════════════════════════════════════

type AddonFormState = {
  label:         string;
  description:   string;
  charge_type:   string;
  price:         string;
  weekend_price: string;
  is_active:     boolean;
  seasons:       SeasonEntry[];
};

const EMPTY_ADDON_FORM: AddonFormState = {
  label: "", description: "", charge_type: "PER_PERSON",
  price: "", weekend_price: "", is_active: true, seasons: [],
};

function toAddonFormState(a: HotelAddon): AddonFormState {
  return {
    label:         a.label,
    description:   a.description ?? "",
    charge_type:   a.charge_type,
    price:         String(a.price),
    weekend_price: a.weekend_price ? String(a.weekend_price) : "",
    is_active:     a.is_active,
    seasons:       a.seasons.map((s) => ({
      tempId:        uid(),
      valid_from:    upgradeYearIfPlaceholder(toISODate(s.valid_from)),
      valid_to:      upgradeYearIfPlaceholder(toISODate(s.valid_to)),
      price:         String(s.price),
      weekend_price: s.weekend_price ? String(s.weekend_price) : "",
    })),
  };
}

function buildAddonInput(form: AddonFormState): AddonInput {
  return {
    label:         form.label.trim(),
    description:   form.description.trim() || null,
    charge_type:   form.charge_type,
    price:         Number(form.price),
    weekend_price: form.weekend_price ? Number(form.weekend_price) : null,
    is_active:     form.is_active,
    seasons:       form.seasons
      .filter((s) => s.valid_from && s.valid_to && Number(s.price) > 0)
      .map((s) => ({
        season_name:   `${fmtMonthDay(s.valid_from)} → ${fmtMonthDay(s.valid_to)}`,
        valid_from:    s.valid_from,
        valid_to:      s.valid_to,
        price:         Number(s.price),
        weekend_price: s.weekend_price ? Number(s.weekend_price) : null,
        is_active:     true,
      })),
  };
}

function AddonForm({
  initial,
  onSave,
  onCancel,
  isSaving,
}: {
  initial:  AddonFormState;
  onSave:   (form: AddonFormState) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<AddonFormState>(initial);
  function upd<K extends keyof AddonFormState>(k: K, v: AddonFormState[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  const overlaps = overlappingIds(form.seasons);
  const isValid =
    !!form.label.trim() && !!form.charge_type &&
    !!form.price && Number(form.price) > 0 &&
    overlaps.size === 0 &&
    form.seasons.every((s) => !s.valid_from || (s.valid_from && s.valid_to && Number(s.price) > 0));

  return (
    <div className="border border-dashboard-base-content/20 rounded-xl p-4 space-y-4 bg-dashboard-base-200/60 shadow-sm">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-dashboard-base-content">
            Label <span className="text-dashboard-error">*</span>
          </Label>
          <Input
            placeholder="e.g. Early Check-in"
            value={form.label}
            onChange={(e) => upd("label", e.target.value)}
            autoFocus
            className="bg-dashboard-base-100 border-dashboard-base-content/20"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-dashboard-base-content">
            Charge Type <span className="text-dashboard-error">*</span>
          </Label>
          <Select value={form.charge_type} onValueChange={(v) => upd("charge_type", v)}>
            <SelectTrigger className="bg-dashboard-base-100 border-dashboard-base-content/20 text-dashboard-base-content cursor-pointer">
              <SelectValue placeholder="Select type…" />
            </SelectTrigger>
            <SelectContent>
              {CHARGE_TYPES.map((c) => (
                <SelectItem key={c.value} value={c.value} className="cursor-pointer">
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-dashboard-base-content">
          Description{" "}
          <span className="font-normal text-xs text-dashboard-base-content/40">optional</span>
        </Label>
        <Textarea
          placeholder="e.g. Check-in before 12 PM"
          value={form.description}
          onChange={(e) => upd("description", e.target.value)}
          rows={2}
          className="bg-dashboard-base-100 border-dashboard-base-content/20 resize-none text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-dashboard-base-content">
            Weekday Price (₹{chargeSuffix(form.charge_type)}) <span className="text-dashboard-error">*</span>
          </Label>
          <Input
            type="number" min={0} placeholder="500"
            value={form.price}
            onChange={(e) => upd("price", e.target.value)}
            className="bg-dashboard-base-100 border-dashboard-base-content/20"
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 h-5">
            <input
              type="checkbox" id="addon-weekend"
              checked={!!form.weekend_price}
              onChange={(e) => upd("weekend_price", e.target.checked ? form.price : "")}
              className="h-3.5 w-3.5 accent-dashboard-primary cursor-pointer"
            />
            <Label htmlFor="addon-weekend" className="text-sm font-medium text-dashboard-base-content cursor-pointer">
              Weekend rate (Sat &amp; Sun)
              {form.price && (
                <span className="text-xs text-dashboard-base-content/50 ml-1">
                  (base ₹{Number(form.price).toLocaleString("en-IN")})
                </span>
              )}
            </Label>
          </div>
          {form.weekend_price !== "" && (
            <Input
              type="number" min={0} placeholder="Same as weekday"
              value={form.weekend_price}
              onChange={(e) => upd("weekend_price", e.target.value)}
              className="bg-dashboard-base-100 border-dashboard-base-content/20"
            />
          )}
        </div>
      </div>

      <div className="border-t border-dashboard-base-content/10 pt-4">
        <SeasonsInlineList
          seasons={form.seasons}
          onChange={(s) => upd("seasons", s)}
          basePrice={Number(form.price) || 0}
        />
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-dashboard-base-content/10">
        <div className="flex items-center gap-2">
          <Switch checked={form.is_active} onCheckedChange={(v) => upd("is_active", v)} />
          <span className="text-sm text-dashboard-base-content/60">Active</span>
        </div>
        <div className="flex gap-2">
          <Button
            type="button" variant="ghost" size="sm"
            onClick={onCancel} disabled={isSaving}
            className="text-dashboard-base-content/60 hover:text-dashboard-base-content hover:bg-dashboard-base-300 cursor-pointer"
          >
            <X className="mr-1 h-3.5 w-3.5" /> Cancel
          </Button>
          <Button
            type="button" size="sm"
            disabled={!isValid || isSaving}
            onClick={() => onSave(form)}
            className="bg-dashboard-primary text-dashboard-primary-content hover:bg-dashboard-primary/90 cursor-pointer"
          >
            {isSaving
              ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Saving…</>
              : <><Check className="mr-1.5 h-3.5 w-3.5" />Save Add-on</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

function AddonCard({
  addon, onEdit, onDelete, isDeleting,
}: {
  addon:      HotelAddon;
  onEdit:     () => void;
  onDelete:   () => void;
  isDeleting: boolean;
}) {
  const [open, setOpen] = useState(false);
  const suffix = chargeSuffix(addon.charge_type);

  return (
    <div className="border border-dashboard-base-content/20 rounded-xl overflow-hidden bg-dashboard-base-100 shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 hover:bg-dashboard-base-200 transition-colors">
        <button
          type="button"
          onClick={() => setOpen((p) => !p)}
          className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
        >
          {open
            ? <ChevronDown className="h-4 w-4 text-dashboard-base-content/40 shrink-0" />
            : <ChevronRight className="h-4 w-4 text-dashboard-base-content/40 shrink-0" />}
          <Package className="h-4 w-4 text-dashboard-secondary/70 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-dashboard-base-content truncate">{addon.label}</p>
              {!addon.is_active && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Inactive</Badge>
              )}
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-dashboard-base-content/20 text-dashboard-base-content/50">
                {CHARGE_TYPES.find((c) => c.value === addon.charge_type)?.label ?? addon.charge_type}
              </Badge>
            </div>
            <p className="text-xs text-dashboard-base-content/50">
              ₹{addon.price.toLocaleString("en-IN")}{suffix} weekday
              {addon.weekend_price ? ` · ₹${addon.weekend_price.toLocaleString("en-IN")} weekend` : ""}
              {addon.seasons.length > 0
                ? ` · ${addon.seasons.length} season${addon.seasons.length !== 1 ? "s" : ""}`
                : ""}
            </p>
            {addon.description && (
              <p className="text-xs text-dashboard-base-content/40 mt-0.5 truncate">{addon.description}</p>
            )}
          </div>
        </button>
        <div className="flex items-center gap-1 shrink-0 ml-3">
          <Button
            size="sm" variant="ghost"
            className="h-7 w-7 p-0 text-dashboard-base-content/50 hover:text-dashboard-primary hover:bg-dashboard-primary/10 cursor-pointer"
            onClick={onEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm" variant="ghost"
                className="h-7 w-7 p-0 text-dashboard-base-content/50 hover:text-dashboard-error hover:bg-dashboard-error/10 cursor-pointer"
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete &ldquo;{addon.label}&rdquo;?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove this add-on and all its seasons.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDelete}
                  className="bg-dashboard-error text-dashboard-error-content hover:bg-dashboard-error/90 cursor-pointer"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {open && (addon.description || addon.seasons.length > 0) && (
        <div className="px-4 pb-4 pt-2 border-t border-dashboard-base-content/10 space-y-2">
          {addon.description && (
            <p className="text-xs text-dashboard-base-content/60">{addon.description}</p>
          )}
          {addon.seasons.length > 0 && (
            <>
              <p className="text-[10px] font-bold uppercase tracking-widest text-dashboard-base-content/50 mt-2 mb-2">
                Seasonal Pricing
              </p>
              {addon.seasons.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between text-xs bg-dashboard-base-200 rounded-lg px-3 py-1.5"
                >
                  <span className="text-dashboard-base-content/60">{s.season_name}</span>
                  <span className="font-medium text-dashboard-base-content">
                    ₹{s.price.toLocaleString("en-IN")}
                    {s.weekend_price && (
                      <span className="text-dashboard-base-content/50 ml-1.5">
                        · ₹{s.weekend_price.toLocaleString("en-IN")} wknd
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export function MealsAndAddonsTab({
  hotel_id,
  initialMeals,
  initialAddons,
}: {
  hotel_id:      number;
  initialMeals:  HotelMealPricing[];
  initialAddons: HotelAddon[];
}) {
  // ── Meals state ──────────────────────────────────────────────────────────────
  const [meals, setMeals]                   = useState<HotelMealPricing[]>(initialMeals);
  const [addingMeal, setAddingMeal]         = useState(false);
  const [editingMealId, setEditingMealId]   = useState<number | null>(null);
  const [deletingMealId, setDeletingMealId] = useState<number | null>(null);
  const [isMealPending, startMealTransition] = useTransition();

  // ── Addons state ─────────────────────────────────────────────────────────────
  const [addons, setAddons]                     = useState<HotelAddon[]>(initialAddons);
  const [addingAddon, setAddingAddon]           = useState(false);
  const [editingAddonId, setEditingAddonId]     = useState<number | null>(null);
  const [deletingAddonId, setDeletingAddonId]   = useState<number | null>(null);
  const [isAddonPending, startAddonTransition]  = useTransition();

  // ── Meal handlers ─────────────────────────────────────────────────────────────
  function handleAddMeal(form: MealFormState) {
    startMealTransition(async () => {
      const res = await createMealPricing(hotel_id, buildMealInput(form));
      if (!res.success) { toast.error(res.message); return; }
      toast.success(res.message);
      setAddingMeal(false);
      setMeals((prev) => [
        ...prev,
        {
          id:            res.id!,
          hotel_id,
          meal_type:     form.meal_type,
          label:         form.label.trim(),
          price:         form.veg_non_veg ? Number(form.veg_price) : Number(form.price),
          weekend_price: form.weekend_price ? Number(form.weekend_price) : null,
          veg_price:     form.veg_non_veg ? Number(form.veg_price) : null,
          non_veg_price: form.veg_non_veg ? Number(form.non_veg_price) : null,
          is_active:     form.is_active,
          sort_order:    prev.length,
          seasons:       form.seasons
            .filter((s) => s.valid_from && s.valid_to && Number(s.price) > 0)
            .map((s, i) => ({
              id:              Date.now() + i,
              meal_pricing_id: res.id!,
              season_name:     `${fmtMonthDay(s.valid_from)} → ${fmtMonthDay(s.valid_to)}`,
              valid_from:      new Date(s.valid_from),
              valid_to:        new Date(s.valid_to),
              price:           Number(s.price),
              weekend_price:   s.weekend_price ? Number(s.weekend_price) : null,
              is_active:       true,
              sort_order:      i,
            })),
        },
      ]);
    });
  }

  function handleEditMeal(id: number, form: MealFormState) {
    startMealTransition(async () => {
      const res = await updateMealPricing(id, hotel_id, buildMealInput(form));
      if (!res.success) { toast.error(res.message); return; }
      toast.success(res.message);
      setEditingMealId(null);
      setMeals((prev) => prev.map((m) =>
        m.id !== id ? m : {
          ...m,
          meal_type:     form.meal_type,
          label:         form.label.trim(),
          price:         form.veg_non_veg ? Number(form.veg_price) : Number(form.price),
          weekend_price: form.weekend_price ? Number(form.weekend_price) : null,
          veg_price:     form.veg_non_veg ? Number(form.veg_price) : null,
          non_veg_price: form.veg_non_veg ? Number(form.non_veg_price) : null,
          is_active:     form.is_active,
          seasons:       form.seasons
            .filter((s) => s.valid_from && s.valid_to && Number(s.price) > 0)
            .map((s, i) => ({
              id:              Date.now() + i,
              meal_pricing_id: id,
              season_name:     `${fmtMonthDay(s.valid_from)} → ${fmtMonthDay(s.valid_to)}`,
              valid_from:      new Date(s.valid_from),
              valid_to:        new Date(s.valid_to),
              price:           Number(s.price),
              weekend_price:   s.weekend_price ? Number(s.weekend_price) : null,
              is_active:       true,
              sort_order:      i,
            })),
        },
      ));
    });
  }

  function handleDeleteMeal(id: number) {
    setDeletingMealId(id);
    startMealTransition(async () => {
      const res = await deleteMealPricing(id, hotel_id);
      setDeletingMealId(null);
      if (!res.success) { toast.error(res.message); return; }
      toast.success(res.message);
      setMeals((prev) => prev.filter((m) => m.id !== id));
    });
  }

  // ── Addon handlers ────────────────────────────────────────────────────────────
  function handleAddAddon(form: AddonFormState) {
    startAddonTransition(async () => {
      const res = await createAddon(hotel_id, buildAddonInput(form));
      if (!res.success) { toast.error(res.message); return; }
      toast.success(res.message);
      setAddingAddon(false);
      setAddons((prev) => [
        ...prev,
        {
          id:            res.id!,
          hotel_id,
          label:         form.label.trim(),
          description:   form.description.trim() || null,
          charge_type:   form.charge_type,
          price:         Number(form.price),
          weekend_price: form.weekend_price ? Number(form.weekend_price) : null,
          is_active:     form.is_active,
          sort_order:    prev.length,
          seasons:       form.seasons
            .filter((s) => s.valid_from && s.valid_to && Number(s.price) > 0)
            .map((s, i) => ({
              id:           Date.now() + i,
              addon_id:     res.id!,
              season_name:  `${fmtMonthDay(s.valid_from)} → ${fmtMonthDay(s.valid_to)}`,
              valid_from:   new Date(s.valid_from),
              valid_to:     new Date(s.valid_to),
              price:        Number(s.price),
              weekend_price: s.weekend_price ? Number(s.weekend_price) : null,
              is_active:    true,
              sort_order:   i,
            })),
        },
      ]);
    });
  }

  function handleEditAddon(id: number, form: AddonFormState) {
    startAddonTransition(async () => {
      const res = await updateAddon(id, hotel_id, buildAddonInput(form));
      if (!res.success) { toast.error(res.message); return; }
      toast.success(res.message);
      setEditingAddonId(null);
      setAddons((prev) => prev.map((a) =>
        a.id !== id ? a : {
          ...a,
          label:         form.label.trim(),
          description:   form.description.trim() || null,
          charge_type:   form.charge_type,
          price:         Number(form.price),
          weekend_price: form.weekend_price ? Number(form.weekend_price) : null,
          is_active:     form.is_active,
          seasons:       form.seasons
            .filter((s) => s.valid_from && s.valid_to && Number(s.price) > 0)
            .map((s, i) => ({
              id:           Date.now() + i,
              addon_id:     id,
              season_name:  `${fmtMonthDay(s.valid_from)} → ${fmtMonthDay(s.valid_to)}`,
              valid_from:   new Date(s.valid_from),
              valid_to:     new Date(s.valid_to),
              price:        Number(s.price),
              weekend_price: s.weekend_price ? Number(s.weekend_price) : null,
              is_active:    true,
              sort_order:   i,
            })),
        },
      ));
    });
  }

  function handleDeleteAddon(id: number) {
    setDeletingAddonId(id);
    startAddonTransition(async () => {
      const res = await deleteAddon(id, hotel_id);
      setDeletingAddonId(null);
      if (!res.success) { toast.error(res.message); return; }
      toast.success(res.message);
      setAddons((prev) => prev.filter((a) => a.id !== id));
    });
  }

  return (
    <div className="space-y-6">

      {/* ── Meals Panel ─────────────────────────────────────────────────────── */}
      <div className="space-y-5 bg-dashboard-base-100 p-8 rounded-xl shadow-lg border border-dashboard-base-content/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-dashboard-base-content">Meal Pricing</p>
            <p className="text-xs text-dashboard-base-content/50 mt-0.5">
              Configure per-person meal prices with optional seasonal &amp; weekend rates.
            </p>
          </div>
          {!addingMeal && (
            <Button
              size="sm"
              className="gap-1.5 bg-dashboard-primary text-dashboard-primary-content hover:bg-dashboard-primary/90 cursor-pointer"
              onClick={() => { setAddingMeal(true); setEditingMealId(null); }}
            >
              <Plus className="h-3.5 w-3.5" /> Add Meal
            </Button>
          )}
        </div>

        {addingMeal && (
          <MealForm
            initial={EMPTY_MEAL_FORM}
            onSave={handleAddMeal}
            onCancel={() => setAddingMeal(false)}
            isSaving={isMealPending}
            usedMealTypes={new Set(meals.map((m) => m.meal_type).filter((t) => t !== "CUSTOM"))}
          />
        )}

        {meals.length === 0 && !addingMeal ? (
          <div className="flex flex-col items-center justify-center py-12 rounded-xl border border-dashed border-dashboard-base-content/20 bg-dashboard-base-200/30">
            <UtensilsCrossed className="h-8 w-8 text-dashboard-base-content/20 mb-3" />
            <p className="text-sm font-medium text-dashboard-base-content/50">No meal pricing configured</p>
            <p className="text-xs text-dashboard-base-content/40 mt-1">Click &ldquo;Add Meal&rdquo; to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {meals.map((meal) =>
              editingMealId === meal.id ? (
                <MealForm
                  key={meal.id}
                  initial={toMealFormState(meal)}
                  onSave={(form) => handleEditMeal(meal.id, form)}
                  onCancel={() => setEditingMealId(null)}
                  isSaving={isMealPending}
                  usedMealTypes={new Set(
                    meals.filter((m) => m.id !== meal.id && m.meal_type !== "CUSTOM").map((m) => m.meal_type),
                  )}
                />
              ) : (
                <MealCard
                  key={meal.id}
                  meal={meal}
                  onEdit={() => { setEditingMealId(meal.id); setAddingMeal(false); }}
                  onDelete={() => handleDeleteMeal(meal.id)}
                  isDeleting={deletingMealId === meal.id}
                />
              ),
            )}
          </div>
        )}
      </div>

      {/* ── Add-ons Panel ───────────────────────────────────────────────────── */}
      <div className="space-y-5 bg-dashboard-base-100 p-8 rounded-xl shadow-lg border border-dashboard-base-content/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-dashboard-base-content">Add-ons</p>
            <p className="text-xs text-dashboard-base-content/50 mt-0.5">
              Optional extras guests can add to their stay — e.g. early check-in, extra bed, room decoration.
            </p>
          </div>
          {!addingAddon && (
            <Button
              size="sm"
              className="gap-1.5 bg-dashboard-primary text-dashboard-primary-content hover:bg-dashboard-primary/90 cursor-pointer"
              onClick={() => { setAddingAddon(true); setEditingAddonId(null); }}
            >
              <Plus className="h-3.5 w-3.5" /> Add Add-on
            </Button>
          )}
        </div>

        {addingAddon && (
          <AddonForm
            initial={EMPTY_ADDON_FORM}
            onSave={handleAddAddon}
            onCancel={() => setAddingAddon(false)}
            isSaving={isAddonPending}
          />
        )}

        {addons.length === 0 && !addingAddon ? (
          <div className="flex flex-col items-center justify-center py-12 rounded-xl border border-dashed border-dashboard-base-content/20 bg-dashboard-base-200/30">
            <Package className="h-8 w-8 text-dashboard-base-content/20 mb-3" />
            <p className="text-sm font-medium text-dashboard-base-content/50">No add-ons configured</p>
            <p className="text-xs text-dashboard-base-content/40 mt-1">Click &ldquo;Add Add-on&rdquo; to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {addons.map((addon) =>
              editingAddonId === addon.id ? (
                <AddonForm
                  key={addon.id}
                  initial={toAddonFormState(addon)}
                  onSave={(form) => handleEditAddon(addon.id, form)}
                  onCancel={() => setEditingAddonId(null)}
                  isSaving={isAddonPending}
                />
              ) : (
                <AddonCard
                  key={addon.id}
                  addon={addon}
                  onEdit={() => { setEditingAddonId(addon.id); setAddingAddon(false); }}
                  onDelete={() => handleDeleteAddon(addon.id)}
                  isDeleting={deletingAddonId === addon.id}
                />
              ),
            )}
          </div>
        )}
      </div>

    </div>
  );
}
