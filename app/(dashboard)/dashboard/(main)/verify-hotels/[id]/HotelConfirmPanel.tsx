"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { confirmHotelStay, getRoomsForHotels, getRoadDistances, type RoomOption } from "../actions";

type Hotel = {
    id: number; name: string; category: string | null;
    city: string | null; state: string | null; address: string | null;
    destination_id: number;
    business_phone: string | null;
    business_email: string | null;
    latitude: number | null;
    longitude: number | null;
};

type RoomWithHotelId = RoomOption & { hotel_id: number };
type SelectedOption = { hotel: Hotel; room: RoomOption; pricing: RoomOption["pricing"][0] };

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

function fmtDist(km: number): string {
    return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

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
    oldRatePerRoom,
    destinationHotels, allHotels, initialNotes,
    onClose, onConfirmed,
}: {
    bookingId: string; dayNumber: number; defaultHotelId: number; cityName: string;
    checkInDate: string; checkOutDate: string;
    roomsCount: number; numNights: number;
    oldRatePerRoom: number;
    destinationHotels: Hotel[]; allHotels: Hotel[];
    initialNotes: string;
    onClose: () => void;
    onConfirmed: () => void;
}) {
    const [search, setSearch] = useState("");
    const [showAll, setShowAll] = useState(false);
    const [rooms, setRooms] = useState<RoomWithHotelId[]>([]);
    const [distances, setDistances] = useState<Map<number, number>>(new Map());
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<SelectedOption | null>(null);
    const [notes, setNotes] = useState(initialNotes);
    const [confirming, setConfirming] = useState(false);

    // Build a lookup map from hotel id → Hotel for the full allHotels list
    const hotelMap = new Map(allHotels.map((h) => [h.id, h]));

    // Fetch rooms + road distances in parallel whenever showAll changes
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setDistances(new Map());

        const pool = showAll ? allHotels : destinationHotels;
        const currentHotel = allHotels.find((h) => h.id === defaultHotelId);
        const cLat = currentHotel?.latitude ?? null;
        const cLon = currentHotel?.longitude ?? null;

        const hotelsWithCoords = (cLat != null && cLon != null)
            ? pool
                .filter((h) => h.id !== defaultHotelId && h.latitude != null && h.longitude != null)
                .map((h) => ({ id: h.id, lat: h.latitude!, lon: h.longitude! }))
            : [];

        const distFetch = hotelsWithCoords.length > 0
            ? getRoadDistances(cLat!, cLon!, hotelsWithCoords)
            : Promise.resolve([] as { id: number; distanceKm: number }[]);

        Promise.all([
            getRoomsForHotels(pool.map((h) => h.id), checkInDate),
            distFetch,
        ]).then(([roomData, distData]) => {
            if (!cancelled) {
                const dMap = new Map(distData.map((d) => [d.id, d.distanceKm]));
                roomData.sort((a, b) => {
                    if (a.hotel_id === defaultHotelId) return -1;
                    if (b.hotel_id === defaultHotelId) return 1;
                    return (dMap.get(a.hotel_id) ?? Infinity) - (dMap.get(b.hotel_id) ?? Infinity);
                });
                setRooms(roomData);
                setDistances(dMap);
                setLoading(false);
            }
        });
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showAll]);

    // Filter rooms by search query (room name, hotel name, city)
    const q = search.trim().toLowerCase();
    const visibleRooms = q
        ? rooms.filter((r) => {
              const hotel = hotelMap.get(r.hotel_id);
              return r.name.toLowerCase().includes(q) ||
                     (hotel?.name ?? "").toLowerCase().includes(q) ||
                     (hotel?.city ?? "").toLowerCase().includes(q);
          })
        : rooms;

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

    // Build flat list: one card per room+plan
    const cards = visibleRooms.flatMap((room) => {
        const hotel = hotelMap.get(room.hotel_id);
        if (!hotel) return [];
        const isBookedHotel = hotel.id === defaultHotelId;

        const distKm = distances.get(hotel.id);
        const distLabel = distKm != null && !isBookedHotel ? fmtDist(distKm) : null;
        const hotelLocation = [hotel.city, hotel.state].filter(Boolean).join(", ");

        if (room.pricing.length === 0) {
            return [(
                <div key={`${room.id}-noprice`} className="rounded-lg border border-dashboard-base-300 bg-dashboard-base-100 flex gap-3 p-3 items-center">
                    <div className="shrink-0 w-14 h-14 rounded-md overflow-hidden bg-dashboard-base-200 flex items-center justify-center">
                        <RoomImage url={room.image_url} thumbnail={room.image_thumbnail} alt={room.name} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-dashboard-base-content">{room.name}</p>
                        <p className="text-xs text-dashboard-neutral mt-0.5 flex items-center gap-1 flex-wrap">
                            {hotel.name}
                            {isBookedHotel && <span className="rounded bg-dashboard-primary/15 px-1 text-[9px] font-medium text-dashboard-primary">current</span>}
                        </p>
                        {hotelLocation && <p className="text-[11px] text-dashboard-neutral">{hotelLocation}{distLabel && <span className="ml-1.5 text-dashboard-neutral/70">· {distLabel}</span>}</p>}
                        <p className="text-xs text-dashboard-neutral italic mt-1">No pricing configured</p>
                    </div>
                </div>
            )];
        }

        return room.pricing.map((p) => {
            const isSelected = selected?.room.id === room.id && selected?.pricing.id === p.id && selected?.hotel.id === hotel.id;
            const priceDiff = p.price_per_night - oldRatePerRoom;
            const planTotal = p.price_per_night * roomsCount * numNights;
            const diffLabel = priceDiff === 0 ? null : `${priceDiff > 0 ? "+" : "-"}${inr(Math.abs(priceDiff))}`;

            return (
                <button
                    key={`${room.id}-${p.id}`}
                    type="button"
                    onClick={() => setSelected({ hotel, room, pricing: p })}
                    className={`cursor-pointer w-full rounded-lg border text-left flex gap-3 p-3 transition-colors ${
                        isSelected
                            ? "border-green-500 bg-green-50"
                            : "border-dashboard-base-300 bg-dashboard-base-100 hover:bg-dashboard-base-200/50"
                    }`}
                >
                    {/* Image */}
                    <div className="shrink-0 w-14 h-14 rounded-md overflow-hidden bg-dashboard-base-200 flex items-center justify-center">
                        <RoomImage url={room.image_url} thumbnail={room.image_thumbnail} alt={room.name} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${isSelected ? "text-green-700" : "text-dashboard-base-content"}`}>
                            {room.name}
                            {p.plan_name && (
                                <span className="ml-1.5 text-xs font-normal text-dashboard-neutral">· {p.plan_name}</span>
                            )}
                        </p>
                        <p className="text-xs text-dashboard-neutral mt-0.5 flex items-center gap-1 flex-wrap">
                            {hotel.name}
                            {isBookedHotel && <span className="rounded bg-dashboard-primary/15 px-1 text-[9px] font-medium text-dashboard-primary">current</span>}
                        </p>
                        {(hotelLocation || distLabel) && (
                            <p className="text-[11px] text-dashboard-neutral/80 mt-0.5">
                                {hotelLocation}
                                {distLabel && <span className="ml-1.5 font-medium text-dashboard-neutral">· {distLabel}</span>}
                            </p>
                        )}
                        <div className="mt-1.5 flex flex-wrap gap-1">
                            {room.view_type && (
                                <span className="rounded-full border border-dashboard-base-300 px-2 py-0.5 text-[10px] text-dashboard-base-content">
                                    📍 {room.view_type}
                                </span>
                            )}
                            {room.bed_type && (
                                <span className="rounded-full border border-dashboard-base-300 px-2 py-0.5 text-[10px] text-dashboard-neutral">
                                    🛏 {room.bed_type}
                                </span>
                            )}
                            <span className="rounded-full border border-dashboard-base-300 px-2 py-0.5 text-[10px] text-dashboard-neutral">
                                👤 Max {room.max_occupancy}
                            </span>
                            {room.area_sqft && (
                                <span className="rounded-full border border-dashboard-base-300 px-2 py-0.5 text-[10px] text-dashboard-neutral">
                                    {room.area_sqft} sqft
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Price column */}
                    <div className="shrink-0 flex flex-col items-end justify-center gap-0.5 min-w-[80px]">
                        {diffLabel && (
                            <span className={`text-sm font-bold tabular-nums ${priceDiff > 0 ? "text-red-500" : "text-green-600"}`}>
                                {diffLabel}
                            </span>
                        )}
                        <span className={`text-sm font-semibold tabular-nums ${isSelected ? "text-green-700" : "text-dashboard-base-content"}`}>
                            {inr(p.price_per_night)}
                            <span className="text-[10px] font-normal text-dashboard-neutral">/night</span>
                        </span>
                        <span className="text-[10px] text-dashboard-neutral tabular-nums">{inr(planTotal)} total</span>
                        {isSelected && (
                            <span className="text-[10px] font-semibold text-green-600 mt-0.5">✓ Selected</span>
                        )}
                    </div>
                </button>
            );
        });
    });

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="relative flex flex-col w-full max-w-2xl h-[90vh] rounded-xl bg-dashboard-base-100 shadow-2xl overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between border-b border-dashboard-base-300 px-5 py-3.5 shrink-0">
                    <div>
                        <h3 className="text-sm font-semibold text-dashboard-base-content">
                            🏨 Change Room — Day {dayNumber} · {cityName}
                        </h3>
                        {!loading && (
                            <p className="text-[11px] text-dashboard-neutral mt-0.5">
                                {visibleRooms.length} room{visibleRooms.length !== 1 ? "s" : ""} available
                            </p>
                        )}
                    </div>
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
                        placeholder="Search room or hotel name…"
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

                {/* Room list */}
                <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3 space-y-2">
                    {loading ? (
                        <p className="py-10 text-center text-sm text-dashboard-neutral">Loading rooms…</p>
                    ) : cards.length === 0 ? (
                        <p className="py-10 text-center text-sm text-dashboard-neutral">
                            {q ? "No rooms match your search." : "No rooms available."}
                        </p>
                    ) : cards}
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
                                <span className="text-dashboard-neutral">Select a room from the list above</span>
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
                    oldRatePerRoom={ratePerRoom}
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
