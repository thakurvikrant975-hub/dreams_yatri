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
//
// Read-only, all of it. This panel used to offer four editable controls — a
// per-day hotel correction, a per-day cab correction, margin % and GST % — and
// every one of them wrote to the editor's form copy. Nothing persists them
// from there: per-day corrections were never read back off the client, and
// margin/GST/discount are written only by updatePackagePricing, which records
// who changed what. So all four moved this panel's own arithmetic, convinced
// the reviewer the correction had landed, and were dropped on the next reload.
//
// Corrections live in the Costing tab, under Edit Pricing. This is where you
// read the number; that is where you change it.
// ─────────────────────────────────────────────────────────────────────────────

import { AlertOctagon, Users } from "lucide-react";
import { travellersLine } from "@/app/(dashboard)/dashboard/(builder)/package-builder/traveller-ages";
import { StayOptionsComparison } from "@/app/(dashboard)/dashboard/(builder)/package-builder/StayOptionsComparison";
import { useBuilder } from "./builder-context";
import { payingPaxOf } from "@/app/(dashboard)/dashboard/(builder)/package-builder/traveller-ages";
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

export function CostingPricingPanel({
  packageId, hotelPricing, cabPricing, computed, canEditCost = false,
}: {
  /** Whether this reviewer may correct a night's price on the option
   * comparison. Passed rather than read from context: the builder context
   * carries the exec's canEdit, and costing's capability is a different
   * question with a different answer at the same moment. */
  canEditCost?: boolean;
  /** For the stay-option comparison, which reads from the server rather than
   * the editor's form state — a reviewer has to see what is saved, not what
   * someone is typing. */
  packageId: string;
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
}) {
  const { form, setSelectedDay } = useBuilder();

  const jump = (day: number) => { setSelectedDay(day); scrollToDay(day); };

  const hotelDays = hotelPricing?.days ?? [];
  const cabDays = cabPricing?.days ?? [];
  const namedAddons = form.addOns.filter((a) => a.name.trim());
  const pricedTickets = form.tickets.filter((t) => (t.fare ?? 0) > 0);
  const gaps = hotelDays.filter((l) => l.gap).length;
  // Days carrying a vehicle that nothing can price. These used to be absent
  // from this panel entirely — not ₹0, not flagged, just gone — so a seven-day
  // trip with a cab every day read as six days of cabs and nothing said which
  // day was missing. See the gap branch in computeBuilderCabPricing.
  const cabGapDays = cabDays.filter((l) => l.gap).map((l) => l.day);

  return (
    <div className="p-3 space-y-3">
      {/* Who is travelling, with the children's ages spelled out. The reviewer
          is checking rooms and mattresses against each hotel's child policy —
          free under 5, extra bed under 12 — and that is a different answer for
          a 4-year-old than for an 11-year-old. The head count alone (which is
          all the per-person line below carries) can't settle it, and asking
          the exec is a round-trip. Ages are required before a package can
          reach this panel at all — see traveller-ages.ts. */}
      <div className="flex items-start gap-2 rounded-lg border border-dashboard-base-300 bg-dashboard-base-200/50 px-3 py-2">
        <Users className="size-3.5 shrink-0 mt-0.5 text-dashboard-neutral" />
        <p className="text-[11px] text-dashboard-base-content">{travellersLine(form)}</p>
      </div>

      {/* The options side by side, when there is more than one. Above the
          breakdown on purpose: which option is being priced is the first thing
          to establish, and the breakdown below describes the recommended one. */}
      <StayOptionsComparison packageId={packageId} canEdit={canEditCost} />

      {gaps > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
          <AlertOctagon className="size-3.5 shrink-0 mt-0.5 text-amber-600" />
          <p className="text-[11px] text-amber-800">
            {gaps} stay {gaps === 1 ? "day has" : "days have"} no rate behind {gaps === 1 ? "it" : "them"} and
            {" "}{gaps === 1 ? "is" : "are"} pricing at ₹0.
          </p>
        </div>
      )}

      {cabGapDays.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
          <AlertOctagon className="size-3.5 shrink-0 mt-0.5 text-amber-600" />
          <p className="text-[11px] text-amber-800">
            Day{cabGapDays.length === 1 ? "" : "s"} {cabGapDays.join(", ")} show
            {cabGapDays.length === 1 ? "s" : ""} a vehicle with no rate behind
            {cabGapDays.length === 1 ? " it" : " them"} — pricing at ₹0. Correct
            {cabGapDays.length === 1 ? " it" : " them"} under Costing → Edit Pricing.
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
              </span>
            </div>
            <p className={`text-[10px] mt-0.5 ${l.overridden ? "line-through text-dashboard-neutral" : "text-dashboard-neutral"}`}>
              {l.gap
                ? "On the itinerary, not in the catalog"
                : l.pricingType === "PER_KM"
                  ? `${l.distanceKm ?? 0} km × ${inr(l.rate)}/km`
                  : `Per day × ${inr(l.rate)}`}
              {!l.gap && l.isWeekend && " · weekend rate"}
            </p>
            {l.overridden && <p className="text-[10px] text-amber-700 mt-0.5">Corrected by costing</p>}
            {l.gap && <p className="text-[10px] text-amber-700 mt-0.5">No cab rate set</p>}
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
              <span className="text-dashboard-neutral">{computed.marginPct}%</span>
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
              <span className="text-dashboard-neutral">{computed.gstPct}%</span>
            </span>
          }
          value={inr(computed.gstAmount)}
          muted
        />
        {/* The concession, between the computed price and what is payable, so
            the three read as one sum: this is the price, this comes off, this
            is what they pay.

            Read-only here, deliberately. The inputs that set it live in the
            Costing tab's Edit Pricing, alongside margin and GST — that is the
            path that writes to the row and records who changed what. Editing
            it here wrote to the builder's form copy instead, which is not
            persisted while a package is under review, so a discount typed on
            this panel moved the preview and was then quietly dropped. */}
        <div className="pt-1.5 border-t border-dashboard-base-300 space-y-1.5">
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
            label={`Per person (${payingPaxOf(form)} paying)`}
            value={inr(computed.perPerson)}
            muted
          />
        </div>
      </div>
    </div>
  );
}
