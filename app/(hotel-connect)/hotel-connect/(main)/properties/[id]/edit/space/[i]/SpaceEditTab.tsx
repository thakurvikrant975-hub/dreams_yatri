"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon, CheckIcon, MinusIcon, PlusIcon, TrashIcon,
} from "@phosphor-icons/react/dist/ssr";
import { saveHomestaySpaceDetail, deleteHomestaySpace } from "../../tabs/homestay-rooms-crud-actions";
import { BED_TYPES } from "../../tabs/homestay-rooms-types";
import type { SpaceItem } from "../../tabs/homestay-rooms-types";
import SectionCard from "@/app/(hotel-connect)/hotel-connect/(main)/components/SectionCard";
import { cn } from "@/app/lib/utils";

// ── Space types that include a Sleeping Arrangement step ──────────────────────

const SLEEPING_SPACE_TYPES = new Set(["living_room", "helpers_room", "drivers_room"]);

// ── Amenity structure ─────────────────────────────────────────────────────────

type AmenityDetail =
  | { type: "radio";      label: string; options: string[] }
  | { type: "checkboxes"; label: string; options: string[] };

type Amenity = { key: string; label: string; detail?: AmenityDetail };

const AMENITY_CATEGORIES: { label: string; items: Amenity[] }[] = [
  {
    label: "Common Area",
    items: [
      { key: "sun_deck", label: "Sun Deck" },
    ],
  },
  {
    label: "Business Center & Conferences",
    items: [
      { key: "business_center", label: "Business Center" },
      { key: "conference_room", label: "Conference Room" },
    ],
  },
  {
    label: "Entertainment",
    items: [
      {
        key: "events", label: "Events",
        detail: {
          type: "checkboxes", label: "Event Types",
          options: [
            "Live Band", "Live Singer", "Live Ghazal", "Live Music",
            "Puppet Show", "Magic", "Fire Show", "Karaoke",
            "Movies", "DJ", "Stand-up Comedy", "Folk Dance",
          ],
        },
      },
    ],
  },
  {
    label: "Media & Technology",
    items: [
      {
        key: "tv", label: "TV",
        detail: {
          type: "checkboxes", label: "Type / Channels",
          options: [
            "LED", "LCD", "Flat Screen", "Cable", "Satellite Channels",
            "Pay Per View Movies", "Netflix", "Hotstar", "Other OTT",
            "Pay-Per-View Channels", "Regional Channels", "Limited Channels",
            "Smart TV", "Non-Smart LED TV", "Non-Smart LCD TV",
          ],
        },
      },
    ],
  },
  {
    label: "Spa & Wellness",
    items: [
      {
        key: "massage", label: "Massage",
        detail: { type: "radio", label: "Pricing", options: ["Free", "Paid"] },
      },
      {
        key: "salon", label: "Salon",
        detail: { type: "radio", label: "Pricing", options: ["Free", "Paid"] },
      },
      {
        key: "steam_and_sauna", label: "Steam and Sauna",
        detail: { type: "radio", label: "Pricing", options: ["Free", "Paid"] },
      },
    ],
  },
  {
    label: "Mandatory",
    items: [
      { key: "spa", label: "Spa" },
      {
        key: "kids_play_area", label: "Kids' Play Area",
        detail: { type: "radio", label: "Pricing", options: ["Free", "Paid"] },
      },
    ],
  },
];

// ── Stepper ───────────────────────────────────────────────────────────────────

function Stepper({ value, onChange, min = 0, max = 20 }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number;
}) {
  return (
    <div className="flex items-center shrink-0">
      <button
        type="button"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-7 h-7 rounded-l border border-neutral-300 flex items-center justify-center text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <MinusIcon size={11} weight="bold" />
      </button>
      <div className="w-10 h-7 border-t border-b border-neutral-300 flex items-center justify-center text-sm font-semibold text-neutral-800 bg-white">
        {String(value).padStart(2, "0")}
      </div>
      <button
        type="button"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="w-7 h-7 rounded-r border border-neutral-300 flex items-center justify-center text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <PlusIcon size={11} weight="bold" />
      </button>
    </div>
  );
}

// ── Step accordion ────────────────────────────────────────────────────────────

