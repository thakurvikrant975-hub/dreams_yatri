"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Package Builder — shared state access
//
// The builder is one very large client component (page.tsx) that owns a single
// `form` object. Historically the only way to edit anything was to thread a
// callback down through it, which is why every control lives in the right-hand
// panel: that's where the props already were.
//
// This context makes the same state reachable from anywhere without threading
// — specifically from inside the *preview document*, so an exec can edit the
// itinerary by clicking the thing they want to change instead of hunting for
// its field in a six-tab form.
//
// Deliberately additive. It exposes the identical `form` / `setForm` pair the
// page already uses rather than converting to a reducer, so:
//
//   • every existing setForm call site keeps working, untouched;
//   • the save payload and the pricing effects' dependency keys are byte-for-
//     byte what they were, which is the property that keeps costing correct
//     (both pricing effects are pure functions of `form` — nothing downstream
//     knows or cares which control caused a change).
//
// A reducer is still the right end state (it's what makes undo/redo cheap),
// but that's a mechanical follow-up once the edit surfaces exist, and doing it
// first would have meant rewriting ~40 call sites before shipping anything.
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type {
  StopInput, DayItinerary, TicketInput, AddonInput, ExtraPolicyItems,
} from "../action";
import type { PolicySection } from "@/app/(dashboard)/dashboard/(main)/itinerary-settings/actions";

// ─────────────────────────────────────────────────────────────────────────────
// Form state
// ─────────────────────────────────────────────────────────────────────────────

export interface PackageForm {
  title: string;
  description: string;
  coverImage: string;
  /** Vertical focal point for the cover image's object-position (0 = top,
   * 50 = center, 100 = bottom) — lets an awkwardly-cropped photo be
   * re-centered without re-uploading it. */
  coverImagePosition: number;
  destination: string;
  startingPoint: string;
  totalDays: number;
  totalNights: number;
  travelDate: string;
  adults: number;
  children: number;
  infants: number;
  /** Index-aligned with children/infants above — see the schema comment on
   * custom_packages.childrenAges. Resized (padded/truncated) automatically
   * whenever the count input changes, see the Travellers section handler. */
  childrenAges: number[];
  infantAges: number[];
  pricePerPerson: string;
  totalPrice: string;
  marginPercentage: string;
  gstPercentage: string;
  currency: string;
  inclusions: string[];
  exclusions: string[];
  /** Read-only — costing's per-package removals of standard/added inclusion
   * and exclusion lines (see custom_packages.removedInclusions), hydrated
   * from the saved package and applied when building previewForm below.
   * Never sent back by saveCustomPackage. */
  removedInclusions: string[];
  removedExclusions: string[];
  termsNotes: string;
  termsConditions: string[];
  paymentPolicy: string[];
  amendmentPolicy: string[];
  travelBenefits: string[];
  customPolicySections: PolicySection[];
  /** Per-package additions to the six standard lists above — anyone
   * (including a Sales Executive, who can't touch the standard lists
   * themselves) can add/remove these. See ExtraPolicyItems. */
  extraPolicyItems: ExtraPolicyItems;
  stops: StopInput[];
  itineraries: DayItinerary[];
  /** Each row is one flight or train leg (onward, return, connecting…) —
   * flightsIncluded/flightFrom/etc are derived from this list at save/preview
   * time (see deriveTransportFields) instead of being separately toggled. */
  tickets: TicketInput[];
  /** Priced add-ons — honeymoon kit, permits, etc. Subtotal (price × qty)
   * feeds into computeFinalPricing at the standard (25% default) margin. */
  addOns: AddonInput[];
  execName: string;
  execEmail: string;
  execDesignation: string;
}

export type SetPackageForm = React.Dispatch<React.SetStateAction<PackageForm>>;

// ─────────────────────────────────────────────────────────────────────────────
// Drawers
//
// Each variant is one task an exec can be in the middle of — never a general
// "edit this day" panel. That's the whole point: the right-hand form is hard
// to work in because everything is visible at once, so a drawer that opens
// with six unrelated fieldsets would just reproduce the problem in a narrower
// column.
// ─────────────────────────────────────────────────────────────────────────────

export type DrawerTarget =
  /** Swap the day's hotel for another nearby one. */
  | { kind: "hotel-replace"; day: number }
  /** Edit what an exec is allowed to change about the picked room — rooms
   * needed, meal plan, check-in/out — never catalog data. */
  | { kind: "hotel-edit"; day: number }
  /** Choose the vehicle covering this day, and the route it covers. */
  | { kind: "transfer-edit"; day: number }
  /** Add, reorder, edit and remove the day's experiences. */
  | { kind: "activities-edit"; day: number };

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

