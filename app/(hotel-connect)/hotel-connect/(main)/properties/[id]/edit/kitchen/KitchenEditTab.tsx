"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, CheckIcon } from "@phosphor-icons/react/dist/ssr";
import { saveHomestayKitchenDetail } from "../tabs/homestay-rooms-crud-actions";
import type { KitchenDetail } from "../tabs/homestay-rooms-types";
import SectionCard from "@/app/(hotel-connect)/hotel-connect/(main)/components/SectionCard";
import { SearchSelect } from "@/app/(hotel-connect)/hotel-connect/(main)/components/ui/search-select";
import { cn } from "@/app/lib/utils";

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCESS_OPTIONS = [
  { key: "Private Kitchen", desc: "Guests will have private access to the kitchen space & amenities" },
  { key: "Shared Kitchen",  desc: "Guests will have to share the kitchen & amenities with other guests." },
];

const MEAL_TYPES = [
  "All types of meals",
  "Vegetarian only",
  "Vegan only",
  "Non-vegetarian only",
  "Snacks & beverages only",
];

const STAFF_HELP_OPTIONS = [
  "Dishwashing",
  "Purchasing Groceries",
  "Cooking Assistance",
  "Serving meals",
];

type DetailDef =
  | { type: "radio";      label: string; options: string[] }
  | { type: "checkboxes"; label: string; options: string[] };

type Appliance = { key: string; label: string; detail?: DetailDef };

