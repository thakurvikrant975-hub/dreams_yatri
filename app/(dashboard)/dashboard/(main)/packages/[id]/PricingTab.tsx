"use client";

import { useState, useTransition, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Switch } from "../../components/ui/switch";
import { Label } from "../../components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "../../components/ui/alert-dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/app/components/ui/popover";
import {
  Loader2, Check, Percent, Settings2, Car, Plus, Trash2,
  Wind, AlertTriangle, Pencil,
  CalendarDays, X, Star, FileCheck2,
} from "lucide-react"; 
import { toast } from "sonner";
import { cn } from "@/app/lib/utils";
import {
  handleUpsertPackagePricing, handleReplaceMarginSeasons,
} from "@/app/actions/packages/pricing.actions";
import {
  SeasonalRateCalendar, type SeasonalRateCalendarItem,
} from "../../components/ui/seasonal-rate-calendar";
import {
  type RateSeasonBase, CURATED_PALETTE,
} from "../../components/ui/seasonal-rate-calendar-logic";
import {
  createCabType, updateCabType, deleteCabType,
  upsertCabSegment, setDefaultCabType,
  getCabPricingOptionsForVehicle,
  getAllCabPricingOptions,
  type FullCabPricingOption,
} from "@/app/actions/packages/cab-pricing.actions";
import {
  createPackagePermit, updatePackagePermit, deletePackagePermit, getPermitOptions,
} from "@/app/actions/packages/permit.actions";
import {
  PERMIT_PRICE_TYPES,
  type PackagePermit, type PermitOption, type PermitPriceType,
} from "@/app/actions/packages/permit.types";
import { SearchSelect, type Option } from "../../components/dashboard/SearchSelect";

// ── Types ──────────────────────────────────────────────────────────────────

type Duration = { id: number; label: string; days: number; nights: number };
type StayCategory = { id: number; label: string; slug: string };
/** A saved date-ranged margin override, as it comes off the server. Dates are
 *  plain "YYYY-MM-DD"; only their month/day matter, since the engine matches
 *  year-agnostically so a season recurs every year. */
type MarginSeason = {
  id: string;
  season_name: string | null;
  valid_from: string;
  valid_to: string;
  margin_percentage: number;
  color: string | null;
};

type SavedPricing = {
  id: number;
  duration_id: number;
  stay_category_id: number;
  margin_percentage: number;
  gst_percentage: number;
  seasons: MarginSeason[];
};

/** The same season in the shape the shared Seasonal Rate Calendar speaks:
 *  `rate` is the margin percentage, `itemId` the stay category it belongs to. */
type MarginRateSeason = RateSeasonBase;

type CabSeason = {
  id: number;
  valid_from: Date | string;
  valid_to: Date | string;
  pricing_type: "PER_DAY" | "PER_KM";
  weekday_price: number;
  weekend_price: number;
};

type CabSegment = {
  id: number;
  day_from: number;
  day_to: number;
  sort_order: number;
  cab_pricing: {
    id: number;
    pricing_type: "PER_DAY" | "PER_KM";
    price: number;
    destination: { id: number; name: string };
    seasons: CabSeason[];
  };
};

type CabType = {
  id: number;
  duration_id: number;
  vehicle_id: number;
  label: string | null;
  note: string | null;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  vehicle: { id: number; name: string; type: string; passenger_capacity: number; has_ac: boolean };
  segments: CabSegment[];
};

type DayRange = { from: number; to: number };

/** A group = all cab types whose first segment shares the same day range within a duration. */
type CabGroup = {
  groupKey: string; // `${dayFrom}-${dayTo}`
  dayFrom: number;
  dayTo: number;
  cabTypes: CabType[];
};

type PricingTabProps = {
  packageId: number;
  durations: Duration[];
  stayCategories: StayCategory[];
  initialPricings: SavedPricing[];
  routes: { id: number; name: string; durationLabel: string }[];
  cabTypes: CabType[];
  permits: PackagePermit[];
  stopCoords: Array<{ lat: number; lng: number; name?: string }>;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function overlaps(aFrom: number, aTo: number, bFrom: number, bTo: number) {
  return aFrom <= bTo && bFrom <= aTo;
}

function fmt(n: number) {
  return n.toLocaleString("en-IN");
}

/** Group flat cab-type list by first-segment day range, sorted by dayFrom. */
function groupCabTypesByRange(cabTypes: CabType[]): CabGroup[] {
  const map = new Map<string, CabGroup>();
  for (const ct of cabTypes) {
    const seg = ct.segments[0];
    if (!seg) continue; // skip orphans
    const key = `${seg.day_from}-${seg.day_to}`;
    if (!map.has(key)) {
      map.set(key, { groupKey: key, dayFrom: seg.day_from, dayTo: seg.day_to, cabTypes: [] });
    }
    map.get(key)!.cabTypes.push(ct);
  }
  return Array.from(map.values()).sort((a, b) => a.dayFrom - b.dayFrom);
}

// ── uid helper ─────────────────────────────────────────────────────────────

let _uidSeq = 0;
function uid() { return String(++_uidSeq); }

// ── Seasonal margin ────────────────────────────────────────────────────────
// The base margin below is the floor: it applies on every date no season
// covers. Seasons layer date ranges on top of it, exactly like a hotel's
// seasonal room rates — same calendar, same overlap-trimming rules — so a
// package can take a fatter cut over Christmas without anyone having to
// remember to change it back in January.

function marginSeasonsToRateSeasons(
  seasons: MarginSeason[],
  stayCategoryId: number,
): MarginRateSeason[] {
  return seasons.map((s) => ({
    id: s.id,
    itemId: String(stayCategoryId),
    label: s.season_name ?? undefined,
    startDate: s.valid_from,
    endDate: s.valid_to,
    color: s.color ?? CURATED_PALETTE[0],
    rate: s.margin_percentage,
  }));
}

/** One duration's margin block — every stay category's base margin/GST row,
 *  plus the one seasonal calendar they share. The calendar is owned here
 *  rather than per row so opening it from any row still shows (and can edit)
 *  every category's seasons side by side for the same dates, which is how the
 *  hotel Pricing tab's version behaves too. */
function DurationMarginSection({
  packageId,
  duration,
  stayCategories,
  pricings,
}: {
  packageId: number;
  duration: Duration;
  stayCategories: StayCategory[];
  pricings: SavedPricing[];
}) {
  // Last SAVED base margin per category — what the calendar must show as the
  // base, since an unsaved edit in the input isn't what the engine is pricing
  // with yet.
  const [savedMargins, setSavedMargins] = useState<Record<number, number>>(() =>
    Object.fromEntries(
      stayCategories.map((c) => [
        c.id,
        pricings.find((p) => p.stay_category_id === c.id)?.margin_percentage ?? 10,
      ]),
    ),
  );
  const [seasons, setSeasons] = useState<MarginRateSeason[]>(() =>
    stayCategories.flatMap((c) =>
      marginSeasonsToRateSeasons(
        pricings.find((p) => p.stay_category_id === c.id)?.seasons ?? [],
        c.id,
      ),
    ),
  );
  const [calendarFor, setCalendarFor] = useState<number | null>(null);
  // Saving a season upserts the parent config row, so a category that showed
  // "Not configured" genuinely is configured afterwards (at the same 10%/5%
  // the inputs were already displaying). Track it so the label doesn't lie
  // until the next reload.
  const [configuredIds, setConfiguredIds] = useState<Set<number>>(
    () => new Set(pricings.map((p) => p.stay_category_id)),
  );

  const items: SeasonalRateCalendarItem[] = stayCategories.map((c) => ({
    id: String(c.id),
    label: c.label,
    baseRate: savedMargins[c.id] ?? 10,
  }));

  async function handleSaveSeasons(next: MarginRateSeason[], changedItemId: string) {
    const previous = seasons;
    setSeasons(next); // optimistic — the calendar stays responsive mid-edit
    const stayCategoryId = Number(changedItemId);
    const result = await handleReplaceMarginSeasons({
      package_id: packageId,
      duration_id: duration.id,
      stay_category_id: stayCategoryId,
      // The server assigns its own ids on every replace, so the client-side
      // ones (including the ones overlap-trimming just invented) aren't sent.
      seasons: next
        .filter((s) => s.itemId === changedItemId)
        .map((s) => ({
          season_name: s.label?.trim() || null,
          valid_from: s.startDate,
          valid_to: s.endDate,
          margin_percentage: s.rate,
          color: s.color,
        })),
    });
    if (result.success) {
      setConfiguredIds((prev) => prev.has(stayCategoryId) ? prev : new Set(prev).add(stayCategoryId));
      toast.success("Seasonal margin saved");
    } else {
      setSeasons(previous);
      toast.error(result.error);
    }
  }

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-semibold">{duration.label}</CardTitle>
          <Badge variant="outline" className="text-xs">{duration.nights}N / {duration.days}D</Badge>
        </div>
      </CardHeader>
      <CardContent className="px-4 pt-0 pb-1">
        {stayCategories.map((cat) => {
          const existing = pricings.find((p) => p.stay_category_id === cat.id);
          return (
            <PricingRow
              key={`${duration.id}-${cat.id}`}
              packageId={packageId}
              durationId={duration.id}
              stayCategory={cat}
              initialMargin={existing?.margin_percentage ?? 10}
              initialGst={existing?.gst_percentage ?? 5}
              hasConfig={configuredIds.has(cat.id)}
              seasonCount={seasons.filter((s) => s.itemId === String(cat.id)).length}
              onOpenSeasons={() => setCalendarFor(cat.id)}
              onSavedMargin={(m) => setSavedMargins((prev) => ({ ...prev, [cat.id]: m }))}
            />
          );
        })}
      </CardContent>

      {calendarFor != null && (
        <SeasonalRateCalendar<MarginRateSeason>
          open
          onOpenChange={(o) => { if (!o) setCalendarFor(null); }}
          title="Seasonal Margin"
          subtitle={`${duration.label} · margin applied on top of the base cost`}
          items={items}
          activeItemId={String(calendarFor)}
          onActiveItemChange={(id) => setCalendarFor(Number(id))}
          seasons={seasons}
          onSave={handleSaveSeasons}
          currencySymbol=""
          rateSuffix="%"
          rateFieldLabel="Margin %"
          rateMax={100}
          showBaseRateWhenZero
        />
      )}
    </Card>
  );
}

