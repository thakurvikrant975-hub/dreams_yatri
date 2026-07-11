"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { cn } from "@/app/lib/utils";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  NoSymbolIcon,
  TagIcon,
  ListBulletIcon,
} from "@heroicons/react/24/outline";
import { fetchRoomCalendar, saveAvailabilityRange, type RangePatch } from "./calendar-actions";
import { getRoomRateDetail, saveRoomRates, type RoomRateDetail, type RoomRatesPatch } from "../rates/[roomId]/rate-actions";
import { occupancyTiers } from "../rates/rate-fields";
import { SearchSelect } from "@/app/(hotel-connect)/hotel-connect/(main)/components/ui/search-select";
import { Input } from "@/app/(hotel-connect)/hotel-connect/(main)/components/ui/input";
import { Label } from "@/app/(hotel-connect)/hotel-connect/(main)/components/ui/label";
import SectionCard from "@/app/(hotel-connect)/hotel-connect/(main)/components/SectionCard";
import { Card } from "@/app/components/ui/Card";
import { Button, buttonVariants } from "@/app/components/ui/Button";

type DayCell = {
  date: string;
  totalUnits: number;
  bookedUnits: number;
  available: number;
  stopSell: boolean;
  priceOverride: number | null;
  minLos: number | null;
  maxLos: number | null;
  closedToArrival: boolean;
  closedToDeparture: boolean;
  price: number | null;
  priceSource: string;
  planName: string | null;
};

type RatePlanOption = { id: number; label: string };
type Room = { id: number; name: string; num_rooms: number; max_adults: number; plans: RatePlanOption[] };

// ── Per-plan pricing form state (bulk edit) ───────────────────────────────────

type PlanFormState = {
  basePrice: string;
  occupancyPrices: Record<number, string>;
  childRate: string;
  extraAdultRate: string;
};

const EMPTY_PLAN_FORM: PlanFormState = { basePrice: "", occupancyPrices: {}, childRate: "", extraAdultRate: "" };

function detailToFormState(detail: RoomRateDetail): PlanFormState {
  const occupancyPrices: Record<number, string> = {};
  for (const [occStr, price] of Object.entries(detail.occupancyPrices)) {
    occupancyPrices[Number(occStr)] = price != null ? String(price) : "";
  }
  return {
    basePrice: detail.basePrice != null ? String(detail.basePrice) : "",
    occupancyPrices,
    childRate: detail.childRate != null ? String(detail.childRate) : "",
    extraAdultRate: detail.extraAdultRate != null ? String(detail.extraAdultRate) : "",
  };
}

type PlanRatesPatch = { planId: number; input: RoomRatesPatch };

function MoneyTile({
  label, value, onChange, placeholder = "Enter",
}: {
  label: string; value: string; onChange: (raw: string) => void; placeholder?: string;
}) {
  const inputId = useId();
  return (
    <div className="space-y-1">
      <Label htmlFor={inputId}>{label}</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm pointer-events-none">₹</span>
        <Input
          id={inputId}
          type="number" min={0} step="1"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pl-7 h-9 text-sm"
        />
      </div>
    </div>
  );
}

