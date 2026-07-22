'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useModal } from '@/app/hooks/useModals';
import CheckoutForm from '../../../book/[quoteId]/CheckoutForm';
import type { CheckoutInput } from '@/app/actions/quote/checkout-schema';
import { createHotelBookingDraft } from '@/app/actions/payment/booking.actions';
import Button from '@/app/components/ui/Button';
import { Text } from '@/app/components/ui/Typography';

export default function HotelCheckout({
    roomId,
    checkIn,
    checkOut,
    units,
    pricingId,
    holdKey,
}: {
    roomId: number;
    checkIn: string;
    checkOut: string;
    units: number;
    pricingId?: number;
    holdKey: string;
}) {
    const router = useRouter();
    const { status } = useSession();
    const { openModal } = useModal();
    const [checkout, setCheckout] = useState<CheckoutInput | null>(null);
    const [policy, setPolicy] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const redirectTo = () => (typeof window !== 'undefined' ? window.location.pathname + window.location.search : undefined);

    async function handleProceed() {
        setError(null);
        if (!checkout) { setError('Please complete your details.'); return; }
        if (!policy) { setError('Please accept the booking policies to continue.'); return; }
        if (status === 'unauthenticated') {
            openModal('login-modal', { redirectTo: redirectTo() });
            return;
        }

        setSubmitting(true);
        try {
            const res = await createHotelBookingDraft({ roomId, checkIn, checkOut, units, pricingId, holdKey, details: checkout });
            if (!res.success) {
                setSubmitting(false);
                if (res.reason === 'unauthenticated') {
                    openModal('login-modal', { redirectTo: redirectTo() });
                    return;
                }
                setError(res.message ?? 'Could not continue to payment. Please try again.');
                return;
            }
            router.push(`/bookings/${res.bookingId}/pay`);
        } catch (err) {
            console.error('[HotelCheckout] proceed failed', err);
            setSubmitting(false);
            setError('Something went wrong. Please try again.');
        }
    }

    return (
        <div className="space-y-4">
            <CheckoutForm pax={{ adults: 1, children: 0, infants: 0 }} onChange={setCheckout} />

            <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                    type="checkbox"
                    checked={policy}
                    onChange={(e) => setPolicy(e.target.checked)}
                    className="mt-0.5 size-4 cursor-pointer shrink-0 accent-primary-500"
                />
                <Text size="xs" intent="secondary">
                    I confirm I have read and accept the cancellation policy, terms of service, and privacy policy.
                </Text>
            </label>

            <Button variant="premium" size="lg" className="w-full" onClick={handleProceed} loading={submitting}>
                Proceed to Payment
            </Button>

            {error && <Text size="xs" intent="error" className="block text-center" role="alert">{error}</Text>}
        </div>
    );
}
