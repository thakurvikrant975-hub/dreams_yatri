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
import { invalidateStaleOverrides, emptyDay } from "./day-mutations";
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
  | { kind: "activities-edit"; day: number }
  /** Which meals this day includes. */
  | { kind: "meals-edit"; day: number }
  /** Priced add-ons. `day` scopes them to one day (they render under that
   * day's stay); null is a package-level add-on. */
  | { kind: "addons-edit"; day: number | null }
  /** Flight / train / helicopter legs — package-level, never day-scoped. */
  | { kind: "tickets-edit" }
  /** Ask the hotel team to source a stay for this day. */
  | { kind: "hotel-request"; day: number }
  /** The day's note — title, body and tone. */
  | { kind: "note-edit"; day: number };

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
  /** Patches one day in `form.itineraries`, matched by its `day` number. */
  updateDay: (day: number, patch: Partial<DayItinerary>) => void;
  /** Same, for an edit that needs the previous day to compute the next one
   * (picking a hotel, reordering activities). Both go through replaceDay
   * below, so no edit surface can skip the override invalidation. */
  replaceDay: (day: number, fn: (day: DayItinerary) => DayItinerary) => void;
  /** Inserts a blank day after this one, renumbering the rest. */
  addDayAfter: (day: number) => void;
  /** Deletes a day and everything on it, renumbering the rest. */
  removeDay: (day: number) => void;
};

/** The one way a day changes.
 *
 * Applies the caller's edit, then drops any costing correction that no longer
 * matches what's selected — see invalidateStaleOverrides. Keeping that here
 * rather than at each call site is the difference between "every surface
 * invalidates" and "every surface remembers to invalidate". */
function replaceDay(
  form: PackageForm,
  day: number,
  fn: (day: DayItinerary) => DayItinerary,
): PackageForm {
  return {
    ...form,
    itineraries: form.itineraries.map((it) =>
      it.day === day ? invalidateStaleOverrides(it, fn(it)) : it,
    ),
  };
}

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
    updateDay: (day, patch) => setForm((f) => replaceDay(f, day, (it) => ({ ...it, ...patch }))),
    replaceDay: (day, fn) => setForm((f) => replaceDay(f, day, fn)),
    addDayAfter: (day) => setForm((f) => insertDayAfter(f, day)),
    removeDay: (day) => setForm((f) => deleteDay(f, day)),
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
/** Stable identity for a field, so a focus request can be matched against the
 * editor that owns it without passing refs across the tree. */
export function fieldKey(f: EditableField): string {
  switch (f.scope) {
    case "package": return `package:${f.key}`;
    case "day": return `day:${f.day}:${f.key}`;
    case "activity": return `activity:${f.day}:${f.index}:${f.key}`;
  }
}

export type EditableField =
  | { scope: "package"; key: "title" | "description" | "termsNotes" }
  | { scope: "day"; day: number; key: "title" | "description" | "notes" | "notesTitle" }
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

// ─────────────────────────────────────────────────────────────────────────────
// Adding and removing days
//
// Day numbers are positional: itineraries[i].day is always i + 1, and adding
// or removing one renumbers everything after it. Two things have to move with
// that renumber or they silently attach to the wrong content:
//
//   totalDays / totalNights  — denormalised onto the package.
//   form.addOns              — keyed by day NUMBER, not by array position, so
//                              they are the piece of "the whole day" that does
//                              NOT travel inside the DayItinerary object. The
//                              drag-reorder handler in page.tsx already remaps
//                              them for exactly this reason; its removeDay
//                              does not, which is a live bug — an add-on on a
//                              later day currently shifts onto its neighbour
//                              when a day is deleted.
// ─────────────────────────────────────────────────────────────────────────────

/** Renumbers days to 1..n and rebases add-ons through `mapDay`, which returns
 * the new day number for an old one, or null to drop the add-on entirely. */
