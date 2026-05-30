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
  Loader2, Bed, Car, Zap, ChevronDown, ChevronRight, ChevronUp,
  Calculator, IndianRupee, Users, MapPin, CalendarDays, Sparkles,
  UtensilsCrossed, Hotel, Moon, TrendingUp, Percent, Receipt,
} from "lucide-react";
import { cn } from "@/app/lib/utils";
import { toast } from "sonner";
import { handleComputePackagePrice } from "@/app/actions/packages/pricing.actions";
import type {
  FullPricingBreakdown,
  DayPricingBreakdown,
  CabSegmentBreakdown,
} from "@/app/services/package-pricing.service";

// ── Types ──────────────────────────────────────────────────────────────────

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
  groupKey: string;
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

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return Math.round(n).toLocaleString("en-IN");
}

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function estimateCabCost(ct: CabTypePreview, travelDateStr: string, adults: number, children: number): number {
  const travelDate = travelDateStr ? new Date(travelDateStr) : null;
  let total = 0;
  for (const seg of ct.segments) {
    const segStartDate = travelDate
      ? new Date(travelDate.getTime() + (seg.day_from - 1) * 24 * 60 * 60 * 1000)
      : null;
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
          total += isWeekend ? weekendPrice : weekdayPrice;
        }
      } else {
        total += weekdayPrice * (seg.day_to - seg.day_from + 1);
      }
    }
  }
  return total;
}

function formatDayDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

// ── Chip badge ─────────────────────────────────────────────────────────────

function Chip({ children, color = "default" }: { children: React.ReactNode; color?: "blue" | "amber" | "green" | "slate" | "orange" | "violet" | "default" }) {
  const cls = {
    blue:   "bg-blue-50   border-blue-200   text-blue-700",
    amber:  "bg-amber-50  border-amber-200  text-amber-700",
    green:  "bg-green-50  border-green-200  text-green-700",
    slate:  "bg-slate-50  border-slate-200  text-slate-600",
    orange: "bg-orange-50 border-orange-200 text-orange-700",
    violet: "bg-violet-50 border-violet-200 text-violet-700",
    default:"bg-muted/60  border-border      text-muted-foreground",
  }[color];
  return (
    <span className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-none", cls)}>
      {children}
    </span>
  );
}

// ── Transfer row ────────────────────────────────────────────────────────────

function TransferRow({ transfer, cabCost }: {
  transfer: { id: number; pickup_name: string | null; drop_name: string | null; vehicle_name: string | null; distance_km: number | null };
  cabCost?: number;
}) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <div className="h-6 w-6 rounded-md flex items-center justify-center shrink-0 bg-orange-50 text-orange-600">
        <Car className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight truncate">
          {transfer.pickup_name && transfer.drop_name
            ? `${transfer.pickup_name} → ${transfer.drop_name}`
            : transfer.vehicle_name ?? "Transfer"}
        </p>
        {transfer.distance_km != null && (
          <p className="text-[10px] text-muted-foreground mt-0.5">{transfer.distance_km} km by road</p>
        )}
      </div>
      {cabCost != null && cabCost > 0 && (
        <span className="text-sm font-semibold text-orange-700 shrink-0">₹{fmt(cabCost)}</span>
      )}
    </div>
  );
}

// ── Day card ────────────────────────────────────────────────────────────────

