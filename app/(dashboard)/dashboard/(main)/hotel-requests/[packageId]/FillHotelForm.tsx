"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Hotel } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { fillPendingHotel } from "../actions";

export function FillHotelForm({
    packageId, day, location, dateLabel, paxLabel, note,
}: {
    packageId: string;
    day: number;
    location: string | null;
    dateLabel: string | null;
    paxLabel: string;
    note: string | null;
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [hotelName, setHotelName] = useState("");
    const [roomName, setRoomName] = useState("");
    const [roomsCount, setRoomsCount] = useState("1");
    const [pricePerNight, setPricePerNight] = useState("");
    const [done, setDone] = useState(false);

    function handleSubmit() {
        startTransition(async () => {
            const result = await fillPendingHotel(packageId, day, {
                hotelName,
                roomName,
                roomsCount: parseInt(roomsCount, 10) || 1,
                pricePerNight: parseFloat(pricePerNight) || 0,
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

            {note && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
                    &quot;{note}&quot;
                </p>
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
                    <label className="text-[11px] text-dashboard-neutral mb-1 block">B2B Price / Night (₹)</label>
                    <Input
                        type="number" min={0}
                        value={pricePerNight}
                        onChange={(e) => setPricePerNight(e.target.value)}
                        placeholder="e.g. 4500"
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