function PlanRateCard({
  maxAdults, value, loading, onChange,
}: {
  maxAdults: number;
  value: PlanFormState;
  loading: boolean;
  onChange: (patch: Partial<PlanFormState>) => void;
}) {
  const tiers = occupancyTiers(maxAdults);
  return (
    <Card variant="default" radius="sm" padding="sm" className="space-y-2.5">
      {loading ? (
        <p className="text-[11px] text-neutral-400">Loading current rates…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <MoneyTile label="2 Adults (Base)" value={value.basePrice} onChange={(v) => onChange({ basePrice: v })} placeholder="Leave blank to skip" />
            {tiers.map((n) => (
              <MoneyTile
                key={n}
                label={`${n} Adult${n === 1 ? "" : "s"}`}
                value={value.occupancyPrices[n] ?? ""}
                onChange={(v) => onChange({ occupancyPrices: { ...value.occupancyPrices, [n]: v } })}
              />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-100">
            <MoneyTile label="Per Child (7-17y)" value={value.childRate} onChange={(v) => onChange({ childRate: v })} />
            <MoneyTile label="Extra Adult" value={value.extraAdultRate} onChange={(v) => onChange({ extraAdultRate: v })} />
          </div>
        </>
      )}
    </Card>
  );
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pad = (n: number) => String(n).padStart(2, "0");
const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const todayISO = new Date().toISOString().slice(0, 10);

function yearBounds(year: number) {
  return { from: `${year}-01-01`, toExclusive: `${year + 1}-01-01` };
}

// ── One month's grid — no per-month weekday header, that's rendered once ──────

function MonthGrid({
  year,
  month0,
  byDate,
  rangeLo,
  rangeHi,
  onClickDay,
  gridRef,
}: {
  year: number;
  month0: number;
  byDate: Map<string, DayCell>;
  rangeLo: string | null;
  rangeHi: string | null;
  onClickDay: (date: string) => void;
  gridRef?: (el: HTMLDivElement | null) => void;
}) {
  const daysInMonth = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(year, month0, 1)).getUTCDay();
  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${year}-${pad(month0 + 1)}-${pad(i + 1)}`),
  ];

  function inRange(date: string) {
    return rangeLo != null && rangeHi != null && date >= rangeLo && date <= rangeHi;
  }

  return (
    <div ref={gridRef}>
      <p className="text-sm font-semibold text-neutral-800 px-4 pt-4 pb-2">{MONTHS[month0]} {year}</p>
      <div className="grid grid-cols-7">
        {cells.map((date, i) => {
          if (!date) return <div key={`b${i}`} className="aspect-square border-b border-r border-neutral-50" />;
          const cell = byDate.get(date);
          const dayNum = Number(date.slice(8, 10));
          const past = date < todayISO;
          const selected = inRange(date);
          const soldOut = cell ? cell.available <= 0 || cell.stopSell : false;
          return (
            <button
              key={date}
              onClick={() => onClickDay(date)}
              disabled={past}
              className={cn(
                "aspect-square border border-neutral-200/80 p-1 sm:p-1.5 text-left flex flex-col transition-colors relative -mb-px -mr-px",
                past ? "bg-neutral-50/60 text-neutral-300 cursor-not-allowed" : "hover:bg-primary-50/40",
                selected && "bg-primary-100/70 ring-1 ring-inset ring-primary-300",
              )}
            >
              <span className={cn("text-xs font-bold font-heading", !past && "text-neutral-400")}>{dayNum}</span>
              {cell && !past && (
                <>
                  <span className={cn("mt-auto text-sm font-semibold font-heading leading-tight", soldOut ? "text-red-500" : "text-neutral-800")}>
                    {cell.price != null ? money(cell.price) : "—"}
                  </span>
                  <span className={cn("text-[9px] leading-tight flex items-center gap-0.5", soldOut ? "text-red-400" : "text-neutral-400")}>
                    {cell.stopSell ? <><NoSymbolIcon className="w-2.5 h-2.5" /> closed</> : `${cell.available}/${cell.totalUnits} left`}
                    {cell.priceOverride != null && <TagIcon className="w-2.5 h-2.5 text-primary-500" />}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function CalendarClient({
  hotelId,
  hotelName,
  rooms,
  initialRoomId,
  initialPlanId,
  initialYear,
  initialDays,
}: {
  hotelId: number;
  hotelName: string;
  rooms: Room[];
  initialRoomId: number | null;
  initialPlanId: number | null;
  initialYear: number;
  initialDays: DayCell[];
}) {
  const [roomId, setRoomId] = useState<number | null>(initialRoomId);
  const [planId, setPlanId] = useState<number | null>(initialPlanId);
  const [year, setYear] = useState(initialYear);
  const [days, setDays] = useState<DayCell[]>(initialDays);
  const [selStart, setSelStart] = useState<string | null>(null);
  const [selEnd, setSelEnd] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();
  const [saving, startSave] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const monthRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const listRef = useRef<HTMLDivElement | null>(null);

  const byDate = useMemo(() => {
    const m = new Map<string, DayCell>();
    for (const d of days) m.set(d.date, d);
    return m;
  }, [days]);

  const currentRoom = useMemo(() => rooms.find((r) => r.id === roomId), [rooms, roomId]);

  const [rangeLo, rangeHi] = selStart && selEnd
    ? selStart <= selEnd ? [selStart, selEnd] : [selEnd, selStart]
    : selStart ? [selStart, selStart] : [null, null];

  // Only one year's worth of rows is ever held in state — keeping every
  // scrolled-past year around got out of hand fast, so switching years
  // replaces the data instead of accumulating it.
  function loadYear(rId: number | null, y: number, pId: number | null) {
    if (rId == null) return;
    const { from, toExclusive } = yearBounds(y);
    startLoad(async () => {
      const res = await fetchRoomCalendar(hotelId, rId, from, toExclusive, pId ?? undefined);
      if (res.error) {
        setMsg(res.error);
        return;
      }
      setDays(res.days ?? []);
    });
  }

  function changeYear(delta: number) {
    const y = year + delta;
    setYear(y);
    loadYear(roomId, y, planId);
  }

  function pickRoom(rId: number) {
    const room = rooms.find((r) => r.id === rId);
    const firstPlanId = room?.plans[0]?.id ?? null;
    setRoomId(rId);
    setPlanId(firstPlanId);
    setSelStart(null); setSelEnd(null); setMsg(null);
    setYear(initialYear);
    loadYear(rId, initialYear, firstPlanId);
  }

  function pickPlan(pId: number) {
    setPlanId(pId);
    setSelStart(null); setSelEnd(null); setMsg(null);
    loadYear(roomId, year, pId);
  }

  function clickDay(date: string) {
    if (date < todayISO) return; // no editing the past
    if (!selStart || (selStart && selEnd)) { setSelStart(date); setSelEnd(null); }
    else setSelEnd(date);
    setMsg(null);
  }

  // Land on the current month, not January, whenever the real "current"
  // year is showing (initial load, or navigating back to it). Scrolled
  // manually within the month list's own container — el.scrollIntoView()
  // walks up every scrollable ancestor, so on a short mobile viewport it
  // was also scrolling the outer page and hiding the header/year-switcher
  // above the fold.
  useEffect(() => {
    if (year !== initialYear) return;
    const realCurrentMonth = new Date().getUTCMonth();
    const el = monthRefs.current[realCurrentMonth];
    const container = listRef.current;
    if (el && container) {
      container.scrollTop = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
    }
  }, [year, initialYear]);

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-neutral-500">{hotelName}</p>
          <h1 className="text-lg font-bold text-neutral-800">Rates & Inventory</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/hotel-connect/properties/${hotelId}/rates`}
            className={buttonVariants({ variant: "outline", size: "md", className: "gap-1.5" })}
          >
            <ListBulletIcon className="w-4 h-4" />
            List View
          </Link>
          {rooms.length > 0 && (
            <SearchSelect
              options={rooms.map((r) => ({ value: String(r.id), label: `${r.name} (${r.num_rooms} rooms)` }))}
              value={roomId != null ? String(roomId) : undefined}
              onChange={(v) => pickRoom(Number(v))}
              showSearch={rooms.length > 6}
              className="w-56"
            />
          )}
          {currentRoom && currentRoom.plans.length > 1 && (
            <SearchSelect
              options={currentRoom.plans.map((p) => ({ value: String(p.id), label: p.label }))}
              value={planId != null ? String(planId) : undefined}
              onChange={(v) => pickPlan(Number(v))}
              showSearch={false}
              className="w-48"
            />
          )}
        </div>
      </div>

      {rooms.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500">
          No active rooms yet. Add a room to manage its rates & inventory.
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_400px] gap-5">
          {/* Calendar — one year's months stacked, buttons to switch years */}
          <Card variant="elevated" radius="lg" padding="none" className="overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
              <button onClick={() => changeYear(-1)} className="w-8 h-8 rounded-lg hover:bg-neutral-100 flex items-center justify-center">
                <ChevronLeftIcon className="w-4 h-4 text-neutral-600" />
              </button>
              <p className="text-sm font-semibold text-neutral-800">
                {year} {loading && <span className="text-neutral-400 font-normal">· loading…</span>}
              </p>
              <button onClick={() => changeYear(1)} className="w-8 h-8 rounded-lg hover:bg-neutral-100 flex items-center justify-center">
                <ChevronRightIcon className="w-4 h-4 text-neutral-600" />
              </button>
            </div>

            <div className="grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-wide text-neutral-400 border-b border-neutral-100 sticky top-0 bg-white z-10">
              {WEEKDAYS.map((w) => <div key={w} className="py-2">{w}</div>)}
            </div>

            <div ref={listRef} className="max-h-[75vh] overflow-y-auto divide-y divide-neutral-100">
              {Array.from({ length: 12 }, (_, month0) => (
                <MonthGrid
                  key={month0}
                  year={year}
                  month0={month0}
                  byDate={byDate}
                  rangeLo={rangeLo}
                  rangeHi={rangeHi}
                  onClickDay={clickDay}
                  gridRef={(el) => { monthRefs.current[month0] = el; }}
                />
              ))}
            </div>

            <div className="flex flex-wrap gap-3 px-4 py-2.5 border-t border-neutral-100 text-[10px] text-neutral-400">
              <span className="flex items-center gap-1"><TagIcon className="w-3 h-3 text-primary-500" /> price override</span>
              <span className="flex items-center gap-1"><NoSymbolIcon className="w-3 h-3 text-red-400" /> stop-sell</span>
              <span>N/M left = available / total</span>
            </div>
          </Card>

          {/* Edit panel */}
          <EditPanel
            hotelId={hotelId}
            roomId={roomId}
            planId={planId}
            planLabel={currentRoom?.plans.find((p) => p.id === planId)?.label ?? null}
            maxAdults={currentRoom?.max_adults ?? 2}
            multiPlan={(currentRoom?.plans.length ?? 0) > 1}
            rangeLo={rangeLo}
            rangeHi={rangeHi}
            saving={saving}
            msg={msg}
            onClear={() => { setSelStart(null); setSelEnd(null); }}
            onSave={(patch, planRates) => {
              if (roomId == null || !rangeLo || !rangeHi) return;
              if (Object.keys(patch).length === 0 && planRates.length === 0) {
                setMsg("Nothing to update.");
                return;
              }
              const targetRoomId = roomId;
              const lo = rangeLo, hi = rangeHi;

              // Optimistic update — reflect the new values on the cells
              // immediately instead of leaving stale prices/availability on
              // screen for the round-trip. Snapshot first so a failure can
              // undo cleanly; a success is quietly reconciled with the
              // server's authoritative values right after (cheap now that
              // ensureAvailability is a single batched query).
              const snapshot = days;
              setDays((prev) => prev.map((d) => {
                if (d.date < lo || d.date > hi) return d;
                const next = { ...d };
                if (patch.totalUnits !== undefined) next.totalUnits = patch.totalUnits;
                if (patch.stopSell !== undefined) next.stopSell = patch.stopSell;
                if (patch.minLos !== undefined) next.minLos = patch.minLos;
                if (patch.maxLos !== undefined) next.maxLos = patch.maxLos;
                if (patch.closedToArrival !== undefined) next.closedToArrival = patch.closedToArrival;
                if (patch.closedToDeparture !== undefined) next.closedToDeparture = patch.closedToDeparture;
                if (patch.priceOverride !== undefined) {
                  next.priceOverride = patch.priceOverride;
                  // A cleared override (null) needs the season/base price
                  // resolver to know the real new price — leave price/
                  // priceSource alone here and let the post-save reload
                  // correct it rather than guessing.
                  if (patch.priceOverride != null) {
                    next.price = patch.priceOverride;
                    next.priceSource = "override";
                  }
                }
                next.available = next.stopSell ? 0 : Math.max(0, next.totalUnits - next.bookedUnits);
                return next;
              }));
              setSelStart(null); setSelEnd(null);

              startSave(async () => {
                if (Object.keys(patch).length > 0) {
                  const res = await saveAvailabilityRange(hotelId, targetRoomId, lo, hi, patch);
                  if (res.error) {
                    setDays(snapshot); // undo the optimistic change
                    setMsg(res.error);
                    return;
                  }
                }

                if (planRates.length > 0) {
                  const rateResults = await Promise.all(
                    planRates.map((pr) => saveRoomRates(hotelId, targetRoomId, pr.planId, lo, hi, pr.input)),
                  );
                  const firstError = rateResults.find((r) => r.error)?.error;
                  if (firstError) {
                    loadYear(targetRoomId, year, planId);
                    setMsg(firstError);
                    return;
                  }
                }

                loadYear(targetRoomId, year, planId);
                setMsg("Saved.");
              });
            }}
          />
        </div>
      )}
    </div>
  );
}

