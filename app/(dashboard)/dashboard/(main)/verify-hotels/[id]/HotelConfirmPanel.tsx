"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { confirmHotelStay } from "../actions";

type Hotel = { id: number; name: string; category: string | null; city: string | null; state: string | null; address: string | null; destination_id: number };

export default function HotelConfirmPanel({
    bookingId, dayNumber, defaultHotelId, cityName,
    checkInDate, checkOutDate, roomType, roomsCount, ratePerRoom, totalCost,
    destinationHotels, allHotels,
}: {
    bookingId: string;
    dayNumber: number;
    defaultHotelId: number;
    cityName: string;
    checkInDate: string;
    checkOutDate: string;
    roomType: string;
    roomsCount: number;
    ratePerRoom: number;
    totalCost: number;
    destinationHotels: Hotel[];
    allHotels: Hotel[];
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [selectedId, setSelectedId] = useState<number>(defaultHotelId);
    const [notes, setNotes] = useState("");
    const [confirming, setConfirming] = useState(false);
    const [search, setSearch] = useState("");
    const [showAll, setShowAll] = useState(false);

    const pool = showAll ? allHotels : destinationHotels;
    const filtered = search.trim()
        ? pool.filter((h) =>
              h.name.toLowerCase().includes(search.toLowerCase()) ||
              (h.city ?? "").toLowerCase().includes(search.toLowerCase()),
          )
        : pool;

    const selectedHotel = allHotels.find((h) => h.id === selectedId);
    const changed = selectedId !== defaultHotelId;

    function reset() {
        setOpen(false);
        setSearch("");
        setNotes("");
        setSelectedId(defaultHotelId);
        setShowAll(false);
    }

    async function handleConfirm() {
        setConfirming(true);
        try {
            const res = await confirmHotelStay(bookingId, dayNumber, selectedId, {
                cityName, checkInDate, checkOutDate, roomType, roomsCount, ratePerRoom, totalCost, notes,
            });
            if (!res.success) { toast.error(res.error); return; }
            toast.success(
                res.allConfirmed
                    ? "All hotels confirmed! Booking moved to Hotel Confirmed."
                    : "Hotel stay confirmed.",
            );
            reset();
            router.refresh();
        } finally {
            setConfirming(false);
        }
    }

    if (!open) {
        return (
            <div className="flex items-center justify-end">
                <button
                    onClick={() => setOpen(true)}
                    className="w-fit cursor-pointer rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-dashboard-primary-content transition-colors hover:bg-green-700/90"
                >
                    Confirm Hotel
                </button>
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-dashboard-base-300 bg-dashboard-base-100 p-4">
            <p className="text-sm font-semibold text-dashboard-base-content mb-3">
                Confirm Hotel — Day {dayNumber} · {cityName}
            </p>

            {/* Hotel selection */}
            <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs uppercase tracking-wide text-dashboard-neutral">Select Hotel</span>
                    <button
                        type="button"
                        onClick={() => { setShowAll((v) => !v); setSearch(""); }}
                        className="cursor-pointer text-xs text-dashboard-primary hover:text-dashboard-primary/80 transition-colors"
                    >
                        {showAll ? "Destination only" : "Show all hotels"}
                    </button>
                </div>

                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={showAll ? "Search all hotels…" : "Search destination hotels…"}
                    className="w-full rounded-md border border-dashboard-base-300 bg-dashboard-base-100 px-3 py-2 text-sm text-dashboard-base-content placeholder:text-dashboard-neutral outline-none focus:border-dashboard-primary mb-2"
                />

                <div className="max-h-40 overflow-y-auto rounded-md border border-dashboard-base-300 divide-y divide-dashboard-base-300/60">
                    {filtered.length === 0 ? (
                        <p className="px-3 py-2.5 text-sm text-dashboard-neutral">No hotels found.</p>
                    ) : (
                        filtered.slice(0, 60).map((h) => (
                            <button
                                key={h.id}
                                type="button"
                                onClick={() => setSelectedId(h.id)}
                                className={`w-full cursor-pointer text-left px-3 py-2 text-sm transition-colors ${
                                    selectedId === h.id
                                        ? "bg-dashboard-primary/10 text-dashboard-primary font-medium"
                                        : "text-dashboard-base-content hover:bg-dashboard-base-200"
                                }`}
                            >
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span>{h.name}</span>
                                    {h.category && <span className="text-xs text-dashboard-neutral">· {h.category}</span>}
                                    {h.id === defaultHotelId && (
                                        <span className="rounded bg-dashboard-secondary/15 px-1.5 py-0.5 text-[10px] text-dashboard-secondary">
                                            booked
                                        </span>
                                    )}
                                </div>
                                {(h.address || h.city || h.state) && (
                                    <div className="mt-0.5 text-xs text-dashboard-neutral truncate">
                                        {h.address
                                            ? [h.address, h.city, h.state].filter(Boolean).join(", ")
                                            : [h.city, h.state].filter(Boolean).join(", ")}
                                    </div>
                                )}
                            </button>
                        ))
                    )}
                </div>

                {changed && selectedHotel && (
                    <p className="mt-1.5 text-xs font-medium text-dashboard-warning-content">
                        ⚠ Changed from originally booked hotel — confirm the new price with the hotel
                    </p>
                )}
            </div>

            {/* Notes */}
            <div className="mb-4">
                <label className="block text-xs uppercase tracking-wide text-dashboard-neutral mb-1.5">
                    Notes <span className="normal-case opacity-60">(conf. ref, special requests…)</span>
                </label>
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Conf. ref: HTL-2024-001, non-smoking floor, breakfast included…"
                    rows={2}
                    className="w-full rounded-md border border-dashboard-base-300 bg-dashboard-base-100 px-3 py-2 text-sm text-dashboard-base-content placeholder:text-dashboard-neutral outline-none focus:border-dashboard-primary resize-none"
                />
            </div>

            <div className="flex justify-end gap-2">
                <button
                    onClick={reset}
                    disabled={confirming}
                    className="cursor-pointer rounded-md border border-dashboard-base-300 px-3 py-2 text-sm font-medium text-dashboard-neutral hover:bg-dashboard-base-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Cancel
                </button>
                <button
                    onClick={handleConfirm}
                    disabled={confirming || !selectedId}
                    className="cursor-pointer rounded-md bg-dashboard-success px-4 py-2 text-sm font-medium text-dashboard-success-content hover:bg-dashboard-success/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {confirming ? "Confirming…" : "Confirm Hotel"}
                </button>
            </div>
        </div>
    );
}
