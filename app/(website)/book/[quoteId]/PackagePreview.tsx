'use client';

import { useState } from 'react';
import { Text } from '@/app/components/ui/Typography';

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
        <div>
            <button type="button" className="flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700" onClick={() => setOpen((o) => !o)}>
                {open ? 'Hide itinerary' : `View ${days.length}-day itinerary`}
                <span className={`transition-transform ${open ? 'rotate-180' : ''}`}>⌄</span>
            </button>

            {open && (
                <ol className="mt-4 space-y-3">
                    {days.map((d) => (
                        <li key={d.day} className="relative rounded-xl border border-(--border-muted) p-4">
                            <span className="inline-flex h-6 items-center rounded-full bg-primary-50 px-2.5 text-xs font-semibold text-primary-600">Day {d.day}</span>
                            <Text size="sm" weight="semibold" intent="primary" className="block mt-2">{d.day_title}</Text>
                            {d.hotel && (
                                <Text size="sm" intent="secondary" className="block mt-1.5">🏨 {d.hotel.hotel_name}{d.hotel.room_name ? ` · ${d.hotel.room_name}` : ''}{d.hotel.plan_name ? ` · ${d.hotel.plan_name}` : ''}</Text>
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
        </div>
    );
}
