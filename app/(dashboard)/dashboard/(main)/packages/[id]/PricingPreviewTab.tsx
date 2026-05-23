"use client";

import { useState, useTransition, useEffect } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { handleComputePackagePrice } from "@/app/actions/packages/pricing.actions";
import type {
  FullPricingBreakdown,
  DayPricingBreakdown,
  CabSegmentBreakdown,
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

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return Math.round(n).toLocaleString("en-IN");
}

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

/** Client-side estimated cab cost for a cab type (for showing in dropdown) */
function estimateCabCost(
  ct: CabTypePreview,
  travelDateStr: string,
  adults: number,
  children: number,
): number {
  const travelDate = travelDateStr ? new Date(travelDateStr) : null;
  let total = 0;
  for (const seg of ct.segments) {
    let price = seg.price;
    if (travelDate) {
      const activeSeason = seg.seasons.find((s) => {
        const from = new Date(s.valid_from);
        const to = new Date(s.valid_to);
        from.setHours(0, 0, 0, 0);
        to.setHours(23, 59, 59, 999);
        return travelDate >= from && travelDate <= to;
      });
      if (activeSeason) {
        const isWeekend = travelDate.getDay() === 0 || travelDate.getDay() === 6;
        price = isWeekend ? activeSeason.weekend_price : activeSeason.weekday_price;
      }
    }
    const numVehicles = Math.ceil(Math.max(adults + children, 1) / Math.max(ct.vehicle.capacity, 1));
    if (seg.pricing_type === "PER_DAY") {
      total += price * (seg.day_to - seg.day_from + 1) * numVehicles;
    }
    // PER_KM: we can't estimate without km data client-side, skip
  }
  return total;
}

// ── Transfer line (included badge) ────────────────────────────────────────

function TransferIncludedRow({ transfer }: { transfer: { id: number; pickup_name: string | null; drop_name: string | null; vehicle_name: string | null; distance_km: number | null } }) {
  return (
    <div className="flex items-start gap-2.5 py-1">
      <div className="mt-0.5 h-6 w-6 rounded-md flex items-center justify-center shrink-0 bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400">
        <Car className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight truncate">
          {transfer.pickup_name && transfer.drop_name
            ? `${transfer.pickup_name} → ${transfer.drop_name}`
            : transfer.vehicle_name ?? "Transfer"}
        </p>
        <p className="text-xs text-muted-foreground">
          {[transfer.vehicle_name, transfer.distance_km ? `${transfer.distance_km} km` : null].filter(Boolean).join(" · ")}
        </p>
      </div>
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 text-orange-600 border-orange-200">
        Included in cab
      </Badge>
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
  variant: "hotel" | "activity" | "optional";
}) {
  const chipCls = {
    hotel: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
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

function DayCard({ day }: { day: DayPricingBreakdown }) {
  const [open, setOpen] = useState(true);

  const included = day.activities.filter((a) => !a.is_optional);
  const optional = day.activities.filter((a) => a.is_optional);

  const hasContent =
    day.hotel || included.length > 0 || optional.length > 0 || day.transfers.length > 0;

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
                  `${day.hotel.rooms_count} room${day.hotel.rooms_count !== 1 ? "s" : ""} × ₹${fmt(day.hotel.price_per_room)}/night`,
                  `max ${day.hotel.max_occupancy} pax/room`,
                  day.hotel.plan_name ?? null,
                ].filter(Boolean).join(" · ")}
                amount={day.hotel.rooms_count * day.hotel.price_per_room}
                variant="hotel"
              />
              {day.hotel.child_charge > 0 && (
                <LineItem
                  icon={<Users className="h-3.5 w-3.5" />}
                  label="Child charges"
                  detail="Hotel child policy per night"
                  amount={day.hotel.child_charge}
                  variant="hotel"
                />
              )}
              {day.hotel.infant_charge > 0 && (
                <LineItem
                  icon={<Baby className="h-3.5 w-3.5" />}
                  label="Infant charges"
                  detail="Hotel infant policy per night"
                  amount={day.hotel.infant_charge}
                  variant="hotel"
                />
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground/70 italic py-1 pl-8">
              No stay mapped for this category
            </p>
          )}

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

          {/* Transfers — display only */}
          {day.transfers.map((t) => (
            <TransferIncludedRow key={t.id} transfer={t} />
          ))}
        </CardContent>
      )}
    </Card>
  );
}

