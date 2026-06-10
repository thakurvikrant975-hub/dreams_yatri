import type { Prisma, BookingStatus } from '@/app/generated/prisma/client';

/**
 * `Booking.status` is an ops-workflow enum (PENDING_REVIEW, HOTEL_CONFIRMED, ...).
 * Customers only care whether a trip is upcoming, done, or cancelled — these
 * helpers bucket the granular status into that simplified view.
 */
export const TRAVEL_HISTORY_STATUSES = ['UPCOMING', 'COMPLETED', 'CANCELLED'] as const;
export type TravelHistoryStatus = (typeof TRAVEL_HISTORY_STATUSES)[number];

const CLOSED_STATUSES: BookingStatus[] = ['CANCELLED', 'REJECTED'];

export function travelHistoryStatus(status: BookingStatus, endDate: Date, now: Date = new Date()): TravelHistoryStatus {
    if (CLOSED_STATUSES.includes(status)) return 'CANCELLED';
    if (status === 'COMPLETED' || endDate < now) return 'COMPLETED';
    return 'UPCOMING';
}

/** Prisma `where` filter matching the given customer-facing bucket. */
export function travelHistoryStatusWhere(bucket: TravelHistoryStatus, now: Date = new Date()): Prisma.BookingWhereInput {
    switch (bucket) {
        case 'CANCELLED':
            return { status: { in: CLOSED_STATUSES } };
        case 'COMPLETED':
            return {
                OR: [
                    { status: 'COMPLETED' },
                    { status: { notIn: [...CLOSED_STATUSES, 'COMPLETED'] }, endDate: { lt: now } },
                ],
            };
        case 'UPCOMING':
            return {
                status: { notIn: [...CLOSED_STATUSES, 'COMPLETED'] },
                endDate: { gte: now },
            };
    }
}

/**
 * Customer-friendly label + description for every raw `BookingStatus` value —
 * shown in the "View status" detail modal on the Travel History panel.
 */
export const BOOKING_STATUS_INFO: Record<BookingStatus, { label: string; description: string }> = {
    PENDING_REVIEW:         { label: 'Under Review',           description: 'Our team is reviewing your booking details.' },
    HOTEL_VERIFICATION:     { label: 'Hotel Verification',     description: 'We are checking hotel availability for your trip.' },
    HOTEL_CONFIRMED:        { label: 'Hotel Confirmed',        description: 'Your hotel has been confirmed.' },
    CAB_VERIFICATION:       { label: 'Cab Verification',       description: 'We are arranging your cab and transport.' },
    CAB_CONFIRMED:          { label: 'Cab Confirmed',          description: 'Your cab and transport have been confirmed.' },
    OPS_REVIEW:             { label: 'Final Review',           description: 'Our operations team is doing a final check before confirming your trip.' },
    CONFIRMED:              { label: 'Confirmed',              description: 'Your booking is confirmed.' },
    UPCOMING:               { label: 'Upcoming',               description: 'Your trip is confirmed and coming up.' },
    ONGOING:                { label: 'Ongoing',                description: 'Your trip is currently in progress. Have a great time!' },
    COMPLETED:              { label: 'Completed',              description: 'Your trip has been completed. We hope you had a great time!' },
    CANCELLED:              { label: 'Cancelled',              description: 'This booking has been cancelled.' },
    REJECTED:               { label: 'Rejected',               description: 'This booking could not be processed.' },
    MODIFICATION_REQUESTED: { label: 'Modification Requested', description: 'A modification has been requested. Our team will get back to you shortly.' },
};

/** Ordered milestones for the "View status" progress tracker. */
export const BOOKING_PROGRESS_STEPS: { key: string; label: string; statuses: BookingStatus[] }[] = [
    { key: 'received',  label: 'Booking received',  statuses: ['PENDING_REVIEW'] },
    { key: 'hotel',     label: 'Hotel arrangement',  statuses: ['HOTEL_VERIFICATION', 'HOTEL_CONFIRMED'] },
    { key: 'cab',       label: 'Cab arrangement',    statuses: ['CAB_VERIFICATION', 'CAB_CONFIRMED'] },
    { key: 'review',    label: 'Final review',       statuses: ['OPS_REVIEW'] },
    { key: 'confirmed', label: 'Confirmed',          statuses: ['CONFIRMED', 'UPCOMING', 'ONGOING'] },
    { key: 'completed', label: 'Trip completed',     statuses: ['COMPLETED'] },
];

/** Index into `BOOKING_PROGRESS_STEPS`, or -1 for terminal/exception statuses (cancelled, rejected, modification). */
export function bookingProgressStepIndex(status: BookingStatus): number {
    return BOOKING_PROGRESS_STEPS.findIndex(step => step.statuses.includes(status));
}