function StepSection({
  index, label, subtitle, isActive, isCompleted, canOpen, onOpen, children,
}: {
  index: number; label: string; subtitle: string;
  isActive: boolean; isCompleted: boolean; canOpen: boolean;
  onOpen: () => void; children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3.5">
      <div className="flex flex-col items-center shrink-0">
        <button
          type="button"
          disabled={!canOpen && !isActive}
          onClick={canOpen ? onOpen : undefined}
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors shrink-0",
            isCompleted && !isActive
              ? "bg-emerald-500 text-white cursor-pointer"
              : isActive
                ? "bg-primary-600 text-white ring-2 ring-primary-200"
                : "bg-neutral-200 text-neutral-500 cursor-not-allowed"
          )}
        >
          {isCompleted && !isActive ? <CheckIcon size={12} weight="bold" /> : index}
        </button>
        <div className="flex-1 w-px bg-neutral-200 mt-1.5" />
      </div>

      <div className="flex-1 min-w-0 mb-3">
        <button
          type="button"
          disabled={!canOpen && !isActive}
          onClick={canOpen ? onOpen : undefined}
          className="w-full flex items-center justify-between gap-3 text-left"
        >
          <div>
            <p className={cn(
              "text-sm font-semibold",
              isActive ? "text-neutral-900" : isCompleted ? "text-neutral-700" : "text-neutral-400"
            )}>
              {label}
            </p>
            {isActive && <p className="text-xs text-neutral-400 mt-0.5">{subtitle}</p>}
          </div>
          {isCompleted && !isActive && (
            <span className="text-xs font-medium text-primary-600 shrink-0">Edit</span>
          )}
        </button>

        {isActive && (
          <div className="mt-4 bg-white border border-neutral-200 rounded-xl overflow-hidden">
            <div className="p-5 space-y-5">
              {children}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SpaceEditTab({
  hotelId, idx, item,
}: {
  hotelId: number; idx: number; item: SpaceItem;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const hasSleepingStep = SLEEPING_SPACE_TYPES.has(item.space_type);
  const S_SLEEPING  = hasSleepingStep ? 2 : -1;
  const S_AMENITIES = hasSleepingStep ? 3 : 2;

  const [stepReached, setStepReached] = useState(item.step_reached ?? 0);
  const [currentStep, setCurrentStep] = useState(
    item.step_reached >= S_AMENITIES ? 1 : Math.min((item.step_reached ?? 0) + 1, S_AMENITIES)
  );

  // Step 1 — Access Info
  const [accessType, setAccessType] = useState(item.access_type || "");

  // Step 2 — Sleeping Arrangement (sleeping spaces only)
  const [beds, setBeds]             = useState<Record<string, number>>(item.beds ?? {});
  const [baseAdults, setBaseAdults] = useState(item.base_adults ?? 1);
  const [maxAdults, setMaxAdults]   = useState(item.max_adults ?? 2);

  // Step S_AMENITIES — Amenities
  const [amenities, setAmenities]           = useState<string[]>(item.amenities ?? []);
  const [amenityDetails, setAmenityDetails] = useState<Record<string, string | string[]>>(
    item.amenity_details ?? {}
  );

  // ── Helpers ───────────────────────────────────────────────────────────────────

  function setBedCount(key: string, count: number) {
    setBeds(prev => {
      const next = { ...prev };
      if (count <= 0) delete next[key];
      else next[key] = count;
      return next;
    });
  }

  function toggleAmenity(key: string) {
    setAmenities(prev => {
      if (prev.includes(key)) {
        setAmenityDetails(d => { const n = { ...d }; delete n[key]; return n; });
        return prev.filter(k => k !== key);
      }
      return [...prev, key];
    });
  }

  function setRadioDetail(key: string, value: string) {
    setAmenityDetails(prev => ({ ...prev, [key]: value }));
  }

  function toggleCheckboxDetail(key: string, opt: string) {
    setAmenityDetails(prev => {
      const current = (prev[key] as string[] | undefined) ?? [];
      const next = current.includes(opt) ? current.filter(o => o !== opt) : [...current, opt];
      return { ...prev, [key]: next };
    });
  }

  function save(patch: Partial<SpaceItem>, completingStep: number, nextStep: number | "back") {
    const newReached = Math.max(stepReached, completingStep);
    startTransition(async () => {
      await saveHomestaySpaceDetail(hotelId, idx, { ...patch, step_reached: newReached });
    });
    setStepReached(newReached);
    if (nextStep === "back") {
      router.push(`/hotel-connect/properties/${hotelId}/edit?tab=3`);
    } else {
      setCurrentStep(nextStep);
    }
  }

  function handleDeactivate() {
    startTransition(async () => {
      await deleteHomestaySpace(hotelId, idx);
      router.push(`/hotel-connect/properties/${hotelId}/edit?tab=3`);
    });
  }

  function openStep(s: number) {
    if (stepReached >= s - 1 || s === 1) setCurrentStep(s);
  }

  const accessOptions = [
    {
      key: `Private ${item.label}`,
      desc: `Guests will have private access to the ${item.label} space & amenities`,
    },
    {
      key: `Shared ${item.label}`,
      desc: `Guests will have to share the ${item.label} & amenities with other guests.`,
    },
  ];

  return (
    <div>
      <SectionCard
        title={`${item.label} ${item.instance}`}
        headerAction={
          <button
            type="button"
            onClick={handleDeactivate}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
          >
            <TrashIcon size={14} weight="fill" />
            Deactivate Space
          </button>
        }
      >
        <Link
          href={`/hotel-connect/properties/${hotelId}/edit?tab=3`}
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 transition-colors"
        >
          <ArrowLeftIcon size={13} weight="bold" />
          Back to Rooms &amp; Spaces
        </Link>

        <div>
          {/* ── Step 1: Access Info ────────────────────────────────── */}
          <StepSection
            index={1}
            label="Access Info"
            subtitle={`Add details about the ${item.label} ${item.instance} and specify if the guests will have access to it or not`}
            isActive={currentStep === 1} isCompleted={stepReached >= 1} canOpen={true}
            onOpen={() => openStep(1)}
          >
            <div className="space-y-2">
              <p className="text-sm font-semibold text-neutral-800">Type of Access for the {item.label}</p>
              <p className="text-xs text-neutral-400">
                Please specify if the access to the {item.label} is private or shared for guests
              </p>
              <div className="space-y-2 pt-1">
                {accessOptions.map(opt => (
                  <label
                    key={opt.key}
                    className={cn(
                      "flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors",
                      accessType === opt.key
                        ? "border-primary-400 bg-primary-50"
                        : "border-neutral-200 hover:border-neutral-300 bg-white"
                    )}
                  >
                    <input
                      type="radio"
                      name="space-access-type"
                      checked={accessType === opt.key}
                      onChange={() => setAccessType(opt.key)}
                      className="mt-0.5 h-4 w-4 accent-primary-500 cursor-pointer shrink-0"
                    />
                    <div>
                      <p className="text-sm font-medium text-neutral-800">{opt.key}</p>
                      <p className="text-xs text-neutral-500 mt-0.5">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={isPending || !accessType}
              onClick={() => save({ access_type: accessType }, 1, hasSleepingStep ? 2 : S_AMENITIES)}
              className="px-5 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </StepSection>

          {/* ── Step 2: Sleeping Arrangement (sleeping spaces only) ── */}
          {hasSleepingStep && (
            <StepSection
              index={2}
              label="Sleeping Arrangement"
              subtitle={`Specify the bed types and occupancy details for ${item.label} ${item.instance}`}
              isActive={currentStep === S_SLEEPING} isCompleted={stepReached >= S_SLEEPING} canOpen={stepReached >= 1}
              onOpen={() => openStep(S_SLEEPING)}
            >
              <div>
                <p className="text-sm font-semibold text-neutral-800 mb-0.5">Bed Options</p>
                <p className="text-xs text-neutral-400 mb-3">
                  Specify the number of each bed type available in this space
                </p>
                <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-xl overflow-hidden">
                  {BED_TYPES.map(bed => (
                    <div key={bed.key} className="flex items-center justify-between gap-3 px-4 py-3 bg-white">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-neutral-800">{bed.label}</p>
                        <p className="text-xs text-neutral-400">{bed.size}</p>
                      </div>
                      <Stepper
                        value={beds[bed.key] ?? 0}
                        onChange={v => setBedCount(bed.key, v)}
                        min={0}
                        max={10}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-neutral-100">
                <p className="text-sm font-semibold text-neutral-800 mb-3">Occupancy</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4 border border-neutral-200 rounded-lg px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-neutral-800">Base Adults</p>
                      <p className="text-xs text-neutral-400">Ideal number of adults that can be accommodated</p>
                    </div>
                    <Stepper
                      value={baseAdults}
                      onChange={v => { setBaseAdults(v); if (maxAdults < v) setMaxAdults(v); }}
                      min={1}
                      max={20}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4 border border-neutral-200 rounded-lg px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-neutral-800">Maximum Adults</p>
                      <p className="text-xs text-neutral-400">Maximum number of adults that can be accommodated</p>
                    </div>
                    <Stepper
                      value={maxAdults}
                      onChange={v => setMaxAdults(Math.max(baseAdults, v))}
                      min={1}
                      max={20}
                    />
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={isPending}
                onClick={() => save({ beds, base_adults: baseAdults, max_adults: maxAdults }, S_SLEEPING, S_AMENITIES)}
                className="px-5 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                Next
              </button>
            </StepSection>
          )}

          {/* ── Step S_AMENITIES: Amenities (final step) ────────────── */}
          <StepSection
            index={S_AMENITIES}
            label="Amenities"
            subtitle={`Add the amenities and facilities available in ${item.label} ${item.instance}`}
            isActive={currentStep === S_AMENITIES}
            isCompleted={stepReached >= S_AMENITIES}
            canOpen={stepReached >= S_AMENITIES - 1}
            onOpen={() => openStep(S_AMENITIES)}
          >
            <div className="space-y-6">
              {AMENITY_CATEGORIES.map(cat => {
                const selectedWithDetail = cat.items.filter(
                  a => a.detail && amenities.includes(a.key)
                );
                return (
                  <div key={cat.label}>
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
                      {cat.label}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {cat.items.map(a => (
                        <button
                          key={a.key}
                          type="button"
                          onClick={() => toggleAmenity(a.key)}
                          className={cn(
                            "px-3 py-1.5 text-xs font-medium rounded-full border transition-colors",
                            amenities.includes(a.key)
                              ? "bg-primary-500 text-white border-primary-500"
                              : "bg-white text-neutral-600 border-neutral-300 hover:border-primary-400"
                          )}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>

                    {selectedWithDetail.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {selectedWithDetail.map(a => {
                          const def = a.detail!;
                          const currentVal = amenityDetails[a.key];
                          return (
                            <div key={a.key} className="border border-neutral-200 rounded-lg p-3 bg-neutral-50">
                              <p className="text-xs font-semibold text-neutral-700 mb-2">
                                {a.label} — {def.label}
                              </p>
                              {def.type === "radio" ? (
                                <div className="flex flex-wrap gap-2">
                                  {def.options.map(opt => (
                                    <button
                                      key={opt}
                                      type="button"
                                      onClick={() => setRadioDetail(a.key, opt)}
                                      className={cn(
                                        "px-3 py-1 text-xs font-medium rounded-full border transition-colors",
                                        currentVal === opt
                                          ? "bg-primary-500 text-white border-primary-500"
                                          : "bg-white text-neutral-600 border-neutral-300 hover:border-primary-400"
                                      )}
                                    >
                                      {opt}
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {def.options.map(opt => {
                                    const checked = Array.isArray(currentVal) && currentVal.includes(opt);
                                    return (
                                      <button
                                        key={opt}
                                        type="button"
                                        onClick={() => toggleCheckboxDetail(a.key, opt)}
                                        className={cn(
                                          "px-3 py-1 text-xs font-medium rounded-full border transition-colors",
                                          checked
                                            ? "bg-primary-500 text-white border-primary-500"
                                            : "bg-white text-neutral-600 border-neutral-300 hover:border-primary-400"
                                        )}
                                      >
                                        {opt}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              disabled={isPending}
              onClick={() => save(
                { amenities, amenity_details: amenityDetails, details_added: true },
                S_AMENITIES, "back"
              )}
              className="px-5 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? "Saving…" : "Save & Continue"}
            </button>
          </StepSection>
        </div>
      </SectionCard>
    </div>
  );
}
