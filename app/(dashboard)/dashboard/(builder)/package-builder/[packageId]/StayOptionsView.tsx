"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Stay options — the drawer where a night's stays are actually built.
//
// One stay is the normal case. A package has a single option until someone
// deliberately adds a second, nothing here requires more, and a package that
// stays at one renders exactly as it always did. Adding is an offer, never a
// step.
//
// When there are several, all of them are edited here, in one list, rather than
// behind a tab per option. Tabs were the mistake in the first attempt: they made
// each standard a separate view, which is how one quote turned into three
// documents. Seeing all three at once is the point — the exec is composing a
// comparison, and a comparison you can only see one column of is not one.
//
// Each option can be filled the three ways a stay has always been filled: from
// the hotel catalog, by hand, or by handing the night to the hotel team.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Star, Trash2, Hotel, Pencil, CheckCircle } from "./builder-icons";
import { cn } from "@/app/lib/utils";
import { Button } from "@/app/(dashboard)/dashboard/(main)/components/ui/button";
import { Input } from "@/app/(dashboard)/dashboard/(main)/components/ui/input";
import { useBuilder } from "./builder-context";
import { HotelRoomPicker } from "./HotelRoomPicker";
import { ApplyToDays } from "./ApplyToDays";
import { applyHotelRoomSelection, emptyDay, stayRun } from "./day-mutations";
import { dayCalendarDate } from "./ItineraryDocument";
import { deriveDayLocations } from "@/app/lib/route-builder-utils";
import {
  SUGGESTED_STAY_LABELS, MAX_STAY_OPTIONS, buildStayRuns,
} from "@/app/(dashboard)/dashboard/(builder)/package-builder/stay-options";
import {
  addStayOption, renameStayOption, removeStayOption,
  setRecommendedStayOption, saveStayForDay, getStayOptionsForDocument, copyStayToDays,
} from "@/app/(dashboard)/dashboard/(builder)/package-builder/stay-options.actions";

type LoadedOption = Awaited<ReturnType<typeof getStayOptionsForDocument>>[number];

/** "1, 2 and 4" — the nights a stay covers, read out the way an exec says it. */
function formatDayList(days: number[]): string {
  if (days.length === 0) return "";
  if (days.length === 1) return String(days[0]);
  return `${days.slice(0, -1).join(", ")} and ${days[days.length - 1]}`;
}

