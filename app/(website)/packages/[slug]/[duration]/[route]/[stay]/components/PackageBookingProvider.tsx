'use client';

import {
    createContext,
    useContext,
    useState,
    useEffect,
    useRef,
    type ReactNode,
} from 'react';
import { handleComputePackagePrice } from '@/app/actions/packages/pricing.actions';
import type { LocationValue } from '@/app/components/ui/LocationSearchSelect';

// ── Safe pricing — only these fields reach the browser ──────────────────────
// margin, base_cost, per-component subtotals are intentionally excluded.

export interface SafePricing {
    pricePerAdult: number;
    finalPrice:    number;
    gstAmount:     number;
    gstPercentage: number;
}

export interface BookingContextValue {
    // Traveller inputs
    adults:     number;
    childCount: number;
    infants:    number;
    childAges:  number[];   // length === childCount, each 2-11
    travelDate: string;     // 'YYYY-MM-DD' or ''
    leavingFrom: LocationValue | null;  // user's origin city (carried from search)

    setAdults:     (n: number) => void;
    setChildCount: (n: number) => void;
    setInfants:    (n: number) => void;
    setChildAge:   (idx: number, age: number) => void;
    setTravelDate: (d: string) => void;
    setLeavingFrom: (l: LocationValue | null) => void;
    /** Set adults + children (with ages) in one go — for the TravellersField component */
    setTravellers: (adults: number, childAges: number[]) => void;

    // Pricing output (safe)
    pricing:          SafePricing | null;
    isPricingLoading: boolean;

    // Package metadata
    packageName: string;
}

export const BookingContext = createContext<BookingContextValue | null>(null);

export function useBooking(): BookingContextValue {
    const ctx = useContext(BookingContext);
    if (!ctx) throw new Error('useBooking must be inside PackageBookingProvider');
    return ctx;
}

interface ProviderProps {
    packageId:      number;
    durationId:     number;
    routeId:        number;
    stayCategoryId: number;
    packageName:    string;
    children:       ReactNode;
    // Initial values carried from the search page (all optional)
    initialAdults?:      number;
    initialChildAges?:   number[];
    initialTravelDate?:  string;
    initialLeavingFrom?: LocationValue | null;
}

export function PackageBookingProvider({
    packageId, durationId, routeId, stayCategoryId, packageName,
    children,
    initialAdults, initialChildAges, initialTravelDate, initialLeavingFrom,
}: ProviderProps) {
    const [adults,     setAdultsRaw]    = useState(initialAdults && initialAdults > 0 ? initialAdults : 2);
    const [childCount, setChildRaw]     = useState(initialChildAges?.length ?? 0);
    const [infants,    setInfantsRaw]   = useState(0);
    const [childAges,  setChildAges]    = useState<number[]>(initialChildAges ?? []);
    const [travelDate, setTravelDate]   = useState(initialTravelDate ?? '');
    const [leavingFrom, setLeavingFrom] = useState<LocationValue | null>(initialLeavingFrom ?? null);
    const [pricing,    setPricing]      = useState<SafePricing | null>(null);
    const [isPricingLoading, setLoading] = useState(false);

    // Debounce ref so rapid counter taps don't flood the server action
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    function setAdults(n: number) { setAdultsRaw(Math.max(1, n)); }

    function setChildCount(n: number) {
        const count = Math.max(0, n);
        setChildRaw(count);
        setChildAges(prev => {
            if (count > prev.length) return [...prev, ...Array(count - prev.length).fill(8)];
            return prev.slice(0, count);
        });
    }

    function setInfants(n: number) { setInfantsRaw(Math.max(0, n)); }

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

    // Re-fetch price whenever pax changes (debounced 400 ms)
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await handleComputePackagePrice({
                    package_id:       packageId,
                    duration_id:      durationId,
                    route_id:         routeId,
                    stay_category_id: stayCategoryId,
                    adults,
                    children:         childCount,
                    infants,
                    child_ages:       childAges.length === childCount ? childAges : undefined,
                    travel_date:      travelDate || null,   // ← was silently ignored before
                });
                if (res.success) {
                    setPricing({
                        pricePerAdult: Math.round(res.data.price_per_adult),
                        finalPrice:    Math.round(res.data.final_price),
                        gstAmount:     Math.round(res.data.gst_amount),
                        gstPercentage: res.data.gst_percentage,
                    });
                }
            } finally {
                setLoading(false);
            }
        }, 400);

        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [adults, childCount, infants, childAges, travelDate, packageId, durationId, routeId, stayCategoryId]);

    return (
        <BookingContext.Provider value={{
            adults, childCount, infants, childAges, travelDate, leavingFrom,
            setAdults, setChildCount, setInfants, setChildAge, setTravelDate, setLeavingFrom, setTravellers,
            pricing, isPricingLoading, packageName,
        }}>
            {children}
        </BookingContext.Provider>
    );
}
