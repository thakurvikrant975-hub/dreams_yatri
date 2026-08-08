"use client";

import React, { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import {
  MapPin, Calendar, Users, Phone, Mail, Hotel, Car, Zap,
  Utensils, ChevronDown, ChevronUp, Plus, Trash2, Pencil,
  Save, Send, CheckCircle, AlertCircle, Loader2,
  Package, User, Info, IndianRupee, ArrowLeft,
  Eye, EyeOff, ListChecks, Plane, TrainFront, Helicopter, LogIn, LogOut,
  Image as ImageIcon, X, Sparkles, Percent, CreditCard, Wand2, Copy, Lock,
  ExternalLink, Gift, GripVertical, Clock, XCircle, RotateCcw, BedDouble, Undo2, Redo2, Bus, Ticket,
} from "lucide-react";
import { Button } from "@/app/(dashboard)/dashboard/(main)/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "@/app/(dashboard)/dashboard/(main)/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/app/(dashboard)/dashboard/(main)/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/app/(dashboard)/dashboard/(main)/components/ui/dropdown-menu";
import {
  getPackageDetail,
  getQueryLeadInfo,
  saveCustomPackage,
  markPackageReady,
  shareCustomPackageWithClient,
  getDestinationCoverImage,
  searchActivitiesForBuilder,
  searchVehiclesForBuilder,
  searchCabsForBuilder,
  type QueryDetail,
  type DayItinerary,
  type ActivityInput,
  type StopInput,
  type HotelRoomResult,
  type ActivityResult,
  type VehicleResult,
  type CabPricingResult,
  type PackageCopyPayload,
  type TicketInput,
  type AddonInput,
  type ExtraPolicyItems,
  getCurrentUserRole,
} from "../action";
import { computeBuilderHotelPricing, type BuilderHotelPricingResult, computeBuilderCabPricing, type BuilderCabPricingResult } from "@/app/services/package-pricing.service";
import { splitManualHotelName } from "@/app/services/hotel-name-utils";
import { ItineraryDocument, formatTime12h, computeShiftedMeals, type PreviewData, type ImageEditTarget } from "./ItineraryDocument";
import { deriveDayLocations } from "@/app/lib/route-builder-utils";
import { ItineraryPdfExport } from "./ItineraryPdfExport";
import { RequestRevisionDialog } from "./RequestRevisionDialog";
import { validateItineraryRequiredFields } from "./pdfExport";
import { CreatePackageDialog } from "@/app/(dashboard)/dashboard/(main)/(sales)/sales-query/CreatePackageDialog";
import { getItinerarySettings, type ItinerarySettings } from "@/app/(dashboard)/dashboard/(main)/itinerary-settings/actions";
import { getMealTypes } from "@/app/(dashboard)/dashboard/(main)/hotels/actions";
import { PackageBuilderProvider, reorderDays, type PackageForm, type DayCost } from "./builder-context";
import { TripSetupPanel } from "./TripSetupPanel";
import { DayLayersRail } from "./DayLayersRail";
import { useUndoableState } from "./use-undoable-state";
import { useLocalDraft } from "./use-local-draft";
import { emptyDay, emptyTicket } from "./day-mutations";
import { BuilderSidebar } from "./BuilderSidebar";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const MEAL_OPTIONS = ["Breakfast", "Lunch", "Dinner", "Tea & Snacks"];

// hotel_room_pricing's meal_type.covered_meals comes back as lowercase keys
// ("breakfast", "lunch", "dinner") — map to the same labels MEAL_OPTIONS uses
// so the toggle chips light up correctly once a room is picked.
const MEAL_KEY_LABELS: Record<string, string> = {
  breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner",
};

const ACTIVITY_LABELS: Record<string, string> = {
  PARAGLIDING: "Paragliding",
  RIVER_RAFTING: "River Rafting",
  TREKKING: "Trekking",
  SKIING: "Skiing",
  CAMPING: "Camping",
};

const STAY_LABELS: Record<string, string> = {
  STAR_3: "3★ Hotel", STAR_4: "4★ Hotel", STAR_5: "5★ Hotel",
  BOUTIQUE: "Boutique", HOMESTAY: "Homestay",
  RESORT: "Resort", CAMP: "Camp", BUDGET: "Budget",
};

const CAB_LABELS: Record<string, string> = {
  SEDAN: "Sedan", SUV: "SUV", TEMPO: "Tempo Traveller", BUS: "Bus",
};

// "use server" files may only export async functions, so this plain default
// (same shape as ExtraPolicyItems in action.ts) is mirrored here rather than
// imported — matches the HOTEL_SEARCH_PAGE_SIZE/MEAL_KEY_LABELS pattern.
const EMPTY_EXTRA_POLICY_ITEMS: ExtraPolicyItems = {
  inclusions: [], exclusions: [], termsConditions: [], paymentPolicy: [], amendmentPolicy: [], travelBenefits: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// Itinerary tab "focus mode" — narrows every day card down to just one
// section at a time (e.g. only Hotel) so an exec can fill in that one thing
// across the whole trip without the other sections' clutter/scroll in the way.
// "all"/"details" both show the day title/description/notes block; the rest
// are each their own single-purpose lane.
// ─────────────────────────────────────────────────────────────────────────────
type FocusSection = "all" | "details" | "hotel" | "cab" | "meals" | "activities";

const FOCUS_SECTIONS: { value: FocusSection; label: string; icon: React.ElementType }[] = [
  { value: "all", label: "All", icon: ListChecks },
  { value: "details", label: "Details", icon: Info },
  { value: "hotel", label: "Hotel", icon: Hotel },
  { value: "cab", label: "Cab", icon: Car },
  { value: "meals", label: "Meals", icon: Utensils },
  { value: "activities", label: "Activities", icon: Zap },
];

// Mirrors TRIP_TYPES in Packagedetailsdialog.tsx (the "Package Requirements"
// popup where this is captured) — kept as a local label map here, same
// pattern as STAY_LABELS/CAB_LABELS above, since that's a large client
// component and this read-only sidebar only needs the label strings.
const TRIP_TYPE_LABELS: Record<string, string> = {
  FAMILY: "Family Trip", HONEYMOON: "Honeymoon", HOLIDAY: "Holiday / Leisure",
  FRIENDS: "Friends / Group", SOLO: "Solo Travel", ANNIVERSARY: "Anniversary",
  ADVENTURE: "Adventure", PILGRIMAGE: "Pilgrimage / Religious",
  BUSINESS: "Business", CORPORATE: "Corporate / MICE", OTHER: "Other",
};

const DEFAULT_INCLUSIONS = [
  "Accommodation as per itinerary",
  "Meals as per itinerary",
  "All transfers by private cab",
  "GST & service taxes",
];

const DEFAULT_EXCLUSIONS = [
  "Airfare / train tickets not mentioned in the itinerary",
  "Personal expenses",
  "Meals not mentioned",
  "Adventure activity charges",
];

// Common, company-wide defaults an exec can trim/extend per package —
// condensed from the published Terms & Conditions / Payment / Cancellation
// policies into short, removable bullet points.
const DEFAULT_TERMS_CONDITIONS = [
  "Dreams Yatri acts as a facilitator between travellers and third-party suppliers (hotels, airlines, cabs).",
  "All bookings are subject to availability and supplier confirmation.",
  "Traveller details must be accurate — we aren't liable for losses due to incorrect information.",
  "Package prices are subject to change until booking amount is received.",
  "Confirmed bookings are locked at the agreed price.",
  "All disputes are subject to the jurisdiction of courts in Shimla, Himachal Pradesh.",
];

const DEFAULT_PAYMENT_POLICY = [
  "50% advance required to confirm your booking.",
  "Remaining balance must be cleared 7 days before departure.",
  "Accepted: UPI, Net Banking, Credit/Debit Card, Bank Transfer.",
  "All prices are inclusive of GST unless stated otherwise.",
  "Payments are processed securely via authorized payment gateways only.",
];

const DEFAULT_AMENDMENT_POLICY = [
  "Date changes are permitted a maximum of 2 times per booking.",
  "New travel dates must be within 12 months of the original booking date.",
  "Amendment charges apply based on how close to departure the change is requested.",
  "Hotel & flight availability at the time of change is not guaranteed.",
  "Any fare differences on amendment will be charged to the traveller.",
  "Amendment requests must be submitted in writing via email or WhatsApp.",
];

const DEFAULT_TRAVEL_BENEFITS = [
  "Hassle-free, end-to-end trip planning",
  "No hotel or cab scams — all our partners are verified",
  "Safe & secure travel with 24x7 support",
  "Handpicked stays and vetted local partners",
  "Transparent pricing, no hidden charges",
  "Dedicated travel manager for your trip",
];

// ─────────────────────────────────────────────────────────────────────────────
// Small UI helpers
// ─────────────────────────────────────────────────────────────────────────────
function Pill({ label }: { label: string }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full border font-medium bg-dashboard-base-200 text-dashboard-base-content/70 border-dashboard-base-300">
      {label}
    </span>
  );
}

function SectionCard({
  title, icon, children, defaultOpen = true,
}: { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-dashboard-base-300 bg-dashboard-base-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-dashboard-base-200/60 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-dashboard-base-content">
          <span className="text-dashboard-primary">{icon}</span>
          {title}
        </div>
        {open
          ? <ChevronUp size={14} className="text-dashboard-base-content/40" />
          : <ChevronDown size={14} className="text-dashboard-base-content/40" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-2 border-t border-dashboard-base-300">
          {children}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="text-dashboard-base-content/75 w-24 shrink-0 pt-0.5">{label}</span>
      <span className="font-semibold text-dashboard-base-content flex-1">{value}</span>
    </div>
  );
}

function SpecialNote({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <div className="flex gap-2 rounded-lg bg-dashboard-warning/10 border border-dashboard-warning/30 px-3 py-2 mt-1">
      <AlertCircle size={13} className="text-dashboard-warning shrink-0 mt-0.5" />
      <p className="text-xs text-dashboard-warning-content">{text}</p>
    </div>
  );
}







// ─────────────────────────────────────────────────────────────────────────────
// RouteStopsEditor — destination + nights per stop, like the packages route
// builder. The parent recalculates total nights/days/destination from these.
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// DaySectionCard — a colored container for one part of a day (Hotel /
// Transport / Meals / Activities) so the sidebar reads at a glance instead of
// every block looking like the same gray box.
// ─────────────────────────────────────────────────────────────────────────────
const SECTION_THEMES = {
  amber:   { border: "border-amber-200",   headerBg: "bg-amber-50",   iconBg: "bg-amber-100",   iconText: "text-amber-600",   labelText: "text-amber-800" },
  sky:     { border: "border-sky-200",     headerBg: "bg-sky-50",     iconBg: "bg-sky-100",     iconText: "text-sky-600",     labelText: "text-sky-800" },
  emerald: { border: "border-emerald-200", headerBg: "bg-emerald-50", iconBg: "bg-emerald-100", iconText: "text-emerald-600", labelText: "text-emerald-800" },
  violet:  { border: "border-violet-200",  headerBg: "bg-violet-50",  iconBg: "bg-violet-100",  iconText: "text-violet-600",  labelText: "text-violet-800" },
  rose:    { border: "border-rose-200",    headerBg: "bg-rose-50",    iconBg: "bg-rose-100",    iconText: "text-rose-600",    labelText: "text-rose-800" },
} as const;



// ─────────────────────────────────────────────────────────────────────────────
// Hotel Info — room capacity + rooms/mattresses needed
// ─────────────────────────────────────────────────────────────────────────────



// ─────────────────────────────────────────────────────────────────────────────
// Hotel Info — "Add Hotels by Team" request
// ─────────────────────────────────────────────────────────────────────────────



// ─────────────────────────────────────────────────────────────────────────────
// Form State Type
//
// Lives in builder-context.tsx so the preview's inline editors and the task
// drawers can share it without importing from this page module. The shape is
// unchanged — see the note there on why this stays a plain useState pair.
// ─────────────────────────────────────────────────────────────────────────────

/** Keeps a children/infants ages array in sync with a changed traveller
 * count — grows with 0-filled slots, shrinks by dropping the trailing ones. */
function resizeAges(ages: number[], count: number): number[] {
  if (count <= ages.length) return ages.slice(0, count);
  return [...ages, ...Array(count - ages.length).fill(0)];
}

/** Sum of stop nights → total nights/days + a joined destination string. */
function recalcFromStops(stops: StopInput[]) {
  const totalNights = stops.reduce((sum, s) => sum + (s.nights || 0), 0);
  return {
    totalNights,
    totalDays: totalNights + 1,
    destination: stops.map((s) => s.name).filter(Boolean).join(", "),
  };
}


/** "2h 15m" / "1d 4h" — how long it took to go from assignment to sent,
 * so an exec (and later, reporting) can see whether this tool is actually
 * making things faster. */
function formatDuration(ms: number): string {
  if (ms < 0) return "—";
  const minutes = Math.floor(ms / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

/** Detects the "[label](https://...)" markdown-link/citation pattern
 * sometimes left behind when copying a JSON response out of ChatGPT's chat
 * bubble (as opposed to its code block's own copy button) — a link wrapped
 * around plain text inside a JSON string is still syntactically valid JSON,
 * so JSON.parse succeeds but every wrapped field ends up garbled. Recurses
 * through the whole parsed value looking for the tell-tale "](http" bytes. */
function looksLikeMarkdownLinkCorruption(value: unknown): boolean {
  if (typeof value === "string") return /\]\(https?:\/\//.test(value);
  if (Array.isArray(value)) return value.some(looksLikeMarkdownLinkCorruption);
  if (value && typeof value === "object") return Object.values(value).some(looksLikeMarkdownLinkCorruption);
  return false;
}

const TICKET_TYPE_ICONS: Record<TicketInput["type"], typeof Plane> = {
  FLIGHT: Plane, TRAIN: TrainFront, HELICOPTER: Helicopter,
  BUS: Bus, OTHER: Ticket,
};
const TICKET_PROVIDER_PLACEHOLDERS: Record<TicketInput["type"], string> = {
  FLIGHT: "Airline, e.g. IndiGo",
  TRAIN: "Train name, e.g. Rajdhani Express",
  HELICOPTER: "Operator, e.g. Pawan Hans",
  BUS: "Operator, e.g. HRTC",
  OTHER: "Operator",
};
const TICKET_NUMBER_PLACEHOLDERS: Record<TicketInput["type"], string> = {
  FLIGHT: "Flight no., e.g. 6E-204",
  TRAIN: "Train no., e.g. 12951",
  HELICOPTER: "Flight/booking no.",
  BUS: "Bus/booking no.",
  OTHER: "Booking no.",
};


// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function PackageBuilderDetailPage() {
  const params = useParams<{ packageId: string }>();
  const packageId = params.packageId;
  // Present only when landing here for a brand-new (not-yet-saved) package
  // that's meant to be linked to a query — see the "Load package" effect
  // below and CreatePackageDialog, which sets this on the navigation URL.
  const searchParams = useSearchParams();
  const fromQueryId = searchParams.get("fromQuery");

  const [query, setQuery] = useState<QueryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  // Inclusions/exclusions/policies/benefits are company-wide standard
  // content — edited only on /dashboard/itinerary-settings, never per
  // package. See the "Load itinerary settings" effect below.
  const [userRole, setUserRole] = useState<string | null>(null);
  const isSalesExecutive = userRole?.toLowerCase() === "sales executive";
  const [itinerarySettings, setItinerarySettings] = useState<ItinerarySettings | null>(null);
  // Meal-plan options for the "Add Hotels by Team" request form's Meal Plan
  // select (see HotelRequestPanel) — same list configured at
  // /dashboard/hotels/meal-types, fetched once here and shared by every day.
  const [mealTypes, setMealTypes] = useState<{ id: number; name: string }[]>([]);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("client");
  const [savedOk, setSavedOk] = useState(false);
  const [isFetchingCover, setIsFetchingCover] = useState(false);
  const [hotelPricing, setHotelPricing] = useState<BuilderHotelPricingResult | null>(null);
  const [computingPrice, setComputingPrice] = useState(false);
  const [cabPricing, setCabPricing] = useState<BuilderCabPricingResult | null>(null);
  const [computingCabPrice, setComputingCabPrice] = useState(false);
  // Real destination photos for the preview document's "Places You'll Visit"
  // strip — resolved by name via the same catalog lookup the cover-photo
  // suggestion already uses, so a route stop like "Manali" picks up the
  // actual destination photo automatically, no manual upload needed.
  const [stopImages, setStopImages] = useState<Record<string, string | null>>({});

  // AI Itinerary Builder — copy-a-prompt / paste-back-JSON workflow (external
  // LLM, no direct API call from here). See buildAIPrompt/applyAIItinerary.
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiJsonInput, setAiJsonInput] = useState("");

  // Itinerary tab "focus mode" — see FOCUS_SECTIONS.
  const [focusSection, setFocusSection] = useState<FocusSection>("all");

  const [isSaving, startSave] = useTransition();
  const [isSending, startSend] = useTransition();
  const [isSharing, startShare] = useTransition();
  const [confirmReadyOpen, setConfirmReadyOpen] = useState(false);
  const [confirmShareOpen, setConfirmShareOpen] = useState(false);

  // useState with history — see use-undoable-state.ts. Same signature, so
  // every existing setForm call site below is unchanged and undo covers all
  // of them rather than only the ones wired up deliberately.
  const [form, setForm, history] = useUndoableState<PackageForm>({
    title: "", description: "", coverImage: "", coverImagePosition: 50, destination: "", startingPoint: "",
    totalDays: 3, totalNights: 2, travelDate: "",
    adults: 1, children: 0, infants: 0, childrenAges: [], infantAges: [],
    pricePerPerson: "", totalPrice: "",
    marginPercentage: "25", gstPercentage: "5",
    currency: "INR",
    inclusions: DEFAULT_INCLUSIONS,
    exclusions: DEFAULT_EXCLUSIONS,
    removedInclusions: [],
    removedExclusions: [],
    termsNotes: "",
    termsConditions: DEFAULT_TERMS_CONDITIONS,
    paymentPolicy: DEFAULT_PAYMENT_POLICY,
    amendmentPolicy: DEFAULT_AMENDMENT_POLICY,
    travelBenefits: DEFAULT_TRAVEL_BENEFITS,
    customPolicySections: [],
    extraPolicyItems: EMPTY_EXTRA_POLICY_ITEMS,
    stops: [],
    itineraries: [emptyDay(1), emptyDay(2), emptyDay(3)],
    tickets: [],
    addOns: [],
    execName: "", execEmail: "", execDesignation: "",
  });
  // Stable across renders, unlike `history` itself (which re-memoises as
  // canUndo/canRedo flip) — safe to depend on from the load effects below.
  const { reset: resetForm } = history;

  // Drag-to-reorder day cards — same dnd-kit pattern as ActivityListEditor's
  // dndIds above: a stable id per row, tracked separately from the day data
  // itself, updated in lockstep by the exact places that change the array's
  // length or order (add/remove/reorder/reload). A plain field edit inside a
  // day never touches this since it changes neither.
  const [dayDndIds, setDayDndIds] = useState<string[]>(() => form.itineraries.map((_, i) => `day-${i}`));
  const [prevItinerariesForIds, setPrevItinerariesForIds] = useState(form.itineraries);
  if (form.itineraries !== prevItinerariesForIds && form.itineraries.length !== dayDndIds.length) {
    setPrevItinerariesForIds(form.itineraries);
    setDayDndIds(form.itineraries.map((_, i) => `day-${i}`));
  }
  const daySensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // ── Undo / redo shortcuts ───────────────────────────────────────────────────
  // Skipped while focus is in a text field: the browser's own undo inside an
  // <input> is what someone means by Cmd-Z mid-sentence, and hijacking it to
  // roll back the whole package would be startling. EditableText commits on
  // blur, so once they leave the field the package-level history has it.
  // isLocked itself is derived much further down, after the data loads —
  // read the same condition off `query` here rather than hoisting it.
  const historyLocked = query?.customPackage?.status === "READY";
  useEffect(() => {
    if (historyLocked) return;
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      const el = document.activeElement;
      const typing = el instanceof HTMLElement
        && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (typing) return;
      e.preventDefault();
      if (e.shiftKey) history.redo(); else history.undo();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [historyLocked, history]);

  // ── Current user's role — gates editing of the standard content lists ──────
  useEffect(() => {
    let cancelled = false;
    getCurrentUserRole().then((role) => {
      if (!cancelled) setUserRole(role);
    });
    return () => { cancelled = true; };
  }, []);

  // ── Meal-plan options for the hotel-request form's Meal Plan select ────────
  useEffect(() => {
    let cancelled = false;
    getMealTypes().then((types) => {
      if (!cancelled) setMealTypes(types);
    });
    return () => { cancelled = true; };
  }, []);

  // ── Load itinerary settings — the single global source for Inclusions/
  // Exclusions/T&C/Payment/Amendment/Benefits + document header/footer.
  // Always wins over whatever's stored on the package row, so the builder
  // never shows stale per-package content that a save would overwrite anyway.
  useEffect(() => {
    let cancelled = false;
    getItinerarySettings().then((settings) => {
      if (cancelled) return;
      setItinerarySettings(settings);
      resetForm((f) => ({
        ...f,
        inclusions: settings.inclusions,
        exclusions: settings.exclusions,
        termsConditions: settings.termsConditions,
        paymentPolicy: settings.paymentPolicy,
        amendmentPolicy: settings.amendmentPolicy,
        travelBenefits: settings.travelBenefits,
        customPolicySections: settings.customPolicySections,
      }));
    });
    return () => { cancelled = true; };
  }, [resetForm]);

  // ── Load package ───────────────────────────────────────────────────────────
  useEffect(() => {
    // Guards against React Strict Mode's dev-only double-invocation: without
    // this, the first (soon-to-be-cancelled) run could still consume the
    // "Use It" sessionStorage payload and apply it, and then the second run's
    // slower async destination-cover fetch resolves afterwards and clobbers
    // the correctly-applied package cover with the generic destination one.
    let cancelled = false;
    (async () => {
      // The package is the anchor now (a query can have several), so it's
      // looked up by its own id first. A miss doesn't mean "not found" — it
      // means this is a brand-new, not-yet-saved draft (the caller always
      // navigates here with a freshly-generated id before the first Save),
      // so fall back to the linked query's lead info for prefill, or a fully
      // blank shell for a package started with no query at all.
      let data = await getPackageDetail(packageId);
      if (cancelled) return;
      if (!data) {
        data = fromQueryId ? await getQueryLeadInfo(fromQueryId) : null;
        if (cancelled) return;
        if (!data) {
          data = {
            id: null, name: null, phone: null, countryCode: null, email: null,
            destination: null, travelDate: null, groupSize: null,
            assignedToName: null, assignedAt: null, createdAt: null, updatedAt: null,
            requirements: null, status: null, message: null, packageUrl: null,
            execEmail: null, execDesignation: null, customPackage: null,
          };
        }
      }
      setQuery(data);

      const r = data.requirements;
      const j = r?.journey;
      const t = r?.travellers;
      const tr = r?.transport;

      resetForm((f) => ({
        ...f,
        title: `${j?.destinations?.[0] ?? data.destination ?? "Custom"} Tour Package`,
        destination: j?.destinations?.join(", ") ?? data.destination ?? "",
        // departurePoints is the current field; pickupPoints is kept as a
        // fallback for requirements saved before the two were split apart.
        startingPoint: j?.departurePoints?.join(", ") ?? j?.pickupPoints?.join(", ") ?? "",
        totalDays: j?.noOfDays ?? 3,
        totalNights: j?.noOfNights ?? 2,
        travelDate: j?.travelDate ?? (data.travelDate ? new Date(data.travelDate).toISOString().split("T")[0] : ""),
        adults: t?.adults ?? 1,
        children: t?.children ?? 0,
        infants: t?.infants ?? 0,
        // Seed a blank ticket of the right type when the client asked for
        // flights/train on the original query and there's no draft (and no
        // tickets) yet — a nudge to fill it in on the Tickets tab, not a
        // hard requirement; the exec can just delete the row if it's wrong.
        tickets: f.tickets.length === 0
          ? [
              ...(tr?.includeFlights ? [emptyTicket("FLIGHT")] : []),
              ...(tr?.includeTrain ? [emptyTicket("TRAIN")] : []),
            ]
          : f.tickets,
        itineraries: Array.from({ length: j?.noOfDays ?? 3 }, (_, i) => emptyDay(i + 1)),
        execName: data.assignedToName ?? "",
        execEmail: data.execEmail ?? "",
        execDesignation: data.execDesignation ?? "",
      }));

      if (data.customPackage) {
        const cp = data.customPackage;
        resetForm((f) => ({
          ...f,
          title: cp.title,
          description: cp.description ?? "",
          coverImage: cp.coverImage ?? "",
          coverImagePosition: cp.coverImagePosition ?? 50,
          // These previously fell through to whatever the initial setForm
          // above seeded from the client's ORIGINAL requirement — so a
          // travel date or traveller count the exec deliberately changed
          // from that original ask would silently revert the moment the
          // package was reopened. cp.* (what was actually saved) always
          // wins here now, same as every other saved field on this package.
          travelDate: cp.travelDate ? new Date(cp.travelDate).toISOString().split("T")[0] : f.travelDate,
          adults: cp.adults,
          children: cp.children,
          infants: cp.infants,
          childrenAges: cp.childrenAges ?? [],
          infantAges: cp.infantAges ?? [],
          pricePerPerson: cp.pricePerPerson?.toString() ?? "",
          totalPrice: cp.totalPrice?.toString() ?? "",
          marginPercentage: cp.marginPercentage?.toString() ?? "25",
          gstPercentage: cp.gstPercentage?.toString() ?? "5",
          // Inclusions/exclusions/termsConditions/paymentPolicy/amendmentPolicy/
          // travelBenefits are intentionally NOT re-hydrated from cp here —
          // they're company-wide global content, always sourced live from
          // the "Load itinerary settings" effect instead of the (possibly
          // stale) snapshot stored on this package row. extraPolicyItems is
          // the opposite — genuinely per-package, so it DOES load from cp.
          extraPolicyItems: cp.extraPolicyItems,
          removedInclusions: cp.removedInclusions ?? [],
          removedExclusions: cp.removedExclusions ?? [],
          termsNotes: cp.termsNotes ?? f.termsNotes,
          stops: cp.stops,
          // Renumbered 1..N by array position (already the correct order —
          // the query sorts by day asc) rather than trusting the stored
          // `day` field verbatim. Older data can carry a duplicate/gapped
          // day number (no DB constraint ever enforced uniqueness), which
          // silently double-charges that day in the Cabs/Hotel pricing
          // breakdown — every day-priced line is keyed off `it.day`.
          itineraries: cp.itineraries.length > 0
            ? cp.itineraries.map((it, idx) => ({ ...it, day: idx + 1 }))
            : f.itineraries,
          // Duration shown in the header/cover — previously left at whatever
          // the initial setForm above seeded from the client's ORIGINAL
          // requirement (j.noOfDays/noOfNights), even when the actual saved
          // package has a different route/day count. Auto-calculated here
          // the same way the rest of the builder already does it — from the
          // route stops' night counts when stops exist (recalcFromStops,
          // same as editing the Route Stops list), else from the actual
          // number of saved day-cards — so it can never drift from what's
          // really in the Itinerary tab. cp.totalDays/totalNights is only a
          // fallback for a package with neither stops nor days saved yet.
          ...(cp.stops.length > 0
            ? recalcFromStops(cp.stops)
            : cp.itineraries.length > 0
              ? { totalDays: cp.itineraries.length, totalNights: Math.max(0, cp.itineraries.length - 1) }
              : { totalDays: cp.totalDays, totalNights: cp.totalNights }),
          tickets: cp.tickets,
          addOns: cp.addOns,
        }));
      } else {
        // No package built yet — seed Margin%/GST% from the admin-configured
        // defaults (Itinerary Settings) instead of a hardcoded value, and
        // suggest the destination's catalog photo as the default cover so
        // the header isn't blank from the first draft.
        const settings = await getItinerarySettings();
        if (cancelled) return;
        setForm((f) => ({
          ...f,
          marginPercentage: String(settings.defaultMarginPercentage),
          gstPercentage: String(settings.defaultGstPercentage),
        }));

        const destinationName = j?.destinations?.[0] ?? data.destination;
        if (destinationName) {
          const suggested = await getDestinationCoverImage(destinationName);
          if (cancelled) return;
          if (suggested) setForm((f) => ({ ...f, coverImage: suggested }));
        }
      }

      // ── "Use It" from the Package Library — a copy payload waiting in
      // sessionStorage from the redirect. Confirm before clobbering an
      // existing saved draft; a brand-new package just applies it directly.
      const copyKey = `pkgCopyPayload:${packageId}`;
      const rawCopyPayload = sessionStorage.getItem(copyKey);
      if (rawCopyPayload) {
        sessionStorage.removeItem(copyKey);
        const proceed = !data.customPackage || window.confirm(
          "This will replace your current draft's title, itinerary, inclusions/exclusions and terms with the package you picked. Continue?",
        );
        if (proceed) {
          try {
            const payload = JSON.parse(rawCopyPayload) as PackageCopyPayload;
            // An empty payload.coverImage/startingPoint (the catalog package
            // has no photo, and never carries a query-specific starting
            // point) should never blank out what's already there — only
            // overwrite when the package actually supplies a value.
            setForm((f) => ({
              ...f,
              ...payload,
              // Same renumber-by-position safety as the cp.itineraries load
              // above — don't trust the catalog package's stored day numbers.
              itineraries: payload.itineraries.map((it, idx) => ({ ...it, day: idx + 1 })),
              coverImage: payload.coverImage || f.coverImage,
              startingPoint: payload.startingPoint || f.startingPoint,
            }));
            toast.success(`Copied "${payload.title}" into this draft`);
          } catch (err) {
            console.error("Failed to apply copied package payload", err);
          }
        }
      }

      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [packageId, fromQueryId, resetForm, setForm]);

  // ── Auto-calc total price ──────────────────────────────────────────────────
  useEffect(() => {
    const pp = parseFloat(form.pricePerPerson);
    if (!isNaN(pp)) {
      setForm((f) => ({ ...f, totalPrice: String(pp * (f.adults + f.children)) }));
    }
  }, [form.pricePerPerson, form.adults, form.children, setForm]);

  // ── Auto-price from travel date + hotel selected + pax counts ──────────────
  // Recomputes the real hotel cost (season/occupancy-aware) whenever any of
  // those three inputs change — the sales exec still applies it manually via
  // the "Use this price" button so an already-typed price isn't clobbered.
  const roomPricingKey = form.itineraries
    .map((it) => `${it.day}:${it.roomPricingId ?? ""}:${it.roomsCount ?? ""}:${it.manualExtraBeds ?? ""}:${JSON.stringify(it.extraRooms ?? [])}:${it.manualHotelPricePerNight ?? ""}:${it.manualExtraBedRate ?? ""}:${it.hotelPriceOverride ?? ""}`)
    .join("|");
  useEffect(() => {
    const days = form.itineraries.map((it) => ({
      day: it.day, roomPricingId: it.roomPricingId, roomsCount: it.roomsCount, manualExtraBeds: it.manualExtraBeds, extraRooms: it.extraRooms,
      manualHotelPricePerNight: it.manualHotelPricePerNight,
      manualExtraBedRate: it.manualExtraBedRate,
      hotelPriceOverride: it.hotelPriceOverride,
      ...splitManualHotelName(it.accommodation),
    }));
    if (days.every((d) => d.roomPricingId == null && (d.extraRooms ?? []).length === 0 && d.manualHotelPricePerNight == null && d.hotelPriceOverride == null)) {
      setHotelPricing(null);
      return;
    }
    let cancelled = false;
    setComputingPrice(true);
    const timer = setTimeout(async () => {
      const result = await computeBuilderHotelPricing({
        travelDate: form.travelDate || null,
        adults: form.adults,
        children: form.children,
        days,
      });
      if (cancelled) return;
      setHotelPricing(result);
      setComputingPrice(false);
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.travelDate, form.adults, form.children, roomPricingKey]);

  // ── Auto-price from travel date + cab selected ──────────────────────────────
  // Same pattern as the hotel effect above — PER_DAY cabs are priced per the
  // day they're assigned to (season/weekday-weekend aware), PER_KM cabs by
  // that day's transportDistanceKm, so a multi-day cab hire naturally sums
  // across however many days it was applied to.
  // Per-day cost for the preview's own cost chips — folded together from the
  // two pricing results the effects above already compute, so this adds no
  // work and can never disagree with the breakdown they feed.
  const dayCosts = useMemo(() => {
    const map = new Map<number, DayCost>();
    const put = (day: number, patch: Partial<DayCost>) => {
      const cur = map.get(day) ?? { hotel: 0, cab: 0, total: 0, overridden: false };
      const next = { ...cur, ...patch };
      next.total = next.hotel + next.cab;
      map.set(day, next);
    };
    for (const d of hotelPricing?.days ?? []) {
      put(d.day, { hotel: d.total, overridden: !!d.overridden });
    }
    for (const d of cabPricing?.days ?? []) {
      const cur = map.get(d.day);
      put(d.day, { cab: d.total, overridden: (cur?.overridden ?? false) || !!d.overridden });
    }
    return map;
  }, [hotelPricing, cabPricing]);

  const cabPricingKey = form.itineraries
    .map((it) => `${it.day}:${it.cabPricingId ?? ""}:${it.transportDistanceKm ?? ""}:${it.cabQuantity ?? ""}:${JSON.stringify(it.extraCabs ?? [])}:${it.cabPriceOverride ?? ""}`)
    .join("|");
  useEffect(() => {
    const days = form.itineraries.map((it) => ({
      day: it.day, cabPricingId: it.cabPricingId, transportDistanceKm: it.transportDistanceKm,
      cabQuantity: it.cabQuantity, extraCabs: it.extraCabs,
      cabPriceOverride: it.cabPriceOverride,
    }));
    if (days.every((d) => d.cabPricingId == null && (d.extraCabs ?? []).length === 0 && d.cabPriceOverride == null)) {
      setCabPricing(null);
      return;
    }
    let cancelled = false;
    setComputingCabPrice(true);
    const timer = setTimeout(async () => {
      const result = await computeBuilderCabPricing({
        travelDate: form.travelDate || null,
        days,
      });
      if (cancelled) return;
      setCabPricing(result);
      setComputingCabPrice(false);
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.travelDate, cabPricingKey]);

  // ── Resolve real destination photos for the preview's "Places" strip ───────
  const stopNamesKey = form.stops.map((s) => s.name.trim()).filter(Boolean).join("|");
  useEffect(() => {
    const names = [...new Set(form.stops.map((s) => s.name.trim()).filter(Boolean))];
    const missing = names.filter((n) => !(n in stopImages));
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        missing.map(async (name) => [name, await getDestinationCoverImage(name)] as const),
      );
      if (cancelled) return;
      setStopImages((prev) => {
        const next = { ...prev };
        for (const [name, url] of entries) next[name] = url;
        return next;
      });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopNamesKey]);

  // ── Margin + GST walkthrough ─────────────────────────────────────────────
  // base_cost (hotel + cab, computed above) → + margin% → taxable → + gst% →
  // final_price — same walkthrough the admin catalog's full pricing engine
  // uses (computePackagePrice in package-pricing.service.ts), just without
  // the meal/activity/permit layers that only exist for catalog packages.
  // Flight/train fares only ever carry a flat 5% margin — never the
  // configurable hotel/cab margin (25% by default) — since tickets are
  // priced closer to cost and don't bear the same markup as inventory the
  // agency sources and stays in.
  const TICKET_MARGIN_PCT = 5;

  function computeFinalPricing() {
    const marginPct = parseFloat(form.marginPercentage) || 0;
    const gstPct = parseFloat(form.gstPercentage) || 0;
    const hotelCabBase = (hotelPricing?.hotelSubtotal ?? 0) + (cabPricing?.cabSubtotal ?? 0);
    const ticketsSubtotal = form.tickets.reduce((sum, t) => sum + (t.fare ?? 0), 0);
    // Add-ons (honeymoon kit, permits, etc.) carry the same configurable
    // margin as hotel/cab — unlike tickets, which are priced closer to cost.
    const addonsSubtotal = form.addOns.reduce((sum, a) => sum + (a.price ?? 0) * (a.quantity || 1), 0);
    const baseCost = hotelCabBase + addonsSubtotal + ticketsSubtotal;

    const hotelCabMarginAmount = Math.round((hotelCabBase + addonsSubtotal) * marginPct / 100);
    const ticketsMarginAmount = Math.round(ticketsSubtotal * TICKET_MARGIN_PCT / 100);
    const marginAmount = hotelCabMarginAmount + ticketsMarginAmount;

    const taxable = baseCost + marginAmount;
    const gstAmount = Math.round(taxable * gstPct / 100);
    const finalPrice = taxable + gstAmount;
    const totalPax = form.adults + form.children;
    const perPerson = totalPax > 0 ? Math.round(finalPrice / totalPax) : finalPrice;
    return {
      marginPct, gstPct, baseCost, ticketsSubtotal, hotelCabBase, addonsSubtotal,
      hotelCabMarginAmount, ticketsMarginAmount, marginAmount,
      taxable, gstAmount, finalPrice, perPerson,
    };
  }

  function applyComputedPricing() {
    const { finalPrice, perPerson } = computeFinalPricing();
    if (finalPrice <= 0) return;
    setForm((f) => ({ ...f, pricePerPerson: String(perPerson) }));
  }

  // Re-syncs `query` AND the price fields inside `form` from a fresh fetch.
  // `form` is local state hydrated once on mount (see the initial load effect
  // above) — a bare `setQuery(fresh)` after an action like Request Revision
  // updates `isLocked`/`pkgVerified` so the fieldset unlocks, but leaves
  // `form.pricePerPerson`/`totalPrice` sitting at whatever was last loaded
  // into this tab. Without this, an exec who pulls an already-priced package
  // back for revision and saves (without touching the price field) writes
  // that stale number straight over whatever costing had corrected it to.
  function syncPricingFromFresh(fresh: QueryDetail) {
    setQuery(fresh);
    const cp = fresh.customPackage;
    if (cp) {
      setForm((f) => ({
        ...f,
        pricePerPerson: cp.pricePerPerson?.toString() ?? "",
        totalPrice: cp.totalPrice?.toString() ?? "",
        marginPercentage: cp.marginPercentage?.toString() ?? f.marginPercentage,
        gstPercentage: cp.gstPercentage?.toString() ?? f.gstPercentage,
      }));
    }
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  function handleSave(status: "DRAFT" | "READY" = "DRAFT") {
    startSave(async () => {
      const result = await saveCustomPackage({
        id: packageId,
        queryId: query?.id ?? null,
        ...form,
        pricePerPerson: form.pricePerPerson ? parseFloat(form.pricePerPerson) : null,
        totalPrice: form.totalPrice ? parseFloat(form.totalPrice) : null,
        marginPercentage: parseFloat(form.marginPercentage) || 0,
        gstPercentage: parseFloat(form.gstPercentage) || 0,
        status,
      });
      if (result.success) {
        // The server now has it, so the crash-recovery copy is redundant.
        localDraft.clear();
        setSavedOk(true);
        setTimeout(() => setSavedOk(false), 3000);
      } else {
        toast.error(result.error ?? "Failed to save");
      }
    });
  }

  // ── Mark ready for costing review ───────────────────────────────────────────
  // ── Autosave ────────────────────────────────────────────────────────────────
  // Deliberately conservative, because this writes real data:
  //
  //   • DRAFT only. A package under costing review (READY) or already SENT is
  //     never touched — those are locked anyway, and silently rewriting one
  //     mid-review is precisely the thing nobody would forgive.
  //   • Never on load. It arms only after the first real edit, so opening a
  //     package and closing it again writes nothing.
  //   • Never changes status. It is exactly the "Save Draft" the exec already
  //     presses, on a timer.
  //
  // Explicit Save Draft stays: autosave removes the tax of remembering it, not
  // the ability to force one.
  // The other half of autosave: a localStorage copy written every ~800ms, so a
  // crash, a closed laptop or a stray refresh can't lose the seconds between
  // server saves. Cleared whenever a server save lands, which is what makes a
  // draft's mere existence mean "there was unsaved work".
  const localDraft = useLocalDraft<PackageForm>({
    packageId,
    form,
    armed: !loading && !!query && query.customPackage?.status !== "READY",
  });

  const AUTOSAVE_DELAY_MS = 3000;
  const autosaveArmed = useRef(false);
  const lastSavedSnapshot = useRef<string | null>(null);

  useEffect(() => {
    if (loading || !query) return;
    const status = query.customPackage?.status;
    if (status && status !== "DRAFT") return;

    const snapshot = JSON.stringify(form);
    // First pass after load records the baseline without saving — this is what
    // stops a freshly-opened package from writing itself back untouched.
    if (!autosaveArmed.current) {
      autosaveArmed.current = true;
      lastSavedSnapshot.current = snapshot;
      return;
    }
    if (snapshot === lastSavedSnapshot.current) return;

    const timer = setTimeout(() => {
      lastSavedSnapshot.current = snapshot;
      handleSave("DRAFT");
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
    // handleSave is stable enough for this purpose and intentionally omitted —
    // including it would re-arm the timer on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, loading, query]);

  // The ONLY way a package moves forward from the builder into review — no
  // direct "send to client" from here. This locks nothing and notifies no
  // one; it just hands the package to /dashboard/verify-packages, where
  // costing either approves the pricing (see approveCustomPackage in
  // verify-packages/actions.ts — sending is a separate step below, triggered
  // by the exec once approved) or rejects it back to DRAFT with a reason for
  // the exec to fix and resubmit.
  // Validates first, then opens the confirm dialog (see confirmReadyOpen) —
  // the actual submit only runs once the exec confirms they understand this
  // locks out further edits until costing verifies or rejects it.
  function handleMarkReadyClick() {
    const validationError = validateItineraryRequiredFields(form);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    const pendingDay = form.itineraries.find((it) => it.hotelPending);
    if (pendingDay) {
      toast.error(`Day ${pendingDay.day} is still awaiting the hotel team — fill in or undo the pending hotel request before submitting for review.`);
      return;
    }
    setConfirmReadyOpen(true);
  }

  function handleMarkReady() {
    setConfirmReadyOpen(false);
    startSend(async () => {
      // Always save first — markPackageReady reads nothing from the client,
      // but the review page does, straight from the DB row, so any edit made
      // since the last save would otherwise silently never reach costing.
      const result = await saveCustomPackage({
        id: packageId,
        queryId: query?.id ?? null,
        ...form,
        pricePerPerson: form.pricePerPerson ? parseFloat(form.pricePerPerson) : null,
        totalPrice: form.totalPrice ? parseFloat(form.totalPrice) : null,
        marginPercentage: parseFloat(form.marginPercentage) || 0,
        gstPercentage: parseFloat(form.gstPercentage) || 0,
        status: "READY",
      });
      if (!result.success) {
        toast.error(result.error ?? "Failed to save");
        return;
      }

      const result2 = await markPackageReady(packageId);
      if (result2.success) {
        toast.success("Submitted for costing review");
        // Without this, `query.customPackage.status` stays whatever it was
        // at page load, so `isLocked` never flips true — the fieldset stays
        // enabled and Mark Ready stays visible/clickable until a manual
        // reload, letting the exec keep editing a package that's already
        // out for costing review.
        const fresh = await getPackageDetail(packageId);
        if (fresh) syncPricingFromFresh(fresh);
      } else {
        toast.error(result2.error ?? "Failed to mark package ready");
      }
    });
  }

  // ── Share with client (only once costing has approved the pricing) ─────────
  // Opens the WhatsApp deep link (needs a real click to avoid the popup
  // blocker — see the toast action below) and best-effort emails the client.
  // This is the exec's own send step, reintroduced after being folded into
  // costing's approval for a while — see shareCustomPackageWithClient.
  function handleShareClick() {
    setConfirmShareOpen(true);
  }

  function handleShare() {
    setConfirmShareOpen(false);
    startShare(async () => {
      const result = await shareCustomPackageWithClient(packageId);
      if (result.success) {
        toast.success("Sent to client", result.whatsappUrl ? {
          action: { label: "Open WhatsApp", onClick: () => window.open(result.whatsappUrl, "_blank") },
          duration: 15000,
        } : undefined);
        if (result.shareUrl) {
          try {
            await navigator.clipboard.writeText(result.shareUrl);
            toast.info("Client link copied to clipboard");
          } catch {
            // Clipboard access can be denied (permissions/insecure context) —
            // the WhatsApp message already includes the link either way, so
            // this is a convenience, not something worth erroring over.
          }
        }
        const fresh = await getPackageDetail(packageId);
        if (fresh) syncPricingFromFresh(fresh);
      } else {
        toast.error(result.error ?? "Failed to send package");
      }
    });
  }







  /** Single handler for every editable photo in the live preview (stops,
   * hotel, room, transport, activities) — the edit button's ImageEditTarget
   * says exactly which one, so there's one place that knows how to write
   * each into `form` instead of a callback per photo. */
  function handleItineraryImageChange(target: ImageEditTarget, url: string) {
    if (target.kind === "stop") {
      setForm((f) => ({
        ...f,
        stops: f.stops.map((s, i) => (i === target.stopIndex ? { ...s, image: url } : s)),
      }));
      return;
    }
    setForm((f) => ({
      ...f,
      itineraries: f.itineraries.map((d) => {
        if (d.day !== target.day) return d;
        switch (target.kind) {
          case "accommodationPhoto":
            return { ...d, accommodationPhoto: url };
          case "transportPhoto":
            return { ...d, transportPhoto: url };
          case "roomPhoto": {
            const photos = [...d.accommodationRoomPhotos];
            photos[target.photoIndex] = url;
            return { ...d, accommodationRoomPhotos: photos };
          }
          case "activityPhoto": {
            const activities = d.activities.map((a, i) => {
              if (i !== target.activityIndex) return a;
              const photos = a.photos.length > 0 ? [...a.photos] : (a.photo ? [a.photo] : []);
              // Slots can now be filled out of order (e.g. the 3rd tile
              // before the 2nd, since all 3 show as soon as any exist) —
              // pad with "" instead of leaving a sparse hole, which
              // downstream .map()/rendering would otherwise see as undefined.
              while (photos.length < target.photoIndex) photos.push("");
              photos[target.photoIndex] = url;
              return { ...a, photos, photo: photos[0] ?? a.photo };
            });
            return { ...d, activities };
          }
          default:
            return d;
        }
      }),
    }));
  }

  /** Companion to handleItineraryImageChange for the caption shown under an
   * activity photo (`photoLabels[i]`), edited from the same dialog. */
  function handleActivityCaptionChange(day: number, activityIndex: number, photoIndex: number, caption: string) {
    setForm((f) => ({
      ...f,
      itineraries: f.itineraries.map((d) => {
        if (d.day !== day) return d;
        const activities = d.activities.map((a, i) => {
          if (i !== activityIndex) return a;
          const photoLabels = [...a.photoLabels];
          photoLabels[photoIndex] = caption;
          return { ...a, photoLabels };
        });
        return { ...d, activities };
      }),
    }));
  }

  function addTicket(type: TicketInput["type"]) {
    setForm((f) => ({
      ...f,
      tickets: [...f.tickets, {
        ...emptyTicket(type),
        fromPlace: f.startingPoint,
        travelDate: f.travelDate,
        adults: f.adults, children: f.children, infants: f.infants,
        ticketCount: Math.max(1, f.adults + f.children),
      }],
    }));
  }

  function updateTicket(idx: number, patch: Partial<TicketInput>) {
    setForm((f) => ({
      ...f,
      tickets: f.tickets.map((t, i) => (i === idx ? { ...t, ...patch } : t)),
    }));
  }

  function removeTicket(idx: number) {
    setForm((f) => ({ ...f, tickets: f.tickets.filter((_, i) => i !== idx) }));
  }

  function addAddon(day: number | null = null) {
    setForm((f) => ({
      ...f,
      addOns: [...f.addOns, { name: "", price: null, quantity: 1, notes: "", day }],
    }));
  }

  function updateAddon(idx: number, patch: Partial<AddonInput>) {
    setForm((f) => ({
      ...f,
      addOns: f.addOns.map((a, i) => (i === idx ? { ...a, ...patch } : a)),
    }));
  }

  function removeAddon(idx: number) {
    setForm((f) => ({ ...f, addOns: f.addOns.filter((_, i) => i !== idx) }));
  }

  /** Reuses one picked cab across multiple days — only the vehicle itself
   * (and its cab_pricing row, when the pick was priced) carries over;
   * pickup/drop/distance stay per-day since those are route-specific. */
  function applyVehicleToDays(vehicle: VehicleResult, dayNumbers: number[], cabPricingId: number | null) {
    setForm((f) => ({
      ...f,
      itineraries: f.itineraries.map((it) =>
        dayNumbers.includes(it.day)
          ? {
              ...it,
              transport: vehicle.name,
              transportPhoto: vehicle.thumbnail ?? it.transportPhoto,
              transportVehicleType: CAB_LABELS[vehicle.type] ?? vehicle.type,
              transportSeats: vehicle.passengerCapacity,
              cabPricingId,
              // Same override-invalidation updateDay does for a single-day
              // pick — this bulk "apply to remaining days" path sets
              // cabPricingId directly via setForm, bypassing updateDay
              // entirely, so a stale costing correction from a previous
              // review cycle was never cleared here. Left the live preview
              // (and the pricing costing sees on resubmit) pinned to the old
              // corrected price instead of the newly-applied vehicle's real
              // rate — every "apply to remaining days" click IS a cab
              // change, so this is unconditional, no comparison needed.
              cabPriceOverride: null,
            }
          : it,
      ),
    }));
  }

  /** Reuses one picked hotel room across multiple nights — mirrors
   * applyVehicleToDays above, so a 3-night stay at the same hotel doesn't
   * need re-searching for every single day. */
  function applyRoomToDays(room: HotelRoomResult, dayNumbers: number[]) {
    const hotelMeals = room.coveredMeals.map((k) => MEAL_KEY_LABELS[k]).filter((v): v is string => !!v);
    setForm((f) => ({
      ...f,
      itineraries: f.itineraries.map((it) =>
        dayNumbers.includes(it.day)
          ? {
              ...it,
              accommodation: `${room.hotelName} — ${room.roomName}`,
              accommodationPhoto: room.hotelPhoto ?? it.accommodationPhoto,
              accommodationRoomPhotos: room.roomPhotos.length > 0 ? room.roomPhotos : it.accommodationRoomPhotos,
              accommodationLocation: room.location ?? it.accommodationLocation,
              accommodationRoomSpecs: room.roomSpecs ?? it.accommodationRoomSpecs,
              accommodationRoomCapacity: room.roomCapacity ?? it.accommodationRoomCapacity,
              accommodationMaxAdults: room.maxAdults,
              accommodationMaxChildren: room.maxChildren,
              accommodationExtraBedCapacity: room.extraBedCapacity,
              manualExtraBeds: null,
              manualHotelPricePerNight: null, manualExtraBedRate: null,
              hotelMealPlan: room.mealPlanName ?? it.hotelMealPlan,
              meals: hotelMeals.length > 0 ? hotelMeals : it.meals,
              hotelCheckIn: room.checkInTime ? formatTime12h(room.checkInTime) : it.hotelCheckIn,
              hotelCheckOut: room.checkOutTime ? formatTime12h(room.checkOutTime) : it.hotelCheckOut,
              roomPricingId: room.id,
              // See cabPriceOverride note in applyVehicleToDays above — same
              // bug, same fix, hotel side. This is the exact path a multi-
              // night "apply to the rest of the stay" pick goes through, so
              // it's the most-hit case of the stale-override bug in practice.
              hotelPriceOverride: null,
            }
          : it,
      ),
    }));
  }

  /** Clears every hotel-related field for the given days — including
   * roomPricingId, which is what the pricing engine actually keys off. Just
   * blanking the visible accommodation text/photo (the only thing an exec
   * could previously do without a dedicated button) left roomPricingId
   * pointing at the old room, so the price kept showing even though the
   * card looked empty — this is the one action guaranteed to zero it out. */
  function removeRoomFromDays(dayNumbers: number[]) {
    setForm((f) => ({
      ...f,
      itineraries: f.itineraries.map((it) =>
        dayNumbers.includes(it.day)
          ? {
              ...it,
              accommodation: "", accommodationPhoto: "", accommodationRoomPhotos: [],
              accommodationLocation: "", accommodationRoomSpecs: "", accommodationRoomCapacity: null,
              accommodationMaxAdults: null, accommodationMaxChildren: null, accommodationExtraBedCapacity: null,
              roomPricingId: null, roomsCount: null, extraRooms: [], manualExtraBeds: null,
              manualHotelPricePerNight: null, manualExtraBedRate: null,
              hotelCheckIn: "", hotelCheckOut: "", hotelMealPlan: "", meals: [],
              // See applyRoomToDays — a removal is as much a "hotel changed"
              // event as a new pick, so any lingering costing correction for
              // this day no longer means anything either.
              hotelPriceOverride: null,
            }
          : it,
      ),
    }));
  }

  /** Same idea as removeRoomFromDays, for the cab side — zeroes cabPricingId
   * (and any extra cabs) so a removed vehicle stops contributing to price.
   * Pickup/drop/distance/travel-time are left alone since those describe the
   * route itself, not which vehicle is doing it — removing the cab just
   * means "no vehicle picked yet for this route", not "forget the route". */
  function removeCabFromDays(dayNumbers: number[]) {
    setForm((f) => ({
      ...f,
      itineraries: f.itineraries.map((it) =>
        dayNumbers.includes(it.day)
          ? {
              ...it,
              transport: "", transportPhoto: "", transportVehicleType: "", transportSeats: null,
              cabPricingId: null, cabQuantity: null, extraCabs: [],
              cabPriceOverride: null,
            }
          : it,
      ),
    }));
  }

  /** Fills in a sensible starting title for any day that doesn't already
   * have one — pure templating from the route stops, no AI call. Never
   * touches a day that already has a title, so it's safe to run repeatedly
   * (e.g. after adding a day) without clobbering manual edits. */
  function autoFillDayTitles() {
    setForm((f) => {
      const locations = deriveDayLocations(f.stops, f.itineraries.length);
      return {
        ...f,
        itineraries: f.itineraries.map((it, idx) => {
          if (it.title.trim()) return it;
          const loc = locations[idx] || f.destination || "your destination";
          const isFirst = idx === 0;
          const isLast = idx === f.itineraries.length - 1 && f.itineraries.length > 1;
          const title = isFirst
            ? `Arrival in ${loc}`
            : isLast
              ? `Departure from ${loc}`
              : `${loc} Sightseeing`;
          return { ...it, title };
        }),
      };
    });
  }

  /** Fills the first day's pickup point and the last day's drop point when
   * they're empty — from the client's requirement form (Departure/Pickup
   * Point(s)) if set, else the route's first/last stop. Mirrors
   * autoFillDayTitles: never touches a day that already has a value, so
   * it's safe to run again after adding stops or editing requirements. */
  function autoFillPickupDrop() {
    const j = query?.requirements?.journey;
    const requirementPickup = j?.departurePoints?.[0] || j?.pickupPoints?.[0] || "";
    setForm((f) => {
      if (f.itineraries.length === 0) return f;
      const locations = deriveDayLocations(f.stops, f.itineraries.length);
      const firstLoc = locations[0] || f.destination || "";
      const lastLoc = locations[locations.length - 1] || f.destination || "";
      const lastIdx = f.itineraries.length - 1;
      return {
        ...f,
        itineraries: f.itineraries.map((it, idx) => {
          let next = it;
          if (idx === 0 && !next.transportPickup.trim()) {
            const pickup = requirementPickup || firstLoc;
            if (pickup) next = { ...next, transportPickup: pickup };
          }
          if (idx === lastIdx && !next.transportDrop.trim() && lastLoc) {
            next = { ...next, transportDrop: lastLoc };
          }
          return next;
        }),
      };
    });
  }

  // ── AI Itinerary Builder ────────────────────────────────────────────────────
  // Copy-a-prompt / paste-back-JSON workflow: no direct LLM API call from this
  // app — the exec copies the generated prompt into their own ChatGPT session,
  // pastes the JSON it returns back here, and we parse + merge it into the
  // form. Kept strictly additive (never overwrites a day/field the exec has
  // already filled in), same philosophy as autoFillDayTitles/autoFillPickupDrop.

  /** Builds the copy-paste prompt from the package's current state — title,
   * day count, destinations with night counts (falls back to the single
   * `destination` + total nights when no stops have been added yet), pickup
   * point, and the last day's drop point. */
  function buildAIPrompt(): string {
    const destinationsLine = form.stops.length > 0
      ? form.stops.map((s) => `${s.name} (${s.nights} Night${s.nights !== 1 ? "s" : ""})`).join(", ")
      : `${form.destination || "the destination"} (${Math.max(form.totalNights, 1)} Night${Math.max(form.totalNights, 1) !== 1 ? "s" : ""})`;
    const pickup = form.startingPoint.trim() || "(not specified — choose a sensible pickup point for this destination)";
    const lastDay = form.itineraries[form.itineraries.length - 1];
    const drop = lastDay?.transportDrop.trim() || "(not specified — same as the pickup point unless the route suggests otherwise)";
    const totalPax = form.adults + form.children;
    const paxLine = `${form.adults} Adult${form.adults !== 1 ? "s" : ""}` +
      (form.children > 0 ? ` + ${form.children} Child${form.children !== 1 ? "ren" : ""}` : "");

    return `AI Itinerary Builder Prompt

Create a JSON itinerary for my travel package builder tool so I can paste it directly. Respond with the JSON wrapped in a single \`\`\`json code block — nothing before or after it, no explanation. This matters because I'll copy it using the code block's own copy button.

Critical: every value in the JSON must be a plain string — never a markdown link or citation like [text](url). If you look anything up (e.g. to find real image URLs), still write the result as a plain string value, not a hyperlink/citation. A markdown link anywhere inside the JSON will break the import.

Package: "${form.title || "Untitled Package"}" — ${form.totalDays} Day${form.totalDays !== 1 ? "s" : ""} / ${form.totalNights} Night${form.totalNights !== 1 ? "s" : ""}
Destinations (in order, with nights at each): ${destinationsLine}
Travellers: ${paxLine}${totalPax === 0 ? " (assume 2 adults if unspecified)" : ""}
Pickup point: ${pickup}
Drop point: ${drop}

Spend the itinerary days in the order the destinations are listed, matching the night count at each one.

Return exactly this JSON shape:

{
  "description": "2-3 sentence overview of the whole trip",
  "coverImage": "<a real, working, high-quality landscape photo URL representing the overall trip>",
  "stops": [
    { "name": "<destination name, matching the list above>", "image": "<real landscape photo URL of this destination>" }
  ],
  "days": [
    {
      "day": 1,
      "title": "<day title, under 10 words>",
      "description": "<day description, 35-55 words — see style example below>",
      "transportPickup": "<pickup point for this day's transfer>",
      "transportDrop": "<drop point for this day's transfer>",
      "transportDistanceKm": <approximate distance in km as a number>,
      "travelTimeApprox": "<approx travel time, e.g. \\"2h 30m\\">",
      "activities": [
        {
          "title": "<activity title, a short descriptive phrase — see style example below>",
          "description": "<activity description, 25-40 words — see style example below>",
          "photos": ["<real landscape photo URL 1>", "<real landscape photo URL 2>", "<real landscape photo URL 3>"]
        }
      ]
    }
  ]
}

Style examples (match this tone, level of detail, and length — not generic one-liners):

Day description:
"Arrive at Kochi Airport/Railway Station and meet your driver for a scenic drive to Munnar. En route enjoy waterfalls, tea gardens, and misty valleys. Check in to your hotel and relax in the cool mountain climate. Evening free for leisure or nearby nature walks. (paid activity at your own cost)."

Activity title + description:
"Tea Garden Walk in Munnar" — "Take a refreshing walk through Munnar's sprawling tea plantations, surrounded by rolling green hills and fresh mountain air. Enjoy scenic views, learn about tea cultivation, and experience the tranquil beauty of Kerala's famous hill station."

Note activity titles are a full descriptive phrase naming the place (e.g. "Tea Garden Walk in Munnar", "Fort Kochi Heritage Walk") — never a bare noun like "Tea Gardens" or "Fort Kochi" alone.

Rules:
- Exactly one "days" entry per day (${form.totalDays} total), numbered sequentially from 1.
- 2-3 activities per day is enough — don't overload the day.
- Every image must be a REAL, WORKING, direct image URL that actually loads — from Unsplash, Pexels, Pixabay, a Google Images result, or any other real photo source. Landscape orientation, high quality, visually relevant to that destination/activity. Double-check each URL is real before including it — do not invent or guess a URL.
- Do not include hotel or cab pricing/selection — that's handled separately, manually.
- Keep titles and descriptions professional and vivid, matching the style examples above — no fluff, no emojis.
- One more time: no markdown links, no citations, no [text](url) formatting anywhere in the JSON — plain strings only. Wrap the whole response in a single \`\`\`json code block.`;
  }

  function copyAIPrompt() {
    navigator.clipboard.writeText(buildAIPrompt());
    toast.success("Prompt copied — paste it into ChatGPT, then paste the JSON it gives you back here.");
  }

  type AIItineraryActivity = { title?: string; description?: string; photos?: string[] };
  type AIItineraryDay = {
    day?: number; title?: string; description?: string;
    transportPickup?: string; transportDrop?: string; transportDistanceKm?: number;
    travelTimeApprox?: string; activities?: AIItineraryActivity[];
  };
  type AIItineraryResponse = {
    description?: string; coverImage?: string;
    stops?: { name?: string; image?: string }[];
    days?: AIItineraryDay[];
  };

  /** Parses the pasted JSON and merges it into the form — fills only empty
   * fields (title/description/pickup/drop/distance), replaces a day's
   * activities only when that day currently has none, and extends the
   * itinerary if the response has more days than currently exist. Never
   * touches hotel/cab selection (roomPricingId/cabPricingId untouched). */
  function applyAIItinerary() {
    let parsed: AIItineraryResponse;
    try {
      const cleaned = aiJsonInput.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      toast.error("That doesn't look like valid JSON — check the format and try again.");
      return;
    }
    if (!parsed || typeof parsed !== "object") {
      toast.error("Unexpected response shape — please try again.");
      return;
    }
    if (looksLikeMarkdownLinkCorruption(parsed)) {
      toast.error(
        "This response looks corrupted — it has markdown links mixed into the text (a common artifact of copying from ChatGPT's chat bubble instead of its code block). Ask it to resend as a single ```json code block with no citations, then paste that instead.",
        { duration: 9000 },
      );
      return;
    }

    try {
      setForm((f) => {
        const next = { ...f };

        if (parsed.description && !next.description.trim()) next.description = parsed.description;
        if (parsed.coverImage && !next.coverImage.trim()) next.coverImage = parsed.coverImage;

        if (Array.isArray(parsed.stops) && parsed.stops.length > 0) {
          const validStops = parsed.stops.filter((s): s is { name: string; image?: string } => !!s?.name);
          if (next.stops.length === 0 && validStops.length > 0) {
            const perStopNights = Math.max(1, Math.round((next.totalNights || validStops.length) / validStops.length));
            next.stops = validStops.map((s) => ({ name: s.name, nights: perStopNights, image: s.image || undefined }));
          } else {
            next.stops = next.stops.map((st) => {
              if (st.image) return st;
              const match = validStops.find((s) => s.name.trim().toLowerCase() === st.name.trim().toLowerCase());
              return match?.image ? { ...st, image: match.image } : st;
            });
          }
        }

        if (Array.isArray(parsed.days) && parsed.days.length > 0) {
          const byDayNum = new Map<number, AIItineraryDay>();
          parsed.days.forEach((d, i) => { if (d) byDayNum.set(d.day ?? i + 1, d); });

          let itineraries = next.itineraries;
          if (parsed.days.length > itineraries.length) {
            const extra = Array.from(
              { length: parsed.days.length - itineraries.length },
              (_, i) => emptyDay(itineraries.length + i + 1),
            );
            itineraries = [...itineraries, ...extra];
            next.totalDays = itineraries.length;
            next.totalNights = Math.max(0, itineraries.length - 1);
          }

          next.itineraries = itineraries.map((day) => {
            const src = byDayNum.get(day.day);
            if (!src) return day;
            const updated = { ...day };
            if (src.title && !updated.title.trim()) updated.title = src.title;
            if (src.description && !updated.description.trim()) updated.description = src.description;
            if (src.transportPickup && !updated.transportPickup.trim()) updated.transportPickup = src.transportPickup;
            if (src.transportDrop && !updated.transportDrop.trim()) updated.transportDrop = src.transportDrop;
            if (src.transportDistanceKm != null && updated.transportDistanceKm == null) updated.transportDistanceKm = src.transportDistanceKm;
            if (src.travelTimeApprox && !updated.transportTravelTime.trim()) updated.transportTravelTime = src.travelTimeApprox;
            if (Array.isArray(src.activities) && src.activities.length > 0 && updated.activities.every((a) => !a.title.trim())) {
              updated.activities = src.activities
                .filter((a): a is { title: string; description?: string; photos?: string[] } => !!a?.title)
                .map((a) => {
                  const photos = Array.isArray(a.photos) ? a.photos.filter((p): p is string => !!p).slice(0, 3) : [];
                  return {
                    title: a.title,
                    description: a.description ?? "",
                    photo: photos[0] ?? "",
                    photos,
                    photoLabels: photos.map(() => a.title),
                  };
                });
            }
            return updated;
          });
        }

        return next;
      });
    } catch {
      toast.error("Couldn't apply that response — its shape didn't match what was expected.");
      return;
    }

    setAiJsonInput("");
    setAiDialogOpen(false);
    toast.success("Itinerary generated from the AI response.");
  }

  function field<K extends keyof PackageForm>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  // Package-specific additions to the six standard lists — anyone (Sales
  // Executives included, who can't touch the standard lists themselves) can
  // add/remove these. See ExtraPolicyItems.
  function updateExtraPolicyItems<K extends keyof ExtraPolicyItems>(key: K, v: string[]) {
    setForm((f) => ({ ...f, extraPolicyItems: { ...f.extraPolicyItems, [key]: v } }));
  }

  async function useDestinationPhoto() {
    if (!form.destination) return;
    setIsFetchingCover(true);
    try {
      const url = await getDestinationCoverImage(form.destination);
      if (url) setForm((f) => ({ ...f, coverImage: url }));
    } finally {
      setIsFetchingCover(false);
    }
  }

  // ── Loading / not found ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-dashboard-base-200">
        <Loader2 className="animate-spin text-dashboard-primary h-8 w-8" />
      </div>
    );
  }
  if (!query) {
    return (
      <div className="h-screen flex items-center justify-center text-dashboard-base-content/50 text-sm bg-dashboard-base-200">
        Query not found.
      </div>
    );
  }

  const r = query.requirements;
  const j = r?.journey;
  const t = r?.travellers;
  const b = r?.budget;
  const s = r?.stay;
  const tr = r?.transport;
  const ac = r?.activities;

  // Awaiting costing review — no further edits allowed until it's either
  // approved, or rejected back to DRAFT with a reason. The read-only preview
  // pane stays fully visible either way; only the editor surface and
  // save/submit actions are gated. Left as status === "READY" alone (not
  // combined with verified) since editing stays locked for the whole review
  // + approved-awaiting-share window, not just the review part — the
  // Save Draft/Mark Ready action-button area below has its own, separate
  // four-state branching (draft / awaiting review / approved / sent) on top
  // of this.
  const isLocked = query.customPackage?.status === "READY";
  const pkgVerified = query.customPackage?.verified ?? false;
  const pkgSent = query.customPackage?.status === "SENT";

  const dayLocations = deriveDayLocations(form.stops, form.itineraries.length);
  const shiftedMeals = computeShiftedMeals(form.itineraries);
  // Per-section completion, for the focus-mode filter's "3/6" badges.
  const dayFlags = form.itineraries.map((d) => ({
    hotel: !!d.accommodation || d.hotelPending,
    cab: !!d.transport || d.cabPricingId != null,
    meals: d.meals.length > 0,
    activities: d.activities.some((a) => a.title.trim()),
  }));
  const focusDoneCounts: Partial<Record<FocusSection, number>> = {
    hotel: dayFlags.filter((f) => f.hotel).length,
    cab: dayFlags.filter((f) => f.cab).length,
    meals: dayFlags.filter((f) => f.meals).length,
    activities: dayFlags.filter((f) => f.activities).length,
  };

  // The live preview should never show "To be confirmed" once there's a real
  // hotel/cab cost to calculate from — falls back to the computed (margin +
  // GST inclusive) price for display only, per field, without touching
  // `form` itself so a manually-typed price (or an intentionally blank one
  // before any inventory is picked) is never clobbered.
  const computedPricingForPreview = computeFinalPricing();
  const previewForm: PreviewData = {
    ...form,
    pricePerPerson: form.pricePerPerson || (computedPricingForPreview.finalPrice > 0
      ? String(computedPricingForPreview.perPerson) : form.pricePerPerson),
    totalPrice: form.totalPrice || (computedPricingForPreview.finalPrice > 0
      ? String(computedPricingForPreview.finalPrice) : form.totalPrice),
    // The document only knows one flat list per section — merge this
    // package's additions in here rather than teaching it about the
    // global/extra split, since that distinction only matters for editing.
    // Inclusions/exclusions also drop anything costing vetoed during review
    // (removedInclusions/removedExclusions) — see
    // updatePackageInclusionsExclusions in verify-packages/actions.ts.
    inclusions: [...form.inclusions, ...form.extraPolicyItems.inclusions].filter((i) => !form.removedInclusions.includes(i)),
    exclusions: [...form.exclusions, ...form.extraPolicyItems.exclusions].filter((i) => !form.removedExclusions.includes(i)),
    termsConditions: [...form.termsConditions, ...form.extraPolicyItems.termsConditions],
    paymentPolicy: [...form.paymentPolicy, ...form.extraPolicyItems.paymentPolicy],
    amendmentPolicy: [...form.amendmentPolicy, ...form.extraPolicyItems.amendmentPolicy],
    travelBenefits: [...form.travelBenefits, ...form.extraPolicyItems.travelBenefits],
    stopImages,
    clientName: query.name ?? "",
    clientPhone: query.phone ? `${query.countryCode} ${query.phone}` : "",
    clientEmail: query.email ?? "",
    queryId: query.id,
    companySettings: itinerarySettings
      ? {
          phone: itinerarySettings.companyPhone,
          email: itinerarySettings.companyEmail,
          address: itinerarySettings.companyAddress,
          description: itinerarySettings.companyDescription,
          disclaimer: itinerarySettings.documentDisclaimer,
        }
      : undefined,
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    // h-screen + overflow-hidden (not min-h-screen) — this shell is meant to
    // scroll only inside the aside/main panels below, never as a whole page.
    // min-h-screen let the outer document grow past 100vh the moment
    // anything nudged it even slightly taller (flex min-height:auto quirks,
    // a border/rounding pixel, etc.), which handed the browser its own
    // page-level scrollbar — scrolling that dragged the sticky header and
    // everything else up and off-screen, with dead space revealed below.
    // Print already strips this via the `.print-reset` @media print rule in
    // ItineraryDocument's PRINT_STYLES (height: auto !important etc.), so
    // PDF export/print still gets the full, unclipped document.
    // Everything below can reach form state through useBuilder() instead of
    // having it threaded down as props — which is what lets the preview
    // document on the left edit the itinerary directly. canEdit carries the
    // same lock the right-hand panel has always honoured, from one place.
    <PackageBuilderProvider form={form} setForm={setForm} canEdit={!isLocked} dayCosts={dayCosts}>
    {/* Mounted once; what it shows is driven by the context's drawer target,
        so a clickable hotel in the preview doesn't need to own this UI. */}

    {/* Unsaved work found from a previous session. Restored on click rather
        than automatically: the draft is only ever a few seconds ahead of the
        server copy, so the cost of asking is one click, and the cost of
        silently resurrecting edits somebody deliberately abandoned is worse.
        Undo covers it either way once applied. */}
    {localDraft.found && (
      <div className="no-print fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 shadow-lg">
        <AlertCircle size={15} className="text-amber-600 shrink-0" />
        <p className="text-xs text-amber-900">
          Unsaved changes from {new Date(localDraft.found.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })} were
          recovered from this browser.
        </p>
        <Button
          type="button" size="sm"
          className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
          onClick={() => {
            const recovered = localDraft.found!.form;
            // Through setForm, not reset — restoring IS an edit, so undo can
            // take you back to the server copy if it wasn't what you wanted.
            setForm(() => recovered);
            localDraft.dismiss();
            toast.success("Unsaved changes restored");
          }}
        >
          Restore
        </Button>
        <button
          type="button"
          onClick={localDraft.dismiss}
          className="text-xs text-amber-800/70 hover:text-amber-900"
        >
          Discard
        </button>
      </div>
    )}
    <div className="print-reset h-screen overflow-hidden flex flex-col">

      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <header className="no-print sticky top-0 z-30 border-b border-dashboard-base-300 bg-dashboard-base-100/95 backdrop-blur shadow-xs">
        <div className="flex items-center justify-between px-4 h-14 gap-3">
          {/* Left */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => window.close()}
              className="text-dashboard-base-content/50 hover:text-dashboard-base-content transition-colors shrink-0 cursor-pointer"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <h1 className="text-sm font-bold truncate leading-tight text-dashboard-base-content">
                {query.name ?? "Blank Package"}
              </h1>
              <p className="text-xs text-dashboard-base-content/75 truncate">
                {j?.destinations?.join(" › ") ?? query.destination ?? "—"}
              </p>
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="lg:hidden h-8 gap-1 border-dashboard-base-300 hover:bg-dashboard-base-200 rounded-md"
              onClick={() => setMobilePreviewOpen(true)}
            >
              <Eye size={13} />
              <span className="text-xs">Preview</span>
            </Button>

            {!isLocked && (
              <CreatePackageDialog
                packageId={packageId}
                destination={j?.destinations?.join(", ") ?? query.destination ?? null}
                packageUrl={query.packageUrl}
                travelDate={j?.travelDate ?? (query.travelDate ? new Date(query.travelDate).toISOString().slice(0, 10) : null)}
                travellers={t ? { adults: t.adults, children: t.children, infants: t.infants } : null}
                budget={b && (b.min != null || b.max != null) ? { min: b.min, max: b.max, type: b.type } : null}
                duration={j?.noOfDays ? { days: j.noOfDays, nights: j.noOfNights } : null}
                queryReceivedAt={query.createdAt}
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 border-dashboard-base-300 hover:bg-dashboard-base-200 text-dashboard-base-content rounded-md"
                >
                  <Package size={13} />
                  <span className="hidden sm:inline text-xs">Change Template</span>
                </Button>
              </CreatePackageDialog>
            )}

            {pkgSent ? (
              <>
                <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-blue-100 text-blue-700 text-xs font-semibold">
                  <CheckCircle size={13} /> Sent to Client
                </span>
                <RequestRevisionDialog
                  packageId={packageId}
                  packageTitle={form.title}
                  onSuccess={async () => {
                    const fresh = await getPackageDetail(packageId);
                    if (fresh) syncPricingFromFresh(fresh);
                  }}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 border-dashboard-base-300 hover:bg-dashboard-base-200 text-dashboard-base-content rounded-md"
                  >
                    <RotateCcw size={13} />
                    <span className="hidden sm:inline text-xs">Request Revision</span>
                  </Button>
                </RequestRevisionDialog>
              </>
            ) : isLocked && pkgVerified ? (
              <>
                <RequestRevisionDialog
                  packageId={packageId}
                  packageTitle={form.title}
                  onSuccess={async () => {
                    const fresh = await getPackageDetail(packageId);
                    if (fresh) syncPricingFromFresh(fresh);
                  }}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 border-dashboard-base-300 hover:bg-dashboard-base-200 text-dashboard-base-content rounded-md"
                  >
                    <RotateCcw size={13} />
                    <span className="hidden sm:inline text-xs">Request Revision</span>
                  </Button>
                </RequestRevisionDialog>
                <Button
                  size="sm"
                  className="h-8 gap-1.5 bg-dashboard-success text-dashboard-success-content hover:bg-dashboard-success/90 rounded-md"
                  onClick={handleShareClick}
                  disabled={isSharing}
                >
                  {isSharing
                    ? <Loader2 size={13} className="animate-spin" />
                    : <Send size={13} />
                  }
                  <span className="hidden sm:inline text-xs">Share with Client</span>
                </Button>
              </>
            ) : isLocked ? (
              <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-amber-100 text-amber-700 text-xs font-semibold">
                <Clock size={13} /> Awaiting Costing Review
              </span>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 border-dashboard-base-300 hover:bg-dashboard-base-200 text-dashboard-base-content rounded-md"
                onClick={() => handleSave("DRAFT")}
                disabled={isSaving || isSending}
              >
                {isSaving
                  ? <Loader2 size={13} className="animate-spin" />
                  : savedOk
                    ? <CheckCircle size={13} className="text-dashboard-success" />
                    : <Save size={13} />
                }
                <span className="hidden sm:inline text-xs">
                  {savedOk ? "Saved!" : "Save Draft"}
                </span>
              </Button>
            )}

            {/* Running total, always visible. The breakdown still lives on the
                Pricing tab; what matters here is that the number moves while
                you work rather than only when you go looking for it. */}
            {(hotelPricing || cabPricing) && (
              <button
                type="button"
                onClick={() => setActiveTab("pricing")}
                title="Open the full pricing breakdown"
                className="hidden md:flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-dashboard-base-300 hover:bg-dashboard-base-200 transition-colors"
              >
                <span className="text-[10px] font-medium text-dashboard-base-content/50 uppercase tracking-wider">
                  Total
                </span>
                <span className="text-xs font-bold tabular-nums text-dashboard-base-content">
                  ₹{computeFinalPricing().finalPrice.toLocaleString("en-IN")}
                </span>
                {computingPrice || computingCabPrice ? (
                  <Loader2 size={11} className="animate-spin text-dashboard-base-content/40" />
                ) : null}
              </button>
            )}

            {/* Undo / redo. Hidden once the package is locked for costing
                review, where nothing is editable to undo in the first place. */}
            {!isLocked && (
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost" size="sm"
                  className="h-8 w-8 p-0 rounded-md"
                  onClick={history.undo}
                  disabled={!history.canUndo}
                  title="Undo (⌘Z)"
                  aria-label="Undo"
                >
                  <Undo2 size={14} />
                </Button>
                <Button
                  variant="ghost" size="sm"
                  className="h-8 w-8 p-0 rounded-md"
                  onClick={history.redo}
                  disabled={!history.canRedo}
                  title="Redo (⌘⇧Z)"
                  aria-label="Redo"
                >
                  <Redo2 size={14} />
                </Button>
              </div>
            )}

            <ItineraryPdfExport form={previewForm} />

            {!isLocked && !pkgSent && (
              <Button
                size="sm"
                className="h-8 gap-1.5 bg-dashboard-success text-dashboard-success-content hover:bg-dashboard-success/90 rounded-md"
                onClick={handleMarkReadyClick}
                disabled={isSending || isSaving}
                title={validateItineraryRequiredFields(form) ?? undefined}
              >
                {isSending
                  ? <Loader2 size={13} className="animate-spin" />
                  : <Send size={13} />
                }
                <span className="hidden sm:inline text-xs">Mark Ready</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* ── Body: Preview (left) + Tabbed Editor (right) ─────────────────────────── */}
      {/* justify-center + the aside's max-w below keep the preview+editor pair
          from drifting apart into a big dead grey gap on wide screens — the
          A4-width (210mm) document no longer had a cap on how much emptier-
          than-itself its flex-1 pane could grow, so on any laptop wider than
          ~1300px the doc's own mx-auto centering left a very visible band of
          bare aside background between it and the editor panel. Capping the
          aside and centering the whole pair turns that into a normal, even
          page margin instead. */}
      <div className="print-reset flex relative h-[calc(100vh-3.5rem)]">
        {/* Day rail — structure and navigation for the preview beside it.
            Desktop only: on a narrow screen the preview already takes the whole
            viewport and a third column would leave nothing for it. */}
        <div className="no-print hidden lg:flex">
          <DayLayersRail />
        </div>

        {/* ── LEFT: Live Preview (persistent on desktop) ───────────────────────── */}
        <aside className="print-reset hidden lg:block flex-1 min-w-0 overflow-auto h-full bg-dashboard-base-200">
          <div className="print-reset px-6 py-8">
            <ItineraryDocument
              form={previewForm}
              onCoverImageChange={isLocked ? undefined : (url) => setForm((f) => ({ ...f, coverImage: url }))}
              onCoverImagePositionChange={isLocked ? undefined : (pos) => setForm((f) => ({ ...f, coverImagePosition: pos }))}
              onImageChange={isLocked ? undefined : handleItineraryImageChange}
              onActivityCaptionChange={isLocked ? undefined : handleActivityCaptionChange}
              variant="flat"
            />
          </div>
        </aside>

        {/* Mobile preview overlay */}
        {mobilePreviewOpen && (
          <div className="no-print lg:hidden fixed inset-0 z-30 bg-dashboard-base-200 overflow-auto">
            <div className="no-print flex items-center justify-between px-4 py-3 border-b border-dashboard-base-300 sticky top-0 bg-dashboard-base-100 z-10">
              <span className="text-sm font-semibold text-dashboard-base-content">Live Preview</span>
              <button onClick={() => setMobilePreviewOpen(false)}>
                <EyeOff size={16} className="text-dashboard-base-content/50" />
              </button>
            </div>
            <div className="px-4 py-6">
              <ItineraryDocument
                form={previewForm}
                onCoverImageChange={isLocked ? undefined : (url) => setForm((f) => ({ ...f, coverImage: url }))}
              onCoverImagePositionChange={isLocked ? undefined : (pos) => setForm((f) => ({ ...f, coverImagePosition: pos }))}
              onImageChange={isLocked ? undefined : handleItineraryImageChange}
              onActivityCaptionChange={isLocked ? undefined : handleActivityCaptionChange}
              variant="flat"
              />
            </div>
          </div>
        )}

        {/* ── RIGHT: rail + panel ────────────────────────────────────────────────
            One surface for everything that isn't the document: the rail's
            persistent sections, and whichever contextual drawer the preview
            has opened. See BuilderSidebar. */}
        <BuilderSidebar
          clientPanel={
            <fieldset disabled={isLocked} className="contents">
              <div className="p-4 space-y-4">
              {/* Awaiting-review / rejected banners — shown above the tab
                 panels so they're visible no matter which tab is open. */}
              {isLocked && (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
                  <Clock className="size-4 mt-0.5 shrink-0 text-amber-600" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Awaiting costing review</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      This package is with the costing team for pricing verification — editing is disabled until they verify &amp; send it, or reject it back to you.
                    </p>
                  </div>
                </div>
              )}
              {!isLocked && query.customPackage?.rejectedAt && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-300 bg-red-50 px-4 py-3">
                  <XCircle className="size-4 mt-0.5 shrink-0 text-red-600" />
                  <div>
                    <p className="text-sm font-semibold text-red-800">
                      Sent back for rework — {query.customPackage.rejectionReason?.label ?? "Unknown reason"}
                    </p>
                    {query.customPackage.rejectionNote && (
                      <p className="text-xs text-red-700 mt-0.5">&quot;{query.customPackage.rejectionNote}&quot;</p>
                    )}
                    <p className="text-xs text-red-700 mt-1">Fix the issue above and click Mark Ready to resubmit.</p>
                  </div>
                </div>
              )}
              {!isLocked && !query.customPackage?.rejectedAt && query.customPackage?.revisionNote && (
                <div className="flex items-start gap-2.5 rounded-xl border border-blue-300 bg-blue-50 px-4 py-3">
                  <RotateCcw className="size-4 mt-0.5 shrink-0 text-blue-600" />
                  <div>
                    <p className="text-sm font-semibold text-blue-800">Pulled back for revision</p>
                    <p className="text-xs text-blue-700 mt-0.5">&quot;{query.customPackage.revisionNote}&quot;</p>
                    <p className="text-xs text-blue-700 mt-1">Click Mark Ready once you&apos;re done to send it back to costing.</p>
                  </div>
                </div>
              )}

                <ClientDetailsSidebar query={query} j={j} t={t} b={b} s={s} tr={tr} ac={ac} />

                {/* Save / Mark Ready / Share. In the Client tab because
                    that's where an exec starts and finishes — the actions
                    that move a package forward belong beside the lead it's
                    for, not floating over the document. */}
            {/* Bottom action bar */}
            {pkgSent ? (
              <div className="flex flex-wrap items-center justify-end gap-3 pt-6 pb-10">
                <span className="text-sm text-blue-700 flex items-center gap-2">
                  <CheckCircle size={14} /> Sent to client{query.customPackage?.sentAt ? ` — ${new Date(query.customPackage.sentAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}.
                </span>
                <RequestRevisionDialog
                  packageId={packageId}
                  packageTitle={form.title}
                  onSuccess={async () => {
                    const fresh = await getPackageDetail(packageId);
                    if (fresh) syncPricingFromFresh(fresh);
                  }}
                >
                  <Button variant="outline" className="gap-2 border-dashboard-base-300 hover:bg-dashboard-base-200 text-dashboard-base-content">
                    <RotateCcw size={14} />
                    Request Revision
                  </Button>
                </RequestRevisionDialog>
              </div>
            ) : isLocked && pkgVerified ? (
              <div className="flex flex-wrap items-center justify-end gap-3 pt-6 pb-10">
                <RequestRevisionDialog
                  packageId={packageId}
                  packageTitle={form.title}
                  onSuccess={async () => {
                    const fresh = await getPackageDetail(packageId);
                    if (fresh) syncPricingFromFresh(fresh);
                  }}
                >
                  <Button variant="outline" className="gap-2 border-dashboard-base-300 hover:bg-dashboard-base-200 text-dashboard-base-content">
                    <RotateCcw size={14} />
                    Request Revision
                  </Button>
                </RequestRevisionDialog>
                <Button
                  className="gap-2 bg-dashboard-success text-dashboard-success-content hover:bg-dashboard-success/90"
                  onClick={handleShareClick}
                  disabled={isSharing}
                >
                  {isSharing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Share with Client
                </Button>
              </div>
            ) : isLocked ? (
              <div className="flex items-center justify-end gap-2 pt-6 pb-10 text-sm text-amber-700">
                <Clock size={14} /> Awaiting costing review — editing is disabled until it&apos;s approved, or rejected back to you.
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-end gap-3 pt-6 pb-10">
                <Button
                  variant="outline"
                  onClick={() => handleSave("DRAFT")}
                  disabled={isSaving || isSending}
                  className="gap-2 border-dashboard-base-300 hover:bg-dashboard-base-200 text-dashboard-base-content"
                >
                  {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save Draft
                </Button>
                <Button
                  className="gap-2 bg-dashboard-success text-dashboard-success-content hover:bg-dashboard-success/90"
                  onClick={handleMarkReadyClick}
                  disabled={isSending || isSaving}
                  title={validateItineraryRequiredFields(form) ?? undefined}
                >
                  {isSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Mark Ready
                </Button>
              </div>
            )}
              </div>
            </fieldset>
          }
          tripPanel={
            <fieldset disabled={isLocked} className="contents">
              <TripSetupPanel
                computed={computeFinalPricing()}
                onApplyPrice={applyComputedPricing}
              />
            </fieldset>
          }
        />
      </div>

      <AlertDialog open={confirmReadyOpen} onOpenChange={setConfirmReadyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit for costing review?</AlertDialogTitle>
            <AlertDialogDescription>
              Once this package goes under costing review, you won&apos;t be able to change anything —
              editing stays locked until the costing team either approves it, or rejects it
              back to you with a reason.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkReady}>Mark Ready</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmShareOpen} onOpenChange={setConfirmShareOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send this package to the client?</AlertDialogTitle>
            <AlertDialogDescription>
              This opens a pre-filled WhatsApp message to {query.name || "the client"} and emails them a copy of the itinerary.
              The price and itinerary get locked at today&apos;s numbers — no further pricing changes after this.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleShare}>Share with Client</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </PackageBuilderProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Previous (last-sent) version — read-only summary, so an exec editing a
// package that's already been delivered can see what the client actually
// received before this edit changes it. Matches the shape saveCustomPackage
// snapshots in action.ts.
// ─────────────────────────────────────────────────────────────────────────────
type PreviousSnapshot = {
  savedAt: string;
  title: string;
  totalDays: number; totalNights: number; travelDate: string | null;
  adults: number; children: number; infants: number;
  pricePerPerson: number | null; totalPrice: number | null;
  stops: { name: string; nights: number }[];
  itineraries: {
    day: number; title: string; description: string | null; meals: string[];
    accommodation: string | null; hotelCheckIn: string | null; hotelCheckOut: string | null; hotelMealPlan: string | null;
    transport: string | null; transportVehicleType: string | null; transportPickup: string | null; transportDrop: string | null;
    notes: string | null;
  }[];
};

function PreviousVersionDialog({ snapshot }: { snapshot: unknown }) {
  const v = snapshot as PreviousSnapshot | null;
  if (!v) return null;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1 w-full mt-1">
          <Eye size={12} /> View last sent version
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">Last Sent Version</DialogTitle>
          <DialogDescription className="text-xs">
            Captured {new Date(v.savedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} —
            what the client saw before your latest edit.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-xs">
          <div className="rounded-lg border border-dashboard-base-300 p-3 space-y-1">
            <p className="font-semibold text-sm">{v.title}</p>
            <p className="text-dashboard-base-content/60">
              {v.totalDays}D / {v.totalNights}N · {v.adults}A {v.children > 0 && `${v.children}C `}{v.infants > 0 && `${v.infants}I`}
              {v.travelDate && ` · ${new Date(v.travelDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`}
            </p>
            {v.pricePerPerson != null && (
              <p className="text-dashboard-base-content/60">
                ₹{v.pricePerPerson.toLocaleString("en-IN")}/person · Total ₹{v.totalPrice?.toLocaleString("en-IN")}
              </p>
            )}
          </div>
          <div className="space-y-2">
            {v.itineraries.map((it) => (
              <div key={it.day} className="rounded-lg border border-dashboard-base-300 p-2.5 space-y-1">
                <p className="font-medium">Day {it.day}: {it.title || "—"}</p>
                {it.accommodation && <p className="text-dashboard-base-content/60">🏨 {it.accommodation}</p>}
                {it.transport && <p className="text-dashboard-base-content/60">🚗 {it.transport}{it.transportVehicleType ? ` · ${it.transportVehicleType}` : ""}</p>}
                {it.meals.length > 0 && <p className="text-dashboard-base-content/60">🍽️ {it.meals.join(", ")}</p>}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Locked pricing snapshot — frozen breakdown written by sendPackageToClient
// at the moment the package was sent, so the exec can recheck later how the
// delivered total was actually built (and whether the shown price was hand-
// overridden from what the line items alone would compute to).
// ─────────────────────────────────────────────────────────────────────────────
type PricingSnapshot = {
  lockedAt: string;
  currency: string;
  hotel: { subtotal: number; nightsCounted: number; lines: { day: number; hotelName: string; roomName: string; pricePerRoom: number; roomsNeeded: number; mattresses: number; extraBedRate: number; total: number }[] };
  cab: { subtotal: number; daysCounted: number; lines: { day: number; vehicleName: string; pricingType: string; rate: number; distanceKm: number | null; total: number }[] };
  tickets: { subtotal: number; lines: { type: string; provider: string; fromPlace: string; toPlace: string; fare: number | null; ticketCount: number }[] };
  baseCost: number;
  marginPercentage: number;
  hotelCabMarginAmount: number;
  ticketsMarginAmount: number;
  marginAmount: number;
  taxable: number;
  gstPercentage: number;
  gstAmount: number;
  finalPrice: number;
  pricePerPerson: number;
  displayedTotalPrice: number | null;
  displayedPricePerPerson: number | null;
};

function LockedPricingDialog({ snapshot }: { snapshot: unknown }) {
  const s = snapshot as PricingSnapshot | null;
  if (!s) return null;
  const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
  const drifted = s.displayedTotalPrice != null && Math.round(s.displayedTotalPrice) !== Math.round(s.finalPrice);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1 w-full mt-1">
          <CreditCard size={12} /> View locked pricing
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">Locked Pricing Breakdown</DialogTitle>
          <DialogDescription className="text-xs">
            Frozen {new Date(s.lockedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} — the exact hotel/cab/ticket costs behind the price sent to the client.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-xs">
          {s.hotel.lines.length > 0 && (
            <div className="rounded-lg border border-dashboard-base-300 p-2.5 space-y-1">
              <p className="font-semibold">Hotel · {inr(s.hotel.subtotal)}</p>
              {s.hotel.lines.map((l, i) => (
                <p key={i} className="text-dashboard-base-content/60">
                  Day {l.day}: {l.hotelName} — {l.roomName} × {l.roomsNeeded} = {inr(l.total)}
                  {l.mattresses > 0 && ` (+${l.mattresses} mattress)`}
                </p>
              ))}
            </div>
          )}
          {s.cab.lines.length > 0 && (
            <div className="rounded-lg border border-dashboard-base-300 p-2.5 space-y-1">
              <p className="font-semibold">Cab · {inr(s.cab.subtotal)}</p>
              {s.cab.lines.map((l, i) => (
                <p key={i} className="text-dashboard-base-content/60">
                  Day {l.day}: {l.vehicleName} ({l.pricingType}) = {inr(l.total)}
                </p>
              ))}
            </div>
          )}
          {s.tickets.lines.length > 0 && (
            <div className="rounded-lg border border-dashboard-base-300 p-2.5 space-y-1">
              <p className="font-semibold">Tickets · {inr(s.tickets.subtotal)}</p>
              {s.tickets.lines.map((l, i) => (
                <p key={i} className="text-dashboard-base-content/60">
                  {l.type} {l.provider && `(${l.provider})`}: {l.fromPlace} → {l.toPlace} × {l.ticketCount} = {l.fare != null ? inr(l.fare) : "—"}
                </p>
              ))}
            </div>
          )}
          <div className="rounded-lg border border-dashboard-base-300 p-2.5 space-y-1">
            <p className="flex justify-between"><span className="text-dashboard-base-content/60">Base cost</span> <span>{inr(s.baseCost)}</span></p>
            <p className="flex justify-between"><span className="text-dashboard-base-content/60">Margin ({s.marginPercentage}% hotel/cab + 5% tickets)</span> <span>{inr(s.marginAmount)}</span></p>
            <p className="flex justify-between"><span className="text-dashboard-base-content/60">GST ({s.gstPercentage}%)</span> <span>{inr(s.gstAmount)}</span></p>
            <p className="flex justify-between font-semibold border-t border-dashboard-base-300 pt-1"><span>Computed total</span> <span>{inr(s.finalPrice)}</span></p>
            <p className="text-dashboard-base-content/60">{inr(s.pricePerPerson)} per person</p>
          </div>
          {drifted && s.displayedTotalPrice != null && (
            <div className="rounded-lg border border-dashboard-warning/40 bg-dashboard-warning/10 p-2.5">
              <p className="font-semibold text-dashboard-warning-content flex items-center gap-1">
                <AlertCircle size={12} /> Hand-overridden
              </p>
              <p className="text-dashboard-base-content/60">
                The exec sent {inr(s.displayedTotalPrice)} instead of the computed {inr(s.finalPrice)}.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar content
// ─────────────────────────────────────────────────────────────────────────────
function ClientDetailsSidebar({ query, j, t, b, s, tr, ac }: {
  query: QueryDetail;
  j: any; t: any; b: any; s: any; tr: any; ac: any;
}) {
  return (
    <>
      <SectionCard title="Client Info" icon={<User size={14} />}>
        {!query.id && (
          <p className="text-xs text-dashboard-base-content/50 italic">
            No client linked yet — this is a blank package.
          </p>
        )}
        <InfoRow label="Name" value={query.name} />
        {query.phone && (
          <InfoRow
            label="Phone"
            value={
              <a
                href={`tel:+${query.countryCode}${query.phone}`}
                className="text-dashboard-primary hover:underline flex items-center gap-1"
              >
                <Phone size={10} /> +{query.countryCode} {query.phone}
              </a>
            }
          />
        )}
        {query.email && (
          <InfoRow
            label="Email"
            value={
              <a href={`mailto:${query.email}`} className="text-dashboard-primary hover:underline flex items-center gap-1">
                <Mail size={10} /> {query.email}
              </a>
            }
          />
        )}
        {query.assignedToName && <InfoRow label="Exec" value={query.assignedToName} />}
        {query.message && (
          <div className="mt-2 rounded-lg bg-dashboard-base-200 border border-dashboard-base-300 px-3 py-2">
            <p className="text-xs text-dashboard-base-content/50 italic">&quot;{query.message}&quot;</p>
          </div>
        )}
      </SectionCard>

      {query.customPackage?.readyAt && (
        <SectionCard title="Package Status" icon={<Send size={14} />}>
          <InfoRow
            label="Verification"
            value={
              query.customPackage.verified
                ? (query.customPackage.status === "SENT" ? "Approved & sent" : "Approved — awaiting share")
                : query.customPackage.rejectedAt
                  ? `Rejected — ${query.customPackage.rejectionReason?.label ?? "see note"}`
                  : "Awaiting costing review"
            }
          />
          {query.customPackage.rejectedAt && query.customPackage.rejectionNote && (
            <p className="text-xs text-dashboard-error/80 -mt-1 pb-1">&quot;{query.customPackage.rejectionNote}&quot;</p>
          )}
          <InfoRow
            label="Ready for review"
            value={new Date(query.customPackage.readyAt).toLocaleString("en-IN", {
              day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
            })}
          />
          {query.assignedAt && (
            <InfoRow
              label="Assigned → Ready"
              value={formatDuration(new Date(query.customPackage.readyAt).getTime() - new Date(query.assignedAt).getTime())}
            />
          )}
          {query.customPackage.sentAt && (
            <>
              <InfoRow
                label="Sent"
                value={new Date(query.customPackage.sentAt).toLocaleString("en-IN", {
                  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                })}
              />
              <InfoRow
                label="Ready → Sent"
                value={formatDuration(new Date(query.customPackage.sentAt).getTime() - new Date(query.customPackage.readyAt).getTime())}
              />
            </>
          )}
          <InfoRow
            label="Client viewed"
            value={
              query.customPackage.viewedAt
                ? `Yes — ${new Date(query.customPackage.viewedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} (${query.customPackage.viewCount}×)`
                : "Not yet"
            }
          />
          {query.customPackage.previousSnapshot != null && (
            <PreviousVersionDialog snapshot={query.customPackage.previousSnapshot} />
          )}
          {query.customPackage.pricingSnapshot != null && (
            <LockedPricingDialog snapshot={query.customPackage.pricingSnapshot} />
          )}
        </SectionCard>
      )}

      {j && (
        <SectionCard title="Journey" icon={<MapPin size={14} />}>
          {j.destinations?.length > 0 && (
            <InfoRow label="Destinations" value={
              <div className="flex flex-wrap gap-1">
                {j.destinations.map((d: string) => <Pill key={d} label={d} />)}
              </div>
            } />
          )}
          <InfoRow label="From" value={j.startingPoint} />
          <InfoRow label="Date" value={
            j.travelDate
              ? new Date(j.travelDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
              : undefined
          } />
          <InfoRow label="Duration" value={`${j.noOfDays} Days / ${j.noOfNights} Nights`} />
          <InfoRow label="Date Type" value={j.dateType} />
          <SpecialNote text={j.specialDemands} />
        </SectionCard>
      )}

      {t && (
        <SectionCard title="Travellers" icon={<Users size={14} />}>
          <InfoRow label="Lead" value={t.leadName} />
          {t.tripType && (
            <InfoRow
              label="Trip Type"
              value={t.tripType === "OTHER" ? (t.tripTypeCustom || "Other") : (TRIP_TYPE_LABELS[t.tripType] ?? t.tripType)}
            />
          )}
          <InfoRow label="Adults" value={t.adults} />
          {(t.children ?? 0) > 0 && <InfoRow label="Children" value={t.children} />}
          {(t.infants ?? 0) > 0 && <InfoRow label="Infants" value={t.infants} />}
          <SpecialNote text={t.specialDemands} />
        </SectionCard>
      )}

      {b && (
        <SectionCard title="Budget" icon={<IndianRupee size={14} />}>
          <InfoRow
            label="Range"
            value={
              b.min == null && b.max == null
                ? "Not specified"
                : `₹${b.min != null ? b.min.toLocaleString("en-IN") : "0"} – ₹${b.max != null ? b.max.toLocaleString("en-IN") : "no max"}`
            }
          />
          <InfoRow label="Type" value={b.type} />
          <InfoRow label="Currency" value={b.currency} />
          <SpecialNote text={b.specialDemands} />
        </SectionCard>
      )}

      {s && (
        <SectionCard title="Stay Preference" icon={<Hotel size={14} />} defaultOpen={false}>
          {s.types?.length > 0 && (
            <InfoRow label="Types" value={
              <div className="flex flex-wrap gap-1">
                {s.types.map((x: string) => <Pill key={x} label={STAY_LABELS[x] ?? x} />)}
              </div>
            } />
          )}
          {s.mealTypes?.length > 0 && (
            <InfoRow label="Meals" value={
              <div className="flex flex-wrap gap-1">
                {s.mealTypes.map((m: string) => (
                  <Pill key={m} label={m === "VEG" ? "🌿 Veg" : "🍗 Non-Veg"} />
                ))}
              </div>
            } />
          )}
          {s.customMeal && <InfoRow label="Custom" value={s.customMeal} />}
          <SpecialNote text={s.specialDemands} />
        </SectionCard>
      )}

      {tr && (
        <SectionCard title="Transport" icon={<Car size={14} />} defaultOpen={false}>
          {tr.cabTypes?.length > 0 && (
            <InfoRow label="Cabs" value={
              <div className="flex flex-wrap gap-1">
                {tr.cabTypes.map((c: string) => <Pill key={c} label={CAB_LABELS[c] ?? c} />)}
              </div>
            } />
          )}
          <InfoRow label="Flights" value={tr.includeFlights ? "Yes" : "No"} />
          <InfoRow label="Train" value={tr.includeTrain ? "Yes" : "No"} />
          <SpecialNote text={tr.specialDemands} />
        </SectionCard>
      )}

      {ac && (
        <SectionCard title="Activities" icon={<Zap size={14} />} defaultOpen={false}>
          <InfoRow label="Activities" value={
            <div className="flex flex-wrap gap-1">
              {ac.selected?.map((a: string) => (
                <Pill key={a} label={ACTIVITY_LABELS[a] ?? a} />
              ))}
              {ac.custom?.map((a: string) => (
                <Pill key={a} label={a} />
              ))}
            </div>
          } />
          <SpecialNote text={ac.specialDemands} />
        </SectionCard>
      )}
    </>
  );
}