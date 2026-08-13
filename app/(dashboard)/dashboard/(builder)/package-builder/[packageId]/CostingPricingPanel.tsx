"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Pricing — costing's calculation, live.
//
// Deliberately NOT the frozen snapshot the decision panel shows. This reads the
// editor's own pricing state, so when costing corrects a mattress rate on day 3
// the subtotal, the margin, the GST and the per-person figure all move while
// they watch. Checking a number against a page that recomputed three clicks ago
// is how a reviewer approves something they didn't mean to.
//
// Every line shows its arithmetic rather than a total. "₹3,200" invites the
// question the reviewer is here to answer; "1 room × ₹3,200 + 2 mattresses ×
// ₹500 = ₹4,200" answers it.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { AlertOctagon, Pencil, RotateCcw } from "lucide-react";
import { Input } from "@/app/(dashboard)/dashboard/(main)/components/ui/input";
import { useBuilder } from "./builder-context";
import { scrollToDay } from "./builder-context";
import type {
  BuilderHotelPricingResult, BuilderCabPricingResult,
} from "@/app/services/package-pricing.service";

const inr = (n: number | null | undefined) =>
  n != null ? `₹${Math.round(n).toLocaleString("en-IN")}` : "—";

function Row({ label, value, strong, muted }: {
  label: React.ReactNode; value: React.ReactNode; strong?: boolean; muted?: boolean;
}) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${strong ? "font-semibold" : ""}`}>
      <span className={`text-[11px] ${muted ? "text-dashboard-neutral" : "text-dashboard-base-content"}`}>{label}</span>
      <span className={`text-xs tabular-nums shrink-0 ${muted ? "text-dashboard-neutral" : "text-dashboard-base-content"}`}>{value}</span>
    </div>
  );
}

function Section({ title, meta, subtotal, children }: {
  title: string; meta?: string; subtotal: number; children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashboard-base-300 overflow-hidden">
      <div className="flex items-baseline justify-between gap-2 px-3 py-2 bg-dashboard-base-200/50 border-b border-dashboard-base-300">
        <span className="text-xs font-semibold text-dashboard-base-content">
          {title}
          {meta && <span className="ml-1.5 font-normal text-[10px] text-dashboard-neutral">{meta}</span>}
        </span>
        <span className="text-xs font-semibold tabular-nums">{inr(subtotal)}</span>
      </div>
      <div className="divide-y divide-dashboard-base-300/70">{children}</div>
    </div>
  );
}

/** A day whose price costing has hand-corrected, or can. The override replaces
 * the whole computed line — that is what makes it a correction rather than an
 * edit of one input, and why the arithmetic is struck through when it's set. */
function DayOverride({ value, onSet, onClear }: {
  value: number | null; onSet: (n: number) => void; onClear: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (editing) {
    return (
      <span className="flex items-center gap-1">
        <Input
          autoFocus type="number" min={0} value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { const n = parseFloat(draft); if (!Number.isNaN(n)) onSet(n); setEditing(false); }
            if (e.key === "Escape") setEditing(false);
          }}
          onBlur={() => { const n = parseFloat(draft); if (!Number.isNaN(n)) onSet(n); setEditing(false); }}
          className="h-6 w-20 text-[11px] text-right"
        />
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1">
      {value != null && (
        <button
          type="button" title="Drop the correction, go back to the computed price"
          onClick={onClear}
          className="text-dashboard-neutral hover:text-dashboard-base-content"
        >
          <RotateCcw className="size-3" />
        </button>
      )}
      <button
        type="button" title="Correct this day's price"
        onClick={() => { setDraft(value != null ? String(value) : ""); setEditing(true); }}
        className="text-dashboard-neutral hover:text-dashboard-primary"
      >
        <Pencil className="size-3" />
      </button>
    </span>
  );
}

export function CostingPricingPanel({
  hotelPricing, cabPricing, computed, canEdit,
}: {
  hotelPricing: BuilderHotelPricingResult | null;
  cabPricing: BuilderCabPricingResult | null;
  computed: {
    marginPct: number; gstPct: number; baseCost: number;
    ticketsSubtotal: number; hotelCabBase: number; addonsSubtotal: number;
    hotelCabMarginAmount: number; ticketsMarginAmount: number; marginAmount: number;
    taxable: number; gstAmount: number; finalPrice: number; perPerson: number;
    listPrice: number;
    discount: { applies: boolean; amount: number; percentOff: number | null };
  };
  /** Costing may correct; anyone else looking is reading. */
  canEdit: boolean;
}) {
  const { form, setForm, replaceDay, setSelectedDay } = useBuilder();

  const setHotelOverride = (day: number, amount: number | null) =>
    replaceDay(day, (d) => ({ ...d, hotelPriceOverride: amount }));
  const setCabOverride = (day: number, amount: number | null) =>
    replaceDay(day, (d) => ({ ...d, cabPriceOverride: amount }));

  const jump = (day: number) => { setSelectedDay(day); scrollToDay(day); };

  const hotelDays = hotelPricing?.days ?? [];
  const cabDays = cabPricing?.days ?? [];
  const namedAddons = form.addOns.filter((a) => a.name.trim());
  const pricedTickets = form.tickets.filter((t) => (t.fare ?? 0) > 0);
  const gaps = hotelDays.filter((l) => l.gap).length;

  return (
    <div className="p-3 space-y-3">
      {gaps > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
          <AlertOctagon className="size-3.5 shrink-0 mt-0.5 text-amber-600" />
          <p className="text-[11px] text-amber-800">
            {gaps} stay {gaps === 1 ? "day has" : "days have"} no rate behind {gaps === 1 ? "it" : "them"} and
            {" "}{gaps === 1 ? "is" : "are"} pricing at ₹0.
          </p>
        </div>
      )}

      <Section title="Hotels" meta={`${hotelPricing?.nightsCounted ?? 0} nights`} subtotal={hotelPricing?.hotelSubtotal ?? 0}>
        {hotelDays.length === 0 && <p className="px-3 py-2.5 text-[11px] text-dashboard-neutral">No stays priced yet.</p>}
        {hotelDays.map((l, i) => (
          <div key={`${l.day}-${i}`} className="px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <button
                type="button" onClick={() => jump(l.day)}
                className="text-[11px] font-medium text-dashboard-base-content hover:text-dashboard-primary text-left truncate"
              >
                Day {l.day} · {l.hotelName}
              </button>
              <span className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs font-semibold tabular-nums">{inr(l.total)}</span>
                {canEdit && (
                  <DayOverride
                    value={form.itineraries.find((d) => d.day === l.day)?.hotelPriceOverride ?? null}
                    onSet={(n) => setHotelOverride(l.day, n)}
                    onClear={() => setHotelOverride(l.day, null)}
                  />
                )}
              </span>
            </div>
            <p className={`text-[10px] mt-0.5 ${l.overridden ? "line-through text-dashboard-neutral" : "text-dashboard-neutral"}`}>
              {l.roomsNeeded} room{l.roomsNeeded !== 1 ? "s" : ""} × {inr(l.pricePerRoom)}
              {l.mattresses > 0 && ` + ${l.mattresses} mattress${l.mattresses !== 1 ? "es" : ""} × ${inr(l.extraBedRate)}`}
              {l.roomName ? ` · ${l.roomName}` : ""}
            </p>
            {l.overridden && <p className="text-[10px] text-amber-700 mt-0.5">Corrected by costing</p>}
            {l.gap && (
              <p className="text-[10px] text-amber-700 mt-0.5">
                {l.gap === "no-room-price" ? "No room rate set" : "Mattresses have no rate"}
              </p>
            )}
          </div>
        ))}
      </Section>

      <Section title="Cabs" meta={`${cabPricing?.daysCounted ?? 0} days`} subtotal={cabPricing?.cabSubtotal ?? 0}>
        {cabDays.length === 0 && <p className="px-3 py-2.5 text-[11px] text-dashboard-neutral">No cabs priced yet.</p>}
        {cabDays.map((l, i) => (
          <div key={`${l.day}-${i}`} className="px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <button
                type="button" onClick={() => jump(l.day)}
                className="text-[11px] font-medium text-dashboard-base-content hover:text-dashboard-primary text-left truncate"
              >
                Day {l.day} · {l.vehicleName}
              </button>
              <span className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs font-semibold tabular-nums">{inr(l.total)}</span>
                {canEdit && (
                  <DayOverride
                    value={form.itineraries.find((d) => d.day === l.day)?.cabPriceOverride ?? null}
                    onSet={(n) => setCabOverride(l.day, n)}
                    onClear={() => setCabOverride(l.day, null)}
                  />
                )}
              </span>
            </div>
            <p className={`text-[10px] mt-0.5 ${l.overridden ? "line-through text-dashboard-neutral" : "text-dashboard-neutral"}`}>
              {l.pricingType === "PER_KM"
                ? `${l.distanceKm ?? 0} km × ${inr(l.rate)}/km`
                : `Per day × ${inr(l.rate)}`}
              {l.isWeekend && " · weekend rate"}
            </p>
            {l.overridden && <p className="text-[10px] text-amber-700 mt-0.5">Corrected by costing</p>}
          </div>
        ))}
      </Section>

      {pricedTickets.length > 0 && (
        <Section title="Tickets" subtotal={computed.ticketsSubtotal}>
          {pricedTickets.map((t, i) => (
            <div key={i} className="px-3 py-2.5 flex items-baseline justify-between gap-2">
              <span className="text-[11px] truncate">
                {t.type} · {t.provider || "—"}
                {t.ticketCount > 1 && <span className="text-dashboard-neutral"> × {t.ticketCount}</span>}
              </span>
              <span className="text-xs font-semibold tabular-nums shrink-0">{inr(t.fare)}</span>
            </div>
          ))}
        </Section>
      )}

      {namedAddons.length > 0 && (
        <Section title="Add-ons" subtotal={computed.addonsSubtotal}>
          {namedAddons.map((a, i) => (
            <div key={i} className="px-3 py-2.5 flex items-baseline justify-between gap-2">
              <span className="text-[11px] truncate">
                {a.name}
                {a.quantity > 1 && <span className="text-dashboard-neutral"> × {a.quantity}</span>}
              </span>
              <span className="text-xs font-semibold tabular-nums shrink-0">{inr((a.price ?? 0) * (a.quantity || 1))}</span>
            </div>
          ))}
        </Section>
      )}

      {/* The walkthrough. Shown as steps rather than a single total because the
          question costing is answering is "where did this number come from",
          and a total cannot answer it. */}
      <div className="rounded-lg border border-dashboard-base-300 p-3 space-y-1.5">
        <Row label="Base cost" value={inr(computed.baseCost)} muted />
        <Row
          label={
            <span className="flex items-center gap-1.5">
              Margin
              {canEdit ? (
                <Input
                  type="number" min={0} max={100}
                  value={form.marginPercentage}
                  onChange={(e) => setForm((f) => ({ ...f, marginPercentage: e.target.value }))}
                  className="h-5 w-12 px-1 text-[10px] text-right"
                />
              ) : <span className="text-dashboard-neutral">{computed.marginPct}%</span>}
              {canEdit && <span className="text-dashboard-neutral">%</span>}
            </span>
          }
          value={inr(computed.marginAmount)}
          muted
        />
        {computed.ticketsMarginAmount > 0 && (
          <Row
            label={<span className="pl-3 text-dashboard-neutral">of which tickets (5%)</span>}
            value={inr(computed.ticketsMarginAmount)}
            muted
          />
        )}
        <Row label="Taxable" value={inr(computed.taxable)} muted />
        <Row
          label={
            <span className="flex items-center gap-1.5">
              GST
              {canEdit ? (
                <Input
                  type="number" min={0} max={100}
                  value={form.gstPercentage}
                  onChange={(e) => setForm((f) => ({ ...f, gstPercentage: e.target.value }))}
                  className="h-5 w-12 px-1 text-[10px] text-right"
                />
              ) : <span className="text-dashboard-neutral">{computed.gstPct}%</span>}
              {canEdit && <span className="text-dashboard-neutral">%</span>}
            </span>
          }
          value={inr(computed.gstAmount)}
          muted
        />
        {/* The concession, between the computed price and what is payable, so
            the three read as one sum: this is the price, this comes off, this
            is what they pay. */}
        <div className="pt-1.5 border-t border-dashboard-base-300 space-y-1.5">
          {canEdit && (
            <div className="flex items-center gap-1.5 pb-1">
              <select
                value={form.discountType ?? ""}
                onChange={(e) => setForm((f) => ({
                  ...f,
                  discountType: (e.target.value || null) as "FLAT" | "PERCENT" | null,
                  // Clearing the type clears the value too — a stray amount
                  // left behind would reapply the moment a type was re-picked.
                  discountValue: e.target.value ? f.discountValue : "",
                }))}
                className="h-6 rounded-md border border-dashboard-base-300 bg-white px-1 text-[10px]"
              >
                <option value="">No discount</option>
                <option value="FLAT">₹ off</option>
                <option value="PERCENT">% off</option>
              </select>
              {form.discountType && (
                <>
                  <Input
                    type="number" min={0}
                    value={form.discountValue}
                    onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
                    placeholder="0"
                    className="h-6 w-16 px-1 text-[10px] text-right"
                  />
                  <Input
                    value={form.discountNote}
                    onChange={(e) => setForm((f) => ({ ...f, discountNote: e.target.value }))}
                    placeholder="Why? (internal)"
                    className="h-6 flex-1 min-w-0 px-1.5 text-[10px]"
                  />
                </>
              )}
            </div>
          )}
          {computed.discount.applies && (
            <>
              <Row label="Price before discount" value={inr(computed.listPrice)} muted />
              <Row
                label={<span className="text-emerald-700">Discount</span>}
                value={<span className="text-emerald-700">− {inr(computed.discount.amount)}</span>}
              />
            </>
          )}
          <Row label="Final price" value={inr(computed.finalPrice)} strong />
          <Row
            label={`Per person (${form.adults + form.children} paying)`}
            value={inr(computed.perPerson)}
            muted
          />
        </div>
      </div>
    </div>
  );
}
