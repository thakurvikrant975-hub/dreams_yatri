"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  FloppyDisk,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/app/lib/utils";
import { HotelListingStatus, PropertySubType } from "@/app/generated/prisma";
import TabPlaceholder from "./tabs/TabPlaceholder";

// ── Types ─────────────────────────────────────────────────────────────────────

type HotelSummary = {
  id: number;
  name: string;
  listing_status: HotelListingStatus;
  wizard_step: number;
  property_category: string | null;
  property_sub_type: PropertySubType | null;
};

// ── Tab config ────────────────────────────────────────────────────────────────

export const WIZARD_TABS = [
  { index: 1, label: "Basic Info",  desc: "Type, name & contact" },
  { index: 2, label: "Location",    desc: "Address & map" },
  { index: 3, label: "Amenities",   desc: "Facilities & features" },
  { index: 4, label: "Rooms",       desc: "Types & pricing" },
  { index: 5, label: "Photos",      desc: "Property images" },
  { index: 6, label: "Policies",    desc: "Check-in & rules" },
  { index: 7, label: "Finance",     desc: "Bank & GST" },
];

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  HotelListingStatus,
  { label: string; className: string }
> = {
  DRAFT:        { label: "Draft",        className: "bg-neutral-100 text-neutral-600 border-neutral-200" },
  SUBMITTED:    { label: "Submitted",    className: "bg-blue-50 text-blue-700 border-blue-200" },
  UNDER_REVIEW: { label: "Under Review", className: "bg-amber-50 text-amber-700 border-amber-200" },
  APPROVED:     { label: "Approved",     className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  LIVE:         { label: "Live",         className: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  REJECTED:     { label: "Rejected",     className: "bg-red-50 text-red-700 border-red-200" },
};

// ── Sub-type label ────────────────────────────────────────────────────────────

function subTypeLabel(st: PropertySubType | null): string {
  if (!st) return "Property";
  return st.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Tab bar item ──────────────────────────────────────────────────────────────

function TabItem({
  tab,
  currentTab,
  wizardStep,
  hotelId,
}: {
  tab: (typeof WIZARD_TABS)[0];
  currentTab: number;
  wizardStep: number;
  hotelId: number;
}) {
  const isCurrent   = tab.index === currentTab;
  const isCompleted = tab.index < currentTab && tab.index <= wizardStep;
  const isFuture    = tab.index > wizardStep;

  return (
    <Link
      href={`/hotel-connect/properties/${hotelId}/edit?tab=${tab.index}`}
      className={cn(
        "flex items-center gap-2.5 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2",
        isCurrent
          ? "border-primary-500 text-primary-700"
          : isCompleted
          ? "border-transparent text-neutral-600 hover:text-neutral-900 hover:border-neutral-200"
          : isFuture
          ? "border-transparent text-neutral-400 hover:text-neutral-600"
          : "border-transparent text-neutral-500 hover:text-neutral-800"
      )}
    >
      {/* Step indicator */}
      <span
        className={cn(
          "w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0",
          isCurrent
            ? "bg-primary-500 text-white"
            : isCompleted
            ? "bg-emerald-500 text-white"
            : "bg-neutral-200 text-neutral-500"
        )}
      >
        {isCompleted ? <CheckCircle size={12} weight="bold" /> : tab.index}
      </span>

      {/* Label (always visible) + desc (hidden on small screens) */}
      <span>
        {tab.label}
        <span className="hidden md:inline text-xs font-normal text-neutral-400 ml-1.5">
          {tab.desc}
        </span>
      </span>
    </Link>
  );
}

// ── Main shell ────────────────────────────────────────────────────────────────

export default function WizardShell({
  hotel,
  currentTab,
}: {
  hotel: HotelSummary;
  currentTab: number;
}) {
  const router = useRouter();
  const status = STATUS_CONFIG[hotel.listing_status] ?? STATUS_CONFIG.DRAFT;

  function goTo(tab: number) {
    const t = Math.max(1, Math.min(7, tab));
    router.push(`/hotel-connect/properties/${hotel.id}/edit?tab=${t}`);
  }

  const isFirstTab = currentTab === 1;
  const isLastTab  = currentTab === 7;

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ── Wizard header ─────────────────────────────────────────────── */}
      <header className="shrink-0 bg-white border-b border-neutral-100 px-4 h-14 flex items-center gap-3">
        <Link
          href="/hotel-connect/properties"
          className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 transition-colors shrink-0"
        >
          <ArrowLeft size={14} weight="bold" />
          <span className="hidden sm:inline">Properties</span>
        </Link>

        <div className="w-px h-4 bg-neutral-200 shrink-0" />

        <div className="flex items-center gap-2 min-w-0 flex-1">
          <p className="text-sm font-semibold text-neutral-900 truncate">
            {hotel.name === "My Property"
              ? subTypeLabel(hotel.property_sub_type)
              : hotel.name}
          </p>
          <span
            className={cn(
              "shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border",
              status.className
            )}
          >
            {status.label}
          </span>
        </div>

        <button
          type="button"
          className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-800 transition-colors"
          onClick={() => router.push("/hotel-connect")}
        >
          <FloppyDisk size={14} />
          <span className="hidden sm:inline">Save & Exit</span>
        </button>
      </header>

      {/* ── Tab bar ───────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-white border-b border-neutral-100 overflow-x-auto scrollbar-none">
        <div className="flex min-w-max">
          {WIZARD_TABS.map((tab) => (
            <TabItem
              key={tab.index}
              tab={tab}
              currentTab={currentTab}
              wizardStep={hotel.wizard_step}
              hotelId={hotel.id}
            />
          ))}
        </div>
      </div>

      {/* ── Scrollable content ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full p-6">
          <TabPlaceholder
            tabIndex={currentTab}
            tabLabel={WIZARD_TABS[currentTab - 1]?.label ?? ""}
          />
        </div>
      </div>

      {/* ── Bottom navigation ─────────────────────────────────────────── */}
      <footer className="shrink-0 bg-white border-t border-neutral-100 px-6 h-16 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => goTo(currentTab - 1)}
          disabled={isFirstTab}
          className={cn(
            "flex items-center gap-2 text-sm font-medium transition-colors",
            isFirstTab
              ? "text-neutral-300 cursor-not-allowed"
              : "text-neutral-600 hover:text-neutral-900"
          )}
        >
          <ArrowLeft size={14} weight="bold" />
          Previous
        </button>

        <p className="text-xs text-neutral-400 font-medium">
          Step {currentTab} of {WIZARD_TABS.length}
        </p>

        <button
          type="button"
          onClick={() => goTo(currentTab + 1)}
          disabled={isLastTab}
          className={cn(
            "flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-colors",
            isLastTab
              ? "bg-neutral-100 text-neutral-400 cursor-not-allowed"
              : "bg-primary-600 hover:bg-primary-700 text-white"
          )}
        >
          Save & Continue
          <ArrowRight size={14} weight="bold" />
        </button>
      </footer>

    </div>
  );
}
