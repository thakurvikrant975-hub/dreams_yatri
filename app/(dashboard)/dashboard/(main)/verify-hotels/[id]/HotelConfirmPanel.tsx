"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { confirmHotelStay } from "../actions";

type Hotel = { id: number; name: string; category: string | null; city: string | null; destination_id: number };

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
    const [selectedHotelId, setSelectedHotelId] = useState<number>(defaultHotelId);
    const [notes, setNotes] = useState("");
    const [confirming, setConfirming] = useState(false);
    const [search, setSearch] = useState("");
    const [showAll, setShowAll] = useState(false);

    const pool = showAll ? allHotels : destinationHotels;
    const filtered = search.trim()
        ? pool.filter((h) => h.name.toLowerCase().includes(search.toLowerCase()) || (h.city ?? "").toLowerCase().includes(search.toLowerCase()))
        : pool;

    const selectedHotel = allHotels.find((h) => h.id === selectedHotelId);

    function resetPanel() {
        setOpen(false);
        setSearch("");
        setNotes("");
        setSelectedHotelId(defaultHotelId);
        setShowAll(false);
    }

    async function handleConfirm() {
        setConfirming(true);
        try {
            const res = await confirmHotelStay(bookingId, dayNumber, selectedHotelId, {
                cityName, checkInDate, checkOutDate, roomType, roomsCount, ratePerRoom, totalCost, notes,
            });
            if (!res.success) { toast.error(res.error); return; }
            toast.success(res.allConfirmed ? "All hotels confirmed! Booking moved to Hotel Confirmed." : "Hotel stay confirmed.");
            resetPanel();
            router.refresh();
        } finally {
            setConfirming(false);
        }
    }

    if (!open) {
        return (
            <button
                onClick={() => setOpen(true)}
                className="w-full rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors cursor-pointer hover:opacity-90"
                style={{ backgroundColor: "var(--color-dashboard-primary)" }}
            >
                Confirm Hotel
            </button>
        );
    }

    return (
        <div className="rounded-lg border border-dashboard-base-300 bg-dashboard-base-100 p-4">
            <div className="text-sm font-semibold text-dashboard-base-content mb-3">
                Confirm Hotel — Day {dayNumber} · {cityName}
            </div>

            {/* Hotel selection */}
            <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs uppercase tracking-wide text-dashboard-neutral">Select Hotel</label>
                    <button
                        type="button"
                        onClick={() => { setShowAll((v) => !v); setSearch(""); }}
                        className="text-xs cursor-pointer transition-colors hover:opacity-80"
                        style={{ color: "var(--color-dashboard-primary)" }}
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
                        <div className="px-3 py-2.5 text-sm text-dashboard-neutral">No hotels found.</div>
                    ) : (
                        filtered.slice(0, 60).map((h) => (
                            <button
                                key={h.id}
                                type="button"
                                onClick={() => setSelectedHotelId(h.id)}
                                className="w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer"
                                style={selectedHotelId === h.id
                                    ? { backgroundColor: "color-mix(in oklch, var(--color-dashboard-primary) 10%, white)", color: "var(--color-dashboard-primary)", fontWeight: 500 }
                                    : { color: "var(--color-dashboard-base-content)" }
                                }
                            >
                                <span>{h.name}</span>
                                {h.city && <span className="ml-1.5 text-xs text-dashboard-neutral">{h.city}</span>}
                                {h.category && <span className="ml-1.5 text-xs text-dashboard-neutral">· {h.category}</span>}
                                {h.id === defaultHotelId && (
                                    <span className="ml-2 text-[10px] rounded px-1.5 py-0.5" style={{ backgroundColor: "color-mix(in oklch, var(--color-dashboard-info) 20%, white)", color: "var(--color-dashboard-secondary)" }}>
                                        originally booked
                                    </span>
                                )}
                            </button>
                        ))
                    )}
                </div>

                {selectedHotel && selectedHotelId !== defaultHotelId && (
                    <p className="mt-1.5 text-xs font-medium" style={{ color: "var(--color-dashboard-warning-content)" }}>
                        ⚠ Hotel changed from originally booked — price may differ
                    </p>
                )}
            </div>

            {/* Notes */}
            <div className="mb-4">
                <label className="block text-xs uppercase tracking-wide text-dashboard-neutral mb-1.5">
                    Notes <span className="normal-case opacity-70">(confirmation no., special requests…)</span>
                </label>
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Conf. ref: HTL-2024-001, breakfast included, non-smoking floor…"
                    rows={2}
                    className="w-full rounded-md border border-dashboard-base-300 bg-dashboard-base-100 px-3 py-2 text-sm text-dashboard-base-content placeholder:text-dashboard-neutral outline-none focus:border-dashboard-primary resize-none"
                />
            </div>

            <div className="flex justify-end gap-2">
                <button
                    onClick={resetPanel}
                    disabled={confirming}
                    className="rounded-md border border-dashboard-base-300 px-3 py-2 text-sm font-medium text-dashboard-neutral hover:bg-dashboard-base-200 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Cancel
                </button>
                <button
                    onClick={handleConfirm}
                    disabled={confirming || !selectedHotelId}
                    className="rounded-md px-4 py-2 text-sm font-medium text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                    style={{ backgroundColor: "var(--color-dashboard-success)" }}
                >
                    {confirming ? "Confirming…" : "Confirm Hotel"}
                </button>
            </div>
        </div>
    );
}
