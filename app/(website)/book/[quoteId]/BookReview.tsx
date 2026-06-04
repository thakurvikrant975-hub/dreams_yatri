'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import QuoteCountdown from './QuoteCountdown';
import CheckoutForm from './CheckoutForm';
import PackagePreview, { type PreviewDay } from './PackagePreview';
import type { CheckoutInput } from '@/app/actions/quote/checkout-schema';
import { createBookingDraft } from '@/app/actions/payment/booking.actions';
import Button from '@/app/components/ui/Button';
import Card from '@/app/components/ui/Card';
import { Heading, Text } from '@/app/components/ui/Typography';
import { formatPaise } from '@/app/lib/money';
import type { SafeQuote } from '@/app/actions/quote/create-quote.service';
import type { PaymentScheduleDTO } from '@/app/actions/payment/types';

const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

function formatDate(iso: string): string {
    const d = new Date(`${iso}T00:00:00`);
    if (isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat('en-IN', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    }).format(d);
}

function travellersLabel(adults: number, children: number, infants: number): string {
    const parts = [`${adults} Adult${adults !== 1 ? 's' : ''}`];
    if (children > 0) parts.push(`${children} Child${children !== 1 ? 'ren' : ''}`);
    if (infants > 0) parts.push(`${infants} Infant${infants !== 1 ? 's' : ''}`);
    return parts.join(', ');
}

function StepHeader({ n, title, hint }: { n: number; title: string; hint?: string }) {
    return (
        <div className="flex items-center gap-3 mb-4">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">{n}</span>
            <Heading level={4} weight="semibold">{title}</Heading>
            {hint && <Text size="xs" intent="muted" className="ml-auto">{hint}</Text>}
        </div>
    );
}

