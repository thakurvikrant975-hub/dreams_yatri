"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import {
  PricingRangeCalendarPicker,
  type DateRange,
} from "@/app/(dashboard)/dashboard/(main)/components/ui/pricing-range-calendar";
import { saveAvailabilityRange } from "../../calendar/calendar-actions";
import { getRoomRateDetail, saveRoomRates, type RoomRateDetail } from "./rate-actions";
import { RateField, RestrictionField } from "../rate-fields";

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

export type RatePlanOption = { id: number; label: string };

export default function ManageRatesClient({
  hotelId,
  roomId,
  roomName,
  pricingId,
  plans,
  initialFrom,
  initialTo,
  initialDetail,
}: {
  hotelId: number;
  roomId: number;
  roomName: string;
  pricingId: number;
  plans: RatePlanOption[];
  initialFrom: string | null;
  initialTo: string | null;
  initialDetail: RoomRateDetail | null;
}) {
  const router = useRouter();
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

  function switchPlan(nextPlanId: number) {
    const params = new URLSearchParams();
    params.set("plan", String(nextPlanId));
    if (fromISO) params.set("from", fromISO);
    if (toISOStr) params.set("to", toISOStr);
    router.push(`/hotel-connect/properties/${hotelId}/rates/${roomId}?${params.toString()}`);
  }

  function handleRangeChange(next: DateRange | undefined) {
    setRange(next);
    setMsg(null);
    const f = next?.from ? toISO(next.from) : null;
    const t = next?.to ? toISO(next.to) : null;
    if (!f || !t) { setDetail(EMPTY_DETAIL); return; }
    startLoad(async () => {
      const res = await getRoomRateDetail(hotelId, roomId, pricingId, f, t);
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
      const rateRes = await saveRoomRates(hotelId, roomId, pricingId, fromISO, toISOStr, {
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

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Link href={`/hotel-connect/properties/${hotelId}/rates`} className="text-xs text-neutral-400 hover:text-neutral-600">
            ← Back to Rates &amp; Availability
          </Link>
          <h1 className="text-lg font-bold text-neutral-800 mt-1">{roomName}</h1>
          <p className="text-xs text-neutral-400">Manage All Rates</p>
        </div>
        {plans.length > 1 && (
          <select
            value={pricingId}
            onChange={(e) => switchPlan(Number(e.target.value))}
            className="h-10 rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-800 shadow-sm focus:ring-2 focus:ring-primary-500/20"
          >
            {plans.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        )}
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
              <RateField value={detail.basePrice} title="2 Adults" subtitle="Base" onChange={(v) => setField("basePrice", v)} />
              <RateField value={detail.oneAdultPrice} title="1 Adult" onChange={(v) => setField("oneAdultPrice", v)} />
              <RateField value={detail.childRate} title="Per child (7-17yrs)" subtitle="Child (0-6) — Free" onChange={(v) => setField("childRate", v)} />
              <RateField value={detail.extraAdultRate} title="Per Extra Adult" onChange={(v) => setField("extraAdultRate", v)} />
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
              <RestrictionField value={detail.minAdvanceDays} title="Minimum Advance Booking Window" subtitle="Days before check-in a booking must be made" onChange={(v) => setField("minAdvanceDays", v)} />
              <RestrictionField value={detail.maxAdvanceDays} title="Maximum Advance Booking Window" subtitle="Number of days" onChange={(v) => setField("maxAdvanceDays", v)} />
              <RestrictionField value={detail.minLos} title="Minimum Length of Stay" subtitle="Number of nights" onChange={(v) => setField("minLos", v)} />
              <RestrictionField value={detail.maxLos} title="Maximum Length of Stay" subtitle="Number of nights" onChange={(v) => setField("maxLos", v)} />
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
