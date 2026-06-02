'use client';

import { useContext } from 'react';
import { BookingContext } from '../PackageBookingProvider';
import { useBookQuote } from '../useBookQuote';
import Button from '@/app/components/ui/Button';
import { Text } from '@/app/components/ui/Typography';

const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

function fakeOriginalPrice(price: number): number {
    const seed = (price % 97) / 97;
    const markup = 1.18 + seed * 0.26;
    return Math.ceil((price * markup) / 100) * 100 - 1;
}

export default function MobileFooterBar() {
    const ctx = useContext(BookingContext);
    const { book, booking, error } = useBookQuote();
    if (!ctx) return null;
    const { pricing, isPricingLoading } = ctx;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-300 lg:hidden bg-white border-t border-neutral-200 shadow-[0_-2px_8px_rgba(0,0,0,0.08)] px-4 py-3 flex flex-col gap-1"><div className="flex items-center justify-between gap-4">

            {/* Left: price info */}
            {isPricingLoading || !pricing ? (
                <div className="flex flex-col gap-1.5 animate-pulse">
                    <div className="h-5 w-28 rounded bg-neutral-200" />
                    <div className="h-3 w-20 rounded bg-neutral-200" />
                </div>
            ) : (
                <div className="flex flex-col">
                    <div className="flex items-baseline gap-1.5">
                        <Text as="span" size="lg" weight="bold" intent="primary" className="font-heading tracking-tight">
                            {fmt(pricing.pricePerAdult)}
                        </Text>
                        <Text as="span" size="xs" intent="muted">/ adult</Text>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Text as="span" size="xs" intent="muted" className="line-through">
                            {fmt(fakeOriginalPrice(pricing.pricePerAdult))}
                        </Text>
                        <span className="text-[10px] font-semibold text-success-600 bg-success-50 px-1.5 py-0.5 rounded-full">
                            {Math.round((1 - pricing.pricePerAdult / fakeOriginalPrice(pricing.pricePerAdult)) * 100)}% off
                        </span>
                    </div>
                </div>
            )}

            {/* Right: CTA */}
            <Button
                variant="premium"
                size="sm"
                className="shrink-0"
                onClick={book}
                loading={booking}
                disabled={isPricingLoading || !pricing}
            >
                {booking ? 'Locking…' : 'Book this package'}
            </Button>
            </div>

            {error && (
                <Text size="xs" intent="error" className="block" role="alert">
                    {error}
                </Text>
            )}
        </div>
    );
}
