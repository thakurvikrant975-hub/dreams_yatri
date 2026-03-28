'use client'
import { useState, useTransition } from "react";
import { Heading } from "@/app/components/ui/Typography";
import { RadioGroup, RadioPill } from "@/app/components/forms/RadioGroup";
import { useRouter } from 'next/navigation';
import { cn } from "@/app/lib/utils";

function StayCategory({stayOptions, baseURL, durationSlug, routeSlug, staySlug } : {stayOptions : {slug : string, label: string}[], baseURL: string, durationSlug: string, routeSlug: string, staySlug: string }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [selectedStay, setSelectedStay] = useState(staySlug);

    return (
        <section>
            <Heading level={3} weight='semibold'>Stay Category</Heading>
            <RadioGroup
                value={selectedStay}
                onChange={(val) => {
                    setSelectedStay(val);
                    startTransition(() => {
                        router.push(`${baseURL}/${durationSlug}/${routeSlug}/${val}`, { scroll: false });
                    });
                }}
                className={cn("flex flex-row gap-2.5 mt-1", isPending && "opacity-50 pointer-events-none")}
            >
                {stayOptions.map(option => (
                    <RadioPill
                        key={option.slug}
                        value={option.slug}
                    >
                        {option.label}
                    </RadioPill>
                ))
                }
            </RadioGroup>
        </section>
    )
}

export default StayCategory