export default function BookReview({
    quote,
    packageTitle,
    thumbnail,
    packageHref,
    drift,
    schedule,
    itinerary = [],
}: {
    quote: SafeQuote;
    packageTitle: string;
    thumbnail: string | null;
    packageHref: string;
    drift: { fresh: boolean; currentTotal: number | null } | null;
    schedule: PaymentScheduleDTO | null;
    itinerary?: PreviewDay[];
}) {
    const router = useRouter();
    const [expired, setExpired] = useState(quote.status !== 'ACTIVE');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [checkout, setCheckout] = useState<CheckoutInput | null>(null);
    const [policy, setPolicy] = useState(false);

    const totalPax = quote.adults + quote.children + quote.infants;
    const priceChanged = drift && !drift.fresh && drift.currentTotal !== null;
    const depositAllowed = schedule?.plan === 'DEPOSIT';
    const [payChoice, setPayChoice] = useState<'DEPOSIT' | 'FULL'>('DEPOSIT');
    const effectiveChoice: 'DEPOSIT' | 'FULL' = depositAllowed ? payChoice : 'FULL';
    const payAmountPaise = schedule ? (effectiveChoice === 'FULL' ? schedule.totalPaise : schedule.depositPaise) : 0;

    const canProceed = Boolean(schedule && checkout && policy && !submitting);

    async function handleProceed() {
        setError(null);
        if (!checkout) { setError('Please complete all traveller and contact details.'); return; }
        if (!policy) { setError('Please accept the booking policies to continue.'); return; }
        setSubmitting(true);
        try {
            const res = await createBookingDraft(quote.id, { paymentChoice: effectiveChoice, details: checkout });
            if (!res.success) {
                setSubmitting(false);
                setError(
                    res.reason === 'unauthenticated' ? 'Please log in to continue your booking.'
                    : res.reason === 'stale' ? 'The price changed since this quote was created. Please refresh for the latest price.'
                    : res.reason === 'not_active' ? 'This quote has expired. Please start again.'
                    : res.message ?? 'Could not continue to payment. Please try again.',
                );
                return;
            }
            router.push(`/bookings/${res.bookingId}/pay`);
        } catch (err) {
            console.error('[BookReview] proceed failed', err);
            setSubmitting(false);
            setError('Something went wrong. Please try again.');
        }
    }

    if (expired) {
        return (
            <div className="screen-space py-16">
                <Card className="max-w-lg mx-auto px-8 py-10 text-center">
                    <Heading level={3} weight="semibold">This quote has expired</Heading>
                    <Text intent="secondary" className="mt-2 block">
                        Prices are held for a short time to keep them accurate. Please start again to
                        get a fresh price for this package.
                    </Text>
                    <Link href={packageHref} className="inline-block mt-6">
                        <Button variant="premium">Get a fresh price</Button>
                    </Link>
                </Card>
            </div>
        );
    }

    return (
        <div className="screen-space py-8 max-w-6xl">
            {/* Countdown band */}
            <div className="flex items-center justify-between gap-4 rounded-2xl bg-linear-to-r from-primary-50 to-white border border-primary-100 px-5 py-3.5 mb-6">
                <Text size="sm" weight="medium" className="text-primary-800">
                    Complete your booking before the price expires
                </Text>
                <span className="inline-flex items-center gap-2 rounded-full bg-white border border-primary-200 px-3 py-1 shadow-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary-500 animate-pulse" />
                    <QuoteCountdown expiresAt={quote.expires_at} onExpire={() => setExpired(true)} />
                </span>
            </div>

            <div className="flex items-center justify-between gap-4 mb-5">
                <Heading level={2} weight="bold">Review your booking</Heading>
                <Text size="xs" intent="muted" weight="medium" className="shrink-0">Step 1 of 2 · Details</Text>
            </div>

            {priceChanged && (
                <div role="alert" className="mb-6 rounded-xl bg-warning-50 border border-warning-200 px-4 py-3">
                    <Text size="sm" weight="medium" className="text-warning-700 block">
                        Heads up — the price for this package has changed since this quote was created.
                    </Text>
                    <Text size="xs" intent="secondary" className="mt-0.5 block">
                        Current price: {fmt(drift!.currentTotal!)}. Please{' '}
                        <Link href={packageHref} className="underline font-medium">get a fresh price</Link>{' '}
                        to continue at the latest rate.
                    </Text>
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-3 items-start">
                <div className="lg:col-span-2 flex flex-col gap-5">
                    {/* Trip hero */}
                    <Card className="overflow-hidden">
                        <div className="flex gap-4 p-5">
                            {thumbnail && (
                                <div className="relative h-28 w-40 shrink-0 overflow-hidden rounded-xl bg-neutral-100">
                                    <Image src={thumbnail} alt={packageTitle} fill className="object-cover" sizes="160px" />
                                </div>
                            )}
                            <div className="min-w-0 flex flex-col justify-center">
                                <Heading level={3} weight="bold" className="truncate">{packageTitle}</Heading>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-(--text-secondary)">{quote.duration_label}</span>
                                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-(--text-secondary)">{quote.stay_category_label}</span>
                                </div>
                            </div>
                        </div>
                        <dl className="grid grid-cols-2 border-t border-(--border-muted)">
                            <div className="px-5 py-3.5 border-r border-(--border-muted)">
                                <dt className="text-xs uppercase tracking-wide text-neutral-500">Departure</dt>
                                <dd className="text-sm font-semibold text-primary mt-0.5">{formatDate(quote.travel_date)}</dd>
                            </div>
                            <div className="px-5 py-3.5">
                                <dt className="text-xs uppercase tracking-wide text-neutral-500">Travellers</dt>
                                <dd className="text-sm font-semibold text-primary mt-0.5">{travellersLabel(quote.adults, quote.children, quote.infants)}</dd>
                            </div>
                        </dl>
                    </Card>

                    {/* 1 · Traveller details */}
                    <Card className="px-6 py-5">
                        <StepHeader n={1} title="Traveller details" hint="Tap a traveller to fill in details" />
                        <CheckoutForm pax={{ adults: quote.adults, children: quote.children, infants: quote.infants }} onChange={setCheckout} />
                    </Card>

                    {/* 2 · Package details */}
                    {itinerary.length > 0 && (
                        <Card className="px-6 py-5">
                            <StepHeader n={2} title="Package details" />
                            <PackagePreview days={itinerary} />
                        </Card>
                    )}

                    {/* 3 · How you'd like to pay */}
                    <Card className="px-6 py-5">
                        <StepHeader n={3} title="How you'd like to pay" />

                        {schedule ? (
                            depositAllowed ? (
                                <div className="flex flex-col gap-3">
                                    <PayOption
                                        selected={payChoice === 'DEPOSIT'} onSelect={() => setPayChoice('DEPOSIT')}
                                        title="Book Now, Pay Later" amount={formatPaise(schedule.depositPaise)}
                                        sub={`Pay ${Math.round((schedule.depositPaise / schedule.totalPaise) * 100)}% now to reserve · balance ${formatPaise(schedule.balancePaise)}${schedule.balanceDueDate ? ` by ${formatDate(schedule.balanceDueDate)}` : ''}`}
                                    />
                                    <PayOption
                                        selected={payChoice === 'FULL'} onSelect={() => setPayChoice('FULL')}
                                        title="Pay Full Amount Now" amount={formatPaise(schedule.totalPaise)}
                                        sub="Pay the whole amount today — nothing left to pay later."
                                    />
                                </div>
                            ) : (
                                <div className="flex items-center justify-between rounded-xl border border-(--border-muted) bg-neutral-50 px-4 py-3.5">
                                    <div>
                                        <Text size="sm" weight="semibold" intent="primary">Pay in full</Text>
                                        <Text size="xs" intent="muted" className="block mt-0.5">Full payment is required for this departure date.</Text>
                                    </div>
                                    <Text size="lg" weight="bold" intent="primary" className="font-heading">{formatPaise(schedule.totalPaise)}</Text>
                                </div>
                            )
                        ) : (
                            <Text size="sm" intent="secondary">Your price is locked while you complete your booking.</Text>
                        )}
                    </Card>
                </div>

                {/* Price summary (sticky) */}
                <div className="lg:sticky lg:top-24">
                    <Card className="overflow-hidden">
                        <div className="px-6 py-4 border-b border-(--border-muted) bg-neutral-50">
                            <Text size="xs" intent="muted" weight="semibold" className="uppercase tracking-wide">Price summary</Text>
                        </div>
                        <div className="px-6 py-5">
                            <div className="flex items-center justify-between">
                                <Text size="sm" intent="secondary">Price per adult</Text>
                                <Text size="sm" weight="medium" intent="primary">{fmt(quote.price_per_adult)}</Text>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                                <Text size="sm" intent="secondary">GST ({quote.gst_percentage}%)</Text>
                                <Text size="sm" weight="medium" intent="secondary">{fmt(quote.gst_amount)}</Text>
                            </div>
                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-(--border-muted)">
                                <Text size="sm" weight="semibold" intent="primary">Total ({totalPax} traveller{totalPax !== 1 ? 's' : ''})</Text>
                                <Text size="xl" weight="bold" intent="primary" className="font-heading">{fmt(quote.total_amount)}</Text>
                            </div>
                            <Text size="xs" intent="muted" className="block mt-1 text-right">incl. all taxes</Text>

                            {schedule && (
                                <div className="mt-4 rounded-xl bg-primary-50 border border-primary-100 px-4 py-3">
                                    <div className="flex items-center justify-between">
                                        <Text size="sm" weight="medium" className="text-primary-800">Pay now</Text>
                                        <Text size="lg" weight="bold" intent="primary" className="font-heading">{formatPaise(payAmountPaise)}</Text>
                                    </div>
                                    {effectiveChoice === 'DEPOSIT' && schedule.balancePaise > 0 && (
                                        <Text size="xs" intent="muted" className="block mt-0.5">
                                            Balance {formatPaise(schedule.balancePaise)}{schedule.balanceDueDate ? ` due by ${formatDate(schedule.balanceDueDate)}` : ''}
                                        </Text>
                                    )}
                                </div>
                            )}

                            {/* Policy acceptance */}
                            <label className="mt-4 flex items-start gap-2.5 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={policy}
                                    onChange={(e) => setPolicy(e.target.checked)}
                                    className="mt-0.5 size-4 shrink-0 accent-primary-600"
                                />
                                <Text size="xs" intent="secondary">
                                    I have read and accept the{' '}
                                    <Link href="/cancellation-policy" target="_blank" className="text-primary-600 underline">Cancellation Policy</Link>,{' '}
                                    <Link href="/terms" target="_blank" className="text-primary-600 underline">Terms of Service</Link>{' '}and{' '}
                                    <Link href="/privacy-policy" target="_blank" className="text-primary-600 underline">Privacy Policy</Link>.
                                </Text>
                            </label>

                            <Button
                                variant="premium"
                                size="lg"
                                className="w-full mt-4"
                                onClick={handleProceed}
                                loading={submitting}
                                disabled={!canProceed}
                            >
                                {!schedule ? 'Unavailable' : !checkout ? 'Complete traveller details' : !policy ? 'Accept policies to continue' : 'Proceed to Payment'}
                            </Button>

                            {error && <Text size="xs" intent="error" className="mt-2 block text-center" role="alert">{error}</Text>}
                            <Text size="xs" intent="muted" className="mt-3 block text-center">🔒 You'll choose how to pay on the next step</Text>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function PayOption({ selected, onSelect, title, amount, sub }: { selected: boolean; onSelect: () => void; title: string; amount: string; sub: string }) {
    return (
        <button type="button" onClick={onSelect}
            className={`w-full text-left rounded-xl border px-4 py-3.5 transition ${selected ? 'border-primary-500 ring-2 ring-primary-200 bg-primary-50/60' : 'border-(--border-muted) hover:border-primary-300'}`}>
            <div className="flex items-center gap-3">
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${selected ? 'border-primary-600' : 'border-neutral-300'}`}>
                    {selected && <span className="h-2 w-2 rounded-full bg-primary-600" />}
                </span>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <Text size="sm" weight="semibold" intent="primary">{title}</Text>
                        <Text size="lg" weight="bold" intent="primary" className="font-heading">{amount}</Text>
                    </div>
                    <Text size="xs" intent="muted" className="block mt-0.5">{sub}</Text>
                </div>
            </div>
        </button>
    );
}
