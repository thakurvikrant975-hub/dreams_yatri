"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  FloppyDiskIcon,
  PaperPlaneTiltIcon,
  CheckCircleIcon,
  ClockIcon,
  SealCheckIcon,
} from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/app/lib/utils";
import { HotelListingStatus, PropertySubType } from "@/app/generated/prisma";
import Button from "@/app/components/ui/Button";
import { submitForReview } from "./tabs/review-actions";

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
  { index: 7, label: "Finance & Legal" },
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
  effectiveWizardStep,
  hotelId,
}: {
  tab: (typeof WIZARD_TABS)[0];
  currentTab: number;
  effectiveWizardStep: number;
  hotelId: number;
}) {
  const isCurrent   = tab.index === currentTab;
  const isCompleted = tab.index <= effectiveWizardStep && !isCurrent;
  const isLocked    = tab.index > effectiveWizardStep + 1;

  const baseClass = cn(
    "relative flex-1 flex flex-col items-center gap-3 px-5 py-3.5 whitespace-nowrap transition-colors select-none",
    "after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:transition-colors",
    tab.index === 1 ? "rounded-tl-xl" : "",
    tab.index === WIZARD_TABS.length ? "rounded-tr-xl" : "",
    isCurrent
      ? "bg-white text-primary-500 after:absolute after:bottom-0 after:h-px after:w-full after:bg-white after:translate-y-px"
      : isCompleted
        ? "text-neutral-600 hover:text-neutral-800 hover:bg-neutral-50 after:bg-transparent hover:after:bg-neutral-200"
        : isLocked
          ? "text-neutral-400 bg-neutral-50 cursor-not-allowed after:bg-transparent"
          : "text-neutral-600 hover:text-neutral-800 bg-neutral-50 hover:bg-neutral-100 after:bg-transparent"
  );

  const indicator = (
    <span
      className={cn(
        "size-6 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 font-heading",
        isCurrent
          ? "bg-primary-500 text-white"
          : isCompleted
            ? "bg-emerald-500 text-white"
            : isLocked
              ? "bg-neutral-200 text-neutral-400"
              : "bg-white text-neutral-500/90 ring-1 ring-neutral-200 shadow shadow-neutral-300/80"
      )}
    >
      {isCompleted
        ? <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5-4.5-4.5 1.41-1.41L10 13.67l7.09-7.09L18.5 8l-8.5 8.5z"/></svg>
        : tab.index}
    </span>
  );

  const label = (
    <span className="text-xs font-semibold leading-none font-heading">{tab.label}</span>
  );

  if (isLocked) {
    return (
      <div className={baseClass} title="Complete previous steps to unlock" aria-disabled="true">
        {indicator}
        {label}
      </div>
    );
  }

  return (
    <Link href={`/hotel-connect/properties/${hotelId}/edit?tab=${tab.index}`} className={baseClass}>
      {indicator}
      {label}
    </Link>
  );
}

// ── Review status banner ──────────────────────────────────────────────────────

