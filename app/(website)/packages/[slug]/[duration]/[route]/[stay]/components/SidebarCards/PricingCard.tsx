'use client';

import { useBooking } from '../PackageBookingProvider';
import Button from '@/app/components/ui/Button';
import Card from '@/app/components/ui/Card';
import { Text } from '@/app/components/ui/Typography';
import { CarIcon } from '@phosphor-icons/react';

const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export default function PricingCard() {
    const {
        pricing, isPricingLoading, adults, childCount, infants,
        cabGroups, cabSelections, setCabForGroup,
    } = useBooking();

    const totalPax = adults + childCount + infants;
    const passengers = adults + childCount;

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

            {/* ── Cab selection ──────────────────────────────────────────────── */}
            {cabGroups.length > 0 && (
                <div className="mt-4 pt-4 border-t border-neutral-100">
                    <div className="flex items-center gap-1.5 mb-3">
                        <CarIcon weight="duotone" className="size-4 text-muted" />
                        <Text size="xs" intent="muted" weight="medium" className="uppercase tracking-wide">
                            Cab
                        </Text>
                    </div>

                    <div className="flex flex-col gap-2.5">
                        {cabGroups.map(group => {
                            const selectedId  = cabSelections.get(group.groupKey);
                            const selectedCab = group.cabs.find(c => c.id === selectedId)
                                ?? group.cabs.find(c => c.is_default)
                                ?? group.cabs[0];
                            const tooSmall = selectedCab
                                ? selectedCab.vehicle.passenger_capacity < passengers
                                : false;

                            return (
                                <div key={group.groupKey} className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <Text size="xs" intent="muted">
                                            Day {group.dayFrom}–{group.dayTo}
                                        </Text>
                                        {tooSmall && (
                                            <span className="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                                                Too small
                                            </span>
                                        )}
                                    </div>

                                    <select
                                        value={selectedId ?? ''}
                                        onChange={e => setCabForGroup(group.groupKey, parseInt(e.target.value))}
                                        className="w-full text-sm text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 cursor-pointer transition-colors"
                                    >
                                        {group.cabs.map(cab => {
                                            const fits = cab.vehicle.passenger_capacity >= passengers;
                                            return (
                                                <option key={cab.id} value={cab.id}>
                                                    {cab.label} · {cab.vehicle.passenger_capacity} seats{!fits ? ' ✗' : ''}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                            );
                        })}
                    </div>
                </div>
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
