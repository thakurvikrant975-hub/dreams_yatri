'use client';

import {
    createContext,
    useContext,
    useState,
    useEffect,
    useRef,
    useMemo,
    type ReactNode,
} from 'react';
import { handleComputePackagePrice } from '@/app/actions/packages/pricing.actions';
import type { LocationValue } from '@/app/components/ui/LocationSearchSelect';
import type { CabTypeOption, RoomOption } from '@/app/actions/packages/fetch-page-data';
import { fetchRoomAlternatives, fetchHotelAlternatives } from '@/app/actions/packages/hotel-alternatives.actions';
import { MAX_ROOMS } from '@/app/components/ui/TravellersField';
import { notifyLimit } from '@/app/components/ui/Stepper';
import { MAX_GUESTS_PER_ROOM } from '@/app/lib/room-guest-limits';
import { seedRoomGuests, type RoomGuests } from '@/app/lib/packages/roomGuests';

// ── Room-count cap ────────────────────────────────────────────────────────
//
// hotel_rooms.num_rooms is total inventory for a room type at its hotel.
// Most existing hotels have never had it set by an owner/admin, which left
// it at the schema default of 1 — indistinguishable, from this field alone,
// from a hotel that genuinely only has one room of that type. Treating a
// bare "1" as an authoritative cap would wrongly lock nearly every existing
// package down to a single room. So: only numbers greater than 1 are trusted
// as a real, deliberately-set inventory limit; "1" is treated as "not
// configured yet" and falls back to a generous-but-modest default — not the
// app-wide MAX_ROOMS ceiling, which would wildly overstate what an
// unconfigured property can actually fulfil.
const UNCONFIGURED_ROOM_FALLBACK = 3;
export function effectiveRoomCap(numRooms: number): number {
    return numRooms > 1 ? numRooms : UNCONFIGURED_ROOM_FALLBACK;
}

// Guest cap per room, independent of each hotel's configured room
// capacity/extra-bed data — every room card allows up to this many guests.
// Shared with the dashboard pricing preview via MAX_GUESTS_PER_ROOM so both
// stay in lockstep.

// requestMoreRooms won't attempt an auto-swap when more stays than this are
// simultaneously the bottleneck — see the comment at its call site.
const MAX_AUTO_SWAP_BOTTLENECKS = 2;

/** One package stay's default room + its total inventory, as shipped from
 *  the server (see fetch-page-data.ts's HotelDay/RoomOption). */
export type StayRoomCount = {
    itineraryStayId: number;
    roomPricingId:   number;
    hotelId:         number;
    numRooms:        number;
    roomCapacity:    number | null;
    roomExtraBeds:   number;
    /** Total guests one room of this type really holds — computed server-side
     *  by roomTotalCapacity(); see app/lib/room-capacity.ts for why the raw
     *  columns can't be added up naively here. */
    roomTotalCapacity: number;
};

/** One MMT-style room card: its own adults + child ages, independent of every
 *  other room in the booking. Defined in lib/packages/roomGuests alongside its
 *  URL codec, so the search surfaces can hand this page the exact split the
 *  guest picked rather than a flat total it has to guess back. */
export type { RoomGuests };

// ── Safe pricing — only these fields reach the browser ──────────────────────

export interface SafePricingBreakdown {
    hotelSubtotal:    number;
    mealSubtotal:     number;
    activitySubtotal: number;
    cabSubtotal:      number;
    permitSubtotal:   number;
    baseCost:         number;
    marginAmount:     number;
    marginPercentage: number;
}

export interface SafePermit {
    name:       string;
    unitPrice:  number;
    priceType:  string;
    quantity:   number;
    total:      number;
}

export interface SafePricing {
    pricePerAdult: number;
    finalPrice:    number;
    gstAmount:     number;
    gstPercentage: number;
    breakdown:     SafePricingBreakdown;
    permits:       SafePermit[];
}

// ── Cab group — cabs sharing the same day range ───────────────────────────

export interface CabGroup {
    groupKey: string;
    dayFrom:  number;
    dayTo:    number;
    cabs:     CabTypeOption[];
}

