"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  FloppyDisk,
} from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/app/lib/utils";
import { HotelListingStatus, PropertySubType } from "@/app/generated/prisma";
import Button from "@/app/components/ui/Button";

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
  { index: 1, label: "Basic Info" },
  { index: 2, label: "Location" },
  { index: 3, label: "Amenities" },
  { index: 4, label: "Rooms" },
  { index: 5, label: "Photos" },
  { index: 6, label: "Policies" },
  { index: 7, label: "Finance" },
];

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  HotelListingStatus,
  { label: string; className: string }
> = {
  DRAFT: { label: "Draft", className: "bg-neutral-100 text-neutral-600 border-neutral-200" },
  SUBMITTED: { label: "Submitted", className: "bg-blue-50 text-blue-700 border-blue-200" },
  UNDER_REVIEW: { label: "Under Review", className: "bg-amber-50 text-amber-700 border-amber-200" },
  APPROVED: { label: "Approved", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  LIVE: { label: "Live", className: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  REJECTED: { label: "Rejected", className: "bg-red-50 text-red-700 border-red-200" },
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
  const isCurrent = tab.index === currentTab;
  const isCompleted = tab.index < currentTab && tab.index <= wizardStep;
  const isFuture = tab.index > wizardStep;

  return (
    <Link
      href={`/hotel-connect/properties/${hotelId}/edit?tab=${tab.index}`}
      className={cn(
        "relative flex-1 flex flex-col items-center gap-3 px-5 py-3.5 whitespace-nowrap transition-colors select-none",
        "after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:transition-colors",
        tab.index === 1 ? "rounded-tl-xl" : "",
        tab.index === WIZARD_TABS.length ? "rounded-tr-xl" : "",
        isCurrent
          ? "bg-white text-primary-500 relative after:absolute after:bottom-0 after:h-px after:w-full  after:bg-white after:translate-y-px"
          : isCompleted
            ? "text-neutral-600 hover:text-neutral-800 hover:bg-neutral-50 after:bg-transparent hover:after:bg-neutral-200"
            : isFuture
              ? "text-neutral-800 hover:text-neutral-500 bg-neutral-50 hover:bg-neutral-100 after:bg-transparent"
              : "text-neutral-500 hover:text-neutral-700 bg-neutral-50 hover:bg-neutral-100 after:bg-transparent"
      )}

    >
      {/* Step indicator */}
      <span
        className={cn(
          "size-6 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 font-heading",
          isCurrent
            ? "bg-primary-500 text-white"
            : isCompleted
              ? "bg-emerald-500 text-white"
              : "bg-white text-neutral-500/90 ring-1 ring-neutral-200 shadow shadow-neutral-300/80"
        )}
      >
        {isCompleted ? <CheckCircle size={12} weight="bold" /> : tab.index}
      </span>

      <span className="text-xs font-semibold leading-none font-heading">{tab.label}</span>
    </Link>
  );
}

// ── Main shell ────────────────────────────────────────────────────────────────

export default function WizardShell({
  hotel,
  currentTab,
  tabFormId,
  children,
}: {
  hotel: HotelSummary;
  currentTab: number;
  tabFormId?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const status = STATUS_CONFIG[hotel.listing_status] ?? STATUS_CONFIG.DRAFT;

  function goTo(tab: number) {
    const t = Math.max(1, Math.min(7, tab));
    router.push(`/hotel-connect/properties/${hotel.id}/edit?tab=${t}`);
  }

  const isFirstTab = currentTab === 1;
  const isLastTab = currentTab === 7;

  return (
    <div className="flex flex-col h-full min-h-0 ">

      {/* ── Wizard header ─────────────────────────────────────────────── */}
      <header className="shrink-0 bg-white border-b border-neutral-200 px-4 h-14 flex items-center gap-3">
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
      <div className="shrink-0 bg-white overflow-x-auto scrollbar-none py-5">
        <div className="border-b border-neutral-200">
          <div className="grid grid-cols-7 max-w-4xl m-auto divide-x divide-neutral-200 border border-neutral-200 rounded-t-xl -mb-px">
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
      </div>

      {/* ── Scrollable content ────────────────────────────────────────── */}
      <div className="relative flex-1 overflow-y-auto bg-neutral-100 after:content-[''] after:absolute after:top-0 after:left-0 after:w-full after:h-25 after:bg-white after:border-b after:border-neutral-200 after:-z-10 isolate">
        <div className="max-w-4xl mx-auto w-full ">
          {children}
        </div>
      </div>

      {/* ── Bottom navigation ─────────────────────────────────────────── */}
      <footer className="shrink-0 bg-white border-t border-neutral-200 py-3.5">
        <div className="flex items-center justify-between gap-4 max-w-4xl mx-auto px-6">
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

          {tabFormId ? (
            <Button
              type="submit"
              form={tabFormId}
              variant="primary"
              size="sm"
            >
              Save & Continue
              <ArrowRight size={14} weight="bold" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => goTo(currentTab + 1)}
              disabled={isLastTab}
              variant="primary"
              size="sm"
              className={cn(isLastTab ? "cursor-not-allowed opacity-50" : "")}
            >
              Save & Continue
              <ArrowRight size={14} weight="bold" />
            </Button>
          )}
        </div>
      </footer>


    </div>
  );
}
