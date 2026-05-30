"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "../../components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../components/ui/select";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Separator } from "../../components/ui/separator";
import {
  Loader2, Bed, Car, Zap, ChevronDown, ChevronRight,
  Calculator, IndianRupee, Users, MapPin, Baby, CalendarDays, Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import { handleComputePackagePrice } from "@/app/actions/packages/pricing.actions";
import type {
  FullPricingBreakdown,
  DayPricingBreakdown,
  CabSegmentBreakdown,
  DayMealLine,
} from "@/app/services/package-pricing.service";

// ── Props ──────────────────────────────────────────────────────────────────

type Duration = {
  id: number;
  label: string;
  days: number;
  nights: number;
  is_default?: boolean;
  routes: { id: number; name: string }[];
};
type StayCategory = { id: number; label: string; slug: string; is_default?: boolean };

type CabSeason = {
  id: number;
  valid_from: Date | string;
  valid_to: Date | string;
  pricing_type: string;
  weekday_price: number;
  weekend_price: number;
};

type CabTypePreview = {
  id: number;
  duration_id: number;
  label: string;
  is_default: boolean;
  vehicle: { id: number; name: string; capacity: number };
  segments: {
    day_from: number;
    day_to: number;
    pricing_type: string;
    price: number;
    destination_name: string;
    seasons: CabSeason[];
  }[];
};

type PricingPreviewTabProps = {
  packageId: number;
  durations: Duration[];
  stayCategories: StayCategory[];
  cabTypes: CabTypePreview[];
};

// ── Cab group helpers ──────────────────────────────────────────────────────

type CabGroup = {
  groupKey: string;  // `${dayFrom}-${dayTo}`
  dayFrom: number;
  dayTo: number;
  cabTypes: CabTypePreview[];
};

function groupCabTypesByRange(cabTypes: CabTypePreview[]): CabGroup[] {
  const map = new Map<string, CabGroup>();
  for (const ct of cabTypes) {
    const seg = ct.segments[0];
    if (!seg) continue;
    const key = `${seg.day_from}-${seg.day_to}`;
    if (!map.has(key)) {
      map.set(key, { groupKey: key, dayFrom: seg.day_from, dayTo: seg.day_to, cabTypes: [] });
    }
    map.get(key)!.cabTypes.push(ct);
  }
  return Array.from(map.values()).sort((a, b) => a.dayFrom - b.dayFrom);
}

/** Build initial group → selected cab type ID map (defaults to is_default entry per group). */
function initGroupSelections(
  cabTypes: CabTypePreview[],
  durationId: string,
): Map<string, number | null> {
  const durationCabs = cabTypes.filter((ct) => ct.duration_id.toString() === durationId);
  const groups = groupCabTypesByRange(durationCabs);
  const map = new Map<string, number | null>();
  for (const group of groups) {
    const defaultCt = group.cabTypes.find((ct) => ct.is_default) ?? group.cabTypes[0];
    map.set(group.groupKey, defaultCt?.id ?? null);
  }
  return map;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return Math.round(n).toLocaleString("en-IN");
}

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

/** Client-side estimated cab cost for a cab type (for showing in dropdown).
 *  Seasons use year-2000 placeholder dates — normalise travel date before comparing.
 *  For PER_DAY, compute per-day rates so weekends use the weekend price.
 */
function estimateCabCost(
  ct: CabTypePreview,
  travelDateStr: string,
  adults: number,
  children: number,
): number {
  const travelDate = travelDateStr ? new Date(travelDateStr) : null;
  const numVehicles = Math.ceil(Math.max(adults + children, 1) / Math.max(ct.vehicle.capacity, 1));
  let total = 0;

  for (const seg of ct.segments) {
    const segStartDate = travelDate
      ? new Date(travelDate.getTime() + (seg.day_from - 1) * 24 * 60 * 60 * 1000)
      : null;

    // Resolve season using year-agnostic month/day comparison
    let weekdayPrice = seg.price;
    let weekendPrice = seg.price;
    if (segStartDate) {
      const normalised = new Date(2000, segStartDate.getMonth(), segStartDate.getDate());
      const activeSeason = seg.seasons.find((s) => {
        const from = new Date(s.valid_from);
        const to = new Date(s.valid_to);
        const normFrom = new Date(2000, from.getMonth(), from.getDate());
        const normTo = new Date(2000, to.getMonth(), to.getDate());
        if (normFrom <= normTo) return normalised >= normFrom && normalised <= normTo;
        return normalised >= normFrom || normalised <= normTo;
      });
      if (activeSeason) {
        weekdayPrice = activeSeason.weekday_price;
        weekendPrice = activeSeason.weekend_price > 0 ? activeSeason.weekend_price : weekdayPrice;
      }
    }

    if (seg.pricing_type === "PER_DAY") {
      if (travelDate) {
        for (let d = seg.day_from; d <= seg.day_to; d++) {
          const dayDate = new Date(travelDate.getTime() + (d - 1) * 24 * 60 * 60 * 1000);
          const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
          total += (isWeekend ? weekendPrice : weekdayPrice) * numVehicles;
        }
      } else {
        total += weekdayPrice * (seg.day_to - seg.day_from + 1) * numVehicles;
      }
    }
    // PER_KM: can't estimate without km data client-side, skip
  }
  return total;
}

// ── Transfer route row — shows route info; first row also shows the per-day cab cost ──

function TransferRouteRow({
  transfer,
  cabCost,
}: {
  transfer: { id: number; pickup_name: string | null; drop_name: string | null; vehicle_name: string | null; distance_km: number | null };
  cabCost?: number;
}) {
  return (
    <div className="flex items-start gap-2.5 py-1">
      <div className="mt-0.5 h-6 w-6 rounded-md flex items-center justify-center shrink-0 bg-orange-50 text-orange-600">
        <Car className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight truncate">
          {transfer.pickup_name && transfer.drop_name
            ? `${transfer.pickup_name} → ${transfer.drop_name}`
            : transfer.vehicle_name ?? "Transfer"}
        </p>
        {transfer.distance_km != null && (
          <p className="text-xs text-muted-foreground">{transfer.distance_km} km by road</p>
        )}
      </div>
      {cabCost != null && cabCost > 0 && (
        <div className="text-sm font-semibold shrink-0 ml-2">₹{fmt(cabCost)}</div>
      )}
    </div>
  );
}

// ── Line item ──────────────────────────────────────────────────────────────

function LineItem({
  icon,
  label,
  detail,
  amount,
  variant,
}: {
  icon: React.ReactNode;
  label: string;
  detail: string;
  amount: number | null;
  variant: "hotel" | "meal" | "activity" | "optional";
}) {
  const chipCls = {
    hotel: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
    meal: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
    activity: "bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400",
    optional: "bg-muted text-muted-foreground",
  }[variant];

  return (
    <div className="flex items-start gap-2.5 py-1">
      <div className={`mt-0.5 h-6 w-6 rounded-md flex items-center justify-center shrink-0 ${chipCls}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight truncate">{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      <div className="text-sm font-semibold shrink-0 ml-2">
        {amount !== null ? (
          <span>₹{fmt(amount)}</span>
        ) : (
          <Badge variant="outline" className="text-xs font-normal">Optional</Badge>
        )}
      </div>
    </div>
  );
}

// ── Day card ───────────────────────────────────────────────────────────────

function formatDayDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayName = dayNames[d.getDay()];
  return `${dayName}, ${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
}

function DayCard({ day }: { day: DayPricingBreakdown }) {
  const [open, setOpen] = useState(true);

  const included = day.activities.filter((a) => !a.is_optional);
  const optional = day.activities.filter((a) => a.is_optional);

  const hasContent =
    day.hotel || day.meals.length > 0 || included.length > 0 || optional.length > 0 || day.transfers.length > 0;

  return (
    <Card className="overflow-hidden bg-dashboard-base-100 rounded-xl shadow-lg border border-dashboard-base-content/20">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <Badge variant="outline" className="text-xs shrink-0 bg-dashboard-primary text-dashboard-base-100">
            Day {day.day}
          </Badge>
          <span className="text-sm font-medium truncate">{day.day_title}</span>
          {day.day_date && (
            <span className="text-xs text-muted-foreground shrink-0 ml-1">
              · {formatDayDate(day.day_date)}
            </span>
          )}
        </div>
        <span className="text-sm font-bold ml-4 shrink-0">
          ₹{fmt(day.day_total)}
        </span>
      </button>

      {open && (
        <CardContent className="px-4 pb-3 pt-0 space-y-0.5">
          <Separator className="mb-3" />

          {!hasContent && (
            <p className="text-xs text-muted-foreground italic py-2">
              No items configured for this category on this day.
            </p>
          )}

          {/* Hotel */}
          {day.hotel ? (
            <>
              <LineItem
                icon={<Bed className="h-3.5 w-3.5" />}
                label={`${day.hotel.hotel_name}${day.hotel.room_name ? ` · ${day.hotel.room_name}` : ""}`}
                detail={[
                  `${day.hotel.rooms_count} room${day.hotel.rooms_count !== 1 ? "s" : ""} × ₹${fmt(day.hotel.price_per_room)}/night × ${day.hotel.num_nights} night${day.hotel.num_nights !== 1 ? "s" : ""}`,
                  `${day.hotel.bed_capacity} on bed${day.hotel.extra_bed_capacity > 0 ? ` +${day.hotel.extra_bed_capacity} mattress` : ""}/room`,
                  day.hotel.plan_name ?? null,
                ].filter(Boolean).join(" · ")}
                amount={day.hotel.rooms_count * day.hotel.price_per_room * day.hotel.num_nights}
                variant="hotel"
              />
              {day.hotel.mattresses_count > 0 && (
                <LineItem
                  icon={<Bed className="h-3.5 w-3.5" />}
                  label={`Extra mattress${day.hotel.mattresses_count !== 1 ? "es" : ""}`}
                  detail={`${day.hotel.mattresses_count} × ₹${fmt(day.hotel.extra_bed_rate)}/night × ${day.hotel.num_nights} night${day.hotel.num_nights !== 1 ? "s" : ""}`}
                  amount={day.hotel.mattresses_count * day.hotel.extra_bed_rate * day.hotel.num_nights}
                  variant="hotel"
                />
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground/70 italic py-1 pl-8">
              No stay mapped for this category
            </p>
          )}

          {/* Meals */}
          {day.meals.map((m, i) => (
            <LineItem
              key={i}
              icon={<UtensilsCrossed className="h-3.5 w-3.5" />}
              label={`${m.label} (${m.hotel_name})`}
              detail={`${m.persons} person${m.persons !== 1 ? "s" : ""} × ₹${fmt(m.price_per_person)}/person`}
              amount={m.total}
              variant="meal"
            />
          ))}

          {/* Included activities */}
          {included.map((a) => (
            <LineItem
              key={a.id}
              icon={<Zap className="h-3.5 w-3.5" />}
              label={a.name}
              detail={(() => {
                if (a.pricing_type === "PER_GROUP") return `Group rate (flat) · ₹${fmt(a.adult_price)}`;
                if (a.adult_price === 0 && a.child_price === 0) return "No pricing variant configured";
                return [
                  `${a.adult_count} adult${a.adult_count !== 1 ? "s" : ""} × ₹${fmt(a.adult_price)}`,
                  a.child_count > 0 ? `${a.child_count} child${a.child_count !== 1 ? "ren" : ""} × ₹${fmt(a.child_price)}` : null,
                  a.infant_count > 0 && a.infant_price > 0 ? `${a.infant_count} infant${a.infant_count !== 1 ? "s" : ""} × ₹${fmt(a.infant_price)}` : a.infant_count > 0 ? `${a.infant_count} infant${a.infant_count !== 1 ? "s" : ""} free` : null,
                ].filter(Boolean).join(" + ");
              })()}
              amount={a.total}
              variant="activity"
            />
          ))}

          {/* Optional activities */}
          {optional.map((a) => (
            <LineItem
              key={a.id}
              icon={<Zap className="h-3.5 w-3.5" />}
              label={a.name}
              detail={
                a.pricing_type === "PER_GROUP"
                  ? `Group rate ₹${fmt(a.adult_price)} · optional`
                  : a.adult_price > 0
                  ? `₹${fmt(a.adult_price)}/adult · not included in base`
                  : "Optional · pricing not configured"
              }
              amount={null}
              variant="optional"
            />
          ))}

          {/* Transfers — first row shows the per-day cab cost, rest show route only */}
          {day.transfers.map((t, idx) => (
            <TransferRouteRow
              key={t.id}
              transfer={t}
              cabCost={idx === 0 ? day.cab_cost : undefined}
            />
          ))}

          {/* If no transfers but cab cost exists (PER_KM without explicit transfers) */}
          {day.transfers.length === 0 && day.cab_cost > 0 && (
            <div className="flex items-start gap-2.5 py-1">
              <div className="mt-0.5 h-6 w-6 rounded-md flex items-center justify-center shrink-0 bg-orange-50 text-orange-600">
                <Car className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight">Cab</p>
              </div>
              <div className="text-sm font-semibold shrink-0 ml-2">₹{fmt(day.cab_cost)}</div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ── Cab breakdown expandable ───────────────────────────────────────────────

function CabBreakdown({ segments }: { segments: CabSegmentBreakdown[] }) {
  const [open, setOpen] = useState(false);
  if (segments.length === 0) return null;
  const hasUpgrade = segments.some((s) => s.upgraded);

  return (
    <div>
      <button
        type="button"
        className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors mt-1"
        onClick={() => setOpen((p) => !p)}
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {open ? "Hide" : "Show"} segment breakdown
        {hasUpgrade && !open && (
          <Badge variant="secondary" className="ml-1 text-[9px] px-1 py-0 gap-0.5 bg-amber-100 text-amber-700 border-amber-300">
            ↑ Upgraded
          </Badge>
        )}
      </button>
      {open && (
        <div className="mt-2 space-y-2 pl-1 border-l-2 border-orange-200">
          {segments.map((seg, i) => (
            <div key={i} className="text-xs text-muted-foreground space-y-0.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-medium text-foreground">
                  {seg.vehicle_name}
                </span>
                <span className="text-muted-foreground/60">({seg.vehicle_capacity} seats)</span>
                {seg.upgraded && (
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-amber-100 text-amber-700 border border-amber-300">
                    ↑ upgraded from {seg.original_vehicle_name}
                  </Badge>
                )}
                <span>· Day {seg.day_from}–{seg.day_to} · {seg.destination_name}</span>
                {seg.is_seasonal && (
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 gap-0.5">
                    <Sparkles className="h-2.5 w-2.5" />Seasonal
                  </Badge>
                )}
              </div>
              <div>
                {seg.pricing_type === "PER_DAY"
                  ? `₹${fmt(seg.price_used)}/day × ${seg.days} day${seg.days !== 1 ? "s" : ""}`
                  : `₹${fmt(seg.price_used)}/km × ${seg.km} km`}
                {" = "}<span className="font-semibold text-orange-700">₹{fmt(seg.total)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Summary card ───────────────────────────────────────────────────────────

function SummaryCard({ breakdown }: { breakdown: FullPricingBreakdown }) {
  const { adults, children, infants } = breakdown;

  return (
    <Card className="bg-linear-to-b from-violet-50/40 to-background sticky top-4 bg-dashboard-base-100 rounded-xl shadow-lg border border-violet-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <IndianRupee className="h-4 w-4 text-violet-600" />
          Price Summary
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {breakdown.duration_label} · {breakdown.stay_category_label}
        </p>
        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
          <Users className="h-3 w-3" />
          {adults} adult{adults !== 1 ? "s" : ""}
          {children > 0 ? `, ${children} child${children !== 1 ? "ren" : ""}` : ""}
          {infants > 0 ? `, ${infants} infant${infants !== 1 ? "s" : ""}` : ""}
        </p>
      </CardHeader>

      <CardContent className="space-y-2 pt-0">
        {/* Hotels */}
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Bed className="h-3.5 w-3.5 text-blue-500" />Hotels
          </span>
          <span>₹{fmt(breakdown.hotel_subtotal)}</span>
        </div>

        {/* Meals */}
        {breakdown.meal_subtotal > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <UtensilsCrossed className="h-3.5 w-3.5 text-amber-500" />Meals
            </span>
            <span>₹{fmt(breakdown.meal_subtotal)}</span>
          </div>
        )}

        {/* Activities */}
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Zap className="h-3.5 w-3.5 text-green-500" />Activities
          </span>
          <span>₹{fmt(breakdown.activity_subtotal)}</span>
        </div>

        {/* Cab */}
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Car className="h-3.5 w-3.5 text-orange-500" />
            {breakdown.cab_type_label ? `Cab — ${breakdown.cab_type_label}` : "Cab"}
          </span>
          <span>₹{fmt(breakdown.cab_subtotal)}</span>
        </div>

        {/* Segment breakdown (expandable) */}
        {breakdown.cab_segments.length > 0 && (
          <CabBreakdown segments={breakdown.cab_segments} />
        )}

        <Separator />

        {/* Base cost */}
        <div className="flex justify-between text-sm font-semibold">
          <span>Base Cost</span>
          <span>₹{fmt(breakdown.base_cost)}</span>
        </div>

        {/* Margin */}
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Margin ({breakdown.margin_percentage}%)</span>
          <span className="text-foreground">+ ₹{fmt(breakdown.margin_amount)}</span>
        </div>

        {/* GST */}
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>GST ({breakdown.gst_percentage}%)</span>
          <span className="text-foreground">+ ₹{fmt(breakdown.gst_amount)}</span>
        </div>

        <Separator />

        {/* Final price */}
        <div className="flex justify-between text-base font-bold">
          <span>Final Price</span>
          <span className="text-violet-700">₹{fmt(breakdown.final_price)}</span>
        </div>

        {/* Per adult */}
        {adults > 0 && (
          <div className="flex justify-between text-sm text-muted-foreground border-t pt-2 mt-1">
            <span>Per Adult</span>
            <span className="font-medium text-foreground">₹{fmt(breakdown.price_per_adult)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function PricingPreviewTab({
  packageId,
  durations,
  stayCategories,
  cabTypes,
}: PricingPreviewTabProps) {
  const defaultDuration = durations.find((d) => d.is_default) ?? durations[0];
  const defaultCategory = stayCategories.find((c) => c.is_default) ?? stayCategories[0];

  const initDurationId = defaultDuration?.id.toString() ?? "";
  const initRouteId = defaultDuration?.routes[0]?.id.toString() ?? "";
  const initCategoryId = defaultCategory?.id.toString() ?? "";

  const [durationId, setDurationId] = useState(initDurationId);
  const [routeId, setRouteId] = useState(initRouteId);
  const [categoryId, setCategoryId] = useState(initCategoryId);
  const [groupCabSelections, setGroupCabSelections] = useState<Map<string, number | null>>(
    () => initGroupSelections(cabTypes, initDurationId),
  );
  const [travelDate, setTravelDate] = useState(todayISODate());
  const [adults, setAdults] = useState("1");
  const [children, setChildren] = useState("0");
  const [infants, setInfants] = useState("0");
  const [breakdown, setBreakdown] = useState<FullPricingBreakdown | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedDuration = durations.find((d) => d.id.toString() === durationId);
  const routes = selectedDuration?.routes ?? [];

  // Cab groups for selected duration — memoised so effects can safely depend on it
  const durationCabGroups = useMemo(
    () => groupCabTypesByRange(cabTypes.filter((ct) => ct.duration_id.toString() === durationId)),
    [durationId, cabTypes],
  );

  const adultsNum = Math.max(1, parseInt(adults) || 1);
  const childrenNum = Math.max(0, parseInt(children) || 0);

  // Reset route when duration changes
  useEffect(() => {
    setRouteId(routes[0]?.id.toString() ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationId]);

  // Auto-select optimal cab whenever passengers or duration groups change.
  // Picks the smallest cab per group whose capacity >= adults + children.
  // Falls back to the largest available if no single cab fits.
  useEffect(() => {
    const passengers = adultsNum + childrenNum;
    setGroupCabSelections(() => {
      const map = new Map<string, number | null>();
      for (const group of durationCabGroups) {
        const sorted = [...group.cabTypes].sort((a, b) => a.vehicle.capacity - b.vehicle.capacity);
        const optimal = sorted.find((ct) => ct.vehicle.capacity >= passengers) ?? sorted[sorted.length - 1];
        map.set(group.groupKey, optimal?.id ?? null);
      }
      return map;
    });
  }, [adultsNum, childrenNum, durationCabGroups]);

  // Auto-calculate on mount with defaults
  useEffect(() => {
    if (!initDurationId || !initRouteId || !initCategoryId) return;
    startTransition(async () => {
      const result = await handleComputePackagePrice({
        package_id: packageId,
        duration_id: parseInt(initDurationId),
        route_id: parseInt(initRouteId),
        stay_category_id: parseInt(initCategoryId),
        adults: 1,
        children: 0,
        infants: 0,
        travel_date: todayISODate(),
      });
      if (result.success) setBreakdown(result.data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canCalculate = !!(durationId && routeId && categoryId);

  function handleCalculate() {
    if (!canCalculate) return;
    startTransition(async () => {
      const selectedCabTypeIds = Array.from(groupCabSelections.values()).filter(
        (id): id is number => id != null,
      );
      const result = await handleComputePackagePrice({
        package_id: packageId,
        duration_id: parseInt(durationId),
        route_id: parseInt(routeId),
        stay_category_id: parseInt(categoryId),
        adults: adultsNum,
        children: childrenNum,
        infants: Math.max(0, parseInt(infants) || 0),
        cab_type_ids: selectedCabTypeIds.length > 0 ? selectedCabTypeIds : null,
        travel_date: travelDate || null,
      });
      if (result.success) {
        setBreakdown(result.data);
      } else {
        toast.error(result.error ?? "Failed to calculate price");
        setBreakdown(null);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* ── Controls ───────────────────────────────────────────────────────── */}
      <Card className="bg-dashboard-base-100 rounded-xl shadow-lg border border-dashboard-base-content/20">
        <CardContent className="pt-5 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 items-end">
            {/* Duration */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Duration</label>
              <Select value={durationId} onValueChange={setDurationId}>
                <SelectTrigger className="text-sm h-9"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {durations.map((d) => (
                    <SelectItem key={d.id} value={d.id.toString()}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Route */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Route</label>
              <Select value={routeId} onValueChange={setRouteId} disabled={routes.length === 0}>
                <SelectTrigger className="text-sm h-9">
                  <SelectValue placeholder={routes.length === 0 ? "No routes" : "Select…"} />
                </SelectTrigger>
                <SelectContent>
                  {routes.map((r) => (
                    <SelectItem key={r.id} value={r.id.toString()}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Stay category */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Stay Category</label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="text-sm h-9"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {stayCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Travel Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />Travel Date
              </label>
              <Input
                type="date"
                value={travelDate}
                onChange={(e) => setTravelDate(e.target.value)}
                className="text-sm h-9"
              />
            </div>

            {/* Adults */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Adults</label>
              <Input type="number" min="1" max="20" value={adults} onChange={(e) => setAdults(e.target.value)} className="text-sm h-9" />
            </div>

            {/* Children */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Children</label>
              <Input type="number" min="0" max="20" value={children} onChange={(e) => setChildren(e.target.value)} className="text-sm h-9" />
            </div>

            {/* Infants */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Infants</label>
              <Input type="number" min="0" max="10" value={infants} onChange={(e) => setInfants(e.target.value)} className="text-sm h-9" />
            </div>

            {/* Calculate */}
            <Button
              onClick={handleCalculate}
              disabled={!canCalculate || isPending}
              className="h-9 w-full gap-2"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
              {isPending ? "Calculating…" : "Calculate"}
            </Button>
          </div>
          {travelDate && (
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              Start date — each day&apos;s hotel, activity &amp; cab rates are resolved to the actual calendar date (Day 1 = {travelDate}, Day 2 = next day, …) including weekend pricing
            </p>
          )}

          {/* ── Cab Group Selections ───────────────────────────────────── */}
          {durationCabGroups.length > 0 ? (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
                <Car className="h-3 w-3" />
                Cab Selection
                {durationCabGroups.length > 1 && (
                  <span className="font-normal text-muted-foreground/70">— one per group</span>
                )}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {durationCabGroups.map((group) => {
                  const passengers = adultsNum + childrenNum;
                  const selectedId = groupCabSelections.get(group.groupKey) ?? null;
                  const selectedCt = group.cabTypes.find((ct) => ct.id === selectedId);
                  const defaultCt = group.cabTypes.find((ct) => ct.is_default) ?? group.cabTypes[0];
                  const isUpgraded = selectedId !== null && selectedId !== defaultCt?.id;
                  const tooSmall = selectedCt ? selectedCt.vehicle.capacity < passengers : false;

                  return (
                    <div key={group.groupKey} className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs text-muted-foreground">
                          Day {group.dayFrom}–{group.dayTo}
                        </label>
                        {isUpgraded && (
                          <Badge className="text-[9px] px-1.5 py-0 h-4 bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-100">
                            ↑ Upgraded
                          </Badge>
                        )}
                        {tooSmall && (
                          <Badge className="text-[9px] px-1.5 py-0 h-4 bg-red-100 text-red-700 border border-red-300 hover:bg-red-100">
                            Too small
                          </Badge>
                        )}
                      </div>
                      <Select
                        value={selectedId?.toString() ?? ""}
                        onValueChange={(val) =>
                          setGroupCabSelections((prev) => {
                            const next = new Map(prev);
                            next.set(group.groupKey, parseInt(val));
                            return next;
                          })
                        }
                      >
                        <SelectTrigger className="text-sm h-9">
                          <SelectValue placeholder="Select cab…" />
                        </SelectTrigger>
                        <SelectContent>
                          {group.cabTypes.map((ct) => {
                            const est = estimateCabCost(ct, travelDate, adultsNum, childrenNum);
                            const fits = ct.vehicle.capacity >= passengers;
                            return (
                              <SelectItem key={ct.id} value={ct.id.toString()}>
                                {ct.label} · {ct.vehicle.capacity} seats
                                {ct.is_default ? " ★" : ""}
                                {!fits ? " ✗" : ""}
                                {est > 0 ? ` · ₹${fmt(est)}` : ""}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Car className="h-3 w-3" />
                No cab types configured for this duration. Add them in the Pricing tab.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Loading ─────────────────────────────────────────────────────────── */}
      {isPending && (
        <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Computing price breakdown…</span>
        </div>
      )}

      {/* ── Results ─────────────────────────────────────────────────────────── */}
      {!isPending && breakdown && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Day cards */}
          <div className="lg:col-span-2 space-y-3">
            {breakdown.missing_pricing_config && (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-2.5 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300">
                No pricing config set for this duration + stay category — using default 10% margin and 5% GST. Go to the Pricing tab to configure.
              </div>
            )}
            {breakdown.days.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-dashed">
                <MapPin className="h-8 w-8 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No itinerary days found</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Build the itinerary for this duration &amp; route in the Itinerary Builder tab.
                </p>
              </div>
            ) : (
              breakdown.days.map((day) => <DayCard key={day.day} day={day} />)
            )}
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <SummaryCard breakdown={breakdown} />
          </div>
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────────────── */}
      {!isPending && !breakdown && (
        <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-dashed bg-muted/20">
          <Calculator className="h-10 w-10 text-muted-foreground/30 mb-4" />
          <p className="text-sm font-medium text-muted-foreground">No defaults configured yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Select a duration, route, and stay category above, then click Calculate.
          </p>
        </div>
      )}
    </div>
  );
}
