'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useBooking } from './PackageBookingProvider';
import { createPackageQuote } from '@/app/actions/quote/actions';

/**
 * Shared "Book" flow for the package page — builds a quote from the current
 * booking context + route slugs, then routes to the review page. Used by both
 * the sidebar PricingCard and the mobile footer bar so the logic lives once.
 */
export function useBookQuote() {
    const {
        adults, childCount, infants, childAges, travelDate,
        cabSelections, roomGuests,
        packageId, durationId, routeId, stayCategoryId,
        setDateHighlight,
    } = useBooking();

    const router = useRouter();
    const params = useParams<{ slug: string; duration: string; route: string; stay: string }>();

    const [booking, setBooking] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Auto-clear the date error once the user picks a date
    useEffect(() => {
        if (travelDate && error === 'Please pick your departure date to continue.') {
            setError(null);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [travelDate]);

    async function book() {
        setError(null);

        if (!travelDate) {
            setError('Please pick your departure date to continue.');
            setDateHighlight(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        setBooking(true);
        try {
            const res = await createPackageQuote({
                package_id:       packageId,
                duration_id:      durationId,
                route_id:         routeId,
                stay_category_id: stayCategoryId,
                package_slug:     params.slug,
                duration_slug:    params.duration,
                route_slug:       params.route,
                stay_slug:        params.stay,
                adults,
                children:     childCount,
                infants,
                child_ages:   childAges,
                cab_type_ids: Array.from(cabSelections.values()),
                rooms:        roomGuests.map((r) => ({ adults: r.adults, children: r.childAges.length })),
                travel_date:  travelDate,
            });

            if (res.success) {
                router.push(`/book/${res.quote.id}`);
            } else {
                setError(res.error);
                setBooking(false);
            }
        } catch (err) {
            console.error('[useBookQuote] book failed', err);
            setError('Something went wrong. Please try again.');
            setBooking(false);
        }
    }

    return { book, booking, error };
}