const KITCHEN_APPLIANCES: Appliance[] = [
  {
    key: "stove_induction",
    label: "Stove / Induction",
    detail: { type: "radio", label: "Fuel type", options: ["LPG", "Electric", "Piped Gas"] },
  },
  {
    key: "dishwasher",
    label: "Dishwasher",
    detail: { type: "radio", label: "Usage", options: ["Free", "Paid"] },
  },
  { key: "induction",                label: "Induction" },
  { key: "refrigerator",             label: "Refrigerator" },
  {
    key: "cooking_basics",
    label: "Cooking Basics",
    detail: {
      type: "checkboxes",
      label: "Includes",
      options: ["Pots", "Pans", "Cooking Oil", "Cooker", "Dishes", "Silverware", "Salt & Pepper", "Seasoning", "Tableware", "Microwave Oven"],
    },
  },
  { key: "coffee_machine",           label: "Coffee Machine" },
  { key: "toaster",                  label: "Toaster" },
  { key: "microwave",                label: "Microwave" },
  { key: "rice_cooker",              label: "Rice Cooker" },
  { key: "carbon_monoxide_detector", label: "Carbon Monoxide Detector" },
  { key: "cooking_glass",            label: "Cooking Glass" },
];

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
                ? "bg-primary-500 text-white ring-2 ring-primary-200"
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
          className={cn("w-full flex items-center justify-between gap-3 text-left", !isActive && "mb-0")}
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
          <div className="mt-4  rounded-xl overflow-hidden">
            <div className="px-5 space-y-5">
              {children}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function KitchenEditTab({
  hotelId, detail,
}: {
  hotelId: number; detail: KitchenDetail;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [stepReached, setStepReached] = useState(detail.step_reached ?? 0);
  const [currentStep, setCurrentStep] = useState(
    detail.step_reached >= 2 ? 1 : Math.min((detail.step_reached ?? 0) + 1, 2)
  );

  // Step 1 — Access & Restrictions
  const [isAccessible, setIsAccessible] = useState(detail.is_accessible ?? true);
  const [type, setType]           = useState(detail.type || "");
  const [mealTypes, setMealTypes] = useState(detail.meal_types || "");
  const [staffHelp, setStaffHelp] = useState<string[]>(detail.staff_help ?? []);

  // Step 2 — Amenities
  const [appliances, setAppliances]           = useState<string[]>(detail.appliances ?? []);
  const [applianceDetails, setApplianceDetails] = useState<Record<string, string | string[]>>(detail.appliance_details ?? {});
  const [description, setDescription]         = useState(detail.description ?? "");

  function toggleStaffHelp(opt: string) {
    setStaffHelp(prev => prev.includes(opt) ? prev.filter(x => x !== opt) : [...prev, opt]);
  }
  function toggleAppliance(key: string) {
    setAppliances(prev => {
      if (prev.includes(key)) {
        setApplianceDetails(d => { const n = { ...d }; delete n[key]; return n; });
        return prev.filter(x => x !== key);
      }
      return [...prev, key];
    });
  }
  function setRadioDetail(key: string, value: string) {
    setApplianceDetails(prev => ({ ...prev, [key]: value }));
  }
  function toggleCheckboxDetail(key: string, opt: string) {
    setApplianceDetails(prev => {
      const cur = (prev[key] as string[] | undefined) ?? [];
      return { ...prev, [key]: cur.includes(opt) ? cur.filter(x => x !== opt) : [...cur, opt] };
    });
  }

  function save(patch: Partial<KitchenDetail>, completingStep: number, nextStep: number | "back") {
    const newReached = Math.max(stepReached, completingStep);
    startTransition(async () => {
      await saveHomestayKitchenDetail(hotelId, { ...patch, step_reached: newReached });
    });
    setStepReached(newReached);
    if (nextStep === "back") {
      router.push(`/hotel-connect/properties/${hotelId}/edit?tab=4`);
    } else {
      setCurrentStep(nextStep);
    }
  }

  function openStep(s: number) {
    if (stepReached >= s - 1 || s === 1) setCurrentStep(s);
  }

  const STEPS = [
    {
      index: 1,
      label: "Kitchen Access & Restrictions for Guests",
      subtitle: "Add the room name and if the guests can access it",
    },
    {
      index: 2,
      label: "Amenities",
      subtitle: "Add the kitchen appliances and equipment available for guests",
    },
  ];

  return (
    <div>
      <SectionCard title="Kitchen Details" desc="Describe the kitchen type, guest access, and available amenities.">
        <Link
          href={`/hotel-connect/properties/${hotelId}/edit?tab=4`}
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 transition-colors"
        >
          <ArrowLeftIcon size={13} weight="bold" />
          Back to Rooms &amp; Spaces
        </Link>

        <div>
          {/* ── Step 1: Access & Restrictions ─────────────────────── */}
          <StepSection
            {...STEPS[0]}
            isActive={currentStep === 1} isCompleted={stepReached >= 1} canOpen={true}
            onOpen={() => openStep(1)}
          >
            {/* Guest access yes/no */}
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-neutral-100">
              <p className="text-sm font-medium text-neutral-800">
                Do guests have access to the kitchen to cook their meals?
              </p>
              <div className="flex items-center gap-1 border border-neutral-300 rounded-full p-0.5 bg-neutral-50 shrink-0">
                {([false, true] as const).map(opt => (
                  <button
                    key={String(opt)}
                    type="button"
                    onClick={() => setIsAccessible(opt)}
                    className={cn(
                      "px-4 py-1 text-sm rounded-full font-medium transition-colors",
                      isAccessible === opt
                        ? "bg-primary-600 text-white"
                        : "text-neutral-600 hover:text-neutral-800"
                    )}
                  >
                    {opt ? "Yes" : "No"}
                  </button>
                ))}
              </div>
            </div>

            {/* Access type radio cards */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-neutral-800">Type of Access for the Kitchen</p>
              <p className="text-xs text-neutral-400">
                Please specify if the access to the kitchen is private or shared for guests
              </p>
              <div className="space-y-2 pt-1">
                {ACCESS_OPTIONS.map(opt => (
                  <label
                    key={opt.key}
                    className={cn(
                      "flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors",
                      type === opt.key
                        ? "border-primary-400 bg-primary-50"
                        : "border-neutral-200 hover:border-neutral-300 bg-white"
                    )}
                  >
                    <input
                      type="radio"
                      name="kitchen-access-type"
                      checked={type === opt.key}
                      onChange={() => setType(opt.key)}
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

            {/* Meal types */}
            <div className="border-t border-neutral-100 pt-4">
              <label
                htmlFor="kitchen-meal-types"
                className="block text-sm font-semibold text-neutral-800 mb-2"
              >
                What type of meals can guests prepare in the kitchen?
              </label>
              <SearchSelect
                name="kitchen-meal-types"
                value={mealTypes}
                onChange={setMealTypes}
                options={MEAL_TYPES}
                placeholder="Select meal type"
                showSearch={false}
              />
            </div>

            {/* Staff help */}
            <div className="border-t border-neutral-100 pt-4">
              <p className="text-sm font-semibold text-neutral-800">
                Property Staff Will Help With:{" "}
                <span className="font-normal text-neutral-400">(Optional)</span>
              </p>
              <p className="text-xs text-neutral-400 mb-3 mt-0.5">Select the relevant options</p>
              <div className="flex flex-wrap gap-2">
                {STAFF_HELP_OPTIONS.map(opt => (
                  <label
                    key={opt}
                    className={cn(
                      "flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-sm cursor-pointer transition-colors select-none",
                      staffHelp.includes(opt)
                        ? "bg-primary-50 border-primary-400 text-primary-700"
                        : "bg-white border-neutral-300 text-neutral-600 hover:border-neutral-400"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={staffHelp.includes(opt)}
                      onChange={() => toggleStaffHelp(opt)}
                      className="h-3.5 w-3.5 accent-primary-500 cursor-pointer"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={isPending || !type}
              onClick={() => save(
                { is_accessible: isAccessible, type, meal_types: mealTypes, staff_help: staffHelp },
                1, 2
              )}
              className="px-5 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </StepSection>

          {/* ── Step 2: Amenities ──────────────────────────────────── */}
          <StepSection
            {...STEPS[1]}
            isActive={currentStep === 2} isCompleted={stepReached >= 2} canOpen={stepReached >= 1}
            onOpen={() => openStep(2)}
          >
            {/* Appliances */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-neutral-700">
                Appliances &amp; Equipment
              </label>
              <div className="flex flex-wrap gap-2">
                {KITCHEN_APPLIANCES.map(a => (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => toggleAppliance(a.key)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-full border transition-colors",
                      appliances.includes(a.key)
                        ? "bg-primary-500 text-white border-primary-500"
                        : "bg-white text-neutral-600 border-neutral-300 hover:border-primary-400"
                    )}
                  >
                    {a.label}
                  </button>
                ))}
              </div>

              {/* Inline detail forms for selected appliances that have sub-options */}
              {KITCHEN_APPLIANCES.filter(a => a.detail && appliances.includes(a.key)).map(a => (
                <div key={`detail-${a.key}`} className="border border-neutral-200 rounded-xl p-4 bg-neutral-50">
                  <p className="text-xs font-semibold text-neutral-700 mb-2.5">
                    {a.label} — {a.detail!.label}
                  </p>
                  {a.detail!.type === "radio" && (
                    <div className="flex flex-wrap gap-2">
                      {a.detail!.options.map(opt => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setRadioDetail(a.key, opt)}
                          className={cn(
                            "px-3 py-1.5 text-xs font-medium rounded-full border transition-colors",
                            (applianceDetails[a.key] as string | undefined) === opt
                              ? "bg-primary-500 text-white border-primary-500"
                              : "bg-white text-neutral-600 border-neutral-300 hover:border-primary-400"
                          )}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                  {a.detail!.type === "checkboxes" && (
                    <div className="flex flex-wrap gap-2">
                      {a.detail!.options.map(opt => {
                        const selected = ((applianceDetails[a.key] as string[] | undefined) ?? []).includes(opt);
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => toggleCheckboxDetail(a.key, opt)}
                            className={cn(
                              "px-3 py-1.5 text-xs font-medium rounded-full border transition-colors",
                              selected
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
              ))}
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                Description <span className="font-normal text-neutral-400">(Optional)</span>
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value.slice(0, 300))}
                rows={3}
                placeholder="Describe the kitchen facilities available for guests…"
                className="w-full px-3 py-2.5 text-sm border border-neutral-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
              <p className="text-right text-xs text-neutral-400 mt-0.5">{description.length} of 300</p>
            </div>

            <button
              type="button"
              disabled={isPending}
              onClick={() => save({ appliances, appliance_details: applianceDetails, description }, 2, "back")}
              className="px-5 py-2 text-sm font-semibold text-white bg-primary-500 rounded-lg hover:bg-primary-600 disabled:opacity-50 transition-colors"
            >
              {isPending ? "Saving…" : "Save & Continue"}
            </button>
          </StepSection>
        </div>
      </SectionCard>
    </div>
  );
}
