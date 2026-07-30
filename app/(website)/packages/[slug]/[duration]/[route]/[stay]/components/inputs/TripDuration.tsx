'use client'

import { useRouter } from 'next/navigation';
import { useTransition, useState, useEffect, useRef } from 'react';
import { cn } from '@/app/lib/utils';
import { Heading } from "@/app/components/ui/Typography";
import { RadioGroup, RadioImageCard } from '@/app/components/forms/RadioGroup';
import { useBooking } from '../PackageBookingProvider';
import { handleComputePackagePrice } from '@/app/actions/packages/pricing.actions';

type TripDurationOption = {
    image_url: string;
    price: string;        // server-computed initial per-adult price
    label: string;
    slug: string;
    durationId: number;
    routeId: number | null;
}

function TripDuration({
    durationOptions,
    baseURL,
    durationSlug,
    routeSlug,
    staySlug,
    packageId,
    stayCategoryId,
}: {
    durationOptions: TripDurationOption[];
    baseURL: string;
    durationSlug: string;
    routeSlug: string;
    staySlug: string;
    packageId: number;
    stayCategoryId: number;
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [val, setVal] = useState(durationSlug);

    // Recompute each duration's per-adult price as the selected travellers change.
    const { adults, childCount, childAges, roomGuests, travelDate } = useBooking();
    const [livePrices, setLivePrices] = useState<Record<number, number>>({});
    const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const childAgesKey = childAges.join(',');

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            const results = await Promise.all(
                durationOptions.map(async (opt) => {
                    if (opt.routeId == null) return null;
                    const res = await handleComputePackagePrice({
                        package_id: packageId,
                        duration_id: opt.durationId,
                        route_id: opt.routeId,
                        stay_category_id: stayCategoryId,
                        adults,
                        children: childCount,
                        infants: 0,
                        child_ages: childAges.length === childCount ? childAges : undefined,
                        rooms: roomGuests.map((r) => ({ adults: r.adults, children: r.childAges.length })),
                        travel_date: travelDate || null,
                    });
                    if (res.success && !res.data.missing_pricing_config) {
                        return [opt.durationId, Math.round(res.data.price_per_adult)] as const;
                    }
                    return null;
                }),
            );
            setLivePrices((prev) => {
                const next = { ...prev };
                for (const r of results) if (r) next[r[0]] = r[1];
                return next;
            });
        }, 400);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [adults, childCount, childAgesKey, roomGuests, travelDate, packageId, stayCategoryId]);

    return (
        <section>
            <Heading level={3} weight='semibold'>Choose Trip Duration</Heading>

            <RadioGroup
                value={val}
                onChange={(val) => {
                    setVal(val);
                    startTransition(() =>
                        router.push(
                            `${baseURL}/${val}/${routeSlug}/${staySlug}`,
                            { scroll: false }
                        )
                    )}
                }
                className={cn(
                    "flex flex-row gap-3 overflow-x-auto py-3 px-2 pb-1 mt-1 transition-opacity duration-200",
                    isPending && "opacity-50 pointer-events-none"
                )}
            >
                {durationOptions.map(option => {
                    const live = livePrices[option.durationId];
                    const priceStr = live != null ? `₹${live.toLocaleString('en-IN')}` : option.price;
                    return (
                        <RadioImageCard
                            key={option.slug}
                            value={option.slug}
                            label={option.label}
                            image={option.image_url}
                            price={priceStr}
                        />
                    );
                })}
            </RadioGroup>
        </section>
    );
}

export default TripDuration;
