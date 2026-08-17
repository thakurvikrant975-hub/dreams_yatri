"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Stay tiers, in the builder.
//
// The exec quotes one trip at two or three standards — 2★, 3★, 4★ — and the
// client picks. Only the hotels differ, so the editor works on ONE tier at a
// time: this panel chooses which. Switching loads that tier's hotels into the
// day cards, and every hotel control below (the drawer, the day rail, the
// document's own inline pickers) goes on working exactly as it did — they all
// write to the same per-day fields, which now describe whichever tier is
// selected here.
//
// That is also why switching saves first. The fields being replaced are the
// previous tier's answers, and they only exist in form state until something
// persists them; dropping them on the floor because someone clicked 4★ would
// be indistinguishable from the builder losing work.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Star, Trash2, Check } from "lucide-react";
import { Button } from "@/app/(dashboard)/dashboard/(main)/components/ui/button";
import { cn } from "@/app/lib/utils";
import { useBuilder } from "./builder-context";
import { parseRoomSelections } from "@/app/(dashboard)/dashboard/(builder)/package-builder/room-cab-selections";
import {
  STAR_TIERS, stayOptionLabel,
} from "@/app/(dashboard)/dashboard/(builder)/package-builder/stay-options";
import {
  addStayOption, removeStayOption, setDefaultStayOption,
  getStayOptions, getStayOptionsWithPricing,
} from "@/app/(dashboard)/dashboard/(builder)/package-builder/stay-options.actions";

