'use client';

import { useBooking } from '../PackageBookingProvider';
import Button from '@/app/components/ui/Button';
import Card from '@/app/components/ui/Card';
import { Text } from '@/app/components/ui/Typography';

const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

// Deterministic fake MRP — markup 18–44% based on price digits, rounded to a ×99 boundary
function fakeOriginalPrice(price: number): number {
    const seed = (price % 97) / 97;           // 0–1, stable for same price
    const markup = 1.18 + seed * 0.26;        // 1.18–1.44
    return Math.ceil((price * markup) / 100) * 100 - 1;
}

export default function PricingCard() {
    const { pricing, isPricingLoading, adults, childCount, infants } = useBooking();

    const totalPax = adults + childCount + infants;

    return (
        <Card className="px-6 py-5">
            {isPricingLoading || !pricing ? (
                <div className="flex flex-col gap-3 animate-pulse">
                    <div className="h-4 w-24 rounded bg-neutral-200" />
                    <div className="h-8 w-36 rounded bg-neutral-200" />
                    <div className="h-3 w-40 rounded bg-neutral-200" />
                </div>
            ) : (
                <>
                    {/* Price per adult — headline figure */}
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
                        <div className="flex items-center gap-2 mt-0.5">
                            <Text as="span" size="sm" intent="muted" className="line-through">
                                {fmt(fakeOriginalPrice(pricing.pricePerAdult))}
                            </Text>
                            <span className="text-xs font-semibold text-success-600 bg-success-50 px-1.5 py-0.5 rounded-full">
                                {Math.round((1 - pricing.pricePerAdult / fakeOriginalPrice(pricing.pricePerAdult)) * 100)}% off
                            </span>
                        </div>
                    </div>

                    {/* GST line */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-100">
                        <Text size="sm" intent="secondary">
                            GST ({pricing.gstPercentage}%)
                        </Text>
                        <Text size="sm" intent="secondary" weight="medium">
                            {fmt(pricing.gstAmount)}
                        </Text>
                    </div>

                    {/* Total */}
                    <div className="flex items-center justify-between mt-1.5">
                        <Text size="sm" intent="secondary">
                            Total for {totalPax} traveller{totalPax !== 1 ? 's' : ''}
                        </Text>
                        <Text size="sm" weight="bold" intent="primary">
                            {fmt(pricing.finalPrice)}
                        </Text>
                    </div>
                </>
            )}

            <Button variant="premium" className="w-full mt-4">
                Book this package
            </Button>
            <Button variant="outline" className="w-full mt-3">
                Book a call
            </Button>
        </Card>
    );
}
