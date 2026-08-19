"use client";

// ─────────────────────────────────────────────────────────────────────────────
// The stay options, side by side, for whoever is checking the pricing.
//
// A package quoted at two or three standards is two or three hotels against
// the SAME night, not two or three itineraries — so this is one row per night
// with a column per option. Reading it the other way round is how a night gets
// approved at one standard and priced at another.
//
// Renders nothing for a package quoting a single stay, which is most of them:
// there is no comparison to make, and a one-column table would be noise on
// every review screen in the system.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState, useTransition } from "react";
import { AlertTriangle, Clock, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/app/lib/utils";
import { getStayOptionComparison, setStayOptionDayPrice } from "./stay-options.actions";

type Comparison = Awaited<ReturnType<typeof getStayOptionComparison>>;

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export function StayOptionsComparison({ packageId, canEdit = false, className }: {
  packageId: string;
  /** Whether this reviewer may correct a night's price. Off by default, so a
   * screen that only shows the comparison cannot accidentally offer editing. */
  canEdit?: boolean;
  className?: string;
}) {
  const [data, setData] = useState<Comparison | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const load = useCallback(() => {
    getStayOptionComparison(packageId)
      .then(setData)
      // Silent: this supplements a screen whose main job is the package
      // itself, and a failed read here must not look like a broken review.
      .catch(() => setData(null));
  }, [packageId]);

  useEffect(() => { load(); }, [load]);

  /** One night of one option, corrected. Empty clears back to the catalog
   * figure — see setStayOptionDayPrice. */
  function saveDayPrice(optionId: string, day: number, raw: string) {
    setEditing(null);
    const trimmed = raw.trim();
    const amount = trimmed === "" ? null : Number(trimmed.replace(/[^0-9.]/g, ""));
    if (amount != null && !Number.isFinite(amount)) return;
    startSaving(async () => {
      const r = await setStayOptionDayPrice(packageId, optionId, day, amount);
      if (!r.success) { toast.error(r.error); return; }
      load();
    });
  }

  if (!data || data.options.length < 2) return null;

  const { days, options } = data;
  const priced = options.map((o) => o.totalPrice ?? 0).filter((n) => n > 0);
  const cheapest = priced.length > 0 ? Math.min(...priced) : null;

  return (
    <div className={cn("rounded-xl border border-dashboard-base-300 overflow-hidden", className)}>
      <div className="px-3 py-2 border-b border-dashboard-base-300 bg-dashboard-base-200/50">
        <p className="text-xs font-semibold text-dashboard-base-content">Stay options</p>
        <p className="text-[11px] text-dashboard-base-content/55">
          The same trip at {options.length} standards — only the hotels differ. The client picks one.
          {canEdit && " Click any night's price to correct it; empty clears it back to the catalog rate."}
          {saving && <span className="ml-1 text-dashboard-primary">saving…</span>}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="bg-dashboard-base-200/30">
              <th className="text-left font-medium text-dashboard-base-content/60 px-3 py-2 whitespace-nowrap">Night</th>
              {options.map((o) => (
                <th key={o.id} className="text-left px-3 py-2 min-w-[150px] align-top">
                  <span className="flex items-center gap-1.5">
                    <span className="font-semibold text-dashboard-base-content">{o.label}</span>
                    {o.isRecommended && (
                      <span className="text-[9px] font-semibold uppercase tracking-wide text-dashboard-primary">
                        recommended
                      </span>
                    )}
                  </span>
                  <span className="block font-normal tabular-nums text-dashboard-base-content/70">
                    {(o.totalPrice ?? 0) > 0 ? inr(o.totalPrice!) : "—"}
                    {(o.totalPrice ?? 0) > 0 && o.totalPrice === cheapest && (
                      <span className="ml-1 text-[9px] font-semibold uppercase text-dashboard-success">lowest</span>
                    )}
                  </span>
                  <span className="block font-normal text-[10px] text-dashboard-base-content/50">
                    {o.hotelSubtotal != null ? `hotels ${inr(o.hotelSubtotal)}` : "not priced"}
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
                  const cell = o.byDay?.[d.day];
                  return (
                    <td key={o.id} className="px-3 py-2">
                      {cell?.hotel ? (
                        <>
                          <span className="text-dashboard-base-content">{cell.hotel}</span>
                          <span className="block text-[10px] text-dashboard-base-content/50">
                            {[cell.rooms ? `${cell.rooms} room${cell.rooms !== 1 ? "s" : ""}` : null, cell.mealPlan]
                              .filter(Boolean).join(" · ")}
                          </span>
                          {/* What this night costs in THIS column. Without it a
                              reviewer could see three hotels and one total per
                              option, and no way to tell which night made the
                              difference — or to correct just that night. */}
                          {(() => {
                            const line = o.dayLines.find((l) => l.day === d.day);
                            const key = `${o.id}:${d.day}`;
                            if (editing === key) {
                              return (
                                <input
                                  autoFocus
                                  type="text"
                                  inputMode="decimal"
                                  defaultValue={line ? String(Math.round(line.total)) : ""}
                                  placeholder="catalog"
                                  className="mt-0.5 w-24 rounded border border-dashboard-primary/50 bg-dashboard-base-100 px-1 py-0.5 text-[11px] tabular-nums outline-none"
                                  onBlur={(e) => saveDayPrice(o.id, d.day, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                    if (e.key === "Escape") setEditing(null);
                                  }}
                                />
                              );
                            }
                            return (
                              <span
                                className={cn(
                                  "mt-0.5 flex items-center gap-1 text-[11px] tabular-nums",
                                  line?.overridden
                                    ? "font-semibold text-dashboard-primary"
                                    : "text-dashboard-base-content/70",
                                  canEdit && "cursor-pointer hover:underline",
                                )}
                                onClick={canEdit ? () => setEditing(key) : undefined}
                                title={canEdit ? "Correct this night's price" : undefined}
                              >
                                {line ? inr(line.total) : "—"}
                                {line?.overridden && <span className="text-[9px] uppercase">corrected</span>}
                                {canEdit && <Pencil size={9} className="opacity-50" />}
                              </span>
                            );
                          })()}
                        </>
                      ) : cell?.pending ? (
                        <span className="inline-flex items-center gap-1 text-dashboard-base-content/55">
                          <Clock size={10} /> awaiting hotel team
                        </span>
                      ) : (
                        // Not an em dash: an unbooked night in an option being
                        // quoted prices at ₹0, which quietly makes that option
                        // look like the cheap one.
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

      {options.some((o) => o.baseRateDays.length > 0) && (
        <p className="px-3 py-2 text-[11px] text-dashboard-warning border-t border-dashboard-base-300">
          {options.filter((o) => o.baseRateDays.length > 0)
            .map((o) => `${o.label}: day ${o.baseRateDays.join(", ")}`)
            .join(" · ")}
          {" — no season rate covers those dates, so they price off the room's base rate."}
        </p>
      )}

      {options.some((o) => o.gapDays.length > 0) && (
        <p className="px-3 py-2 text-[11px] text-dashboard-warning border-t border-dashboard-base-300">
          {options.filter((o) => o.gapDays.length > 0)
            .map((o) => `${o.label}: no hotel on day ${o.gapDays.join(", ")}`)
            .join(" · ")}
          {" — those nights price at ₹0."}
        </p>
      )}
    </div>
  );
}