function DayCard({ day }: { day: DayPricingBreakdown }) {
  const [open, setOpen] = useState(true);
  const included = day.activities.filter((a) => !a.is_optional);
  const optional = day.activities.filter((a) => a.is_optional);
  const hasContent = day.hotel || day.meals.length > 0 || included.length > 0 || optional.length > 0 || day.transfers.length > 0;

  return (
    <Card className="overflow-hidden border border-border/60 shadow-sm">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors text-left group"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-primary">{day.day}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-none truncate">{day.day_title}</p>
            {day.day_date && (
              <p className="text-[10px] text-muted-foreground mt-0.5">{formatDayDate(day.day_date)}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          {day.day_total > 0 && (
            <span className="text-sm font-bold text-foreground">₹{fmt(day.day_total)}</span>
          )}
          {open
            ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
            : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <CardContent className="px-4 pb-4 pt-0">
          <Separator className="mb-3" />
          {!hasContent && (
            <p className="text-xs text-muted-foreground/60 italic py-1">No items configured for this category on this day.</p>
          )}

          <div className="space-y-2">
            {/* ── Hotel ────────────────────────────────────────────────── */}
            {day.hotel ? (
              <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 space-y-2">
                {/* Hotel name + room */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-5 w-5 rounded bg-blue-100 flex items-center justify-center shrink-0">
                      <Hotel className="h-3 w-3 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-blue-900 leading-none">
                        {day.hotel.hotel_name}
                      </p>
                      {day.hotel.room_name && (
                        <p className="text-[10px] text-blue-600/80 mt-0.5">{day.hotel.room_name}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-bold text-blue-800 shrink-0">₹{fmt(day.hotel.total)}</span>
                </div>

                {/* Badge row */}
                <div className="flex flex-wrap gap-1">
                  <Chip color="blue">{day.hotel.rooms_count} room{day.hotel.rooms_count !== 1 ? "s" : ""}</Chip>
                  <Chip color="blue">₹{fmt(day.hotel.price_per_room)}/night</Chip>
                  <Chip color="blue">{day.hotel.num_nights} night{day.hotel.num_nights !== 1 ? "s" : ""}</Chip>
                  <Chip color="slate">
                    <Bed className="h-2.5 w-2.5 mr-0.5" />
                    {day.hotel.bed_capacity} bed{day.hotel.extra_bed_capacity > 0 ? ` + ${day.hotel.extra_bed_capacity} mattress` : ""}
                  </Chip>
                  {day.hotel.plan_name && <Chip color="slate">{day.hotel.plan_name}</Chip>}
                </div>

                {/* Mattress extra line */}
                {day.hotel.mattresses_count > 0 && (
                  <div className="flex items-center justify-between pt-1.5 border-t border-blue-100">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-blue-700 font-medium">Extra mattresses</span>
                      <div className="flex gap-1">
                        <Chip color="amber">{day.hotel.mattresses_count} mattress{day.hotel.mattresses_count !== 1 ? "es" : ""}</Chip>
                        <Chip color="amber">₹{fmt(day.hotel.extra_bed_rate)}/night</Chip>
                        <Chip color="amber">{day.hotel.num_nights} night{day.hotel.num_nights !== 1 ? "s" : ""}</Chip>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-amber-700">
                      ₹{fmt(day.hotel.mattresses_count * day.hotel.extra_bed_rate * day.hotel.num_nights)}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-muted-foreground/20 px-3 py-2">
                <p className="text-[10px] text-muted-foreground/50 italic">No stay mapped for this category</p>
              </div>
            )}

            {/* ── Meals ──────────────────────────────────────────────── */}
            {day.meals.length > 0 && (
              <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-3 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 flex items-center gap-1">
                  <UtensilsCrossed className="h-3 w-3" /> Meals
                </p>
                {day.meals.map((m, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                      <span className="text-xs font-medium text-amber-900">{m.label}</span>
                      <Chip color="amber">{m.hotel_name}</Chip>
                      <Chip color="amber">{m.persons} pax × ₹{fmt(m.price_per_person)}</Chip>
                    </div>
                    <span className="text-xs font-semibold text-amber-800 shrink-0">₹{fmt(m.total)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Activities ─────────────────────────────────────────── */}
            {(included.length > 0 || optional.length > 0) && (
              <div className="rounded-lg border border-green-100 bg-green-50/50 p-3 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-green-700 flex items-center gap-1">
                  <Zap className="h-3 w-3" /> Activities
                </p>

                {included.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                      <span className="text-xs font-medium text-green-900 truncate">{a.name}</span>
                      {a.pricing_type === "PER_GROUP" ? (
                        <Chip color="green">Flat rate</Chip>
                      ) : a.adult_price === 0 && a.child_price === 0 ? (
                        <Chip color="default">No pricing</Chip>
                      ) : (
                        <>
                          <Chip color="green">{a.adult_count} adult × ₹{fmt(a.adult_price)}</Chip>
                          {a.child_count > 0 && (
                            <Chip color="green">{a.child_count} child × ₹{fmt(a.child_price)}</Chip>
                          )}
                          {a.infant_count > 0 && a.infant_price > 0 && (
                            <Chip color="green">{a.infant_count} infant × ₹{fmt(a.infant_price)}</Chip>
                          )}
                        </>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-green-800 shrink-0">₹{fmt(a.total)}</span>
                  </div>
                ))}

                {optional.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 opacity-60">
                    <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                      <span className="text-xs font-medium text-foreground truncate">{a.name}</span>
                      <Chip color="default">Optional</Chip>
                      {a.adult_price > 0 && (
                        <Chip color="default">₹{fmt(a.adult_price)}{a.pricing_type !== "PER_GROUP" ? "/adult" : " flat"}</Chip>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">not included</span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Transfers / Cab ─────────────────────────────────────── */}
            {(day.transfers.length > 0 || day.cab_cost > 0) && (
              <div className="rounded-lg border border-orange-100 bg-orange-50/50 p-3 space-y-1">
                {day.transfers.map((t, idx) => (
                  <TransferRow
                    key={t.id}
                    transfer={t}
                    cabCost={idx === 0 ? day.cab_cost : undefined}
                  />
                ))}
                {day.transfers.length === 0 && day.cab_cost > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-5 rounded bg-orange-100 flex items-center justify-center">
                        <Car className="h-3 w-3 text-orange-600" />
                      </div>
                      <span className="text-sm font-medium text-orange-900">Cab</span>
                    </div>
                    <span className="text-sm font-semibold text-orange-700">₹{fmt(day.cab_cost)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ── Cab breakdown ─────────────────────────────────────────────────────────

function CabBreakdown({ segments }: { segments: CabSegmentBreakdown[] }) {
  const [open, setOpen] = useState(false);
  if (segments.length === 0) return null;
  const hasUpgrade = segments.some((s) => s.upgraded);

  return (
    <div>
      <button
        type="button"
        className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors mt-2"
        onClick={() => setOpen((p) => !p)}
      >
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {open ? "Hide" : "Show"} cab breakdown
        {hasUpgrade && (
          <Chip color="amber">↑ Upgraded</Chip>
        )}
      </button>
      {open && (
        <div className="mt-2 space-y-2 pl-2 border-l-2 border-orange-200">
          {segments.map((seg, i) => (
            <div key={i} className="space-y-1">
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-xs font-semibold text-foreground">{seg.vehicle_name}</span>
                <Chip color="orange">{seg.vehicle_capacity} seats</Chip>
                <Chip color="slate">Day {seg.day_from}–{seg.day_to}</Chip>
                <Chip color="slate">{seg.destination_name}</Chip>
                {seg.upgraded && (
                  <Chip color="amber">↑ from {seg.original_vehicle_name}</Chip>
                )}
                {seg.is_seasonal && (
                  <Chip color="violet"><Sparkles className="h-2 w-2 mr-0.5" />Seasonal</Chip>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                  {seg.pricing_type === "PER_DAY"
                    ? `₹${fmt(seg.price_used)}/day × ${seg.days} day${seg.days !== 1 ? "s" : ""}`
                    : `₹${fmt(seg.price_used)}/km × ${seg.km} km`}
                </span>
                <span className="text-xs font-semibold text-orange-700">₹{fmt(seg.total)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Summary card ─────────────────────────────────────────────────────────

function SummaryCard({ breakdown }: { breakdown: FullPricingBreakdown }) {
  const { adults, children, infants } = breakdown;
  const paxLabel = [
    `${adults} adult${adults !== 1 ? "s" : ""}`,
    children > 0 ? `${children} child${children !== 1 ? "ren" : ""}` : null,
    infants > 0 ? `${infants} infant${infants !== 1 ? "s" : ""}` : null,
  ].filter(Boolean).join(" · ");

  const rows: { icon: React.ReactNode; label: string; value: number; color: string }[] = [
    { icon: <Hotel className="h-3.5 w-3.5" />,         label: "Hotels",     value: breakdown.hotel_subtotal,    color: "text-blue-600"   },
    { icon: <UtensilsCrossed className="h-3.5 w-3.5" />, label: "Meals",    value: breakdown.meal_subtotal,     color: "text-amber-600"  },
    { icon: <Zap className="h-3.5 w-3.5" />,           label: "Activities", value: breakdown.activity_subtotal, color: "text-green-600"  },
    { icon: <Car className="h-3.5 w-3.5" />,           label: "Cab",        value: breakdown.cab_subtotal,      color: "text-orange-600" },
  ].filter((r) => r.value > 0);

  return (
    <Card className="border border-violet-200/60 shadow-sm sticky top-4">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-violet-100 bg-violet-50/50 rounded-t-xl">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="h-7 w-7 rounded-lg bg-violet-100 flex items-center justify-center">
            <IndianRupee className="h-4 w-4 text-violet-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-violet-900">Price Summary</p>
            <p className="text-[10px] text-violet-600/80">{breakdown.duration_label} · {breakdown.stay_category_label}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Users className="h-3 w-3 text-violet-500" />
          <span className="text-[10px] text-violet-700">{paxLabel}</span>
        </div>
      </div>

      <CardContent className="px-4 py-3 space-y-1">
        {/* Subtotals */}
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between py-1.5 rounded-lg px-2 hover:bg-muted/30 transition-colors">
            <span className={cn("flex items-center gap-2 text-sm text-muted-foreground", r.color)}>
              {r.icon}
              <span className="text-foreground/80">{r.label}</span>
            </span>
            <span className="text-sm font-medium">₹{fmt(r.value)}</span>
          </div>
        ))}

        {/* Cab segment breakdown */}
        {breakdown.cab_segments.length > 0 && (
          <div className="px-2">
            <CabBreakdown segments={breakdown.cab_segments} />
          </div>
        )}

        <Separator className="my-2" />

        {/* Base cost */}
        <div className="flex justify-between items-center py-1 px-2">
          <span className="text-sm font-semibold">Base Cost</span>
          <span className="text-sm font-bold">₹{fmt(breakdown.base_cost)}</span>
        </div>

        {/* Margin */}
        <div className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-blue-50/60">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
            Margin
            <Chip color="blue">{breakdown.margin_percentage}%</Chip>
          </span>
          <span className="text-xs font-medium text-blue-700">+ ₹{fmt(breakdown.margin_amount)}</span>
        </div>

        {/* GST */}
        <div className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-slate-50/60">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Percent className="h-3.5 w-3.5 text-slate-500" />
            GST
            <Chip color="slate">{breakdown.gst_percentage}%</Chip>
          </span>
          <span className="text-xs font-medium text-slate-700">+ ₹{fmt(breakdown.gst_amount)}</span>
        </div>

        <Separator className="my-2" />

        {/* Final price */}
        <div className="flex justify-between items-center px-2 py-1.5 rounded-lg bg-violet-50">
          <div className="flex items-center gap-1.5">
            <Receipt className="h-4 w-4 text-violet-600" />
            <span className="text-sm font-bold text-violet-900">Final Price</span>
          </div>
          <span className="text-lg font-bold text-violet-700">₹{fmt(breakdown.final_price)}</span>
        </div>

        {/* Per adult */}
        {adults > 0 && (
          <div className="flex justify-between items-center px-2 pt-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" /> Per Adult
            </span>
            <span className="text-sm font-semibold text-foreground">₹{fmt(breakdown.price_per_adult)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function PricingPreviewTab({ packageId, durations, stayCategories, cabTypes }: PricingPreviewTabProps) {
  const defaultDuration = durations.find((d) => d.is_default) ?? durations[0];
  const defaultCategory = stayCategories.find((c) => c.is_default) ?? stayCategories[0];

  const initDurationId = defaultDuration?.id.toString() ?? "";
  const initRouteId    = defaultDuration?.routes[0]?.id.toString() ?? "";
  const initCategoryId = defaultCategory?.id.toString() ?? "";

  const [durationId, setDurationId]       = useState(initDurationId);
  const [routeId, setRouteId]             = useState(initRouteId);
  const [categoryId, setCategoryId]       = useState(initCategoryId);
  const [groupCabSelections, setGroupCabSelections] = useState<Map<string, number | null>>(
    () => new Map(),
  );
  const [travelDate, setTravelDate] = useState(todayISODate());
  const [adults, setAdults]         = useState("1");
  const [children, setChildren]     = useState("0");
  const [infants, setInfants]       = useState("0");
  const [breakdown, setBreakdown]   = useState<FullPricingBreakdown | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedDuration = durations.find((d) => d.id.toString() === durationId);
  const routes = selectedDuration?.routes ?? [];

  const durationCabGroups = useMemo(
    () => groupCabTypesByRange(cabTypes.filter((ct) => ct.duration_id.toString() === durationId)),
    [durationId, cabTypes],
  );

  const adultsNum   = Math.max(1, parseInt(adults)   || 1);
  const childrenNum = Math.max(0, parseInt(children) || 0);

  // Reset route when duration changes
  useEffect(() => {
    setRouteId(routes[0]?.id.toString() ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationId]);

  // Auto-select optimal cab when passengers or duration groups change
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

  // Auto-calculate on mount
  useEffect(() => {
    if (!initDurationId || !initRouteId || !initCategoryId) return;
    startTransition(async () => {
      const result = await handleComputePackagePrice({
        package_id: packageId,
        duration_id: parseInt(initDurationId),
        route_id: parseInt(initRouteId),
        stay_category_id: parseInt(initCategoryId),
        adults: 1, children: 0, infants: 0,
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
      const selectedCabTypeIds = Array.from(groupCabSelections.values()).filter((id): id is number => id != null);
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
        toast.error((result as { error?: string }).error ?? "Failed to calculate price");
        setBreakdown(null);
      }
    });
  }

  const passengers = adultsNum + childrenNum;

  return (
    <div className="space-y-5">
      {/* ── Controls card ─────────────────────────────────────────────────── */}
      <Card className="border border-border/60 shadow-sm">
        <CardContent className="pt-4 pb-4 space-y-4">

          {/* Row 1: Trip config */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Trip Configuration</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Duration</label>
                <Select value={durationId} onValueChange={setDurationId}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {durations.map((d) => (
                      <SelectItem key={d.id} value={d.id.toString()}>
                        {d.label}{d.is_default ? " ★" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Route</label>
                <Select value={routeId} onValueChange={setRouteId} disabled={routes.length === 0}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder={routes.length === 0 ? "No routes" : "Select…"} />
                  </SelectTrigger>
                  <SelectContent>
                    {routes.map((r) => <SelectItem key={r.id} value={r.id.toString()}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Stay Category</label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {stayCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.label}{c.is_default ? " ★" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" /> Travel Date
                </label>
                <Input type="date" value={travelDate} onChange={(e) => setTravelDate(e.target.value)} className="h-9 text-sm" />
              </div>
            </div>
            {travelDate && (
              <p className="text-[10px] text-muted-foreground/70 mt-1.5 flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Seasonal &amp; weekend rates applied day-by-day from {travelDate}
              </p>
            )}
          </div>

          <Separator />

          {/* Row 2: Pax + Calculate */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Passengers</p>
            <div className="flex items-end gap-3 flex-wrap">
              <div className="space-y-1 w-24">
                <label className="text-xs text-muted-foreground">Adults</label>
                <Input type="number" min="1" max="500" value={adults} onChange={(e) => setAdults(e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-1 w-24">
                <label className="text-xs text-muted-foreground">Children</label>
                <Input type="number" min="0" max="500" value={children} onChange={(e) => setChildren(e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-1 w-24">
                <label className="text-xs text-muted-foreground">Infants</label>
                <Input type="number" min="0" max="100" value={infants} onChange={(e) => setInfants(e.target.value)} className="h-9 text-sm" />
              </div>
              <Button onClick={handleCalculate} disabled={!canCalculate || isPending} className="h-9 gap-2 px-6">
                {isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin" />Calculating…</>
                  : <><Calculator className="h-4 w-4" />Calculate</>}
              </Button>
              {passengers > 1 && (
                <div className="flex items-center gap-1.5 pb-0.5">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {passengers} total pax
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Cab selection */}
          {durationCabGroups.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Car className="h-3 w-3" /> Cab Selection
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {durationCabGroups.map((group) => {
                    const selectedId = groupCabSelections.get(group.groupKey) ?? null;
                    const selectedCt = group.cabTypes.find((ct) => ct.id === selectedId);
                    const defaultCt  = group.cabTypes.find((ct) => ct.is_default) ?? group.cabTypes[0];
                    const isUpgraded = selectedId !== null && selectedId !== defaultCt?.id;
                    const tooSmall   = selectedCt ? selectedCt.vehicle.capacity < passengers : false;

                    return (
                      <div key={group.groupKey} className={cn(
                        "rounded-lg border p-3 space-y-2 transition-colors",
                        isUpgraded ? "border-amber-200 bg-amber-50/40" : "border-border/60 bg-muted/20",
                      )}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Moon className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs font-semibold text-foreground">
                              Day {group.dayFrom}–{group.dayTo}
                            </span>
                          </div>
                          <div className="flex gap-1">
                            {isUpgraded && <Chip color="amber">↑ Upgraded</Chip>}
                            {tooSmall   && <Chip color="default">Too small</Chip>}
                          </div>
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
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Select cab…" />
                          </SelectTrigger>
                          <SelectContent>
                            {group.cabTypes.map((ct) => {
                              const est  = estimateCabCost(ct, travelDate, adultsNum, childrenNum);
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
                        {selectedCt && (
                          <div className="flex flex-wrap gap-1">
                            <Chip color="orange">{selectedCt.vehicle.capacity} seats</Chip>
                            {tooSmall && (
                              <Chip color="default">Needs {passengers - selectedCt.vehicle.capacity} more seats</Chip>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Loading ──────────────────────────────────────────────────────────── */}
      {isPending && (
        <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Computing price breakdown…</span>
        </div>
      )}

      {/* ── Results ──────────────────────────────────────────────────────────── */}
      {!isPending && breakdown && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          <div className="lg:col-span-2 space-y-3">
            {breakdown.missing_pricing_config && (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-2.5 flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-800">
                  No pricing config set for this combination — using default 10% margin and 5% GST. Configure in the Pricing tab.
                </p>
              </div>
            )}
            {breakdown.days.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-dashed">
                <MapPin className="h-8 w-8 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No itinerary days found</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Build the itinerary in the Itinerary Builder tab first.</p>
              </div>
            ) : (
              breakdown.days.map((day) => <DayCard key={day.day} day={day} />)
            )}
          </div>
          <div className="lg:col-span-1">
            <SummaryCard breakdown={breakdown} />
          </div>
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────────── */}
      {!isPending && !breakdown && (
        <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-dashed bg-muted/10">
          <Calculator className="h-10 w-10 text-muted-foreground/30 mb-4" />
          <p className="text-sm font-medium text-muted-foreground">Configure and calculate above</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Select duration, route, stay category, passenger count, then hit Calculate.</p>
        </div>
      )}
    </div>
  );
}
