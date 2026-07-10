"use client";

import { useState, useTransition, useRef } from "react";
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
  ChevronDown, ChevronRight, Users, Calendar, AlertTriangle,
  CalendarDays, Info,
} from "lucide-react";
import {
  PricingRangeCalendarPicker,
  type DateRange,
  type SeasonRange,
} from "../../../components/ui/pricing-range-calendar";
import { toast } from "sonner";
import { cn } from "@/app/lib/utils";
import {
  deleteRoomPricing,
  upsertOccupancyPrice, deleteOccupancyPrice,
  createRoomPricingWithSeasons, updateRoomPricingWithSeasons,
  type HotelSeasonInput,
} from "../../actions";

// ── Types ─────────────────────────────────────────────────────────────────

type RoomOption = { id: number; name: string };
type MealType   = { id: number; name: string; covered_meals: string[] };
type DietType   = { id: number; name: string };

type OccupancyPrice = {
  id: number;
  pricing_id: number;
  occupancy: number;
  price_per_night: number;
  original_price: number | null;
};

type SeasonOccupancyPrice = {
  id: number;
  season_id: number;
  occupancy: number;
  price_per_night: number;
  original_price: number | null;
};

type HotelSeason = {
  id: number;
  pricing_id: number;
  season_name: string;
  valid_from: Date | string;
  valid_to: Date | string;
  price_per_night: number;
  weekend_price_per_night: number | null;
  original_price: number | null;
  extra_bed_rate: number | null;
  is_active: boolean;
  sort_order: number;
  occupancy_prices: SeasonOccupancyPrice[];
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
  seasons: HotelSeason[];
};

type OccupancyEntry = { occupancy: number; price: string; original: string };

// Local season entry (before save) — only the fields we need
type SeasonEntry = {
  tempId:                  string;
  valid_from:              string;
  valid_to:                string;
  price_per_night:         string;
  weekend_price_per_night: string;
  extra_bed_rate:          string;
  occupancy_prices:        OccupancyEntry[];
};

type PricingFormState = {
  room_id:             string;
  plan_name:           string;
  meal_type_id:        string;
  diet_type_id:        string;
  base_price_per_night: string;
  base_extra_bed_rate:  string;
  margin_percentage:   string;
  gst_percentage:      string;
  is_active:           boolean;
  occupancy_prices:    OccupancyEntry[];
  seasons:             SeasonEntry[];
};

const EMPTY_FORM: PricingFormState = {
  room_id:              "",
  plan_name:            "",
  meal_type_id:         "",
  diet_type_id:         "",
  base_price_per_night: "",
  base_extra_bed_rate:  "",
  margin_percentage:    "10",
  gst_percentage:       "18",
  is_active:            true,
  occupancy_prices:     [],
  seasons:              [],
};

