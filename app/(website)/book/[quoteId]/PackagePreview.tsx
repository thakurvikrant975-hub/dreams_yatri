'use client';

import { useState } from 'react';
import { Heading, Text } from '@/app/components/ui/Typography';
import Card from '@/app/components/ui/Card';

export type PreviewDay = {
    day: number;
    day_title: string;
    hotel?: { hotel_name: string; room_name: string | null; plan_name: string | null } | null;
    meals?: { label: string }[];
    activities?: { name: string; is_optional: boolean }[];
    transfers?: { pickup_name: string | null; drop_name: string | null }[];
};

/** Collapsible day-wise package preview rendered from the quote's frozen breakdown. */
export default function PackagePreview({ days }: { days: PreviewDay[] }) {
    const [open, setOpen] = useState(false);
    if (!days.length) return null;

    return (
        <Card className="px-6 py-5">
            <button type="button" className="w-full flex items-center justify-between" onClick={() => setOpen((o) => !o)}>
                <Heading level={4} weight="semibold">Package details ({days.length} days)</Heading>
                <Text size="sm" intent="secondary">{open ? 'Hide' : 'View itinerary'}</Text>
            </button>

            {open && (
                <ol className="mt-4 space-y-3">
                    {days.map((d) => (
                        <li key={d.day} className="rounded-lg border border-neutral-200 p-3">
                            <Text size="sm" weight="semibold" intent="primary" className="block">Day {d.day}: {d.day_title}</Text>
                            {d.hotel && (
                                <Text size="sm" intent="secondary" className="block mt-1">
                                    🏨 {d.hotel.hotel_name}{d.hotel.room_name ? ` · ${d.hotel.room_name}` : ''}{d.hotel.plan_name ? ` · ${d.hotel.plan_name}` : ''}
                                </Text>
                            )}
                            {d.activities && d.activities.length > 0 && (
                                <Text size="sm" intent="secondary" className="block mt-0.5">🎟 {d.activities.map((a) => a.name).join(', ')}</Text>
                            )}
                            {d.meals && d.meals.length > 0 && (
                                <Text size="xs" intent="muted" className="block mt-0.5">Meals: {d.meals.map((m) => m.label).join(', ')}</Text>
                            )}
                        </li>
                    ))}
                </ol>
            )}
        </Card>
    );
}