function ReviewBanner({ listing_status }: { listing_status: HotelListingStatus }) {
  if (listing_status === HotelListingStatus.SUBMITTED || listing_status === HotelListingStatus.UNDER_REVIEW) {
    const isUnderReview = listing_status === HotelListingStatus.UNDER_REVIEW;
    return (
      <div className="px-4 pt-5 pb-1 max-w-4xl mx-auto w-full">
        <div className="rounded-xl bg-blue-50 border border-blue-200 p-5">
          <div className="flex items-start gap-3 mb-5">
            <ClockIcon size={20} weight="fill" className="text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-900">
                {isUnderReview ? "Property Under Review" : "Property Submitted for Review"}
              </p>
              <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
                Our team will verify your property details and documents within{" "}
                <strong>1–2 business days</strong>. You&apos;ll receive an email once the review is complete.
              </p>
            </div>
          </div>
          {/* Timeline */}
          <div className="flex items-center gap-1.5">
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div className="size-7 rounded-full bg-blue-500 flex items-center justify-center">
                <CheckCircleIcon size={15} weight="fill" className="text-white" />
              </div>
              <span className="text-[10px] font-semibold text-blue-700 text-center leading-tight">Submitted</span>
            </div>
            <div className={cn("flex-1 h-px -mt-3.5", isUnderReview ? "bg-blue-400" : "bg-blue-200")} />
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div className={cn("size-7 rounded-full flex items-center justify-center", isUnderReview ? "bg-blue-500" : "bg-blue-100 ring-1 ring-blue-300")}>
                <ClockIcon size={15} weight="fill" className={isUnderReview ? "text-white" : "text-blue-400"} />
              </div>
              <span className={cn("text-[10px] font-semibold text-center leading-tight whitespace-nowrap", isUnderReview ? "text-blue-700" : "text-blue-400")}>Under Review</span>
            </div>
            <div className="flex-1 h-px -mt-3.5 bg-blue-100" />
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div className="size-7 rounded-full bg-neutral-100 ring-1 ring-neutral-200 flex items-center justify-center">
                <SealCheckIcon size={15} weight="fill" className="text-neutral-300" />
              </div>
              <span className="text-[10px] font-semibold text-neutral-400 text-center leading-tight whitespace-nowrap">Approved & Live</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (listing_status === HotelListingStatus.APPROVED || listing_status === HotelListingStatus.LIVE) {
    return (
      <div className="px-4 pt-5 pb-1 max-w-4xl mx-auto w-full">
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-5 flex items-center gap-3">
          <SealCheckIcon size={22} weight="fill" className="text-emerald-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">Property Approved & Live</p>
            <p className="text-xs text-emerald-600 mt-0.5">Your property is live and visible to travellers on Yatri.</p>
          </div>
        </div>
      </div>
    );
  }

  if (listing_status === HotelListingStatus.REJECTED) {
    return (
      <div className="px-4 pt-5 pb-1 max-w-4xl mx-auto w-full">
        <div className="rounded-xl bg-red-50 border border-red-200 p-5 flex items-center gap-3">
          <div className="size-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <span className="text-red-500 font-bold text-sm">✕</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-red-800">Review Rejected</p>
            <p className="text-xs text-red-600 mt-0.5">Please correct the flagged issues and resubmit your property for review.</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ── Main shell ────────────────────────────────────────────────────────────────

export default function WizardShell({
  hotel,
  currentTab,
  tabFormId,
  effectiveWizardStep,
  hideNextButton,
  children,
}: {
  hotel: HotelSummary;
  currentTab: number;
  tabFormId?: string;
  effectiveWizardStep: number;
  hideNextButton?: boolean;
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
  const allComplete = effectiveWizardStep >= WIZARD_TABS.length;
  const isDraft = hotel.listing_status === HotelListingStatus.DRAFT;

  return (
    <div className="flex flex-col h-full min-h-0 ">

      {/* ── Wizard header ─────────────────────────────────────────────── */}
      <header className="shrink-0 bg-white border-b border-neutral-200 px-4 h-14 flex items-center gap-3">
        <Link
          href="/hotel-connect/properties"
          className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 transition-colors shrink-0"
        >
          <ArrowLeftIcon size={14} weight="bold" />
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
          <FloppyDiskIcon size={14} />
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
                effectiveWizardStep={effectiveWizardStep}
                hotelId={hotel.id}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Scrollable content ────────────────────────────────────────── */}
      <div className="relative flex-1 overflow-y-auto bg-neutral-100 after:content-[''] after:absolute after:top-0 after:left-0 after:w-full after:h-25 after:bg-white after:border-b after:border-neutral-200 after:-z-10 isolate mb-6">
        <div className="max-w-4xl mx-auto w-full ">
          <ReviewBanner listing_status={hotel.listing_status} />
          {children}
        </div>
      </div>

      {/* ── Submit for Review strip ───────────────────────────────────── */}
      {allComplete && isDraft && (
        <div className="shrink-0 bg-emerald-50 border-t-2 border-emerald-200 px-6 py-3.5">
          <div className="flex items-center justify-between gap-6 max-w-4xl mx-auto">
            <div className="flex items-center gap-2.5 min-w-0">
              <CheckCircleIcon size={18} weight="fill" className="text-emerald-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-emerald-800 leading-none">All sections complete!</p>
                <p className="text-xs text-emerald-600 mt-0.5 truncate">Your property is ready to be submitted for review.</p>
              </div>
            </div>
            <form action={submitForReview.bind(null, hotel.id)}>
              <Button type="submit" variant="primary" size="sm" className="bg-emerald-500 hover:bg-emerald-600 border-emerald-500 hover:border-emerald-600 shrink-0">
                <PaperPlaneTiltIcon size={14} weight="bold" />
                Submit for Review
              </Button>
            </form>
          </div>
        </div>
      )}

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
            <ArrowLeftIcon size={14} weight="bold" />
            Previous
          </button>

          <p className="text-xs text-neutral-400 font-medium">
            Step {currentTab} of {WIZARD_TABS.length}
          </p>

          {hideNextButton ? (
            <div />
          ) : tabFormId ? (
            <Button
              type="submit"
              form={tabFormId}
              variant="primary"
              size="sm"
            >
              Save & Continue
              <ArrowRightIcon size={14} weight="bold" />
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
              <ArrowRightIcon size={14} weight="bold" />
            </Button>
          )}
        </div>
      </footer>


    </div>
  );
}
