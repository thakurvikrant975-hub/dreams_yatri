'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import QuoteCountdown from './QuoteCountdown';
import Button from '@/app/components/ui/Button';
import Card from '@/app/components/ui/Card';
import { Heading, Text } from '@/app/components/ui/Typography';
import type { SafeQuote } from '@/app/actions/quote/create-quote.service';

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

export default function BookReview({
    quote,
    packageTitle,
    thumbnail,
    packageHref,
    drift,
}: {
    quote: SafeQuote;
    packageTitle: string;
    thumbnail: string | null;
    packageHref: string;
    drift: { fresh: boolean; currentTotal: number | null } | null;
}) {
    const [expired, setExpired] = useState(quote.status !== 'ACTIVE');

    const totalPax = quote.adults + quote.children + quote.infants;
    const priceChanged = drift && !drift.fresh && drift.currentTotal !== null;

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
        <div className="screen-space py-8">
            {/* Countdown band */}
            <div className="flex items-center justify-between gap-4 rounded-xl bg-primary-50 border border-primary-100 px-5 py-3 mb-6">
                <Text size="sm" weight="medium" intent="primary">
                    Complete your booking before the price expires
                </Text>
                <Text as="span" size="lg">
                    <QuoteCountdown expiresAt={quote.expires_at} onExpire={() => setExpired(true)} />
                </Text>
            </div>

            <Heading level={2} weight="semibold" className="mb-5">Review your booking</Heading>

            {priceChanged && (
                <div role="alert" className="mb-6 rounded-lg bg-warning-50 border border-warning-200 px-4 py-3">
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

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Trip summary */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                    <Card className="overflow-hidden">
                        <div className="flex gap-4 p-4">
                            {thumbnail && (
                                <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                                    <Image src={thumbnail} alt={packageTitle} fill className="object-cover" sizes="128px" />
                                </div>
                            )}
                            <div className="min-w-0">
                                <Heading level={4} weight="semibold" className="truncate">{packageTitle}</Heading>
                                <Text size="sm" intent="secondary" className="mt-1 block">
                                    {quote.duration_label} · {quote.stay_category_label}
                                </Text>
                            </div>
                        </div>

                        <dl className="grid grid-cols-2 gap-px bg-neutral-100 border-t border-neutral-100">
                            <div className="bg-white px-4 py-3">
                                <dt className="text-xs uppercase tracking-wide text-neutral-500">Departure</dt>
                                <dd className="text-sm font-medium text-primary mt-0.5">{formatDate(quote.travel_date)}</dd>
                            </div>
                            <div className="bg-white px-4 py-3">
                                <dt className="text-xs uppercase tracking-wide text-neutral-500">Travellers</dt>
                                <dd className="text-sm font-medium text-primary mt-0.5">
                                    {travellersLabel(quote.adults, quote.children, quote.infants)}
                                </dd>
                            </div>
                        </dl>
                    </Card>

                    {/* Payment placeholder (Phase 2) */}
                    <Card className="px-6 py-5">
                        <Heading level={4} weight="semibold">Payment</Heading>
                        <Text size="sm" intent="secondary" className="mt-1 block">
                            Secure online payment is coming soon. Your price is locked while you complete
                            your booking.
                        </Text>
                        <Button variant="premium" className="w-full mt-4" disabled>
                            Continue to payment (coming soon)
                        </Button>
                    </Card>
                </div>

                {/* Price summary */}
                <div>
                    <Card className="px-6 py-5 lg:sticky lg:top-24">
                        <Text size="xs" intent="muted" weight="medium" className="uppercase tracking-wide">
                            Price summary
                        </Text>

                        <div className="flex items-center justify-between mt-3">
                            <Text size="sm" intent="secondary">Price per adult</Text>
                            <Text size="sm" weight="medium" intent="primary">{fmt(quote.price_per_adult)}</Text>
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                            <Text size="sm" intent="secondary">GST ({quote.gst_percentage}%)</Text>
                            <Text size="sm" weight="medium" intent="secondary">{fmt(quote.gst_amount)}</Text>
                        </div>

                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-100">
                            <Text size="sm" weight="semibold" intent="primary">
                                Total for {totalPax} traveller{totalPax !== 1 ? 's' : ''}
                            </Text>
                            <Text size="lg" weight="bold" intent="primary" className="font-heading">
                                {fmt(quote.total_amount)}
                            </Text>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
