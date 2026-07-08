"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import {
  PricingRangeCalendarPicker,
  type DateRange,
} from "@/app/(dashboard)/dashboard/(main)/components/ui/pricing-range-calendar";
import { saveAvailabilityRange } from "../../calendar/calendar-actions";
import { getRoomRateDetail, saveRoomRates, type RoomRateDetail } from "./rate-actions";

const pad = (n: number) => String(n).padStart(2, "0");
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISOToDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const EMPTY_DETAIL: RoomRateDetail = {
  basePrice: null, oneAdultPrice: null, childRate: null, extraAdultRate: null,
  minLos: null, maxLos: null, minAdvanceDays: null, maxAdvanceDays: null,
};

export default function ManageRatesClient({
  hotelId,
  roomId,
  roomName,
  initialFrom,
  initialTo,
  initialDetail,
}: {
  hotelId: number;
  roomId: number;
  roomName: string;
  initialFrom: string | null;
  initialTo: string | null;
  initialDetail: RoomRateDetail | null;
}) {
  const [range, setRange] = useState<DateRange | undefined>(
    initialFrom && initialTo ? { from: fromISOToDate(initialFrom), to: fromISOToDate(initialTo) } : undefined,
  );
  const [detail, setDetail] = useState<RoomRateDetail>(initialDetail ?? EMPTY_DETAIL);
  const [loading, startLoad] = useTransition();
  const [saving, startSave] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const fromISO = range?.from ? toISO(range.from) : null;
  const toISOStr = range?.to ? toISO(range.to) : null;
  const hasRange = !!(fromISO && toISOStr);

  function handleRangeChange(next: DateRange | undefined) {
    setRange(next);
    setMsg(null);
    const f = next?.from ? toISO(next.from) : null;
    const t = next?.to ? toISO(next.to) : null;
    if (!f || !t) { setDetail(EMPTY_DETAIL); return; }
    startLoad(async () => {
      const res = await getRoomRateDetail(hotelId, roomId, f, t);
      if (res.error) { setMsg(res.error); setDetail(EMPTY_DETAIL); return; }
      setDetail(res.detail ?? EMPTY_DETAIL);
    });
  }

  function setField<K extends keyof RoomRateDetail>(key: K, raw: string) {
    setDetail((prev) => ({ ...prev, [key]: raw.trim() === "" ? null : Number(raw) }));
  }

  async function handleSave() {
    if (!fromISO || !toISOStr) return;
    if (detail.basePrice == null) { setMsg("Base rate (2 Adults) is required."); return; }
    setMsg(null);
    startSave(async () => {
      const rateRes = await saveRoomRates(hotelId, roomId, fromISO, toISOStr, {
        basePrice: detail.basePrice!,
        oneAdultPrice: detail.oneAdultPrice,
        childRate: detail.childRate,
        extraAdultRate: detail.extraAdultRate,
      });
      if (rateRes.error) { setMsg(rateRes.error); return; }

      const restrictionRes = await saveAvailabilityRange(hotelId, roomId, fromISO, toISOStr, {
        minLos: detail.minLos,
        maxLos: detail.maxLos,
        minAdvanceDays: detail.minAdvanceDays,
        maxAdvanceDays: detail.maxAdvanceDays,
      });
      if (restrictionRes.error) { setMsg(restrictionRes.error); return; }

      setMsg("Rates & restrictions saved for this date range.");
    });
  }

  const label = "text-sm font-medium text-neutral-800";
  const sub = "text-xs text-neutral-400";
  const inputWrap = "h-10 w-36 rounded-lg border flex items-center px-2.5 gap-1 text-sm";
  const inputCls = "w-full outline-none bg-transparent";

  function RateField({ fieldKey, title, subtitle }: { fieldKey: keyof RoomRateDetail; title: string; subtitle?: string }) {
    const v = detail[fieldKey];
    return (
      <div className="flex items-center justify-between py-3 border-b border-neutral-100 last:border-0">
        <div>
          <p className={label}>{title}</p>
          {subtitle && <p className={sub}>{subtitle}</p>}
        </div>
        <div className={`${inputWrap} border-red-200`}>
          <span className="text-neutral-400">₹</span>
          <input
            type="number"
            min={0}
            step="1"
            value={v ?? ""}
            onChange={(e) => setField(fieldKey, e.target.value)}
            placeholder="Enter Rate"
            className={inputCls}
          />
        </div>
      </div>
    );
  }

  function RestrictionField({ fieldKey, title, subtitle }: { fieldKey: keyof RoomRateDetail; title: string; subtitle?: string }) {
    const v = detail[fieldKey];
    return (
      <div className="flex items-center justify-between py-3 border-b border-neutral-100 last:border-0">
        <div>
          <p className={label}>{title}</p>
          {subtitle && <p className={sub}>{subtitle}</p>}
        </div>
        <div className={`${inputWrap} border-neutral-300`}>
          <input
            type="number"
            min={0}
            step="1"
            value={v ?? ""}
            onChange={(e) => setField(fieldKey, e.target.value)}
            placeholder="—"
            className={inputCls}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/hotel-connect/properties/${hotelId}/rates`} className="text-xs text-neutral-400 hover:text-neutral-600">
          ← Back to Rates &amp; Availability
        </Link>
        <h1 className="text-lg font-bold text-neutral-800 mt-1">{roomName}</h1>
        <p className="text-xs text-neutral-400">Manage All Rates</p>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-4">
        <p className="text-xs font-semibold text-neutral-600 mb-2">Date range</p>
        <PricingRangeCalendarPicker
          value={range}
          onChange={handleRangeChange}
          placeholder="Select a date range"
        />
        {loading && <p className="text-xs text-neutral-400 mt-2">Loading existing rates…</p>}
      </div>

      {!hasRange ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
          Pick a date range above to set rates &amp; restrictions for it.
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-100">
              <p className="text-sm font-bold text-neutral-800">Nightly Rate</p>
              <p className="text-xs text-neutral-400 mt-0.5">{fromISO} → {toISOStr}</p>
            </div>
            <div className="px-4 py-1">
              <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400 pt-3">Rates</p>
              <RateField fieldKey="basePrice" title="2 Adults" subtitle="Base" />
              <RateField fieldKey="oneAdultPrice" title="1 Adult" />
              <RateField fieldKey="childRate" title="Per child (7-17yrs)" subtitle="Child (0-6) — Free" />
              <RateField fieldKey="extraAdultRate" title="Per Extra Adult" />
            </div>
            <div className="flex items-start gap-2 mx-4 mb-4 mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
              <InformationCircleIcon className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-700 leading-relaxed">
                These rates are saved and ready, but direct guest bookings currently charge the base
                rate regardless of adults/children — occupancy-based charging at checkout is a
                separate upcoming update.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-100">
              <p className="text-sm font-bold text-neutral-800">Restrictions</p>
            </div>
            <div className="px-4 py-1">
              <RestrictionField fieldKey="minAdvanceDays" title="Minimum Advance Booking Window" subtitle="Days before check-in a booking must be made" />
              <RestrictionField fieldKey="maxAdvanceDays" title="Maximum Advance Booking Window" subtitle="Number of days" />
              <RestrictionField fieldKey="minLos" title="Minimum Length of Stay" subtitle="Number of nights" />
              <RestrictionField fieldKey="maxLos" title="Maximum Length of Stay" subtitle="Number of nights" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="h-11 px-6 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            {msg && <p className="text-xs text-neutral-500">{msg}</p>}
          </div>
        </>
      )}
    </div>
  );
}