const EMPTY_SEASON: Omit<SeasonEntry, "tempId"> = {
  valid_from:              "",
  valid_to:                "",
  price_per_night:         "",
  weekend_price_per_night: "",
  extra_bed_rate:          "",
  occupancy_prices:        [],
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

function fmtMonthDay(dateStr: string): string {
  const d = toDateObj(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function overlappingIds(seasons: SeasonEntry[]): Set<string> {
  const withDates = seasons.filter(s => s.valid_from && s.valid_to);
  const out = new Set<string>();
  for (let i = 0; i < withDates.length; i++) {
    for (let j = i + 1; j < withDates.length; j++) {
      const a = withDates[i], b = withDates[j];
      if (a.valid_from <= b.valid_to && b.valid_from <= a.valid_to) {
        out.add(a.tempId); out.add(b.tempId);
      }
    }
  }
  return out;
}

function toFormState(p: PricingPlan): PricingFormState {
  return {
    room_id:              String(p.room_id),
    plan_name:            p.plan_name         ?? "",
    meal_type_id:         p.meal_type_id      ? String(p.meal_type_id)  : "none",
    diet_type_id:         p.diet_type_id      ? String(p.diet_type_id)  : "",
    base_price_per_night: p.price_per_night   ? String(p.price_per_night)  : "",
    base_extra_bed_rate:  p.extra_bed_rate    ? String(p.extra_bed_rate)   : "",
    margin_percentage:    String(p.margin_percentage),
    gst_percentage:       String(p.gst_percentage),
    is_active:            p.is_active,
    occupancy_prices:     [],
    seasons:              (p.seasons ?? []).map(s => ({
      tempId:                  uid(),
      valid_from:              toISODate(s.valid_from),
      valid_to:                toISODate(s.valid_to),
      price_per_night:         String(s.price_per_night),
      weekend_price_per_night: s.weekend_price_per_night ? String(s.weekend_price_per_night) : "",
      extra_bed_rate:          s.extra_bed_rate ? String(s.extra_bed_rate) : "",
      occupancy_prices:        (s.occupancy_prices ?? []).map(op => ({
        occupancy: op.occupancy,
        price:     String(op.price_per_night),
        original:  op.original_price != null ? String(op.original_price) : "",
      })),
    })),
  };
}

// ── Inline Season List (inside PricingForm) ───────────────────────────────

function SeasonsInlineList({
  seasons,
  onChange,
  basePricePerNight = 0,
}: {
  seasons:           SeasonEntry[];
  onChange:          (s: SeasonEntry[]) => void;
  basePricePerNight?: number;
}) {
  const overlapping = overlappingIds(seasons);

  const calendarSeasons: SeasonRange[] = seasons
    .filter(x => x.valid_from && x.valid_to && Number(x.price_per_night) > 0)
    .map(x => ({
      from:           x.valid_from,
      to:             x.valid_to,
      weekdayPrice:   Number(x.price_per_night),
      weekendPrice:   x.weekend_price_per_night ? Number(x.weekend_price_per_night) : null,
      weekendEnabled: !!x.weekend_price_per_night,
    }));

  function addSeason() {
    onChange([...seasons, { ...EMPTY_SEASON, tempId: uid() }]);
  }

  function updSeason<K extends keyof Omit<SeasonEntry, "tempId">>(
    tempId: string,
    key: K,
    value: Omit<SeasonEntry, "tempId">[K],
  ) {
    onChange(seasons.map(s => s.tempId === tempId ? { ...s, [key]: value } : s));
  }

  function removeSeason(tempId: string) {
    onChange(seasons.filter(s => s.tempId !== tempId));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" />
          Seasonal Date Ranges
          <span className="font-normal normal-case text-muted-foreground/60">— optional</span>
        </p>
      </div>

      {overlapping.size > 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashboard-error/30 bg-dashboard-error/5 px-3 py-2 text-xs text-dashboard-error">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Overlapping seasons detected. Fix the highlighted seasons before saving.
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-dashboard-info/40 bg-dashboard-info/10 px-3 py-2 text-xs text-dashboard-base-content/70">
          <Info className="h-3.5 w-3.5 shrink-0 text-dashboard-secondary" />
          Click a start date then an end date on the calendar to set the season range.
        </div>
      )}

      {seasons.map(s => {
        const hasOverlap = overlapping.has(s.tempId);
        const dateRange: DateRange | undefined =
          s.valid_from && s.valid_to
            ? { from: toDateObj(s.valid_from), to: toDateObj(s.valid_to) }
            : s.valid_from
            ? { from: toDateObj(s.valid_from), to: undefined }
            : undefined;

        const rangeLabel =
          s.valid_from && s.valid_to
            ? `${fmtMonthDay(s.valid_from)} → ${fmtMonthDay(s.valid_to)}`
            : "";

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
            {/* Card header */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {rangeLabel || "New season"}
              </span>
              <div className="flex items-center gap-1">
                {hasOverlap && (
                  <span className="text-[10px] text-destructive flex items-center gap-0.5">
                    <AlertTriangle className="h-3 w-3" /> Overlap
                  </span>
                )}
                <Button
                  type="button" size="icon" variant="ghost"
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  onClick={() => removeSeason(s.tempId)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Price/Night + Extra Bed */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">
                  Weekday Price / Night (₹) <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  className={cn("h-8 text-sm", !s.price_per_night && "border-destructive/50")}
                  placeholder="e.g. 4500"
                  value={s.price_per_night}
                  onChange={e => updSeason(s.tempId, "price_per_night", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Extra Bed (₹)</Label>
                <Input
                  type="number"
                  className="h-8 text-sm"
                  placeholder="optional"
                  value={s.extra_bed_rate}
                  onChange={e => updSeason(s.tempId, "extra_bed_rate", e.target.value)}
                />
              </div>
            </div>

            {/* Weekend rate */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`weekend-${s.tempId}`}
                  checked={!!s.weekend_price_per_night}
                  onChange={e => {
                    if (!e.target.checked) updSeason(s.tempId, "weekend_price_per_night", "");
                    else updSeason(s.tempId, "weekend_price_per_night", s.price_per_night);
                  }}
                  className="h-3.5 w-3.5 accent-primary"
                />
                <Label htmlFor={`weekend-${s.tempId}`} className="text-xs cursor-pointer">
                  Weekend rate (Sat &amp; Sun)
                  {s.price_per_night && (
                    <span className="text-muted-foreground ml-1">(base ₹{Number(s.price_per_night).toLocaleString("en-IN")}/night)</span>
                  )}
                </Label>
              </div>
              {s.weekend_price_per_night !== "" && (
                <Input
                  type="number"
                  className="h-8 text-sm"
                  placeholder="Same as weekday"
                  value={s.weekend_price_per_night}
                  onChange={e => updSeason(s.tempId, "weekend_price_per_night", e.target.value)}
                />
              )}
            </div>

            {/* Occupancy prices for this season — same 1/2/3/4P tiers as the
                plan-level fallback, but scoped to just this date range. */}
            <div className="space-y-1.5 border-t border-dashboard-base-content/10 pt-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" /> Occupancy Prices for this range
                <span className="font-normal normal-case text-muted-foreground/60">— optional</span>
              </p>
              {OCCUPANCY_OPTIONS.map(occ => {
                const entry = s.occupancy_prices.find(e => e.occupancy === occ.value);
                return (
                  <div key={occ.value} className="flex items-center gap-2">
                    <span className="text-xs w-20 shrink-0 text-muted-foreground">{occ.label}</span>
                    <Input
                      type="number"
                      className="h-7 text-xs flex-1"
                      placeholder="Price"
                      value={entry?.price ?? ""}
                      onChange={e => {
                        const price = e.target.value;
                        const rest = s.occupancy_prices.filter(x => x.occupancy !== occ.value);
                        const next = price
                          ? [...rest, { occupancy: occ.value, price, original: entry?.original ?? "" }].sort((a, b) => a.occupancy - b.occupancy)
                          : rest;
                        updSeason(s.tempId, "occupancy_prices", next);
                      }}
                    />
                    <Input
                      type="number"
                      className="h-7 text-xs flex-1"
                      placeholder="MRP (optional)"
                      value={entry?.original ?? ""}
                      onChange={e => {
                        const original = e.target.value;
                        if (!entry?.price) return;
                        const rest = s.occupancy_prices.filter(x => x.occupancy !== occ.value);
                        const next = [...rest, { occupancy: occ.value, price: entry.price, original }].sort((a, b) => a.occupancy - b.occupancy);
                        updSeason(s.tempId, "occupancy_prices", next);
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Calendar date range picker */}
            <div className="space-y-1">
              <Label className="text-xs">
                Date Range <span className="text-destructive">*</span>
              </Label>
              <PricingRangeCalendarPicker
                value={dateRange}
                onChange={range => {
                  onChange(seasons.map(s2 =>
                    s2.tempId === s.tempId
                      ? { ...s2, valid_from: fromDateObj(range?.from), valid_to: fromDateObj(range?.to) }
                      : s2,
                  ));
                }}
                seasons={calendarSeasons}
                basePrice={basePricePerNight}
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

// ── Plan-name auto-fill helpers ───────────────────────────────────────────

const MEAL_LABELS: Record<string, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };

function formatCoveredMeals(covered: string[]): string {
  const names = covered.map(m => MEAL_LABELS[m] ?? m);
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return names.slice(0, -1).join(", ") + " & " + names.at(-1)!;
}

function buildAutoName(roomName: string, mealType: MealType | null): string {
  if (!roomName) return "";
  if (!mealType) return `${roomName} - Room Only`;
  if (mealType.covered_meals.length > 0) return `${roomName} with ${formatCoveredMeals(mealType.covered_meals)}`;
  return `${roomName} with ${mealType.name}`;
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
  initial:   PricingFormState;
  rooms:     RoomOption[];
  mealTypes: MealType[];
  dietTypes: DietType[];
  onSave:    (form: PricingFormState) => void;
  onCancel:  () => void;
  isSaving:  boolean;
  isNew?:    boolean;
}) {
  const [form, setForm] = useState<PricingFormState>(initial);
  const autoNameRef = useRef(!initial.plan_name); // true = plan name was auto-filled (or blank on new)

  function upd<K extends keyof PricingFormState>(key: K, value: PricingFormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function handleRoomChange(roomId: string) {
    const roomName = rooms.find(r => String(r.id) === roomId)?.name ?? "";
    const mealType = mealTypes.find(m => String(m.id) === form.meal_type_id) ?? null;
    setForm(prev => ({
      ...prev,
      room_id: roomId,
      plan_name: autoNameRef.current ? buildAutoName(roomName, mealType) : prev.plan_name,
    }));
  }

  function handleMealChange(mealId: string) {
    const roomName = rooms.find(r => String(r.id) === form.room_id)?.name ?? "";
    const mealType = mealTypes.find(m => String(m.id) === mealId) ?? null;
    setForm(prev => ({
      ...prev,
      meal_type_id: mealId,
      diet_type_id: mealId === "none" ? "" : prev.diet_type_id,
      plan_name: autoNameRef.current ? buildAutoName(roomName, mealType) : prev.plan_name,
    }));
  }

  function handlePlanNameChange(raw: string) {
    const v = raw.charAt(0).toUpperCase() + raw.slice(1);
    autoNameRef.current = false; // user typed manually — stop auto-fill
    upd("plan_name", v);
  }

  const seasonOverlaps = overlappingIds(form.seasons);

  const isValid =
    !!form.room_id &&
    !!form.meal_type_id &&
    !!form.base_price_per_night && Number(form.base_price_per_night) > 0 &&
    seasonOverlaps.size === 0 &&
    form.seasons.every(
      s => !!s.valid_from && !!s.valid_to &&
           !!s.price_per_night && Number(s.price_per_night) > 0,
    );

  return (
    <div className="border border-dashboard-base-content/20 rounded-xl p-4 space-y-4 bg-dashboard-base-200/60">

      {/* Row 1: Room + Meal Type */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm text-dashboard-base-content">Room <span className="text-dashboard-error">*</span></Label>
          <Select value={form.room_id} onValueChange={handleRoomChange}>
            <SelectTrigger className="bg-dashboard-base-100 border-dashboard-base-content/20 cursor-pointer"><SelectValue placeholder="Select room" /></SelectTrigger>
            <SelectContent>{rooms.map(r => <SelectItem key={r.id} value={String(r.id)} className="cursor-pointer">{r.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm text-dashboard-base-content">Meal Type <span className="text-dashboard-error">*</span></Label>
          <Select value={form.meal_type_id} onValueChange={handleMealChange}>
            <SelectTrigger className={cn("bg-dashboard-base-100 border-dashboard-base-content/20 cursor-pointer", !form.meal_type_id && "border-dashboard-error/40")}>
              <SelectValue placeholder="Select meal plan…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="cursor-pointer">Room Only (EP)</SelectItem>
              {mealTypes.map(m => <SelectItem key={m.id} value={String(m.id)} className="cursor-pointer">{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 2: Plan Name + Diet */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm text-dashboard-base-content">
            Plan Name <span className="text-xs font-normal text-dashboard-base-content/50">(auto-filled)</span>
          </Label>
          <Input placeholder="e.g. Deluxe Room with Breakfast & Dinner"
            value={form.plan_name} onChange={e => handlePlanNameChange(e.target.value)}
            className="bg-dashboard-base-100 border-dashboard-base-content/20" />
        </div>
        <div className="space-y-1.5">
          <Label className={cn("text-sm", form.meal_type_id === "none" ? "text-dashboard-base-content/40" : "text-dashboard-base-content")}>
            Diet Type
            {form.meal_type_id === "none" && <span className="ml-1.5 text-xs font-normal text-dashboard-base-content/40">(N/A for Room Only)</span>}
          </Label>
          <Select value={form.diet_type_id} onValueChange={v => upd("diet_type_id", v)} disabled={form.meal_type_id === "none"}>
            <SelectTrigger className={cn("bg-dashboard-base-100 border-dashboard-base-content/20", form.meal_type_id === "none" ? "opacity-50 cursor-not-allowed" : "cursor-pointer")}>
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="cursor-pointer">Any</SelectItem>
              {dietTypes.map(d => <SelectItem key={d.id} value={String(d.id)} className="cursor-pointer">{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 3: Base Price + Base Extra Bed */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm text-dashboard-base-content">Base Price / Night (₹) <span className="text-dashboard-error">*</span></Label>
          <Input type="number" placeholder="e.g. 3000" value={form.base_price_per_night}
            onChange={e => upd("base_price_per_night", e.target.value)}
            className="bg-dashboard-base-100 border-dashboard-base-content/20" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm text-dashboard-base-content">Base Extra Bed (₹)</Label>
          <Input type="number" placeholder="optional" value={form.base_extra_bed_rate}
            onChange={e => upd("base_extra_bed_rate", e.target.value)}
            className="bg-dashboard-base-100 border-dashboard-base-content/20" />
        </div>
      </div>

      {/* Row 4: Margin + GST */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm text-dashboard-base-content">Margin %</Label>
          <Input type="number" min={0} max={100} value={form.margin_percentage}
            onChange={e => upd("margin_percentage", e.target.value)}
            className="bg-dashboard-base-100 border-dashboard-base-content/20" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm text-dashboard-base-content">GST %</Label>
          <Input type="number" min={0} max={28} value={form.gst_percentage}
            onChange={e => upd("gst_percentage", e.target.value)}
            className="bg-dashboard-base-100 border-dashboard-base-content/20" />
          <p className="text-[10px] text-dashboard-base-content/40">12% (&lt;₹7500) / 18% (≥₹7500)</p>
        </div>
      </div>

      {/* ── Seasons ─────────────────────────────────── */}
      <div className="border-t border-dashboard-base-content/10 pt-3">
        <SeasonsInlineList seasons={form.seasons} onChange={s => upd("seasons", s)}
          basePricePerNight={Number(form.base_price_per_night) || 0} />
      </div>

      {/* Occupancy prices (only on new plan creation) */}
      {isNew && (
        <div className="border-t border-dashboard-base-content/10 pt-3 space-y-2">
          <p className="text-xs font-semibold text-dashboard-base-content/60 uppercase tracking-wide">
            Plan-level Occupancy Prices <span className="font-normal normal-case">(optional fallback)</span>
          </p>
          {OCCUPANCY_OPTIONS.map(occ => {
            const entry = form.occupancy_prices.find(e => e.occupancy === occ.value);
            return (
              <div key={occ.value} className="flex items-center gap-2">
                <span className="text-xs w-24 shrink-0 text-dashboard-base-content/60">{occ.label}</span>
                <Input type="number" className="h-7 text-xs w-28 bg-dashboard-base-100 border-dashboard-base-content/20" placeholder="Price"
                  value={entry?.price ?? ""}
                  onChange={e => {
                    const price = e.target.value;
                    const rest = form.occupancy_prices.filter(x => x.occupancy !== occ.value);
                    upd("occupancy_prices", price ? [...rest, { occupancy: occ.value, price, original: entry?.original ?? "" }] : rest);
                  }} />
                <Input type="number" className="h-7 text-xs w-28 bg-dashboard-base-100 border-dashboard-base-content/20" placeholder="MRP (optional)"
                  value={entry?.original ?? ""}
                  onChange={e => {
                    const original = e.target.value;
                    const rest = form.occupancy_prices.filter(x => x.occupancy !== occ.value);
                    if (entry?.price) upd("occupancy_prices", [...rest, { occupancy: occ.value, price: entry.price, original }]);
                  }} />
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="space-y-2 pt-1 border-t border-dashboard-base-content/10">
        {seasonOverlaps.size > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-dashboard-error/30 bg-dashboard-error/5 px-3 py-2 text-xs text-dashboard-error">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Overlapping season date ranges — fix the highlighted seasons before saving.
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch checked={form.is_active} onCheckedChange={v => upd("is_active", v)} />
            <span className="text-sm text-dashboard-base-content/60">Active</span>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isSaving}
              className="text-dashboard-base-content/60 hover:text-dashboard-base-content hover:bg-dashboard-base-300 cursor-pointer">
              <X className="mr-1 h-3.5 w-3.5" /> Cancel
            </Button>
            <Button type="button" size="sm" disabled={!isValid || isSaving} onClick={() => onSave(form)}
              className="bg-dashboard-primary text-dashboard-primary-content hover:bg-dashboard-primary/90 cursor-pointer">
              {isSaving ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Saving…</> : <><Check className="mr-1.5 h-3.5 w-3.5" />Save Plan</>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Occupancy Prices Panel ────────────────────────────────────────────────

function OccupancyPricesPanel({
  plan,
  hotelId,
  onUpdated,
}: {
  plan:     PricingPlan;
  hotelId:  number;
  onUpdated: (prices: OccupancyPrice[]) => void;
}) {
  const [saving, setSaving]     = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [editOccupancy, setEditOccupancy] = useState<number | null>(null);
  const [addOccupancy, setAddOccupancy]   = useState<string>("");
  const [addPrice, setAddPrice]     = useState("");
  const [addOriginal, setAddOriginal] = useState("");
  const [editPrice, setEditPrice]     = useState("");
  const [editOriginal, setEditOriginal] = useState("");

  const existingOccupancies = new Set(plan.occupancy_prices.map(p => p.occupancy));
  const availableOccupancies = [1, 2, 3, 4].filter(o => !existingOccupancies.has(o));

  async function handleUpsert(occupancy: number, price: string, original: string, existingId?: number) {
    const p = Number(price);
    if (!p || p <= 0) { toast.error("Valid price required"); return; }
    setSaving(occupancy);
    const res = await upsertOccupancyPrice(plan.id, hotelId, occupancy, p, original ? Number(original) : null);
    setSaving(null);
    if (!res.success) { toast.error(res.message); return; }
    const newEntry: OccupancyPrice = {
      id: existingId ?? Date.now(),
      pricing_id: plan.id, occupancy,
      price_per_night: p,
      original_price: original ? Number(original) : null,
    };
    onUpdated(
      existingId
        ? plan.occupancy_prices.map(op => op.occupancy === occupancy ? newEntry : op)
        : [...plan.occupancy_prices, newEntry].sort((a, b) => a.occupancy - b.occupancy),
    );
    setEditOccupancy(null); setAddOccupancy(""); setAddPrice(""); setAddOriginal("");
    toast.success("Occupancy price saved");
  }

  async function handleDelete(entry: OccupancyPrice) {
    setDeleting(entry.id);
    const res = await deleteOccupancyPrice(entry.id, hotelId);
    setDeleting(null);
    if (!res.success) { toast.error(res.message); return; }
    onUpdated(plan.occupancy_prices.filter(op => op.id !== entry.id));
    toast.success("Removed");
  }

  return (
    <div className="px-4 pb-4 pt-2 space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-dashboard-base-content/50 flex items-center gap-1">
        <Users className="h-3 w-3" /> Plan-level Occupancy Prices
        <span className="font-normal normal-case text-dashboard-base-content/40 ml-1">— fallback when season has no override</span>
      </p>

      {plan.occupancy_prices.map(op => (
        <div key={op.occupancy} className="flex items-center gap-2 rounded-lg bg-dashboard-base-200 px-3 py-1.5">
          <span className="text-xs font-medium w-24 shrink-0 text-dashboard-base-content">{OCCUPANCY_LABELS[op.occupancy] ?? `${op.occupancy}P`}</span>
          {editOccupancy === op.occupancy ? (
            <>
              <Input type="number" className="h-7 text-xs w-28 bg-dashboard-base-100 border-dashboard-base-content/20" placeholder="Price"
                value={editPrice} onChange={e => setEditPrice(e.target.value)} autoFocus />
              <Input type="number" className="h-7 text-xs w-28 bg-dashboard-base-100 border-dashboard-base-content/20" placeholder="MRP (optional)"
                value={editOriginal} onChange={e => setEditOriginal(e.target.value)} />
              <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-dashboard-primary hover:bg-dashboard-primary/10 cursor-pointer"
                disabled={saving === op.occupancy}
                onClick={() => handleUpsert(op.occupancy, editPrice, editOriginal, op.id)}>
                {saving === op.occupancy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-dashboard-base-content/50 hover:bg-dashboard-base-300 cursor-pointer"
                onClick={() => setEditOccupancy(null)}>
                <X className="h-3 w-3" />
              </Button>
            </>
          ) : (
            <>
              <span className="text-sm font-semibold flex-1 text-dashboard-base-content">₹{op.price_per_night.toLocaleString()}</span>
              {op.original_price && (
                <span className="text-xs text-dashboard-base-content/40 line-through">₹{op.original_price.toLocaleString()}</span>
              )}
              <Button type="button" size="icon" variant="ghost"
                className="h-6 w-6 ml-auto text-dashboard-base-content/50 hover:text-dashboard-primary hover:bg-dashboard-primary/10 cursor-pointer"
                onClick={() => { setEditOccupancy(op.occupancy); setEditPrice(String(op.price_per_night)); setEditOriginal(op.original_price ? String(op.original_price) : ""); }}>
                <Pencil className="h-3 w-3" />
              </Button>
              <Button type="button" size="icon" variant="ghost"
                className="h-6 w-6 text-dashboard-base-content/50 hover:text-dashboard-error hover:bg-dashboard-error/10 cursor-pointer"
                disabled={deleting === op.id} onClick={() => handleDelete(op)}>
                {deleting === op.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              </Button>
            </>
          )}
        </div>
      ))}

      {availableOccupancies.length > 0 && (
        <div className="flex items-center gap-2">
          <Select value={addOccupancy} onValueChange={setAddOccupancy}>
            <SelectTrigger className="h-7 text-xs w-32 bg-dashboard-base-100 border-dashboard-base-content/20 cursor-pointer"><SelectValue placeholder="Add…" /></SelectTrigger>
            <SelectContent>
              {availableOccupancies.map(o => <SelectItem key={o} value={String(o)} className="cursor-pointer">{OCCUPANCY_LABELS[o] ?? `${o}P`}</SelectItem>)}
            </SelectContent>
          </Select>
          {addOccupancy && (
            <>
              <Input type="number" className="h-7 text-xs w-28 bg-dashboard-base-100 border-dashboard-base-content/20" placeholder="Price / night"
                value={addPrice} onChange={e => setAddPrice(e.target.value)} autoFocus />
              <Input type="number" className="h-7 text-xs w-28 bg-dashboard-base-100 border-dashboard-base-content/20" placeholder="MRP (optional)"
                value={addOriginal} onChange={e => setAddOriginal(e.target.value)} />
              <Button type="button" size="sm"
                className="h-7 px-2 text-xs bg-dashboard-primary text-dashboard-primary-content hover:bg-dashboard-primary/90 cursor-pointer"
                disabled={saving === Number(addOccupancy)}
                onClick={() => handleUpsert(Number(addOccupancy), addPrice, addOriginal)}>
                {saving === Number(addOccupancy) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              </Button>
            </>
          )}
        </div>
      )}

      {plan.occupancy_prices.length === 0 && !addOccupancy && (
        <p className="text-[10px] text-dashboard-base-content/40 italic">
          No plan-level occupancy prices — season prices apply directly.
        </p>
      )}
    </div>
  );
}

// ── Read-only Seasons Summary (in expanded panel) ─────────────────────────

function SeasonsSummaryPanel({ seasons }: { seasons: HotelSeason[] }) {
  if (!seasons.length) return (
    <div className="px-4 pb-3 pt-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-dashboard-base-content/50 flex items-center gap-1 mb-1">
        <Calendar className="h-3 w-3" /> Seasonal Pricing
      </p>
      <p className="text-[10px] text-dashboard-base-content/40 italic">No seasons defined — edit the plan to add seasons.</p>
    </div>
  );

  return (
    <div className="px-4 pb-3 pt-2 space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-dashboard-base-content/50 flex items-center gap-1">
        <Calendar className="h-3 w-3" /> Seasonal Pricing
      </p>
      {seasons.map(s => (
        <div key={s.id} className="rounded-lg px-3 py-1.5 bg-dashboard-base-200 space-y-1">
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className="text-dashboard-base-content/60 shrink-0">
              {fmtMonthDay(toISODate(s.valid_from))} → {fmtMonthDay(toISODate(s.valid_to))}
            </span>
            <span className="font-semibold ml-2 text-dashboard-base-content">₹{Number(s.price_per_night).toLocaleString()}/night</span>
            {s.weekend_price_per_night ? (
              <span className="text-dashboard-base-content/50 shrink-0">· ₹{Number(s.weekend_price_per_night).toLocaleString()} wknd</span>
            ) : null}
            {s.extra_bed_rate ? (
              <span className="text-dashboard-base-content/50 shrink-0">+₹{Number(s.extra_bed_rate).toLocaleString()} EB</span>
            ) : null}
          </div>
          {s.occupancy_prices.length > 0 && (
            <p className="text-[10px] text-dashboard-primary/70 flex items-center gap-1">
              <Users className="h-2.5 w-2.5" />
              {s.occupancy_prices
                .map(op => `${OCCUPANCY_LABELS[op.occupancy] ?? `${op.occupancy}P`}: ₹${Number(op.price_per_night).toLocaleString()}`)
                .join(" · ")}
            </p>
          )}
        </div>
      ))}
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
  onSeasonsUpdated,
}: {
  plan:               PricingPlan;
  hotelId:            number;
  editId:             number | null;
  rooms:              RoomOption[];
  mealTypes:          MealType[];
  dietTypes:          DietType[];
  isPending:          boolean;
  onEdit:             (id: number) => void;
  onSaveEdit:         (id: number, form: PricingFormState) => void;
  onCancelEdit:       () => void;
  onDelete:           (id: number) => void;
  onOccupancyUpdated: (planId: number, prices: OccupancyPrice[]) => void;
  onSeasonsUpdated:   (planId: number, seasons: HotelSeason[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (editId === plan.id) {
    return (
      <div className="p-3 border border-dashboard-base-content/20 rounded-xl">
        <PricingForm
          initial={toFormState(plan)}
          rooms={rooms}
          mealTypes={mealTypes}
          dietTypes={dietTypes}
          onSave={form => onSaveEdit(plan.id, form)}
          onCancel={onCancelEdit}
          isSaving={isPending}
        />
      </div>
    );
  }

  const seasonCount      = plan.seasons?.length ?? 0;
  const occupancySummary = plan.occupancy_prices
    .map(op => `${op.occupancy}P: ₹${op.price_per_night.toLocaleString()}`)
    .join(" · ");

  return (
    <div className={cn("border border-dashboard-base-content/20 rounded-xl overflow-hidden bg-dashboard-base-100", !plan.is_active && "opacity-60")}>
      {/* Header row */}
      <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-dashboard-base-200 transition-colors">
        <button type="button"
          className="text-dashboard-base-content/40 hover:text-dashboard-base-content transition-colors cursor-pointer"
          onClick={() => setExpanded(v => !v)}>
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-dashboard-base-content">
              {plan.plan_name || <span className="text-dashboard-base-content/40 italic text-xs">Unnamed plan</span>}
            </p>
            {plan.meal_type && (
              <Badge className="text-[10px] px-1.5 py-0 bg-dashboard-primary/10 text-dashboard-primary border border-dashboard-primary/20">{plan.meal_type.name}</Badge>
            )}
            {plan.diet_type && (
              <Badge className="text-[10px] px-1.5 py-0 bg-dashboard-base-200 text-dashboard-base-content/60 border border-dashboard-base-content/20">{plan.diet_type.name}</Badge>
            )}
            {!plan.is_active && (
              <Badge className="text-[10px] px-1.5 py-0 bg-dashboard-base-300 text-dashboard-base-content/50 border border-dashboard-base-content/20">Inactive</Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {occupancySummary && <p className="text-[10px] text-dashboard-primary/70">{occupancySummary}</p>}
            {seasonCount > 0 && (
              <Badge className="text-[10px] px-1.5 py-0 bg-dashboard-warning/10 text-dashboard-warning-content border border-dashboard-warning/30">
                <Calendar className="h-2.5 w-2.5 mr-1" />
                {seasonCount} season{seasonCount !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end shrink-0 gap-0.5">
          <p className="text-xs text-dashboard-base-content/50">{plan.margin_percentage}% margin</p>
          <p className="text-[10px] text-dashboard-base-content/40">GST {plan.gst_percentage}%</p>
        </div>

        <div className="flex gap-1 shrink-0">
          <Button type="button" variant="ghost" size="icon"
            className="h-7 w-7 text-dashboard-base-content/50 hover:text-dashboard-primary hover:bg-dashboard-primary/10 cursor-pointer"
            onClick={() => onEdit(plan.id)}>
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
                  Delete <span className="font-semibold">{plan.plan_name || "this pricing plan"}</span>? All seasons and occupancy prices will also be deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(plan.id)}
                  className="bg-dashboard-error text-dashboard-error-content hover:bg-dashboard-error/90 cursor-pointer">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-dashboard-base-content/10 bg-dashboard-base-200/30 divide-y divide-dashboard-base-content/10">
          <SeasonsSummaryPanel seasons={plan.seasons ?? []} />
          <OccupancyPricesPanel plan={plan} hotelId={hotelId} onUpdated={prices => onOccupancyUpdated(plan.id, prices)} />
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
  hotel_id:  number;
  rooms:     RoomOption[];
  pricing:   PricingPlan[];
  mealTypes: MealType[];
  dietTypes: DietType[];
}) {
  const [pricing, setPricing] = useState<PricingPlan[]>(initialPricing);
  const [adding, setAdding]   = useState(false);
  const [editId, setEditId]   = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  function buildSeasonsInput(form: PricingFormState): HotelSeasonInput[] {
    return form.seasons.map(s => ({
      season_name:             s.valid_from && s.valid_to
        ? `${fmtMonthDay(s.valid_from)} → ${fmtMonthDay(s.valid_to)}`
        : "Season",
      valid_from:              s.valid_from,
      valid_to:                s.valid_to,
      price_per_night:         Number(s.price_per_night),
      weekend_price_per_night: s.weekend_price_per_night ? Number(s.weekend_price_per_night) : null,
      original_price:          null,
      extra_bed_rate:          s.extra_bed_rate ? Number(s.extra_bed_rate) : null,
      is_active:               true,
      occupancy_prices:        s.occupancy_prices
        .filter(e => e.price && Number(e.price) > 0)
        .map(e => ({
          occupancy:       e.occupancy,
          price_per_night: Number(e.price),
          original_price:  e.original ? Number(e.original) : null,
        })),
    }));
  }

  function buildOptimisticSeasons(
    seasonsInput: HotelSeasonInput[],
    planId: number,
    baseTime: number,
  ): HotelSeason[] {
    return seasonsInput.map((s, i) => ({
      id:                      baseTime + i,
      pricing_id:              planId,
      season_name:             s.season_name,
      valid_from:              new Date(s.valid_from),
      valid_to:                new Date(s.valid_to),
      price_per_night:         s.price_per_night,
      weekend_price_per_night: s.weekend_price_per_night ?? null,
      original_price:          null,
      extra_bed_rate:          s.extra_bed_rate ?? null,
      is_active:               true,
      sort_order:      i,
      occupancy_prices: (s.occupancy_prices ?? []).map((op, j) => ({
        id:              baseTime + i * 100 + j,
        season_id:       baseTime + i,
        occupancy:       op.occupancy,
        price_per_night: op.price_per_night,
        original_price:  op.original_price ?? null,
      })),
    }));
  }

  function handleAdd(form: PricingFormState) {
    startTransition(async () => {
      const seasons = buildSeasonsInput(form);

      const result = await createRoomPricingWithSeasons(hotel_id, {
        room_id:           Number(form.room_id),
        plan_name:         form.plan_name || null,
        meal_type_id:      form.meal_type_id && form.meal_type_id !== "none" ? Number(form.meal_type_id) : null,
        diet_type_id:      form.diet_type_id && form.diet_type_id !== "none" ? Number(form.diet_type_id) : null,
        price_per_night:   Number(form.base_price_per_night) || null,
        extra_bed_rate:    form.base_extra_bed_rate ? Number(form.base_extra_bed_rate) : null,
        margin_percentage: Number(form.margin_percentage) || 10,
        gst_percentage:    Number(form.gst_percentage) || 18,
        is_active:         form.is_active,
        seasons,
      });

      if (!result.success) { toast.error(result.message); return; }

      const planId = result.id!;
      const savedPrices: OccupancyPrice[] = [];
      for (const entry of form.occupancy_prices) {
        if (entry.price && Number(entry.price) > 0) {
          const r = await upsertOccupancyPrice(planId, hotel_id, entry.occupancy, Number(entry.price),
            entry.original ? Number(entry.original) : null);
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

      const roomId  = Number(form.room_id);
      const mealId  = form.meal_type_id && form.meal_type_id !== "none" ? Number(form.meal_type_id) : null;
      const dietId  = form.diet_type_id && form.diet_type_id !== "none" ? Number(form.diet_type_id) : null;
      const now = Date.now();

      setPricing(prev => [
        ...prev,
        {
          id:                planId,
          hotel_id,
          room_id:           roomId,
          plan_name:         form.plan_name || null,
          meal_type_id:      mealId,
          diet_type_id:      dietId,
          price_per_night:   Number(form.base_price_per_night) || Number(seasons[0]?.price_per_night) || 0,
          original_price:    null,
          extra_bed_rate:    form.base_extra_bed_rate ? Number(form.base_extra_bed_rate) : null,
          margin_percentage: Number(form.margin_percentage),
          gst_percentage:    Number(form.gst_percentage),
          valid_from:        null,
          valid_to:          null,
          is_active:         form.is_active,
          sort_order:        prev.length,
          room:              rooms.find(r => r.id === roomId) ?? null,
          meal_type:         mealTypes.find(m => m.id === mealId) ?? null,
          diet_type:         dietTypes.find(d => d.id === dietId) ?? null,
          occupancy_prices:  savedPrices,
          seasons:           buildOptimisticSeasons(seasons, planId, now),
        },
      ]);
    });
  }

  function handleEdit(id: number, form: PricingFormState) {
    startTransition(async () => {
      const seasons = buildSeasonsInput(form);

      const result = await updateRoomPricingWithSeasons(id, hotel_id, {
        room_id:           Number(form.room_id),
        plan_name:         form.plan_name || null,
        meal_type_id:      form.meal_type_id && form.meal_type_id !== "none" ? Number(form.meal_type_id) : null,
        diet_type_id:      form.diet_type_id && form.diet_type_id !== "none" ? Number(form.diet_type_id) : null,
        price_per_night:   Number(form.base_price_per_night) || null,
        extra_bed_rate:    form.base_extra_bed_rate ? Number(form.base_extra_bed_rate) : null,
        margin_percentage: Number(form.margin_percentage) || 10,
        gst_percentage:    Number(form.gst_percentage) || 18,
        is_active:         form.is_active,
        seasons,
      });

      if (!result.success) { toast.error(result.message); return; }
      toast.success(result.message);
      setEditId(null);

      const roomId = Number(form.room_id);
      const mealId = form.meal_type_id && form.meal_type_id !== "none" ? Number(form.meal_type_id) : null;
      const dietId = form.diet_type_id && form.diet_type_id !== "none" ? Number(form.diet_type_id) : null;
      const now = Date.now();

      setPricing(prev =>
        prev.map(p =>
          p.id === id ? {
            ...p,
            room_id:           roomId,
            plan_name:         form.plan_name || null,
            meal_type_id:      mealId,
            diet_type_id:      dietId,
            price_per_night:   Number(form.base_price_per_night) || Number(seasons[0]?.price_per_night) || p.price_per_night,
            extra_bed_rate:    form.base_extra_bed_rate ? Number(form.base_extra_bed_rate) : null,
            margin_percentage: Number(form.margin_percentage),
            gst_percentage:    Number(form.gst_percentage),
            is_active:         form.is_active,
            room:              rooms.find(r => r.id === roomId) ?? null,
            meal_type:         mealTypes.find(m => m.id === mealId) ?? null,
            diet_type:         dietTypes.find(d => d.id === dietId) ?? null,
            seasons:           buildOptimisticSeasons(seasons, id, now),
          } : p,
        ),
      );
    });
  }

  function handleDelete(id: number) {
    startTransition(async () => {
      const result = await deleteRoomPricing(id, hotel_id);
      if (result.success) {
        toast.success(result.message);
        setPricing(prev => prev.filter(p => p.id !== id));
      } else {
        toast.error(result.message);
      }
    });
  }

  function handleOccupancyUpdated(planId: number, prices: OccupancyPrice[]) {
    setPricing(prev => prev.map(p => p.id === planId ? { ...p, occupancy_prices: prices } : p));
  }

  function handleSeasonsUpdated(planId: number, seasons: HotelSeason[]) {
    setPricing(prev => prev.map(p => p.id === planId ? { ...p, seasons } : p));
  }

  const byRoom = rooms.map(room => ({
    room,
    plans: pricing.filter(p => p.room_id === room.id),
  })).filter(g => g.plans.length > 0);

  return (
    <div className="space-y-5 bg-dashboard-base-100 p-8 rounded-xl shadow-lg border border-dashboard-base-content/20">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-dashboard-base-content">Pricing Plans</p>
          <p className="text-xs text-dashboard-base-content/50 mt-0.5">
            {pricing.length} plan{pricing.length !== 1 ? "s" : ""} · Seasons are optional · Expand a plan to manage occupancy prices
          </p>
        </div>
        {!adding && editId === null && (
          <Button size="sm"
            className="gap-1.5 bg-dashboard-primary text-dashboard-primary-content hover:bg-dashboard-primary/90 cursor-pointer"
            onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" /> Add Plan
          </Button>
        )}
      </div>

      {adding && (
        <PricingForm initial={EMPTY_FORM} rooms={rooms} mealTypes={mealTypes} dietTypes={dietTypes}
          onSave={handleAdd} onCancel={() => setAdding(false)} isSaving={isPending} isNew />
      )}

      {byRoom.length > 0 ? (
        <div className="space-y-6">
          {byRoom.map(({ room, plans }) => (
            <div key={room.id} className="space-y-2">
              <p className="text-xs font-bold text-dashboard-base-content/50 uppercase tracking-widest px-1">{room.name}</p>
              <div className="space-y-2">
                {plans.map(plan => (
                  <PlanRow key={plan.id} plan={plan} hotelId={hotel_id} editId={editId}
                    rooms={rooms} mealTypes={mealTypes} dietTypes={dietTypes} isPending={isPending}
                    onEdit={setEditId} onSaveEdit={handleEdit} onCancelEdit={() => setEditId(null)}
                    onDelete={handleDelete} onOccupancyUpdated={handleOccupancyUpdated} onSeasonsUpdated={handleSeasonsUpdated} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : !adding && (
        <div className="flex flex-col items-center justify-center py-12 rounded-xl border border-dashed border-dashboard-base-content/20 bg-dashboard-base-200/30">
          <p className="text-sm font-medium text-dashboard-base-content/50">No pricing plans yet</p>
          <p className="text-xs text-dashboard-base-content/40 mt-1">Click &ldquo;Add Plan&rdquo; to create your first pricing plan with seasons</p>
        </div>
      )}
    </div>
  );
}
