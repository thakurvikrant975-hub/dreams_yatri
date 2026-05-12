'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';
import {
    CalendarDateRangeIcon,
    DocumentTextIcon,
    ShieldCheckIcon,
} from '@heroicons/react/24/solid';
import Tabs from '@/app/components/ui/Tabs';

const TABS = [
    { id: 'itinerary',  label: 'Itinerary',  icon: CalendarDateRangeIcon },
    { id: 'highlights', label: 'Highlights', icon: ShieldCheckIcon },
    { id: 'policies',   label: 'Policies',   icon: DocumentTextIcon },
];

interface Props {
    pricing:    ReactNode;
    coupon:     ReactNode;
    enquiry:    ReactNode;
    itinerary:  ReactNode;
    highlights: ReactNode;
    policies:   ReactNode;
}

const STICKY_TOP = 'var(--header-height, 70px)';

export default function PackageTab({
    pricing, coupon, enquiry,
    itinerary, highlights, policies,
}: Props) {
    const [activeTab, setActiveTab] = useState('itinerary');
    const [stuck, setStuck]         = useState(false);
    const sentinelRef               = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = sentinelRef.current;
        if (!el) return;
        // rootMargin shrinks the intersection root by header-height so the
        // observer fires at the exact scroll position where the bar snaps.
        const ob = new IntersectionObserver(
            ([entry]) => setStuck(!entry.isIntersecting),
            { rootMargin: '-70px 0px 0px 0px', threshold: 0 },
        );
        ob.observe(el);
        return () => ob.disconnect();
    }, []);

    return (
        <>
            {/* Sentinel: exits viewport top at the same moment tabs snap sticky */}
            <div ref={sentinelRef} className="h-0" aria-hidden="true" />

            <div
                className="sticky z-250 bg-white"
                style={{
                    top: STICKY_TOP,
                    marginLeft:  'calc(50% - 50vw)',
                    marginRight: 'calc(50% - 50vw)',
                    boxShadow: stuck ? '0 1px 3px 0 rgba(163,163,163,0.2)' : 'none',
                    transition: 'box-shadow 0.2s ease',
                }}
            >
                {/* Re-constrain inner content to the container width */}
                <div
                    className="mx-auto px-4 sm:px-6 lg:px-8"
                    style={{ maxWidth: 'var(--max-width-container, 1400px)' }}
                >
                    <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
                </div>
            </div>

            {/* Two-column layout */}
            <div className="flex gap-10 py-section-sm">

                {/* Main content */}
                <div className="flex-1 min-w-0">
                    <div className="py-2">
                        {activeTab === 'itinerary'  && itinerary}
                        {activeTab === 'highlights' && highlights}
                        {activeTab === 'policies'   && policies}
                    </div>
                </div>

                {/* Sidebar */}
                <aside className="w-[27%] flex flex-col gap-3">
                    {/* Pricing — sticky at same top as tab bar */}
                    <div
                        className="sticky z-300 flex flex-col gap-3"
                        style={{ top: STICKY_TOP }}
                    >
                        {pricing}
                    </div>

                    {/* Coupon and enquiry — scroll freely */}
                    {coupon}
                    {enquiry}
                </aside>

            </div>
        </>
    );
}
