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
} from "@/app/(dashboard)/dashboard/(builder)/package-builder/action";
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
   * whenever the count input changes, see the Travellers section handler.
   *
   * A new slot is AGE_UNSET (-1), not 0: 0 is a real answer for an infant, and
   * every age has to be filled in before the package can go to costing. See
   * package-builder/traveller-ages.ts. */
  childrenAges: number[];
  infantAges: number[];
  pricePerPerson: string;
  totalPrice: string;
  marginPercentage: string;
  gstPercentage: string;
  /** Costing's concession off the final price. Null type = no discount. */
  discountType: "FLAT" | "PERCENT" | null;
  discountValue: string;
  discountNote: string;
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
  /** One ticket TYPE at a time — flight, train or helicopter. Package-level,
   * never day-scoped. Split by type because a package with six flights and
   * two train legs in one list is a scroll, and an exec editing a flight has
   * no use for the trains. */
  | { kind: "tickets-edit"; type: TicketInput["type"] }
  /** Ask the hotel team to source a stay for this day. */
  | { kind: "hotel-request"; day: number }
  /** The day's note — title, body and tone. */
  | { kind: "note-edit"; day: number }
  /** Route stops — the destinations the trip visits, and nights at each. */
  | { kind: "stops-edit" };

/** The persistent sections on the sidebar rail — always reachable, unlike a
 * DrawerTarget, which is opened by pointing at something in the document.
 *
 * Both feed the same panel. The rail is "where do I go", the drawer is "change
 * this thing I'm looking at", and collapsing them into one surface is what
 * stops the builder having two competing places for controls to live. */
export type PanelTab =
  // Package-level settings — what the document is built from.
  | "client" | "trip" | "stops" | "itinerary" | "tickets" | "addons"
  // Catalog suggestions, scoped to the trip's destinations. Distinct from the
  // per-day drawers: these are browsed, then dragged onto whichever day they
  // belong to, rather than opened for a day you already picked.
  | "hotels" | "activities" | "cabs"
  // Costing's own section — the pricing breakdown, its findings and the
  // approve/reject decision. Only ever rendered for a reviewer: the rail entry
  // is gated on the caller supplying a costing panel at all, so an exec's
  // sidebar has no such tab to find.
  | "costing"
  // The live calculation — every line's arithmetic, and the walkthrough from
  // base cost to per-person. Costing's, like "costing" above.
  | "pricing";

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

/** What a single day currently costs, and whether costing hand-corrected it.
 * Builder-only — the client's document never shows internal cost. */
export type DayCost = {
  hotel: number;
  cab: number;
  total: number;
  /** Either side was overridden by costing during review, so the number is a
   * correction rather than something the exec's own choices produced. */
  overridden: boolean;
};

/** What the viewer may do, and what has already been said about this package.
 * Both live on the context because the DOCUMENT needs them: a reviewer's
 * per-element controls hang off the same hover affordances the exec's edit
 * controls do, and they are rendered thirty levels down from the route. */
export type ReviewContext = {
  /** From resolveWorkspaceCaps — whether this viewer may raise/close findings. */
  canReview: boolean;
  /** Whether this viewer may strike a company-wide standard inclusion or
   * exclusion off this package. Costing only — see caps.editLockedPolicy. */
  canVetoStandardPolicy: boolean;
  /** Open findings only, keyed by `kind:day:index` — see reviewKey. */
  openByTarget: Map<string, { id: string; severity: "ERROR" | "SUGGESTION"; message: string }[]>;
  /** Re-reads findings after one is raised or cleared. */
  refresh: () => void;
  packageId: string;
};

/** One key shape for pinning and looking up a finding, so the writer and the
 * reader can never disagree about what "day 3's stay" is called. */
export function reviewKey(kind: string, day?: number | null, index?: number | null): string {
  return `${kind}:${day ?? ""}:${index ?? ""}`;
}

