"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Hotel, LogIn, LogOut, BedDouble, ClipboardList } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { fillPendingHotel } from "../actions";

// Mirrors STAY_LABELS in package-builder/[packageId]/page.tsx — the exec's
// Hotel Type request is stored as one of these keys.
const STAY_LABELS: Record<string, string> = {
    STAR_3: "3★ Hotel", STAR_4: "4★ Hotel", STAR_5: "5★ Hotel",
    BOUTIQUE: "Boutique", HOMESTAY: "Homestay",
    RESORT: "Resort", CAMP: "Camp", BUDGET: "Budget",
};

export function FillHotelForm({
    packageId, day, location, dateLabel, paxLabel, note,
    requestedType, requestedRooms, requestedMattresses, requestedMealPlan, mealTypeOptions,
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
    /** Names configured at /dashboard/hotels/meal-types, offered as
     * suggestions on the Meal Plan field below. */
    mealTypeOptions: string[];
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
    const [mealPlan, setMealPlan] = useState(requestedMealPlan ?? "");
    const [done, setDone] = useState(false);
    const mealPlanListId = `meal-plan-options-day-${day}`;

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
                mealPlan,
            });
            if (result.success) {
                setDone(true);
                toast.success(
                    result.advancedToReview
                        ? "Hotel filled — all pending days done, package sent to costing review!"
                        : "Hotel filled for this day",
                );
                router.refresh();
            } else {
                toast.error(result.error ?? "Failed to save");
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
            </div>

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
                    <label className="text-[11px] text-dashboard-neutral mb-1 block">B2B Price / Night (₹)</label>
                    <Input
                        type="number" min={0}
                        value={pricePerNight}
                        onChange={(e) => setPricePerNight(e.target.value)}
                        placeholder="e.g. 4500"
                        className="text-sm h-9"
                    />
                </div>
                {parseInt(extraBeds, 10) > 0 && (
                    <div>
                        <label className="text-[11px] text-dashboard-neutral mb-1 block">Price / Mattress (₹)</label>
                        <Input
                            type="number" min={0}
                            value={extraBedRate}
                            onChange={(e) => setExtraBedRate(e.target.value)}
                            placeholder="0"
                            className="text-sm h-9"
                        />
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
                <div>
                    <label className="text-[11px] text-dashboard-neutral mb-1 block">Meal Plan</label>
                    <Input
                        value={mealPlan}
                        onChange={(e) => setMealPlan(e.target.value)}
                        placeholder="MAP - Breakfast & Dinner"
                        list={mealTypeOptions.length > 0 ? mealPlanListId : undefined}
                        className="text-sm h-9"
                    />
                    {mealTypeOptions.length > 0 && (
                        <datalist id={mealPlanListId}>
                            {mealTypeOptions.map((name) => <option key={name} value={name} />)}
                        </datalist>
                    )}
                </div>
                <div>
                    <label className="text-[11px] text-dashboard-neutral mb-1 flex items-center gap-1">
                        <LogIn className="size-2.5" /> Check-In
                    </label>
                    <Input
                        value={checkIn}
                        onChange={(e) => setCheckIn(e.target.value)}
                        placeholder="2:00 PM"
                        className="text-sm h-9"
                    />
                </div>
                <div>
                    <label className="text-[11px] text-dashboard-neutral mb-1 flex items-center gap-1">
                        <LogOut className="size-2.5" /> Check-Out
                    </label>
                    <Input
                        value={checkOut}
                        onChange={(e) => setCheckOut(e.target.value)}
                        placeholder="11:00 AM"
                        className="text-sm h-9"
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
