'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCancellationPreview, requestCancellation } from '@/app/actions/payment/booking.actions';
import { formatPaise } from '@/app/lib/money';
import Button from '@/app/components/ui/Button';
import { Text } from '@/app/components/ui/Typography';
import type { CancellationPreview } from '@/app/actions/payment/types';

export default function CancelBookingPanel({ bookingId }: { bookingId: string }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [preview, setPreview] = useState<CancellationPreview | null>(null);
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function openDialog() {
        setError(null);
        setLoading(true);
        try {
            const p = await getCancellationPreview(bookingId);
            if (!p) { setError('Unable to load cancellation details.'); return; }
            setPreview(p);
            setOpen(true);
        } finally {
            setLoading(false);
        }
    }

    async function confirmCancel() {
        setError(null);
        setLoading(true);
        try {
            const res = await requestCancellation(bookingId, reason.trim() || undefined);
            if (res.success) {
                setOpen(false);
                router.refresh();
            } else {
                setError(
                    res.reason === 'not_cancellable' ? (res.message ?? 'This booking can no longer be cancelled.')
                    : res.reason === 'forbidden' ? 'You are not allowed to cancel this booking.'
                    : res.reason === 'unauthenticated' ? 'Please log in to cancel.'
                    : res.message ?? 'Could not cancel. Please try again.',
                );
            }
        } catch {
            setError('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    if (!open) {
        return (
            <div className="mt-6 text-center">
                <Button variant="outline" onClick={openDialog} loading={loading}>Cancel booking</Button>
                {error && <Text size="xs" intent="error" className="mt-2 block" role="alert">{error}</Text>}
            </div>
        );
    }

    return (
        <div className="mt-6 rounded-lg border border-neutral-200 p-5">
            <Text size="sm" weight="semibold" intent="primary" className="block">Cancel this booking?</Text>

            {preview && (
                <div className="mt-3 rounded-lg bg-neutral-50 divide-y divide-neutral-100">
                    <Row label={`Refund (${preview.refundPct}%)`} value={formatPaise(preview.refundablePaise)} strong />
                    <Row label="Cancellation fee" value={formatPaise(preview.feePaise)} />
                    <Row label="Paid so far" value={formatPaise(preview.paidPaise)} />
                </div>
            )}

            <Text size="xs" intent="muted" className="mt-2 block">
                Refunds go back to your original payment method and may take a few days to reflect.
            </Text>

            <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (optional)"
                rows={2}
                className="mt-3 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-400"
            />

            {error && <Text size="xs" intent="error" className="mt-2 block" role="alert">{error}</Text>}

            <div className="mt-4 flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Keep booking</Button>
                <Button variant="error" onClick={confirmCancel} loading={loading}>Confirm cancellation</Button>
            </div>
        </div>
    );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
    return (
        <div className="flex items-center justify-between px-4 py-2.5">
            <Text size="sm" intent="secondary">{label}</Text>
            <Text size="sm" weight={strong ? 'bold' : 'medium'} intent="primary">{value}</Text>
        </div>
    );
}
