'use client'
import { useState, useTransition } from 'react'
import { Heading } from "@/app/components/ui/Typography";
import { RadioGroup, RadioRoute } from "@/app/components/forms/RadioGroup";
import { useRouter } from 'next/navigation';
import { cn } from '@/app/lib/utils';

type RoutesProps = {
    slug: string;
    stops: string[];
}

function DestinationRoutes({ routeSlug, routesOption, baseUrl, durationSlug, staySlug }: { routeSlug: string, routesOption: RoutesProps[], baseUrl: string, durationSlug: string, staySlug: string }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [val, setVal] = useState(routeSlug);
    return (
        <section>
            <Heading level={3} weight='semibold'>Destination Routes</Heading>
            <RadioGroup
                value={val}
                onChange={(val) => {
                    setVal(val);
                    startTransition(() => {
                        router.push(`${baseUrl}/${durationSlug}/${val}/${staySlug}`,
                            { scroll: false }
                        );
                    });
                }}
                className={cn("flex flex-col gap-2 mt-1", isPending && "opacity-50 pointer-events-none")}
            >
                {routesOption.map((r) => (
                    <RadioRoute key={r.slug} value={r.slug} stops={r.stops} />
                ))}
            </RadioGroup>
        </section>
    )
}

export default DestinationRoutes
