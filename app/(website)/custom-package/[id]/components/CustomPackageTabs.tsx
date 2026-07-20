"use client";

import { useState } from "react";
import { CalendarDateRangeIcon, ShieldCheckIcon, DocumentTextIcon } from "@heroicons/react/24/solid";
import Tabs from "@/app/components/ui/Tabs";

const TABS = [
  { id: "itinerary", label: "Itinerary", icon: CalendarDateRangeIcon },
  { id: "highlights", label: "Highlights", icon: ShieldCheckIcon },
  { id: "policies", label: "Policies", icon: DocumentTextIcon },
];

/** Mirrors the catalog page's PackageTab — sticky tab bar + two-column
 * layout (main panel + sticky sidebar). No coupon/enquiry slots, no Share
 * button, no EnquiryFab — this itinerary is locked and already personalized,
 * so none of that catalog-browsing machinery applies. */
export function CustomPackageTabs({
  pricing, itinerary, highlights, policies, mobileFooter,
}: {
  pricing: React.ReactNode;
  itinerary: React.ReactNode;
  highlights: React.ReactNode;
  policies: React.ReactNode;
  mobileFooter: React.ReactNode;
}) {
  const [activeTab, setActiveTab] = useState("itinerary");

  return (
    <>
      <div className="sticky top-0 z-210 bg-white mt-3 mb-4 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
        <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      <div className="flex gap-10 pb-4">
        <div
          role="tabpanel"
          id={`tab-panel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
          tabIndex={0}
          className="flex-1 min-w-0 py-2 pb-24 lg:pb-2 focus-visible:outline-none"
        >
          {activeTab === "itinerary" && itinerary}
          {activeTab === "highlights" && highlights}
          {activeTab === "policies" && policies}
        </div>

        <aside className="hidden lg:flex w-[27%] flex-col gap-3">
          <div className="sticky top-24 flex flex-col gap-3">
            {pricing}
          </div>
        </aside>
      </div>

      {mobileFooter}
    </>
  );
}
