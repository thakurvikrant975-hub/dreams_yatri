import type { Prisma, PaymentStatus } from '@/app/generated/prisma/client';

/**
 * `Payment.status` has gateway-level granularity (PENDING, ADVANCE_PAID, ...).
 * The Payment History tabs only filter by these customer-facing buckets.
 */
export const PAYMENT_HISTORY_STATUSES = ['SUCCESS', 'FAILED', 'REFUNDED'] as const;
export type PaymentHistoryStatus = (typeof PAYMENT_HISTORY_STATUSES)[number];

const SUCCESS_STATUSES: PaymentStatus[] = ['FULLY_PAID', 'ADVANCE_PAID'];
const REFUND_STATUSES:  PaymentStatus[] = ['REFUNDED', 'PARTIALLY_REFUNDED'];

/** Prisma `where` filter matching the given customer-facing bucket. */
export function paymentHistoryStatusWhere(bucket: PaymentHistoryStatus): Prisma.PaymentWhereInput {
    switch (bucket) {
        case 'SUCCESS':
            return { status: { in: SUCCESS_STATUSES } };
        case 'FAILED':
            return { status: 'FAILED' };
        case 'REFUNDED':
            return { status: { in: REFUND_STATUSES } };
    }
}

/** Base filter for the unfiltered "All" view — hides internal test records. */
export const PAYMENT_HISTORY_BASE_WHERE: Prisma.PaymentWhereInput = {
    status: { not: 'TESTING' },
};
