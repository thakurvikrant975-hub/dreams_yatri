'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getDateChangePreview, requestDateChange, verifyCheckoutPayment } from '@/app/actions/payment/booking.actions';
import { loadRazorpay, openRazorpay } from '../../book/[quoteId]/razorpayCheckout';
import { submitPayuForm } from '../../book/[quoteId]/payuCheckout';
import { formatPaise } from '@/app/lib/money';
import Button from '@/app/components/ui/Button';
import { Text } from '@/app/components/ui/Typography';
import type { DateChangePreview } from '@/app/actions/payment/types';

export default function ChangeDatePanel({ bookingId }: { bookingId: string }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [newDate, setNewDate] = useState('');
    const [preview, setPreview] = useState<DateChangePreview | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const todayPlus1 = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

    async function loadPreview(date: string) {
        setNewDate(date);
        setPreview(null);
        setError(null);
        if (!date) return;
        setLoading(true);
        try {
            const p = await getDateChangePreview(bookingId, date);
            if (!p) setError('This date isn’t available for your package.');
            else setPreview(p);
        } finally {
            setLoading(false);
        }
    }

    async function confirm() {
        setError(null);
        setLoading(true);
        try {
            const res = await requestDateChange(bookingId, newDate);
            if (!res.success) {
                setError(res.message ?? 'Could not change the date. Please try again.');
                return;
            }
            if (res.direction === 'topup') {
                const c = res.checkout;
                if (c.provider === 'PAYU') { submitPayuForm(c.actionUrl, c.fields); return; }
                const ready = await loadRazorpay();
                if (!ready) { setError('Could not load the payment window.'); return; }
                openRazorpay({
                    key: c.keyId, order_id: c.orderId, amount: c.amountPaise, currency: c.currency,
                    name: 'Dreams Yatri', description: 'Date-change top-up',
                    handler: async (resp) => {
                        try { await verifyCheckoutPayment({ orderId: resp.razorpay_order_id, paymentId: resp.razorpay_payment_id, signature: resp.razorpay_signature }); } catch { /* webhook owns truth */ }
                        router.refresh();
                    },
                });
                return;
            }
            // refund / balance / none → done
            setOpen(false);
            router.refresh();
        } catch {
            setError('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    if (!open) {
        return (
            <div className="mt-3 text-center">
                <Button variant="outline" onClick={() => setOpen(true)}>Change travel date</Button>
            </div>
        );
    }

    const settleLabel =
        preview?.direction === 'topup' ? `Pay extra now: ${formatPaise(preview.settleAmountPaise)}`
        : preview?.direction === 'refund' ? `Refund to you: ${formatPaise(preview.settleAmountPaise)}`
        : preview?.direction === 'balance' ? `New balance due: ${formatPaise(preview.settleAmountPaise)}`
        : preview ? 'No additional payment' : '';

    return (
        <div className="mt-3 rounded-lg border border-neutral-200 p-5 text-left">
            <Text size="sm" weight="semibold" intent="primary" className="block">Change travel date</Text>

            <input
                type="date"
                min={todayPlus1}
                value={newDate}
                onChange={(e) => loadPreview(e.target.value)}
                className="mt-3 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-400"
            />

            {preview && (
                <div className="mt-3 rounded-lg bg-neutral-50 divide-y divide-neutral-100">
                    <Row label="New trip price" value={formatPaise(preview.newTotalPaise)} />
                    <Row label="Date-change fee" value={formatPaise(preview.feePaise)} />
                    <Row label={settleLabel.split(':')[0]} value={settleLabel.includes(':') ? settleLabel.split(': ')[1] : '—'} strong />
                </div>
            )}

            {error && <Text size="xs" intent="error" className="mt-2 block" role="alert">{error}</Text>}

            <div className="mt-4 flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setOpen(false); setPreview(null); }} disabled={loading}>Cancel</Button>
                <Button variant="premium" onClick={confirm} loading={loading} disabled={!preview}>Confirm date change</Button>
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
