"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Switch } from "../../../components/ui/switch";
import { Textarea } from "../../../components/ui/textarea";
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
  ChevronDown, ChevronRight, Users, Calendar,
  CalendarDays, AlertTriangle, StickyNote,
} from "lucide-react";
import { SeasonalRateCalendar, type SeasonalRateCalendarItem } from "../../../components/ui/seasonal-rate-calendar";
import { type RateSeasonBase, defaultRangeLabel } from "../../../components/ui/seasonal-rate-calendar-logic";
import { toast } from "sonner";
import { cn } from "@/app/lib/utils";
import { PLAN_NOTES_MAX_LEN } from "../../constants";
import {
  deleteRoomPricing,
  upsertOccupancyPrice, deleteOccupancyPrice,
  createRoomPricingWithSeasons, updateRoomPricingWithSeasons,
  updatePricingSeasonsOnly,
  type HotelSeasonInput,
} from "../../actions";

// ── Types ─────────────────────────────────────────────────────────────────

type RoomOption = { id: number; name: string };
type MealType = { id: number; name: string; covered_meals: string[] };
type DietType = { id: number; name: string };

type OccupancyPrice = {
  id: number;
  pricing_id: number;
  occupancy: number;
  price_per_night: number;
  original_price: number | null;
  weekend_price_per_night: number | null;
};

