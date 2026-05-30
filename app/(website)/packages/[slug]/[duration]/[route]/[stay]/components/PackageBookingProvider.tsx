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
import type {
    DayPricingBreakdown,
    CabSegmentBreakdown,
} from '@/app/services/package-pricing.service';

// ── Safe pricing — margin / base_cost excluded (business-sensitive) ──────────
export interface SafePricing {
    pricePerAdult:       number;
    finalPrice:          number;
    gstAmount:           number;
    gstPercentage:       number;
    // Full breakdown (no margin details)
    days:                DayPricingBreakdown[];
    hotel_subtotal:      number;
    meal_subtotal:       number;
    activity_subtotal:   number;
    cab_subtotal:        number;
    cab_segments:        CabSegmentBreakdown[];
    cab_type_label:      string | null;
    duration_label:      string;
    stay_category_label: string;
    adults:              number;
    children:            number;
    infants:             number;
}

export interface BookingContextValue {
    // Traveller inputs
    adults:     number;
    childCount: number;
    infants:    number;
    childAges:  number[];   // length === childCount, each 2-11
    travelDate: string;     // 'YYYY-MM-DD' or ''

    setAdults:     (n: number) => void;
    setChildCount: (n: number) => void;
    setInfants:    (n: number) => void;
    setChildAge:   (idx: number, age: number) => void;
    setTravelDate: (d: string) => void;

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
}

export function PackageBookingProvider({
    packageId, durationId, routeId, stayCategoryId, packageName,
    children,
}: ProviderProps) {
    const [adults,     setAdultsRaw]    = useState(2);
    const [childCount, setChildRaw]     = useState(0);
    const [infants,    setInfantsRaw]   = useState(0);
    const [childAges,  setChildAges]    = useState<number[]>([]);
    const [travelDate, setTravelDate]   = useState('');
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
                    const d = res.data;
                    setPricing({
                        pricePerAdult:       Math.round(d.price_per_adult),
                        finalPrice:          Math.round(d.final_price),
                        gstAmount:           Math.round(d.gst_amount),
                        gstPercentage:       d.gst_percentage,
                        days:                d.days,
                        hotel_subtotal:      Math.round(d.hotel_subtotal),
                        meal_subtotal:       Math.round(d.meal_subtotal),
                        activity_subtotal:   Math.round(d.activity_subtotal),
                        cab_subtotal:        Math.round(d.cab_subtotal),
                        cab_segments:        d.cab_segments,
                        cab_type_label:      d.cab_type_label,
                        duration_label:      d.duration_label,
                        stay_category_label: d.stay_category_label,
                        adults:              d.adults,
                        children:            d.children,
                        infants:             d.infants,
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
            adults, childCount, infants, childAges, travelDate,
            setAdults, setChildCount, setInfants, setChildAge, setTravelDate,
            pricing, isPricingLoading, packageName,
        }}>
            {children}
        </BookingContext.Provider>
    );
}
