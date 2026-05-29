"use client";

import { useState, useTransition } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Switch } from "../../../components/ui/switch";
import { Badge } from "../../../components/ui/badge";
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
  ChevronDown, ChevronRight, Calendar, AlertTriangle,
  CalendarDays, Info, UtensilsCrossed,
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
  type HotelMealPricing, type MealPricingInput, type MealSeasonInput,
} from "../../actions";

// ── Constants ─────────────────────────────────────────────────────────────

export const PRESET_MEALS = [
  { value: "BREAKFAST",      label: "Breakfast" },
  { value: "LUNCH",          label: "Lunch" },
  { value: "DINNER",         label: "Dinner" },
  { value: "MORNING_SNACKS", label: "Morning Snacks" },
  { value: "EVENING_SNACKS", label: "Evening Snacks" },
  { value: "CUSTOM",         label: "Custom…" },
] as const;

// ── Local types ────────────────────────────────────────────────────────────

type SeasonEntry = {
  tempId:        string;
  valid_from:    string;
  valid_to:      string;
  price:         string;
  weekend_price: string;
};

type MealFormState = {
  meal_type:     string;
  label:         string;
  price:         string;
  weekend_price: string;
  is_active:     boolean;
  seasons:       SeasonEntry[];
};

const EMPTY_FORM: MealFormState = {
  meal_type:     "",
  label:         "",
  price:         "",
  weekend_price: "",
  is_active:     true,
  seasons:       [],
};

const EMPTY_SEASON: Omit<SeasonEntry, "tempId"> = {
  valid_from:    "",
  valid_to:      "",
  price:         "",
  weekend_price: "",
};

// ── Helpers ────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2); }

function toISODate(val: Date | string | null | undefined): string {
  if (!val) return "";
  const d = typeof val === "string" ? new Date(val) : val;
  return isNaN(d.getTime()) ? "" : d.toISOString().split("T")[0];
}

function toDateObj(str: string): Date | undefined {
  if (!str) return undefined;
  const normalized = "2000" + str.slice(4);
  const d = new Date(normalized + "T00:00:00");
  return isNaN(d.getTime()) ? undefined : d;
}

