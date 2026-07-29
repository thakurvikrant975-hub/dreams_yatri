'use client';

import { useBooking } from './PackageBookingProvider';
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid';

// Departures this close out are too soon for a guaranteed room hold —
// stays get allocated on a best-availability basis instead.
const SHORT_NOTICE_DAYS = 2;

function daysUntil(dateStr: string): number | null {
    if (!dateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(`${dateStr}T00:00:00`);
    return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** Sits just above the itinerary's day-by-day listing (not the form header) —
 *  the availability caveat is most relevant right where the booked stays show. */
export default function ShortNoticeBanner() {
    const { travelDate } = useBooking();
    const daysToTravel = daysUntil(travelDate);
    const isShortNotice = daysToTravel != null && daysToTravel >= 0 && daysToTravel <= SHORT_NOTICE_DAYS;

    if (!isShortNotice) return null;

    return (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
            <ExclamationTriangleIcon className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
                Your travel date is only {daysToTravel === 0 ? "today" : `${daysToTravel} day${daysToTravel === 1 ? "" : "s"} away`} — stays will be allocated based on availability.
            </p>
        </div>
    );
}
