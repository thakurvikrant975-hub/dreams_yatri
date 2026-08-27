"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Hotel, LogIn, LogOut, BedDouble, ClipboardList, StickyNote, Camera, XCircle, Ban, Search, Link2, Link2Off, Loader2, DatabaseZap, MapPin, AlertTriangle, CalendarRange, CalendarDays } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { cn } from "@/app/lib/utils";
import { fillPendingHotel, rejectPendingHotel } from "../actions";
import { searchHotelRoomsForBuilder, type HotelRoomResult } from "@/app/(dashboard)/dashboard/(builder)/package-builder/action";
import { findSimilarHotels, quickCreateHotelRate, addRateToHotel } from "../catalog-actions";
import { LocationSearchSelect } from "../../components/location/LocationSearchSelect";
import type { LocationValue } from "../../components/location/location.types";
import { SeasonalRateCalendar } from "../../components/ui/seasonal-rate-calendar";
import { type RateSeasonBase, defaultRangeLabel } from "../../components/ui/seasonal-rate-calendar-logic";
import type { HotelSeasonInput } from "../../hotels/actions";
import { TimeSelect } from "./TimeSelect";
import { ImageDropField } from "@/app/(dashboard)/dashboard/(builder)/package-builder/[packageId]/ImageDropField";

// Mirrors STAY_LABELS in package-builder/[packageId]/page.tsx — the exec's
// Hotel Type request is stored as one of these keys.
const STAY_LABELS: Record<string, string> = {
    STAR_3: "3★ Hotel", STAR_4: "4★ Hotel", STAR_5: "5★ Hotel",
    BOUTIQUE: "Boutique", HOMESTAY: "Homestay",
    RESORT: "Resort", CAMP: "Camp", BUDGET: "Budget",
};

// Mirrors MEAL_OPTIONS/MEAL_KEY_LABELS in package-builder/[packageId]/page.tsx
// — same meal categories, same lowercase covered_meals keys from meal_types,
// so a plan picked here lights up the same chips a catalog room would.
const MEAL_OPTIONS = ["Breakfast", "Lunch", "Dinner", "Tea & Snacks"];
const MEAL_KEY_LABELS: Record<string, string> = {
    breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner",
};

// The exec's request keys aren't the catalog's vocabulary: hotels.stay_type is
// free text ("4 Star") and hotels.category is a slug ("resort"). Mapping them
// here means a quick-created property arrives already classified the way the
// rest of the catalog is, instead of blank.
const REQUEST_STAY_TYPE: Record<string, string> = {
    STAR_3: "3 Star", STAR_4: "4 Star", STAR_5: "5 Star",
};
const REQUEST_CATEGORY: Record<string, string> = {
    RESORT: "resort", HOMESTAY: "homestay", CAMP: "camp", BOUTIQUE: "boutique_hotel",
};

type MealType = { id: number; name: string; covered_meals: string[] };
type SimilarHotel = Awaited<ReturnType<typeof findSimilarHotels>>[number];

/**
 * A season captured off the hotel's rate sheet, in the shape the shared
 * SeasonalRateCalendar speaks — the same one the hotel dashboard's pricing tab
 * uses, so a rate entered on a request is not a second, divergent idea of what
 * seasonal pricing means.
 *
 * `rate` is the weekday price; the weekend override rides alongside it, because
 * rate sheets routinely price Saturday and Sunday differently within the very
 * same season.
 */
type FillSeason = RateSeasonBase & {
    weekendPrice?: number | null;
    extraBedRate?: number | null;
    weekendExtraBedRate?: number | null;
};

/** The calendar edits one rate here, so the item id is a constant. */
const FILL_ITEM_ID = "fill";

const seasonExtraFieldClass =
    "w-full h-8 rounded border border-dashboard-border px-2 text-xs bg-white";