// ── Cab breakdown expandable ───────────────────────────────────────────────

function CabBreakdown({ segments }: { segments: CabSegmentBreakdown[] }) {
  const [open, setOpen] = useState(false);
  if (segments.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors mt-1"
        onClick={() => setOpen((p) => !p)}
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {open ? "Hide" : "Show"} segment breakdown
      </button>
      {open && (
        <div className="mt-2 space-y-1.5 pl-1 border-l-2 border-orange-200">
          {segments.map((seg, i) => (
            <div key={i} className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Day {seg.day_from}–{seg.day_to}</span>
              {" · "}{seg.destination_name}
              {" · "}{seg.pricing_type === "PER_DAY" ? "Per Day" : "Per Km"}
              {seg.is_seasonal && (
                <Badge variant="secondary" className="ml-1 text-[9px] px-1 py-0 gap-0.5">
                  <Sparkles className="h-2.5 w-2.5" />Seasonal
                </Badge>
              )}
              <br />
              {seg.pricing_type === "PER_DAY"
                ? `₹${fmt(seg.price_used)} × ${seg.days} day${seg.days !== 1 ? "s" : ""} × ${seg.num_vehicles} cab${seg.num_vehicles !== 1 ? "s" : ""}`
                : `₹${fmt(seg.price_used)}/km × ${seg.km} km × ${seg.num_vehicles} cab${seg.num_vehicles !== 1 ? "s" : ""}`}
              {" = "}<span className="font-semibold text-orange-700">₹{fmt(seg.total)}</span>
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
    <Card className="border-violet-200 bg-linear-to-b from-violet-50/40 to-background sticky top-4 bg-dashboard-base-100 rounded-xl shadow-lg border border-dashboard-base-content/20">
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
  const [cabTypeId, setCabTypeId] = useState<string>("default");
  const [travelDate, setTravelDate] = useState(todayISODate());
  const [adults, setAdults] = useState("1");
  const [children, setChildren] = useState("0");
  const [infants, setInfants] = useState("0");
  const [breakdown, setBreakdown] = useState<FullPricingBreakdown | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedDuration = durations.find((d) => d.id.toString() === durationId);
  const routes = selectedDuration?.routes ?? [];

  // Cab types filtered by selected duration
  const durationCabTypes = cabTypes.filter((ct) => ct.duration_id.toString() === durationId);
  const defaultCabType = durationCabTypes.find((ct) => ct.is_default) ?? durationCabTypes[0];

  const adultsNum = Math.max(1, parseInt(adults) || 1);
  const childrenNum = Math.max(0, parseInt(children) || 0);

  // Reset route + cab type when duration changes
  useEffect(() => {
    setRouteId(routes[0]?.id.toString() ?? "");
    setCabTypeId("default");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationId]);

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
      const selectedCabTypeId = cabTypeId !== "default" ? parseInt(cabTypeId) : null;
      const result = await handleComputePackagePrice({
        package_id: packageId,
        duration_id: parseInt(durationId),
        route_id: parseInt(routeId),
        stay_category_id: parseInt(categoryId),
        adults: adultsNum,
        children: childrenNum,
        infants: Math.max(0, parseInt(infants) || 0),
        cab_type_id: selectedCabTypeId,
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-3 items-end">
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

            {/* Cab Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Cab Type</label>
              <Select
                value={cabTypeId}
                onValueChange={setCabTypeId}
                disabled={durationCabTypes.length === 0}
              >
                <SelectTrigger className="text-sm h-9">
                  <SelectValue placeholder={durationCabTypes.length === 0 ? "None configured" : "Select…"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">
                    {defaultCabType ? `${defaultCabType.label} (default)` : "Default"}
                  </SelectItem>
                  {durationCabTypes.map((ct) => {
                    const est = estimateCabCost(ct, travelDate, adultsNum, childrenNum);
                    return (
                      <SelectItem key={ct.id} value={ct.id.toString()}>
                        {ct.label}
                        {ct.is_default ? " ★" : ""}
                        {est > 0 ? ` · est. ₹${fmt(est)}` : ""}
                      </SelectItem>
                    );
                  })}
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
              Travel date used for seasonal cab pricing lookup
            </p>
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