// ── Context value ──────────────────────────────────────────────────────────

export interface BookingContextValue {
    // Traveller inputs
    adults:     number;
    childCount: number;
    infants:    number;
    childAges:  number[];   // length === childCount, each 2-11
    rooms:      number;     // roomGuests.length
    /** The MMT-style per-room breakdown — the source of truth `adults`/
     *  `childCount`/`childAges`/`rooms` above are all derived from. */
    roomGuests: RoomGuests[];
    /** Highest room count currently selectable, given the active room type
     *  at every stay in this itinerary (see effectiveRoomCap). */
    maxRooms:   number;
    /** Smallest (max_occupancy + extra_bed_capacity) among the active rooms —
     *  how many guests one room can currently hold, at the tightest stay. */
    personsPerRoom: number;
    travelDate: string;     // 'YYYY-MM-DD' or ''
    leavingFrom: LocationValue | null;  // user's origin city (carried from search)

    setRoomGuests: (rooms: RoomGuests[]) => void;
    /** Called when the guest wants more rooms than `maxRooms` currently
     *  allows. Tries to raise the ceiling by swapping every bottleneck
     *  stay's hotel for a nearby (~22km), same-tier alternative with enough
     *  room inventory — mirrors "Change Hotel"'s own geo-search. Resolves
     *  true only if EVERY bottleneck stay found a fit (so the full
     *  `desired` count is now achievable); false leaves maxRooms untouched. */
    requestMoreRooms: (desired: number) => Promise<boolean>;
    setInfants:    (n: number) => void;
    setTravelDate: (d: string) => void;
    setLeavingFrom: (l: LocationValue | null) => void;

    // Date validation highlight — set true when user tries to book without picking a date
    dateHighlight:    boolean;
    setDateHighlight: (v: boolean) => void;

    // Cab selection
    cabGroups:         CabGroup[];
    cabSelections:     Map<string, number>; // groupKey → cabTypeId
    setCabForGroup:    (groupKey: string, cabTypeId: number) => void;

    // Hotel/room selection — itinerary_stays.id → chosen room_pricing_id.
    // Both "Change Room" (same hotel) and "Change Hotel" (nearby) resolve
    // through this one override; the candidate lists differ, the mechanism doesn't.
    roomSelections:          Map<number, number>; // itineraryStayId → room_pricing_id
    setRoomForStay:          (itineraryStayId: number, roomPricingId: number) => void;
    roomAlternatesByStay:    Map<number, RoomOption[]>; // same-hotel room/plan options
    hotelAlternatesByStay:   Map<number, RoomOption[]>; // nearby-hotel options
    loadRoomAlternatives:    (itineraryStayId: number, hotelId: number) => Promise<void>;
    loadHotelAlternatives:   (itineraryStayId: number, hotelId: number) => Promise<void>;
    isLoadingAlternatives:   boolean;

    // Pricing output (safe)
    pricing:          SafePricing | null;
    isPricingLoading: boolean;

    // Package metadata
    packageName: string;
    recentEnquiryCount: number;

    // Selectors — needed to build a quote on "Book"
    packageId:      number;
    durationId:     number;
    routeId:        number;
    stayCategoryId: number;
}

export const BookingContext = createContext<BookingContextValue | null>(null);

