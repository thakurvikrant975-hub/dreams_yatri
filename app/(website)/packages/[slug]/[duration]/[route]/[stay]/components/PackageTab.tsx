'use client';

import { useState, useRef, useEffect, useLayoutEffect, type ReactNode } from 'react';
import {
    CalendarDateRangeIcon,
    DocumentTextIcon,
    ShieldCheckIcon,
} from '@heroicons/react/24/solid';
import { ShareNetworkIcon } from '@phosphor-icons/react';
import dynamic from 'next/dynamic';
import Tabs from '@/app/components/ui/Tabs';
import Button from '@/app/components/ui/Button';

const MobileFooterBar = dynamic(() => import('./SidebarCards/MobileFooterBar'), { ssr: false });
const EnquiryFab      = dynamic(() => import('./SidebarCards/EnquiryFab'),      { ssr: false });

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

export default function PackageTab({
    pricing, coupon, enquiry,
    itinerary, highlights, policies,
}: Props) {
    const [activeTab, setActiveTab] = useState('itinerary');
    const [stuck, setStuck]         = useState(false);

    // Heights measured directly — no cross-component CSS custom properties
    const [infoHeight, setInfoHeight] = useState(160); // fallback until measured
    const [tabHeight,  setTabHeight]  = useState(50);  // fallback until measured

    const sentinelRef = useRef<HTMLDivElement>(null);
    const barRef      = useRef<HTMLDivElement>(null);

    // Shadow: appears when tab bar snaps sticky (sentinel exits viewport)
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

    // Measure both the hero info band (by id) and the tab bar (by ref)
    useLayoutEffect(() => {
        const infoEl = document.getElementById('package-info-band');
        const tabEl  = barRef.current;

        const measureInfo = () => {
            const h = infoEl?.offsetHeight ?? 0;
            if (h > 0) setInfoHeight(h);
        };
        const measureTab = () => {
            const h = tabEl?.offsetHeight ?? 0;
            if (h > 0) setTabHeight(h);
        };

        const infoRo = infoEl ? new ResizeObserver(measureInfo) : null;
        const tabRo  = tabEl  ? new ResizeObserver(measureTab)  : null;

        infoRo?.observe(infoEl!);
        tabRo?.observe(tabEl!);

        // Delay first measurement by one frame so layout is fully settled
        const raf = requestAnimationFrame(() => {
            measureInfo();
            measureTab();
        });

        return () => {
            infoRo?.disconnect();
            tabRo?.disconnect();
            cancelAnimationFrame(raf);
        };
    }, []);

    const sidebarTop = infoHeight + tabHeight + 16;

    return (
        <>
            {/* Sentinel: exits viewport top when the tab bar is about to snap sticky */}
            <div ref={sentinelRef} className="h-0" aria-hidden="true" />

            {/* Sticky tab bar — positioned directly below the hero info band */}
            <div
                ref={barRef}
                className="sticky z-210 bg-white"
                style={{
                    top:         infoHeight,
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
                    <Tabs
                        tabs={TABS}
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                        trailing={
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    if (navigator.share) {
                                        navigator.share({ url: window.location.href });
                                    } else {
                                        navigator.clipboard.writeText(window.location.href);
                                    }
                                }}
                            >
                                Share
                                <ShareNetworkIcon weight="bold" className="size-4 text-muted" />
                            </Button>
                        }
                    />
                </div>
            </div>

            {/* Two-column layout */}
            <div className="flex gap-10 py-section-sm">

                {/* Main content */}
                <div className="flex-1 min-w-0 py-2 pb-20 lg:pb-2">
                    {activeTab === 'itinerary'  && itinerary}
                    {activeTab === 'highlights' && highlights}
                    {activeTab === 'policies'   && policies}
                </div>

                {/* Sidebar — desktop only */}
                <aside className="hidden lg:flex w-[27%] flex-col gap-3">
                    {/* Pricing + enquiry: sticky below both info band and tab bar */}
                    <div
                        className="sticky z-200 flex flex-col gap-3 bg-white"
                        style={{ top: sidebarTop }}
                    >
                        {pricing}
                        {enquiry}
                    </div>

                    {/* Coupon: scrolls freely */}
                    {coupon}
                </aside>

            </div>

            {/* Mobile: fixed bottom pricing bar + enquiry FAB */}
            <MobileFooterBar />
            <EnquiryFab>{enquiry}</EnquiryFab>
        </>
    );
}