type BuilderContextValue = {
  form: PackageForm;
  setForm: SetPackageForm;
  /** False once the package is locked for costing review (status READY) or
   * the viewer otherwise may not edit. Every edit surface must gate on this —
   * see useCanEdit. */
  canEdit: boolean;
  /** Currently-open drawer, or null. */
  drawer: DrawerTarget | null;
  openDrawer: (target: DrawerTarget) => void;
  closeDrawer: () => void;
  /** Replaces one day in `form.itineraries`, matched by its `day` number.
   * Every day-level edit surface goes through this rather than reaching into
   * the array itself, so the update shape stays identical no matter which
   * control made it. */
  updateDay: (day: number, patch: Partial<DayItinerary>) => void;
};

const BuilderContext = createContext<BuilderContextValue | null>(null);

export function PackageBuilderProvider({
  form, setForm, canEdit, children,
}: {
  form: PackageForm;
  setForm: SetPackageForm;
  canEdit: boolean;
  children: ReactNode;
}) {
  const [drawer, setDrawer] = useState<DrawerTarget | null>(null);

  const value = useMemo<BuilderContextValue>(() => ({
    form,
    setForm,
    canEdit,
    drawer,
    openDrawer: (target) => setDrawer(target),
    closeDrawer: () => setDrawer(null),
    updateDay: (day, patch) => setForm((f) => ({
      ...f,
      itineraries: f.itineraries.map((it) => (it.day === day ? { ...it, ...patch } : it)),
    })),
  }), [form, setForm, canEdit, drawer]);

  return <BuilderContext.Provider value={value}>{children}</BuilderContext.Provider>;
}

/** Throws outside the provider — a silent null here would show up as an edit
 * that appears to work and then doesn't persist, which is far worse to debug
 * than a crash at mount. */
export function useBuilder(): BuilderContextValue {
  const ctx = useContext(BuilderContext);
  if (!ctx) throw new Error("useBuilder must be used inside <PackageBuilderProvider>");
  return ctx;
}

/** Null outside the provider, instead of throwing.
 *
 * This exists for the preview document specifically. ItineraryDocument is
 * rendered in two places: inside the builder (editable) and on the public
 * client-facing package page (definitely not). Components shared by both ask
 * for the builder this way and simply render static text when there isn't one,
 * so the editing affordances can live in the document without leaking onto the
 * website. */
export function useOptionalBuilder(): BuilderContextValue | null {
  return useContext(BuilderContext);
}

// ─────────────────────────────────────────────────────────────────────────────
// Editable text fields
// ─────────────────────────────────────────────────────────────────────────────

/** Addresses one editable piece of text in the document.
 *
 * Generalises the same idea as ImageEditTarget in ItineraryDocument — one
 * descriptor that names any editable node, so a single write path can serve
 * all of them rather than each field needing its own callback threaded down
 * from page.tsx. */
export type EditableField =
  | { scope: "package"; key: "title" | "description" }
  | { scope: "day"; day: number; key: "title" | "description" | "notes" }
  | { scope: "activity"; day: number; index: number; key: "title" | "description" };

/** The one place a text edit turns into new form state.
 *
 * Pure and exported so it can be reasoned about (and tested) on its own —
 * every inline editor in the preview funnels through here, which is what keeps
 * "edited in the preview" and "edited in the right-hand panel" from becoming
 * two different code paths that can drift apart. */
export function applyFieldEdit(
  form: PackageForm,
  field: EditableField,
  value: string,
): PackageForm {
  switch (field.scope) {
    case "package":
      return { ...form, [field.key]: value };

    case "day":
      return {
        ...form,
        itineraries: form.itineraries.map((it) =>
          it.day === field.day ? { ...it, [field.key]: value } : it,
        ),
      };

    case "activity":
      return {
        ...form,
        itineraries: form.itineraries.map((it) =>
          it.day === field.day
            ? {
                ...it,
                activities: it.activities.map((a, i) =>
                  i === field.index ? { ...a, [field.key]: value } : a,
                ),
              }
            : it,
        ),
      };
  }
}

/** The single answer to "may this person change this package right now".
 *
 * Today that is exactly one condition (the package isn't locked for costing
 * review), matching what page.tsx has always done by passing `undefined`
 * callbacks when `isLocked`. Centralising it matters because the failure mode
 * is silent: a new edit surface that simply forgets to check would let someone
 * edit a package that costing is mid-review on, and nothing would look wrong.
 *
 * NOTE for whoever adds per-field permissions: the role check elsewhere in the
 * builder (`isSalesExecutive`) is a string comparison against TeamRole.name.
 * The TeamRole model already carries a `permissions` JSON column that nothing
 * here consults. Wiring real permissions in should happen *here*, once, rather
 * than by adding more name comparisons at each call site. */
export function useCanEdit(): boolean {
  return useBuilder().canEdit;
}

/** Read one day out of form state by its day number. */
export function useDay(day: number): DayItinerary | undefined {
  const { form } = useBuilder();
  return form.itineraries.find((it) => it.day === day);
}

/** Non-hook variant of the same lookup, for use inside callbacks. */
export function findDay(form: PackageForm, day: number): DayItinerary | undefined {
  return form.itineraries.find((it) => it.day === day);
}
