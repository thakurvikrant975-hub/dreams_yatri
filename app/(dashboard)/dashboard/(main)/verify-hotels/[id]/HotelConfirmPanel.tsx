"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { confirmHotelStay, getRoomsForHotels, getRoadDistances, getMealsForHotels, type RoomOption, type MealOption } from "../actions";

type Hotel = {
    id: number; name: string; category: string | null;
    city: string | null; state: string | null; address: string | null;
    destination_id: number | null;
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
    bookingId, dayNumber, defaultHotelId, defaultPricingId, cityName,
    checkInDate, checkOutDate, roomsCount, numNights,
    travellers, oldRatePerRoom, snapshotTotal, snapshotMealTotal, snapshotMealTypes,
    destinationHotels, allHotels, initialNotes,
    onClose, onConfirmed,
}: {
    bookingId: string; dayNumber: number; defaultHotelId: number; defaultPricingId: number; cityName: string;
    checkInDate: string; checkOutDate: string;
    roomsCount: number; numNights: number;
    travellers: number;
    oldRatePerRoom: number;
    snapshotTotal: number;
    snapshotMealTotal: number;
    snapshotMealTypes: string[];
    destinationHotels: Hotel[]; allHotels: Hotel[];
    initialNotes: string;
    onClose: () => void;
    onConfirmed: () => void;
}) {
    const [search, setSearch] = useState("");
    const [showAll, setShowAll] = useState(false);
    const [rooms, setRooms] = useState<RoomWithHotelId[]>([]);
    const [distances, setDistances] = useState<Map<number, number>>(new Map());
    const [meals, setMeals] = useState<Map<number, MealOption[]>>(new Map());
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<SelectedOption | null>(null);
    const [expandedPricingKeys, setExpandedPricingKeys] = useState<Set<string>>(new Set());
    const [notes, setNotes] = useState(initialNotes);
    const [confirming, setConfirming] = useState(false);

    function togglePricing(key: string, e: React.MouseEvent) {
        e.stopPropagation();
        setExpandedPricingKeys((prev) => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    }

    // Build a lookup map from hotel id → Hotel for the full allHotels list
    const hotelMap = new Map(allHotels.map((h) => [h.id, h]));

    // Fetch rooms + road distances in parallel whenever showAll changes
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setDistances(new Map());
        setMeals(new Map());

        const pool = showAll ? allHotels : destinationHotels;
        const poolIds = pool.map((h) => h.id);
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
            getRoomsForHotels(poolIds, checkInDate),
            distFetch,
            getMealsForHotels(poolIds, snapshotMealTypes, checkInDate),
        ]).then(([roomData, distData, mealData]) => {
            if (!cancelled) {
                const dMap = new Map(distData.map((d) => [d.id, d.distanceKm]));
                roomData.sort((a, b) => {
                    if (a.hotel_id === defaultHotelId) return -1;
                    if (b.hotel_id === defaultHotelId) return 1;
                    return (dMap.get(a.hotel_id) ?? Infinity) - (dMap.get(b.hotel_id) ?? Infinity);
                });
                const mMap = new Map(mealData.map((m) => [m.hotel_id, m.meals]));
                setRooms(roomData);
                setDistances(dMap);
                setMeals(mMap);
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

    // Baseline = snapshot room+mattress total + snapshot meal total (both from the frozen quote).
    // Using snapshot values avoids NaN from DB queries and ensures the diff is accurate.
    const adjustedSnapshotTotal = Number(snapshotTotal) + Number(snapshotMealTotal);

    // Build flat list: one card per room+plan
    const cards = visibleRooms.flatMap((room) => {
        const hotel = hotelMap.get(room.hotel_id);
        if (!hotel) return [];
        const isCurrentHotel = hotel.id === defaultHotelId;

        const distKm = distances.get(hotel.id);
        const distLabel = distKm != null && !isCurrentHotel ? fmtDist(distKm) : null;
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
                        </p>
                        {hotelLocation && <p className="text-[11px] text-dashboard-neutral">{hotelLocation}{distLabel && <span className="ml-1.5 text-dashboard-neutral/70">· {distLabel}</span>}</p>}
                        <p className="text-xs text-dashboard-neutral italic mt-1">No pricing configured</p>
                    </div>
                </div>
            )];
        }

        const hotelMeals = meals.get(hotel.id) ?? [];

        return room.pricing.map((p) => {
            const cardKey = `${room.id}-${p.id}`;
            const isSelected = selected?.room.id === room.id && selected?.pricing.id === p.id && selected?.hotel.id === hotel.id;
            const isCurrentBooking = isCurrentHotel && p.id === defaultPricingId;
            const isPricingExpanded = expandedPricingKeys.has(cardKey);

            // max_occupancy = beds only; extra_bed_capacity = mattress slots.
            // Total capacity per room = beds + mattresses.
            const totalCapacity = room.max_occupancy + room.extra_bed_capacity;
            const roomsNeeded   = Math.ceil(travellers / totalCapacity);
            // Extra beds = people beyond pure-bed capacity across all rooms.
            // Capped at the actual mattress slots available (rooms × extra_bed_capacity).
            const rawExtraBeds = Math.max(0, travellers - roomsNeeded * room.max_occupancy);
            const extraBeds    = p.extra_bed_rate != null
                ? Math.min(rawExtraBeds, roomsNeeded * room.extra_bed_capacity)
                : 0;

            // Cost breakdown
            const roomCost     = p.price_per_night * roomsNeeded * numNights;
            const extraBedCost = (p.extra_bed_rate != null && extraBeds > 0)
                ? p.extra_bed_rate * extraBeds * numNights : 0;
            const mealCostPerPax = hotelMeals.reduce((s, m) => s + m.price_per_person, 0);
            const mealTotal    = mealCostPerPax * travellers * numNights;
            const grandTotal   = roomCost + extraBedCost + mealTotal;
            const totalDiff    = isCurrentBooking ? 0 : grandTotal - adjustedSnapshotTotal;
            const diffLabel    = totalDiff === 0 ? null
                : `${totalDiff > 0 ? "+" : "-"}${inr(Math.abs(totalDiff))}`;

            return (
                <button
                    key={`${room.id}-${p.id}`}
                    type="button"
                    onClick={() => setSelected({ hotel, room, pricing: p })}
                    className={`cursor-pointer w-full rounded-lg border text-left flex gap-3 p-3 transition-colors ${
                        isSelected
                            ? "border-green-500 bg-green-50"
                            : isCurrentBooking
                            ? "border-green-600 bg-green-50 bg-dashboard-base-100 hover:bg-dashboard-base-200/50"
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
                            {isCurrentHotel && p.id === defaultPricingId && (
                                <span className="rounded bg-dashboard-primary/15 px-1 text-[9px] font-medium text-dashboard-primary">current</span>
                            )}
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

                        {/* Pricing toggle */}
                        <button
                            type="button"
                            onClick={(e) => togglePricing(cardKey, e)}
                            className="cursor-pointer mt-1.5 text-[10px] text-dashboard-primary hover:underline"
                        >
                            {isPricingExpanded ? "Hide pricing ▲" : "Show pricing ▼"}
                        </button>

                        {/* Cost breakdown — shown only when expanded */}
                        {isPricingExpanded && <div className="mt-1.5 pt-2 border-t border-dashboard-base-300/50 space-y-0.5 text-[10px] text-dashboard-neutral">
                            <div className="flex justify-between gap-4">
                                <span>{roomsNeeded} room{roomsNeeded > 1 ? "s" : ""} × {inr(p.price_per_night)}/night × {numNights}N</span>
                                <span className="tabular-nums">{inr(roomCost)}</span>
                            </div>
                            {extraBeds > 0 && p.extra_bed_rate != null && (
                                <div className="flex justify-between gap-4">
                                    <span>{extraBeds} mattress{extraBeds > 1 ? "es" : ""} × {inr(p.extra_bed_rate)}/night × {numNights}N</span>
                                    <span className="tabular-nums">{inr(extraBedCost)}</span>
                                </div>
                            )}
                            {snapshotMealTypes.map((mealType) => {
                                const m = hotelMeals.find((x) => x.meal_type === mealType);
                                const label = mealType.charAt(0) + mealType.slice(1).toLowerCase().replace(/_/g, " ");
                                return m ? (
                                    <div key={mealType} className="flex justify-between gap-4">
                                        <span>{m.label}: {inr(m.price_per_person)}/pax × {travellers} × {numNights}N</span>
                                        <span className="tabular-nums">{inr(m.price_per_person * travellers * numNights)}</span>
                                    </div>
                                ) : (
                                    <div key={mealType} className="flex justify-between gap-4 text-dashboard-warning/80">
                                        <span>{label}: not configured at this hotel</span>
                                        <span>—</span>
                                    </div>
                                );
                            })}
                            <div className={`flex justify-between gap-4 font-semibold pt-0.5 border-t border-dashboard-base-300/40 ${isSelected ? "text-green-700" : "text-dashboard-base-content"}`}>
                                <span>Grand total ({numNights}N)</span>
                                <span className="tabular-nums">{inr(grandTotal)}</span>
                            </div>
                        </div>}
                    </div>

                    {/* Diff column */}
                    <div className="shrink-0 flex flex-col items-end justify-start gap-1 min-w-[72px] pt-0.5">
                        {diffLabel && (
                            <span className={`text-sm font-bold tabular-nums ${totalDiff > 0 ? "text-red-500" : "text-green-600"}`}>
                                {diffLabel}
                            </span>
                        )}
                        {diffLabel && (
                            <span className="text-[10px] text-dashboard-neutral">vs current</span>
                        )}
                        {isSelected && (
                            <span className="text-[10px] font-semibold text-green-600 mt-1">✓ Selected</span>
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
// Convert meal label (e.g. "Breakfast") → meal_type key (e.g. "BREAKFAST")
function labelToMealType(label: string): string {
    return label.trim().toUpperCase().replace(/\s+/g, "_");
}

export default function HotelConfirmPanel({
    bookingId, dayNumber, defaultHotelId, defaultPricingId, cityName,
    checkInDate, checkOutDate, roomType, roomsCount, ratePerRoom, totalCost,
    travellers, snapshotMealLabels, snapshotMealTotal,
    destinationHotels, allHotels,
}: {
    bookingId: string;
    dayNumber: number;
    defaultHotelId: number;
    defaultPricingId: number;
    cityName: string;
    checkInDate: string;
    checkOutDate: string;
    roomType: string;
    roomsCount: number;
    ratePerRoom: number;
    totalCost: number;
    travellers: number;
    snapshotMealLabels: string[];
    snapshotMealTotal: number;
    destinationHotels: Hotel[];
    allHotels: Hotel[];
}) {
    const router = useRouter();
    const numNights = Math.max(1, Math.round(
        (new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / 86_400_000,
    ));
    const snapshotMealTypes = snapshotMealLabels.map(labelToMealType);

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
                    defaultPricingId={defaultPricingId}
                    cityName={cityName}
                    checkInDate={checkInDate}
                    checkOutDate={checkOutDate}
                    roomsCount={roomsCount}
                    numNights={numNights}
                    travellers={travellers}
                    oldRatePerRoom={ratePerRoom}
                    snapshotTotal={totalCost}
                    snapshotMealTotal={snapshotMealTotal}
                    snapshotMealTypes={snapshotMealTypes}
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
