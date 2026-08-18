"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Hotels & Cabs — the exec's check that the package says what they meant.
//
// Two flat tables, one row per day, no money. v1 had the same shape inside its
// Pricing Breakdown, but reading a table to confirm "did I put the right hotel
// on day 4, and how many rooms" meant reading past four money columns to get
// there. This is that check on its own: what is booked, how much of it, and
// where the vehicle goes.
//
// Internal only. It is not part of the document and not in the client's PDF —
// the client reads the itinerary, and the itinerary already says all of this in
// prose. This is for the person confirming the data before it goes to costing.
//
// Rooms and extra beds come from the same computation that prices the package,
// not from the raw fields, so the numbers here are the ones costing will see. A
// day showing 2 rooms here is a day charged for 2 rooms.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { Hotel, Car } from "./builder-icons";
import { useBuilder } from "./builder-context";
import { getStayOptionsForDocument } from "@/app/(dashboard)/dashboard/(builder)/package-builder/stay-options.actions";
import type {
  BuilderHotelPricingResult, BuilderCabPricingResult,
} from "@/app/services/package-pricing.service";

type LoadedOptions = Awaited<ReturnType<typeof getStayOptionsForDocument>>;

const TH = "px-2.5 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-dashboard-base-content/50";
const TD = "px-2.5 py-1.5 text-[11px] text-dashboard-base-content align-top";

function Empty({ what }: { what: string }) {
  return <p className="px-2.5 py-3 text-[11px] text-dashboard-base-content/45">No {what} on this package yet.</p>;
}

export function DataTablesPanel({ packageId, hotelPricing, cabPricing }: {
  packageId: string;
  hotelPricing: BuilderHotelPricingResult | null;
  cabPricing: BuilderCabPricingResult | null;
}) {
  const { form } = useBuilder();
  const [options, setOptions] = useState<LoadedOptions>([]);

  useEffect(() => {
    let cancelled = false;
    getStayOptionsForDocument(packageId)
      .then((rows) => { if (!cancelled) setOptions(rows); })
      .catch(() => { if (!cancelled) setOptions([]); });
    return () => { cancelled = true; };
  }, [packageId]);

  const hotelLines = hotelPricing?.days ?? [];
  const cabLines = cabPricing?.days ?? [];
  const multi = options.length > 1;
  const recommended = options.find((o) => o.isRecommended) ?? options[0];

  /** How many vehicles run on a day: the primary one, plus any extras and their
   * quantities. A day with no vehicle at all shows nothing rather than "0". */
  const vehiclesOn = (day: number): number | null => {
    const d = form.itineraries.find((it) => it.day === day);
    if (!d) return null;
    const primary = d.transport?.trim() || d.cabPricingId != null ? Math.max(1, d.cabQuantity ?? 1) : 0;
    const extras = (d.extraCabs ?? [])
      .filter((c) => c.label.trim())
      .reduce((sum, c) => sum + Math.max(1, c.quantity || 1), 0);
    const total = primary + extras;
    return total > 0 ? total : null;
  };

  return (
    <div className="p-3 space-y-4">
      <p className="text-[11px] text-dashboard-base-content/55">
        What this package actually carries, day by day — for checking before it goes to costing.
        Rooms and extra beds are the priced figures, so they match what the reviewer sees. No prices here;
        those live in the Pricing tab.
      </p>

      {/* ── Hotels ─────────────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-dashboard-base-300 overflow-hidden">
        <header className="flex items-center gap-1.5 px-2.5 py-2 border-b border-dashboard-base-300 bg-dashboard-base-200/50">
          <Hotel size={12} className="text-dashboard-primary" />
          <span className="text-xs font-semibold text-dashboard-base-content">Hotels</span>
          <span className="text-[10px] text-dashboard-base-content/45">
            {hotelPricing?.nightsCounted ?? 0} night{(hotelPricing?.nightsCounted ?? 0) !== 1 ? "s" : ""}
          </span>
        </header>

        {hotelLines.length === 0 ? <Empty what="stays" /> : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-dashboard-base-300/70">
                  <th className={TH}>Day</th>
                  <th className={TH}>Hotel</th>
                  <th className={`${TH} text-right`}>Rooms</th>
                  <th className={`${TH} text-right`}>Extra beds</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dashboard-base-300/50">
                {hotelLines.map((l, i) => (
                  <tr key={`${l.day}-${i}`}>
                    <td className={`${TD} whitespace-nowrap font-medium`}>Day {l.day}</td>
                    <td className={TD}>
                      {l.hotelName}
                      {l.roomName ? <span className="text-dashboard-base-content/55"> — {l.roomName}</span> : null}
                    </td>
                    <td className={`${TD} text-right tabular-nums`}>{l.roomsNeeded}</td>
                    <td className={`${TD} text-right tabular-nums`}>{l.mattresses > 0 ? l.mattresses : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* The table above describes the stay being quoted. When the package
            offers several, the others are listed too — an exec checking their
            data needs to see every option they are about to send, not just the
            recommended one. */}
        {multi && (
          <div className="border-t border-dashboard-base-300 px-2.5 py-2 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-dashboard-base-content/45">
              Other stay options
            </p>
            {options.filter((o) => o.id !== recommended?.id).map((o) => (
              <div key={o.id} className="text-[11px]">
                <span className="font-medium text-dashboard-base-content">{o.label}</span>
                <ul className="mt-0.5 space-y-0.5">
                  {form.itineraries.map((d) => {
                    const cell = o.byDay?.[d.day];
                    if (!cell?.hotel && !cell?.pending) return null;
                    return (
                      <li key={d.day} className="text-dashboard-base-content/65">
                        Day {d.day}: {cell.hotel ?? "awaiting the hotel team"}
                        {cell.rooms ? ` · ${cell.rooms} room${cell.rooms !== 1 ? "s" : ""}` : ""}
                        {cell.extraBeds ? ` · ${cell.extraBeds} extra bed${cell.extraBeds !== 1 ? "s" : ""}` : ""}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Cabs ───────────────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-dashboard-base-300 overflow-hidden">
        <header className="flex items-center gap-1.5 px-2.5 py-2 border-b border-dashboard-base-300 bg-dashboard-base-200/50">
          <Car size={12} className="text-dashboard-primary" />
          <span className="text-xs font-semibold text-dashboard-base-content">Cabs</span>
          <span className="text-[10px] text-dashboard-base-content/45">
            {cabPricing?.daysCounted ?? 0} day{(cabPricing?.daysCounted ?? 0) !== 1 ? "s" : ""}
          </span>
        </header>

        {cabLines.length === 0 ? <Empty what="transport" /> : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-dashboard-base-300/70">
                  <th className={TH}>Day</th>
                  <th className={TH}>Vehicle</th>
                  <th className={`${TH} text-right`}>Distance</th>
                  <th className={`${TH} text-right`}>Vehicles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dashboard-base-300/50">
                {cabLines.map((l, i) => (
                  <tr key={`${l.day}-${i}`}>
                    <td className={`${TD} whitespace-nowrap font-medium`}>Day {l.day}</td>
                    <td className={TD}>{l.vehicleName}</td>
                    <td className={`${TD} text-right tabular-nums`}>
                      {/* Per-day vehicles carry no distance, and an em dash says
                          that better than "0 km", which reads as a mistake. */}
                      {l.distanceKm != null ? `${l.distanceKm} km` : "—"}
                    </td>
                    <td className={`${TD} text-right tabular-nums`}>{vehiclesOn(l.day) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
