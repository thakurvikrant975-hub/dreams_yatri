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