type BuilderContextValue = {
  form: PackageForm;
  setForm: SetPackageForm;
  /** Absent for an exec — nothing about review exists on their screen. */
  review?: ReviewContext;
  /** False once the package is locked for costing review (status READY) or
   * the viewer otherwise may not edit. Every edit surface must gate on this —
   * see useCanEdit. */
  canEdit: boolean;
  /** Currently-open contextual drawer, or null. Takes over the panel while
   * set, because it's always a response to something just clicked. */
  drawer: DrawerTarget | null;
  openDrawer: (target: DrawerTarget) => void;
  closeDrawer: () => void;
  /** The rail section shown when no drawer is open. Null means the panel is
   * collapsed to just the rail. */
  panelTab: PanelTab | null;
  setPanelTab: (tab: PanelTab | null) => void;
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
  /** Moves a day to a new position (0-based), renumbering the rest. */
  moveDay: (from: number, to: number) => void;
  /** The day the builder is currently working on. Shared rather than local to
   * either surface, because the layers rail on the left and the Itinerary
   * section on the right are two views of the same choice — if each kept its
   * own, clicking day 5 in one would leave the other showing day 1's elements
   * and there'd be no way to tell which was right. Always a real day number:
   * see the clamp in useSelectedDay. */
  selectedDay: number;
  setSelectedDay: (day: number) => void;
  /** Scrolls a just-created field into view and opens it for typing.
   *
   * Every "add" in the builder used to hand you a drawer and leave you to find
   * what you'd added. Adding a note from the day header put it at the FOOT of
   * that day's content, off screen, with no indication anything had happened.
   *
   * Call it straight after the setForm that creates the thing — it waits for
   * React to commit before looking for the node. */
  revealField: (field: EditableField) => void;
  /** Per-day cost, keyed by day number. Empty while pricing is recomputing or
   * when nothing on the trip is priced yet — a day with no entry simply shows
   * no cost rather than a misleading zero. */
  dayCosts: Map<number, DayCost>;
  /** Saves the whole package right away, bypassing the autosave debounce —
   * for an edit that's meant to take effect somewhere else immediately
   * rather than whenever the exec next happens to pause typing. Submitting
   * a hotel request is the case this exists for: the hotel team's queue
   * (/dashboard/hotel-requests) is a separate page reading straight from
   * the DB, so "submitted" has to actually mean saved, not staged for the
   * next autosave tick. Call it right after the setForm/replaceDay that
   * made the change — it defers to a moment after that state has actually
   * committed, the same reason updateDay et al. never read `form` directly.
   * A no-op where nothing wired up a real save (e.g. the reviewer's
   * workspace, which doesn't submit hotel requests). */
  requestSaveNow: () => void;
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
  form, setForm, canEdit, dayCosts, review, children, requestSaveNow,
}: {
  form: PackageForm;
  setForm: SetPackageForm;
  canEdit: boolean;
  dayCosts: Map<number, DayCost>;
  review?: ReviewContext;
  children: ReactNode;
  /** See BuilderContextValue.requestSaveNow. Omit where there's no real
   * save to trigger (e.g. the reviewer's workspace) — defaults to a no-op. */
  requestSaveNow?: () => void;
}) {
  const [drawer, setDrawer] = useState<DrawerTarget | null>(null);
  const [panelTab, setPanelTab] = useState<PanelTab | null>("client");
  const [selectedDay, setSelectedDay] = useState(1);

  // Days are renumbered on every insert, delete and reorder, so a stored day
  // number goes stale on its own. Clamping here rather than at each reader
  // means no surface can end up rendering a day that doesn't exist — deleting
  // the day you were on lands you on the last one instead of on nothing.
  const dayCount = form.itineraries.length;
  const safeSelectedDay = dayCount === 0 ? 1 : Math.min(Math.max(selectedDay, 1), dayCount);

  const value = useMemo<BuilderContextValue>(() => ({
    form,
    setForm,
    review,
    canEdit,
    dayCosts,
    drawer,
    openDrawer: (target) => setDrawer(target),
    revealField,
    closeDrawer: () => setDrawer(null),
    panelTab,
    setPanelTab: (tab) => {
      // Choosing a rail section dismisses whatever contextual drawer was open —
      // they share one panel, and leaving the drawer underneath would make
      // "back" ambiguous.
      setDrawer(null);
      setPanelTab(tab);
    },
    updateDay: (day, patch) => setForm((f) => replaceDay(f, day, (it) => ({ ...it, ...patch }))),
    replaceDay: (day, fn) => setForm((f) => replaceDay(f, day, fn)),
    addDayAfter: (day) => setForm((f) => insertDayAfter(f, day)),
    removeDay: (day) => setForm((f) => deleteDay(f, day)),
    moveDay: (from, to) => setForm((f) => reorderDays(f, from, to)),
    selectedDay: safeSelectedDay,
    setSelectedDay,
    requestSaveNow: requestSaveNow ?? (() => {}),
  }), [form, setForm, review, canEdit, dayCosts, drawer, panelTab, safeSelectedDay, requestSaveNow]);

  return <BuilderContext.Provider value={value}>{children}</BuilderContext.Provider>;
}

