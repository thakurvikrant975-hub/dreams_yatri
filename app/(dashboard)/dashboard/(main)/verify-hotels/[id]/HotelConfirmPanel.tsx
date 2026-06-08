"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { confirmHotelStay, getRoomsForHotel, type RoomOption } from "../actions";

type Hotel = {
    id: number; name: string; category: string | null;
    city: string | null; state: string | null; address: string | null;
    destination_id: number;
    business_phone: string | null;
    business_email: string | null;
};

type SelectedOption = { hotel: Hotel; room: RoomOption; pricing: RoomOption["pricing"][0] };

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

function RoomImage({ url, thumbnail, alt }: { url: string | null; thumbnail: string | null; alt: string }) {
    const [failed, setFailed] = useState(false);
    if (!url || failed) return <span className="text-2xl select-none">🛏</span>;
    return (
        <img
            src={thumbnail ?? url}
            alt={alt}
            className="w-full h-full object-cover"
            onError={() => setFailed(true)}
        />
    );
}

// ── Change Hotel Modal ────────────────────────────────────────────────────────
function ChangeHotelModal({
    bookingId, dayNumber, defaultHotelId, cityName,
    checkInDate, checkOutDate, roomsCount, numNights,
    destinationHotels, allHotels, initialNotes,
    onClose, onConfirmed,
}: {
    bookingId: string; dayNumber: number; defaultHotelId: number; cityName: string;
    checkInDate: string; checkOutDate: string;
    roomsCount: number; numNights: number;
    destinationHotels: Hotel[]; allHotels: Hotel[];
    initialNotes: string;
    onClose: () => void;
    onConfirmed: () => void;
}) {
    const [search, setSearch] = useState("");
    const [showAll, setShowAll] = useState(false);
    const [expandedHotelId, setExpandedHotelId] = useState<number | null>(null);
    const [hotelRooms, setHotelRooms] = useState<Map<number, RoomOption[] | "loading">>(new Map());
    const [selected, setSelected] = useState<SelectedOption | null>(null);
    const [notes, setNotes] = useState(initialNotes);
    const [confirming, setConfirming] = useState(false);

    const pool = showAll ? allHotels : destinationHotels;
    const filtered = search.trim()
        ? pool.filter((h) =>
              h.name.toLowerCase().includes(search.toLowerCase()) ||
              (h.city ?? "").toLowerCase().includes(search.toLowerCase()) ||
              (h.address ?? "").toLowerCase().includes(search.toLowerCase()),
          )
        : pool;

    async function toggleHotel(hotel: Hotel) {
        if (expandedHotelId === hotel.id) { setExpandedHotelId(null); return; }
        setExpandedHotelId(hotel.id);
        if (!hotelRooms.has(hotel.id)) {
            setHotelRooms((prev) => new Map(prev).set(hotel.id, "loading"));
            const rooms = await getRoomsForHotel(hotel.id, checkInDate);
            setHotelRooms((prev) => new Map(prev).set(hotel.id, rooms));
        }
    }

    async function handleConfirmChange() {
        if (!selected) return;
        setConfirming(true);
        try {
            const roomLabel = [selected.room.name, selected.pricing.plan_name].filter(Boolean).join(" · ");
            const newTotal = selected.pricing.price_per_night * roomsCount * numNights;
            const res = await confirmHotelStay(bookingId, dayNumber, selected.hotel.id, {
                cityName, checkInDate, checkOutDate,
                roomType: roomLabel, roomsCount,
                ratePerRoom: selected.pricing.price_per_night,
                totalCost: newTotal,
                notes,
            });
            if (!res.success) { toast.error(res.error); return; }
            toast.success(res.allConfirmed ? "All hotels confirmed! Booking moved to Hotel Confirmed." : "Hotel changed & confirmed.");
            onConfirmed();
        } finally { setConfirming(false); }
    }

    const newTotal = selected ? selected.pricing.price_per_night * roomsCount * numNights : 0;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="relative flex flex-col w-full max-w-2xl max-h-[90vh] rounded-xl bg-dashboard-base-100 shadow-2xl overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between border-b border-dashboard-base-300 px-5 py-3.5 shrink-0">
                    <h3 className="text-sm font-semibold text-dashboard-base-content">
                        🏨 Change Hotel — Day {dayNumber} · {cityName}
                    </h3>
                    <button
                        onClick={onClose}
                        className="cursor-pointer rounded-md p-1.5 text-dashboard-neutral hover:bg-dashboard-base-200 hover:text-dashboard-base-content transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Search */}
                <div className="shrink-0 border-b border-dashboard-base-300 px-5 py-3 flex items-center gap-2">
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search hotel name or city…"
                        className="flex-1 rounded-md border border-dashboard-base-300 bg-dashboard-base-200/60 px-3 py-2 text-sm text-dashboard-base-content placeholder:text-dashboard-neutral outline-none focus:border-dashboard-primary"
                    />
                    <button
                        type="button"
                        onClick={() => { setShowAll((v) => !v); setSearch(""); }}
                        className="cursor-pointer shrink-0 rounded-md border border-dashboard-base-300 px-3 py-2 text-xs font-medium text-dashboard-base-content hover:bg-dashboard-base-200 transition-colors whitespace-nowrap"
                    >
                        {showAll ? "Destination only" : "Show all"}
                    </button>
                </div>

                {/* Hotel list */}
                <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3 flex flex-col gap-2">
                    {filtered.length === 0 ? (
                        <p className="py-8 text-center text-sm text-dashboard-neutral">No hotels found.</p>
                    ) : filtered.map((hotel) => {
                        const isExpanded = expandedHotelId === hotel.id;
                        const rooms = hotelRooms.get(hotel.id);
                        const isDefault = hotel.id === defaultHotelId;

                        return (
                            <div
                                key={hotel.id}
                                className={`rounded-lg border overflow-hidden ${isDefault ? "border-dashboard-primary/40" : "border-dashboard-base-300"}`}
                            >
                                {/* Hotel row */}
                                <button
                                    type="button"
                                    onClick={() => toggleHotel(hotel)}
                                    className="cursor-pointer w-full text-left px-4 py-3 hover:bg-dashboard-base-200/50 transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-sm font-semibold text-dashboard-base-content">{hotel.name}</span>
                                                {hotel.category && (
                                                    <span className="text-xs text-dashboard-neutral">{hotel.category}</span>
                                                )}
                                                {isDefault && (
                                                    <span className="rounded bg-dashboard-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-dashboard-primary">
                                                        booked
                                                    </span>
                                                )}
                                            </div>
                                            {(hotel.city || hotel.state || hotel.address) && (
                                                <p className="mt-0.5 text-xs text-dashboard-neutral truncate">
                                                    📍 {[hotel.address, hotel.city, hotel.state].filter(Boolean).join(", ")}
                                                </p>
                                            )}
                                            <div className="mt-1 flex flex-wrap gap-3">
                                                {hotel.business_phone && (
                                                    <a
                                                        href={`tel:${hotel.business_phone}`}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="cursor-pointer text-xs text-dashboard-primary hover:underline"
                                                    >
                                                        📞 {hotel.business_phone}
                                                    </a>
                                                )}
                                                {hotel.business_email && (
                                                    <a
                                                        href={`mailto:${hotel.business_email}`}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="cursor-pointer text-xs text-dashboard-primary hover:underline"
                                                    >
                                                        ✉ {hotel.business_email}
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                        <span className="shrink-0 text-xs text-dashboard-neutral mt-0.5 whitespace-nowrap">
                                            {isExpanded ? "▲ close" : "▼ rooms"}
                                        </span>
                                    </div>
                                </button>

                                {/* Rooms */}
                                {isExpanded && (
                                    <div className="border-t border-dashboard-base-300/60 bg-dashboard-base-200/30 px-4 py-3 flex flex-col gap-3 max-h-90 overflow-y-auto">
                                        {rooms === "loading" ? (
                                            <p className="py-3 text-center text-xs text-dashboard-neutral">Loading rooms…</p>
                                        ) : !rooms || rooms.length === 0 ? (
                                            <p className="py-3 text-center text-xs text-dashboard-neutral">No rooms available for this hotel.</p>
                                        ) : rooms.map((room) => (
                                            <div
                                                key={room.id}
                                                className="rounded-lg border border-dashboard-base-300 bg-dashboard-base-100 overflow-hidden"
                                            >
                                                {/* Room details row */}
                                                <div className="flex gap-3 p-3">
                                                    {/* Image */}
                                                    <div className="shrink-0 w-20 h-20 rounded-md overflow-hidden bg-dashboard-base-200 flex items-center justify-center">
                                                        <RoomImage url={room.image_url} thumbnail={room.image_thumbnail} alt={room.name} />
                                                    </div>
                                                    {/* Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold text-dashboard-base-content">{room.name}</p>
                                                        <div className="mt-1.5 flex flex-wrap gap-1">
                                                            {room.view_type && (
                                                                <span className="rounded-full border border-dashboard-base-300 px-2 py-0.5 text-[11px] text-dashboard-base-content">
                                                                    📍 {room.view_type}
                                                                </span>
                                                            )}
                                                            {room.bed_type && (
                                                                <span className="rounded-full border border-dashboard-base-300 px-2 py-0.5 text-[11px] text-dashboard-neutral">
                                                                    🛏 {room.bed_type}
                                                                </span>
                                                            )}
                                                            <span className="rounded-full border border-dashboard-base-300 px-2 py-0.5 text-[11px] text-dashboard-neutral">
                                                                👤 Max {room.max_occupancy}
                                                            </span>
                                                            {room.area_sqft && (
                                                                <span className="rounded-full border border-dashboard-base-300 px-2 py-0.5 text-[11px] text-dashboard-neutral">
                                                                    {room.area_sqft} sqft
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Pricing plans */}
                                                {room.pricing.length > 0 && (
                                                    <div className="border-t border-dashboard-base-300/50 divide-y divide-dashboard-base-300/40">
                                                        {room.pricing.map((p) => {
                                                            const isSelected = selected?.room.id === room.id && selected?.pricing.id === p.id && selected?.hotel.id === hotel.id;
                                                            const planTotal = p.price_per_night * roomsCount * numNights;
                                                            return (
                                                                <button
                                                                    key={p.id}
                                                                    type="button"
                                                                    onClick={() => setSelected({ hotel, room, pricing: p })}
                                                                    className={`cursor-pointer w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm transition-colors ${
                                                                        isSelected
                                                                            ? "bg-green-50 text-green-700"
                                                                            : "hover:bg-dashboard-base-200/60 text-dashboard-base-content"
                                                                    }`}
                                                                >
                                                                    <div className="text-left">
                                                                        <span className={`font-medium ${isSelected ? "text-green-700" : ""}`}>
                                                                            {p.plan_name ?? "Standard plan"}
                                                                        </span>
                                                                        <div className={`text-xs mt-0.5 ${isSelected ? "text-green-600" : "text-dashboard-neutral"}`}>
                                                                            {inr(p.price_per_night)}/night × {roomsCount} room{roomsCount !== 1 ? "s" : ""} × {numNights} night{numNights !== 1 ? "s" : ""}
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-right shrink-0">
                                                                        <div className={`font-bold tabular-nums ${isSelected ? "text-green-700" : ""}`}>
                                                                            {inr(planTotal)}
                                                                        </div>
                                                                        <div className={`text-[10px] font-medium mt-0.5 ${isSelected ? "text-green-600" : "text-dashboard-neutral"}`}>
                                                                            {isSelected ? "✓ Selected" : "Select →"}
                                                                        </div>
                                                                    </div>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="shrink-0 border-t border-dashboard-base-300 bg-dashboard-base-100 px-5 py-3.5 flex flex-col gap-2.5">
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Notes: conf. ref, special requests…"
                        rows={2}
                        className="w-full rounded-md border border-dashboard-base-300 bg-dashboard-base-200/50 px-3 py-1.5 text-xs text-dashboard-base-content placeholder:text-dashboard-neutral outline-none focus:border-dashboard-primary resize-none"
                    />
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 text-xs">
                            {selected ? (
                                <span className="text-dashboard-base-content">
                                    <span className="font-semibold">{selected.hotel.name}</span>
                                    <span className="text-dashboard-neutral"> · {selected.room.name}</span>
                                    {selected.pricing.plan_name && <span className="text-dashboard-neutral"> · {selected.pricing.plan_name}</span>}
                                    <span className="ml-1.5 font-bold tabular-nums">{inr(newTotal)}</span>
                                </span>
                            ) : (
                                <span className="text-dashboard-neutral">Expand a hotel and select a room</span>
                            )}
                        </div>
                        <div className="flex gap-2 shrink-0">
                            <button
                                onClick={onClose}
                                disabled={confirming}
                                className="cursor-pointer rounded-md border border-dashboard-base-300 px-3 py-2 text-sm font-medium text-dashboard-neutral hover:bg-dashboard-base-200 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmChange}
                                disabled={confirming || !selected}
                                className="cursor-pointer rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-700/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {confirming ? "Confirming…" : "Confirm Change →"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Main Panel ────────────────────────────────────────────────────────────────
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
    const numNights = Math.max(1, Math.round(
        (new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / 86_400_000,
    ));

    const [showNotes, setShowNotes] = useState(false);
    const [notes, setNotes] = useState("");
    const [confirming, setConfirming] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);

    async function handleDirectConfirm() {
        setConfirming(true);
        try {
            const res = await confirmHotelStay(bookingId, dayNumber, defaultHotelId, {
                cityName, checkInDate, checkOutDate,
                roomType, roomsCount, ratePerRoom, totalCost, notes,
            });
            if (!res.success) { toast.error(res.error); return; }
            toast.success(
                res.allConfirmed
                    ? "All hotels confirmed! Booking moved to Hotel Confirmed."
                    : "Hotel confirmed.",
            );
            router.refresh();
        } finally { setConfirming(false); }
    }

    return (
        <>
            <div className="flex flex-col gap-2">
                {showNotes && (
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Notes: conf. ref, special requests…"
                        rows={2}
                        className="w-full rounded-md border border-dashboard-base-300 bg-dashboard-base-100 px-3 py-2 text-sm text-dashboard-base-content placeholder:text-dashboard-neutral outline-none focus:border-dashboard-primary resize-none"
                    />
                )}
                <div className="flex items-center justify-between gap-2">
                    <button
                        type="button"
                        onClick={() => setShowNotes((v) => !v)}
                        className="cursor-pointer text-xs text-dashboard-neutral hover:text-dashboard-base-content transition-colors"
                    >
                        {showNotes ? "− Remove notes" : "+ Add notes"}
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setModalOpen(true)}
                            className="cursor-pointer rounded-lg border border-dashboard-base-300 px-3 py-2 text-sm font-medium text-dashboard-base-content hover:bg-dashboard-base-200 transition-colors"
                        >
                            Change Hotel
                        </button>
                        <button
                            type="button"
                            onClick={handleDirectConfirm}
                            disabled={confirming}
                            className="cursor-pointer rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-700/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {confirming ? "Confirming…" : "✓ Confirm Hotel"}
                        </button>
                    </div>
                </div>
            </div>

            {modalOpen && (
                <ChangeHotelModal
                    bookingId={bookingId}
                    dayNumber={dayNumber}
                    defaultHotelId={defaultHotelId}
                    cityName={cityName}
                    checkInDate={checkInDate}
                    checkOutDate={checkOutDate}
                    roomsCount={roomsCount}
                    numNights={numNights}
                    destinationHotels={destinationHotels}
                    allHotels={allHotels}
                    initialNotes={notes}
                    onClose={() => setModalOpen(false)}
                    onConfirmed={() => { setModalOpen(false); router.refresh(); }}
                />
            )}
        </>
    );
}