// ── Margin/GST row ─────────────────────────────────────────────────────────

function PricingRow({
  packageId,
  durationId,
  stayCategory,
  initialMargin,
  initialGst,
  hasConfig,
  seasonCount,
  onOpenSeasons,
  onSavedMargin,
}: {
  packageId: number;
  durationId: number;
  stayCategory: StayCategory;
  initialMargin: number;
  initialGst: number;
  hasConfig: boolean;
  seasonCount: number;
  onOpenSeasons: () => void;
  onSavedMargin: (margin: number) => void;
}) {
  const [margin, setMargin] = useState(String(initialMargin));
  const [gst, setGst] = useState(String(initialGst));
  const [saved, setSaved] = useState(hasConfig);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    const m = parseFloat(margin);
    const g = parseFloat(gst);
    if (isNaN(m) || isNaN(g) || m < 0 || g < 0) {
      toast.error("Enter valid non-negative percentages");
      return;
    }
    startTransition(async () => {
      const result = await handleUpsertPackagePricing({
        package_id: packageId,
        duration_id: durationId,
        stay_category_id: stayCategory.id,
        margin_percentage: m,
        gst_percentage: g,
      });
      if (result.success) {
        setSaved(true);
        onSavedMargin(m);
        toast.success(`${stayCategory.label} pricing saved`);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-3 py-3 border-b last:border-0">
      <div className="w-36 min-w-0 shrink-0">
        <span className="text-sm font-medium truncate block">{stayCategory.label}</span>
        {!hasConfig && !saved && (
          <span className="text-[10px] text-amber-500 font-medium">Not configured</span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-1">
        <div className="relative w-28">
          <Input
            type="number" min="0" max="100" step="0.5"
            value={margin}
            onChange={(e) => { setMargin(e.target.value); setSaved(false); }}
            className="pr-7 text-sm h-8" placeholder="10"
          />
          <Percent className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
        </div>
        <span className="text-xs text-muted-foreground">+</span>
        <div className="relative w-28">
          <Input
            type="number" min="0" max="100" step="0.5"
            value={gst}
            onChange={(e) => { setGst(e.target.value); setSaved(false); }}
            className="pr-7 text-sm h-8" placeholder="5"
          />
          <Percent className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
        </div>
        <span className="text-xs text-muted-foreground hidden sm:block">GST</span>
        <Button
          size="sm"
          variant={saved ? "outline" : "default"}
          onClick={handleSave}
          disabled={isPending || saved}
          className="h-8 w-20 shrink-0"
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : saved ? (
            <><Check className="h-3.5 w-3.5 mr-1 text-green-600" /><span className="text-green-600">Saved</span></>
          ) : "Save"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onOpenSeasons}
          className="h-8 shrink-0 gap-1.5"
          title="Override this margin for specific date ranges"
        >
          <CalendarDays className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Seasons</span>
          {seasonCount > 0 && (
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-semibold">
              {seasonCount}
            </Badge>
          )}
        </Button>
      </div>
    </div>
  );
}

// ── Day range picker ───────────────────────────────────────────────────────

function DayRangePicker({
  totalDays,
  value,
  onChange,
  occupiedRanges = [],
  disabled = false,
}: {
  totalDays: number;
  value: DayRange | undefined;
  onChange: (range: DayRange | undefined) => void;
  occupiedRanges?: Array<{ from: number; to: number }>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [selecting, setSelecting] = useState<number | null>(null);
  const [hoverDay, setHoverDay] = useState<number | null>(null);

  function isOccupied(day: number): boolean {
    return occupiedRanges.some((r) => r.from <= day && day <= r.to);
  }

  function isInRange(day: number): boolean {
    if (!value || selecting !== null) return false;
    return value.from <= day && day <= value.to;
  }

  function rangeHasOccupied(from: number, to: number): boolean {
    for (let d = from; d <= to; d++) {
      if (isOccupied(d)) return true;
    }
    return false;
  }

  const pendingFrom =
    selecting !== null && hoverDay !== null ? Math.min(selecting, hoverDay) : null;
  const pendingTo =
    selecting !== null && hoverDay !== null ? Math.max(selecting, hoverDay) : null;
  const pendingHasOccupied =
    pendingFrom !== null && pendingTo !== null && rangeHasOccupied(pendingFrom, pendingTo);

  function isInPendingRange(day: number): boolean {
    if (pendingFrom === null || pendingTo === null) return false;
    return pendingFrom <= day && day <= pendingTo;
  }

  function handleDayClick(day: number) {
    if (isOccupied(day) || disabled) return;
    if (selecting === null) {
      setSelecting(day);
    } else {
      const from = Math.min(selecting, day);
      const to = Math.max(selecting, day);
      if (rangeHasOccupied(from, to)) {
        setSelecting(day);
        setHoverDay(null);
        toast.error("Range crosses occupied days — pick a different end day");
        return;
      }
      onChange({ from, to });
      setSelecting(null);
      setHoverDay(null);
      setOpen(false);
    }
  }

  function handleOpenChange(v: boolean) {
    if (!disabled) {
      setOpen(v);
      if (!v) { setSelecting(null); setHoverDay(null); }
    }
  }

  const triggerLabel = value ? `Day ${value.from} – Day ${value.to}` : undefined;

  const rows: number[][] = [];
  for (let i = 1; i <= totalDays; i += 7) {
    rows.push(Array.from({ length: Math.min(7, totalDays - i + 1) }, (_, j) => i + j));
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-8 w-full items-center gap-2 rounded-md border bg-background px-3 text-sm",
            "hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            open && "ring-2 ring-ring",
          )}
        >
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className={cn("flex-1 text-left truncate", !triggerLabel && "text-muted-foreground")}>
            {triggerLabel ?? `All days (1–${totalDays})`}
          </span>
          {value && (
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => { e.stopPropagation(); onChange(undefined); }}
              className="ml-auto text-muted-foreground/50 hover:text-foreground transition-colors shrink-0 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-auto p-3 rounded-xl shadow-lg space-y-2.5"
        style={{ minWidth: Math.min(7, totalDays) * 36 + 24 + "px" }}
      >
        <p className="text-[11px] text-muted-foreground leading-snug">
          {selecting !== null ? (
            <span>
              <span className="text-dashboard-primary font-semibold">Day {selecting}</span>
              {" "}selected — click end day
            </span>
          ) : "Click a day to begin selecting range"}
        </p>
        <div className="space-y-1">
          {rows.map((row, ri) => (
            <div key={ri} className="flex gap-1">
              {row.map((day) => {
                const occupied  = isOccupied(day);
                const inSel     = isInRange(day);
                const isStart   = value?.from === day;
                const isEnd     = value?.to === day;
                const isAnchor  = selecting === day;
                const inPending = isInPendingRange(day);
                const pendingOk  = inPending && !pendingHasOccupied;
                const pendingBad = inPending && pendingHasOccupied;
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={occupied}
                    onClick={() => handleDayClick(day)}
                    onMouseEnter={() => !occupied && setHoverDay(day)}
                    onMouseLeave={() => setHoverDay(null)}
                    title={`Day ${day}${occupied ? " (occupied)" : ""}`}
                    className={cn(
                      "h-8 w-8 rounded-md text-[11px] font-medium transition-colors flex items-center justify-center select-none shrink-0",
                      occupied && "opacity-30 line-through cursor-not-allowed text-muted-foreground bg-muted",
                      !occupied && !inSel && !pendingOk && !pendingBad && !isAnchor
                        && "bg-muted/50 hover:bg-dashboard-primary/20 cursor-pointer",
                      !occupied && isAnchor && "bg-dashboard-primary text-white cursor-pointer shadow-sm",
                      !occupied && !isAnchor && inSel && (isStart || isEnd)
                        && "bg-dashboard-primary text-white cursor-pointer",
                      !occupied && !isAnchor && inSel && !isStart && !isEnd
                        && "bg-dashboard-primary/20 rounded-none cursor-pointer text-foreground",
                      !occupied && !inSel && pendingOk && !isAnchor
                        && "bg-dashboard-primary/15 cursor-pointer",
                      !occupied && pendingBad
                        && "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 cursor-pointer",
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        {occupiedRanges.length > 0 && (
          <p className="text-[10px] text-muted-foreground/70">
            Greyed-out days are already assigned to other groups.
          </p>
        )}
        <div className="flex items-center justify-between gap-2 pt-1 border-t">
          <p className="text-[10px] text-muted-foreground">
            {value
              ? `Day ${value.from}–${value.to} · ${value.to - value.from + 1} day${value.to - value.from + 1 !== 1 ? "s" : ""}`
              : "No range selected"}
          </p>
          <Button
            type="button" size="sm"
            disabled={!value}
            onClick={() => { setOpen(false); setSelecting(null); }}
            className="h-6 px-2.5 text-[11px] gap-1 bg-dashboard-primary text-white hover:bg-dashboard-primary/90"
          >
            <Check className="h-2.5 w-2.5" />Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── CabPricingSearchSelect — all vehicle+pricing combos (for creating new group) ──

function CabPricingSearchSelect({
  stopCoords,
  excludeVehicleIds,
  value,
  onSelect,
  disabled,
}: {
  stopCoords: Array<{ lat: number; lng: number; name?: string }>;
  excludeVehicleIds: number[];
  value: number | null;
  onSelect: (option: FullCabPricingOption | null) => void;
  disabled?: boolean;
}) {
  const optionsMapRef  = useRef<Map<number, FullCabPricingOption>>(new Map());
  const coordsRef      = useRef(stopCoords);
  const excludeRef     = useRef(excludeVehicleIds);
  const stopNamesRef   = useRef<Set<string>>(new Set());
  useEffect(() => { coordsRef.current = stopCoords; });
  useEffect(() => { excludeRef.current = excludeVehicleIds; });
  useEffect(() => {
    stopNamesRef.current = new Set(
      stopCoords.filter((s) => s.name).map((s) => s.name!.toLowerCase()),
    );
  }, [stopCoords]);

  const fetchOptions = useCallback(async (query: string): Promise<Option[]> => {
    const res = await getAllCabPricingOptions({
      stopCoords:        coordsRef.current,
      excludeVehicleIds: excludeRef.current,
      query:             query || undefined,
    });
    if (!res.success) return [];
    const stopNames = stopNamesRef.current;
    const map = new Map<number, FullCabPricingOption>();
    const opts = res.data.map((o) => {
      map.set(o.cab_pricing_id, o);
      const isRouteStop = stopNames.has(o.city_name.toLowerCase());
      return {
        id:          o.cab_pricing_id,
        label:       `${o.vehicle_name}${o.has_ac ? " · AC" : ""} · ${o.passenger_capacity} pax`,
        description: `${o.city_name} · ${o.pricing_type === "PER_DAY" ? "Per Day" : "Per Km"} · ₹${fmt(o.price)}`,
        ...(isRouteStop ? { badge: "On Route" } : {}),
      };
    });
    optionsMapRef.current = map;
    return opts;
  }, []);

  function handleChange(val: number | null) {
    if (val === null) { onSelect(null); return; }
    onSelect(optionsMapRef.current.get(val) ?? null);
  }

  return (
    <SearchSelect
      value={value}
      onChange={handleChange}
      fetchOptions={fetchOptions}
      placeholder="Search vehicle + destination…"
      disabled={disabled}
    />
  );
}

// ── PermitSearchSelect — permits from library, route stops highlighted ─────

const PERMIT_CATEGORY_LABELS: Record<string, string> = {
  ENTRY_FEE:     "Entry Fee",
  MOUNTAIN_PASS: "Mountain Pass",
  WILDLIFE:      "Wildlife",
  BORDER_AREA:   "Border Area",
  NATIONAL_PARK: "National Park",
  FOREST:        "Forest",
  OTHER:         "Other",
};

function PermitSearchSelect({
  stopCoords,
  value,
  onSelect,
  disabled,
}: {
  stopCoords: Array<{ lat: number; lng: number; name?: string }>;
  value: number | null;
  onSelect: (option: PermitOption | null) => void;
  disabled?: boolean;
}) {
  const optionsMapRef = useRef<Map<number, PermitOption>>(new Map());
  const stopNamesRef  = useRef<Set<string>>(new Set());

  useEffect(() => {
    stopNamesRef.current = new Set(
      stopCoords.filter((s) => s.name).map((s) => s.name!.toLowerCase()),
    );
  }, [stopCoords]);

  const fetchOptions = useCallback(async (query: string): Promise<Option[]> => {
    const res = await getPermitOptions(query || undefined);
    if (!res.success) return [];
    const stopNames = stopNamesRef.current;
    const map = new Map<number, PermitOption>();
    const opts = res.data.map((p) => {
      map.set(p.id, p);
      const isRouteStop = p.location_name
        ? stopNames.has(p.location_name.toLowerCase())
        : false;
      const catLabel = (p.custom_category && p.category === "OTHER")
        ? p.custom_category
        : (PERMIT_CATEGORY_LABELS[p.category] ?? p.category);
      const priceParts: string[] = [];
      if (p.price_per_vehicle > 0) priceParts.push(`₹${fmt(p.price_per_vehicle)}/vehicle`);
      if (p.price_per_person  > 0) priceParts.push(`₹${fmt(p.price_per_person)}/person`);
      return {
        id:          p.id,
        label:       p.name,
        description: [catLabel, p.location_name, ...priceParts].filter(Boolean).join(" · "),
        ...(isRouteStop ? { badge: "On Route" } : {}),
      };
    });
    optionsMapRef.current = map;
    return opts;
  }, []);

  function handleChange(val: number | null) {
    if (val === null) { onSelect(null); return; }
    onSelect(optionsMapRef.current.get(val) ?? null);
  }

  return (
    <SearchSelect
      value={value}
      onChange={handleChange}
      fetchOptions={fetchOptions}
      placeholder="Search permit library…"
      disabled={disabled}
    />
  );
}

// ── VehiclePricingSearchSelect — pricing options for a known vehicle ───────

type VehiclePricingMeta = {
  pricing_type: "PER_DAY" | "PER_KM";
  price: number;
  destination: { id: number; name: string };
};

function VehiclePricingSearchSelect({
  vehicleId,
  value,
  onChange,
  initialLabel,
  disabled,
}: {
  vehicleId: number;
  value: number | null;
  onChange: (val: number | null, meta: VehiclePricingMeta | null) => void;
  initialLabel?: string;
  disabled?: boolean;
}) {
  const vehicleIdRef  = useRef(vehicleId);
  const optionsMapRef = useRef<Map<number, VehiclePricingMeta>>(new Map());
  useEffect(() => { vehicleIdRef.current = vehicleId; });

  const fetchOptions = useCallback(async (query: string): Promise<Option[]> => {
    const res = await getCabPricingOptionsForVehicle(vehicleIdRef.current);
    if (!res.success) return [];
    let data = res.data;
    if (query) {
      const q = query.toLowerCase();
      data = data.filter((o) => o.city_name.toLowerCase().includes(q));
    }
    const map = new Map<number, VehiclePricingMeta>();
    const opts = data.map((o) => {
      map.set(o.cab_pricing_id, {
        pricing_type: o.pricing_type,
        price:        o.price,
        destination:  { id: 0, name: o.city_name },
      });
      return {
        id:          o.cab_pricing_id,
        label:       o.city_name,
        description: `${o.pricing_type === "PER_DAY" ? "Per Day" : "Per Km"} · ₹${fmt(o.price)}${
          o.seasons_count > 0 ? ` · ${o.seasons_count} season${o.seasons_count > 1 ? "s" : ""}` : ""
        }`,
      };
    });
    optionsMapRef.current = map;
    return opts;
  }, []);

  function handleChange(val: number | null) {
    onChange(val, val !== null ? (optionsMapRef.current.get(val) ?? null) : null);
  }

  return (
    <SearchSelect
      value={value}
      onChange={handleChange}
      fetchOptions={fetchOptions}
      placeholder="Select pricing source…"
      initialLabel={initialLabel}
      disabled={disabled}
    />
  );
}

// ── CabOptionRow ───────────────────────────────────────────────────────────
// One cab type row inside a CabGroupCard.
// Editing changes only the pricing source (segment cab_pricing_id).

function CabOptionRow({
  cabType,
  packageId,
  onUpdated,
  onDeleted,
  onSetDefault,
}: {
  cabType: CabType;
  packageId: number;
  onUpdated: (updated: CabType) => void;
  onDeleted: (id: number) => void;
  onSetDefault: (id: number) => void;
}) {
  const [editing,         setEditing]         = useState(false);
  const [editPricingId,   setEditPricingId]   = useState<number | null>(null);
  const [editPricingMeta, setEditPricingMeta] = useState<VehiclePricingMeta | null>(null);
  const [isPending,       startTransition]    = useTransition();
  const router = useRouter();

  const v   = cabType.vehicle;
  const seg = cabType.segments[0];

  function handleSetDefault() {
    if (cabType.is_default || isPending) return;
    startTransition(async () => {
      // setDefaultCabType clears is_default ONLY for other members of the same
      // group (same day range), so other groups keep their own defaults.
      const res = await setDefaultCabType(cabType.id, packageId);
      if (res.success) {
        onSetDefault(cabType.id);
        // Refresh server component so initialCabTypes is up-to-date.
        // If the user switches tabs and comes back, the remounted component
        // will receive the fresh default rather than the stale page-load snapshot.
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleToggleActive(val: boolean) {
    startTransition(async () => {
      const res = await updateCabType(cabType.id, packageId, { is_active: val });
      if (res.success) {
        onUpdated({ ...cabType, is_active: val });
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function startEdit() {
    setEditPricingId(seg?.cab_pricing.id ?? null);
    setEditPricingMeta(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setEditPricingId(null);
    setEditPricingMeta(null);
  }

  function handleSaveEdit() {
    if (!editPricingId || !seg) return;
    startTransition(async () => {
      const res = await upsertCabSegment({
        id:             seg.id,
        cab_type_id:    cabType.id,
        package_id:     packageId,
        day_from:       seg.day_from,
        day_to:         seg.day_to,
        cab_pricing_id: editPricingId,
      });
      if (res.success) {
        toast.success("Pricing source updated");
        const updatedSeg: CabSegment = {
          ...seg,
          cab_pricing: editPricingMeta
            ? { id: editPricingId, pricing_type: editPricingMeta.pricing_type, price: editPricingMeta.price, destination: editPricingMeta.destination, seasons: seg.cab_pricing.seasons }
            : { ...seg.cab_pricing, id: editPricingId },
        };
        onUpdated({ ...cabType, segments: [updatedSeg, ...cabType.segments.slice(1)] });
        setEditing(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-3 transition-colors border-t first:border-t-0",
        cabType.is_default && "bg-dashboard-primary/5",
        !cabType.is_active && "opacity-60",
      )}
    >
      {/* Default star */}
      <button
        type="button"
        disabled={isPending || cabType.is_default}
        onClick={handleSetDefault}
        title={cabType.is_default ? "Default option" : "Set as default"}
        className={cn(
          "shrink-0 rounded-md p-1 transition-colors",
          cabType.is_default
            ? "text-dashboard-primary cursor-default"
            : "text-muted-foreground/30 hover:text-dashboard-primary cursor-pointer",
        )}
      >
        <Star className={cn("h-4 w-4", cabType.is_default && "fill-dashboard-primary")} />
      </button>

      {/* Vehicle + pricing info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium leading-tight">{cabType.label ?? v.name}</span>
          {v.has_ac && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-0.5">
              <Wind className="h-2.5 w-2.5" />AC
            </Badge>
          )}
          <span className="text-[11px] text-muted-foreground">{v.passenger_capacity} pax</span>
          {cabType.is_default && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-dashboard-primary/40 text-dashboard-primary">
              Default
            </Badge>
          )}
          {!cabType.is_active && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Inactive</Badge>
          )}
        </div>

        {editing ? (
          <div className="mt-1.5 flex items-center gap-1.5">
            <div className="flex-1 min-w-0">
              <VehiclePricingSearchSelect
                vehicleId={v.id}
                value={editPricingId}
                onChange={(val, meta) => { setEditPricingId(val); setEditPricingMeta(meta); }}
                initialLabel={seg?.cab_pricing.destination.name}
                disabled={isPending}
              />
            </div>
            <Button
              type="button" size="sm"
              className="h-7 px-2.5 text-xs shrink-0 gap-1"
              onClick={handleSaveEdit}
              disabled={isPending || !editPricingId || editPricingId === seg?.cab_pricing.id}
            >
              {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Check className="h-3 w-3" />Save</>}
            </Button>
            <Button
              type="button" variant="ghost" size="sm"
              className="h-7 px-2 shrink-0"
              onClick={cancelEdit}
              disabled={isPending}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {seg
              ? `${seg.cab_pricing.destination.name} · ${seg.cab_pricing.pricing_type === "PER_DAY" ? "Per Day" : "Per Km"} · ₹${fmt(seg.cab_pricing.price)}${seg.cab_pricing.seasons.length > 0 ? ` · ${seg.cab_pricing.seasons.length} season${seg.cab_pricing.seasons.length > 1 ? "s" : ""}` : ""}`
              : "No pricing configured"}
          </p>
        )}
      </div>

      {/* Active toggle */}
      {!editing && (
        <Switch
          checked={cabType.is_active}
          onCheckedChange={handleToggleActive}
          disabled={isPending}
          className="shrink-0"
        />
      )}

      {/* Edit button */}
      {!editing && (
        <button
          type="button"
          onClick={startEdit}
          disabled={isPending}
          title="Edit pricing source"
          className="shrink-0 rounded-md p-1.5 text-muted-foreground/40 hover:bg-muted hover:text-foreground transition-colors disabled:cursor-not-allowed"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Delete */}
      {!editing && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              disabled={isPending}
              className="shrink-0 rounded-md p-1.5 text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive transition-colors disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Cab Option</AlertDialogTitle>
              <AlertDialogDescription>
                Remove <span className="font-semibold">{cabType.label ?? v.name}</span> from this group?
                This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  startTransition(async () => {
                    const res = await deleteCabType(cabType.id, packageId);
                    if (res.success) { onDeleted(cabType.id); router.refresh(); }
                    else toast.error(res.error);
                  });
                }}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

// ── AddOptionToGroupForm ───────────────────────────────────────────────────
// Adds one more cab option to an existing group (day range is pre-set).

function AddOptionToGroupForm({
  packageId,
  duration,
  groupRange,
  stopCoords,
  existingVehicleIds,
  onAdded,
  onCancel,
}: {
  packageId: number;
  duration: { id: number; days: number };
  groupRange: { from: number; to: number };
  stopCoords: Array<{ lat: number; lng: number; name?: string }>;
  existingVehicleIds: Set<number>;
  onAdded: (cabType: CabType) => void;
  onCancel: () => void;
}) {
  const [option,     setOption]     = useState<FullCabPricingOption | null>(null);
  const [isPending,  startTransition] = useTransition();
  const router = useRouter();
  const dayCount = groupRange.to - groupRange.from + 1;

  function handleCreate() {
    if (!option) return;
    startTransition(async () => {
      const res = await createCabType({
        package_id:  packageId,
        duration_id: duration.id,
        vehicle_id:  option.vehicle_id,
        is_default:  false,
        segments: [{
          day_from:       groupRange.from,
          day_to:         groupRange.to,
          cab_pricing_id: option.cab_pricing_id,
          sort_order:     0,
        }],
      });
      if (res.success) {
        toast.success("Option added to group");
        router.refresh();
        onAdded({
          id:          res.id,
          duration_id: duration.id,
          vehicle_id:  option.vehicle_id,
          label:       null,
          note:        null,
          is_default:  false,
          is_active:   true,
          sort_order:  0,
          vehicle: {
            id:                 option.vehicle_id,
            name:               option.vehicle_name,
            type:               option.vehicle_type,
            passenger_capacity: option.passenger_capacity,
            has_ac:             option.has_ac,
          },
          segments: [{
            id:         res.id,
            day_from:   groupRange.from,
            day_to:     groupRange.to,
            sort_order: 0,
            cab_pricing: {
              id:           option.cab_pricing_id,
              pricing_type: option.pricing_type,
              price:        option.price,
              destination:  { id: 0, name: option.city_name },
              seasons:      [],
            },
          }],
        });
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="px-4 py-3 border-t bg-muted/10">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="text-[10px] gap-1">
              <CalendarDays className="h-2.5 w-2.5" />
              Day {groupRange.from}–{groupRange.to} · {dayCount} day{dayCount !== 1 ? "s" : ""}
            </Badge>
            <span className="text-[10px] text-muted-foreground">inherited from group</span>
          </div>
          <CabPricingSearchSelect
            stopCoords={stopCoords}
            excludeVehicleIds={Array.from(existingVehicleIds)}
            value={option?.cab_pricing_id ?? null}
            onSelect={setOption}
            disabled={isPending}
          />
        </div>
        <div className="flex gap-1.5 pt-6 shrink-0">
          <Button type="button" variant="ghost" size="sm" className="h-8" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" size="sm" className="h-8 gap-1" onClick={handleCreate} disabled={!option || isPending}>
            {isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <><Check className="h-3 w-3" />Add</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── CabGroupCard ───────────────────────────────────────────────────────────
// Displays one group: shared day range header + list of CabOptionRow.

function CabGroupCard({
  group,
  packageId,
  duration,
  stopCoords,
  otherGroupRanges,
  onGroupRangeChanged,
  onCabTypeDeleted,
  onCabTypeUpdated,
  onSetDefault,
  onOptionAdded,
}: {
  group: CabGroup;
  packageId: number;
  duration: Duration;
  stopCoords: Array<{ lat: number; lng: number; name?: string }>;
  otherGroupRanges: Array<{ from: number; to: number }>;
  onGroupRangeChanged: (groupKey: string, newFrom: number, newTo: number) => void;
  onCabTypeDeleted: (cabTypeId: number) => void;
  onCabTypeUpdated: (updated: CabType) => void;
  onSetDefault: (cabTypeId: number) => void;
  onOptionAdded: (cabType: CabType) => void;
}) {
  const [editingRange,  setEditingRange]  = useState(false);
  const [pendingRange,  setPendingRange]  = useState<DayRange>({ from: group.dayFrom, to: group.dayTo });
  const [addingOption,  setAddingOption]  = useState(false);
  const [isPending,     startTransition]  = useTransition();
  const router = useRouter();

  const dayCount = group.dayTo - group.dayFrom + 1;
  const existingVehicleIds = new Set(group.cabTypes.map((ct) => ct.vehicle_id));

  function handleSaveRange() {
    startTransition(async () => {
      const results = await Promise.all(
        group.cabTypes.flatMap((ct) => {
          const seg = ct.segments[0];
          if (!seg) return [];
          return [upsertCabSegment({
            id:             seg.id,
            cab_type_id:    ct.id,
            package_id:     packageId,
            day_from:       pendingRange.from,
            day_to:         pendingRange.to,
            cab_pricing_id: seg.cab_pricing.id,
          })];
        }),
      );
      const failed = results.filter((r) => !r.success).length;
      if (failed > 0) {
        toast.error(`${failed} update${failed > 1 ? "s" : ""} failed`);
      } else {
        toast.success(
          group.cabTypes.length > 1
            ? `Day range updated for all ${group.cabTypes.length} options in this group`
            : "Day range updated",
        );
        onGroupRangeChanged(group.groupKey, pendingRange.from, pendingRange.to);
        setEditingRange(false);
        router.refresh();
      }
    });
  } 


 
  function cancelRangeEdit() {
    setEditingRange(false);
    setPendingRange({ from: group.dayFrom, to: group.dayTo });
  }

  const rangeChanged =
    pendingRange.from !== group.dayFrom || pendingRange.to !== group.dayTo;

  return (
    <div className="rounded-xl border overflow-hidden mb-3 bg-background shadow-sm">
      {/* ── Group header ── */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-muted/30 border-b">
        <CalendarDays className="h-4 w-4 text-primary shrink-0" />

        {editingRange ? (
          /* Range editor mode */
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-52 shrink-0">
              <DayRangePicker
                totalDays={duration.days}
                value={pendingRange}
                onChange={(r) => r && setPendingRange(r)}
                occupiedRanges={otherGroupRanges}
                disabled={isPending}
              />
            </div>
            {group.cabTypes.length > 1 && (
              <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:block">
                Updates all {group.cabTypes.length} options
              </span>
            )}
            {rangeChanged && (
              <Badge variant="outline" className="text-[10px] shrink-0 gap-1 text-amber-600 border-amber-400/50">
                <AlertTriangle className="h-2.5 w-2.5" />Changed
              </Badge>
            )}
            <div className="flex gap-1.5 ml-auto shrink-0">
              <Button
                type="button" size="sm"
                className="h-7 px-2.5 text-xs gap-1"
                onClick={handleSaveRange}
                disabled={!rangeChanged || isPending}
              >
                {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Check className="h-3 w-3" />Save</>}
              </Button>
              <Button
                type="button" variant="ghost" size="sm"
                className="h-7 px-2 text-xs"
                onClick={cancelRangeEdit}
                disabled={isPending}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          /* Display mode */
          <>
            <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">
                Day {group.dayFrom}–{group.dayTo}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {dayCount} day{dayCount !== 1 ? "s" : ""}
              </span>
              <Badge variant="secondary" className="text-[10px]">
                {group.cabTypes.length} option{group.cabTypes.length !== 1 ? "s" : ""}
              </Badge>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={() => { setPendingRange({ from: group.dayFrom, to: group.dayTo }); setEditingRange(true); }}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Pencil className="h-3 w-3" />Edit Range
              </button>
              {!addingOption && (
                <button
                  type="button"
                  onClick={() => setAddingOption(true)}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Plus className="h-3 w-3" />Add Option
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Options list ── */}
      <div>
        {group.cabTypes.length === 0 && !addingOption ? (
          <p className="text-xs text-muted-foreground text-center py-4 px-4">
            No options. Use <strong>Add Option</strong> above.
          </p>
        ) : (
          group.cabTypes.map((ct) => (
            <CabOptionRow
              key={ct.id}
              cabType={ct}
              packageId={packageId}
              onUpdated={onCabTypeUpdated}
              onDeleted={onCabTypeDeleted}
              onSetDefault={onSetDefault}
            />
          ))
        )}

        {addingOption && (
          <AddOptionToGroupForm
            packageId={packageId}
            duration={duration}
            groupRange={{ from: group.dayFrom, to: group.dayTo }}
            stopCoords={stopCoords}
            existingVehicleIds={existingVehicleIds}
            onAdded={(ct) => { onOptionAdded(ct); setAddingOption(false); }}
            onCancel={() => setAddingOption(false)}
          />
        )}
      </div>
    </div>
  );
}

// ── AddCabTypeForm ─────────────────────────────────────────────────────────
// Creates a NEW group: shared day range + one or more cab options at once.

type SelectedCab = {
  uid: string;
  option: FullCabPricingOption | null;
  isDefault: boolean;
};

function AddCabTypeForm({
  packageId,
  duration,
  stopCoords,
  existingVehicleIds,
  occupiedRanges,
  onAdded,
  onCancel,
}: {
  packageId: number;
  duration: Duration;
  stopCoords: Array<{ lat: number; lng: number; name?: string }>;
  existingVehicleIds: Set<number>;
  occupiedRanges: Array<{ from: number; to: number }>;
  onAdded: (cabTypes: CabType[]) => void;
  onCancel: () => void;
}) {
  const [rows, setRows] = useState<SelectedCab[]>(() => [
    { uid: uid(), option: null, isDefault: true },
  ]);
  const [dayRange, setDayRange] = useState<DayRange | undefined>(() => {
    const full = { from: 1, to: duration.days };
    const hasConflict = occupiedRanges.some((r) => overlaps(1, duration.days, r.from, r.to));
    return hasConflict ? undefined : full;
  });
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function setRowOption(rowUid: string, option: FullCabPricingOption | null) {
    setRows((prev) => prev.map((r) => r.uid === rowUid ? { ...r, option } : r));
  }

  function setRowDefault(rowUid: string) {
    setRows((prev) => prev.map((r) => ({ ...r, isDefault: r.uid === rowUid })));
  }

  function addRow() {
    setRows((prev) => [...prev, { uid: uid(), option: null, isDefault: false }]);
  }

  function removeRow(rowUid: string) {
    setRows((prev) => {
      const next = prev.filter((r) => r.uid !== rowUid);
      if (next.length > 0 && !next.some((r) => r.isDefault)) {
        next[0] = { ...next[0], isDefault: true };
      }
      return next;
    });
  }

  function excludeFor(rowUid: string): number[] {
    return [
      ...Array.from(existingVehicleIds),
      ...rows
        .filter((r) => r.uid !== rowUid && r.option !== null)
        .map((r) => r.option!.vehicle_id),
    ];
  }

  const validRows = rows.filter((r) => r.option !== null);
  const isValid   = validRows.length > 0 && dayRange !== undefined;

  function handleCreate() {
    if (!isValid || !dayRange) return;
    startTransition(async () => {
      const results = await Promise.all(
        validRows.map((r) =>
          createCabType({
            package_id:  packageId,
            duration_id: duration.id,
            vehicle_id:  r.option!.vehicle_id,
            is_default:  r.isDefault,
            segments: [{
              day_from:       dayRange.from,
              day_to:         dayRange.to,
              cab_pricing_id: r.option!.cab_pricing_id,
              sort_order:     0,
            }],
          }),
        ),
      );

      const failed    = results.filter((r) => !r.success).length;
      const newTypes: CabType[] = results
        .map((res, i) => ({ res, row: validRows[i] }))
        .filter(({ res }) => res.success)
        .map(({ res, row }) => {
          if (!res.success) return null as never;
          return {
            id:          res.id,
            duration_id: duration.id,
            vehicle_id:  row.option!.vehicle_id,
            label:       null,
            note:        null,
            is_default:  row.isDefault,
            is_active:   true,
            sort_order:  0,
            vehicle: {
              id:                 row.option!.vehicle_id,
              name:               row.option!.vehicle_name,
              type:               row.option!.vehicle_type,
              passenger_capacity: row.option!.passenger_capacity,
              has_ac:             row.option!.has_ac,
            },
            segments: [{
              id:         0,
              day_from:   dayRange.from,
              day_to:     dayRange.to,
              sort_order: 0,
              cab_pricing: {
                id:           row.option!.cab_pricing_id,
                pricing_type: row.option!.pricing_type,
                price:        row.option!.price,
                destination:  { id: 0, name: row.option!.city_name },
                seasons:      [],
              },
            }],
          };
        });

      if (failed > 0)          toast.error(`${failed} option${failed > 1 ? "s" : ""} failed to save`);
      if (newTypes.length > 0) {
        toast.success(`Group created · ${newTypes.length} option${newTypes.length > 1 ? "s" : ""} added`);
        router.refresh();
        onAdded(newTypes);
      }
    });
  }

  return (
    <div className="border rounded-xl p-3 space-y-3 bg-muted/10">
      {/* Shared day range */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-1">
        <div className="space-y-1">
          <Label className="text-xs">
            Group Day Range <span className="text-destructive">*</span>
          </Label>
          <DayRangePicker
            totalDays={duration.days}
            value={dayRange}
            onChange={(r) => setDayRange(r)}
            occupiedRanges={occupiedRanges}
            disabled={isPending}
          />
          <p className="text-[10px] text-muted-foreground">
            All options below share this range and form one group.
          </p>
        </div>
      </div>

      {/* Cab option rows */}
      <div className="space-y-2">
        <Label className="text-xs">
          Cab Options <span className="text-destructive">*</span>
          <span className="text-muted-foreground font-normal ml-1">— vehicles customers can choose from</span>
        </Label>

        {rows.map((row, idx) => (
          <div
            key={row.uid}
            className={cn(
              "flex items-start gap-2 rounded-lg border p-2.5 transition-colors",
              row.isDefault
                ? "border-dashboard-primary/40 bg-dashboard-primary/5"
                : "border-border bg-background",
            )}
          >
            <span className="mt-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
              {idx + 1}
            </span>

            <div className="flex-1 min-w-0 space-y-1">
              <CabPricingSearchSelect
                stopCoords={stopCoords}
                excludeVehicleIds={excludeFor(row.uid)}
                value={row.option?.cab_pricing_id ?? null}
                onSelect={(opt) => setRowOption(row.uid, opt)}
                disabled={isPending}
              />
              {row.option && (
                <p className="text-[10px] text-muted-foreground leading-snug pl-0.5">
                  {row.option.vehicle_type} · {row.option.passenger_capacity} pax
                  {row.option.has_ac ? " · AC" : ""}
                </p>
              )}
            </div>

            <button
              type="button"
              disabled={isPending}
              onClick={() => setRowDefault(row.uid)}
              title={row.isDefault ? "Default option" : "Set as default"}
              className={cn(
                "mt-1.5 flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors",
                row.isDefault
                  ? "border-dashboard-primary/40 bg-dashboard-primary/10 text-dashboard-primary"
                  : "border-border text-muted-foreground hover:border-dashboard-primary/30 hover:text-dashboard-primary/80",
              )}
            >
              <Star className={cn("h-3 w-3", row.isDefault && "fill-dashboard-primary text-dashboard-primary")} />
              {row.isDefault ? "Default" : "Set default"}
            </button>

            <button
              type="button"
              disabled={isPending || rows.length === 1}
              onClick={() => removeRow(row.uid)}
              className="mt-1.5 shrink-0 rounded-md p-1 text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-30"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        <button
          type="button"
          disabled={isPending}
          onClick={addRow}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-2 text-xs text-muted-foreground transition-colors hover:border-dashboard-primary/40 hover:text-dashboard-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Add another cab option
        </button>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <p className="text-[10px] text-muted-foreground">
          {validRows.length > 0
            ? `${validRows.length} option${validRows.length > 1 ? "s" : ""} · star marks default shown to customers`
            : "Select at least one cab option"}
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" size="sm" disabled={!isValid || isPending} onClick={handleCreate}>
            {isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <><Check className="h-3.5 w-3.5 mr-1" />Create Group</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── CabTypesSection ────────────────────────────────────────────────────────

function CabTypesSection({
  packageId,
  duration,
  initialCabTypes,
  stopCoords,
}: {
  packageId: number;
  duration: Duration;
  initialCabTypes: CabType[];
  stopCoords: Array<{ lat: number; lng: number; name?: string }>;
}) {
  const [cabTypes,     setCabTypes]     = useState(initialCabTypes);
  const [addingGroup,  setAddingGroup]  = useState(false);

  const groups          = groupCabTypesByRange(cabTypes);
  const allGroupRanges  = groups.map((g) => ({ from: g.dayFrom, to: g.dayTo }));

  // ── handlers ────────────────────────────────────────────────────────────

  /** When a cab type is set as default, clear default on all OTHER cab types in the same group. */
  function handleSetDefault(cabTypeId: number) {
    setCabTypes((prev) => {
      const target = prev.find((ct) => ct.id === cabTypeId);
      if (!target) return prev;
      const tSeg = target.segments[0];
      if (!tSeg) return prev;
      return prev.map((ct) => {
        if (ct.id === cabTypeId) return { ...ct, is_default: true };
        const s = ct.segments[0];
        // Clear default for others in the same group (same duration + same day range)
        if (s && ct.duration_id === target.duration_id &&
            s.day_from === tSeg.day_from && s.day_to === tSeg.day_to) {
          return { ...ct, is_default: false };
        }
        return ct;
      });
    });
  }

  /** When group range changes, update segments in state. */
  function handleGroupRangeChanged(groupKey: string, newFrom: number, newTo: number) {
    const parts   = groupKey.split("-");
    const oldFrom = parseInt(parts[0]);
    const oldTo   = parseInt(parts[1]);
    setCabTypes((prev) =>
      prev.map((ct) => {
        const seg = ct.segments[0];
        if (!seg || seg.day_from !== oldFrom || seg.day_to !== oldTo) return ct;
        return {
          ...ct,
          segments: ct.segments.map((s, i) =>
            i === 0 ? { ...s, day_from: newFrom, day_to: newTo } : s,
          ),
        };
      }),
    );
  }

  return (
    <Card className="mb-3">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Car className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Cab Options — {duration.label}</CardTitle>
            <Badge variant="outline" className="text-xs">{duration.nights}N / {duration.days}D</Badge>
            {groups.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {groups.length} group{groups.length !== 1 ? "s" : ""} · {cabTypes.length} option{cabTypes.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          {!addingGroup && (
            <Button
              size="sm" variant="outline" className="h-6 text-xs gap-1"
              onClick={() => setAddingGroup(true)}
            >
              <Plus className="h-3 w-3" />Add Cab Group
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pt-0 pb-3">
        {addingGroup && (
          <div className="mb-3">
            <AddCabTypeForm
              packageId={packageId}
              duration={duration}
              stopCoords={stopCoords}
              existingVehicleIds={new Set()}
              occupiedRanges={allGroupRanges}
              onAdded={(cts) => { setCabTypes((prev) => [...prev, ...cts]); setAddingGroup(false); }}
              onCancel={() => setAddingGroup(false)}
            />
          </div>
        )}

        {groups.length > 0 ? (
          groups.map((group) => (
            <CabGroupCard
              key={group.groupKey}
              group={group}
              packageId={packageId}
              duration={duration}
              stopCoords={stopCoords}
              otherGroupRanges={allGroupRanges.filter(
                (r) => !(r.from === group.dayFrom && r.to === group.dayTo),
              )}
              onGroupRangeChanged={handleGroupRangeChanged}
              onCabTypeDeleted={(id) => setCabTypes((prev) => prev.filter((ct) => ct.id !== id))}
              onCabTypeUpdated={(updated) =>
                setCabTypes((prev) => prev.map((ct) => ct.id === updated.id ? updated : ct))
              }
              onSetDefault={handleSetDefault}
              onOptionAdded={(ct) => setCabTypes((prev) => [...prev, ct])}
            />
          ))
        ) : !addingGroup && (
          <p className="text-xs text-muted-foreground py-3 text-center">
            No cab groups configured. Add one to give customers cab options for this duration.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── PermitRow ──────────────────────────────────────────────────────────────

function PermitRow({
  permit,
  packageId,
  cabTypes,
  onUpdated,
  onDeleted,
}: {
  permit: PackagePermit;
  packageId: number;
  cabTypes: CabType[];
  onUpdated: (updated: PackagePermit) => void;
  onDeleted: (id: number) => void;
}) {
  const [editing,   setEditing]   = useState(false);
  const [name,      setName]      = useState(permit.name);
  const [price,     setPrice]     = useState(String(permit.price));
  const [priceType, setPriceType] = useState<PermitPriceType>(permit.price_type);
  const [cabTypeId, setCabTypeId] = useState<number | null>(permit.cab_type_id);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const isTracking = permit.permit_id != null && permit.cab_type_id != null;
  const displayPrice = isTracking && permit.resolved_price != null ? permit.resolved_price : permit.price;

  function handleToggleIncluded(val: boolean) {
    startTransition(async () => {
      const res = await updatePackagePermit(permit.id, packageId, { is_included: val });
      if (res.success) {
        onUpdated({ ...permit, is_included: val });
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function startEdit() {
    setName(permit.name);
    setPrice(String(permit.price));
    setPriceType(permit.price_type);
    setCabTypeId(permit.cab_type_id);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setName(permit.name);
    setPrice(String(permit.price));
    setPriceType(permit.price_type);
    setCabTypeId(permit.cab_type_id);
  }

  function handleSaveEdit() {
    const p = parseFloat(price);
    if (!name.trim()) { toast.error("Enter a permit name"); return; }
    if (isNaN(p) || p < 0) { toast.error("Enter a valid non-negative price"); return; }
    startTransition(async () => {
      const res = await updatePackagePermit(permit.id, packageId, {
        name: name.trim(), price: p, price_type: priceType, cab_type_id: cabTypeId,
      });
      if (res.success) {
        toast.success("Permit updated");
        onUpdated({
          ...permit, name: name.trim(), price: p, price_type: priceType, cab_type_id: cabTypeId,
          resolved_price: res.data.resolved_price, resolved_vehicle_name: res.data.resolved_vehicle_name,
        });
        setEditing(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-3 transition-colors border-t first:border-t-0",
        !permit.is_included && "opacity-60",
      )}
    >
      <FileCheck2 className="h-4 w-4 text-primary shrink-0" />

      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-7 text-xs flex-1"
                placeholder="Permit name"
                disabled={isPending}
              />
              <div className="relative w-28 shrink-0">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
                <Input
                  type="number" min="0" step="1"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="h-7 text-xs pl-5"
                  placeholder="0"
                  disabled={isPending || cabTypeId != null}
                  title={cabTypeId != null ? "Price is resolved automatically from the tracked cab type's vehicle" : undefined}
                />
              </div>
              <Button
                type="button" size="sm"
                className="h-7 px-2.5 text-xs shrink-0 gap-1"
                onClick={handleSaveEdit}
                disabled={isPending}
              >
                {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Check className="h-3 w-3" />Save</>}
              </Button>
              <Button
                type="button" variant="ghost" size="sm"
                className="h-7 px-2 shrink-0"
                onClick={cancelEdit}
                disabled={isPending}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            {permit.permit_id != null && cabTypes.length > 0 ? (
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">
                  Track cab type <span className="text-muted-foreground/70">— untrack to set price manually</span>
                </Label>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button" disabled={isPending} onClick={() => setCabTypeId(null)}
                    className={cn("px-2 py-0.5 rounded text-[10px] font-medium border transition-colors",
                      cabTypeId === null ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-muted-foreground border-border hover:bg-muted/70")}
                  >
                    None (manual)
                  </button>
                  {cabTypes.map((ct) => (
                    <button
                      key={ct.id} type="button" disabled={isPending} onClick={() => setCabTypeId(ct.id)}
                      className={cn("px-2 py-0.5 rounded text-[10px] font-medium border transition-colors",
                        cabTypeId === ct.id ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted text-muted-foreground border-border hover:bg-muted/70")}
                    >
                      {cabTypeTrackLabel(ct)}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                {(["FLAT", "PER_PERSON", "PER_VEHICLE"] as const).map((t) => (
                  <button key={t} type="button" disabled={isPending} onClick={() => setPriceType(t)}
                    className={cn("px-2 py-0.5 rounded text-[10px] font-medium border transition-colors",
                      priceType === t ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-muted-foreground border-border hover:bg-muted/70"
                    )}>
                    {t === "FLAT" ? "Flat" : t === "PER_PERSON" ? "Per Person" : "Per Vehicle"}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-medium leading-tight">{permit.name}</span>
            <span className="text-[11px] text-muted-foreground">₹{fmt(displayPrice)}</span>
            {isTracking ? (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-orange-200 text-orange-600 bg-orange-50">
                {permit.resolved_price != null
                  ? `tracks ${permit.resolved_vehicle_name}`
                  : `no rate for ${permit.resolved_vehicle_name} — using fallback`}
              </Badge>
            ) : (
              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0",
                permit.price_type === "PER_PERSON"  ? "border-blue-200 text-blue-600 bg-blue-50"  :
                permit.price_type === "PER_VEHICLE" ? "border-orange-200 text-orange-600 bg-orange-50" :
                "border-muted text-muted-foreground"
              )}>
                {permit.price_type === "PER_PERSON" ? "×/person" : permit.price_type === "PER_VEHICLE" ? "×/vehicle" : "flat"}
              </Badge>
            )}
            {!permit.is_included && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Not included</Badge>
            )}
          </div>
        )}
      </div>

      {/* Included toggle */}
      {!editing && (
        <div className="flex items-center gap-1.5 shrink-0">
          <Label className="text-[10px] text-muted-foreground hidden sm:block">Included</Label>
          <Switch
            checked={permit.is_included}
            onCheckedChange={handleToggleIncluded}
            disabled={isPending}
          />
        </div>
      )}

      {/* Edit button */}
      {!editing && (
        <button
          type="button"
          onClick={startEdit}
          disabled={isPending}
          title="Edit permit"
          className="shrink-0 rounded-md p-1.5 text-muted-foreground/40 hover:bg-muted hover:text-foreground transition-colors disabled:cursor-not-allowed"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Delete */}
      {!editing && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              disabled={isPending}
              className="shrink-0 rounded-md p-1.5 text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive transition-colors disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Permit</AlertDialogTitle>
              <AlertDialogDescription>
                Remove <span className="font-semibold">{permit.name}</span> from this duration?
                This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  startTransition(async () => {
                    const res = await deletePackagePermit(permit.id, packageId);
                    if (res.success) { onDeleted(permit.id); router.refresh(); }
                    else toast.error(res.error);
                  });
                }}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

// ── AddPermitForm ──────────────────────────────────────────────────────────

/** "Sedan · Days 1-3" — label for the cab-type-tracking dropdown, built
 * from the same day-range grouping CabTypesSection uses. */
function cabTypeTrackLabel(ct: CabType): string {
  const seg = ct.segments[0];
  const range = seg ? ` · Days ${seg.day_from}-${seg.day_to}` : "";
  return `${ct.vehicle.name}${range}`;
}

function AddPermitForm({
  packageId,
  duration,
  stopCoords,
  cabTypes,
  onAdded,
  onCancel,
}: {
  packageId: number;
  duration: { id: number };
  stopCoords: Array<{ lat: number; lng: number; name?: string }>;
  cabTypes: CabType[];
  onAdded: (permit: PackagePermit) => void;
  onCancel: () => void;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedOption, setSelectedOption] = useState<PermitOption | null>(null);
  const [cabTypeId,  setCabTypeId]  = useState<number | null>(null);
  const [name,       setName]       = useState("");
  const [price,      setPrice]      = useState("");
  const [priceType,  setPriceType]  = useState<PermitPriceType>("FLAT");
  const [included,   setIncluded]   = useState(true);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Only offer to track a cab type when the picked permit actually has
  // per-vehicle rates AND this duration has cab types configured to match against.
  const canTrackCabType = !!selectedOption && selectedOption.vehicle_rates.length > 0 && cabTypes.length > 0;

  function applyCabTypeRate(option: PermitOption, ctId: number | null) {
    const ct = cabTypes.find((c) => c.id === ctId);
    const rate = ct ? option.vehicle_rates.find((vr) => vr.vehicle_id === ct.vehicle_id) : undefined;
    if (rate) {
      setPrice(String(rate.price_per_vehicle));
      setPriceType("PER_VEHICLE");
    } else if (option.price_per_person > 0) {
      setPrice(String(option.price_per_person));
      setPriceType("PER_PERSON");
    } else {
      setPrice(String(option.price_per_vehicle));
      setPriceType(option.price_per_vehicle > 0 ? "PER_VEHICLE" : "FLAT");
    }
  }

  function handleSelectPermit(option: PermitOption | null) {
    setSelectedId(option?.id ?? null);
    setSelectedOption(option);
    if (option) {
      setName(option.name);
      const hasRates = option.vehicle_rates.length > 0 && cabTypes.length > 0;
      const defaultCt = hasRates ? (cabTypes.find((c) => c.is_default) ?? cabTypes[0]) : null;
      setCabTypeId(defaultCt?.id ?? null);
      applyCabTypeRate(option, defaultCt?.id ?? null);
    } else {
      setCabTypeId(null);
    }
  }

  function handleCabTypeChange(ctId: number | null) {
    setCabTypeId(ctId);
    if (selectedOption) applyCabTypeRate(selectedOption, ctId);
  }

  const parsedPrice = parseFloat(price);
  const isValid = name.trim().length > 0 && price.trim().length > 0 && !isNaN(parsedPrice) && parsedPrice >= 0;

  function handleCreate() {
    if (!isValid) return;
    startTransition(async () => {
      const res = await createPackagePermit({
        package_id:  packageId,
        duration_id: duration.id,
        name:        name.trim(),
        price:       parsedPrice,
        price_type:  priceType,
        is_included: included,
        permit_id:   selectedId,
        cab_type_id: canTrackCabType ? cabTypeId : null,
      });
      if (res.success) {
        toast.success("Permit added");
        router.refresh();
        onAdded(res.data);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="px-4 py-3 border-t bg-muted/10 space-y-2">
      {/* Permit library dropdown — on select, auto-fills name + price */}
      <PermitSearchSelect
        stopCoords={stopCoords}
        value={selectedId}
        onSelect={handleSelectPermit}
        disabled={isPending}
      />

      {canTrackCabType && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            Track cab type <span className="text-muted-foreground/70 font-normal">— price follows this vehicle automatically</span>
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {cabTypes.map((ct) => (
              <button
                key={ct.id}
                type="button"
                disabled={isPending}
                onClick={() => handleCabTypeChange(ct.id)}
                className={cn(
                  "px-2 py-1 rounded text-[11px] font-medium border transition-colors",
                  cabTypeId === ct.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground border-border hover:bg-muted/70",
                )}
              >
                {cabTypeTrackLabel(ct)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Permit name"
            className="h-8 text-sm"
            disabled={isPending}
          />
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
            <Input
              type="number" min="0" step="1"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
              className="h-8 text-sm pl-6"
              disabled={isPending || canTrackCabType}
              title={canTrackCabType ? "Price is resolved automatically from the tracked cab type's vehicle" : undefined}
            />
          </div>
          {/* Price type */}
          {!canTrackCabType && (
            <div className="sm:col-span-2 flex items-center gap-1.5 flex-wrap">
              <Label className="text-xs text-muted-foreground shrink-0">Pricing:</Label>
              {(["FLAT", "PER_PERSON", "PER_VEHICLE"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  disabled={isPending}
                  onClick={() => setPriceType(t)}
                  className={cn(
                    "px-2 py-0.5 rounded text-[11px] font-medium border transition-colors",
                    priceType === t
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border hover:bg-muted/70",
                  )}
                >
                  {t === "FLAT" ? "Flat" : t === "PER_PERSON" ? "Per Person" : "Per Vehicle"}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 sm:col-span-2">
            <Switch checked={included} onCheckedChange={setIncluded} disabled={isPending} />
            <Label className="text-xs text-muted-foreground">
              Include in package cost calculation
            </Label>
          </div>
        </div>
        <div className="flex gap-1.5 pt-0.5 shrink-0">
          <Button type="button" variant="ghost" size="sm" className="h-8" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" size="sm" className="h-8 gap-1" onClick={handleCreate} disabled={!isValid || isPending}>
            {isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <><Check className="h-3 w-3" />Add</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── PermitsSection ─────────────────────────────────────────────────────────

function PermitsSection({
  packageId,
  duration,
  initialPermits,
  stopCoords,
  cabTypes,
}: {
  packageId: number;
  duration: Duration;
  initialPermits: PackagePermit[];
  stopCoords: Array<{ lat: number; lng: number; name?: string }>;
  cabTypes: CabType[];
}) {
  const [permits, setPermits] = useState(initialPermits);
  const [adding, setAdding] = useState(false);

  const includedTotal = permits
    .filter((p) => p.is_included)
    .reduce((sum, p) => sum + (p.permit_id != null && p.cab_type_id != null && p.resolved_price != null ? p.resolved_price : p.price), 0);

  return (
    <Card className="mb-3">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Permits — {duration.label}</CardTitle>
            <Badge variant="outline" className="text-xs">{duration.nights}N / {duration.days}D</Badge>
            {permits.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {permits.length} permit{permits.length !== 1 ? "s" : ""}
                {includedTotal > 0 ? ` · ₹${fmt(includedTotal)} included` : ""}
              </Badge>
            )}
          </div>
          {!adding && (
            <Button
              size="sm" variant="outline" className="h-6 text-xs gap-1"
              onClick={() => setAdding(true)}
            >
              <Plus className="h-3 w-3" />Add Permit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pt-0 pb-3">
        {permits.length === 0 && !adding ? (
          <p className="text-xs text-muted-foreground py-3 text-center">
            No permits configured for this duration.
          </p>
        ) : (
          permits.map((permit) => (
            <PermitRow
              key={permit.id}
              permit={permit}
              packageId={packageId}
              cabTypes={cabTypes}
              onUpdated={(updated) => setPermits((prev) => prev.map((p) => p.id === updated.id ? updated : p))}
              onDeleted={(id) => setPermits((prev) => prev.filter((p) => p.id !== id))}
            />
          ))
        )}

        {adding && (
          <AddPermitForm
            packageId={packageId}
            duration={duration}
            stopCoords={stopCoords}
            cabTypes={cabTypes}
            onAdded={(p) => { setPermits((prev) => [...prev, p]); setAdding(false); }}
            onCancel={() => setAdding(false)}
          />
        )}
      </CardContent>
    </Card>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function PricingTab({
  packageId,
  durations,
  stayCategories,
  initialPricings,
  cabTypes,
  permits,
  stopCoords,
}: PricingTabProps) {
  if (durations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 rounded-xl border border-dashed bg-muted/30">
        <Settings2 className="h-8 w-8 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">No durations found</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Add durations in the Route Builder tab first.
        </p>
      </div>
    );
  }

  if (stayCategories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 rounded-xl border border-dashed bg-muted/30">
        <Settings2 className="h-8 w-8 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">No stay categories found</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Add stay categories in the Itinerary Builder tab first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 bg-dashboard-base-100 p-8 rounded-xl shadow-lg border border-dashboard-base-content/20">
      {/* ── Margin & GST ── */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">Margin &amp; GST Configuration</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Set the base margin and GST rate for each duration &amp; stay category combination.
            The base margin applies on every date no season covers — use{" "}
            <span className="font-medium">Seasons</span> to charge a different margin over
            specific date ranges (peak, shoulder, off-season). Seasons repeat every year, so
            one set of dates keeps applying until you change it.
          </p>
        </div>

        <div className="flex items-center gap-3 px-4 py-2 bg-muted/40 rounded-lg text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <span className="w-36 shrink-0">Stay Category</span>
          <div className="flex items-center gap-2 flex-1">
            <span className="w-28 text-center">Base Margin %</span>
            <span className="w-5" />
            <span className="w-28 text-center">GST %</span>
          </div>
        </div>

        {durations.map((duration) => (
          <DurationMarginSection
            key={duration.id}
            packageId={packageId}
            duration={duration}
            stayCategories={stayCategories}
            pricings={initialPricings.filter((p) => p.duration_id === duration.id)}
          />
        ))}
      </div>

      {/* ── Cab Options ── */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Car className="h-4 w-4" /> Cab Options
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure cab groups for each duration. Each group covers a day range and contains
            one or more vehicle options customers can choose from. Only one option per group can
            be the default.
          </p>
        </div>

        {durations.map((duration) => (
          <CabTypesSection
            key={duration.id}
            packageId={packageId}
            duration={duration}
            initialCabTypes={cabTypes.filter((ct) => ct.duration_id === duration.id)}
            stopCoords={stopCoords}
          />
        ))}
      </div>

      {/* ── Permits ── */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <FileCheck2 className="h-4 w-4" /> Permits
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Add permits required for a duration&apos;s itinerary (e.g. wildlife sanctuary entry).
            When a permit is marked as included, its price is added to the package&apos;s base cost —
            margin and GST apply on top, and the total flows into the live price without a
            separate line item.
          </p>
        </div>

        {durations.map((duration) => (
          <PermitsSection
            key={duration.id}
            packageId={packageId}
            duration={duration}
            initialPermits={permits.filter((p) => p.duration_id === duration.id)}
            stopCoords={stopCoords}
            cabTypes={cabTypes.filter((ct) => ct.duration_id === duration.id)}
          />
        ))}
      </div>
    </div>
  );
}