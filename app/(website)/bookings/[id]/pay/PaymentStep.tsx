'use client';
/* eslint-disable @next/next/no-img-element -- payment-brand SVGs are tiny static marks in /public */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeftIcon, ShieldCheckIcon, LockSimpleIcon } from '@phosphor-icons/react';
import { loadRazorpay, openRazorpay } from '../../../book/[quoteId]/razorpayCheckout';
import { submitPayuForm } from '../../../book/[quoteId]/payuCheckout';
import { startBookingPayment, startBalancePayment, verifyCheckoutPayment } from '@/app/actions/payment/booking.actions';
import Button from '@/app/components/ui/Button';
import { useModal } from '@/app/hooks/useModals';
import { Heading, Text } from '@/app/components/ui/Typography';
import { formatPaiseRoundedUp } from '@/app/lib/money';
import type { GatewayId } from '@/app/lib/payments/types';
import Card from '@/app/components/ui/Card';

type Method = { src: string; label: string };
const M: Record<string, Method> = {
    upi: { src: '/payments/upi.svg', label: 'UPI' },
    cards: { src: '/payments/cards.svg', label: 'Cards' },
    netbanking: { src: '/payments/netbanking.svg', label: 'Net Banking' },
    wallet: { src: '/payments/wallet.svg', label: 'Wallets' },
    emi: { src: '/payments/emi.svg', label: 'EMI' },
};

