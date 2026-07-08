"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { cn } from "@/app/lib/utils";
import {
  NoSymbolIcon,
  TagIcon,
  ListBulletIcon,
} from "@heroicons/react/24/outline";
import { fetchRoomCalendar, saveAvailabilityRange, type RangePatch } from "./calendar-actions";

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

type Room = { id: number; name: string; num_rooms: number };

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
}: {
  year: number;
  month0: number;
  byDate: Map<string, DayCell>;
  rangeLo: string | null;
  rangeHi: string | null;
  onClickDay: (date: string) => void;
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
    <div>
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
                "aspect-square border-b border-r border-neutral-100 p-1.5 text-left flex flex-col transition-colors relative",
                past ? "bg-neutral-50/60 text-neutral-300 cursor-not-allowed" : "hover:bg-primary-50/40",
                selected && "bg-primary-100/70 ring-1 ring-inset ring-primary-300",
              )}
            >
              <span className={cn("text-[11px] font-semibold", !past && "text-neutral-600")}>{dayNum}</span>
              {cell && !past && (
                <>
                  <span className={cn("mt-auto text-[11px] font-bold leading-tight", soldOut ? "text-red-500" : "text-neutral-800")}>
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
  initialYear,
  initialDays,
}: {
  hotelId: number;
  hotelName: string;
  rooms: Room[];
  initialRoomId: number | null;
  initialYear: number;
  initialDays: DayCell[];
}) {
  const [roomId, setRoomId] = useState<number | null>(initialRoomId);
  const [loadedYears, setLoadedYears] = useState<number[]>([initialYear]);
  const [days, setDays] = useState<DayCell[]>(initialDays);
  const [selStart, setSelStart] = useState<string | null>(null);
  const [selEnd, setSelEnd] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();
  const [saving, startSave] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const byDate = useMemo(() => {
    const m = new Map<string, DayCell>();
    for (const d of days) m.set(d.date, d);
    return m;
  }, [days]);

  const [rangeLo, rangeHi] = selStart && selEnd
    ? selStart <= selEnd ? [selStart, selEnd] : [selEnd, selStart]
    : selStart ? [selStart, selStart] : [null, null];

  function loadYear(rId: number | null, y: number) {
    if (rId == null) return;
    const { from, toExclusive } = yearBounds(y);
    startLoad(async () => {
      const res = await fetchRoomCalendar(hotelId, rId, from, toExclusive);
      if (res.error) {
        setMsg(res.error);
        return;
      }
      setDays((prev) => [...prev.filter((d) => !d.date.startsWith(String(y))), ...(res.days ?? [])]);
    });
  }

  function pickRoom(rId: number) {
    setRoomId(rId);
    setSelStart(null); setSelEnd(null); setMsg(null);
    setDays([]);
    setLoadedYears([initialYear]);
    loadYear(rId, initialYear);
  }

  function clickDay(date: string) {
    if (date < todayISO) return; // no editing the past
    if (!selStart || (selStart && selEnd)) { setSelStart(date); setSelEnd(null); }
    else setSelEnd(date);
    setMsg(null);
  }

  // Scrolling to the bottom of the loaded months loads the next year — this
  // is the only way further-out months become available, replacing the old
  // per-month Prev/Next buttons that reset any in-progress selection.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loading) {
          const nextYear = Math.max(...loadedYears) + 1;
          setLoadedYears((prev) => [...prev, nextYear]);
          loadYear(roomId, nextYear);
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedYears, roomId, loading]);

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-neutral-500">{hotelName}</p>
          <h1 className="text-lg font-bold text-neutral-800">Rates & Availability</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/hotel-connect/properties/${hotelId}/rates`}
            className="h-10 flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-600 shadow-sm hover:bg-neutral-50 transition-colors"
          >
            <ListBulletIcon className="w-4 h-4" />
            List View
          </Link>
          {rooms.length > 0 && (
            <select
              value={roomId ?? ""}
              onChange={(e) => pickRoom(Number(e.target.value))}
              className="h-10 rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-800 shadow-sm focus:ring-2 focus:ring-primary-500/20"
            >
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>{r.name} ({r.num_rooms} rooms)</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {rooms.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500">
          No active rooms yet. Add a room to manage its rates & availability.
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_300px] gap-5">
          {/* Calendar — all loaded months stacked, scroll for more */}
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
            <div className="grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-wide text-neutral-400 border-b border-neutral-100 sticky top-0 bg-white z-10">
              {WEEKDAYS.map((w) => <div key={w} className="py-2">{w}</div>)}
            </div>

            <div className="max-h-[75vh] overflow-y-auto divide-y divide-neutral-100">
              {loadedYears.map((y) =>
                Array.from({ length: 12 }, (_, month0) => (
                  <MonthGrid
                    key={`${y}-${month0}`}
                    year={y}
                    month0={month0}
                    byDate={byDate}
                    rangeLo={rangeLo}
                    rangeHi={rangeHi}
                    onClickDay={clickDay}
                  />
                )),
              )}
              <div ref={sentinelRef} className="h-4" />
              {loading && (
                <p className="text-center text-xs text-neutral-400 py-3">Loading more months…</p>
              )}
            </div>

            <div className="flex flex-wrap gap-3 px-4 py-2.5 border-t border-neutral-100 text-[10px] text-neutral-400">
              <span className="flex items-center gap-1"><TagIcon className="w-3 h-3 text-primary-500" /> price override</span>
              <span className="flex items-center gap-1"><NoSymbolIcon className="w-3 h-3 text-red-400" /> stop-sell</span>
              <span>N/M left = available / total</span>
            </div>
          </div>

          {/* Edit panel */}
          <EditPanel
            hotelId={hotelId}
            roomId={roomId}
            rangeLo={rangeLo}
            rangeHi={rangeHi}
            saving={saving}
            msg={msg}
            onClear={() => { setSelStart(null); setSelEnd(null); }}
            onSave={(patch) => {
              if (roomId == null || !rangeLo || !rangeHi) return;
              startSave(async () => {
                const res = await saveAvailabilityRange(hotelId, roomId, rangeLo, rangeHi, patch);
                if (res.error) { setMsg(res.error); return; }
                setSelStart(null); setSelEnd(null);
                // Refresh every currently-loaded year so the range's new
                // values show immediately, wherever it lands.
                for (const y of loadedYears) loadYear(roomId, y);
                setMsg(`Updated ${res.updated} night${res.updated === 1 ? "" : "s"}.`);
              });
            }}
          />
        </div>
      )}
    </div>
  );
}

function EditPanel({
  rangeLo,
  rangeHi,
  saving,
  msg,
  onSave,
  onClear,
}: {
  hotelId: number;
  roomId: number | null;
  rangeLo: string | null;
  rangeHi: string | null;
  saving: boolean;
  msg: string | null;
  onSave: (patch: RangePatch) => void;
  onClear: () => void;
}) {
  const [price, setPrice] = useState("");
  const [units, setUnits] = useState("");
  const [openState, setOpenState] = useState<"" | "open" | "closed">("");
  const [minLos, setMinLos] = useState("");
  const [maxLos, setMaxLos] = useState("");
  const [cta, setCta] = useState<"" | "yes" | "no">("");
  const [ctd, setCtd] = useState<"" | "yes" | "no">("");

  const active = rangeLo != null && rangeHi != null;
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
    onSave(patch);
  }

  const label = "block text-[11px] font-semibold text-neutral-600 mb-1";
  const input = "h-9 w-full rounded-lg border border-neutral-300 bg-white px-2.5 text-sm shadow-sm focus:ring-2 focus:ring-primary-500/20";

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-4 h-fit lg:sticky lg:top-4">
      <p className="text-sm font-bold text-neutral-800">Bulk edit</p>
      {!active ? (
        <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
          Click a start date, then an end date anywhere in the calendar — even a different month or
          year — to select a range, then set rates &amp; availability here.
        </p>
      ) : (
        <>
          <p className="text-xs text-primary-600 font-medium mt-1 mb-3">
            {rangeLo} → {rangeHi} · {nights} night{nights === 1 ? "" : "s"}
          </p>
          <div className="space-y-3">
            <div>
              <label className={label}>Price / night (₹)</label>
              <input type="number" min={1} step="1" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Leave blank to keep" className={input} />
              {price.trim() !== "" && (
                <button onClick={() => setPrice("")} className="text-[10px] text-neutral-400 hover:text-primary-600 mt-1">clear override → use season price</button>
              )}
            </div>
            <div>
              <label className={label}>Rooms available (total)</label>
              <input type="number" min={0} step="1" value={units} onChange={(e) => setUnits(e.target.value)} placeholder="Leave blank to keep" className={input} />
            </div>
            <div>
              <label className={label}>Availability</label>
              <select value={openState} onChange={(e) => setOpenState(e.target.value as "" | "open" | "closed")} className={input}>
                <option value="">Unchanged</option>
                <option value="open">Open for sale</option>
                <option value="closed">Stop sell (close)</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={label}>Min LOS</label>
                <input type="number" min={1} step="1" value={minLos} onChange={(e) => setMinLos(e.target.value)} placeholder="—" className={input} />
              </div>
              <div>
                <label className={label}>Max LOS</label>
                <input type="number" min={1} step="1" value={maxLos} onChange={(e) => setMaxLos(e.target.value)} placeholder="—" className={input} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={label}>CTA</label>
                <select value={cta} onChange={(e) => setCta(e.target.value as "" | "yes" | "no")} className={input}>
                  <option value="">—</option>
                  <option value="yes">Closed</option>
                  <option value="no">Open</option>
                </select>
              </div>
              <div>
                <label className={label}>CTD</label>
                <select value={ctd} onChange={(e) => setCtd(e.target.value as "" | "yes" | "no")} className={input}>
                  <option value="">—</option>
                  <option value="yes">Closed</option>
                  <option value="no">Open</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={submit} disabled={saving} className="flex-1 h-10 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold disabled:opacity-60">
                {saving ? "Saving…" : "Apply"}
              </button>
              <button onClick={onClear} className="h-10 px-3 rounded-lg border border-neutral-200 text-sm text-neutral-600 hover:bg-neutral-50">Clear</button>
            </div>
          </div>
        </>
      )}
      {msg && <p className="text-xs text-neutral-500 mt-3">{msg}</p>}
    </div>
  );
}