function EditPanel({
  hotelId,
  roomId,
  planId,
  planLabel,
  maxAdults,
  multiPlan,
  rangeLo,
  rangeHi,
  saving,
  msg,
  onSave,
  onClear,
}: {
  hotelId: number;
  roomId: number | null;
  planId: number | null;
  planLabel: string | null;
  maxAdults: number;
  multiPlan: boolean;
  rangeLo: string | null;
  rangeHi: string | null;
  saving: boolean;
  msg: string | null;
  onSave: (patch: RangePatch, planRates: PlanRatesPatch[]) => void;
  onClear: () => void;
}) {
  const [price, setPrice] = useState("");
  const [units, setUnits] = useState("");
  const [openState, setOpenState] = useState<"" | "open" | "closed">("");
  const [minLos, setMinLos] = useState("");
  const [maxLos, setMaxLos] = useState("");
  const [cta, setCta] = useState<"" | "yes" | "no">("");
  const [ctd, setCtd] = useState<"" | "yes" | "no">("");
  const [planForm, setPlanForm] = useState<PlanFormState>(EMPTY_PLAN_FORM);
  const [loadingRates, setLoadingRates] = useState(false);

  const active = rangeLo != null && rangeHi != null;

  // Fetch the *currently selected* plan's saved rate for this exact range —
  // matches the plan switcher above the calendar, which already scopes the
  // whole view (grid prices, restrictions) to one plan at a time.
  useEffect(() => {
    if (!active || roomId == null || planId == null) { setPlanForm(EMPTY_PLAN_FORM); return; }
    let cancelled = false;
    setLoadingRates(true);
    getRoomRateDetail(hotelId, roomId, planId, rangeLo!, rangeHi!)
      .then((res) => {
        if (cancelled) return;
        setPlanForm(res.detail ? detailToFormState(res.detail) : EMPTY_PLAN_FORM);
      })
      .finally(() => { if (!cancelled) setLoadingRates(false); });
    return () => { cancelled = true; };
  }, [active, rangeLo, rangeHi, roomId, planId, hotelId]);

  const nights = active ? Math.round((Date.parse(rangeHi!) - Date.parse(rangeLo!)) / 86400000) + 1 : 0;

  function submit() {
    const patch: RangePatch = {};
    if (price.trim() !== "") patch.priceOverride = Number(price);
    if (units.trim() !== "") patch.totalUnits = Number(units);
    if (openState) patch.stopSell = openState === "closed";
    if (minLos.trim() !== "") patch.minLos = Number(minLos);
    if (maxLos.trim() !== "") patch.maxLos = Number(maxLos);
    if (cta) patch.closedToArrival = cta === "yes";
    if (ctd) patch.closedToDeparture = ctd === "yes";

    const planRates: PlanRatesPatch[] = [];
    if (planId != null && planForm.basePrice.trim() !== "") {
      const occupancyPrices: Record<number, number | null> = {};
      for (const [occStr, raw] of Object.entries(planForm.occupancyPrices)) {
        occupancyPrices[Number(occStr)] = raw.trim() === "" ? null : Number(raw);
      }
      planRates.push({
        planId,
        input: {
          basePrice: Number(planForm.basePrice),
          occupancyPrices,
          childRate: planForm.childRate.trim() === "" ? null : Number(planForm.childRate),
          extraAdultRate: planForm.extraAdultRate.trim() === "" ? null : Number(planForm.extraAdultRate),
        },
      });
    }

    onSave(patch, planRates);
  }

  return (
    <SectionCard
      title="Bulk Edit"
      desc={active ? `${rangeLo} → ${rangeHi} · ${nights} night${nights === 1 ? "" : "s"}` : undefined}
      className="h-fit lg:sticky lg:top-4"
    >
      {!active ? (
        <p className="text-xs text-neutral-500 leading-relaxed">
          Click a start date, then an end date — even in a different month — to select a range,
          then set rates &amp; inventory here. Use the arrows above the calendar to switch years
          if your range crosses a year boundary.
        </p>
      ) : (
        <>
          <div>
            <Label htmlFor="bulk-price">Price / night (₹)</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm pointer-events-none">₹</span>
              <Input id="bulk-price" type="number" min={1} step="1" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Leave blank to keep" className="pl-7" />
            </div>
            {price.trim() !== "" && (
              <button onClick={() => setPrice("")} className="text-[10px] text-neutral-400 hover:text-primary-600 mt-1">clear override → use season price</button>
            )}
            {multiPlan && (
              <p className="text-[10px] text-amber-600 mt-1">This overrides the price shown for every rate plan on these dates.</p>
            )}
          </div>
          <div>
            <Label htmlFor="bulk-units">Rooms available (total)</Label>
            <Input id="bulk-units" type="number" min={0} step="1" value={units} onChange={(e) => setUnits(e.target.value)} placeholder="Leave blank to keep" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="bulk-availability" className="mb-1">Availability</Label>
            <SearchSelect
              id="bulk-availability"
              options={[{ value: "", label: "Unchanged" }, { value: "open", label: "Open for sale" }, { value: "closed", label: "Stop sell (close)" }]}
              value={openState}
              onChange={(v) => setOpenState(v as "" | "open" | "closed")}
              showSearch={false}
            />
          </div>

          {planId != null && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label>
                  Rate Plan Pricing
                  {planLabel && <span className="font-normal normal-case text-neutral-400"> · {planLabel}</span>}
                </Label>
                {loadingRates && <span className="text-[10px] text-neutral-400">loading…</span>}
              </div>
              <PlanRateCard
                maxAdults={maxAdults}
                value={planForm}
                loading={loadingRates}
                onChange={(patch) => setPlanForm((prev) => ({ ...prev, ...patch }))}
              />
              <p className="text-[10px] text-neutral-400 mt-1.5">
                Leave &quot;2 Adults&quot; blank to leave this plan&apos;s rate for this range untouched.
                {multiPlan && " Switch the rate plan above to edit a different plan's pricing."}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="bulk-min-los" className="mb-1 text-[9px]">Minimum Length of Stay</Label>
              <Input id="bulk-min-los" type="number" min={1} step="1" value={minLos} onChange={(e) => setMinLos(e.target.value)} placeholder="—" />
            </div>
            <div>
              <Label htmlFor="bulk-max-los" className="mb-1 text-[9px]">Maximum Length of Stay</Label>
              <Input id="bulk-max-los" type="number" min={1} step="1" value={maxLos} onChange={(e) => setMaxLos(e.target.value)} placeholder="—" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="bulk-cta" className="mb-1 text-[9px]">Closed to Arrival</Label>
              <SearchSelect
                id="bulk-cta"
                options={[{ value: "", label: "—" }, { value: "yes", label: "Closed" }, { value: "no", label: "Open" }]}
                value={cta}
                onChange={(v) => setCta(v as "" | "yes" | "no")}
                showSearch={false}
              />
            </div>
            <div>
              <Label htmlFor="bulk-ctd" className="mb-1 text-[9px]">Closed to Departure</Label>
              <SearchSelect
                id="bulk-ctd"
                options={[{ value: "", label: "—" }, { value: "yes", label: "Closed" }, { value: "no", label: "Open" }]}
                value={ctd}
                onChange={(v) => setCtd(v as "" | "yes" | "no")}
                showSearch={false}
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="primary" size="md" onClick={submit} loading={saving} className="flex-1">
              {saving ? "Saving…" : "Apply"}
            </Button>
            <Button variant="outline" size="md" onClick={onClear}>Clear</Button>
          </div>
          {roomId != null && (
            <Link
              href={`/hotel-connect/properties/${hotelId}/rates/${roomId}?${planId != null ? `plan=${planId}&` : ""}from=${rangeLo}&to=${rangeHi}`}
              className="block text-center text-xs font-semibold text-primary-600 hover:text-primary-700"
            >
              Manage Rates for this range →
            </Link>
          )}
        </>
      )}
      {msg && <p className="text-xs text-neutral-500">{msg}</p>}
    </SectionCard>
  );
}
