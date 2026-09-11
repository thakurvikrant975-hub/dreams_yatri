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
import { hotelGapLabel } from "./stay-diagnostics";
import type { BuilderHotelDayLine } from "@/app/services/package-pricing.service";

type Comparison = Awaited<ReturnType<typeof getStayOptionComparison>>;

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** One night's arithmetic, in the same words as the single-stay breakdown in
 * CostingPricingPanel — "5 rooms × ₹1,800 + 2 mattresses × ₹600". A package
 * quoted at two standards used to show only the figure here, so the reviewer
 * saw mattresses booked on the day summary and nothing charging for them.
 *
 * On a corrected night `lines` are the catalog's lines for it, struck through
 * with the figure they add up to: what the correction replaced. */
function DayArithmetic({ lines, corrected }: { lines: BuilderHotelDayLine[]; corrected: boolean }) {
  if (lines.length === 0) return null;
  const several = lines.length > 1;
  return (
    <span className="block mt-0.5 space-y-0.5">
      {lines.map((l, i) => (
        <span key={i} className="block">
          <span className={cn(
            "block text-[10px] tabular-nums text-dashboard-base-content/60",
            corrected && "line-through",
          )}>
            {i > 0 && "+ "}
            {l.roomsNeeded} room{l.roomsNeeded !== 1 ? "s" : ""} × {inr(l.pricePerRoom)}
            {l.mattresses > 0 && ` + ${l.mattresses} mattress${l.mattresses !== 1 ? "es" : ""} × ${inr(l.extraBedRate)}`}
            {several && l.roomName ? ` · ${l.roomName}` : ""}
          </span>
          {!corrected && hotelGapLabel(l.gap) && (
            <span className="block text-[10px] text-dashboard-warning">{hotelGapLabel(l.gap)}</span>
          )}
        </span>
      ))}
      {corrected && (
        <span className="block text-[10px] tabular-nums text-dashboard-base-content/50">
          catalog {inr(lines.reduce((sum, l) => sum + l.total, 0))}
        </span>
      )}
    </span>
  );
}

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
                            // Every line of the night, not the first: a second
                            // room type at the same hotel is its own line, and
                            // reading only the first showed a night at the
                            // price of its primary room alone.
                            const lines = o.dayLines.filter((l) => l.day === d.day);
                            const overridden = lines.some((l) => l.overridden);
                            const line = lines.length > 0
                              ? { total: lines.reduce((sum, l) => sum + l.total, 0), overridden }
                              : null;
                            const key = `${o.id}:${d.day}`;
                            const catalog = lines.flatMap((l) => l.catalog ?? []);
                            const breakdown = (
                              <DayArithmetic
                                lines={overridden ? catalog : lines}
                                corrected={overridden}
                              />
                            );
                            if (editing === key) {
                              return (
                                <>
                                {breakdown}
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
                                </>
                              );
                            }
                            return (
                              <>
                              {breakdown}
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
                              </>
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

      {/* The breakdown under this table prices the package's own stays, which
          are the recommended option's. Said outright, or a reviewer reads the
          other column's nights against the Hotels subtotal below and finds
          they don't add up. */}
      {options.some((o) => o.isRecommended) && (
        <p className="px-3 py-2 text-[11px] text-dashboard-base-content/60 border-t border-dashboard-base-300">
          The Hotels breakdown and price below are for{" "}
          <span className="font-semibold text-dashboard-base-content">
            {options.find((o) => o.isRecommended)!.label}
          </span>
          , the recommended option. The other options are priced in full in their column above.
        </p>
      )}

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
