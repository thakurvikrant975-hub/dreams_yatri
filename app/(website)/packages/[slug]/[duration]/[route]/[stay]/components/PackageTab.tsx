'use client';

import { useState } from 'react';
import {
    CalendarDateRangeIcon,
    DocumentTextIcon,
    ShieldCheckIcon,
} from '@heroicons/react/24/solid';
import Tabs from '@/app/components/ui/Tabs';

const TABS = [
    { id: 'itinerary',  label: 'Itinerary',          icon: CalendarDateRangeIcon },
    { id: 'highlights', label: 'Highlights',          icon: ShieldCheckIcon },
    { id: 'policies',   label: 'Policies',            icon: DocumentTextIcon },
];

interface Props {
    itinerary:  React.ReactNode;
    highlights: React.ReactNode;
    policies:   React.ReactNode;
}

export default function PackageTab({ itinerary, highlights, policies }: Props) {
    const [activeTab, setActiveTab] = useState('itinerary');

    return (
        <>
            <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

            <div className="py-6">
                {activeTab === 'itinerary'  && itinerary}
                {activeTab === 'highlights' && highlights}
                {activeTab === 'policies'   && policies}
            </div>
        </>
    );
}