function renumber(
  form: PackageForm,
  days: DayItinerary[],
  mapDay: (oldDay: number) => number | null,
): PackageForm {
  const itineraries = days.map((d, i) => ({ ...d, day: i + 1 }));
  const addOns = form.addOns
    .map((a) => {
      if (a.day == null) return a;
      const next = mapDay(a.day);
      return next == null ? null : { ...a, day: next };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);
  return {
    ...form,
    itineraries,
    addOns,
    totalDays: itineraries.length,
    totalNights: Math.max(0, itineraries.length - 1),
  };
}

/** Inserts a blank day immediately after `afterDay`. */
export function insertDayAfter(form: PackageForm, afterDay: number): PackageForm {
  const idx = form.itineraries.findIndex((it) => it.day === afterDay);
  if (idx === -1) return form;
  const days = [...form.itineraries];
  // Numbered afterDay + 1 only as a placeholder — renumber sets the real value.
  days.splice(idx + 1, 0, emptyDay(afterDay + 1));
  return renumber(form, days, (d) => (d > afterDay ? d + 1 : d));
}

/** Deletes a day, with everything on it. Refuses to remove the last one — a
 * package with zero days has no coherent state for the rest of the builder. */
export function deleteDay(form: PackageForm, day: number): PackageForm {
  if (form.itineraries.length <= 1) return form;
  const days = form.itineraries.filter((it) => it.day !== day);
  if (days.length === form.itineraries.length) return form;
  // Add-ons attached to the deleted day go with it; later ones shift down.
  return renumber(form, days, (d) => (d === day ? null : d > day ? d - 1 : d));
}

// ─────────────────────────────────────────────────────────────────────────────
// Inclusions / exclusions
//
// Three lists per section, and only one of them is the exec's to change:
//
//   form.inclusions          company-wide standard content, owned by
//                            /dashboard/itinerary-settings. Read-only here.
//   form.extraPolicyItems.*  this package's own additions. Fully editable.
//   form.removedInclusions   costing's per-package vetoes, written ONLY by
//                            verify-packages and never sent back by
//                            saveCustomPackage. Read-only here, deliberately.
//
// The document renders one merged list (see previewForm), built as
// [...standard, ...extra] with removals filtered out of both. Because that
// order is stable, a line's index alone says which list it came from — no
// string matching, so a custom line that happens to duplicate a standard one
// can't be mis-attributed.
// ─────────────────────────────────────────────────────────────────────────────

export type PolicyListKey =
  | "inclusions" | "exclusions"
  | "termsConditions" | "paymentPolicy" | "amendmentPolicy" | "travelBenefits";

/** How many standard lines survive costing's removals — everything at or past
 * this index in the merged list is one of this package's own additions. */
export function standardCount(form: PackageForm, key: PolicyListKey): number {
  // Only inclusions and exclusions can be vetoed by costing; the other four
  // standard lists merge into the document whole (see previewForm), so their
  // boundary is simply how many standard lines there are.
  const removed = key === "inclusions" ? form.removedInclusions
    : key === "exclusions" ? form.removedExclusions
    : null;
  return removed ? form[key].filter((i) => !removed.includes(i)).length : form[key].length;
}

export function addExtraPolicyItem(form: PackageForm, key: PolicyListKey, value: string): PackageForm {
  const next = value.trim();
  if (!next) return form;
  return {
    ...form,
    extraPolicyItems: {
      ...form.extraPolicyItems,
      [key]: [...form.extraPolicyItems[key], next],
    },
  };
}

export function updateExtraPolicyItem(
  form: PackageForm, key: PolicyListKey, index: number, value: string,
): PackageForm {
  const next = value.trim();
  // An emptied line is a removal — leaving a blank bullet on a client-facing
  // document is never what someone meant by clearing the text.
  if (!next) return removeExtraPolicyItem(form, key, index);
  return {
    ...form,
    extraPolicyItems: {
      ...form.extraPolicyItems,
      [key]: form.extraPolicyItems[key].map((v, i) => (i === index ? next : v)),
    },
  };
}

export function removeExtraPolicyItem(
  form: PackageForm, key: PolicyListKey, index: number,
): PackageForm {
  return {
    ...form,
    extraPolicyItems: {
      ...form.extraPolicyItems,
      [key]: form.extraPolicyItems[key].filter((_, i) => i !== index),
    },
  };
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