type OptionRow = {
  id: string;
  starRating: number;
  label: string | null;
  isDefault: boolean;
  totalPrice: number;
  pricePerPerson: number;
  gapDays: number[];
};

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export function StayOptionsPanel({
  packageId, activeOptionId, onActiveOptionChange, onBeforeSwitch,
}: {
  packageId: string;
  /** Null until the first load resolves, then always a real option. */
  activeOptionId: string | null;
  onActiveOptionChange: (optionId: string) => void;
  /** Persists whatever the editor currently holds, before its hotel fields are
   * replaced with another tier's. Returns false to abort the switch. */
  onBeforeSwitch: () => Promise<boolean>;
}) {
  const { form, setForm, canEdit } = useBuilder();
  const [options, setOptions] = useState<OptionRow[] | null>(null);
  const [busy, startBusy] = useTransition();
  const [switching, setSwitching] = useState(false);

  const load = useCallback(async () => {
    try {
      setOptions(await getStayOptionsWithPricing(packageId));
    } catch {
      // A failed read must not take the editor down with it — the tiers are
      // one panel, the itinerary is the page.
      setOptions([]);
    }
  }, [packageId]);

  useEffect(() => { void load(); }, [load]);

  // Adopt the default tier as the active one once the list arrives, so the
  // editor starts on the quote the client would be shown.
  useEffect(() => {
    if (!options || options.length === 0 || activeOptionId) return;
    const initial = options.find((o) => o.isDefault) ?? options[0];
    onActiveOptionChange(initial.id);
  }, [options, activeOptionId, onActiveOptionChange]);

  async function switchTo(optionId: string) {
    if (optionId === activeOptionId || switching) return;
    setSwitching(true);
    try {
      const saved = await onBeforeSwitch();
      if (!saved) return;

      const all = await getStayOptions(packageId);
      const target = all.find((o) => o.id === optionId);
      if (!target) { toast.error("That stay option no longer exists."); await load(); return; }

      const stayByDay = new Map(target.stays.map((s) => [s.day, s]));
      setForm((f) => ({
        ...f,
        itineraries: f.itineraries.map((d) => {
          const s = stayByDay.get(d.day);
          if (!s) return d;
          return {
            ...d,
            accommodation: s.accommodation ?? "",
            accommodationPhoto: s.accommodationPhoto ?? "",
            accommodationRoomPhotos: s.accommodationRoomPhotos ?? [],
            accommodationLocation: s.accommodationLocation ?? "",
            accommodationRoomSpecs: s.accommodationRoomSpecs ?? "",
            accommodationStarRating: s.accommodationStarRating ?? "",
            accommodationRoomCapacity: s.accommodationRoomCapacity ?? null,
            accommodationMaxAdults: s.accommodationMaxAdults ?? null,
            accommodationMaxChildren: s.accommodationMaxChildren ?? null,
            accommodationExtraBedCapacity: s.accommodationExtraBedCapacity ?? null,
            roomPricingId: s.roomPricingId ?? null,
            roomsCount: s.roomsCount ?? null,
            extraRooms: parseRoomSelections(s.extraRooms),
            hotelCheckIn: s.hotelCheckIn ?? "",
            hotelCheckOut: s.hotelCheckOut ?? "",
            hotelMealPlan: s.hotelMealPlan ?? "",
            manualHotelPricePerNight: s.manualHotelPricePerNight ?? null,
            hotelPending: s.hotelPending ?? false,
            hotelPendingNote: s.hotelPendingNote ?? "",
          };
        }),
      }));
      onActiveOptionChange(optionId);
      await load();
    } finally {
      setSwitching(false);
    }
  }

  const used = new Set((options ?? []).map((o) => o.starRating));
  const addable = STAR_TIERS.filter((s) => !used.has(s));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-dashboard-base-content/60 flex items-center gap-1">
          <Star size={11} /> Stay options
        </span>
        {(switching || busy) && <Loader2 size={12} className="animate-spin text-dashboard-base-content/40" />}
      </div>

      {options === null ? (
        <p className="text-[11px] text-dashboard-base-content/45">Loading…</p>
      ) : (
        <div className="space-y-1.5">
          {options.map((o) => {
            const active = o.id === activeOptionId;
            return (
              <div
                key={o.id}
                className={cn(
                  "rounded-lg border px-2.5 py-2 transition-colors",
                  active
                    ? "border-dashboard-primary bg-dashboard-primary/5"
                    : "border-dashboard-base-300 hover:bg-dashboard-base-200/60",
                )}
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => switchTo(o.id)}
                    disabled={switching}
                    className="flex-1 min-w-0 text-left"
                    title={active ? "Editing this option" : "Edit this option's hotels"}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-dashboard-base-content truncate">
                        {stayOptionLabel(o)}
                      </span>
                      {o.isDefault && (
                        <span className="text-[9px] font-semibold uppercase tracking-wide text-dashboard-base-content/50">
                          default
                        </span>
                      )}
                      {active && <Check size={11} className="text-dashboard-primary shrink-0" />}
                    </span>
                    <span className="block text-[11px] text-dashboard-base-content/60 tabular-nums">
                      {o.totalPrice > 0 ? `${inr(o.totalPrice)} · ${inr(o.pricePerPerson)} pp` : "Not priced yet"}
                    </span>
                  </button>

                  {canEdit && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      {!o.isDefault && (
                        <Button
                          type="button" variant="ghost" size="sm"
                          className="h-7 px-1.5 text-[10px]"
                          title="Print this option on the document and quote it by default"
                          disabled={busy}
                          onClick={() => startBusy(async () => {
                            const r = await setDefaultStayOption(packageId, o.id);
                            if (!r.success) toast.error(r.error);
                            await load();
                          })}
                        >
                          Set default
                        </Button>
                      )}
                      <Button
                        type="button" variant="ghost" size="sm"
                        className="h-7 w-7 p-0 text-dashboard-error"
                        title="Remove this option"
                        disabled={busy || options.length <= 1}
                        onClick={() => startBusy(async () => {
                          const r = await removeStayOption(packageId, o.id);
                          if (!r.success) { toast.error(r.error); return; }
                          if (o.id === activeOptionId) {
                            const rest = await getStayOptionsWithPricing(packageId);
                            const next = rest.find((x) => x.isDefault) ?? rest[0];
                            if (next) await switchTo(next.id);
                          }
                          await load();
                        })}
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  )}
                </div>

                {/* A tier with a night nobody has booked is not quotable — it
                    would price those nights at ₹0 and read as the cheap one. */}
                {o.gapDays.length > 0 && (
                  <p className="mt-1 text-[10px] text-dashboard-warning">
                    No hotel on day{o.gapDays.length > 1 ? "s" : ""} {o.gapDays.join(", ")}
                  </p>
                )}
              </div>
            );
          })}

          {canEdit && addable.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[10px] text-dashboard-base-content/45">Add:</span>
              {addable.map((star) => (
                <Button
                  key={star}
                  type="button" variant="outline" size="sm"
                  className="h-7 px-2 text-[11px]"
                  disabled={busy}
                  onClick={() => startBusy(async () => {
                    const r = await addStayOption(packageId, star);
                    if (!r.success) { toast.error(r.error); return; }
                    await load();
                    toast.success(`${star} Star option added — pick its hotels for each day.`);
                  })}
                >
                  <Plus size={10} className="mr-0.5" /> {star}★
                </Button>
              ))}
            </div>
          )}

          <p className="text-[11px] text-dashboard-base-content/45 pt-0.5">
            {form.itineraries.length > 0
              ? "Only hotels differ between options — days, activities and cabs are shared."
              : "Add days to the itinerary first, then pick hotels per option."}
          </p>
        </div>
      )}
    </div>
  );
}