/**
 * Scrolls to the inline editor for `field` and puts the caret in it.
 *
 * Deliberately a DOM lookup rather than React state. The node doesn't exist
 * until the setForm that created it has rendered, so any state-based approach
 * needs an effect that fires after commit anyway — and every EditableText
 * already carries a `data-field` hook for exactly this kind of addressing.
 *
 * Two rAFs, not one: the first fires before React has painted the new node on
 * a re-render triggered inside an event handler; the second is after. A
 * setTimeout would work too and be less honest about what it's waiting for.
 *
 * Silent when the node isn't found. A field that isn't rendered (a section the
 * document hides, a locked package) is a reason to do nothing, not to throw
 * inside a click handler.
 */
/**
 * Finds a node in the LIVE document, never in the off-screen capture twin.
 *
 * ItineraryPdfExport keeps a second, complete render of the document parked at
 * `position: fixed; left: -10000px` so html2canvas measures a consistent
 * layout. That copy duplicates every hook the real one has — the data-field
 * attributes AND the builder-day-N ids — and it sits FIRST in the DOM. So
 * getElementById and a bare querySelector both return the parked copy, and
 * scrolling to it drags the page 10,000px sideways: the document goes blank,
 * the fixed header stays put, and nothing is thrown to explain it.
 *
 * Every lookup into the document goes through here for that reason.
 */
export function findInDocument(selector: string): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return Array.from(document.querySelectorAll<HTMLElement>(selector))
    .find((n) => !n.closest("[data-offscreen-capture]")) ?? null;
}

/** Scrolls a day card into view, from the layers rail or the Itinerary chips. */
export function scrollToDay(day: number) {
  findInDocument(`[id="builder-day-${day}"]`)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function revealField(field: EditableField) {
  if (typeof document === "undefined") return;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    try {
      const el = findInDocument(`[data-field="${fieldKey(field)}"]`);
      if (!el) return;
      // "nearest", not "center". "center" scrolls EVERY scrollable ancestor to
      // put this element mid-viewport, including ones that have no business
      // moving — the preview pane, the panel, and the window all at once.
      // "nearest" moves each only as far as it must, and not at all when the
      // element is already visible.
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      // EditableText's own click handler is what swaps in the input; its
      // autoFocus does the rest. Going through the handler rather than calling
      // focus() keeps one path into edit mode.
      el.click();
    } catch (err) {
      // Nothing here is worth taking the builder down for. The thing being
      // revealed was already created by the caller's setForm — failing to
      // scroll to it costs a scroll, not the edit.
      console.error("[builder] revealField failed", field, err);
    }
  }));
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
    case "ticket": return `ticket:${f.index}:${f.key}`;
    case "addon": return `addon:${f.index}:${f.key}`;
    case "stop": return `stop:${f.index}:${f.key}`;
  }
}

/** Day fields editable directly in the document.
 *
 * The transport and hotel entries are why this list is longer than "the text
 * on a day": once a section is hoverable and outlined, an exec expects to click
 * the drop point and change it, not to open a drawer to change one word. The
 * drawers stay for the things that genuinely are decisions — picking a hotel,
 * routing a drive — rather than for typing. */
export type DayTextKey =
  | "title" | "description" | "notes" | "notesTitle"
  | "transportPickup" | "transportDrop" | "transportTravelTime"
  | "transportDistanceKm"
  | "accommodation" | "accommodationLocation" | "accommodationRoomSpecs"
  | "hotelMealPlan" | "hotelCheckIn" | "hotelCheckOut";

/** Written as numbers, not strings — see applyFieldEdit. */
const NUMERIC_DAY_KEYS = new Set<DayTextKey>(["transportDistanceKm"]);

/** Ticket fields editable directly on the card.
 *
 * Free text only. travelDate, departureTime and arrivalTime are deliberately
 * absent: they're stored in fixed formats the document parses (and the client
 * reads against a real boarding pass), and a free-text box over one is an
 * invitation to type "9pm" into a field that expects "21:00". Those stay in
 * the drawer, which has real date and time inputs. */
export type TicketTextKey =
  | "provider" | "ticketNumber" | "fromPlace" | "toPlace" | "durationText" | "notes";