export function StayOptionsView({ packageId, day }: { packageId: string; day: number }) {
  const { form, canEdit, openDrawer, refreshStayOptions } = useBuilder();
  const [options, setOptions] = useState<LoadedOption[] | null>(null);
  const [busy, startBusy] = useTransition();
  const [newLabel, setNewLabel] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setOptions(await getStayOptionsForDocument(packageId)); }
    catch { setOptions([]); }
  }, [packageId]);

  // Loaded through its own effect rather than by calling load() directly, so
  // the state lands after the await and a drawer closed mid-flight doesn't
  // update a component that has gone.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await getStayOptionsForDocument(packageId);
        if (!cancelled) setOptions(rows);
      } catch {
        if (!cancelled) setOptions([]);
      }
    })();
    return () => { cancelled = true; };
  }, [packageId]);

  // The nights this stay covers. Picking a hotel applies to all of them,
  // because that is what a stay is — one hotel, N nights.
  //
  // Computed from the OPTIONS, the same way the document computes the block it
  // draws. stayRun() reads the day rows, which carry the recommended option
  // alone, so it would have said three nights where the document — which breaks
  // a block the moment ANY option changes hotel — was showing two. The exec
  // would have picked a hotel for the block in front of them and silently
  // written a night beyond it.
  //
  // Falls back to the day rows before the options have loaded, and for a
  // package quoting one stay, where the two agree by definition.
  const stayDayLocations = deriveDayLocations(form.stops, form.itineraries.length);
  const optionRun = (() => {
    if (!options || options.length < 2) return null;
    const runs = buildStayRuns(
      form.itineraries.map((d) => ({
        day: d.day,
        // Same grouping the document uses, or the drawer would offer to write
        // a different set of nights than the block beside it is showing.
        location: d.accommodationLocation?.trim() || stayDayLocations[d.day - 1] || null,
        byOption: Object.fromEntries(
          options.map((o) => [o.id, { hotel: o.byDay?.[d.day]?.hotel ?? null }]),
        ),
      })),
      options.map((o) => o.id),
    );
    return runs.find((r) => day >= r.fromDay && day <= r.toDay) ?? null;
  })();

  /** The day everyone goes home carries no night, so it is never counted as
   * missing a hotel — same rule the submit check uses. */
  const departureDay = Math.max(...form.itineraries.map((d) => d.day), Number.NEGATIVE_INFINITY);

  const dayRowRun = stayRun(form.itineraries, day);
  const nightCount = optionRun?.nights ?? (dayRowRun.length || 1);
  const fromDay = optionRun?.fromDay ?? dayRowRun[0] ?? day;
  const searchCity = form.itineraries.find((d) => d.day === day)?.accommodationLocation || form.destination || "";
  // The calendar date of the first night in this block — what the season
  // lookup has to be evaluated against.
  const nightDate = form.travelDate ? dayCalendarDate(form.travelDate, fromDay) : null;
  // Local, not toISOString(): that shifts to UTC and can hand the search the
  // night before for anyone east of Greenwich.
  const nightISO = nightDate
    ? `${nightDate.getFullYear()}-${String(nightDate.getMonth() + 1).padStart(2, "0")}-${String(nightDate.getDate()).padStart(2, "0")}`
    : null;

  function run(fn: () => Promise<{ success: boolean; error?: string }>) {
    startBusy(async () => {
      const r = await fn();
      if (!r.success) { toast.error(r.error ?? "That didn't work."); return; }
      await load();
      // The drawer's own list is not the one the document renders — that copy
      // lives on the page. Without this, adding, renaming or removing an option
      // here updated this panel and nothing else, and the itinerary beside it
      // kept showing the old columns until a reload.
      await refreshStayOptions();
    });
  }

  /** Writes one option's hotel across every night of this stay — in a single
   * call, so the run lands as one transaction rather than one per night. */
  async function writeStay(optionId: string, fields: Record<string, unknown>) {
    const days = Array.from({ length: nightCount }, (_, i) => fromDay + i);
    const r = await saveStayForDay(packageId, optionId, days, fields);
    if (!r.success) { toast.error(r.error); return false; }
    await load();
    await refreshStayOptions();
    return true;
  }

  if (options === null) {
    return <p className="p-4 text-xs text-dashboard-base-content/50">Loading stay options…</p>;
  }

  const canAddMore = options.length < MAX_STAY_OPTIONS;
  const unusedSuggestions = SUGGESTED_STAY_LABELS.filter(
    (s) => !options.some((o) => o.label.toLowerCase() === s.toLowerCase()),
  );

  return (
    <div className="p-3 space-y-3">
      <p className="text-[11px] text-dashboard-base-content/55">
        {nightCount > 1
          ? `These ${nightCount} nights are one stay — a hotel picked here covers all of them.`
          : "One night."}{" "}
        Quote it at one standard, or offer up to {MAX_STAY_OPTIONS} for the client to choose between.
        Only the hotels differ; the days, activities and cabs are shared, and the client gets a single PDF.
      </p>

      {options.map((o) => {
        const cell = o.byDay?.[day];
        return (
          <section
            key={o.id}
            className={cn(
              "rounded-xl border overflow-hidden",
              o.isRecommended
                ? "border-dashboard-primary bg-dashboard-primary/[0.04]"
                : "border-dashboard-base-300",
            )}
          >
            <header className="flex items-center gap-1.5 px-3 py-2 border-b border-dashboard-base-300/70">
              {renaming === o.id ? (
                <Input
                  autoFocus
                  defaultValue={o.label}
                  className="h-7 text-xs flex-1"
                  onBlur={(e) => { setRenaming(null); if (e.target.value !== o.label) run(() => renameStayOption(packageId, o.id, e.target.value)); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") setRenaming(null);
                  }}
                />
              ) : (
                <>
                  <span className="text-xs font-semibold text-dashboard-base-content">{o.label}</span>
                  {canEdit && (
                    <button type="button" title="Rename" onClick={() => setRenaming(o.id)}
                      className="text-dashboard-base-content/35 hover:text-dashboard-primary">
                      <Pencil size={10} />
                    </button>
                  )}
                </>
              )}

              <span className="flex-1" />

              {o.isRecommended ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-dashboard-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-dashboard-primary-content">
                  <CheckCircle size={9} /> Recommended
                </span>
              ) : canEdit && (
                <button
                  type="button"
                  disabled={busy}
                  title="Make this the recommended stay — the client sees it badged, and its price leads"
                  onClick={() => run(() => setRecommendedStayOption(packageId, o.id))}
                  className="rounded-full border border-dashboard-base-300 px-2 py-0.5 text-[9px] font-medium text-dashboard-base-content/60 hover:border-dashboard-primary hover:text-dashboard-primary"
                >
                  Recommend
                </button>
              )}

              {canEdit && options.length > 1 && (
                <button
                  type="button" disabled={busy} title="Remove this option"
                  onClick={() => run(() => removeStayOption(packageId, o.id))}
                  className="text-dashboard-base-content/35 hover:text-dashboard-error"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </header>

            <div className="p-3 space-y-2">
              <div className="flex items-start gap-2">
                {cell?.photo ? (
                  /* eslint-disable-next-line @next/next/no-img-element -- catalog URL */
                  <img src={cell.photo} alt="" className="w-16 aspect-video rounded-md object-cover shrink-0" />
                ) : (
                  <div className="w-16 aspect-video rounded-md bg-dashboard-base-200 flex items-center justify-center shrink-0">
                    <Hotel size={12} className="text-dashboard-base-content/25" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className={cn("text-[11.5px] font-medium truncate",
                    cell?.hotel ? "text-dashboard-base-content" : "text-dashboard-base-content/45")}>
                    {cell?.hotel || (cell?.pending ? "Waiting on the hotel team" : "No hotel yet")}
                  </p>
                  {cell?.mealPlan && (
                    <p className="text-[10px] text-dashboard-base-content/50">{cell.mealPlan}</p>
                  )}
                  {/* Which nights this option's hotel is actually on. Adding a
                      second standard used to say nothing about coverage, so an
                      exec who filled one night believed the column was done —
                      and the nights left empty priced at zero, quietly making
                      that option look like the cheapest. */}
                  <p className="mt-0.5 text-[10px] text-dashboard-base-content/55">
                    {(() => {
                      const on = form.itineraries
                        .map((d) => d.day)
                        .filter((dn) => o.byDay?.[dn]?.hotel?.trim());
                      const missing = form.itineraries
                        .map((d) => d.day)
                        .filter((dn) => dn !== departureDay && !o.byDay?.[dn]?.hotel?.trim());
                      if (on.length === 0) return "No nights assigned yet";
                      return (
                        <>
                          <span className="text-dashboard-base-content/70">
                            {on.length === 1 ? "Night" : "Nights"} {formatDayList(on)}
                          </span>
                          {missing.length > 0 && (
                            <span className="text-dashboard-warning">
                              {" · "}nothing on {missing.length === 1 ? "night" : "nights"} {formatDayList(missing)}
                            </span>
                          )}
                        </>
                      );
                    })()}
                  </p>
                </div>
              </div>

              {/* The same "apply to other days" a single hotel has had all
                  along. Without it, quoting one hotel across a four-night block
                  meant opening four days and picking it four times. */}
              {canEdit && cell?.hotel && (
                <ApplyToDays
                  sourceDay={day}
                  label={`Also use ${cell.hotel.split(" — ")[0]} on…`}
                  confirmLabel="Apply to selected nights"
                  onApply={(days) => run(() => copyStayToDays(packageId, o.id, day, days))}
                />
              )}

              {canEdit && (
                <>
                  {/* From the catalog — the only source that carries a real
                      rate, so the option can be priced. */}
                  <HotelRoomPicker
                    value={cell?.roomPricingId ?? null}
                    initialLabel={cell?.hotel ?? ""}
                    searchCity={searchCity}
                    refCoords={null}
                    // Prices this room for the night it is actually being
                    // picked for, and keeps rooms with no rate for that date
                    // out of the list entirely.
                    travelDate={nightISO}
                    placeholder={cell?.hotel ? "Change hotel…" : "Search the hotel catalog…"}
                    onSelect={async (room) => {
                      const m = applyHotelRoomSelection(emptyDay(fromDay), room);
                      await writeStay(o.id, {
                        accommodation: m.accommodation, accommodationPhoto: m.accommodationPhoto,
                        accommodationRoomPhotos: m.accommodationRoomPhotos,
                        accommodationLocation: m.accommodationLocation,
                        accommodationRoomSpecs: m.accommodationRoomSpecs,
                        accommodationStarRating: m.accommodationStarRating,
                        accommodationRoomCapacity: m.accommodationRoomCapacity,
                        accommodationMaxAdults: m.accommodationMaxAdults,
                        accommodationMaxChildren: m.accommodationMaxChildren,
                        accommodationExtraBedCapacity: m.accommodationExtraBedCapacity,
                        accommodationExtraBedRate: m.accommodationExtraBedRate,
                        roomPricingId: m.roomPricingId, roomsCount: m.roomsCount,
                        hotelCheckIn: m.hotelCheckIn, hotelCheckOut: m.hotelCheckOut,
                        hotelMealPlan: m.hotelMealPlan,
                        manualHotelPricePerNight: null, manualExtraBeds: null, manualExtraBedRate: null,
                        hotelPending: false, hotelPendingNote: null,
                      });
                    }}
                    onClear={async () => {
                      await writeStay(o.id, {
                        accommodation: null, accommodationPhoto: null, accommodationRoomPhotos: [],
                        accommodationLocation: null, accommodationRoomSpecs: null,
                        accommodationStarRating: null, roomPricingId: null, roomsCount: null,
                        hotelMealPlan: null, manualHotelPricePerNight: null,
                      });
                    }}
                  />

                  <ManualStay
                    key={`${o.id}-${cell?.hotel ?? ""}`}
                    hotel={cell?.roomPricingId == null ? cell?.hotel ?? "" : ""}
                    rate={cell?.roomPricingId == null ? null : null}
                    onSave={(name, rate) => writeStay(o.id, {
                      accommodation: name || null,
                      // A hand-typed stay has no catalog rate behind it, so it
                      // carries its own per-night price or it prices at zero.
                      manualHotelPricePerNight: rate,
                      roomPricingId: null,
                      hotelPending: false, hotelPendingNote: null,
                    })}
                  />

                  {/* Handing the night to the hotel team.
                      Offered on the recommended option only, and that is a
                      limitation rather than a decision: the hotel team's queue
                      is built from the day rows, which mirror the recommended
                      stay, and the fill/reject flow writes back to them. A
                      request raised on another option would set a flag nobody
                      reads — the button would report success and the team
                      would never see it, which is worse than not offering it.
                      Says so, rather than failing quietly. */}
                  {o.isRecommended ? (
                    <button
                      type="button"
                      onClick={() => openDrawer({ kind: "hotel-request", day })}
                      className="w-full rounded-lg border border-dashed border-dashboard-base-300 px-2 py-1.5 text-[11px] text-dashboard-base-content/60 hover:border-dashboard-primary hover:text-dashboard-primary"
                    >
                      Ask the hotel team to source this one
                    </button>
                  ) : (
                    <p className="rounded-lg bg-dashboard-base-200/60 px-2 py-1.5 text-[10.5px] text-dashboard-base-content/50">
                      The hotel team&apos;s queue only picks up the recommended stay. To have them
                      source this one, recommend it first — or pick its hotel here.
                    </p>
                  )}
                </>
              )}
            </div>
          </section>
        );
      })}

      {canEdit && canAddMore && (
        <div className="rounded-xl border border-dashed border-dashboard-base-300 p-3 space-y-2">
          <p className="flex items-center gap-1 text-[11px] font-medium text-dashboard-base-content/60">
            <Star size={11} /> Offer another option
          </p>
          <div className="flex gap-1.5">
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newLabel.trim()) {
                  run(async () => { const r = await addStayOption(packageId, newLabel); if (r.success) setNewLabel(""); return r; });
                }
              }}
              placeholder="Name it — e.g. Deluxe, Beachfront"
              className="h-8 text-xs"
            />
            <Button
              type="button" size="sm" className="h-8 text-xs"
              disabled={busy || !newLabel.trim()}
              onClick={() => run(async () => { const r = await addStayOption(packageId, newLabel); if (r.success) setNewLabel(""); return r; })}
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            </Button>
          </div>
          {unusedSuggestions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[10px] text-dashboard-base-content/40">or:</span>
              {unusedSuggestions.map((sug) => (
                <button
                  key={sug} type="button" disabled={busy}
                  onClick={() => run(() => addStayOption(packageId, sug))}
                  className="rounded-full border border-dashboard-base-300 px-2 py-0.5 text-[10px] text-dashboard-base-content/60 hover:border-dashboard-primary hover:text-dashboard-primary"
                >
                  {sug}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** A stay typed by hand — the third source, for a property that isn't in the
 * catalog. It carries its own per-night rate because there is no catalog row
 * behind it to price from. */
function ManualStay({ hotel, rate, onSave }: {
  hotel: string;
  rate: number | null;
  onSave: (name: string, rate: number | null) => void | Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(hotel);
  const [price, setPrice] = useState(rate != null ? String(rate) : "");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-dashed border-dashboard-base-300 px-2 py-1.5 text-[11px] text-dashboard-base-content/60 hover:border-dashboard-primary hover:text-dashboard-primary"
      >
        {hotel ? "Edit the hand-typed stay" : "Type a stay by hand instead"}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-dashboard-base-300 p-2 space-y-1.5">
      <Input value={name} onChange={(e) => setName(e.target.value)}
        placeholder="Hotel — Room, as the client should read it" className="h-8 text-xs" />
      <Input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min={0}
        placeholder="Per-night rate (this option prices at 0 without it)" className="h-8 text-xs" />
      <div className="flex gap-1.5">
        <Button type="button" size="sm" className="h-7 text-[11px] flex-1"
          onClick={async () => {
            await onSave(name.trim(), price.trim() === "" ? null : Number(price));
            setOpen(false);
          }}
        >
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
