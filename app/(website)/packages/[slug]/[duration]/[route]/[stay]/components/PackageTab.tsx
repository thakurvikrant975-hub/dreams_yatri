'use client';

import { useState, useRef, useEffect, useLayoutEffect, type ReactNode } from 'react';
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
    // Sidebar slots
    pricing:    ReactNode;
    coupon:     ReactNode;
    enquiry:    ReactNode;

    // Tab content slots
    itinerary:  ReactNode;
    highlights: ReactNode;
    policies:   ReactNode;
}

export default function PackageTab({
    pricing, coupon, enquiry,
    itinerary, highlights, policies,
}: Props) {
    const [activeTab, setActiveTab] = useState('itinerary');
    const [stuck, setStuck]         = useState(false);

    const sentinelRef = useRef<HTMLDivElement>(null);
    const barRef      = useRef<HTMLDivElement>(null);

    // Shadow: appears exactly when bar snaps sticky
    useEffect(() => {
        const el = sentinelRef.current;
        if (!el) return;
        const ob = new IntersectionObserver(
            ([entry]) => setStuck(!entry.isIntersecting),
            { threshold: 0 },
        );
        ob.observe(el);
        return () => ob.disconnect();
    }, []);

    // Publish tab-bar height so sidebar can position itself below it
    useLayoutEffect(() => {
        const el = barRef.current;
        if (!el) return;
        const update = () =>
            document.documentElement.style.setProperty(
                '--tab-bar-height',
                `${el.offsetHeight}px`,
            );
        const ro = new ResizeObserver(update);
        ro.observe(el);
        update();
        return () => ro.disconnect();
    }, []);

    return (
        <>
            {/* Sentinel: exits viewport top exactly when the tab bar snaps sticky */}
            <div ref={sentinelRef} className="h-0" aria-hidden="true" />

            {/*
             * Full-viewport-width sticky tab bar.
             * Sits below the hero info band via --package-info-height.
             */}
            <div
                ref={barRef}
                className="sticky z-210 bg-white"
                style={{
                    top:         'var(--package-info-height, 160px)',
                    marginLeft:  'calc(50% - 50vw)',
                    marginRight: 'calc(50% - 50vw)',
                    boxShadow:   stuck ? '0 1px 3px 0 rgba(163,163,163,0.2)' : 'none',
                    transition:  'box-shadow 0.2s ease',
                }}
            >
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
                <div className="flex-1 min-w-0 py-2">
                    {activeTab === 'itinerary'  && itinerary}
                    {activeTab === 'highlights' && highlights}
                    {activeTab === 'policies'   && policies}
                </div>

                {/* Sidebar */}
                <aside className="w-[27%] flex flex-col gap-3">
                    {/* Pricing + enquiry: sticky below both info band and tab bar */}
                    <div
                        className="sticky z-220 flex flex-col gap-3 bg-white"
                        style={{
                            top: 'calc(var(--package-info-height, 160px) + var(--tab-bar-height, 50px) - 72px)',
                        }}
                    >
                        {pricing}
                        {enquiry}
                    </div>

                    {/* Coupon: scrolls freely */}
                    {coupon}
                </aside>

            </div>
        </>
    );
}