/** Add-on fields editable on the card — exactly the two the card renders.
 * Price is never shown to the client (it's folded into the package total) and
 * quantity is numeric, so both stay in the drawer. */
export type AddonTextKey = "name" | "notes";

export type EditableField =
  | { scope: "package"; key: "title" | "description" | "termsNotes" }
  | { scope: "day"; day: number; key: DayTextKey }
  | { scope: "activity"; day: number; index: number; key: "title" | "description" }
  // Indices into form.tickets / form.addOns. Both documents render FILTERED
  // views of those arrays — tickets grouped by type, add-ons split into
  // package-level and per-day — so the position on screen is never the
  // position in the array, and the card has to be told its real one.
  | { scope: "ticket"; index: number; key: TicketTextKey }
  | { scope: "addon"; index: number; key: AddonTextKey }
  // Only the name. `nights` drives day-to-stop mapping, the day-wise table and
  // the whole itinerary's length, so it belongs in the Destinations editor
  // where changing it shows what it does — not behind a text box on a photo.
  | { scope: "stop"; index: number; key: "name" };

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

    case "day": {
      // A numeric column must not receive "" or "12" — an empty distance is
      // null (unknown), not zero, and the pricing engine multiplies by it.
      const next: string | number | null = NUMERIC_DAY_KEYS.has(field.key)
        ? (value.trim() === "" ? null : Number.parseFloat(value.replace(/[^\d.]/g, "")))
        : value;
      const clean = typeof next === "number" && Number.isNaN(next) ? null : next;
      return {
        ...form,
        itineraries: form.itineraries.map((it) =>
          it.day === field.day ? { ...it, [field.key]: clean } : it,
        ),
      };
    }

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

    case "ticket":
      return {
        ...form,
        tickets: form.tickets.map((t, i) =>
          i === field.index ? { ...t, [field.key]: value } : t,
        ),
      };

    case "addon":
      return {
        ...form,
        addOns: form.addOns.map((a, i) =>
          i === field.index ? { ...a, [field.key]: value } : a,
        ),
      };

    case "stop":
      return {
        ...form,
        stops: form.stops.map((st, i) =>
          i === field.index ? { ...st, [field.key]: value } : st,
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

/** Moves a day from one position to another, 0-based.
 *
 * Uses the same renumber as insert/delete, so add-ons follow their day rather
 * than staying pinned to a position — the trap the drag handler in page.tsx
 * already guards against and its removeDay did not. */
export function reorderDays(form: PackageForm, from: number, to: number): PackageForm {
  const n = form.itineraries.length;
  if (from === to || from < 0 || to < 0 || from >= n || to >= n) return form;
  const days = [...form.itineraries];
  const [moved] = days.splice(from, 1);
  days.splice(to, 0, moved);
  // Old day number → new one, read off the reordered list before renumbering.
  const mapping = new Map(days.map((d, i) => [d.day, i + 1]));
  return renumber(form, days, (d) => mapping.get(d) ?? d);
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

/** Mirrors what toggleStandardPolicyLine just wrote to the row, in this tab's
 * copy of the form.
 *
 * The veto is one of the few edits that goes straight to the database instead
 * of through `form`, so the action's own router.refresh() re-renders the server
 * components around the editor and leaves `form.removedInclusions` exactly as
 * it was hydrated at mount. Without this the struck line stayed on screen — the
 * toast said "Line removed from this package" and the client's copy of the
 * document visibly disagreed until a full reload. */
export function toggleRemovedPolicyLine(
  form: PackageForm, key: "inclusions" | "exclusions", value: string,
): PackageForm {
  const field = key === "inclusions" ? "removedInclusions" : "removedExclusions";
  const current = form[field];
  return {
    ...form,
    [field]: current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value],
  };
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

/** The review context, or null for anyone who isn't reviewing. Null rather
 * than a disabled object so a caller can't accidentally render review chrome
 * that then refuses to work.
 *
 * Optional, not required: "anyone who isn't reviewing" includes the client
 * reading the published itinerary at /custom-package/[id], where the document
 * renders with no builder around it at all. Reaching this through useBuilder
 * threw there and took the whole page down — EditablePolicyList calls it, and
 * every inclusions/exclusions list in the document goes through that. */
export function useReview(): ReviewContext | null {
  return useOptionalBuilder()?.review ?? null;
}
