'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeftIcon, ShieldCheckIcon } from '@phosphor-icons/react';
import { loadRazorpay, openRazorpay } from '../../../book/[quoteId]/razorpayCheckout';
import { submitPayuForm } from '../../../book/[quoteId]/payuCheckout';
import { startBookingPayment, verifyCheckoutPayment } from '@/app/actions/payment/booking.actions';
import Button from '@/app/components/ui/Button';
import Card from '@/app/components/ui/Card';
import { Heading, Text } from '@/app/components/ui/Typography';
import { formatPaise } from '@/app/lib/money';
import type { GatewayId } from '@/app/lib/payments/types';

const GATEWAY_META: Record<GatewayId, { label: string; methods: string }> = {
    RAZORPAY: { label: 'Razorpay', methods: 'UPI · Cards · Net banking · Wallets' },
    PAYU: { label: 'PayU', methods: 'UPI · Cards · Net banking · EMI' },
};

export default function PaymentStep({
    bookingId,
    bookingNumber,
    packageTitle,
    thumbnail,
    dateRange,
    travellers,
    contactEmail,
    contactPhone,
    plan,
    payNowPaise,
    totalPaise,
    balancePaise,
    balanceDueDate,
    gateways,
    retry = false,
}: {
    bookingId: string;
    bookingNumber: string;
    packageTitle: string;
    thumbnail: string | null;
    dateRange: string;
    travellers: number;
    contactEmail: string | null;
    contactPhone: string | null;
    plan: 'FULL' | 'DEPOSIT';
    payNowPaise: number;
    totalPaise: number;
    balancePaise: number;
    balanceDueDate: string | null;
    gateways: GatewayId[];
    retry?: boolean;
}) {
    const router = useRouter();
    const [gateway, setGateway] = useState<GatewayId>(gateways[0] ?? 'RAZORPAY');
    const [paying, setPaying] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const contact = [contactEmail, contactPhone].filter(Boolean).join(' · ');

    async function handlePay() {
        setError(null);
        setPaying(true);
        try {
            const res = await startBookingPayment(bookingId, gateway);
            if (!res.success) {
                setPaying(false);
                setError(
                    res.reason === 'unauthenticated' ? 'Please log in to continue your payment.'
                    : res.message ?? 'Could not start payment. Please try again.',
                );
                return;
            }

            const co = res.order.checkout;
            if (co.provider === 'PAYU') {
                setProcessing(true);
                submitPayuForm(co.actionUrl, co.fields);
                return;
            }

            const ready = await loadRazorpay();
            if (!ready) {
                setPaying(false);
                setError('Could not load the payment window. Please check your connection and try again.');
                return;
            }

            openRazorpay({
                key: co.keyId,
                order_id: co.orderId,
                amount: co.amountPaise,
                currency: co.currency,
                name: 'Dreams Yatri',
                description: `${packageTitle} — ${plan === 'DEPOSIT' ? 'Deposit' : 'Full payment'}`,
                prefill: { email: contactEmail ?? undefined, contact: contactPhone ?? undefined },
                notes: { bookingId },
                theme: { color: '#0f766e' },
                handler: async (resp) => {
                    // Truth comes from the webhook; verify the callback sig for UX, then
                    // route to the confirmation page (which polls until confirmed).
                    setProcessing(true);
                    try {
                        await verifyCheckoutPayment({
                            orderId: resp.razorpay_order_id,
                            paymentId: resp.razorpay_payment_id,
                            signature: resp.razorpay_signature,
                        });
                    } catch (err) {
                        console.error('[PaymentStep] verify failed', err);
                    }
                    router.push(`/bookings/${bookingId}`);
                },
                modal: { ondismiss: () => setPaying(false) },
            });
        } catch (err) {
            console.error('[PaymentStep] pay failed', err);
            setPaying(false);
            setError('Something went wrong starting your payment. Please try again.');
        }
    }

    return (
        <div className="screen-space py-8 max-w-7xl">
            <div className="flex items-center justify-between gap-4 mb-5">
                <button type="button" onClick={() => router.back()} className="inline-flex items-center gap-1.5 text-sm font-medium text-(--text-secondary) hover:text-primary-600">
                    <ArrowLeftIcon weight="bold" className="size-4" /> Edit details
                </button>
                <Text size="xs" intent="muted" weight="medium" className="shrink-0">Step 2 of 2 · Payment</Text>
            </div>

            {retry && (
                <div role="alert" className="mb-5 rounded-xl bg-warning-50 border border-warning-200 px-4 py-3">
                    <Text size="sm" weight="medium" className="text-warning-700 block">Your last payment didn't go through.</Text>
                    <Text size="xs" intent="secondary" className="mt-0.5 block">No money was taken. Pick a payment option below and try again.</Text>
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-3 items-start">
                <div className="lg:col-span-2 flex flex-col gap-5">
                    {/* Trip summary */}
                    <Card className="overflow-hidden">
                        <div className="flex gap-4 p-5">
                            {thumbnail && (
                                <div className="relative h-24 w-36 shrink-0 overflow-hidden rounded-xl bg-neutral-100">
                                    <Image src={thumbnail} alt={packageTitle} fill className="object-cover" sizes="144px" />
                                </div>
                            )}
                            <div className="min-w-0 flex flex-col justify-center">
                                <Heading level={3} weight="bold" className="truncate">{packageTitle}</Heading>
                                <Text size="sm" intent="secondary" className="block mt-1">{dateRange}</Text>
                                <Text size="xs" intent="muted" className="block mt-0.5">
                                    {travellers} traveller{travellers !== 1 ? 's' : ''}{contact ? ` · ${contact}` : ''}
                                </Text>
                                <Text size="xs" intent="muted" className="block mt-0.5">Booking {bookingNumber}</Text>
                            </div>
                        </div>
                    </Card>

                    {/* Payment options */}
                    <Card className="px-6 py-5">
                        <Heading level={4} weight="semibold" className="mb-1">Choose how to pay</Heading>
                        <Text size="sm" intent="secondary" className="block mb-4">Select a secure payment partner — all popular methods are supported.</Text>

                        <div className="flex flex-col gap-3">
                            {gateways.map((g) => {
                                const meta = GATEWAY_META[g];
                                const selected = gateway === g;
                                return (
                                    <button
                                        key={g}
                                        type="button"
                                        onClick={() => setGateway(g)}
                                        className={`w-full text-left rounded-xl border px-4 py-4 transition ${selected ? 'border-primary-500 ring-2 ring-primary-200 bg-primary-50/60' : 'border-(--border-muted) hover:border-primary-300'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${selected ? 'border-primary-600' : 'border-neutral-300'}`}>
                                                {selected && <span className="h-2 w-2 rounded-full bg-primary-600" />}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <Text size="sm" weight="semibold" intent="primary" className="block">{meta.label}</Text>
                                                <Text size="xs" intent="muted" className="block mt-0.5">{meta.methods}</Text>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="mt-4 flex items-center gap-2 rounded-xl bg-neutral-50 px-4 py-3">
                            <ShieldCheckIcon weight="duotone" className="size-5 text-success-600 shrink-0" />
                            <Text size="xs" intent="secondary">Payments are encrypted and processed by PCI-DSS compliant partners. Dreams Yatri never stores your card details.</Text>
                        </div>
                    </Card>
                </div>

                {/* Total due (sticky) */}
                <div className="lg:sticky lg:top-24">
                    <Card className="overflow-hidden">
                        <div className="px-6 py-4 border-b border-(--border-muted) bg-neutral-50 flex items-center justify-between">
                            <Text size="xs" intent="muted" weight="semibold" className="uppercase tracking-wide">Total due</Text>
                            <Text size="xl" weight="bold" intent="primary" className="font-heading">{formatPaise(payNowPaise)}</Text>
                        </div>
                        <div className="px-6 py-5">
                            <div className="flex items-center justify-between">
                                <Text size="sm" intent="secondary">Trip total</Text>
                                <Text size="sm" weight="medium" intent="primary">{formatPaise(totalPaise)}</Text>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                                <Text size="sm" intent="secondary">{plan === 'FULL' ? 'Paying now (full)' : 'Paying now (deposit)'}</Text>
                                <Text size="sm" weight="semibold" intent="primary">{formatPaise(payNowPaise)}</Text>
                            </div>
                            {plan === 'DEPOSIT' && balancePaise > 0 && (
                                <div className="flex items-center justify-between mt-2">
                                    <Text size="sm" intent="secondary">Balance later{balanceDueDate ? ` (by ${balanceDueDate})` : ''}</Text>
                                    <Text size="sm" weight="medium" intent="secondary">{formatPaise(balancePaise)}</Text>
                                </div>
                            )}

                            {processing ? (
                                <div className="mt-5 rounded-xl bg-success-50 border border-success-200 px-4 py-3 text-center">
                                    <Text size="sm" weight="medium" className="text-success-700 block">Taking you to your payment…</Text>
                                    <Text size="xs" intent="muted" className="mt-0.5 block">Please don't close this window.</Text>
                                </div>
                            ) : (
                                <Button variant="premium" size="lg" className="w-full mt-5" onClick={handlePay} loading={paying}>
                                    Pay {formatPaise(payNowPaise)}
                                </Button>
                            )}

                            {error && <Text size="xs" intent="error" className="mt-2 block text-center" role="alert">{error}</Text>}
                            <Text size="xs" intent="muted" className="mt-3 block text-center">🔒 Secured by {GATEWAY_META[gateway].label}</Text>

                            <Text size="xs" intent="muted" className="mt-4 block text-center">
                                By paying you agree to our{' '}
                                <Link href="/terms" target="_blank" className="text-primary-600 underline">Terms</Link> and{' '}
                                <Link href="/cancellation-policy" target="_blank" className="text-primary-600 underline">Cancellation Policy</Link>.
                            </Text>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