export function FillHotelForm({
    packageId, day, location, dateLabel, paxLabel, note,
    requestedType, requestedRooms, requestedMattresses, requestedMealPlan, mealTypes,
    rejectedAt, rejectedByName, rejectionNote, dayDateISO, siblingDays = [], groupDays = [],
}: {
    packageId: string;
    day: number;
    location: string | null;
    dateLabel: string | null;
    paxLabel: string;
    note: string | null;
    /** What the sales exec asked for when flagging this day — see
     * HotelRequestPanel in the package builder. Rooms/mattresses/meal plan
     * prefill this form's own fields below (still freely editable) so the
     * hotel team starts from what was requested instead of blank defaults. */
    requestedType?: string | null;
    requestedRooms?: number | null;
    requestedMattresses?: number | null;
    requestedMealPlan?: string | null;
    /** Plans configured at /dashboard/hotels/meal-types — picking one below
     * auto-checks its covered_meals as Breakfast/Lunch/Dinner chips, same as
     * picking a catalog room does in the main builder. */
    mealTypes: MealType[];
    /** Set when THIS day was already rejected on a previous visit (not yet
     * resolved by the exec resubmitting) — shown as a standing banner above
     * the form, which stays usable in case something turns up after all. */
    rejectedAt?: Date | null;
    rejectedByName?: string | null;
    rejectionNote?: string | null;
    /** This day's travel date as YYYY-MM-DD, so a catalog rate is priced for
     * the night actually being sold rather than at its off-season base. */
    dayDateISO?: string | null;
    /** The package's other still-pending days, so one stay covering several
     * nights can be filled from a single submit instead of once per day. */
    siblingDays?: { day: number; location: string | null }[];
    /** The further days this card already covers — consecutive pending days
     * asking for the same thing in the same town, which the queue groups into
     * one form rather than rendering the same request several times over (see
     * the grouping in page.tsx). Ticked on arrival; still untickable, in which
     * case the day comes back as its own card on the next load. */
    groupDays?: number[];
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [hotelName, setHotelName] = useState("");
    const [roomName, setRoomName] = useState("");
    const [roomsCount, setRoomsCount] = useState(String(requestedRooms ?? 1));
    const [extraBeds, setExtraBeds] = useState(String(requestedMattresses ?? 0));
    const [extraBedRate, setExtraBedRate] = useState("");
    const [pricePerNight, setPricePerNight] = useState("");
    const [roomSpecs, setRoomSpecs] = useState("");
    const [checkIn, setCheckIn] = useState("");
    const [checkOut, setCheckOut] = useState("");
    const [hotelPhoto, setHotelPhoto] = useState("");
    const [roomPhotos, setRoomPhotos] = useState<string[]>(["", "", ""]);
    const [notes, setNotes] = useState("");
    const [mealPlan, setMealPlan] = useState(requestedMealPlan ?? "");
    const requestedPlanMatch = mealTypes.find((m) => m.name === requestedMealPlan);
    const [meals, setMeals] = useState<string[]>(
        requestedPlanMatch ? requestedPlanMatch.covered_meals.map((k) => MEAL_KEY_LABELS[k] ?? k) : [],
    );
    const [done, setDone] = useState(false);
    // The catalog rate this fill is linked to, when the admin picked one out of
    // the search instead of typing a hotel in. Dropped the moment they edit the
    // hotel, room or price away from it — see dropLink below.
    const [linked, setLinked] = useState<HotelRoomResult | null>(null);
    const [catalogQuery, setCatalogQuery] = useState("");
    const [results, setResults] = useState<HotelRoomResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [searched, setSearched] = useState(false);
    // Saving to the catalog is the default, not an extra step someone has to
    // remember — leaving it off is what produced a catalog that never grew.
    const [saveToCatalog, setSaveToCatalog] = useState(true);
    const [city, setCity] = useState((location ?? "").split(",")[0]?.trim() ?? "");
    const [stayType, setStayType] = useState(requestedType ? (REQUEST_STAY_TYPE[requestedType] ?? "") : "");
    const [pin, setPin] = useState<LocationValue | null>(null);
    const [validFrom, setValidFrom] = useState(dayDateISO ?? "");
    // Defaults to the last night this fill covers, not just this one. The window
    // becomes the rate's season (see quotedSeason), and a season that stopped at
    // the first night would leave every other night it was quoted for priced off
    // the base rate — which is exactly what markPackageReady refuses.
    const [validTo, setValidTo] = useState("");
    const [validToTouched, setValidToTouched] = useState(false);
    const [similar, setSimilar] = useState<SimilarHotel[]>([]);
    // Set when the admin recognises one of the near-matches as the property on
    // the phone: the rate is added to that hotel instead of creating a second one.
    const [attachTo, setAttachTo] = useState<SimilarHotel | null>(null);
    // The queue has already worked out which nights are one stay — consecutive
    // pending days asking for the same thing in the same town — and hands them
    // over as groupDays, so this starts from that rather than re-deriving it
    // from a town-name string match. Anything outside the group starts clear
    // and is one tick away; the admin sees each day's town next to the box.
    const [alsoDays, setAlsoDays] = useState<number[]>(groupDays);
    // Derived rather than stored, so it follows the day selection without an
    // effect writing state on every change — until the admin types their own,
    // which wins from then on.
    const defaultValidTo = useMemo(() => {
        if (!dayDateISO) return "";
        const end = new Date(`${dayDateISO}T00:00:00Z`);
        end.setUTCDate(end.getUTCDate() + (Math.max(day, ...alsoDays) - day));
        return end.toISOString().slice(0, 10);
    }, [dayDateISO, day, alsoDays]);
    const effectiveValidTo = validToTouched ? validTo : defaultValidTo;
    // "Day 3" or "Days 1–3" / "Days 1, 3" — the header has to say what this one
    // submit is about to write, or a card covering three nights reads as a card
    // covering one and the count of what is left is wrong in the admin's head.
    const coveredDays = [day, ...alsoDays].sort((a, b) => a - b);
    const isRun = coveredDays.every((d, i) => i === 0 || d === coveredDays[i - 1] + 1);
    const coveredLabel = coveredDays.length === 1
        ? `Day ${day}`
        : `Days ${isRun
            ? `${coveredDays[0]}–${coveredDays[coveredDays.length - 1]}`
            : coveredDays.join(", ")}`;

    /**
     * Why Save Hotel is greyed out, in words.
     *
     * These conditions were only ever expressed as a disabled attribute, so the
     * admin clicked a dead button and got nothing back — most painfully on the
     * last one, where the blocker is a map pin most of the way up a long form,
     * for a catalog save they never explicitly asked for (it is on by default).
     * "The fill isn't working" is exactly what that looks like from the outside.
     */
    const blockedReason =
        !hotelName.trim() ? "Enter the hotel's name to save this day."
            : !(parseFloat(pricePerNight) > 0) ? "Enter the B2B price per night to save this day."
                // Creating a property without coordinates makes one nobody can
                // find by distance; adding a rate to an existing hotel or
                // linking one needs no pin.
                : (saveToCatalog && !linked && !attachTo && !city.trim())
                    ? "Add the town above — it's how the builder finds this hotel later. Or untick \"Save this hotel and rate to the catalog\" to just fill the day."
                    : (saveToCatalog && !linked && !attachTo && !pin)
                        ? "Pick the hotel's location on the map above so execs can find it by distance. Or untick \"Save this hotel and rate to the catalog\" to just fill the day."
                        : null;
    // Weekend rates live on seasons here, and deliberately not on the rate row
    // itself. Both resolvers — resolveHotelSeasonPricing and rates.ts's
    // resolvePlanNight — only ever consult a weekend price inside a matched
    // season; hotel_room_pricing.weekend_price_per_night is never read when no
    // season covers the date, so a field for it would look like it worked and
    // silently do nothing. A blanket weekend rate is one all-year band in the
    // calendar, which is also how the catalog already does it in practice.
    const [seasons, setSeasons] = useState<FillSeason[]>([]);
    // A rate this form already wrote to the catalog. The catalog write comes
    // first, so a fill that then fails would otherwise leave the hotel saved and
    // create a second copy of it on the retry. Remembering it makes the retry
    // reuse what is already there.
    const [createdRateId, setCreatedRateId] = useState<number | null>(null);
    const [calendarOpen, setCalendarOpen] = useState(false);
    const [rejecting, setRejecting] = useState(false);
    const [rejectReason, setRejectReason] = useState("");
    const [rejectDone, setRejectDone] = useState(false);

    // Scoped to the town the exec asked for, so the first thing the admin sees
    // is what this catalog already has there. searchHotelRoomsForBuilder takes
    // the city ahead of the comma, and a typed query reaches beyond it for a
    // property that sits in the next town over.
    useEffect(() => {
        const city = location ?? "";
        const q = catalogQuery.trim();
        let cancelled = false;
        // Every state change sits inside the timer rather than the effect body:
        // the debounce is what this effect is for, and setting state up front
        // would re-render on each keystroke to no purpose.
        const t = setTimeout(() => {
            if (cancelled) return;
            if (!city && !q) { setResults([]); setSearched(false); return; }
            setSearching(true);
            searchHotelRoomsForBuilder(
                city, q, null, 1, null, null, null, "price_asc", null,
                // The date prices each rate for the night being sold, but must
                // not also filter results down to rates that have a season
                // covering it — that would hide every base-rate property,
                // including the ones this very form creates.
                dayDateISO ?? null, null, false,
            )
                .then((res) => {
                    if (cancelled) return;
                    setResults(res.rows.slice(0, 6));
                    setSearched(true);
                })
                .catch(() => { if (!cancelled) setResults([]); })
                .finally(() => { if (!cancelled) setSearching(false); });
        }, 250);
        return () => { cancelled = true; clearTimeout(t); };
    }, [catalogQuery, location, dayDateISO]);

    // Runs off the hotel name as it is typed, so the warning is in front of the
    // admin before they commit — after the fact it is just a duplicate.
    useEffect(() => {
        const n = hotelName.trim();
        let cancelled = false;
        const t = setTimeout(() => {
            if (cancelled) return;
            if (linked || !saveToCatalog || n.length < 3) { setSimilar([]); return; }
            findSimilarHotels(n, city)
                .then((rows) => { if (!cancelled) setSimilar(rows); })
                .catch(() => { if (!cancelled) setSimilar([]); });
        }, 350);
        return () => { cancelled = true; clearTimeout(t); };
    }, [hotelName, city, linked, saveToCatalog]);

    /** Copies a catalog rate into the form and remembers what it came from. */
    function pickRate(r: HotelRoomResult) {
        setLinked(r);
        setHotelName(r.hotelName);
        setRoomName(r.roomName);
        setPricePerNight(String(r.pricePerNight));
        if (r.extraBedRate != null) setExtraBedRate(String(r.extraBedRate));
        if (r.roomSpecs) setRoomSpecs(r.roomSpecs);
        if (r.checkInTime) setCheckIn(r.checkInTime);
        if (r.checkOutTime) setCheckOut(r.checkOutTime);
        // The resolved display URLs, NOT the storage keys alongside them.
        //
        // This was the other way round, on the belief that a day row holds keys
        // and something prefixes them at render time. Nothing does: the builder
        // document, the PDF and the client-facing package page all render
        // accommodationPhoto raw, and every other writer (the builder's own
        // hotel picker, ImageDropField) stores a full URL. A key written here
        // resolved against the page's own origin, so a filled hotel arrived at
        // the exec with no photo at all.
        if (r.hotelPhoto) setHotelPhoto(r.hotelPhoto);
        if (r.roomPhotos.length) {
            setRoomPhotos([r.roomPhotos[0] ?? "", r.roomPhotos[1] ?? "", r.roomPhotos[2] ?? ""]);
        }
        if (r.mealPlanName) {
            const plan = mealTypes.find((m) => m.name === r.mealPlanName);
            if (plan) selectMealPlan(plan);
            else setMealPlan(r.mealPlanName);
        }
        setCatalogQuery("");
    }

    /**
     * Any edit to what the link asserts breaks it. Costing prefers the linked
     * rate over the typed price, so a link left in place after the admin typed
     * a different number would quietly sell at the catalog rate instead of the
     * one they negotiated.
     */
    function dropLink() { setLinked(null); }

    function toggleMeal(m: string) {
        setMeals((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
    }

    function selectMealPlan(plan: MealType) {
        setMealPlan(plan.name);
        setMeals(plan.covered_meals.map((k) => MEAL_KEY_LABELS[k] ?? k));
    }

    function setRoomPhotoAt(index: number, url: string) {
        setRoomPhotos((prev) => prev.map((p, i) => (i === index ? url : p)));
    }

    function handleSubmit() {
        startTransition(async () => {
          try {
              // The catalog write happens first: if it fails, the day stays pending
              // and the admin can retry or turn the switch off, rather than ending
              // up with a filled day and a silently lost hotel.
              // One name for both sides. The catalog needs a room to hang the rate
              // on, so a blank falls back to "Standard Room" — and the day has to
              // say the same thing, or the itinerary and the catalog disagree
              // about what was booked.
              const willCreate = linked == null && createdRateId == null && saveToCatalog && !!hotelName.trim();
              const effectiveRoomName = willCreate ? (roomName.trim() || "Standard Room") : roomName.trim();

              let linkId: number | null = linked?.id ?? createdRateId;
              if (linkId == null && saveToCatalog && hotelName.trim()) {
                  const shared = {
                      roomName: effectiveRoomName,
                      pricePerNight: parseFloat(pricePerNight) || 0,
                      packageId,
                      day,
                      mealTypeId: mealTypes.find((m) => m.name === mealPlan)?.id ?? null,
                      extraBedRate: parseFloat(extraBedRate) || null,
                      validFrom: validFrom || null,
                      validTo: effectiveValidTo || null,
                      seasons: seasons.map<HotelSeasonInput>((s) => ({
                          season_name: s.label || defaultRangeLabel(s.startDate, s.endDate),
                          valid_from: s.startDate,
                          valid_to: s.endDate,
                          price_per_night: s.rate,
                          weekend_price_per_night: s.weekendPrice ?? null,
                          extra_bed_rate: s.extraBedRate ?? null,
                          weekend_extra_bed_rate: s.weekendExtraBedRate ?? null,
                          color: s.color,
                          is_active: true,
                      })),
                  };
                  const saved = attachTo
                      ? await addRateToHotel({ ...shared, hotelId: attachTo.id })
                      : await quickCreateHotelRate({
                          ...shared,
                          name: hotelName.trim(),
                          city: city.trim(),
                          state: pin?.state_name ?? null,
                          stayType: stayType || null,
                          category: requestedType ? (REQUEST_CATEGORY[requestedType] ?? null) : null,
                          latitude: pin?.latitude ?? NaN,
                          longitude: pin?.longitude ?? NaN,
                      });
                  if (!saved.success) {
                      toast.error(saved.error ?? "Couldn't save this hotel to the catalog.");
                      return;
                  }
                  linkId = saved.roomPricingId ?? null;
                  setCreatedRateId(linkId);
              }

              const result = await fillPendingHotel(packageId, day, {
                  hotelName,
                  roomName: effectiveRoomName,
                  roomsCount: parseInt(roomsCount, 10) || 1,
                  extraBeds: parseInt(extraBeds, 10) || 0,
                  extraBedRate: parseFloat(extraBedRate) || 0,
                  pricePerNight: parseFloat(pricePerNight) || 0,
                  roomSpecs,
                  checkIn,
                  checkOut,
                  hotelPhoto,
                  roomPhotos: roomPhotos.filter(Boolean),
                  mealPlan,
                  meals,
                  note: notes,
                  roomPricingId: linkId,
                  alsoDays,
              });
              if (result.success) {
                  setDone(true);
                  const filled = result.filledDays ?? [day];
                  const unpriced = result.unpricedDays ?? [];
                  if (unpriced.length > 0) {
                      // Saved, but costing would show this night at ₹0 — and the
                      // person who just spoke to the hotel is the only one who can
                      // put a price on it. Sticky, because it must not scroll past.
                      toast.error(
                          `Saved, but day${unpriced.length === 1 ? "" : "s"} ${unpriced.join(", ")} `
                          + "still has no price for costing — reopen the day and set the B2B rate, "
                          + "or costing will show it as ₹0.",
                          { duration: Infinity },
                      );
                  } else {
                      toast.success(
                          result.allDaysFilled
                              ? `Hotel filled for ${filled.length} day${filled.length === 1 ? "" : "s"} — every day is done. Back to the sales exec to submit.`
                              : filled.length > 1
                                  ? `Hotel filled for days ${filled.join(", ")}`
                                  : "Hotel filled for this day",
                      );
                  }
                  // Nothing left to do on this package, so don't leave the admin
                  // parked on a page whose entire purpose is finished — the queue
                  // is where the next request is, and getting back to it used to
                  // mean a manual reload followed by re-navigating from the
                  // sidebar. Days still outstanding stay put and just refresh, so
                  // the next form on this package is already in front of them.
                  if (result.allDaysFilled) {
                      router.push("/dashboard/hotel-requests-v2");
                  } else {
                      router.refresh();
                  }
              } else if (linkId != null && !linked) {
                  toast.error(
                      `${result.error ?? "Failed to save"} — the hotel and rate were saved to the catalog, `
                      + "so trying again won't create a second copy.",
                  );
              } else {
                  toast.error(result.error ?? "Failed to save");
              }
          } catch (e) {
            // The catalog writes above are ordinary server actions and can throw
            // for reasons this form can do nothing about (a dropped connection
            // mid-submit being the common one). Unhandled, that error unwinds
            // out to the global error page and the admin loses the form they
            // just filled in. Caught, the form is still sitting there with
            // every field intact, ready to be submitted again.
            console.error("[FillHotelForm] submit failed", e);
            toast.error("Couldn't save this hotel — nothing has been lost, try submitting again.");
          }
        });
    }

    function handleReject() {
        if (!rejectReason.trim()) { toast.error("A reason is required to reject a hotel request."); return; }
        startTransition(async () => {
            try {
                const result = await rejectPendingHotel(packageId, day, rejectReason);
                if (result.success) {
                    setRejectDone(true);
                    toast.success(`Day ${day} marked rejected — the sales exec has been notified.`);
                    router.refresh();
                } else {
                    toast.error(result.error ?? "Failed to reject");
                }
            } catch (e) {
                // See handleSubmit's catch — an uncaught error here takes the
                // whole page out rather than just failing the click.
                console.error("[FillHotelForm] reject failed", e);
                toast.error("Couldn't reject this day — try again.");
            }
        });
    }

    if (done) {
        return (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 flex items-center gap-2 text-emerald-800 text-sm font-medium">
                <CheckCircle2 className="size-4 shrink-0" /> {coveredLabel} filled — {hotelName}{roomName ? ` — ${roomName}` : ""}
            </div>
        );
    }

    if (rejectDone) {
        return (
            <div className="rounded-xl border border-red-300 bg-red-50 p-4 flex items-center gap-2 text-red-800 text-sm font-medium">
                <XCircle className="size-4 shrink-0" /> Day {day} marked rejected — the sales exec has been notified.
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Hotel className="size-4 text-amber-600 shrink-0" />
                    <div>
                        <p className="text-sm font-semibold text-dashboard-base-content">{coveredLabel}{location ? ` · ${location}` : ""}</p>
                        <p className="text-xs text-dashboard-neutral">{[dateLabel, paxLabel].filter(Boolean).join(" · ")}</p>
                    </div>
                </div>
                {!rejecting && (
                    <Button
                        type="button" size="sm" variant="outline"
                        className="h-7 shrink-0 text-xs gap-1 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                        onClick={() => setRejecting(true)}
                    >
                        <Ban className="size-3" /> Reject
                    </Button>
                )}
            </div>

            {rejectedAt && (
                <div className="rounded-md border border-red-200 bg-red-50 px-2.5 py-2 space-y-1">
                    <p className="text-[11px] font-semibold text-red-800 flex items-center gap-1">
                        <XCircle className="size-3" /> You already rejected this day
                        {rejectedByName ? ` (${rejectedByName})` : ""}
                    </p>
                    {rejectionNote && (
                        <p className="text-xs text-red-800 bg-white/70 border border-red-200 rounded-md px-2 py-1.5">
                            &quot;{rejectionNote}&quot;
                        </p>
                    )}
                    <p className="text-[11px] text-red-700/80">
                        Still awaiting the sales exec to update the request — fill it below if something turns up.
                    </p>
                </div>
            )}

            <SeasonalRateCalendar<FillSeason>
                open={calendarOpen}
                onOpenChange={setCalendarOpen}
                title="Season rates"
                subtitle={hotelName ? `${hotelName}${roomName ? ` — ${roomName}` : ""}` : `Day ${day}`}
                items={[{
                    id: FILL_ITEM_ID,
                    label: roomName.trim() || "This room",
                    baseRate: parseFloat(pricePerNight) || 0,
                    baseWeekendRate: null,
                }]}
                activeItemId={FILL_ITEM_ID}
                // Only ever one rate is being edited here, so there is nothing
                // for the item switcher to switch to.
                onActiveItemChange={() => {}}
                seasons={seasons}
                onSave={(next) => setSeasons(next)}
                unitLabel="per night"
                getDefaultDraft={(item) => ({ weekendPrice: item.baseWeekendRate ?? null })}
                // Two ranges only share a colour when every rate on them matches,
                // so a season that differs solely at the weekend still reads as
                // its own band on the calendar.
                getGroupKey={(sn) => `${sn.rate}|${sn.weekendPrice ?? sn.rate}|${sn.extraBedRate ?? "none"}`}
                getSeasonWeekendRate={(sn) => sn.weekendPrice}
                renderRateExtra={({ draft, onChange: onExtraChange }) => (
                    <div>
                        <label className="text-[10px] text-dashboard-neutral mb-0.5 block">Weekend price (₹)</label>
                        <input
                            type="number" min={0}
                            placeholder="Same as weekday"
                            value={(draft.weekendPrice as number | null | undefined) ?? ""}
                            onChange={(e) => onExtraChange({ weekendPrice: e.target.value ? Number(e.target.value) : null })}
                            className={seasonExtraFieldClass}
                        />
                    </div>
                )}
                renderExtraFields={({ draft, onChange: onExtraChange }) => (
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[10px] text-dashboard-neutral mb-0.5 block">Extra bed (₹)</label>
                            <input
                                type="number" min={0}
                                placeholder="optional"
                                value={(draft.extraBedRate as number | null | undefined) ?? ""}
                                onChange={(e) => onExtraChange({ extraBedRate: e.target.value ? Number(e.target.value) : null })}
                                className={seasonExtraFieldClass}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-dashboard-neutral mb-0.5 block">Weekend extra bed (₹)</label>
                            <input
                                type="number" min={0}
                                placeholder="Same as weekday"
                                value={(draft.weekendExtraBedRate as number | null | undefined) ?? ""}
                                onChange={(e) => onExtraChange({ weekendExtraBedRate: e.target.value ? Number(e.target.value) : null })}
                                className={seasonExtraFieldClass}
                            />
                        </div>
                    </div>
                )}
            />

            {rejecting && (
                <div className="rounded-md border border-red-200 bg-red-50 px-2.5 py-2 space-y-2">
                    <label className="text-[11px] font-semibold text-red-800 flex items-center gap-1">
                        <Ban className="size-3" /> Reason for rejecting Day {day}
                    </label>
                    <Textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="e.g. Nothing available in this budget/area for these dates"
                        rows={2}
                        className="text-sm resize-none bg-white"
                    />
                    <div className="flex items-center gap-2">
                        <Button
                            type="button" size="sm"
                            className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white"
                            disabled={isPending || !rejectReason.trim()}
                            onClick={handleReject}
                        >
                            {isPending ? "Rejecting…" : "Confirm Reject"}
                        </Button>
                        <Button
                            type="button" size="sm" variant="ghost"
                            className="h-8 text-xs"
                            onClick={() => { setRejecting(false); setRejectReason(""); }}
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            )}

            {(requestedType || requestedRooms || requestedMattresses || requestedMealPlan || note) && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 space-y-1.5">
                    <p className="text-[11px] font-semibold text-amber-800 flex items-center gap-1">
                        <ClipboardList className="size-3" /> Sales exec requested
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        {requestedType && (
                            <span className="inline-flex items-center rounded-full bg-white border border-amber-300 text-amber-800 text-[11px] font-medium px-2 py-0.5">
                                {STAY_LABELS[requestedType] ?? requestedType}
                            </span>
                        )}
                        {!!requestedRooms && (
                            <span className="inline-flex items-center rounded-full bg-white border border-amber-300 text-amber-800 text-[11px] font-medium px-2 py-0.5">
                                {requestedRooms} room{requestedRooms !== 1 ? "s" : ""}
                            </span>
                        )}
                        {!!requestedMattresses && (
                            <span className="inline-flex items-center rounded-full bg-white border border-amber-300 text-amber-800 text-[11px] font-medium px-2 py-0.5">
                                {requestedMattresses} mattress{requestedMattresses !== 1 ? "es" : ""}
                            </span>
                        )}
                        {requestedMealPlan && (
                            <span className="inline-flex items-center rounded-full bg-white border border-amber-300 text-amber-800 text-[11px] font-medium px-2 py-0.5">
                                {requestedMealPlan}
                            </span>
                        )}
                    </div>
                    {note && (
                        <p className="text-xs text-amber-800 bg-white/70 border border-amber-200 rounded-md px-2 py-1.5">
                            &quot;{note}&quot;
                        </p>
                    )}
                </div>
            )}

            {/* Search the catalog before typing anything. A hotel already on
                file costs one click and links the day to its real rate; only a
                property genuinely not in the catalog needs the fields below. */}
            <div className="rounded-md border border-dashboard-border bg-dashboard-muted/40 px-2.5 py-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                    <label className="text-[11px] font-semibold text-dashboard-neutral flex items-center gap-1">
                        <Search className="size-3" /> Search hotels already on file
                        {location && <span className="font-normal opacity-70">in {location.split(",")[0]}</span>}
                    </label>
                    {searching && <Loader2 className="size-3 animate-spin text-dashboard-neutral" />}
                </div>

                <Input
                    value={catalogQuery}
                    onChange={(e) => setCatalogQuery(e.target.value)}
                    placeholder={location ? `Hotel name — or another town` : "Hotel name or town"}
                    className="text-sm h-9 bg-white"
                />

                {linked ? (
                    <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5">
                        <Link2 className="size-3.5 text-emerald-700 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold text-emerald-900 leading-snug">
                                Linked to {linked.hotelName} — {linked.roomName}
                            </p>
                            <p className="text-[10px] text-emerald-800">
                                Priced from the catalog{linked.isSeasonalRate ? " at this date's season rate" : ""}. Saved to the package and reusable.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={dropLink}
                            className="text-[10px] text-emerald-800 hover:text-emerald-950 underline underline-offset-2 shrink-0 inline-flex items-center gap-0.5"
                        >
                            <Link2Off className="size-3" /> Unlink
                        </button>
                    </div>
                ) : results.length > 0 ? (
                    <div className="divide-y divide-dashboard-border rounded-md border border-dashboard-border bg-white overflow-hidden">
                        {results.map((r) => (
                            <button
                                key={r.id}
                                type="button"
                                onClick={() => pickRate(r)}
                                className="w-full text-left px-2.5 py-2 hover:bg-emerald-50/60 transition-colors flex items-start gap-2"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold text-dashboard-text leading-snug truncate">
                                        {r.hotelName}
                                    </p>
                                    <p className="text-[10px] text-dashboard-neutral truncate">
                                        {r.roomName}
                                        {r.mealPlanName ? ` · ${r.mealPlanName}` : ""}
                                        {r.location ? ` · ${r.location}` : ""}
                                    </p>
                                    {/* Whether this price is one the hotel has
                                        actually agreed for these dates, or the
                                        year-round fallback — worth confirming
                                        on the call either way. */}
                                    {dayDateISO && (
                                        <p className={cn(
                                            "text-[10px]",
                                            r.isSeasonalRate ? "text-emerald-700" : "text-amber-700",
                                        )}>
                                            {r.isSeasonalRate
                                                ? "priced for these dates"
                                                : "base rate — no season set for these dates"}
                                        </p>
                                    )}
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-xs font-bold text-dashboard-text tabular-nums">
                                        ₹{r.pricePerNight.toLocaleString("en-IN")}
                                    </p>
                                    {r.starRating && (
                                        <p className="text-[10px] text-amber-700">★ {r.starRating}</p>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                ) : searched && !searching ? (
                    <p className="text-[11px] text-dashboard-neutral">
                        Nothing on file{location ? ` for ${location.split(",")[0]}` : ""} yet — fill it in below.
                    </p>
                ) : null}
            </div>

            {siblingDays.length > 0 && (
                <div className="rounded-md border border-dashboard-border bg-dashboard-muted/40 px-2.5 py-2 space-y-1.5">
                    <p className="text-[11px] font-semibold text-dashboard-text flex items-center gap-1">
                        <CalendarRange className="size-3" /> This stay also covers
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        {siblingDays.map((sd) => {
                            const on = alsoDays.includes(sd.day);
                            return (
                                <button
                                    key={sd.day}
                                    type="button"
                                    onClick={() => setAlsoDays((prev) =>
                                        prev.includes(sd.day) ? prev.filter((d) => d !== sd.day) : [...prev, sd.day])}
                                    className={cn(
                                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
                                        on
                                            ? "bg-emerald-600 border-emerald-600 text-white"
                                            : "bg-white border-dashboard-border text-dashboard-neutral hover:border-emerald-400",
                                    )}
                                >
                                    {on && <CheckCircle2 className="size-2.5" />}
                                    Day {sd.day}
                                    {sd.location && (
                                        <span className={cn("font-normal", on ? "text-emerald-50" : "opacity-70")}>
                                            · {sd.location.split(",")[0]}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-[10px] text-dashboard-neutral">
                        {alsoDays.length > 0
                            ? `Filled with the same hotel, room and rate. Rooms and mattresses follow each day's own request.`
                            : "Only this day will be filled."}
                    </p>
                </div>
            )}

            {/* Everything this needs beyond the fields above is four answers, so it
                is a switch on the existing form rather than a second one. Off by
                exception only — a fill that saves nothing is how the catalog
                stayed as thin as it was. */}
            {!linked && (
                <div className="rounded-md border border-dashboard-border bg-dashboard-muted/40 px-2.5 py-2 space-y-2">
                    <label className="flex items-start gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={saveToCatalog}
                            onChange={(e) => setSaveToCatalog(e.target.checked)}
                            className="mt-0.5 size-3.5 accent-emerald-600"
                        />
                        <span className="min-w-0">
                            <span className="text-[11px] font-semibold text-dashboard-text flex items-center gap-1">
                                <DatabaseZap className="size-3" /> Save this hotel and rate to the catalog
                            </span>
                            <span className="text-[10px] text-dashboard-neutral block leading-snug">
                                Every exec can pick it from the builder straight away. Stays off the public site until someone completes it.
                            </span>
                        </span>
                    </label>

                    {saveToCatalog && (
                        <div className="space-y-2 pl-5">
                            {similar.length > 0 && !attachTo && (
                                <div className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 space-y-1">
                                    <p className="text-[11px] font-semibold text-amber-900 flex items-center gap-1">
                                        <AlertTriangle className="size-3" /> Already on file — is it one of these?
                                    </p>
                                    {similar.map((h) => (
                                        <button
                                            key={h.id}
                                            type="button"
                                            onClick={() => setAttachTo(h)}
                                            className="w-full text-left rounded bg-white border border-amber-200 px-2 py-1 hover:border-amber-400 transition-colors"
                                        >
                                            <span className="text-[11px] font-medium text-dashboard-text">{h.name}</span>
                                            <span className="text-[10px] text-dashboard-neutral block">
                                                {h.location ?? "no town on file"}
                                                {h.starRating ? ` · ${h.starRating}` : ""}
                                                {` · ${h.rateCount} rate${h.rateCount === 1 ? "" : "s"}`}
                                                {h.sameCity ? " · same town" : ""}
                                            </span>
                                        </button>
                                    ))}
                                    <p className="text-[10px] text-amber-800">
                                        Pick one to add this rate to it, or carry on to create a new property.
                                    </p>
                                </div>
                            )}

                            {attachTo ? (
                                <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5">
                                    <Link2 className="size-3.5 text-emerald-700 mt-0.5 shrink-0" />
                                    <p className="text-[11px] text-emerald-900 flex-1 leading-snug">
                                        Adding this rate to <strong>{attachTo.name}</strong> — no new property will be created.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setAttachTo(null)}
                                        className="text-[10px] text-emerald-800 underline underline-offset-2 shrink-0"
                                    >
                                        Undo
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[10px] text-dashboard-neutral mb-1 block">Town</label>
                                            <Input
                                                value={city}
                                                onChange={(e) => setCity(e.target.value)}
                                                placeholder="e.g. Rishikesh"
                                                className="text-xs h-8 bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-dashboard-neutral mb-1 block">Star rating</label>
                                            <Input
                                                value={stayType}
                                                onChange={(e) => setStayType(e.target.value)}
                                                placeholder="e.g. 4 Star"
                                                className="text-xs h-8 bg-white"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[10px] text-dashboard-neutral mb-1 flex items-center gap-1">
                                            <MapPin className="size-2.5" /> Where it is
                                            <span className="text-red-600">*</span>
                                        </label>
                                        <LocationSearchSelect
                                            value={pin}
                                            onChange={setPin}
                                            placeholder="Search the hotel or its area…"
                                        />
                                        {!pin && (
                                            <p className="text-[10px] text-dashboard-neutral mt-1">
                                                Without this the hotel won&apos;t turn up when an exec searches near a stop, or show a drive distance.
                                            </p>
                                        )}
                                    </div>
                                </>
                            )}

                            {/* The sheet in front of the admin usually has a
                                season grid on it. This is the same calendar the
                                hotel dashboard's pricing tab uses, so whatever is
                                captured here behaves identically to a rate
                                entered there — and anything not captured simply
                                falls back to the base rate above. */}
                            <div className="rounded-md border border-dashboard-border bg-white px-2 py-1.5 space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-[11px] font-semibold text-dashboard-text flex items-center gap-1">
                                        <CalendarDays className="size-3" /> Season rates from the sheet
                                    </p>
                                    <Button
                                        type="button" size="sm" variant="outline" className="h-7 text-[11px]"
                                        onClick={() => setCalendarOpen(true)}
                                        disabled={!(parseFloat(pricePerNight) > 0)}
                                    >
                                        {seasons.length > 0 ? "Edit seasons" : "Add seasons"}
                                    </Button>
                                </div>
                                {seasons.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                        {seasons.map((sn) => (
                                            <span
                                                key={sn.id}
                                                className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px]"
                                                style={{ borderColor: sn.color, color: "inherit" }}
                                            >
                                                <span className="size-2 rounded-full" style={{ background: sn.color }} />
                                                {sn.label || defaultRangeLabel(sn.startDate, sn.endDate)}
                                                <span className="font-semibold">₹{sn.rate.toLocaleString("en-IN")}</span>
                                                {sn.weekendPrice != null && sn.weekendPrice !== sn.rate && (
                                                    <span className="opacity-70">/ ₹{sn.weekendPrice.toLocaleString("en-IN")} wknd</span>
                                                )}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-dashboard-neutral">
                                        {parseFloat(pricePerNight) > 0
                                            ? "Optional. Any date not covered by a season uses the rate above."
                                            : "Enter the base rate first."}
                                    </p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] text-dashboard-neutral mb-1 block">Rate quoted from</label>
                                    <Input
                                        type="date" value={validFrom}
                                        onChange={(e) => setValidFrom(e.target.value)}
                                        className="text-xs h-8 bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-dashboard-neutral mb-1 block">…until</label>
                                    <Input
                                        type="date" value={effectiveValidTo}
                                        onChange={(e) => { setValidTo(e.target.value); setValidToTouched(true); }}
                                        className="text-xs h-8 bg-white"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-[11px] text-dashboard-neutral mb-1 block">Hotel Name</label>
                    <Input
                        value={hotelName}
                        onChange={(e) => { setHotelName(e.target.value); dropLink(); }}
                        placeholder="Hotel name"
                        className="text-sm h-9"
                    />
                </div>
                <div>
                    <label className="text-[11px] text-dashboard-neutral mb-1 block">Room Name</label>
                    <Input
                        value={roomName}
                        onChange={(e) => { setRoomName(e.target.value); dropLink(); }}
                        placeholder="e.g. Deluxe Room"
                        className="text-sm h-9"
                    />
                </div>
                <div>
                    <label className="text-[11px] text-dashboard-neutral mb-1 block">Rooms Needed</label>
                    <Input
                        type="number" min={1}
                        value={roomsCount}
                        onChange={(e) => setRoomsCount(e.target.value)}
                        className="text-sm h-9"
                    />
                </div>
                <div>
                    <label className="text-[11px] text-dashboard-neutral mb-1 flex items-center gap-1">
                        <BedDouble className="size-2.5" /> Mattresses Needed
                    </label>
                    <Input
                        type="number" min={0}
                        value={extraBeds}
                        onChange={(e) => setExtraBeds(e.target.value)}
                        placeholder="0"
                        className="text-sm h-9"
                    />
                </div>
                <div>
                    {/* Matches the exact label the main builder uses for the same
                       field (manualHotelPricePerNight) — "B2B Price / Night" was
                       read by hotel-team members as "the whole night's total",
                       so they'd sum rooms + mattresses themselves and enter that
                       combined figure here. The pricing engine always treats
                       this as a PER-ROOM rate and multiplies by Rooms Needed —
                       entering an already-summed total silently double-counted
                       the room cost (e.g. 3 rooms @ ₹1000 + 2 mattresses @ ₹800
                       = ₹4600 entered here → priced as 3 × ₹4600 = ₹13,800). */}
                    <label className="text-[11px] text-dashboard-neutral mb-1 block">B2B Price / Room / Night (₹)</label>
                    <Input
                        type="number" min={0}
                        value={pricePerNight}
                        onChange={(e) => {
                            setPricePerNight(e.target.value);
                            // A negotiated rate that isn't the catalog's is a
                            // manual fill, not a link — costing would otherwise
                            // prefer the catalog number over this one.
                            if (linked && e.target.value !== String(linked.pricePerNight)) dropLink();
                        }}
                        placeholder="e.g. 1000"
                        className="text-sm h-9"
                    />
                </div>
                {parseInt(extraBeds, 10) > 0 && (
                    <div>
                        <label className="text-[11px] text-dashboard-neutral mb-1 block">Price / Mattress / Night (₹)</label>
                        <Input
                            type="number" min={0}
                            value={extraBedRate}
                            onChange={(e) => setExtraBedRate(e.target.value)}
                            placeholder="e.g. 800"
                            className="text-sm h-9"
                        />
                    </div>
                )}
                {parseFloat(pricePerNight) > 0 && (
                    <div className="col-span-2 rounded-md border border-dashboard-base-300 bg-dashboard-base-200/40 px-2.5 py-2 text-xs text-dashboard-base-content">
                        {(parseInt(roomsCount, 10) || 1)} room{(parseInt(roomsCount, 10) || 1) !== 1 ? "s" : ""} × ₹{(parseFloat(pricePerNight) || 0).toLocaleString("en-IN")}
                        {" = "}₹{((parseInt(roomsCount, 10) || 1) * (parseFloat(pricePerNight) || 0)).toLocaleString("en-IN")}
                        {parseInt(extraBeds, 10) > 0 && (
                            <>
                                {" + "}{parseInt(extraBeds, 10)} mattress{parseInt(extraBeds, 10) !== 1 ? "es" : ""} × ₹{(parseFloat(extraBedRate) || 0).toLocaleString("en-IN")}
                                {" = "}₹{(parseInt(extraBeds, 10) * (parseFloat(extraBedRate) || 0)).toLocaleString("en-IN")}
                            </>
                        )}
                        <span className="font-semibold">
                            {" → Total ₹"}
                            {(
                                (parseInt(roomsCount, 10) || 1) * (parseFloat(pricePerNight) || 0)
                                + parseInt(extraBeds, 10) * (parseFloat(extraBedRate) || 0)
                            ).toLocaleString("en-IN")}/night
                        </span>
                    </div>
                )}
                <div>
                    <label className="text-[11px] text-dashboard-neutral mb-1 block">Room Specs</label>
                    <Input
                        value={roomSpecs}
                        onChange={(e) => setRoomSpecs(e.target.value)}
                        placeholder="1 Double Bed | Mountain View"
                        className="text-sm h-9"
                    />
                </div>
                <div className="col-span-2 space-y-2">
                    <label className="text-[11px] text-dashboard-neutral flex items-center gap-1">
                        <Camera className="size-2.5" /> Photos <span className="text-dashboard-base-content/40">(optional — shown in the itinerary)</span>
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                        <div>
                            <p className="text-[10px] text-dashboard-base-content/50 mb-1">Hotel</p>
                            <ImageDropField value={hotelPhoto} onChange={setHotelPhoto} folder="hotels" compact />
                        </div>
                        {roomPhotos.map((photo, i) => (
                            <div key={i}>
                                <p className="text-[10px] text-dashboard-base-content/50 mb-1">Room image {i + 1}</p>
                                <ImageDropField value={photo} onChange={(url) => setRoomPhotoAt(i, url)} folder="hotels" compact />
                            </div>
                        ))}
                    </div>
                </div>
                <div className="col-span-2 space-y-2">
                    {mealTypes.length > 0 && (
                        <div>
                            <label className="text-[11px] text-dashboard-neutral mb-1 block">Meal Plan</label>
                            <div className="flex flex-wrap gap-1.5">
                                {mealTypes.map((m) => (
                                    <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => selectMealPlan(m)}
                                        className={cn(
                                            "px-2.5 py-1 rounded-md border text-xs font-medium transition-colors",
                                            mealPlan === m.name
                                                ? "bg-dashboard-primary text-dashboard-primary-content border-dashboard-primary"
                                                : "bg-dashboard-base-100 border-dashboard-base-300 text-dashboard-base-content/60 hover:bg-dashboard-base-200",
                                        )}
                                    >
                                        {m.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <div>
                        <label className="text-[11px] text-dashboard-neutral mb-1 block">Meals Included</label>
                        <div className="flex flex-wrap gap-1.5">
                            {MEAL_OPTIONS.map((m) => (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => toggleMeal(m)}
                                    className={cn(
                                        "px-2.5 py-1 rounded-md border text-xs font-medium transition-colors",
                                        meals.includes(m)
                                            ? "bg-emerald-600 text-white border-emerald-600"
                                            : "bg-dashboard-base-100 border-dashboard-base-300 text-dashboard-base-content/60 hover:bg-dashboard-base-200",
                                    )}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                <div>
                    <label className="text-[11px] text-dashboard-neutral mb-1 flex items-center gap-1">
                        <LogIn className="size-2.5" /> Check-In
                    </label>
                    <TimeSelect value={checkIn} onChange={setCheckIn} placeholder="Select check-in" />
                </div>
                <div>
                    <label className="text-[11px] text-dashboard-neutral mb-1 flex items-center gap-1">
                        <LogOut className="size-2.5" /> Check-Out
                    </label>
                    <TimeSelect value={checkOut} onChange={setCheckOut} placeholder="Select check-out" />
                </div>
                <div className="col-span-2">
                    <label className="text-[11px] text-dashboard-neutral mb-1 flex items-center gap-1">
                        <StickyNote className="size-2.5" /> Notes for Sales Exec <span className="text-dashboard-base-content/40">(optional, internal only)</span>
                    </label>
                    <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="e.g. Confirmed by phone, no early check-in available"
                        rows={2}
                        className="text-sm resize-none"
                    />
                </div>
            </div>

            {blockedReason && (
                <p className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">
                    <AlertTriangle className="size-3 shrink-0 mt-px" /> {blockedReason}
                </p>
            )}

            <Button
                size="sm"
                className="h-9 text-sm"
                disabled={isPending || !!blockedReason}
                onClick={handleSubmit}
            >
                {isPending ? "Saving…" : "Save Hotel"}
            </Button>
        </div>
    );
}
