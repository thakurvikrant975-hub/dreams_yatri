'use client';

import { useBooking } from '../PackageBookingProvider';
import Button from '@/app/components/ui/Button';
import Card from '@/app/components/ui/Card';
import { Text } from '@/app/components/ui/Typography';

const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

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
                </>
            )}

            <Button variant="premium" className="w-full mt-4">
                Book this package
            </Button>
            <Button variant="outline" className="lg:hidden w-full mt-3">
                Book a call
            </Button>
        </Card>
    );
}