const GATEWAYS: Record<GatewayId, { label: string; logo: string; methods: Method[] }> = {
    RAZORPAY: { label: 'Razorpay', logo: '/payments/razorpay.svg', methods: [M.upi, M.cards, M.netbanking, M.wallet] },
    PAYU: { label: 'PayU', logo: '/payments/payu.webp', methods: [M.upi, M.cards, M.netbanking, M.emi] },
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
    mode = 'INITIAL',
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
    mode?: 'INITIAL' | 'BALANCE';
}) {
    const router = useRouter();
    const { openModal } = useModal();
    const [gateway, setGateway] = useState<GatewayId>(gateways[0] ?? 'RAZORPAY');
    const [paying, setPaying] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const contact = [contactEmail, contactPhone].filter(Boolean).join(' · ');

    async function handlePay() {
        setError(null);
        setPaying(true);
        try {
            const res = mode === 'BALANCE'
                ? await startBalancePayment(bookingId, gateway)
                : await startBookingPayment(bookingId, gateway);
            if (!res.success) {
                setPaying(false);
                if (res.reason === 'unauthenticated') {
                    // Same inline OTP flow the review page uses — pre-seeded
                    // with this booking's own contact number so the guest just
                    // enters the code, rather than hitting a dead-end message.
                    const m = (contactPhone ?? '').match(/^(\+\d{1,4})(\d+)$/);
                    openModal('login-modal', {
                        redirectTo: window.location.pathname + window.location.search,
                        ...(m ? { countryCode: m[1], phone: m[2] } : {}),
                    });
                    return;
                }
                setError(res.message ?? 'Could not start payment. Please try again.');
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
                description: `${packageTitle} — ${mode === 'BALANCE' ? 'Balance payment' : plan === 'DEPOSIT' ? 'Deposit' : 'Full payment'}`,
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
                    router.push(mode === 'BALANCE' ? `/bookings/${bookingId}/status` : `/bookings/${bookingId}`);
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
        <div className="bg-neutral-100 min-h-screen pb-16">
            {/* ── Dark bar ───────────────────────────────────────────────────────── */}
            <div className="bg-surface-inverse text-white">
                <div className="screen-space flex flex-wrap items-center justify-between gap-3 py-3.5">
                    <span className="inline-flex items-center gap-2 text-base font-medium">
                        <LockSimpleIcon weight="fill" className="size-4 text-success-400" /> Secure Payment
                    </span>
                    <div className="flex items-center gap-5">
                        <button type="button" onClick={() => router.back()} className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400 hover:text-white transition-colors">
                            <ArrowLeftIcon weight="bold" className="size-3.5" /> {mode === 'BALANCE' ? 'Back' : 'Edit details'}
                        </button>
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{mode === 'BALANCE' ? 'Balance payment' : 'Step 2 of 2 · Payment'}</span>
                    </div>
                </div>
            </div>

            <div className="screen-space pt-5">
                {retry && (
                    <div role="alert" className="mb-5 rounded-xl bg-warning-50 border border-warning-200 px-4 py-3">
                        <Text size="sm" weight="medium" className="text-warning-700 block">Your last payment didn&apos;t go through.</Text>
                        <Text size="xs" intent="secondary" className="mt-0.5 block">No money was taken. Pick a payment option below and try again.</Text>
                    </div>
                )}

                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
                    {/* ── LEFT column ──────────────────────────────────────────────── */}
                    <div className="flex flex-col gap-4">
                        {/* Trip summary */}
                        <Card className=" overflow-hidden">
                            <div className="flex gap-4 p-5">
                                {thumbnail && (
                                    <div className="relative h-24 w-36 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                                        <Image src={thumbnail} alt={packageTitle} fill className="object-cover" sizes="144px" />
                                    </div>
                                )}
                                <div className="min-w-0 flex flex-col justify-center">
                                    <Heading level={3} weight="semibold" className="truncate">{packageTitle}</Heading>
                                    <Text size="sm" intent="secondary" className="block mt-1">{dateRange}</Text>
                                    <Text size="xs" intent="muted" className="block mt-0.5">
                                        {travellers} traveller{travellers !== 1 ? 's' : ''}{contact ? ` · ${contact}` : ''}
                                    </Text>
                                    <Text size="xs" intent="muted" className="block mt-0.5">Booking {bookingNumber}</Text>
                                </div>
                            </div>
                        </Card>

                        {/* Payment options */}
                        <Card className=" p-5">
                            <Heading level={4} weight="semibold" className="mb-1">Choose how to pay</Heading>
                            <Text size="sm" intent="secondary" className="block mb-4">Pick a secure payment partner — all popular methods are supported.</Text>

                            <div className="flex flex-col gap-3">
                                {gateways.map((g) => {
                                    const meta = GATEWAYS[g];
                                    const selected = gateway === g;
                                    return (
                                        <button
                                            key={g}
                                            type="button"
                                            onClick={() => setGateway(g)}
                                            aria-pressed={selected}
                                            className={`w-full text-left rounded-xl border p-4 transition ${selected ? 'border-primary-500 ring-2 ring-primary-200 bg-primary-50/40' : 'border-(--border-muted) hover:border-primary-300'}`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${selected ? 'border-primary-500' : 'border-neutral-300'}`}>
                                                    {selected && <span className="h-2 w-2 rounded-full bg-primary-500" />}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <img src={meta.logo} alt={meta.label} className="h-6 w-auto" />
                                                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                                                        {meta.methods.map((m) => (
                                                            <span key={m.label} className="inline-flex items-center gap-1.5">
                                                                <img src={m.src} alt="" aria-hidden className="h-4 w-auto max-w-9 object-contain" />
                                                                <span className="text-[11px] font-medium text-(--text-muted)">{m.label}</span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="mt-4 flex items-center gap-2 rounded-xl bg-neutral-50 px-4 py-3">
                                <ShieldCheckIcon weight="duotone" className="size-5 text-success-600 shrink-0" />
                                <Text size="xs" intent="secondary">Encrypted &amp; processed by PCI-DSS compliant partners. Dreams Yatri never stores your card details.</Text>
                            </div>
                        </Card>
                    </div>

                    {/* ── RIGHT — Total due (sticky) ───────────────────────────────── */}
                    <div className="lg:sticky lg:top-20">
                        <Card className=" overflow-hidden">
                            <div className="px-5 py-4 border-b border-(--border-muted) flex items-center justify-between">
                                <Text size="xs" intent="muted" weight="semibold" className="uppercase tracking-wide">Total due</Text>
                                <Text size="xl" weight="bold" intent="primary" className="font-heading">{formatPaiseRoundedUp(payNowPaise)}</Text>
                            </div>
                            <div className="px-5 py-5">
                                <div className="flex items-center justify-between">
                                    <Text size="sm" intent="secondary">Trip total</Text>
                                    <Text size="sm" weight="medium" intent="primary">{formatPaiseRoundedUp(totalPaise)}</Text>
                                </div>
                                <div className="flex items-center justify-between mt-2">
                                    <Text size="sm" intent="secondary">{mode === 'BALANCE' ? 'Paying balance' : plan === 'FULL' ? 'Paying now (full)' : 'Paying now (deposit)'}</Text>
                                    <Text size="sm" weight="semibold" intent="primary">{formatPaiseRoundedUp(payNowPaise)}</Text>
                                </div>
                                {plan === 'DEPOSIT' && balancePaise > 0 && (
                                    <div className="flex items-center justify-between mt-2">
                                        <Text size="sm" intent="secondary">Balance later{balanceDueDate ? ` (by ${balanceDueDate})` : ''}</Text>
                                        <Text size="sm" weight="medium" intent="secondary">{formatPaiseRoundedUp(balancePaise)}</Text>
                                    </div>
                                )}

                                {processing ? (
                                    <div className="mt-5 rounded-xl bg-success-50 border border-success-200 px-4 py-3 text-center">
                                        <Text size="sm" weight="medium" className="text-success-700 block">Taking you to your payment…</Text>
                                        <Text size="xs" intent="muted" className="mt-0.5 block">Please don&apos;t close this window.</Text>
                                    </div>
                                ) : (
                                    <Button variant="premium" size="lg" className="w-full mt-5" onClick={handlePay} loading={paying}>
                                        Pay {formatPaiseRoundedUp(payNowPaise)}
                                    </Button>
                                )}

                                {error && <Text size="xs" intent="error" className="mt-2 block text-center" role="alert">{error}</Text>}

                                <div className="mt-3 flex items-center justify-center gap-1.5">
                                    <LockSimpleIcon weight="fill" className="size-3.5 text-success-600" />
                                    <Text size="xs" intent="muted">Secured by {GATEWAYS[gateway].label}</Text>
                                </div>

                                <Text size="xs" intent="secondary" className="mt-3 block text-center">
                                    By paying you agree to our{' '}
                                    <Link href="/terms" target="_blank" className="text-primary-500 underline">Terms</Link> and{' '}
                                    <Link href="/cancellation-policy" target="_blank" className="text-primary-500 underline">Cancellation Policy</Link>.
                                </Text>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
