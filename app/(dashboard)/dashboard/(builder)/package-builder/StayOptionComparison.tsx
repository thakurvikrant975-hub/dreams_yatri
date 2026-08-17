"use client";

// ─────────────────────────────────────────────────────────────────────────────
// The tiers, side by side, for whoever is checking the pricing.
//
// A package quoted at 3★ and 4★ is two hotels against the same night, not two
// itineraries — so this is laid out as one row per day with a column per tier.
// Reading it the other way round is how a day gets approved at one standard and
// priced at the other.
//
// Renders nothing at all for a package with a single option, which is every
// package built before tiers existed: there is no comparison to make, and a
// one-column table would be noise on every review screen in the system.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { stayOptionLabel } from "./stay-options";
import { getStayOptionComparison } from "./stay-options.actions";

type Comparison = Awaited<ReturnType<typeof getStayOptionComparison>>;

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export function StayOptionComparison({ packageId, className }: { packageId: string; className?: string }) {
  const [data, setData] = useState<Comparison | null>(null);

  useEffect(() => {
    let cancelled = false;
    getStayOptionComparison(packageId)
      .then((d) => { if (!cancelled) setData(d); })
      // Silent: this is a supplementary panel on a screen whose main job is the
      // package itself, and a failed read here must not look like a broken review.
      .catch(() => { if (!cancelled) setData(null); });
    return () => { cancelled = true; };
  }, [packageId]);

  if (!data || data.options.length < 2) return null;

  const { days, options } = data;
  const cheapest = Math.min(...options.map((o) => o.totalPrice).filter((n) => n > 0));

  return (
    <div className={cn("rounded-xl border border-dashboard-base-300 overflow-hidden", className)}>
      <div className="px-3 py-2 border-b border-dashboard-base-300 bg-dashboard-base-200/50">
        <p className="text-xs font-semibold text-dashboard-base-content">Stay options</p>
        <p className="text-[11px] text-dashboard-base-content/55">
          The same trip at {options.length} standards — only the hotels differ. The client picks one.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="bg-dashboard-base-200/30">
              <th className="text-left font-medium text-dashboard-base-content/60 px-3 py-2 whitespace-nowrap">Day</th>
              {options.map((o) => (
                <th key={o.id} className="text-left px-3 py-2 min-w-[150px] align-top">
                  <span className="flex items-center gap-1.5">
                    <span className="font-semibold text-dashboard-base-content">{stayOptionLabel(o)}</span>
                    {o.isDefault && (
                      <span className="text-[9px] font-semibold uppercase tracking-wide text-dashboard-base-content/45">
                        default
                      </span>
                    )}
                  </span>
                  <span className="block font-normal tabular-nums text-dashboard-base-content/70">
                    {o.totalPrice > 0 ? inr(o.totalPrice) : "—"}
                    {o.totalPrice > 0 && o.totalPrice === cheapest && options.length > 1 && (
                      <span className="ml-1 text-[9px] font-semibold uppercase text-dashboard-success">lowest</span>
                    )}
                  </span>
                  <span className="block font-normal text-[10px] text-dashboard-base-content/50">
                    hotels {inr(o.hotelSubtotal)}
                    {o.hotelSubtotalOverridden && " · corrected"}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-dashboard-base-300/60">
            {days.map((d) => (
              <tr key={d.day} className="align-top">
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className="font-medium text-dashboard-base-content">Day {d.day}</span>
                  <span className="block text-[10px] text-dashboard-base-content/45 max-w-[130px] truncate">{d.title}</span>
                </td>
                {options.map((o) => {
                  const cell = o.hotelByDay[d.day];
                  return (
                    <td key={o.id} className="px-3 py-2">
                      {cell?.name ? (
                        <>
                          <span className="text-dashboard-base-content">{cell.name}</span>
                          <span className="block text-[10px] text-dashboard-base-content/50">
                            {[cell.rooms ? `${cell.rooms} room${cell.rooms !== 1 ? "s" : ""}` : null, cell.mealPlan]
                              .filter(Boolean).join(" · ")}
                            {cell.overridden && " · price corrected"}
                          </span>
                        </>
                      ) : cell?.pending ? (
                        <span className="inline-flex items-center gap-1 text-dashboard-base-content/55">
                          <Clock size={10} /> awaiting hotel team
                        </span>
                      ) : (
                        // Not "—": an unbooked night in a tier that is being
                        // quoted prices at ₹0 and quietly makes that tier look
                        // like the cheap one.
                        <span className="inline-flex items-center gap-1 text-dashboard-warning">
                          <AlertTriangle size={10} /> no hotel
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {options.some((o) => o.gapDays.length > 0) && (
        <p className="px-3 py-2 text-[11px] text-dashboard-warning border-t border-dashboard-base-300">
          {options.filter((o) => o.gapDays.length > 0).map((o) => `${stayOptionLabel(o)}: no hotel on day ${o.gapDays.join(", ")}`).join(" · ")}
          {" — those nights are priced at ₹0."}
        </p>
      )}
    </div>
  );
}
