'use client'

import { useRouter } from 'next/navigation';
import { useTransition, useState } from 'react';
import { cn } from '@/app/lib/utils';
import { Heading } from "@/app/components/ui/Typography";
import { RadioGroup, RadioImageCard } from '@/app/components/forms/RadioGroup';

type TripDurationProps = {
    image_url: string;
    price: string;
    label: string;
    slug: string;
}

function TripDuration({
    durationOptions,
    baseURL,
    durationSlug,
    routeSlug,
    staySlug
}: {
    durationOptions: TripDurationProps[];
    baseURL: string;
    durationSlug: string;
    routeSlug: string;
    staySlug: string;
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [val, setVal] = useState(durationSlug);

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
                {durationOptions.map(option => (
                    <RadioImageCard
                        key={option.slug}
                        value={option.slug}
                        label={option.label}
                        image={option.image_url}
                        price={option.price}
                    />
                ))}
            </RadioGroup>
        </section>
    );
}

export default TripDuration;