export function useBooking(): BookingContextValue {
    const ctx = useContext(BookingContext);
    if (!ctx) throw new Error('useBooking must be inside PackageBookingProvider');
    return ctx;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function buildCabGroups(cabTypes: CabTypeOption[]): CabGroup[] {
    const map = new Map<string, CabGroup>();
    for (const ct of cabTypes) {
        const seg = ct.segments[0];
        if (!seg) continue;
        const key = `${seg.day_from}-${seg.day_to}`;
        if (!map.has(key)) map.set(key, { groupKey: key, dayFrom: seg.day_from, dayTo: seg.day_to, cabs: [] });
        map.get(key)!.cabs.push(ct);
    }
    return Array.from(map.values()).sort((a, b) => a.dayFrom - b.dayFrom);
}

function optimalCabId(cabs: CabTypeOption[], passengers: number): number | null {
    if (!cabs.length) return null;
    const sorted = [...cabs].sort((a, b) => a.vehicle.passenger_capacity - b.vehicle.passenger_capacity);
    // smallest cab that fits; fall back to largest if none fits
    const fit = sorted.find(ct => ct.vehicle.passenger_capacity >= passengers) ?? sorted[sorted.length - 1];
    return fit?.id ?? null;
}

function initialCabSelections(groups: CabGroup[], passengers: number): Map<string, number> {
    const map = new Map<string, number>();
    for (const g of groups) {
        const id = optimalCabId(g.cabs, passengers) ?? g.cabs.find(c => c.is_default)?.id ?? g.cabs[0]?.id;
        if (id != null) map.set(g.groupKey, id);
    }
    return map;
}

// ── Provider ───────────────────────────────────────────────────────────────

interface ProviderProps {
    packageId:          number;
    durationId:         number;
    routeId:            number;
    stayCategoryId:     number;
    packageName:        string;
    recentEnquiryCount: number;
    cabTypes:           CabTypeOption[];
    /** Default room + inventory per itinerary stay — the basis for maxRooms. */
    stayRoomCounts:     StayRoomCount[];
    children:       ReactNode;
    // Initial values carried from the search page (all optional)
    /** The real per-room split from the search bar's `pax` param. Preferred
     *  over the flat trio below, which can only be split back by guessing. */
    initialRoomGuests?:  RoomGuests[];
    initialAdults?:      number;
    initialChildAges?:   number[];
    initialRooms?:       number;
    initialTravelDate?:  string;
    initialLeavingFrom?: LocationValue | null;
}

export function PackageBookingProvider({
    packageId, durationId, routeId, stayCategoryId, packageName, recentEnquiryCount,
    cabTypes, stayRoomCounts,
    children,
    initialRoomGuests, initialAdults, initialChildAges, initialRooms,
    initialTravelDate, initialLeavingFrom,
}: ProviderProps) {
    const [roomGuests, setRoomGuestsRaw] = useState<RoomGuests[]>(
        () => initialRoomGuests?.length
            ? initialRoomGuests
            : seedRoomGuests(initialAdults, initialChildAges, initialRooms),
    );
    const [infants,    setInfantsRaw]   = useState(0);
    const [travelDate, setTravelDateRaw] = useState(initialTravelDate ?? '');
    const [leavingFrom, setLeavingFrom]  = useState<LocationValue | null>(initialLeavingFrom ?? null);
    const [dateHighlight, setDateHighlight] = useState(false);

    function setTravelDate(d: string) {
        setTravelDateRaw(d);
        if (d) setDateHighlight(false);
    }
    const [pricing,    setPricing]      = useState<SafePricing | null>(null);
    const [isPricingLoading, setLoading] = useState(false);

    // Flat trip-wide totals, derived from the per-room breakdown — every
    // other part of the page (pricing, cab auto-upgrade, the quote/enquiry
    // payloads) only ever needs the aggregate, not which room a guest is in.
    const adults     = useMemo(() => roomGuests.reduce((sum, r) => sum + r.adults, 0), [roomGuests]);
    const childAges  = useMemo(() => roomGuests.flatMap((r) => r.childAges), [roomGuests]);
    const childCount = childAges.length;
    const rooms      = roomGuests.length;

    const cabGroups = useMemo(() => buildCabGroups(cabTypes), [cabTypes]);

    const [cabSelections, setCabSelections] = useState<Map<string, number>>(
        () => initialCabSelections(buildCabGroups(cabTypes), (initialAdults ?? 2) + (initialChildAges?.length ?? 0)),
    );

    const [roomSelections, setRoomSelections] = useState<Map<number, number>>(new Map());
    const [roomAlternatesByStay, setRoomAlternatesByStay] = useState<Map<number, RoomOption[]>>(new Map());
    const [hotelAlternatesByStay, setHotelAlternatesByStay] = useState<Map<number, RoomOption[]>>(new Map());
    const [isLoadingAlternatives, setIsLoadingAlternatives] = useState(false);

    // A package covers multiple stays, but the traveller picks one room count
    // for the whole trip — so the ceiling is the smallest inventory among the
    // room types actually in play right now (each stay's override if one was
    // picked via "Change Room"/"Change Hotel", else its default room).
    const maxRooms = useMemo(() => {
        if (stayRoomCounts.length === 0) return MAX_ROOMS;
        const caps = stayRoomCounts.map((stay) => {
            const overrideId = roomSelections.get(stay.itineraryStayId);
            if (overrideId == null || overrideId === stay.roomPricingId) {
                return effectiveRoomCap(stay.numRooms);
            }
            const alternates = [
                ...(roomAlternatesByStay.get(stay.itineraryStayId) ?? []),
                ...(hotelAlternatesByStay.get(stay.itineraryStayId) ?? []),
            ];
            const picked = alternates.find((o) => o.room_pricing_id === overrideId);
            // Alternates load on demand — until they arrive, fall back to the
            // default room's cap rather than under- or over-restricting blind.
            return effectiveRoomCap(picked?.room_num_rooms ?? stay.numRooms);
        });
        return Math.min(...caps);
    }, [stayRoomCounts, roomSelections, roomAlternatesByStay, hotelAlternatesByStay]);

    // How many guests the tightest active room across the itinerary holds —
    // the smallest wins, since every stay must house the party with the same
    // room split. This is the room's REAL total capacity (max_adults +
    // max_children, floored at the bed count), computed server-side by
    // roomTotalCapacity(); the raw max_occupancy column is only the base beds,
    // and treating it as the total is what used to force extra rooms and a
    // higher price than the hotel's own configuration implies.
    // The pricing engine re-derives this same number per stay, so a split the
    // picker allows here is always one the engine will honour.
    const personsPerRoom = useMemo(() => {
        if (stayRoomCounts.length === 0) return MAX_GUESTS_PER_ROOM;
        const capacities = stayRoomCounts.map((stay) => {
            const overrideId = roomSelections.get(stay.itineraryStayId);
            if (overrideId == null || overrideId === stay.roomPricingId) {
                return stay.roomTotalCapacity;
            }
            const alternates = [
                ...(roomAlternatesByStay.get(stay.itineraryStayId) ?? []),
                ...(hotelAlternatesByStay.get(stay.itineraryStayId) ?? []),
            ];
            const picked = alternates.find((o) => o.room_pricing_id === overrideId);
            // Alternates load on demand — until they arrive, fall back to the
            // default room's capacity rather than guessing.
            return picked?.room_total_capacity ?? stay.roomTotalCapacity;
        });
        return Math.max(1, Math.min(...capacities));
    }, [stayRoomCounts, roomSelections, roomAlternatesByStay, hotelAlternatesByStay]);

    // Safety net for a *later* inventory shrink (e.g. "Change Room"/"Change
    // Hotel" after the guest already committed a room breakdown): the MMT
    // picker itself blocks Apply when it exceeds maxRooms (see
    // RoomsGuestsField), but if maxRooms drops below an already-committed
    // roomGuests.length some other way, truncate rather than silently
    // letting an over-inventory count reach pricing.
    useEffect(() => {
        setRoomGuestsRaw((prev) => {
            if (prev.length <= maxRooms) return prev;
            notifyLimit(`Only up to ${maxRooms} room${maxRooms > 1 ? 's' : ''} are available for this trip's hotels now — the last ${prev.length - maxRooms} room(s) were removed.`);
            return prev.slice(0, maxRooms);
        });
    }, [maxRooms]);

    // Auto-upgrade cabs whenever passenger count changes.
    // `cabGroups` is recomputed (new reference) whenever `cabTypes` arrives
    // as a fresh array across the RSC boundary, which can happen without the
    // resolved cab selections actually changing. Bail out to `prev` itself
    // when nothing differs so `cabSelections`'s identity stays stable —
    // otherwise every such re-run resets the debounced pricing-fetch effect
    // below (which depends on `cabSelections`) before its timer can fire.
    useEffect(() => {
        const passengers = adults + childCount;
        setCabSelections(prev => {
            const next = new Map(prev);
            for (const g of cabGroups) {
                const id = optimalCabId(g.cabs, passengers);
                if (id != null) next.set(g.groupKey, id);
            }
            if (next.size === prev.size && [...next].every(([k, v]) => prev.get(k) === v)) {
                return prev;
            }
            return next;
        });
    }, [adults, childCount, cabGroups]);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Traveller setters ────────────────────────────────────────────────────

    function setInfants(n: number) { setInfantsRaw(Math.max(0, n)); }

    // Committed by RoomsGuestsField's Apply — already validated there
    // (per-room capacity, unset child ages, and the maxRooms availability
    // check), so this is a plain commit, no re-clamping needed here.
    function setRoomGuests(next: RoomGuests[]) { setRoomGuestsRaw(next); }

    function setCabForGroup(groupKey: string, cabTypeId: number) {
        setCabSelections(prev => {
            const next = new Map(prev);
            next.set(groupKey, cabTypeId);
            return next;
        });
    }

    function setRoomForStay(itineraryStayId: number, roomPricingId: number) {
        setRoomSelections(prev => {
            const next = new Map(prev);
            next.set(itineraryStayId, roomPricingId);
            return next;
        });
    }

    async function loadRoomAlternatives(itineraryStayId: number, hotelId: number) {
        if (roomAlternatesByStay.has(itineraryStayId)) return;
        setIsLoadingAlternatives(true);
        try {
            const rows = await fetchRoomAlternatives(hotelId);
            setRoomAlternatesByStay(prev => new Map(prev).set(itineraryStayId, rows));
        } finally {
            setIsLoadingAlternatives(false);
        }
    }

    async function loadHotelAlternatives(itineraryStayId: number, hotelId: number) {
        if (hotelAlternatesByStay.has(itineraryStayId)) return;
        setIsLoadingAlternatives(true);
        try {
            const rows = await fetchHotelAlternatives(hotelId);
            setHotelAlternatesByStay(prev => new Map(prev).set(itineraryStayId, rows));
        } finally {
            setIsLoadingAlternatives(false);
        }
    }

    async function requestMoreRooms(desired: number): Promise<boolean> {
        if (desired <= maxRooms) return true;

        // Stays currently pinning the ceiling (maxRooms = the smallest cap
        // across the trip) — every one of them needs a bigger room for the
        // ceiling to actually move; a single unswappable stay still caps it.
        const bottlenecks = stayRoomCounts.filter((stay) => {
            const overrideId = roomSelections.get(stay.itineraryStayId);
            let activeNumRooms = stay.numRooms;
            if (overrideId != null && overrideId !== stay.roomPricingId) {
                const alternates = [
                    ...(roomAlternatesByStay.get(stay.itineraryStayId) ?? []),
                    ...(hotelAlternatesByStay.get(stay.itineraryStayId) ?? []),
                ];
                activeNumRooms = alternates.find((o) => o.room_pricing_id === overrideId)?.room_num_rooms ?? stay.numRooms;
            }
            return effectiveRoomCap(activeNumRooms) === maxRooms;
        });
        // Each bottleneck fans out into its own geo-search (haversine +
        // several OSRM road-routing calls). Fine for the common case of one
        // or two tied-for-tightest hotels; with most stays unconfigured and
        // sharing the same fallback cap, this list can realistically be
        // "every stay in the trip" — swapping that many hotels at once
        // against a free routing service isn't practical (or likely to fully
        // succeed anyway), so bail immediately rather than making the guest
        // wait a long time for a search that probably won't fully unblock.
        if (bottlenecks.length === 0 || bottlenecks.length > MAX_AUTO_SWAP_BOTTLENECKS) return false;

        const AUTO_SWAP_TIMEOUT_MS = 8_000;
        const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), AUTO_SWAP_TIMEOUT_MS));

        const results = await Promise.race([
            Promise.all(bottlenecks.map(async (stay) => {
                const rows = await fetchHotelAlternatives(stay.hotelId);
                setHotelAlternatesByStay((prev) => new Map(prev).set(stay.itineraryStayId, rows));
                // Rows already come back nearest + same-star-tier first — just take
                // the first one that actually has enough inventory to fit.
                const fit = rows.find((o) => effectiveRoomCap(o.room_num_rooms) >= desired);
                return fit ? { itineraryStayId: stay.itineraryStayId, roomPricingId: fit.room_pricing_id } : null;
            })),
            timeout,
        ]);

        // Timed out, or at least one bottleneck had nothing that fit.
        if (results === null || results.some((r) => r === null)) return false;

        setRoomSelections((prev) => {
            const next = new Map(prev);
            for (const r of results) next.set(r!.itineraryStayId, r!.roomPricingId);
            return next;
        });
        return true;
    }

    // Re-fetch price whenever pax changes (debounced 400 ms)
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            setLoading(true);
            try {
                const cabTypeIds = Array.from(cabSelections.values());
                const roomOverrides = Array.from(roomSelections.entries()).map(
                    ([itinerary_stay_id, room_pricing_id]) => ({ itinerary_stay_id, room_pricing_id }),
                );
                const res = await handleComputePackagePrice({
                    package_id:       packageId,
                    duration_id:      durationId,
                    route_id:         routeId,
                    stay_category_id: stayCategoryId,
                    adults,
                    children:         childCount,
                    infants,
                    child_ages:       childAges.length === childCount ? childAges : undefined,
                    travel_date:      travelDate || (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })(),
                    cab_type_ids:     cabTypeIds.length > 0 ? cabTypeIds : null,
                    room_pricing_overrides: roomOverrides.length > 0 ? roomOverrides : null,
                    rooms:            roomGuests.map((r) => ({ adults: r.adults, children: r.childAges.length })),
                });
                if (res.success) {
                    if (res.data.missing_pricing_config) {
                        setPricing(null);
                    } else {
                        setPricing({
                            pricePerAdult: Math.ceil(res.data.price_per_adult),
                            finalPrice:    Math.ceil(res.data.final_price),
                            gstAmount:     Math.ceil(res.data.gst_amount),
                            gstPercentage: res.data.gst_percentage,
                            breakdown: {
                                hotelSubtotal:    Math.ceil(res.data.hotel_subtotal),
                                mealSubtotal:     Math.ceil(res.data.meal_subtotal),
                                activitySubtotal: Math.ceil(res.data.activity_subtotal),
                                cabSubtotal:      Math.ceil(res.data.cab_subtotal),
                                permitSubtotal:   Math.ceil(res.data.permit_subtotal),
                                baseCost:         Math.ceil(res.data.base_cost),
                                marginAmount:     Math.ceil(res.data.margin_amount),
                                marginPercentage: res.data.margin_percentage,
                            },
                            permits: res.data.permits.map((p) => ({
                                name:      p.name,
                                unitPrice: p.unit_price,
                                priceType: p.price_type,
                                quantity:  p.quantity,
                                total:     Math.ceil(p.total),
                            })),
                        });
                    }
                }
            } finally {
                setLoading(false);
            }
        }, 400);

        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [adults, childCount, infants, childAges, roomGuests, travelDate, cabSelections, roomSelections, packageId, durationId, routeId, stayCategoryId]);

    return (
        <BookingContext.Provider value={{
            adults, childCount, infants, childAges, rooms, roomGuests, maxRooms, personsPerRoom, travelDate, leavingFrom,
            setRoomGuests, requestMoreRooms, setInfants, setTravelDate, setLeavingFrom,
            cabGroups, cabSelections, setCabForGroup,
            roomSelections, setRoomForStay, roomAlternatesByStay, hotelAlternatesByStay,
            loadRoomAlternatives, loadHotelAlternatives, isLoadingAlternatives,
            pricing, isPricingLoading, packageName, recentEnquiryCount,
            packageId, durationId, routeId, stayCategoryId,
            dateHighlight, setDateHighlight,
        }}>
            {children}
        </BookingContext.Provider>
    );
}