function fromDateObj(d: Date | undefined): string {
  if (!d) return "";
  const m   = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `2000-${m}-${day}`;
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

function toFormState(m: HotelMealPricing): MealFormState {
  return {
    meal_type:     m.meal_type,
    label:         m.label,
    price:         String(m.price),
    weekend_price: m.weekend_price ? String(m.weekend_price) : "",
    is_active:     m.is_active,
    seasons:       m.seasons.map((s) => ({
      tempId:        uid(),
      valid_from:    toISODate(s.valid_from),
      valid_to:      toISODate(s.valid_to),
      price:         String(s.price),
      weekend_price: s.weekend_price ? String(s.weekend_price) : "",
    })),
  };
}

function buildInput(form: MealFormState): MealPricingInput {
  return {
    meal_type:     form.meal_type,
    label:         form.label.trim(),
    price:         Number(form.price),
    weekend_price: form.weekend_price ? Number(form.weekend_price) : null,
    is_active:     form.is_active,
    seasons:       form.seasons
      .filter((s) => s.valid_from && s.valid_to && Number(s.price) > 0)
      .map((s, i) => ({
        season_name:   `${fmtMonthDay(s.valid_from)} → ${fmtMonthDay(s.valid_to)}`,
        valid_from:    s.valid_from,
        valid_to:      s.valid_to,
        price:         Number(s.price),
        weekend_price: s.weekend_price ? Number(s.weekend_price) : null,
        is_active:     true,
      } satisfies MealSeasonInput & { season_name: string })),
  };
}

// ── Seasons inline list ────────────────────────────────────────────────────

function SeasonsInlineList({
  seasons,
  onChange,
  basePrice = 0,
}: {
  seasons: SeasonEntry[];
  onChange: (s: SeasonEntry[]) => void;
  basePrice?: number;
}) {
  const overlapping = overlappingIds(seasons);

  const calendarSeasons: SeasonRange[] = seasons
    .filter((x) => x.valid_from && x.valid_to && Number(x.price) > 0)
    .map((x) => ({
      from:           x.valid_from.slice(5),
      to:             x.valid_to.slice(5),
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
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" />
          Seasonal Pricing
          <span className="font-normal normal-case text-muted-foreground/60">— optional</span>
        </p>
      </div>

      {overlapping.size > 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Overlapping seasons detected. Fix before saving.
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
          <Info className="h-3.5 w-3.5 shrink-0" />
          Click a start date then an end date on the calendar to set the range.
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
              hasOverlap ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/10",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{rangeLabel || "New season"}</span>
              <Button
                type="button" size="icon" variant="ghost"
                className="h-6 w-6 text-destructive hover:text-destructive cursor-pointer"
                onClick={() => removeSeason(s.tempId)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Price row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Weekday Price (₹) <span className="text-destructive">*</span></Label>
                <Input
                  type="number" className={cn("h-8 text-sm", priceInvalid && "border-destructive/50")}
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
                    className="h-3.5 w-3.5 accent-primary"
                  />
                  <Label htmlFor={`wknd-${s.tempId}`} className="text-xs cursor-pointer">
                    Weekend (Sat &amp; Sun)
                    {s.price && <span className="text-muted-foreground ml-1">(base ₹{Number(s.price).toLocaleString("en-IN")})</span>}
                  </Label>
                </div>
                {s.weekend_price !== "" && (
                  <Input
                    type="number" className="h-8 text-sm"
                    placeholder="Same as weekday"
                    value={s.weekend_price}
                    onChange={(e) => updSeason(s.tempId, "weekend_price", e.target.value)}
                  />
                )}
              </div>
            </div>

            {/* Calendar */}
            <div className="space-y-1">
              <Label className="text-xs">Date Range <span className="text-destructive">*</span></Label>
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

      <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1.5 w-full border-dashed cursor-pointer" onClick={addSeason}>
        <Plus className="h-3.5 w-3.5" /> Add Season
      </Button>
    </div>
  );
}

// ── Meal Form ──────────────────────────────────────────────────────────────

function MealForm({
  initial,
  onSave,
  onCancel,
  isSaving,
}: {
  initial: MealFormState;
  onSave: (form: MealFormState) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<MealFormState>(initial);
  function upd<K extends keyof MealFormState>(k: K, v: MealFormState[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  const isPreset = PRESET_MEALS.some((m) => m.value !== "CUSTOM" && m.value === form.meal_type);
  const overlaps = overlappingIds(form.seasons);
  const isValid =
    !!form.meal_type && !!form.label.trim() &&
    !!form.price && Number(form.price) > 0 &&
    overlaps.size === 0 &&
    form.seasons.every((s) => !s.valid_from || (s.valid_from && s.valid_to && Number(s.price) > 0));

  return (
    <div className="border rounded-xl p-4 space-y-4 bg-muted/20">
      {/* Meal type selector */}
      <div className="space-y-1.5">
        <Label>Meal Type <span className="text-destructive">*</span></Label>
        <Select
          value={form.meal_type}
          onValueChange={(v) => {
            const preset = PRESET_MEALS.find((m) => m.value === v);
            upd("meal_type", v);
            if (preset && v !== "CUSTOM") upd("label", preset.label);
            else if (v === "CUSTOM") upd("label", "");
          }}
        >
          <SelectTrigger className="cursor-pointer"><SelectValue placeholder="Select meal type…" /></SelectTrigger>
          <SelectContent>
            {PRESET_MEALS.map((m) => (
              <SelectItem key={m.value} value={m.value} className="cursor-pointer">{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Custom name — only shown for Custom type */}
      {form.meal_type === "CUSTOM" && (
        <div className="space-y-1.5">
          <Label>Name <span className="text-destructive">*</span></Label>
          <Input
            placeholder="e.g. Evening High Tea"
            value={form.label}
            onChange={(e) => upd("label", e.target.value)}
            autoFocus
          />
        </div>
      )}

      {/* Base price + weekend */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Weekday Price (₹/person) <span className="text-destructive">*</span></Label>
          <Input
            type="number" min={0} placeholder="150"
            value={form.price}
            onChange={(e) => upd("price", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 h-5">
            <input
              type="checkbox"
              id="meal-weekend"
              checked={!!form.weekend_price}
              onChange={(e) => upd("weekend_price", e.target.checked ? form.price : "")}
              className="h-3.5 w-3.5 accent-primary"
            />
            <Label htmlFor="meal-weekend" className="text-sm cursor-pointer">
              Weekend rate (Sat &amp; Sun)
              {form.price && <span className="text-xs text-muted-foreground ml-1">(base ₹{Number(form.price).toLocaleString("en-IN")})</span>}
            </Label>
          </div>
          {form.weekend_price !== "" && (
            <Input
              type="number" min={0} placeholder="Same as weekday"
              value={form.weekend_price}
              onChange={(e) => upd("weekend_price", e.target.value)}
            />
          )}
        </div>
      </div>

      {/* Seasonal pricing */}
      <div className="border-t pt-3">
        <SeasonsInlineList
          seasons={form.seasons}
          onChange={(s) => upd("seasons", s)}
          basePrice={Number(form.price) || 0}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <Switch checked={form.is_active} onCheckedChange={(v) => upd("is_active", v)} />
          <span className="text-sm text-muted-foreground">Active</span>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isSaving} className="cursor-pointer">
            <X className="mr-1 h-3.5 w-3.5" /> Cancel
          </Button>
          <Button type="button" size="sm" disabled={!isValid || isSaving} onClick={() => onSave(form)} className="cursor-pointer">
            {isSaving ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Saving…</> : <><Check className="mr-1.5 h-3.5 w-3.5" />Save Meal</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Meal Card (display) ────────────────────────────────────────────────────

function MealCard({
  meal,
  hotelId,
  onEdit,
  onDelete,
  isDeleting,
}: {
  meal: HotelMealPricing;
  hotelId: number;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border rounded-xl overflow-hidden bg-background">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors text-left cursor-pointer"
      >
        <div className="flex items-center gap-3 min-w-0">
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
          <UtensilsCrossed className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold truncate">{meal.label}</p>
              {!meal.is_active && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Inactive</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              ₹{meal.price.toLocaleString("en-IN")}/person weekday
              {meal.weekend_price ? ` · ₹${meal.weekend_price.toLocaleString("en-IN")} weekend` : ""}
              {meal.seasons.length > 0 ? ` · ${meal.seasons.length} season${meal.seasons.length !== 1 ? "s" : ""}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-3" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 cursor-pointer" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:text-destructive hover:bg-destructive/10 cursor-pointer" disabled={isDeleting}>
                {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete "{meal.label}"?</AlertDialogTitle>
                <AlertDialogDescription>This will permanently remove this meal pricing and all its seasons.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </button>

      {open && meal.seasons.length > 0 && (
        <div className="px-4 pb-3 pt-1 border-t space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Seasonal Pricing</p>
          {meal.seasons.map((s) => (
            <div key={s.id} className="flex items-center justify-between text-xs bg-muted/40 rounded-lg px-3 py-1.5">
              <span className="text-muted-foreground">{s.season_name}</span>
              <span className="font-medium">
                ₹{s.price.toLocaleString("en-IN")}
                {s.weekend_price ? <span className="text-muted-foreground ml-1.5">· ₹{s.weekend_price.toLocaleString("en-IN")} wknd</span> : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Tab ───────────────────────────────────────────────────────────────

export function MealsTab({
  hotel_id,
  initialMeals,
}: {
  hotel_id: number;
  initialMeals: HotelMealPricing[];
}) {
  const [meals, setMeals] = useState<HotelMealPricing[]>(initialMeals);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAdd(form: MealFormState) {
    startTransition(async () => {
      const res = await createMealPricing(hotel_id, buildInput(form));
      if (!res.success) { toast.error(res.message); return; }
      toast.success(res.message);
      setAdding(false);
      // Optimistic: add with temp id; page revalidation will refresh
      setMeals((prev) => [
        ...prev,
        {
          id: res.id!,
          hotel_id,
          meal_type: form.meal_type,
          label: form.label.trim(),
          price: Number(form.price),
          weekend_price: form.weekend_price ? Number(form.weekend_price) : null,
          is_active: form.is_active,
          sort_order: prev.length,
          seasons: form.seasons
            .filter((s) => s.valid_from && s.valid_to && Number(s.price) > 0)
            .map((s, i) => ({
              id: Date.now() + i,
              meal_pricing_id: res.id!,
              season_name: `${fmtMonthDay(s.valid_from)} → ${fmtMonthDay(s.valid_to)}`,
              valid_from: new Date(s.valid_from),
              valid_to: new Date(s.valid_to),
              price: Number(s.price),
              weekend_price: s.weekend_price ? Number(s.weekend_price) : null,
              is_active: true,
              sort_order: i,
            })),
        },
      ]);
    });
  }

  function handleEdit(id: number, form: MealFormState) {
    startTransition(async () => {
      const res = await updateMealPricing(id, hotel_id, buildInput(form));
      if (!res.success) { toast.error(res.message); return; }
      toast.success(res.message);
      setEditingId(null);
      setMeals((prev) => prev.map((m) =>
        m.id !== id ? m : {
          ...m,
          meal_type: form.meal_type,
          label: form.label.trim(),
          price: Number(form.price),
          weekend_price: form.weekend_price ? Number(form.weekend_price) : null,
          is_active: form.is_active,
          seasons: form.seasons
            .filter((s) => s.valid_from && s.valid_to && Number(s.price) > 0)
            .map((s, i) => ({
              id: Date.now() + i,
              meal_pricing_id: id,
              season_name: `${fmtMonthDay(s.valid_from)} → ${fmtMonthDay(s.valid_to)}`,
              valid_from: new Date(s.valid_from),
              valid_to: new Date(s.valid_to),
              price: Number(s.price),
              weekend_price: s.weekend_price ? Number(s.weekend_price) : null,
              is_active: true,
              sort_order: i,
            })),
        },
      ));
    });
  }

  function handleDelete(id: number) {
    setDeletingId(id);
    startTransition(async () => {
      const res = await deleteMealPricing(id, hotel_id);
      setDeletingId(null);
      if (!res.success) { toast.error(res.message); return; }
      toast.success(res.message);
      setMeals((prev) => prev.filter((m) => m.id !== id));
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Meal Pricing</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure per-person meal prices with optional seasonal &amp; weekend rates.
          </p>
        </div>
        {!adding && (
          <Button size="sm" className="gap-1.5 cursor-pointer" onClick={() => { setAdding(true); setEditingId(null); }}>
            <Plus className="h-3.5 w-3.5" /> Add Meal
          </Button>
        )}
      </div>

      {/* Add form */}
      {adding && (
        <MealForm
          initial={EMPTY_FORM}
          onSave={handleAdd}
          onCancel={() => setAdding(false)}
          isSaving={isPending}
        />
      )}

      {/* Meal list */}
      {meals.length === 0 && !adding ? (
        <div className="flex flex-col items-center justify-center py-12 rounded-xl border border-dashed bg-muted/20">
          <UtensilsCrossed className="h-8 w-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No meal pricing configured</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Click "Add Meal" to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {meals.map((meal) =>
            editingId === meal.id ? (
              <MealForm
                key={meal.id}
                initial={toFormState(meal)}
                onSave={(form) => handleEdit(meal.id, form)}
                onCancel={() => setEditingId(null)}
                isSaving={isPending}
              />
            ) : (
              <MealCard
                key={meal.id}
                meal={meal}
                hotelId={hotel_id}
                onEdit={() => { setEditingId(meal.id); setAdding(false); }}
                onDelete={() => handleDelete(meal.id)}
                isDeleting={deletingId === meal.id}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}
