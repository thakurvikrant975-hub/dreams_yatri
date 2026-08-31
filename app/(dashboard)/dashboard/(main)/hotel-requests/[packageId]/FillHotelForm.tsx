"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Hotel, LogIn, LogOut, BedDouble, ClipboardList, StickyNote, Camera, XCircle, Ban, CalendarRange } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { cn } from "@/app/lib/utils";
import { fillPendingHotel, rejectPendingHotel } from "../actions";
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

type MealType = { id: number; name: string; covered_meals: string[] };

export function FillHotelForm({
    packageId, day, location, dateLabel, paxLabel, note,
    requestedType, requestedRooms, requestedMattresses, requestedMealPlan, mealTypes,
    rejectedAt, rejectedByName, rejectionNote, siblingDays = [], groupDays = [],
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
    /** The package's other still-pending days, so one stay covering several
     * nights can be filled from a single submit instead of once per day. */
    siblingDays?: { day: number; location: string | null }[];
    /** The further days this card already covers — consecutive pending days
     * asking for the same thing in the same town, grouped by the queue rather
     * than guessed at here (see groupPendingStayDays). Ticked on arrival, and
     * still untickable: a day turned off comes back as its own card. */
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
    const [alsoDays, setAlsoDays] = useState<number[]>(groupDays);
    const [done, setDone] = useState(false);
    const [rejecting, setRejecting] = useState(false);
    const [rejectReason, setRejectReason] = useState("");
    const [rejectDone, setRejectDone] = useState(false);

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
            const result = await fillPendingHotel(packageId, day, {
                hotelName,
                roomName,
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
                alsoDays,
            });
            if (result.success) {
                setDone(true);
                const covered = 1 + alsoDays.length;
                toast.success(
                    result.allDaysFilled
                        ? "Hotel filled — every day on this package is done. Back to the sales exec to submit."
                        : covered > 1
                            ? `Hotel filled for ${covered} nights (day ${[day, ...alsoDays].sort((a, b) => a - b).join(", ")})`
                            : "Hotel filled for this day",
                );
                router.refresh();
            } else {
                toast.error(result.error ?? "Failed to save");
            }
        });
    }

    function handleReject() {
        if (!rejectReason.trim()) { toast.error("A reason is required to reject a hotel request."); return; }
        startTransition(async () => {
            const result = await rejectPendingHotel(packageId, day, rejectReason);
            if (result.success) {
                setRejectDone(true);
                toast.success(`Day ${day} marked rejected — the sales exec has been notified.`);
                router.refresh();
            } else {
                toast.error(result.error ?? "Failed to reject");
            }
        });
    }

    if (done) {
        return (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 flex items-center gap-2 text-emerald-800 text-sm font-medium">
                <CheckCircle2 className="size-4 shrink-0" /> Day {day} filled — {hotelName}{roomName ? ` — ${roomName}` : ""}
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
                        <p className="text-sm font-semibold text-dashboard-base-content">Day {day}{location ? ` · ${location}` : ""}</p>
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

            {siblingDays.length > 0 && (
                <div className="rounded-md border border-dashboard-border bg-dashboard-muted/40 px-2.5 py-2 space-y-1.5">
                    <p className="text-[11px] font-semibold text-dashboard-base-content flex items-center gap-1">
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
                                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer",
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
                            ? "Filled with the same hotel, room and rate. Rooms and mattresses follow each day's own request."
                            : "Only this day will be filled."}
                    </p>
                </div>
            )}

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-[11px] text-dashboard-neutral mb-1 block">Hotel Name</label>
                    <Input
                        value={hotelName}
                        onChange={(e) => setHotelName(e.target.value)}
                        placeholder="Hotel name"
                        className="text-sm h-9"
                    />
                </div>
                <div>
                    <label className="text-[11px] text-dashboard-neutral mb-1 block">Room Name</label>
                    <Input
                        value={roomName}
                        onChange={(e) => setRoomName(e.target.value)}
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
                        onChange={(e) => setPricePerNight(e.target.value)}
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

            <Button
                size="sm"
                className="h-9 text-sm"
                disabled={isPending || !hotelName.trim() || !(parseFloat(pricePerNight) > 0)}
                onClick={handleSubmit}
            >
                {isPending ? "Saving…" : "Save Hotel"}
            </Button>
        </div>
    );
}
