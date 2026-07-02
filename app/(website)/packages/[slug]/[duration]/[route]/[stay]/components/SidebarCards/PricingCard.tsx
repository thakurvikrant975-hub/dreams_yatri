'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useBooking } from '../PackageBookingProvider';
import { useBookQuote } from '../useBookQuote';
import Button, { buttonVariants } from '@/app/components/ui/Button';
import Card from '@/app/components/ui/Card';
import { Text } from '@/app/components/ui/Typography';
import { SITE_CONFIG } from '@/app/lib/seo/site-config';

const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

function BreakdownRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <div className="flex items-start justify-between gap-2 py-1">
            <div>
                <span className="text-xs text-neutral-500">{label}</span>
                {sub && <span className="block text-[10px] text-neutral-400">{sub}</span>}
            </div>
            <span className="text-xs text-neutral-600 font-medium shrink-0">{value}</span>
        </div>
    );
}

export default function PricingCard() {
    const { pricing, isPricingLoading, adults, childCount, infants, recentEnquiryCount } = useBooking();
    const { book, booking, error } = useBookQuote();
    const [showBreakdown, setShowBreakdown] = useState(false);

    const totalPax = adults + childCount + infants;

    const hasBreakdown = pricing && (
        pricing.breakdown.hotelSubtotal > 0 ||
        pricing.breakdown.mealSubtotal > 0 ||
        pricing.breakdown.cabSubtotal > 0 ||
        pricing.breakdown.permitSubtotal > 0
    );

    return (
        <Card className="px-6 py-5">
            {isPricingLoading ? (
                <div className="flex flex-col gap-3 animate-pulse">
                    <div className="h-4 w-24 rounded bg-neutral-200" />
                    <div className="h-8 w-36 rounded bg-neutral-200" />
                    <div className="h-3 w-40 rounded bg-neutral-200" />
                </div>
            ) : !pricing ? (
                <div className="text-sm text-neutral-400 py-1">
                    Pricing not configured for this package. Please contact us for a quote.
                </div>
            ) : (
                <>
                    {/* Price per adult */}
                    <div>
                        <Text size="xs" intent="muted" weight="medium" className="uppercase tracking-wide">
                            Price per adult
                        </Text>
                        <div className="flex items-baseline gap-2 mt-0.5">
                            <Text as="span" size="2xl" weight="bold" intent="primary" className="font-heading tracking-tight">
                                {fmt(pricing.pricePerAdult)}
                            </Text>
                            <Text as="span" size="sm" intent="secondary" className="font-heading">/ adult</Text>
                        </div>
                    </div>

                    {/* GST line */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-100">
                        <Text size="sm" intent="secondary">GST ({pricing.gstPercentage}%)</Text>
                        <Text size="sm" intent="secondary" weight="medium">{fmt(pricing.gstAmount)}</Text>
                    </div>

                    {/* Total */}
                    <div className="flex items-center justify-between mt-1.5">
                        <Text size="sm" intent="secondary">
                            Total for {totalPax} traveller{totalPax !== 1 ? 's' : ''}
                        </Text>
                        <Text size="sm" weight="bold" intent="primary">{fmt(pricing.finalPrice)}</Text>
                    </div>

                    {/* Breakdown toggle */}
                    {hasBreakdown && (
                        <button
                            type="button"
                            onClick={() => setShowBreakdown(v => !v)}
                            className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition-colors"
                        >
                            {showBreakdown ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                            {showBreakdown ? 'Hide' : 'View'} price breakdown
                        </button>
                    )}

                    {/* Breakdown panel */}
                    {showBreakdown && hasBreakdown && (
                        <div className="mt-2 rounded-lg bg-neutral-50 px-3 py-2 border border-neutral-100 divide-y divide-neutral-100">
                            {pricing.breakdown.hotelSubtotal > 0 && (
                                <BreakdownRow label="Hotels" value={fmt(pricing.breakdown.hotelSubtotal)} />
                            )}
                            {pricing.breakdown.mealSubtotal > 0 && (
                                <BreakdownRow label="Meals" value={fmt(pricing.breakdown.mealSubtotal)} />
                            )}
                            {pricing.breakdown.activitySubtotal > 0 && (
                                <BreakdownRow label="Activities" value={fmt(pricing.breakdown.activitySubtotal)} />
                            )}
                            {pricing.breakdown.cabSubtotal > 0 && (
                                <BreakdownRow label="Transport" value={fmt(pricing.breakdown.cabSubtotal)} />
                            )}
                            {pricing.permits.length > 0 && pricing.permits.map((p, i) => {
                                const sub = p.priceType === 'PER_PERSON'
                                    ? `${fmt(p.unitPrice)} × ${p.quantity} person${p.quantity !== 1 ? 's' : ''}`
                                    : p.priceType === 'PER_VEHICLE'
                                    ? `${fmt(p.unitPrice)} × 1 vehicle`
                                    : undefined;
                                return (
                                    <BreakdownRow
                                        key={i}
                                        label={p.name}
                                        value={fmt(p.total)}
                                        sub={sub}
                                    />
                                );
                            })}
                            {pricing.breakdown.marginAmount > 0 && (
                                <BreakdownRow
                                    label="Service margin"
                                    value={fmt(pricing.breakdown.marginAmount)}
                                    sub={`${pricing.breakdown.marginPercentage}% of base`}
                                />
                            )}
                        </div>
                    )}
                </>
            )}

            <Button
                variant="premium"
                className="w-full mt-4"
                onClick={book}
                loading={booking}
                disabled={isPricingLoading || !pricing || pricing.finalPrice === 0}
            >
                {booking ? 'Locking your price…' : 'Book this package'}
            </Button>

            {error && (
                <Text size="xs" intent="error" className="mt-2 block text-center" role="alert">
                    {error}
                </Text>
            )}

            {recentEnquiryCount > 3 && (
                <div className="mt-3 flex items-center gap-1.5 justify-center">
                    <span className="size-2 rounded-full bg-green-500 animate-pulse" aria-hidden="true" />
                    <Text size="xs" intent="muted">
                        {recentEnquiryCount} people enquired this week
                    </Text>
                </div>
            )}

            <a
                href={SITE_CONFIG.contact.whatsapp.phoneUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: 'outline', className: 'lg:hidden w-full mt-3' })}
            >
                Book a call
            </a>
        </Card>
    );
}
