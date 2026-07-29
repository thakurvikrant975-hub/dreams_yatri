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
    rooms:      number;
    travelDate: string;     // 'YYYY-MM-DD' or ''
    leavingFrom: LocationValue | null;  // user's origin city (carried from search)

    setAdults:     (n: number) => void;
    setChildCount: (n: number) => void;
    setInfants:    (n: number) => void;
    setChildAge:   (idx: number, age: number) => void;
    setRooms:      (n: number) => void;
    setTravelDate: (d: string) => void;
    setLeavingFrom: (l: LocationValue | null) => void;
    /** Set adults + children (with ages) in one go — for the TravellersField component */
    setTravellers: (adults: number, childAges: number[]) => void;

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
    children:       ReactNode;
    // Initial values carried from the search page (all optional)
    initialAdults?:      number;
    initialChildAges?:   number[];
    initialRooms?:       number;
    initialTravelDate?:  string;
    initialLeavingFrom?: LocationValue | null;
}

export function PackageBookingProvider({
    packageId, durationId, routeId, stayCategoryId, packageName, recentEnquiryCount,
    cabTypes,
    children,
    initialAdults, initialChildAges, initialRooms, initialTravelDate, initialLeavingFrom,
}: ProviderProps) {
    const [adults,     setAdultsRaw]    = useState(initialAdults && initialAdults > 0 ? initialAdults : 2);
    const [childCount, setChildRaw]     = useState(initialChildAges?.length ?? 0);
    const [infants,    setInfantsRaw]   = useState(0);
    const [childAges,  setChildAges]    = useState<number[]>(initialChildAges ?? []);
    const [rooms,      setRoomsRaw]     = useState(initialRooms && initialRooms > 0 ? initialRooms : 1);
    const [travelDate, setTravelDateRaw] = useState(initialTravelDate ?? '');
    const [leavingFrom, setLeavingFrom]  = useState<LocationValue | null>(initialLeavingFrom ?? null);
    const [dateHighlight, setDateHighlight] = useState(false);

    function setTravelDate(d: string) {
        setTravelDateRaw(d);
        if (d) setDateHighlight(false);
    }
    const [pricing,    setPricing]      = useState<SafePricing | null>(null);
    const [isPricingLoading, setLoading] = useState(false);

    const cabGroups = useMemo(() => buildCabGroups(cabTypes), [cabTypes]);

    const [cabSelections, setCabSelections] = useState<Map<string, number>>(
        () => initialCabSelections(buildCabGroups(cabTypes), (initialAdults ?? 2) + (initialChildAges?.length ?? 0)),
    );

    const [roomSelections, setRoomSelections] = useState<Map<number, number>>(new Map());
    const [roomAlternatesByStay, setRoomAlternatesByStay] = useState<Map<number, RoomOption[]>>(new Map());
    const [hotelAlternatesByStay, setHotelAlternatesByStay] = useState<Map<number, RoomOption[]>>(new Map());
    const [isLoadingAlternatives, setIsLoadingAlternatives] = useState(false);

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

    function setAdults(n: number) { setAdultsRaw(Math.max(1, n)); }

    function setChildCount(n: number) {
        const count = Math.max(0, n);
        setChildRaw(count);
        setChildAges(prev =>
            count > prev.length
                ? [...prev, ...Array(count - prev.length).fill(8)]
                : prev.slice(0, count),
        );
    }

    function setInfants(n: number) { setInfantsRaw(Math.max(0, n)); }

    function setRooms(n: number) { setRoomsRaw(Math.max(1, n)); }

    function setChildAge(idx: number, age: number) {
        setChildAges(prev => {
            const next = [...prev];
            next[idx] = Math.max(2, Math.min(17, age));
            return next;
        });
    }

    function setTravellers(nextAdults: number, ages: number[]) {
        setAdultsRaw(Math.max(1, nextAdults));
        setChildRaw(ages.length);
        setChildAges(ages);
    }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [adults, childCount, infants, childAges, travelDate, cabSelections, roomSelections, packageId, durationId, routeId, stayCategoryId]);

    return (
        <BookingContext.Provider value={{
            adults, childCount, infants, childAges, rooms, travelDate, leavingFrom,
            setAdults, setChildCount, setInfants, setChildAge, setRooms, setTravelDate, setLeavingFrom, setTravellers,
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