type SeasonOccupancyPrice = {
  id: number;
  season_id: number;
  occupancy: number;
  price_per_night: number;
  original_price: number | null;
  weekend_price_per_night: number | null;
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
  weekend_extra_bed_rate: number | null;
  color: string | null;
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
  weekend_price_per_night: number | null;
  weekend_extra_bed_rate: number | null;
  margin_percentage: number;
  gst_percentage: number;
  notes: string | null;
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

// weekendPrice is only ever populated for the dedicated single-occupancy
// toggle — the generic occupancy grid (2P/3P/4P) leaves it undefined.
type OccupancyEntry = { occupancy: number; price: string; original: string; weekendPrice?: string };

// Local season entry (before save) — only the fields we need
type SeasonEntry = {
  tempId: string;
  label: string;
  valid_from: string;
  valid_to: string;
  price_per_night: string;
  weekend_price_per_night: string;
  extra_bed_rate: string;
  weekend_extra_bed_rate: string;
  single_occupancy_price: string;
  single_occupancy_weekend_price: string;
  color: string;
};

type PricingFormState = {
  room_id: string;
  plan_name: string;
  meal_type_id: string;
  diet_type_id: string;
  base_price_per_night: string;
  base_weekend_price_per_night: string;
  base_extra_bed_rate: string;
  base_weekend_extra_bed_rate: string;
  margin_percentage: string;
  gst_percentage: string;
  is_active: boolean;
  notes: string;
  // Single (1P) occupancy is priced cheaper than the base (double) rate — kept
  // as its own toggle + field rather than folded into the generic occupancy
  // grid below, since it's the one tier managers set on nearly every plan.
  single_occupancy_enabled: boolean;
  single_occupancy_price: string;
  single_occupancy_weekend_price: string;
  occupancy_prices: OccupancyEntry[];
  seasons: SeasonEntry[];
};

const EMPTY_FORM: PricingFormState = {
  room_id: "",
  plan_name: "",
  meal_type_id: "",
  diet_type_id: "",
  base_price_per_night: "",
  base_weekend_price_per_night: "",
  base_extra_bed_rate: "",
  base_weekend_extra_bed_rate: "",
  margin_percentage: "10",
  gst_percentage: "18",
  is_active: true,
  notes: "",
  single_occupancy_enabled: false,
  single_occupancy_price: "",
  single_occupancy_weekend_price: "",
  occupancy_prices: [],
  seasons: [],
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

function fmtMonthDay(dateStr: string): string {
  const d = toDateObj(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function toFormState(p: PricingPlan): PricingFormState {
  const singleOcc = p.occupancy_prices.find(op => op.occupancy === 1);
  return {
    room_id: String(p.room_id),
    plan_name: p.plan_name ?? "",
    meal_type_id: p.meal_type_id ? String(p.meal_type_id) : "none",
    diet_type_id: p.diet_type_id ? String(p.diet_type_id) : "",
    base_price_per_night: p.price_per_night ? String(p.price_per_night) : "",
    base_weekend_price_per_night: p.weekend_price_per_night ? String(p.weekend_price_per_night) : "",
    base_extra_bed_rate: p.extra_bed_rate ? String(p.extra_bed_rate) : "",
    base_weekend_extra_bed_rate: p.weekend_extra_bed_rate ? String(p.weekend_extra_bed_rate) : "",
    margin_percentage: String(p.margin_percentage),
    gst_percentage: String(p.gst_percentage),
    is_active: p.is_active,
    notes: p.notes ?? "",
    single_occupancy_enabled: !!singleOcc,
    single_occupancy_price: singleOcc ? String(singleOcc.price_per_night) : "",
    single_occupancy_weekend_price: singleOcc?.weekend_price_per_night ? String(singleOcc.weekend_price_per_night) : "",
    occupancy_prices: p.occupancy_prices
      .filter(op => op.occupancy !== 1)
      .map(op => ({ occupancy: op.occupancy, price: String(op.price_per_night), original: op.original_price ? String(op.original_price) : "" })),
    seasons: (p.seasons ?? []).map(s => {
      const from = toISODate(s.valid_from);
      const to = toISODate(s.valid_to);
      const autoRangeText = `${fmtMonthDay(from)} → ${fmtMonthDay(to)}`;
      const singleOccSeason = s.occupancy_prices.find(op => op.occupancy === 1);
      return {
        tempId: uid(),
        label: s.season_name && s.season_name !== autoRangeText ? s.season_name : "",
        valid_from: from,
        valid_to: to,
        price_per_night: String(s.price_per_night),
        weekend_price_per_night: s.weekend_price_per_night ? String(s.weekend_price_per_night) : "",
        extra_bed_rate: s.extra_bed_rate ? String(s.extra_bed_rate) : "",
        weekend_extra_bed_rate: s.weekend_extra_bed_rate ? String(s.weekend_extra_bed_rate) : "",
        single_occupancy_price: singleOccSeason ? String(singleOccSeason.price_per_night) : "",
        single_occupancy_weekend_price: singleOccSeason?.weekend_price_per_night ? String(singleOccSeason.weekend_price_per_night) : "",
        color: s.color ?? "",
      };
    }),
  };
}

// ── Seasonal Pricing Section (inside PricingForm) ─────────────────────────
// Seasons are scoped per pricing plan (the "item"). The calendar's item
// switcher shows every pricing plan created for this HOTEL (across every
// room, not just the one currently being edited) — the plan currently being
// added/edited here, plus every other plan already saved for the hotel — so
// a manager can compare/adjust seasonal rates across the whole property
// without leaving the modal. Edits to the in-progress plan buffer into the
// local form (saved via the "Save Plan" button); edits to any other
// (already persisted) plan save immediately, since there's no other save
// mechanism reachable for it from here.

type HotelRateSeason = RateSeasonBase & {
  weekendPrice: number | null;
  extraBedRate: number | null;
  weekendExtraBedRate: number | null;
  // Single (1P) occupancy override for this season — only ever surfaced in
  // the UI when the plan itself has single-occupancy pricing enabled.
  singleOccupancyPrice: number | null;
  singleOccupancyWeekendPrice: number | null;
};

const NEW_PLAN_ITEM_ID = "new-plan";

function seasonLabelOrUndefined(seasonName: string, fromISO: string, toISO: string): string | undefined {
  const autoRangeText = `${fmtMonthDay(fromISO)} → ${fmtMonthDay(toISO)}`;
  return seasonName && seasonName !== autoRangeText ? seasonName : undefined;
}

function seasonEntriesToRateSeasons(seasons: SeasonEntry[], itemId: string): HotelRateSeason[] {
  return seasons
    .filter(s => s.valid_from && s.valid_to && Number(s.price_per_night) > 0)
    .map(s => ({
      id: s.tempId,
      itemId,
      label: s.label || undefined,
      startDate: s.valid_from,
      endDate: s.valid_to,
      color: s.color || "#f97316",
      rate: Number(s.price_per_night) || 0,
      weekendPrice: s.weekend_price_per_night ? Number(s.weekend_price_per_night) : null,
      extraBedRate: s.extra_bed_rate ? Number(s.extra_bed_rate) : null,
      weekendExtraBedRate: s.weekend_extra_bed_rate ? Number(s.weekend_extra_bed_rate) : null,
      singleOccupancyPrice: s.single_occupancy_price ? Number(s.single_occupancy_price) : null,
      singleOccupancyWeekendPrice: s.single_occupancy_weekend_price ? Number(s.single_occupancy_weekend_price) : null,
    }));
}

function savedSeasonsToRateSeasons(seasons: HotelSeason[], itemId: string): HotelRateSeason[] {
  return seasons.map(s => {
    const from = toISODate(s.valid_from);
    const to = toISODate(s.valid_to);
    const singleOcc = s.occupancy_prices.find(op => op.occupancy === 1);
    return {
      id: String(s.id),
      itemId,
      label: seasonLabelOrUndefined(s.season_name, from, to),
      startDate: from,
      endDate: to,
      color: s.color ?? "#f97316",
      rate: s.price_per_night,
      weekendPrice: s.weekend_price_per_night,
      extraBedRate: s.extra_bed_rate,
      weekendExtraBedRate: s.weekend_extra_bed_rate,
      singleOccupancyPrice: singleOcc ? singleOcc.price_per_night : null,
      singleOccupancyWeekendPrice: singleOcc?.weekend_price_per_night ?? null,
    };
  });
}

function rateSeasonToSeasonEntry(rs: HotelRateSeason): SeasonEntry {
  return {
    tempId: rs.id,
    label: rs.label ?? "",
    valid_from: rs.startDate,
    valid_to: rs.endDate,
    price_per_night: String(rs.rate),
    weekend_price_per_night: rs.weekendPrice != null ? String(rs.weekendPrice) : "",
    extra_bed_rate: rs.extraBedRate != null ? String(rs.extraBedRate) : "",
    weekend_extra_bed_rate: rs.weekendExtraBedRate != null ? String(rs.weekendExtraBedRate) : "",
    single_occupancy_price: rs.singleOccupancyPrice != null ? String(rs.singleOccupancyPrice) : "",
    single_occupancy_weekend_price: rs.singleOccupancyWeekendPrice != null ? String(rs.singleOccupancyWeekendPrice) : "",
    color: rs.color,
  };
}

function rateSeasonToHotelSeasonInput(rs: HotelRateSeason): HotelSeasonInput {
  return {
    season_name: rs.label?.trim() || defaultRangeLabel(rs.startDate, rs.endDate),
    valid_from: rs.startDate,
    valid_to: rs.endDate,
    price_per_night: rs.rate,
    weekend_price_per_night: rs.weekendPrice,
    original_price: null,
    extra_bed_rate: rs.extraBedRate,
    weekend_extra_bed_rate: rs.weekendExtraBedRate,
    color: rs.color,
    is_active: true,
    occupancy_prices: rs.singleOccupancyPrice != null
      ? [{ occupancy: 1, price_per_night: rs.singleOccupancyPrice, original_price: null, weekend_price_per_night: rs.singleOccupancyWeekendPrice }]
      : [],
  };
}

function rateSeasonsToOptimisticSeasons(rateSeasons: HotelRateSeason[], pricingId: number): HotelSeason[] {
  const baseTime = Date.now();
  return rateSeasons.map((rs, i) => ({
    id: /^\d+$/.test(rs.id) ? Number(rs.id) : baseTime + i,
    pricing_id: pricingId,
    season_name: rs.label?.trim() || defaultRangeLabel(rs.startDate, rs.endDate),
    valid_from: new Date(rs.startDate),
    valid_to: new Date(rs.endDate),
    price_per_night: rs.rate,
    weekend_price_per_night: rs.weekendPrice,
    original_price: null,
    extra_bed_rate: rs.extraBedRate,
    weekend_extra_bed_rate: rs.weekendExtraBedRate,
    color: rs.color,
    is_active: true,
    sort_order: i,
    occupancy_prices: rs.singleOccupancyPrice != null
      ? [{
          id: baseTime + i,
          season_id: /^\d+$/.test(rs.id) ? Number(rs.id) : baseTime + i,
          occupancy: 1,
          price_per_night: rs.singleOccupancyPrice,
          original_price: null,
          weekend_price_per_night: rs.singleOccupancyWeekendPrice,
        }]
      : [],
  }));
}

const seasonExtraFieldClass =
  "h-8 w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-xs text-neutral-900 " +
  "placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400";

function SeasonalPricingSection({
  seasons,
  onChange,
  basePricePerNight = 0,
  baseWeekendPricePerNight,
  baseExtraBedRate,
  baseWeekendExtraBedRate,
  singleOccupancyEnabled,
  baseSingleOccupancyPrice,
  baseSingleOccupancyWeekendPrice,
  planLabel,
  currentPlanId,
  hotelId,
  siblingPlans,
  onSiblingSeasonsUpdated,
}: {
  seasons: SeasonEntry[];
  onChange: (s: SeasonEntry[]) => void;
  basePricePerNight?: number;
  baseWeekendPricePerNight?: number | null;
  baseExtraBedRate?: number | null;
  baseWeekendExtraBedRate?: number | null;
  // Whether the CURRENT plan (being added/edited) has single-occupancy
  // pricing turned on — siblings each carry their own, derived below.
  singleOccupancyEnabled?: boolean;
  baseSingleOccupancyPrice?: number | null;
  baseSingleOccupancyWeekendPrice?: number | null;
  planLabel: string;
  currentPlanId: number | null;
  hotelId: number;
  siblingPlans: PricingPlan[];
  onSiblingSeasonsUpdated: (planId: number, seasons: HotelSeason[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const currentItemId = currentPlanId != null ? String(currentPlanId) : NEW_PLAN_ITEM_ID;
  const [activeItemId, setActiveItemId] = useState(currentItemId);

  const currentRateSeasons = seasonEntriesToRateSeasons(seasons, currentItemId);
  const siblingRateSeasons = siblingPlans.flatMap(p => savedSeasonsToRateSeasons(p.seasons, String(p.id)));
  const allRateSeasons = [...currentRateSeasons, ...siblingRateSeasons];
  const seasonCount = currentRateSeasons.length;

  const itemMetaById: Record<string, {
    extraBedRate: number | null;
    weekendExtraBedRate: number | null;
    singleOccupancyEnabled: boolean;
    singleOccupancyPrice: number | null;
    singleOccupancyWeekendPrice: number | null;
  }> = {
    [currentItemId]: {
      extraBedRate: baseExtraBedRate ?? null,
      weekendExtraBedRate: baseWeekendExtraBedRate ?? null,
      singleOccupancyEnabled: !!singleOccupancyEnabled,
      singleOccupancyPrice: baseSingleOccupancyPrice ?? null,
      singleOccupancyWeekendPrice: baseSingleOccupancyWeekendPrice ?? null,
    },
  };
  for (const p of siblingPlans) {
    const singleOcc = p.occupancy_prices.find(op => op.occupancy === 1);
    itemMetaById[String(p.id)] = {
      extraBedRate: p.extra_bed_rate,
      weekendExtraBedRate: p.weekend_extra_bed_rate,
      singleOccupancyEnabled: !!singleOcc,
      singleOccupancyPrice: singleOcc ? singleOcc.price_per_night : null,
      singleOccupancyWeekendPrice: singleOcc?.weekend_price_per_night ?? null,
    };
  }

  const items: SeasonalRateCalendarItem[] = [
    { id: currentItemId, label: planLabel || "This plan", baseRate: basePricePerNight, baseWeekendRate: baseWeekendPricePerNight ?? null },
    ...siblingPlans.map(p => ({
      id: String(p.id),
      label: p.room?.name ? `${p.room.name} — ${p.plan_name || "Unnamed plan"}` : (p.plan_name || "Unnamed plan"),
      baseRate: p.price_per_night,
      baseWeekendRate: p.weekend_price_per_night,
    })),
  ];

  async function handleSiblingSave(planId: number, rateSeasonsForPlan: HotelRateSeason[]) {
    const input = rateSeasonsForPlan.map(rateSeasonToHotelSeasonInput);
    const result = await updatePricingSeasonsOnly(planId, hotelId, input);
    if (!result.success) { toast.error(result.message); return; }
    onSiblingSeasonsUpdated(planId, rateSeasonsToOptimisticSeasons(rateSeasonsForPlan, planId));
    toast.success("Seasonal rates updated");
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" />
          Seasonal Rates
          <span className="font-normal normal-case text-muted-foreground/60">— optional</span>
        </p>
        {seasonCount > 0 && (
          <span className="text-[11px] text-dashboard-base-content/50">
            {seasonCount} range{seasonCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <Button
        type="button" variant="outline" size="sm"
        className="h-9 text-xs gap-1.5 w-full border-dashed border-dashboard-base-content/30 bg-dashboard-base-100 text-dashboard-base-content/70 hover:bg-dashboard-base-200 hover:text-dashboard-base-content cursor-pointer"
        onClick={() => { setActiveItemId(currentItemId); setOpen(true); }}
      >
        <CalendarDays className="h-3.5 w-3.5" />
        {seasonCount > 0 ? "Manage Seasonal Rates" : "Add Seasonal Rates"}
      </Button>

      <SeasonalRateCalendar<HotelRateSeason>
        open={open}
        onOpenChange={setOpen}
        title="Seasonal Rate Calendar"
        subtitle={planLabel}
        items={items}
        activeItemId={activeItemId}
        onActiveItemChange={setActiveItemId}
        seasons={allRateSeasons}
        onSave={(next, changedItemId) => {
          if (changedItemId === currentItemId) {
            onChange(next.filter(rs => rs.itemId === currentItemId).map(rateSeasonToSeasonEntry));
            return;
          }
          const planId = Number(changedItemId);
          if (!Number.isFinite(planId)) return;
          void handleSiblingSave(planId, next.filter(rs => rs.itemId === changedItemId));
        }}
        unitLabel="per night"
        getDefaultDraft={item => ({
          weekendPrice: item.baseWeekendRate ?? null,
          extraBedRate: itemMetaById[item.id]?.extraBedRate ?? null,
          weekendExtraBedRate: itemMetaById[item.id]?.weekendExtraBedRate ?? null,
          singleOccupancyPrice: itemMetaById[item.id]?.singleOccupancyPrice ?? null,
          singleOccupancyWeekendPrice: itemMetaById[item.id]?.singleOccupancyWeekendPrice ?? null,
        })}
        getGroupKey={s =>
          `${s.rate}|${s.weekendPrice ?? s.rate}|${s.extraBedRate ?? "none"}|${s.weekendExtraBedRate ?? s.extraBedRate ?? "none"}|${s.singleOccupancyPrice ?? "none"}|${s.singleOccupancyWeekendPrice ?? s.singleOccupancyPrice ?? "none"}`
        }
        getSeasonWeekendRate={s => s.weekendPrice}
        renderGroupExtra={s => {
          const weekendRate = s.weekendPrice ?? s.rate;
          const weekendMatchesWeekday = s.weekendPrice == null || s.weekendPrice === s.rate;
          const hasExtraBed = s.extraBedRate != null;
          const weekendExtraBed = s.weekendExtraBedRate ?? s.extraBedRate;
          const weekendExtraBedMatchesWeekday = s.weekendExtraBedRate == null || s.weekendExtraBedRate === s.extraBedRate;
          return (
            <div className="text-[10px] text-neutral-500 space-y-0.5">
              <p>
                Weekend: <span className="font-semibold text-neutral-700">₹{weekendRate.toLocaleString("en-IN")}</span>
                {weekendMatchesWeekday && <span className="text-neutral-400"> (same as weekday)</span>}
              </p>
              <p>
                Extra bed: <span className="font-semibold text-neutral-700">{hasExtraBed ? `₹${s.extraBedRate!.toLocaleString("en-IN")}` : "—"}</span>
                {hasExtraBed && (
                  <>
                    {" · Weekend: "}
                    <span className="font-semibold text-neutral-700">₹{weekendExtraBed!.toLocaleString("en-IN")}</span>
                    {weekendExtraBedMatchesWeekday && <span className="text-neutral-400"> (same as weekday)</span>}
                  </>
                )}
              </p>
              {s.singleOccupancyPrice != null && (
                <p>
                  Single occupancy: <span className="font-semibold text-neutral-700">₹{s.singleOccupancyPrice.toLocaleString("en-IN")}</span>
                  {" · Weekend: "}
                  <span className="font-semibold text-neutral-700">
                    ₹{(s.singleOccupancyWeekendPrice ?? s.singleOccupancyPrice).toLocaleString("en-IN")}
                  </span>
                  {s.singleOccupancyWeekendPrice == null && <span className="text-neutral-400"> (same as weekday)</span>}
                </p>
              )}
            </div>
          );
        }}
        renderRateExtra={({ draft, onChange: onExtraChange }) => (
          <div>
            <label className="text-[10px] text-neutral-500 mb-0.5 block">Weekend price (₹)</label>
            <input
              type="number" min={0}
              placeholder="Same as weekday"
              value={draft.weekendPrice ?? ""}
              onChange={e => onExtraChange({ weekendPrice: e.target.value ? Number(e.target.value) : null })}
              className={seasonExtraFieldClass}
            />
          </div>
        )}
        renderExtraFields={({ draft, onChange: onExtraChange }) => (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-neutral-500 mb-0.5 block">Extra bed (₹)</label>
              <input
                type="number" min={0}
                placeholder="optional"
                value={draft.extraBedRate ?? ""}
                onChange={e => onExtraChange({ extraBedRate: e.target.value ? Number(e.target.value) : null })}
                className={seasonExtraFieldClass}
              />
            </div>

            <div>
              <label className="text-[10px] text-neutral-500 mb-0.5 block">Weekend extra bed (₹)</label>
              <input
                type="number" min={0}
                placeholder="Same as weekday"
                value={draft.weekendExtraBedRate ?? ""}
                onChange={e => onExtraChange({ weekendExtraBedRate: e.target.value ? Number(e.target.value) : null })}
                className={seasonExtraFieldClass}
              />
            </div>

            {itemMetaById[activeItemId]?.singleOccupancyEnabled && (
              <>
                <div>
                  <label className="text-[10px] text-neutral-500 mb-0.5 block">Single occupancy price (₹)</label>
                  <input
                    type="number" min={0}
                    placeholder="optional"
                    value={draft.singleOccupancyPrice ?? ""}
                    onChange={e => onExtraChange({ singleOccupancyPrice: e.target.value ? Number(e.target.value) : null })}
                    className={seasonExtraFieldClass}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-500 mb-0.5 block">Weekend single occupancy (₹)</label>
                  <input
                    type="number" min={0}
                    placeholder="Same as weekday"
                    value={draft.singleOccupancyWeekendPrice ?? ""}
                    onChange={e => onExtraChange({ singleOccupancyWeekendPrice: e.target.value ? Number(e.target.value) : null })}
                    className={seasonExtraFieldClass}
                  />
                </div>
              </>
            )}
          </div>
        )}
      />
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
  planId = null,
  hotelId,
  allPlans,
  onSiblingSeasonsUpdated,
}: {
  initial: PricingFormState;
  rooms: RoomOption[];
  mealTypes: MealType[];
  dietTypes: DietType[];
  onSave: (form: PricingFormState) => void;
  onCancel: () => void;
  isSaving: boolean;
  isNew?: boolean;
  /** null when adding a brand-new plan, the real id when editing one. */
  planId?: number | null;
  hotelId: number;
  /** Every pricing plan for this hotel — filtered down to the currently
   * selected room's siblings for the seasonal calendar's item switcher. */
  allPlans: PricingPlan[];
  onSiblingSeasonsUpdated: (planId: number, seasons: HotelSeason[]) => void;
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

  const notesTooLong = form.notes.trim().length > PLAN_NOTES_MAX_LEN;

  const isValid =
    !!form.room_id &&
    !!form.meal_type_id &&
    !!form.base_price_per_night && Number(form.base_price_per_night) > 0 &&
    !notesTooLong &&
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

      {/* Row 3b: Weekend overrides for base price + extra bed */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm text-dashboard-base-content/70">
            Weekend Price / Night (₹) <span className="text-xs font-normal text-dashboard-base-content/40">(optional)</span>
          </Label>
          <Input type="number" placeholder={form.base_price_per_night ? `Same as weekday (₹${form.base_price_per_night})` : "Same as weekday"}
            value={form.base_weekend_price_per_night}
            onChange={e => upd("base_weekend_price_per_night", e.target.value)}
            className="bg-dashboard-base-100 border-dashboard-base-content/20" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm text-dashboard-base-content/70">
            Weekend Extra Bed (₹) <span className="text-xs font-normal text-dashboard-base-content/40">(optional)</span>
          </Label>
          <Input type="number" placeholder={form.base_extra_bed_rate ? `Same as weekday (₹${form.base_extra_bed_rate})` : "Same as weekday"}
            value={form.base_weekend_extra_bed_rate}
            onChange={e => upd("base_weekend_extra_bed_rate", e.target.value)}
            className="bg-dashboard-base-100 border-dashboard-base-content/20" />
        </div>
      </div>

      {/* Single occupancy pricing — cheaper rate for 1 guest instead of the base (double) rate */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Switch checked={form.single_occupancy_enabled} onCheckedChange={v => upd("single_occupancy_enabled", v)} />
          <span className="text-sm text-dashboard-base-content">Add single occupancy pricing</span>
        </div>
        {form.single_occupancy_enabled && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm text-dashboard-base-content">Single Occupancy Price / Night (₹)</Label>
              <Input type="number" placeholder="e.g. 2200"
                value={form.single_occupancy_price}
                onChange={e => upd("single_occupancy_price", e.target.value)}
                className="bg-dashboard-base-100 border-dashboard-base-content/20" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-dashboard-base-content/70">
                Weekend Single Occupancy (₹) <span className="text-xs font-normal text-dashboard-base-content/40">(optional)</span>
              </Label>
              <Input type="number" placeholder={form.single_occupancy_price ? `Same as weekday (₹${form.single_occupancy_price})` : "Same as weekday"}
                value={form.single_occupancy_weekend_price}
                onChange={e => upd("single_occupancy_weekend_price", e.target.value)}
                className="bg-dashboard-base-100 border-dashboard-base-content/20" />
            </div>
          </div>
        )}
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

      {/* Notes — internal, optional */}
      <div className="space-y-1.5">
        <Label className="text-sm text-dashboard-base-content flex items-center gap-1.5">
          <StickyNote className="h-3.5 w-3.5" /> Notes
          <span className="text-xs font-normal text-dashboard-base-content/50">(optional, internal only)</span>
        </Label>
        <Textarea
          value={form.notes}
          onChange={e => upd("notes", e.target.value)}
          placeholder="e.g. Owner requires 15% margin during Dec–Jan peak season; rates locked till March."
          rows={3}
          maxLength={PLAN_NOTES_MAX_LEN + 200}
          className={cn(
            "bg-dashboard-base-100 border-dashboard-base-content/20 text-sm resize-y",
            notesTooLong && "border-dashboard-error/60",
          )}
        />
        <div className="flex items-center justify-between">
          {notesTooLong ? (
            <p className="text-[10px] text-dashboard-error flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Notes must be {PLAN_NOTES_MAX_LEN} characters or less.
            </p>
          ) : <span />}
          <p className={cn("text-[10px]", notesTooLong ? "text-dashboard-error" : "text-dashboard-base-content/40")}>
            {form.notes.trim().length}/{PLAN_NOTES_MAX_LEN}
          </p>
        </div>
      </div>

      {/* ── Seasons ─────────────────────────────────── */}
      <div className="border-t border-dashboard-base-content/10 pt-3">
        <SeasonalPricingSection
          seasons={form.seasons}
          onChange={s => upd("seasons", s)}
          basePricePerNight={Number(form.base_price_per_night) || 0}
          baseWeekendPricePerNight={form.base_weekend_price_per_night ? Number(form.base_weekend_price_per_night) : null}
          baseExtraBedRate={form.base_extra_bed_rate ? Number(form.base_extra_bed_rate) : null}
          baseWeekendExtraBedRate={form.base_weekend_extra_bed_rate ? Number(form.base_weekend_extra_bed_rate) : null}
          singleOccupancyEnabled={form.single_occupancy_enabled}
          baseSingleOccupancyPrice={form.single_occupancy_price ? Number(form.single_occupancy_price) : null}
          baseSingleOccupancyWeekendPrice={form.single_occupancy_weekend_price ? Number(form.single_occupancy_weekend_price) : null}
          planLabel={(() => {
            const roomName = rooms.find(r => String(r.id) === form.room_id)?.name;
            const label = form.plan_name || "This plan";
            return roomName ? `${roomName} — ${label}` : label;
          })()}
          currentPlanId={planId}
          hotelId={hotelId}
          siblingPlans={allPlans.filter(p => p.id !== planId)}
          onSiblingSeasonsUpdated={onSiblingSeasonsUpdated}
        />
      </div>

      {/* Occupancy prices (only on new plan creation) — single (1P) has its own
          dedicated toggle above, so it's excluded from this generic grid. */}
      {isNew && (
        <div className="border-t border-dashboard-base-content/10 pt-3 space-y-2">
          <p className="text-xs font-semibold text-dashboard-base-content/60 uppercase tracking-wide">
            Plan-level Occupancy Prices <span className="font-normal normal-case">(optional fallback)</span>
          </p>
          {OCCUPANCY_OPTIONS.filter(occ => occ.value !== 1).map(occ => {
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

  // Single (1P) occupancy is managed via the dedicated toggle on the plan's
  // edit form, not here, so it's excluded from both the list and add-picker.
  const occupancyPrices = plan.occupancy_prices.filter(p => p.occupancy !== 1);
  const existingOccupancies = new Set(occupancyPrices.map(p => p.occupancy));
  const availableOccupancies = [2, 3, 4].filter(o => !existingOccupancies.has(o));

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
      weekend_price_per_night: null,
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

      {occupancyPrices.map(op => (
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

      {occupancyPrices.length === 0 && !addOccupancy && (
        <p className="text-[10px] text-dashboard-base-content/40 italic">
          No plan-level occupancy prices — season prices apply directly.
        </p>
      )}
    </div>
  );
}

// ── Read-only Seasons Summary (in expanded panel) ─────────────────────────

function SeasonsSummaryPanel({ seasons, highlightSeasonId = null }: { seasons: HotelSeason[]; highlightSeasonId?: number | null }) {
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
        <div
          key={s.id}
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs",
            s.id === highlightSeasonId
              ? "bg-dashboard-warning/15 ring-2 ring-dashboard-warning/50"
              : "bg-dashboard-base-200",
          )}
        >
          <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: s.color ?? "#f97316" }} />
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
      ))}
    </div>
  );
}

// ── Read-only Notes Panel (in expanded panel) ─────────────────────────────

function PlanNotesPanel({ notes }: { notes: string }) {
  return (
    <div className="px-4 pb-3 pt-2 space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-dashboard-base-content/50 flex items-center gap-1">
        <StickyNote className="h-3 w-3" /> Notes
      </p>
      <p className="text-xs text-dashboard-base-content/70 whitespace-pre-wrap rounded-lg bg-dashboard-base-200 px-3 py-2">
        {notes}
      </p>
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
  allPlans,
  isPending,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onOccupancyUpdated,
  onSeasonsUpdated,
  highlight = false,
  highlightSeasonId = null,
}: {
  plan: PricingPlan;
  hotelId: number;
  editId: number | null;
  rooms: RoomOption[];
  mealTypes: MealType[];
  dietTypes: DietType[];
  allPlans: PricingPlan[];
  isPending: boolean;
  onEdit: (id: number) => void;
  onSaveEdit: (id: number, form: PricingFormState) => void;
  onCancelEdit: () => void;
  onDelete: (id: number) => void;
  onOccupancyUpdated: (planId: number, prices: OccupancyPrice[]) => void;
  onSeasonsUpdated: (planId: number, seasons: HotelSeason[]) => void;
  /** Deep-linked from Expiring Rates' "Fix" button — this plan is the one
   * with the expiring/expired season, so start expanded and scroll into view
   * instead of making the exec hunt for it. */
  highlight?: boolean;
  highlightSeasonId?: number | null;
}) {
  const [expanded, setExpanded] = useState(highlight);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlight) rowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    // Only ever scroll once, on mount — not on every re-render this plan happens to take part in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          planId={plan.id}
          hotelId={hotelId}
          allPlans={allPlans}
          onSiblingSeasonsUpdated={onSeasonsUpdated}
        />
      </div>
    );
  }

  const seasonCount = plan.seasons?.length ?? 0;
  const occupancySummary = plan.occupancy_prices
    .map(op => `${op.occupancy}P: ₹${op.price_per_night.toLocaleString()}`)
    .join(" · ");

  return (
    <div
      ref={rowRef}
      className={cn(
        "border rounded-xl overflow-hidden bg-dashboard-base-100",
        highlight ? "border-dashboard-warning ring-2 ring-dashboard-warning/40" : "border-dashboard-base-content/20",
        !plan.is_active && "opacity-60",
      )}
    >
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
            {plan.notes && (
              <Badge className="text-[10px] px-1.5 py-0 bg-dashboard-info/10 text-dashboard-base-content/60 border border-dashboard-info/30">
                <StickyNote className="h-2.5 w-2.5 mr-1" /> Note
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
          <SeasonsSummaryPanel seasons={plan.seasons ?? []} highlightSeasonId={highlightSeasonId} />
          {plan.notes && <PlanNotesPanel notes={plan.notes} />}
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
  hotel_id: number;
  rooms: RoomOption[];
  pricing: PricingPlan[];
  mealTypes: MealType[];
  dietTypes: DietType[];
}) {
  const [pricing, setPricing] = useState<PricingPlan[]>(initialPricing);
  const [adding, setAdding] = useState(false);
  // Deep-link from the Expiring Rates page's "Fix" button — ?planId/&seasonId
  // point at exactly the plan/season that's expiring, so it can be
  // auto-expanded, scrolled to, and highlighted instead of making the exec
  // hunt for it among every room's pricing plans.
  const searchParams = useSearchParams();
  const highlightPlanId = searchParams.get("planId") ? Number(searchParams.get("planId")) : null;
  const highlightSeasonId = searchParams.get("seasonId") ? Number(searchParams.get("seasonId")) : null;
  const [editId, setEditId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  function buildSeasonsInput(form: PricingFormState): HotelSeasonInput[] {
    return form.seasons.map(s => ({
      season_name: s.label.trim()
        ? s.label.trim()
        : s.valid_from && s.valid_to
          ? `${fmtMonthDay(s.valid_from)} → ${fmtMonthDay(s.valid_to)}`
          : "Season",
      valid_from: s.valid_from,
      valid_to: s.valid_to,
      price_per_night: Number(s.price_per_night),
      weekend_price_per_night: s.weekend_price_per_night ? Number(s.weekend_price_per_night) : null,
      original_price: null,
      extra_bed_rate: s.extra_bed_rate ? Number(s.extra_bed_rate) : null,
      weekend_extra_bed_rate: s.weekend_extra_bed_rate ? Number(s.weekend_extra_bed_rate) : null,
      color: s.color || null,
      is_active: true,
      occupancy_prices: s.single_occupancy_price
        ? [{
            occupancy: 1,
            price_per_night: Number(s.single_occupancy_price),
            original_price: null,
            weekend_price_per_night: s.single_occupancy_weekend_price ? Number(s.single_occupancy_weekend_price) : null,
          }]
        : [],
    }));
  }

  function buildOptimisticSeasons(
    seasonsInput: HotelSeasonInput[],
    planId: number,
    baseTime: number,
  ): HotelSeason[] {
    return seasonsInput.map((s, i) => ({
      id: baseTime + i,
      pricing_id: planId,
      season_name: s.season_name,
      valid_from: new Date(s.valid_from),
      valid_to: new Date(s.valid_to),
      price_per_night: s.price_per_night,
      weekend_price_per_night: s.weekend_price_per_night ?? null,
      original_price: null,
      extra_bed_rate: s.extra_bed_rate ?? null,
      weekend_extra_bed_rate: s.weekend_extra_bed_rate ?? null,
      color: s.color ?? null,
      is_active: true,
      sort_order: i,
      occupancy_prices: (s.occupancy_prices ?? []).map((op, j) => ({
        id: baseTime + i * 100 + j,
        season_id: baseTime + i,
        occupancy: op.occupancy,
        price_per_night: op.price_per_night,
        original_price: op.original_price ?? null,
        weekend_price_per_night: op.weekend_price_per_night ?? null,
      })),
    }));
  }

  // Merges the generic occupancy grid (2P/3P/4P) with the dedicated single
  // (1P) occupancy toggle into one list to persist — single occupancy is kept
  // as its own form fields rather than folded into `occupancy_prices` live,
  // so the two editing surfaces never fight over the same array entry.
  function combinedOccupancyEntries(form: PricingFormState): OccupancyEntry[] {
    const rest = form.occupancy_prices.filter(e => e.occupancy !== 1);
    if (form.single_occupancy_enabled && form.single_occupancy_price) {
      return [...rest, {
        occupancy: 1,
        price: form.single_occupancy_price,
        original: "",
        weekendPrice: form.single_occupancy_weekend_price || undefined,
      }];
    }
    return rest;
  }

  function handleAdd(form: PricingFormState) {
    startTransition(async () => {
      const seasons = buildSeasonsInput(form);

      const result = await createRoomPricingWithSeasons(hotel_id, {
        room_id: Number(form.room_id),
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
      const savedPrices: OccupancyPrice[] = [];
      for (const entry of combinedOccupancyEntries(form)) {
        if (entry.price && Number(entry.price) > 0) {
          const r = await upsertOccupancyPrice(planId, hotel_id, entry.occupancy, Number(entry.price),
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

      const roomId = Number(form.room_id);
      const mealId = form.meal_type_id && form.meal_type_id !== "none" ? Number(form.meal_type_id) : null;
      const dietId = form.diet_type_id && form.diet_type_id !== "none" ? Number(form.diet_type_id) : null;
      const now = Date.now();

      setPricing(prev => [
        ...prev,
        {
          id: planId,
          hotel_id,
          room_id: roomId,
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
          room: rooms.find(r => r.id === roomId) ?? null,
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

      const result = await updateRoomPricingWithSeasons(id, hotel_id, {
        room_id: Number(form.room_id),
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

      // Reconcile occupancy prices against what the plan had before this
      // edit — upsert anything present now, delete anything removed (most
      // commonly: single occupancy toggled off).
      const existingPlan = pricing.find(p => p.id === id);
      const initialOccMap = new Map((existingPlan?.occupancy_prices ?? []).map(op => [op.occupancy, op]));
      const finalMap = new Map(
        combinedOccupancyEntries(form)
          .filter(e => e.price && Number(e.price) > 0)
          .map(e => [e.occupancy, e]),
      );
      const updatedPrices: OccupancyPrice[] = [];
      for (const [occ, entry] of finalMap) {
        const r = await upsertOccupancyPrice(id, hotel_id, occ, Number(entry.price), entry.original ? Number(entry.original) : null,
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
        if (!finalMap.has(occ)) await deleteOccupancyPrice(op.id, hotel_id);
      }

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
            room_id: roomId,
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
            room: rooms.find(r => r.id === roomId) ?? null,
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
          onSave={handleAdd} onCancel={() => setAdding(false)} isSaving={isPending} isNew
          hotelId={hotel_id} allPlans={pricing} onSiblingSeasonsUpdated={handleSeasonsUpdated} />
      )}

      {byRoom.length > 0 ? (
        <div className="space-y-6">
          {byRoom.map(({ room, plans }) => (
            <div key={room.id} className="space-y-2">
              <p className="text-xs font-bold text-dashboard-base-content/50 uppercase tracking-widest px-1">{room.name}</p>
              <div className="space-y-2">
                {plans.map(plan => (
                  <PlanRow key={plan.id} plan={plan} hotelId={hotel_id} editId={editId}
                    rooms={rooms} mealTypes={mealTypes} dietTypes={dietTypes} allPlans={pricing} isPending={isPending}
                    onEdit={setEditId} onSaveEdit={handleEdit} onCancelEdit={() => setEditId(null)}
                    onDelete={handleDelete} onOccupancyUpdated={handleOccupancyUpdated} onSeasonsUpdated={handleSeasonsUpdated}
                    highlight={plan.id === highlightPlanId} highlightSeasonId={highlightSeasonId} />
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
