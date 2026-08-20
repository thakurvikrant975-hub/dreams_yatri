"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Calendar, Hotel, Car, Utensils, CheckCircle, XCircle,
  IndianRupee, Users, MapPin, Info,
  Plane, TrainFront, Helicopter, Sparkles, Phone, Mail, Upload, Loader2, Pencil, Image as ImageIcon,
  Coffee, Soup, UtensilsCrossed, Compass, Moon, Milestone, ArrowRight, Gift, Plus,
  StickyNote, AlertTriangle, AlertOctagon, ChevronDown, CalendarPlus, Lock, MoonStar,
  Bus, Ticket, Repeat, Trash2, ArrowUp, ArrowDown, Star,
} from "./builder-icons";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel,
} from "@/app/(dashboard)/dashboard/(main)/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "@/app/(dashboard)/dashboard/(main)/components/ui/dialog";
import { cn } from "@/app/lib/utils";
import { ItineraryMap } from "./ItineraryMap";
import { ImageDropField } from "./ImageDropField";
import { uploadImageFile } from "@/app/lib/uploadImageFile";
import { Input } from "@/app/(dashboard)/dashboard/(main)/components/ui/input";
import { deriveDayLocations } from "@/app/lib/route-builder-utils";
import { splitManualHotelName } from "@/app/services/hotel-name-utils";
import { CheckInIcon, CheckOutIcon } from "@/app/components/icons/cusomIcon";
import { StarAndCrescentIcon, MapPinIcon, RoadHorizonIcon } from "@phosphor-icons/react";
import { planRoomOccupancy } from "@/app/lib/room-capacity";
import {
  continuesStayFrom, stayRun, removeStay, removeTransport, moveActivityTo, removeActivity,
  emptyTicket, emptyAddon, stopLimitReason, recalcFromStops,
  applyHotelRoomSelection, emptyDay,
} from "./day-mutations";
import { EditableText } from "./EditableText";
import {
  useOptionalBuilder, revealField, scrollToDay,
  type PolicyListKey, type TicketTextKey, type AddonTextKey, type DrawerTarget,
} from "./builder-context";
import { EditablePolicyList } from "./EditablePolicyList";
import { DayActionsMenu, DaySectionsBar } from "./DayActionsMenu";
import { DaySlot } from "./builder-dnd";
import { ticketGaps, addonGaps, stayGaps, transportGaps, type Gaps } from "./pricing-gaps";
import { nightISOForDay } from "@/app/(dashboard)/dashboard/(builder)/package-builder/night-date";
import { ADD_CONTROL_CLASS } from "./doc-tokens";
import {
  CLASSIC, DocThemeProvider, resolveDocTheme, useDocTheme,
  type NoteTone, type ThemeOverrides,
} from "./doc-theme";
import { IconTip } from "./builder-ui";

// Re-exported for existing consumers (e.g. CustomPackageHero) that import it
// from here — the implementation itself lives in route-builder-utils since
// it's a plain function server components need too (see hotel-requests).
export { deriveDayLocations };

// ─────────────────────────────────────────────────────────────────────────────
// Day note tones
//
// Same vocabulary as itinerary_notes.type in the admin catalog (see
// NOTE_STYLES in the website's Itnary.tsx) rather than a second set of names
// for the same idea — a note written in one system reads the same in the other.
//
// Literal hex for the same reason as DOC above: html2canvas-pro can't resolve
// the app's oklch theme tokens, and a note whose whole job is to signal
// severity by colour would export as a grey box. Tuned to sit on the warm
// paper ground rather than reusing the dashboard's cooler semantic ramp.
// ─────────────────────────────────────────────────────────────────────────────

// Note tones are part of the palette now (see doc-theme) so a template can
// retune them alongside everything else. Re-exported here because the tone
// picker in ExtrasDrawers imports them from this module — and it wants the
// house colours regardless of which template the open package uses, since it's
// builder chrome rather than part of the printed page.
export type { NoteTone };
export const NOTE_TONES = CLASSIC.notes;

const NOTE_TONE_ICONS: Record<NoteTone, React.ElementType> = {
  neutral: StickyNote, info: Info, success: CheckCircle, warning: AlertTriangle, error: AlertOctagon,
};

/** Falls back to neutral for an unknown or absent value, so an older note (or
 * one written by another system) never renders as a broken box. */
export function noteTone(raw: string | null | undefined): NoteTone {
  return raw && raw in NOTE_TONES ? (raw as NoteTone) : "neutral";
}

/** Poppins (--font-heading, see globals.css) — the brand display face. The
 * document previously used none of it, so every heading rendered in the body
 * Inter and the whole artefact read flatter and more off-brand than the
 * website's own itinerary, which uses font-heading throughout. */
const DISPLAY = "font-heading";

/** Identifies exactly which image a click on an edit button refers to, so
 * one onImageChange callback (threaded down from page.tsx) can cover every
 * editable photo in the document instead of a dozen specific props. */
export type ImageEditTarget =
  | { kind: "stop"; stopIndex: number }
  | { kind: "accommodationPhoto"; day: number }
  | { kind: "transportPhoto"; day: number }
  | { kind: "roomPhoto"; day: number; photoIndex: number }
  | { kind: "activityPhoto"; day: number; activityIndex: number; photoIndex: number };

type OnImageChange = (target: ImageEditTarget, url: string) => void;

/** Plain `<img>` that swaps to the standard dashed-box placeholder if the URL
 * 404s or otherwise fails to load — needed for AI-sourced photos (cover,
 * activity, stop images from the AI Itinerary Builder), which aren't
 * guaranteed to be real, working URLs the way manually-searched hotel/cab
 * inventory photos are. Without this a broken AI-hallucinated URL renders as
 * the browser's raw broken-image icon instead of degrading gracefully. */
export function SafeImg({
  src, alt, className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  // Reset the failed flag when src changes (e.g. the user replaces a broken
  // AI-provided photo via the edit dialog) — without this, a tile that once
  // 404'd stays stuck on the placeholder forever, even after a working URL
  // is saved in its place.
  const [lastSrc, setLastSrc] = useState(src);
  if (src !== lastSrc) {
    setLastSrc(src);
    setFailed(false);
  }
  if (!src || failed) {
    return (
      <div className={cn("bg-neutral-50 border-2 border-dashed border-neutral-200 flex items-center justify-center", className)}>
        <ImageIcon size={16} className="text-neutral-300" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary catalog/AI-sourced URL, not a static app asset
    <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />
  );
}

/** Small round edit affordance shown on hover (parent needs a `group` class)
 * — opens the same drag-drop / upload / paste-link controls as the cover
 * image's popup, scoped to whichever photo it's attached to. Position/size
 * via `className` (e.g. "top-1 right-1 size-6") since it's reused at very
 * different thumbnail sizes across the document. */
function ImageEditButton({
  value, onChange, dialogTitle, className, captionValue, onCaptionChange,
}: {
  value: string;
  onChange: (url: string) => void;
  dialogTitle: string;
  className?: string;
  /** When both are given, the dialog also offers a caption field — used for
   * activity photos, where `photoLabels[i]` is shown as the caption overlay. */
  captionValue?: string;
  onCaptionChange?: (caption: string) => void;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "no-print absolute z-20 flex items-center justify-center rounded-full",
            "bg-black/55 hover:bg-black/75 text-white transition-opacity duration-[120ms]",
            // Visible on the image itself, AND whenever its section is hovered.
            // Hovering "Stay" should reveal everything in that section you can
            // change — its photos included — rather than making you discover
            // each tile by sweeping the pointer across it.
            "opacity-0 group-hover/img:opacity-100 group-hover/section:opacity-100",
            "focus-visible:opacity-100",
            className,
          )}
          aria-label={`Change ${dialogTitle.toLowerCase()}`}
        >
          <Pencil size={11} />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>
            Drag and drop a photo, upload from your computer, or paste a link.
          </DialogDescription>
        </DialogHeader>
        <ImageDropField value={value} onChange={onChange} />
        {onCaptionChange && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-neutral-600">Caption</label>
            <Input
              value={captionValue ?? ""}
              onChange={(e) => onCaptionChange(e.target.value)}
              placeholder="e.g. Tea Garden Walk in Munnar"
              className="h-8 text-sm"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Fallback contact/footer content — used only if a caller hasn't fetched
// form.companySettings from /dashboard/itinerary-settings (the source of
// truth an admin edits), so the document never renders blank.
const COMPANY_PHONE = "+91 7807727100";
const COMPANY_EMAIL = "hello@dreamyatri.com";
const COMPANY_ADDRESS = "Shimla, Himachal Pradesh - 171001";
const DEFAULT_COMPANY_DESCRIPTION =
  "At Dreams Yatri, we turn journeys into stories. From Himalayan escapes to luxury international " +
  "holidays, our experts design custom, budget-smart, worry-free trips — so you focus on memories, not logistics.";
const DEFAULT_DOCUMENT_DISCLAIMER = "This is a custom itinerary, subject to availability at the time of booking.";

/** "AB12CD34" — the last 8 characters of the query's cuid, uppercased, as a
 * short human-referenceable quote number instead of exposing the client's
 * raw phone/email back to them on their own document. */
function refCode(queryId: string): string {
  return queryId.slice(-8).toUpperCase();
}

/**
 * "Suraj Kumar" → "Suraj's". First name only: the cover's eyebrow reads as a
 * spoken phrase ("Suraj's … journey") and a full legal name there sounds like a
 * form field rather than a trip someone is about to take.
 *
 * A name already ending in s takes the bare apostrophe ("Chris'"), which is the
 * convention the client is most likely to see their own name written in.
 */
function possessive(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? "";
  if (!first) return "";
  return /s$/i.test(first) ? `${first}'` : `${first}'s`;
}

type RouteStep = { label: string; nights?: number; kind: "pickup" | "drop" | "stop" };

/**
 * The journey as a sequence: pickup point, each stop with its night count, then
 * the drop point. Pickup and drop come from the first and last day's transport
 * fields; either is simply left out when not set.
 *
 * Module-level rather than computed inside the cover, because the route is
 * rendered under the Prepared For card now and the cover no longer needs it.
 */
function buildRouteSteps(form: PreviewData): RouteStep[] {
  const firstDay = form.itineraries[0];
  const lastDay = form.itineraries[form.itineraries.length - 1];
  const pickupPoint = firstDay?.transportPickup || "";
  const dropPoint = lastDay?.transportDrop || "";
  return [
    ...(pickupPoint ? [{ label: `${pickupPoint} pickup`, kind: "pickup" as const }] : []),
    ...form.stops.filter((s) => s.name.trim()).map((s) => ({ label: titleCase(s.name), nights: s.nights, kind: "stop" as const })),
    ...(dropPoint ? [{ label: `${dropPoint} drop`, kind: "drop" as const }] : []),
  ];
}

/**
 * The route strip, on paper rather than over the cover photo.
 *
 * Falls back to start → destination when no stops have been added yet: a draft
 * that has a destination but no day plan still has a journey worth stating, and
 * an empty row here would read as "no route" rather than "not planned yet".
 */
function RouteStrip({ form, steps }: { form: PreviewData; steps: RouteStep[] }) {
  if (steps.length === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-800">
        <MapPin size={14} className="shrink-0 text-neutral-400" />
        {form.startingPoint ? `${form.startingPoint} → ` : ""}{form.destination || "—"}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-1">
          {i > 0 && <ArrowRight size={11} className="text-neutral-400/90 shrink-0 mx-0.5" />}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200/80 bg-white px-2 py-0.5 text-[10px] font-medium text-neutral-800 whitespace-nowrap shadow-lg shadow-neutral-200/80">
            {step.kind === "stop"
              ? <MapPin size={12} className="shrink-0 text-neutral-400/90" />
              : <Car size={12} className="shrink-0 text-neutral-400/90" />}
            {step.label}
            {step.nights != null && (
              <span className="rounded-full bg-neutral-200/80 px-1 py-0.5 text-[7px] font-bold text-neutral-600">
                {step.nights}N
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Day N's actual calendar date — Day 1 is the travel date itself, Day 2 is
 * travel date + 1, etc. Same offset the pricing engine uses to pick
 * season/weekend rates per day (package-pricing.service.ts), just surfaced
 * here for display. Null when there's no travel date to anchor to yet. */
export function dayCalendarDate(travelDate: string, dayNumber: number): Date | null {
  if (!travelDate) return null;
  const base = new Date(travelDate);
  if (Number.isNaN(base.getTime())) return null;
  return new Date(base.getTime() + (dayNumber - 1) * 24 * 60 * 60 * 1000);
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });
}

/** "manali" / "NEW DELHI" → "Manali" / "New Delhi" — route stop names are
 * free-typed by the exec, so casing isn't guaranteed. */
export function titleCase(text: string): string {
  return text.replace(/\w\S*/g, (word) => word[0].toUpperCase() + word.slice(1).toLowerCase());
}

/** "14:30" (24h, as stored from <input type="time">) → "2:30 PM". */
export function formatTime12h(hhmm: string): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/** "2026-07-14" → "Tue, 14 Jul 2026". */
function formatTicketDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}

/** "1 Room | 2 Adults, 1 Child" — the room count auto-computes from the room's
 * own occupancy caps vs traveller count, UNLESS the exec explicitly overrode
 * it (the day's "Rooms needed" field) — that override was already used for
 * pricing but never actually shown here, so a package priced for e.g. 3
 * rooms displayed as "1 Room" regardless.
 *
 * The auto count goes through roomsNeededFor (room-capacity.ts), exactly like
 * the Hotel Info card and the pricing engine. Dividing the party by
 * accommodationRoomCapacity alone — which is the `max_occupancy` column, i.e.
 * BASE beds only, not the room's real capacity — ignored both the extra
 * mattresses and max_adults/max_children, so a 9-pax party in a
 * sleeps-2 +1-mattress room read as 5 rooms while it was priced (correctly)
 * as 3. */
export function occupancyText(
  day: Pick<DayItinerary,
    "accommodationRoomCapacity" | "accommodationMaxAdults"
    | "accommodationMaxChildren" | "accommodationExtraBedCapacity" | "roomsCount">,
  adults: number,
  children: number,
): string {
  const hasCapacityData = day.accommodationRoomCapacity != null
    || day.accommodationMaxAdults != null
    || day.accommodationMaxChildren != null
    || day.accommodationExtraBedCapacity != null;
  // A hand-typed hotel carries no catalog capacity at all — there's nothing to
  // derive from, so it stays at the single room it has always shown unless the
  // exec typed a count in "Rooms needed".
  const rooms = hasCapacityData
    ? planRoomOccupancy(adults, children, {
      max_occupancy: day.accommodationRoomCapacity,
      extra_bed_capacity: day.accommodationExtraBedCapacity,
      max_adults: day.accommodationMaxAdults,
      max_children: day.accommodationMaxChildren,
    }, day.roomsCount).rooms
    : (day.roomsCount ?? 1);
  return `${rooms} Room${rooms !== 1 ? "s" : ""} | ${adults} Adult${adults !== 1 ? "s" : ""}` +
    (children > 0 ? `, ${children} Child${children !== 1 ? "ren" : ""}` : "");
}

/** Parses free-text meal-plan strings ("MAP - Breakfast & Dinner") into a
 * clean "Breakfast & Dinner included" summary line. */
export function mealIncludedText(planText: string): string | null {
  if (!planText) return null;
  const lower = planText.toLowerCase();
  const found: string[] = [];
  if (lower.includes("breakfast")) found.push("Breakfast");
  if (lower.includes("lunch")) found.push("Lunch");
  if (lower.includes("dinner")) found.push("Dinner");
  if (found.length === 0) return null;
  const joined = found.length <= 2
    ? found.join(" & ")
    : `${found.slice(0, -1).join(", ")} & ${found[found.length - 1]}`;
  return `${joined} included`;
}
import DyLogo from "@/app/components/ui/DyLogo";
import SavingsBadge from "@/app/components/packages/SavingBadge";
import type { DayItinerary, ActivityInput, StopInput, TicketInput, AddonInput } from "@/app/(dashboard)/dashboard/(builder)/package-builder/action";
import { deriveTransportFields } from "@/app/lib/deriveTicketTransport";
import { HotelRoomPicker } from "./HotelRoomPicker";
import { saveStayForDay, removeStayOption } from "@/app/(dashboard)/dashboard/(builder)/package-builder/stay-options.actions";
import {
  buildStayRuns, type StayRun, type StayCell,
} from "@/app/(dashboard)/dashboard/(builder)/package-builder/stay-options";

export interface PreviewData {
  title: string;
  description: string;
  coverImage: string;
  /** Vertical focal point (0 = top, 50 = center, 100 = bottom) for the cover
   * image's object-position — lets an awkwardly-cropped photo be re-centered. */
  coverImagePosition: number;
  destination: string;
  startingPoint: string;
  totalDays: number;
  totalNights: number;
  travelDate: string;
  adults: number;
  children: number;
  infants: number;
  pricePerPerson: string;
  totalPrice: string;
  currency: string;
  inclusions: string[];
  exclusions: string[];
  termsNotes: string;
  /** Short, removable bullet points seeded with company-wide defaults —
   * distinct from the free-text termsNotes above. */
  termsConditions: string[];
  paymentPolicy: string[];
  amendmentPolicy: string[];
  /** "Benefits of Travelling With Us" — marketing bullets. */
  travelBenefits: string[];
  stops: StopInput[];
  itineraries: DayItinerary[];
  /** Flight/train legs with fares — flightsIncluded/flightFrom/etc for the
   * route map are derived from this list (see deriveTransportFields) rather
   * than stored separately, so they can never drift out of sync. */
  tickets: TicketInput[];
  /** Priced add-ons (honeymoon kit, permits, etc.) — shown to the client as
   * name + what's-included, never the raw per-unit price (same privacy
   * convention as tickets' fare, which is also builder-internal only). */
  addOns?: AddonInput[];
  /** Who this itinerary is being prepared for — from the originating query,
   * not typed into the package draft itself. Empty on the rare package with
   * no linked query (shouldn't happen in practice, but kept optional-safe). */
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  /** The originating query's id — shown as a short quote reference under the
   * client name instead of exposing their raw phone/email back to them. Null
   * for a "blank" package with no linked query — no ref code shown then. */
  queryId: string | null;
  execName: string;
  execEmail: string;
  execDesignation: string;
  /** Real destination photo per route stop name, resolved from the catalog —
   * optional since the public share-link path (getSharedPackage) may not
   * always have a match; the strip falls back gracefully when absent. */
  stopImages?: Record<string, string | null>;
  /** Costing's discount, when one applies. `totalPrice` is already the payable
   * figure — this is what it was BEFORE the concession, so the document can
   * show the saving rather than just a smaller number. Absent on every package
   * without one, which is most of them. */
  discount?: { originalPrice: number; amount: number; label: string } | null;
  /** The stay standards this trip is quoted at — Standard, Deluxe, Premium —
   * with each one's hotel for every night and its own price.
   *
   * All of them render together: the stay block prints a column per category
   * and the pricing block prints a price per category, in ONE document. There
   * is no per-category document and no per-category PDF. Absent or
   * single-entry on a package quoted at one standard, where the original
   * single-hotel layout renders instead and nothing changes. */
  stayOptions?: {
    id: string;
    /** The exec's own name for it — the client's column heading. */
    label: string;
    sortOrder: number;
    isRecommended: boolean;
    totalPrice: number | null;
    pricePerPerson: number | null;
    /** Day number to that night's hotel under this category. */
    byDay: Record<number, {
      hotel: string | null;
      photo?: string | null;
      location?: string | null;
      starRating?: string | null;
      mealPlan?: string | null;
      rooms?: number | null;
      checkIn?: string | null;
      checkOut?: string | null;
      /** Editor-only: which source this cell came from, and whether the hotel
       * team still owes it. The document ignores both — they are here so the
       * builder's submit gate can tell an unbooked night from a requested one
       * without a second read. */
      roomPricingId?: number | null;
      pending?: boolean;
      extraBeds?: number | null;
    }>;
  }[];
  /** Which document template this package renders with (see doc-theme's
   * TEMPLATES). Null/absent falls back to the company default, then to the
   * house template — so a package written before templates existed, or one
   * whose template was later removed, still renders rather than blanking. */
  template?: string | null;
  /** Per-package tweaks on top of that template — the exec's own accent, say,
   * for a client whose branding demands it. Applied last, over the company's. */
  themeOverrides?: ThemeOverrides | null;
  /** Company-wide header/footer content from /dashboard/itinerary-settings —
   * optional so callers that haven't fetched it yet fall back to the
   * hardcoded defaults below rather than rendering blank contact info. */
  companySettings?: {
    phone: string;
    email: string;
    address: string;
    description: string;
    disclaimer: string;
    /** House template + house theme tweaks, the fallback for every package
     * that hasn't chosen its own. */
    defaultTemplate?: string | null;
    themeOverrides?: ThemeOverrides | null;
  };
  /** Admin-defined extra policy blocks (title + bullet points) beyond the
   * six fixed lists above, in the order set on /dashboard/itinerary-settings. */
  customPolicySections?: { id: string; title: string; items: string[] }[];
}

/** Icon-badge + bold label + trailing rule — the section-opener used
 * throughout the document so every part of the trip reads as one
 * consistent, edited publication rather than a stack of unrelated boxes. */
/** Section rule. `tone` sets the weight in the page's hierarchy:
 *
 *   primary / emerald — content sections (itinerary, inclusions). Full weight.
 *   muted             — boilerplate (terms, policies). Deliberately recessive:
 *                       no icon badge, smaller, grey. Previously every section
 *                       got the identical badge + rule, so the terms block
 *                       shouted as loudly as the day-by-day itinerary and the
 *                       document had no hierarchy to read by.
 *
 * Icon colours are baked hex, not text-* classes: html2canvas-pro's PDF
 * capture doesn't reliably resolve currentColor for an inline SVG's *stroke*
 * when the source is an oklch() theme token (globals.css) — the glyph comes
 * out blank. Background-colour resolves fine either way. See DOC above. */
function SectionHeader({
  icon: Icon, label, tone = "primary", onAdd, addLabel = "Edit",
}: {
  /** Not rendered by the `muted` tone, which is deliberately badge-less. */
  icon?: React.ElementType;
  label: string;
  tone?: "primary" | "emerald" | "muted";
  /** Builder-only route into this section's drawer. Absent on the
   * client-facing document and in exports. */
  onAdd?: () => void;
  addLabel?: string;
}) {
  const DOC = useDocTheme();
  if (tone === "muted" || !Icon) {
    return (
      <div className="flex items-center gap-2.5" style={{ breakAfter: "avoid" }}>
        <h2 className={cn(DISPLAY, "text-[13px] font-semibold font-heading whitespace-nowrap text-neutral-900")}>
          {label}
        </h2>
        <span className="h-px flex-1 bg-neutral-300/60" />
      </div>
    );
  }

  const iconColor = tone === "emerald" ? DOC.positive : DOC.iconMuted;
  const badgeBg = tone === "emerald" ? "#E8F6F1" : DOC.iconBadge;
  return (
    <div className="flex items-center gap-2.5" style={{ breakAfter: "avoid" }}>
      <span
        className="flex items-center justify-center size-7 rounded-full shrink-0 bg-white ring-1 ring-inset ring-neutral-200/80 shadow-lg shadow-neutral-200/90"
      >
        <Icon size={14} color={iconColor} />
      </span>
      <h2
        className={cn(DISPLAY, "text-[16px] text-neutral-900 font-semibold font-heading whitespace-nowrap")}
        style={{ color: DOC.ink, letterSpacing: "-0.01em" }}
      >
        {label}
      </h2>
      <span className="h-px flex-1 bg-neutral-300/60" />
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="builder-only no-print shrink-0 flex items-center gap-1 rounded-md border border-dashed border-dashboard-base-300 px-2 py-0.5 text-[10px] font-medium transition-colors hover:bg-dashboard-primary/6"
          style={{ color: DOC.accent }}
        >
          <Plus size={10} /> {addLabel}
        </button>
      )}
    </div>
  );
}

/** Fine print — terms, payment/amendment policy, custom policy sections.
 *
 * These were previously five separately-coloured cards (blue, amber, purple,
 * teal, slate), each with a filled icon badge and an uppercase heading. That
 * pastel rainbow was most of why the document read as generic: it gave every
 * boilerplate block the same visual shout as the day-by-day itinerary, so
 * there was no hierarchy left to read the page by. They now share one quiet
 * treatment — a muted rule and a plain list — which buys the itinerary back
 * its prominence for free. */
function PolicyBlock({ label, items, listKey }: {
  label: string;
  items: string[];
  /** When given, this package's own additions to the list become editable in
   * place and an "Add" affordance appears — same locked-standard / editable-
   * custom model as inclusions.
   *
   * Omitted for custom policy sections, and that is not an oversight:
   * ExtraPolicyItems has exactly six keys with no slot for them, and
   * saveCustomPackage re-sources customPolicySections from itinerary settings
   * on every save. Editing one here would appear to work and then be silently
   * discarded, so the section says it's company-wide instead. */
  listKey?: PolicyListKey;
}) {
  const DOC = useDocTheme();
  const builder = useOptionalBuilder();
  // A section with nothing in it still needs a way in while editing.
  if (items.length === 0 && !(listKey && builder?.canEdit)) return null;
  return (
    <div className="space-y-2.5" style={{ breakInside: "avoid" }}>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <SectionHeader label={label} tone="muted" />
        </div>
        {!listKey && builder?.canEdit && (
          <IconTip label="Company-wide content — edited in Itinerary Settings">
            <span
              className="builder-only no-print shrink-0 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-neutral-500/90"
            >
              <Lock size={9} /> Company-wide
            </span>
          </IconTip>
        )}
      </div>
      {listKey ? (
        <EditablePolicyList
          items={items}
          listKey={listKey}
          itemClassName="text-[11px] pl-0.5 !p-0 space-y-1.5 text-neutral-800"
          marker={() => (
            <span
              className="mt-1.5 size-0.75 rounded-full shrink-0"
              style={{ backgroundColor: DOC.inkMuted }}
            />
          )}
        />
      ) : (
        <ul className="space-y-1.5 text-[11px] pl-0.5" style={{ color: DOC.inkSoft }}>
          {items.map((t) => (
            <li key={t} className="flex items-start gap-2">
              <span
                className="mt-1.5 size-0.75 rounded-full shrink-0"
                style={{ backgroundColor: DOC.inkMuted }}
              />
              <span className="leading-relaxed">{t}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Section marker inside a day — Stay / Transport / Meals / Experiences.
 *
 * These used to be bordered, tinted sub-cards. A box inside the day's own box
 * gave every page a double frame, and the tints fought the day card's ground —
 * between them that nesting was most of what made the document feel boxy.
 *
 * The marker does the separating instead: an icon, a letterspaced label, and a
 * hairline running out to the edge, with the content simply indented beneath
 * it. All four share the identical lockup, so what tells them apart is the
 * icon and the word — the actual information — rather than a differently
 * coloured frame drawn around each one. Consistency is what makes them
 * scannable; four different box treatments is what made them noise. */
/** The day's note, as a toned callout.
 *
 * Absent by default: a day with nothing to say renders nothing at all, in the
 * builder as well as on the client's copy. Previously the builder kept an
 * empty placeholder alive so the note was findable, which meant every day
 * carried a stray italic line whether it had a note or not. The way in is now
 * the day menu (see DayActionsMenu → Note), which is also where the title and
 * tone are set.
 *
 * Once a note exists, its title and body are editable in place through the
 * same fields the drawer writes. */
function DayNote({ day }: { day: DayItinerary }) {
  const DOC = useDocTheme();
  const builder = useOptionalBuilder();
  const canEdit = !!builder?.canEdit;
  const title = (day.notesTitle ?? "").trim();
  const body = day.notes.trim();
  // A note with a TYPE but no text yet is a note being written — the shell has
  // to render for there to be anything to scroll to and type into. The client
  // never sees it: outside the builder an empty note is no note.
  const started = day.notesType != null;
  if (!title && !body && !(canEdit && started)) return null;

  const tone = noteTone(day.notesType);
  const t = DOC.notes[tone];
  const Icon = NOTE_TONE_ICONS[tone];

  // Title and body are already click-to-edit in place, so the drawer's only
  // remaining job here is the note's TONE — which has no inline
  // representation beyond the colour it produces.
  const actions: SectionAction[] | undefined = canEdit ? [
    {
      icon: Pencil, label: "Change note type",
      onClick: () => builder!.openDrawer({ kind: "note-edit", day: day.day }),
    },
    {
      icon: Trash2, label: "Remove this note", tone: "danger",
      onClick: () => builder!.replaceDay(day.day, (d) => ({
        ...d, notes: "", notesType: null, notesTitle: null,
      })),
    },
  ] : undefined;

  return (
    <EditableSection actions={actions}>
      <div
        className="rounded-lg px-3 py-2.5"
        style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, breakInside: "avoid" }}
      >
        <div className="flex items-start gap-2">
          <Icon size={13} color={t.icon} className="shrink-0 mt-px" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {/* Falls back to the tone's own label, so a note is never headless
                — and an exec who wants no heading of their own gets a sensible
                one for free. */}
              <EditableText
                as="p"
                value={day.notesTitle ?? ""}
                field={{ scope: "day", day: day.day, key: "notesTitle" }}
                placeholder={t.label}
                fallback={t.label}
                className="block text-[9px] font-semibold uppercase tracking-[0.13em]"
                style={{ color: t.icon }}
              />

            </div>
            <EditableText
              as="p"
              multiline
              value={day.notes}
              field={{ scope: "day", day: day.day, key: "notes" }}
              placeholder="Add the note…"
              className="block text-[11px] leading-relaxed mt-0.5"
              style={{ color: t.ink }}
            />
          </div>
        </div>
      </div>
    </EditableSection>
  );
}

/** A day's running cost, shown beside its number. */
/** One control on a section's floating toolbar. */
export type SectionAction = {
  icon: React.ElementType;
  /** Tooltip and accessible name — the buttons themselves are icon-only. */
  label: string;
  onClick: () => void;
  tone?: "default" | "danger";
};

/** Wraps an editable block in the day so it outlines on hover and floats its
 * controls above the top-right corner.
 *
 * The controls are deliberately DETACHED — absolutely positioned, on their own
 * surface, above everything. This document is also the PDF, and a control that
 * sits inline in the flow reads as part of the page you're about to send a
 * client. Chrome should look like chrome.
 *
 * The outline is `outline`, not `border`: a border would shift the block's
 * layout by a pixel on hover, which on a paginated A4 document can push
 * content across a page boundary while you're pointing at it. */
function EditableSection({ actions, children }: {
  actions?: SectionAction[];
  children: React.ReactNode;
}) {
  if (!actions || actions.length === 0) return <>{children}</>;
  return (
    <div
      className="group/section relative -mx-1.5 px-1.5 py-1 rounded-lg transition-[outline-color] outline outline-2 outline-transparent hover:outline-dashboard-primary/25"
      style={{ breakInside: "avoid" }}
    >
      {children}

      <div
        className={cn(
          "builder-only no-print absolute -top-2.5 right-1 z-30 flex items-center gap-0.5",
          "rounded-lg ring-1 ring-inset ring-neutral-200  bg-white p-0.5 shadow-xl shadow-neutral-200/80",
          "opacity-0 pointer-events-none transition-opacity duration-[120ms]",
          "group-hover/section:opacity-100 group-hover/section:pointer-events-auto",
          "focus-within:opacity-100 focus-within:pointer-events-auto",
        )}
      >
        {actions.map(({ icon: Icon, label, onClick, tone }) => (
          <IconTip key={label} label={label}>
            <button
              type="button"
              onClick={onClick}
              aria-label={label}
              className={cn(
                "flex items-center justify-center size-6 rounded-md transition-colors duration-[120ms]",
                tone === "danger"
                  ? "text-dashboard-error/60 hover:bg-dashboard-error/10 hover:text-dashboard-error"
                  : "text-dashboard-base-content/40 hover:bg-dashboard-base-200 hover:text-dashboard-base-content/75",
              )}
            >
              <Icon size={13} />
            </button>
          </IconTip>
        ))}
      </div>
    </div>
  );
}

/**
 * Names what's missing on a section that the price silently ignores.
 *
 * Builder-only in every sense: gated on canEdit, marked builder-only so the
 * PDF can't bake it in, and absent from the client's document entirely. It is
 * an instruction to the exec, not information for the traveller.
 *
 * Amber rather than red. Nothing here is broken — the package saves, exports
 * and sends. It's just priced as if this line were free, which is a thing to
 * fix before quoting, not an error to block on.
 */
function GapBadge({ gaps }: { gaps: Gaps }) {
  const builder = useOptionalBuilder();
  if (!builder?.canEdit || gaps.length === 0) return null;
  return (
    <span
      className="builder-only no-print inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold whitespace-nowrap align-middle"
      // Literal hex for the usual reason — see DOC. This one is belt and
      // braces, since builder-only already keeps it out of the export.
      style={{ backgroundColor: "#FDF4E7", color: "#8A5A16", border: "1px solid #F2DEBE" }}
    >
      <AlertTriangle size={9} /> {gaps.join(" · ")}
    </span>
  );
}

/** A hotel's star rating, for the document.
 *
 * Literal hex, not `text-amber-500`: Tailwind v4 emits oklch() and
 * html2canvas-pro can't resolve it, so a themed colour exports as black. Same
 * reason DOC exists.
 *
 * hotels.stay_type is free text. A number becomes glyphs; anything else
 * ("Boutique", "Heritage") is shown as written rather than guessed at, and an
 * empty value renders nothing — so a hand-typed stay stays clean.
 */
/**
 * Check-in → nights → check-out, drawn as a journey rather than two labelled
 * fields. Mirrors the live package page's stay timeline (website
 * packages/[…]/components/Itnary.tsx) — same custom door glyphs, same dashed
 * rules either side of a nights pill, same accent uprights closing both ends —
 * so a client who saw the trip on the site recognises the same object in the
 * quote. Only the scale differs: this sits inside a day card, not a full-width
 * section.
 *
 * The times stay click-to-edit here, which the live page has no need for; the
 * `display` formatter is what lets the stored "11:00" read as "11:00 AM"
 * without rewriting what's saved.
 */
function StayTimeline({ day, checkInDate, checkOutDate }: {
  day: DayItinerary;
  checkInDate: Date | null;
  checkOutDate: Date | null;
}) {
  return (
    <div className="flex flex-row items-center gap-2  my-4">
      {/* Accent upright — the bar that closes the left end of the strip. */}
      <span className="w-[0.18em] h-9 rounded-full bg-primary-400 shrink-0" />

      <div className="flex items-center gap-2 shrink-0">
        <span className="text-neutral-400/90 shrink-0 [&>svg]:h-5 [&>svg]:w-auto transform-[scaleX(-1)]">
          <CheckInIcon />
        </span>
        <span className="flex flex-col items-start gap-0.5">
          <span className="text-[9px] font-medium text-neutral-700/90 font-heading whitespace-nowrap">Check In:</span>
          <EditableText
            value={day.hotelCheckIn}
            field={{ scope: "day", day: day.day, key: "hotelCheckIn" }}
            placeholder="set"
            fallback="—"
            display={formatTime12h}
            className={cn(DISPLAY, "text-[12px] font-semibold font-heading text-neutral-900 whitespace-nowrap")}
          />
          {checkInDate && (
            <span className="text-[10px] text-neutral-500/90">{formatShortDate(checkInDate)}</span>
          )}
        </span>
      </div>

      {/* Dashes flanking the nights pill. min-w-0 on the rules rather than the
          pill, so a narrow day card eats the dashes and never the times. */}
      <div className="flex-1 flex items-center gap-1 min-w-0 px-1">
        <span className="flex-1 min-w-0 border-b-[0.15em] border-dashed border-neutral-300/70" />
        <span className="flex items-center gap-1 shrink-0 rounded-md bg-neutral-50 ring-1 ring-inset ring-neutral-300 px-2 py-0.5">
          <span className="text-[11px] font-medium text-neutral-800">1N</span>
          <StarAndCrescentIcon weight="duotone" className="size-3 text-neutral-400/90 -rotate-20" />
        </span>
        <span className="flex-1 min-w-0 border-b-[0.15em] border-dashed border-neutral-300/70" />
      </div>

      <div className="flex flex-row-reverse items-center gap-2 shrink-0">
        <span className="text-neutral-400/90 shrink-0 [&>svg]:h-5 [&>svg]:w-auto">
          <CheckOutIcon />
        </span>
        <span className="flex flex-col items-end gap-0.5">
          <span className="text-[9px] font-medium text-neutral-700/90 font-heading whitespace-nowrap">Check Out:</span>
          <EditableText
            value={day.hotelCheckOut}
            field={{ scope: "day", day: day.day, key: "hotelCheckOut" }}
            placeholder="set"
            fallback="—"
            display={formatTime12h}
            className={cn(DISPLAY, "text-[12px] font-semibold font-heading text-neutral-900 whitespace-nowrap")}
          />
          {checkOutDate && (
            <span className="text-[10px] text-neutral-500/90">{formatShortDate(checkOutDate)}</span>
          )}
        </span>
      </div>

      <span className="w-[0.18em] h-9 rounded-full bg-primary-400 shrink-0" />
    </div>
  );
}

/**
 * Pickup → distance → drop, as a vertical run down an accent rail. The transfer
 * counterpart to StayTimeline, and the same borrowing: duotone pins, a road
 * glyph beside the distance, and accent uprights marking each end, matching the
 * live package page's transfer strip (website packages/[…]/components/Itnary).
 *
 * Two departures from the live version, both because this one is editable:
 * every value is click-to-edit, and drive time rides alongside the distance —
 * the builder captures it and the client page has nowhere to show it.
 */
function TransferTimeline({ day }: { day: DayItinerary }) {
  const hasDistance = day.transportDistanceKm != null;

  /* The rail is ONE continuous grey line down the whole block — a left border
     on this wrapper — and each pin row paints a short accent segment ON TOP of
     it via ::after, pulled left by exactly the border width so it covers the
     grey rather than sitting beside it. That's what makes the red read as two
     marked ends of a single line instead of two free-floating bars.
     The leg between them then hangs its own, indented rail off a spacer. */
  const railRow =
    "relative after:content-[''] after:absolute after:left-0 after:top-0 " +
    "after:w-[0.15em] after:h-full after:max-h-7 after:bg-primary-400 after:-translate-x-[0.15em]";

  return (
    <div className="w-full flex flex-col gap-1.5 border-l-[0.15em] border-neutral-200">
      {/* Pickup */}
      <div className={railRow}>
        <div className="flex items-center gap-2">
          <span className="size-6 flex items-center justify-center ml-2 shrink-0">
            <MapPinIcon weight="duotone" className="size-4.5 text-neutral-400/90" />
          </span>
          <span className="flex items-baseline gap-2 min-w-0">
            <span className="text-[11px] text-neutral-700/90 font-heading shrink-0">Pickup Point:</span>
            <EditableText
              value={day.transportPickup}
              field={{ scope: "day", day: day.day, key: "transportPickup" }}
              placeholder="set pickup"
              fallback="—"
              className={cn(DISPLAY, "text-[12px] font-semibold font-heading text-neutral-900 truncate")}
            />
          </span>
        </div>
      </div>

      {/* The leg. Its rail is parallel to the main one but indented, so the
          distance reads as belonging to the stretch between the two points
          rather than to either end. */}
      <div className="w-full flex items-stretch min-h-7">
        <span className="w-8 shrink-0" />
        <span className="flex-1 border-l-[0.15em] border-neutral-200 px-3 flex items-center gap-1 ml-5.5">
          <span className="text-[11px] font-medium text-neutral-500/90 flex items-center gap-1">
            <EditableText
              value={hasDistance ? `${day.transportDistanceKm} km` : ""}
              field={{ scope: "day", day: day.day, key: "transportDistanceKm" }}
              placeholder="distance"
            />
            {hasDistance && day.transportTravelTime && <span className="text-neutral-400/90">·</span>}
            <EditableText
              value={day.transportTravelTime}
              field={{ scope: "day", day: day.day, key: "transportTravelTime" }}
              placeholder="drive time"
            />
          </span>
          <RoadHorizonIcon weight="duotone" className="size-4 text-neutral-400/90 ml-1 shrink-0" />
        </span>
      </div>

      {/* Drop */}
      <div className={railRow}>
        <div className="flex items-center gap-2">
          <span className="size-6 flex items-center justify-center ml-2 shrink-0">
            <MapPinIcon weight="duotone" className="size-4.5 text-neutral-400/90" />
          </span>
          <span className="flex items-baseline gap-2 min-w-0">
            <span className="text-[11px] text-neutral-700/90 font-heading shrink-0">Drop Point:</span>
            <EditableText
              value={day.transportDrop}
              field={{ scope: "day", day: day.day, key: "transportDrop" }}
              placeholder="set drop"
              fallback="—"
              className={cn(DISPLAY, "text-[12px] font-semibold font-heading text-neutral-900 truncate")}
            />
          </span>
        </div>
      </div>
    </div>
  );
}

function StayStars({ raw }: { raw: string }) {
  const DOC = useDocTheme();
  const value = raw.trim();
  if (!value) return null;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1 || n > 7) {
    return (
      <span
        className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.1em]"
        style={{ color: DOC.inkMuted }}
      >
        {value}
      </span>
    );
  }
  return (
    <span className="shrink-0 flex items-center gap-[1px]" title={value} aria-label={value}>
      {Array.from({ length: n }, (_, i) => (
        <Star key={i} size={9} color="#D6A32E" />
      ))}
    </span>
  );
}

function DaySubHead({ icon: Icon, label, meta, onEdit }: {
  icon: React.ElementType;
  label: string;
  /** Optional inline detail (distance, drive time, route) shown after the
   * label — it rides on the same line rather than earning its own row. */
  meta?: string | null;
  /** When supplied, the marker becomes the way into this section's task
   * drawer. Only ever passed inside the builder — the client-facing document
   * gets the plain, non-interactive marker. */
  onEdit?: () => void;
}) {
  const DOC = useDocTheme();
  const inner = (
    <>
      <Icon size={16} className="shrink-0 text-neutral-400/90" />
      <span
        className="text-[11px] font-semibold uppercase tracking-[0.14em] shrink-0 text-neutral-700/90 "
      >
        {label}
      </span>
      {meta && (
        <span className="text-[10px] truncate min-w-0 text-neutral-500/90" >
          {meta}
        </span>
      )}
      <span className="h-px flex-1 bg-neutral-300/60" />
      {onEdit && (
        // builder-only: real rendered text, so it would otherwise be baked
        // into the exported PDF (html2canvas rasterises the screen DOM — see
        // the data-exporting rule in PRINT_STYLES).
        <span
          className="builder-only no-print text-[9px] font-semibold uppercase tracking-widest shrink-0 opacity-0 group-hover/sub:opacity-100 group-hover/section:opacity-100 transition-opacity"
          style={{ color: DOC.accent }}
        >
          Edit
        </span>
      )}
    </>
  );

  if (!onEdit) {
    return (
      <div className="flex items-center gap-2" style={{ breakAfter: "avoid" }}>{inner}</div>
    );
  }

  return (
    <IconTip label={`Edit ${label.toLowerCase()}`}>
      <button
        type="button"
        onClick={onEdit}
        className="group/sub flex w-full items-center gap-2 text-left rounded-[3px] hover:bg-dashboard-primary/6 focus-visible:outline-2 focus-visible:outline-dashboard-primary/60"
        style={{ breakAfter: "avoid" }}
      >
        {inner}
      </button>
    </IconTip>
  );
}

/** Indent that aligns a sub-section's content under its DaySubHead label —
 * the 11px icon plus the 8px gap it sits in. */
const SUBHEAD_INDENT = "pl-[19px]";

function ActivityRow({
  activity, dayNumber, activityIndex, onImageChange, onCaptionChange,
}: {
  activity: ActivityInput;
  dayNumber?: number;
  activityIndex?: number;
  onImageChange?: OnImageChange;
  onCaptionChange?: (activityIndex: number, photoIndex: number, caption: string) => void;
}) {
  const builder = useOptionalBuilder();
  // Blank rows are how a just-added experience gets somewhere to type. Outside
  // the builder a nameless activity is nothing and renders as nothing.
  if (!activity.title.trim() && !builder?.canEdit) return null;
  const gallery = activity.photos.length > 0 ? activity.photos : (activity.photo ? [activity.photo] : []);
  const editable = !!onImageChange && dayNumber != null && activityIndex != null;
  // Always pad up to 3 tiles when editable — previously this only added an
  // empty "add a photo" tile when the gallery had zero photos, so once an
  // activity had even one, there was no way to add the remaining ones up to
  // the 3-photo max, only replace what was already there. Read-only view
  // (public page/PDF) still shows exactly what's there, no empty tiles.
  const slots: (string | null)[] = editable
    ? [...gallery.slice(0, 3), ...Array(Math.max(0, 3 - gallery.length)).fill(null)]
    : gallery.slice(0, 3);

  return (
    <div className="space-y-2" style={{ breakInside: "avoid" }}>
      <div className="flex items-start gap-2">
        <span className="flex items-center justify-center size-5 rounded-full bg-neutral-50 text-neutral-500/90 shrink-0 mt-0.5 ring-1 ring-inset ring-neutral-200/80 shadow-lg shadow-neutral-200/90">
          <Sparkles size={11} />
        </span>
        <div className="flex-1 min-w-0">
          {/* Only addressable for editing when this row knows where it lives —
              the same dayNumber/activityIndex pair the photo editor already
              requires. Without them (any caller that renders an activity
              without its position, e.g. a summary) it stays plain text. */}
          {dayNumber != null && activityIndex != null ? (
            <>
              <EditableText
                as="p"
                value={activity.title}
                field={{ scope: "activity", day: dayNumber, index: activityIndex, key: "title" }}
                placeholder="Activity name…"
                className="block text-[12.5px] font-semibold font-heading text-neutral-900"
              />
              <EditableText
                as="p"
                multiline
                value={activity.description}
                field={{ scope: "activity", day: dayNumber, index: activityIndex, key: "description" }}
                placeholder="Describe this experience…"
                className="block text-xs text-neutral-700/90 mt-0.5"
              />
            </>
          ) : (
            <>
              <p className="text-xs font-semibold text-neutral-800">{activity.title}</p>
              {activity.description && (
                <p className="text-xs text-neutral-500 mt-0.5">{activity.description}</p>
              )}
            </>
          )}
        </div>
      </div>
      {slots.length > 0 && (
        <div className="ml-7 space-y-1.5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-primary-600">Glimpses of the experience</p>
          <div className="grid grid-cols-3 gap-1.5">
            {slots.map((src, i) => (
              <div key={i} className="group/img relative rounded-lg overflow-hidden">
                {src ? (
                  <>
                    <SafeImg src={src} alt={activity.photoLabels[i] || activity.title} className="w-full h-30 object-cover" />
                    <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 via-black/10 to-transparent px-1.5 py-1 pt-3">
                      <p className="text-[9px] text-white font-medium truncate">{activity.photoLabels[i] || activity.title}</p>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-30 bg-neutral-50 border-2 border-dashed border-neutral-200 flex items-center justify-center">
                    <ImageIcon size={16} className="text-neutral-300" />
                  </div>
                )}
                {editable && (
                  <ImageEditButton
                    value={src ?? ""}
                    onChange={(url) => onImageChange!({ kind: "activityPhoto", day: dayNumber!, activityIndex: activityIndex!, photoIndex: i }, url)}
                    dialogTitle="Activity Photo"
                    className="top-1 right-1 size-6"
                    captionValue={activity.photoLabels[i] ?? ""}
                    onCaptionChange={onCaptionChange ? (caption) => onCaptionChange(activityIndex!, i, caption) : undefined}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const MEAL_CHIPS = [
  { key: "breakfast", label: "Breakfast", icon: Coffee },
  { key: "lunch", label: "Lunch", icon: Soup },
  { key: "dinner", label: "Dinner", icon: UtensilsCrossed },
] as const;

/** Only shows meals actually included — an excluded meal (e.g. no breakfast
 * on this plan) is simply left out, not shown crossed-out/disabled. */
function MealsRow({ meals }: { meals: string[] }) {
  const included = MEAL_CHIPS.filter(({ key }) => meals.some((m) => m.toLowerCase().includes(key)));
  const extras = meals.filter((m) => !MEAL_CHIPS.some((c) => m.toLowerCase().includes(c.key)));
  if (included.length === 0 && extras.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {included.length > 0 && (
        <div className="flex items-stretch gap-1.5">
          {included.map(({ key, label, icon: Icon }) => (
            <div
              key={key}
              className="flex-1 flex items-center justify-between gap-1 px-2 py-1.5 rounded-lg border text-[11px] font-medium bg-white bg-linear-to-b from-emerald-50/30 via-emerald-50/60 to-emerald-100/60 border-emerald-200 text-emerald-800"
            >
              <span className="flex items-center gap-1">
                <Icon size={12} className="text-emerald-600" />
                {label}
              </span>
              <CheckCircle size={12} className="text-emerald-600 shrink-0" />
            </div>
          ))}
        </div>
      )}
      {extras.length > 0 && (
        <p className="text-[10px] text-neutral-500">+ {extras.join(", ")}</p>
      )}
    </div>
  );
}

type TermsBlock = { title: string | null; items: string[]; isList: boolean };

/** Splits the free-text terms field on blank lines into sections, and each
 * section's lines into a bullet list when they're actually "• " prefixed
 * (e.g. pasted in from a catalog package's policies) — a raw single-sentence
 * value still just renders as one plain paragraph, not a one-item list. */
function parseTermsBlocks(text: string): TermsBlock[] {
  return text
    .split(/\n\s*\n/)
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      const hasTitle = lines.length > 1 && !lines[0].startsWith("•") && lines.slice(1).some((l) => l.startsWith("•"));
      const title = hasTitle ? lines[0].replace(/:\s*$/, "") : null;
      const body = hasTitle ? lines.slice(1) : lines;
      const isList = body.length > 0 && body.every((l) => l.startsWith("•"));
      const items = isList ? body.map((l) => l.replace(/^•\s*/, "")) : [body.join(" ")];
      return { title, items, isList };
    });
}

function TermsAndConditions({ text }: { text: string }) {
  const blocks = parseTermsBlocks(text);
  return (
    <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden shadow-lg shadow-neutral-200/80" style={{ breakInside: "avoid" }}>
      <div className="flex items-center gap-2 px-3 py-2 bg-white bg-linear-to-b from-white via-neutral-50 to-neutral-200/70 border-b border-neutral-200/80">
        <span className="flex items-center justify-center size-5 rounded-lg bg-primary-50 p-1 ring-1 ring-inset ring-primary-200/80 shadow-sm shadow-primary-200/80 shrink-0">
          <Info size={16} className="text-primary-500" />
        </span>
        <h3 className={cn(DISPLAY, "text-[13px] font-semibold font-heading text-neutral-900")}>Additional Notes</h3>
      </div>
      <div className="p-4 space-y-3.5">
        {blocks.map((block, i) => (
          <div key={i} className="space-y-1.5">
            {block.title && (
              <p className="text-xs font-bold text-neutral-900">{block.title}</p>
            )}
            {block.isList ? (
              <ul className="space-y-1">
                {block.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-2 text-xs text-neutral-700/90 leading-relaxed">
                    <span className="mt-1.75 size-1 rounded-full bg-primary-400 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-neutral-600 leading-relaxed">{block.items[0]}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const MEAL_DISPLAY_ORDER = ["breakfast", "morning snacks", "lunch", "evening snacks", "dinner"];

function orderMeals(meals: string[]): string[] {
  return [...meals].sort((a, b) => {
    const ia = MEAL_DISPLAY_ORDER.indexOf(a.toLowerCase());
    const ib = MEAL_DISPLAY_ORDER.indexOf(b.toLowerCase());
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

/** Breakfast is served by the PREVIOUS night's hotel — the client eats it the
 * morning they check out, not the day they check in — so day N's displayed
 * breakfast is pulled from day N-1's stored meals, while lunch/dinner/snacks
 * come from day N's own stored meals (excluding any breakfast already
 * assigned to the day it's checking out of). Mirrors the public package
 * page's meal-shift algorithm (app/(website)/packages/.../page.tsx). */
export function computeShiftedMeals(itineraries: DayItinerary[]): string[][] {
  return itineraries.map((day, i) => {
    const chosen = new Set<string>();
    const prevMeals = i > 0 ? itineraries[i - 1].meals : [];
    if (prevMeals.some((m) => m.toLowerCase().includes("breakfast"))) chosen.add("Breakfast");
    for (const m of day.meals) {
      if (m.toLowerCase().includes("breakfast")) continue;
      chosen.add(m);
    }
    return orderMeals([...chosen]);
  });
}

/** Compact "Day | Destination | Hotel | Meals | Cab" grid so the pattern
 * across the whole trip is visible at a glance, ahead of the detailed
 * per-day cards below. */
/**
 * One cell of the day-wise summary, and the way into what it describes.
 *
 * The table is the densest view of the trip there is — five facts a day, every
 * day, on one screen — so it's where gaps get spotted. Before this it could
 * only report them: seeing "—" under Cab for day 4 meant scrolling to day 4 and
 * finding its transport section. Now the cell IS the control.
 *
 * Plain text outside the builder and while locked, so the client's copy and
 * the PDF are exactly the table they always were.
 */
function SummaryCell({ value, action, onOpen }: {
  /** What's there, or null for an empty column. */
  value: React.ReactNode;
  /** Names the gap, not the mechanism: "Add a hotel", never "Open drawer". */
  action: string;
  onOpen: () => void;
}) {
  const DOC = useDocTheme();
  const builder = useOptionalBuilder();
  if (!builder?.canEdit) return <>{value ?? "—"}</>;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={value ? action.replace(/^Add/, "Edit") : action}
      className={cn(
        "w-full text-left rounded-[3px] -mx-1 px-1 transition-colors",
        "hover:bg-dashboard-primary/8 focus-visible:outline-2 focus-visible:outline-dashboard-primary/60",
      )}
    >
      {value ?? (
        <>
          {/* Two renderings of "nothing here": the offer while editing, and
              the em dash the client's document has always shown. See the
              .builder-only / .export-only pair in PRINT_STYLES. */}
          <span className="builder-only no-print font-medium cursor-pointer" style={{ color: DOC.accent }}>
            + {action.replace(/^Add /, "")}
          </span>
          <span className="export-only">—</span>
        </>
      )}
    </button>
  );
}

export function DaySummaryTable({
  itineraries, travelDate, stops = [], adults = 0, childCount = 0,
}: {
  itineraries: DayItinerary[];
  travelDate?: string;
  /** Route stops — used to derive which city each day is in when the day's
   * own hotel doesn't have a location on file yet. */
  stops?: StopInput[];
  /** Party size — needed to work out how many rooms/mattresses this day's
   * stay actually needs, the same math the hotel drawer prices from. */
  adults?: number;
  childCount?: number;
}) {
  const DOC = useDocTheme();
  const builder = useOptionalBuilder();
  const shiftedMeals = computeShiftedMeals(itineraries);
  const dayLocations = deriveDayLocations(stops, itineraries.length);
  const open = (t: DrawerTarget) => () => builder?.openDrawer(t);

  // Matches the booking voucher's tables (components/voucher/VoucherDocument —
  // ItineraryTable): a solid accent header bar in white type, every cell ruled
  // rather than just a hairline between rows, zebra striping and top-aligned
  // cells. The voucher hard-codes primary-500/neutral-200; here the same values
  // arrive through the theme, so the table is pixel-identical on the house
  // template and still follows a package that's on a different one.
  //
  // The header's own rules are a translucent white rather than a lighter step
  // of the accent — over an accent fill it reads the same as the voucher's
  // primary-300/70, without needing a second accent shade per template.
  const CELL_BORDER = `1px solid ${DOC.rule}`;
  const HEAD_BORDER = "1px solid rgba(255,255,255,0.28)";
  const headCell = "text-left font-semibold px-3 py-2.5";
  const bodyCell = "px-3 py-3 text-neutral-800";
  /** Sub-lines under a cell's main value — the day's date, the final drop. */
  const mutedLine = "block text-[10px] text-neutral-500/90";
  /** Icon tint for the meal line. A literal hex passed as a `color` PROP, not
   * a text-emerald-500 class: an inline SVG's stroke is the one thing
   * html2canvas-pro can't resolve from an oklch token, so a classed icon comes
   * out blank in the exported PDF. The text beside it is fine either way, and
   * uses the theme's own emerald-600 (DOC.positive). */
  const MEAL_ICON = "#10B981";
  /** Matches the wrapper's rounded-lg exactly. The wrapper carries no padding,
   * so the drawn outline and the clipping container sit on the same arc — any
   * inset here would show as a hairline gap between the border and the shadow. */
  const RADIUS = "0.5rem";

  // Edges are declared per-side rather than as a single `border`, because the
  // table had to move off border-collapse: collapsed borders ignore
  // border-radius entirely, so the rounded bottom corners below simply would
  // not render. Separate borders draw every side that's asked for, so each rule
  // is claimed exactly once — left on every cell plus right on the last column,
  // top on every cell plus bottom on the last row — or every internal line
  // would be two 1px borders stacked.
  const cellEdges = (isLastCol: boolean, isLastRow: boolean): React.CSSProperties => ({
    borderLeft: CELL_BORDER,
    borderTop: CELL_BORDER,
    ...(isLastCol ? { borderRight: CELL_BORDER } : {}),
    ...(isLastRow ? { borderBottom: CELL_BORDER } : {}),
  });

  return (
    // No breakInside:avoid on this outer wrapper: for a long itinerary, the
    // WHOLE table would then be one indivisible unit taller than a single
    // page, which forces the browser to ignore the hint and split it at an
    // arbitrary point anyway (mid-row). Instead each <tr> below is protected
    // individually, so the table breaks cleanly between days — with the
    // header row repeating on each new page, standard table pagination.
    <div
      className="rounded-lg overflow-hidden shadow-lg shadow-neutral-200/80"
      style={{ backgroundColor: DOC.card }}
    >
      <table className="w-full text-sm border-separate" style={{ borderSpacing: 0 }}>
        {/* print:table-header-group repeats the header on every page the table
            spills onto — a five-column table read across a page break is
            otherwise unlabelled. Same reason the voucher carries it. */}
        <thead className="print:table-header-group">
          <tr style={{ backgroundColor: DOC.accent, color: "#FFFFFF", breakInside: "avoid" }}>
            <th className={cn(headCell, "w-16")} style={{ borderLeft: HEAD_BORDER }}>Day</th>
            <th className={headCell} style={{ borderLeft: HEAD_BORDER }}>Destination</th>
            <th className={headCell} style={{ borderLeft: HEAD_BORDER }}>Hotel</th>
            <th className={headCell} style={{ borderLeft: HEAD_BORDER }}>Meals</th>
            <th className={headCell} style={{ borderLeft: HEAD_BORDER, borderRight: HEAD_BORDER }}>Cab</th>
          </tr>
        </thead>
        <tbody>
          {itineraries.map((d, i) => {
            const date = travelDate ? dayCalendarDate(travelDate, d.day) : null;
            // The route stop's own name wins — it's what the exec explicitly
            // planned in "Route (Destinations & Nights)". The hotel's raw
            // accommodationLocation is only a fallback for a day whose stop
            // couldn't be derived (no route stops set at all), since that
            // field is often the hotel's literal town (e.g. "Vandiperiyar"),
            // which can differ from — and looks inconsistent with — the
            // destination name the route itself uses (e.g. "Thekkady").
            const destination = dayLocations[i] || d.accommodationLocation || "—";
            const isLastDay = i === itineraries.length - 1;
            // Falls back to the whole string when there's no separator — a
            // hand-typed hotel with no room named still shows its name.
            const { manualHotelName: hotelName, manualRoomName: roomName } =
              splitManualHotelName(d.accommodation);
            const mealLine = mealIncludedText(d.hotelMealPlan);
            return (
              <tr
                key={d.day}
                className="align-top"
                style={{ breakInside: "avoid", backgroundColor: i % 2 === 1 ? DOC.paper : DOC.card }}
              >
                {/* The Day cell navigates rather than editing — it stands for
                  the whole day, which has no single drawer. Selecting it too
                  keeps the layers rail and the Itinerary panel pointing at
                  what you just jumped to. */}
                <td
                  className={cn(bodyCell, "whitespace-nowrap")}
                  style={{ ...cellEdges(false, isLastDay), ...(isLastDay ? { borderBottomLeftRadius: RADIUS } : {}) }}
                >
                  <SummaryCell
                    action={`Go to day ${d.day}`}
                    onOpen={() => { builder?.setSelectedDay(d.day); scrollToDay(d.day); }}
                    value={
                      <>
                        <span className="block text-xs font-bold" style={{ color: DOC.accent }}>Day {d.day}</span>
                        {date && (
                          <span className={cn(mutedLine, "mt-0.5")}>{formatShortDate(date)}</span>
                        )}
                      </>
                    }
                  />
                </td>
                <td className={bodyCell} style={cellEdges(false, isLastDay)}>
                  <SummaryCell
                    action="Add a destination"
                    onOpen={open({ kind: "stops-edit" })}
                    value={destination ? (
                      <>
                        {titleCase(destination)}
                        {isLastDay && d.transportDrop && (
                          <span className={mutedLine}>Drop: {titleCase(d.transportDrop)}</span>
                        )}
                      </>
                    ) : null}
                  />
                </td>
                <td className={bodyCell} style={cellEdges(false, isLastDay)}>
                  <SummaryCell
                    action="Add a hotel"
                    // A day awaiting the hotel team opens its request, not the
                    // picker — the room isn't the exec's to choose right now.
                    onOpen={open(
                      d.hotelPending ? { kind: "hotel-request", day: d.day }
                        : d.accommodation ? { kind: "hotel-edit", day: d.day }
                          : { kind: "hotel-replace", day: d.day },
                    )}
                    // `accommodation` is stored as one string, "Hotel — Room"
                    // (fillPendingHotel and HotelRoomPicker's auto-fill both write
                    // that separator), so it's split back apart rather than
                    // printed whole: the hotel and its stars belong on one line,
                    // the room on the next.
                    //
                    // Deliberately NOT accommodationRoomSpecs — that field is the
                    // bed/occupancy blurb ("Twin beds · 3 Stars · Sleeps 3"),
                    // which repeats the star count already shown beside the name
                    // and adds detail this column doesn't need.
                    value={d.accommodation ? (
                      <>
                        <span className="flex items-center gap-1.5 flex-wrap">
                          {/* A step darker than the cell around it: the hotel
                              is the thing being checked in this row, and the
                              room, occupancy and meal lines beneath it are
                              already muted against it. */}
                          <span className="text-neutral-900">{titleCase(hotelName ?? d.accommodation)}</span>
                          <StayStars raw={d.accommodationStarRating} />
                        </span>
                        {roomName && (
                          <span className={cn(mutedLine, "mt-0.5")}>{titleCase(roomName)}</span>
                        )}
                        {(() => {
                          const plan = planRoomOccupancy(adults, childCount, {
                            max_occupancy: d.accommodationRoomCapacity,
                            extra_bed_capacity: d.accommodationExtraBedCapacity,
                            max_adults: d.accommodationMaxAdults,
                            max_children: d.accommodationMaxChildren,
                          }, d.roomsCount);
                          // An explicit manualExtraBeds override (set in the Hotel
                          // Info drawer) wins over the auto-computed count — same
                          // rule the pricing engine itself uses (see
                          // computeBuilderHotelPricing), so this line never shows
                          // a different mattress count than what's actually
                          // charged or than what the exec typed in.
                          const mattresses = d.manualExtraBeds ?? plan.mattresses;
                          return (
                            <span className={cn(mutedLine, "mt-0.5")}>
                              {plan.rooms} room{plan.rooms !== 1 ? "s" : ""}
                              {mattresses > 0 && ` · ${mattresses} mattress${mattresses !== 1 ? "es" : ""}`}
                            </span>
                          );
                        })()}
                        {mealLine && (
                          <span
                            className="flex items-center gap-1 text-[10px] mt-0.5"
                            style={{ color: DOC.positive }}
                          >
                            <Utensils size={9} color={MEAL_ICON} className="shrink-0" />
                            {mealLine}
                          </span>
                        )}
                      </>
                    ) : null}
                  />
                </td>
                <td className={bodyCell} style={cellEdges(false, isLastDay)}>
                  <SummaryCell
                    action="Add meals"
                    onOpen={open({ kind: "meals-edit", day: d.day })}
                    value={shiftedMeals[i].length > 0 ? shiftedMeals[i].join(", ") : null}
                  />
                </td>
                <td
                  className={bodyCell}
                  style={{ ...cellEdges(true, isLastDay), ...(isLastDay ? { borderBottomRightRadius: RADIUS } : {}) }}
                >
                  <SummaryCell
                    action="Add a cab"
                    onOpen={open({ kind: "transfer-edit", day: d.day })}
                    value={d.transport || d.transportVehicleType || null}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Filmstrip of the trip's route stops with real destination photos, resolved
 * automatically by name from the catalog (see stopImages on PreviewData) —
 * falls back to the package cover photo, then any day's hotel photo, then a
 * plain brand-gradient tile, so the row never looks broken even when a stop
 * name has no catalog match. */
/** A photo that actually belongs to this stop — an activity photo from one
 * of its days first (what the client asked to see: what they'll be doing
 * there), then that stop's own hotel photo — before any package-wide
 * fallback, so a stop without a catalog match still shows something from
 * its own itinerary instead of a random unrelated day. */
export function firstDayPhotoForStop(itineraries: DayItinerary[], dayNumbers: Set<number>): string | null {
  const daysInStop = itineraries.filter((d) => dayNumbers.has(d.day));
  for (const day of daysInStop) {
    for (const activity of day.activities) {
      const photo = activity.photos[0] || activity.photo;
      if (photo) return photo;
    }
  }
  for (const day of daysInStop) {
    if (day.accommodationPhoto) return day.accommodationPhoto;
  }
  return null;
}

/** One destination tile: its photo, its name and how many nights are spent
 * there. The name is editable on the tile; nights are not — see the `stop`
 * case in EditableField. */
function StopTile({ stop, img, onImageChange, stopIndex }: {
  stop: StopInput;
  img: string | null;
  onImageChange?: OnImageChange;
  stopIndex: number;
}) {
  const builder = useOptionalBuilder();
  const [failed, setFailed] = useState(false);
  // Same reset-on-change need as SafeImg: once a broken (e.g. AI-hallucinated)
  // URL fails once, `failed` must not stay stuck true after the user edits
  // this tile's photo to a new, working one.
  const [lastImg, setLastImg] = useState(img);
  if (img !== lastImg) {
    setLastImg(img);
    setFailed(false);
  }
  const showPhoto = img && !failed;

  return (
    <div className="group/img relative flex-1 min-w-0">
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary external/catalog/AI-sourced URL, not a static app asset
        <img src={img} alt={stop.name} className="w-full h-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <div className="w-full h-full bg-linear-to-br from-primary-500 to-primary-700 flex items-center justify-center">
          <MapPin size={22} className="text-white/70" />
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/30 to-transparent px-2.5 py-2 pt-8">
        <EditableText
          as="p"
          value={stop.name}
          field={{ scope: "stop", index: stopIndex, key: "name" }}
          fallback="—"
          displayTransform={titleCase}
          placeholder="Where to?"
          className="block text-white text-base font-bold font-heading leading-tight"
        />
        <p className="text-white/75 text-[11px] font-medium">
          {stop.nights} Night{stop.nights !== 1 ? "s" : ""}
        </p>
      </div>
      {onImageChange && (
        <ImageEditButton
          value={img ?? ""}
          onChange={(url) => onImageChange({ kind: "stop", stopIndex }, url)}
          dialogTitle={`${stop.name ? titleCase(stop.name) : "Stop"} Photo`}
          className="top-1.5 right-1.5 size-6"
        />
      )}
      {/* Removing a destination also removes its nights, which shortens the
          trip — so this goes through the same recalcFromStops every other stop
          edit does rather than just splicing the array. */}
      {builder?.canEdit && (
        <IconTip label={`Remove ${stop.name ? titleCase(stop.name) : "this destination"}`}>
          <button
            type="button"
            onClick={() => builder.setForm((f) => {
              const stops = f.stops.filter((_, i) => i !== stopIndex);
              return { ...f, stops, ...recalcFromStops(stops) };
            })}
            aria-label="Remove this destination"
            className="builder-only no-print absolute top-1.5 left-1.5 z-20 flex items-center justify-center size-6 rounded-md bg-black/45 text-white/80 opacity-0 transition-opacity group-hover/img:opacity-100 focus-visible:opacity-100 hover:bg-red-600 hover:text-white"
          >
            <Trash2 size={12} />
          </button>
        </IconTip>
      )}
    </div>
  );
}

/** The destinations strip — one photo tile per stop, with its name and nights.
 *
 * Restored after being cut: it's the document's only visual answer to "where
 * does this trip actually go", and the Day-wise table and route map are both
 * text. It's also what the Destination entry in the package add menu creates,
 * which is why an unnamed stop still renders a tile in the builder — otherwise
 * "add a destination" produces nothing to see or type into.
 */
function PlacesToVisit({ form, onImageChange }: { form: PreviewData; onImageChange?: OnImageChange }) {
  const builder = useOptionalBuilder();
  const canEditDoc = !!builder?.canEdit;

  const limit = builder
    ? stopLimitReason(builder.form.stops.length, builder.form.itineraries.length)
    : null;

  const actions: SectionAction[] | undefined = canEditDoc ? [
    {
      icon: Plus,
      // The cap is read at click time, not baked in when this rendered — days
      // come and go all session.
      label: limit ?? "Add a destination",
      onClick: () => {
        if (limit) { toast.error(limit); return; }
        const index = builder!.form.stops.length;
        builder!.setForm((f) => ({ ...f, stops: [...f.stops, { name: "", nights: 1, image: "" }] }));
        builder!.openDrawer({ kind: "stops-edit" });
        revealField({ scope: "stop", index, key: "name" });
      },
    },
    {
      icon: Pencil, label: "Edit destinations and nights",
      onClick: () => builder!.openDrawer({ kind: "stops-edit" }),
    },
    {
      icon: Trash2, label: "Remove all destinations", tone: "danger",
      onClick: () => builder!.setForm((f) => ({ ...f, stops: [], ...recalcFromStops([]) })),
    },
  ] : undefined;

  if (form.stops.length === 0) return null;

  const dayLocations = deriveDayLocations(form.stops, form.itineraries.length);
  const packageFallback = form.coverImage
    || form.itineraries.find((d) => d.accommodationPhoto)?.accommodationPhoto
    || null;

  return (
    <EditableSection actions={actions}>
      <div className="space-y-3" style={{ breakInside: "avoid" }}>
        <SectionHeader icon={Compass} label="Places You Gonna Visit" />
        <div className="flex gap-[3px] rounded-2xl overflow-hidden" style={{ height: "40mm" }}>
          {form.stops.map((s, i) => {
            const dayNumbers = new Set(
              dayLocations
                .map((loc, idx) => (loc === s.name ? idx + 1 : null))
                .filter((d): d is number => d != null),
            );
            // A manual override (set via the edit button) always wins over the
            // auto-resolved catalog/fallback chain.
            const img = s.image
              || form.stopImages?.[s.name.trim()]
              || firstDayPhotoForStop(form.itineraries, dayNumbers)
              || packageFallback
              || null;
            return <StopTile key={i} stop={s} img={img} onImageChange={onImageChange} stopIndex={i} />;
          })}
        </div>
      </div>
    </EditableSection>
  );
}

/** A ticket stays a real bordered card, unlike the day's Stay/Transport/
 * Experiences sections (see DaySubHead), which shed theirs. The distinction is
 * deliberate: those are facets of one day and belong to the day card holding
 * them, whereas a ticket is a discrete object — one leg, one carrier, one
 * date — that the client reads and matches against a real boarding pass. It
 * also sits at the top level of the document rather than nested inside another
 * card, so it isn't creating the double frame the day sections were.
 * Fare is deliberately never shown here — it's priced into the package total
 * but not itemized per-leg on the client-facing document. */
const TICKET_TYPE_ICONS: Record<TicketInput["type"], React.ElementType> = {
  FLIGHT: Plane, TRAIN: TrainFront, HELICOPTER: Helicopter,
  BUS: Bus, OTHER: Ticket,
};
const TICKET_PROVIDER_FALLBACKS: Record<TicketInput["type"], string> = {
  FLIGHT: "Airline TBD", TRAIN: "Train TBD", HELICOPTER: "Operator TBD",
  // An OTHER leg is a ferry or a cable car as often as it's an operator-run
  // service, so it asks for details rather than naming an operator.
  BUS: "Operator TBD", OTHER: "Details TBD",
};

const TICKET_TYPE_LABEL: Record<TicketInput["type"], string> = {
  FLIGHT: "Flight", TRAIN: "Train", HELICOPTER: "Helicopter",
  BUS: "Bus", OTHER: "Other",
};

function TicketCard({ ticket, index, packagePax }: {
  ticket: TicketInput;
  /** Position in form.tickets — NOT in the per-type group this is rendered
   * inside. Every inline edit addresses the array by it. */
  index: number;
  packagePax?: PackagePax;
}) {
  const builder = useOptionalBuilder();
  const Icon = TICKET_TYPE_ICONS[ticket.type];
  const canEditDoc = !!builder?.canEdit;

  const actions: SectionAction[] | undefined = canEditDoc ? [
    {
      icon: Pencil, label: `Edit this ${TICKET_TYPE_LABEL[ticket.type].toLowerCase()} leg`,
      onClick: () => builder!.openDrawer({ kind: "tickets-edit", type: ticket.type }),
    },
    {
      icon: Trash2, label: "Remove this leg", tone: "danger",
      onClick: () => builder!.setForm((f) => ({
        ...f, tickets: f.tickets.filter((_, i) => i !== index),
      })),
    },
  ] : undefined;
  // A leg with no pax of its own carries the whole party — which is nearly
  // every leg — so it shows the package's travellers rather than nothing at
  // all. Zeroes are the "not specified" sentinel emptyTicket already writes,
  // so this needs no migration and reads correctly for existing tickets.
  const pax = (ticket.adults || ticket.children || ticket.infants)
    ? { adults: ticket.adults, children: ticket.children, infants: ticket.infants }
    : packagePax;
  const paxLine = pax ? [
    pax.adults ? `${pax.adults} Adult${pax.adults !== 1 ? "s" : ""}` : null,
    pax.children ? `${pax.children} Child${pax.children !== 1 ? "ren" : ""}` : null,
    pax.infants ? `${pax.infants} Infant${pax.infants !== 1 ? "s" : ""}` : null,
  ].filter(Boolean).join(", ") : "";
  const ticketsLabel = ticket.ticketCount > 0 ? `${ticket.ticketCount} Ticket${ticket.ticketCount !== 1 ? "s" : ""}` : null;
  const footerLine = [paxLine, ticketsLabel].filter(Boolean).join(" · ");

  const f = (key: TicketTextKey) => ({ scope: "ticket" as const, index, key });

  return (
    <EditableSection actions={actions}>
      <div className="rounded-lg border border-neutral-200 overflow-hidden shadow-lg shadow-neutral-200/80 " style={{ breakInside: "avoid" }}>
        {/* Header — carrier + travel date */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-white bg-linear-to-b from-white via-neutral-50 to-neutral-200/70 border-b border-neutral-200/80">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex items-center justify-center size-5 rounded-lg bg-primary-50 p-1 ring-1 ring-inset ring-primary-200/80 shadow-sm shadow-primary-200/80 shrink-0">
              <Icon size={16} className="text-primary-500" />
            </span>
            <p className="text-xs font-semibold text-neutral-800 truncate flex items-center gap-1">
              <EditableText
                value={ticket.provider}
                field={f("provider")}
                fallback={TICKET_PROVIDER_FALLBACKS[ticket.type]}
                placeholder={TICKET_PROVIDER_FALLBACKS[ticket.type]}
              />
              {/* Separator and field stand or fall together. EditableText
                renders nothing for an empty value outside the builder, so a
                bare "·" would be left hanging on the client's copy and in the
                PDF; inside the builder the empty slot is the point. */}
              <GapBadge gaps={ticketGaps(ticket)} />
              {(ticket.ticketNumber || canEditDoc) && (
                <span className="font-normal text-neutral-500 flex items-center gap-1">
                  <span aria-hidden>·</span>
                  <EditableText
                    value={ticket.ticketNumber ?? ""}
                    field={f("ticketNumber")}
                    placeholder="PNR / ticket no."
                  />
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Dates and times stay drawer-only — see TicketTextKey. */}
            {ticket.travelDate && (
              <span className="text-[10px] font-semibold text-neutral-800">{formatTicketDate(ticket.travelDate)}</span>
            )}
          </div>
        </div>

        {/* Route */}
        <div className="p-3 space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <EditableText
                as="p"
                value={ticket.fromPlace}
                field={f("fromPlace")}
                fallback="—"
                placeholder="From"
                className="block text-sm font-bold text-neutral-800"
              />
              {ticket.departureTime && <p className="text-[11px] text-neutral-500/90">{formatTime12h(ticket.departureTime)}</p>}
            </div>
            <div className="flex flex-col items-center gap-1 shrink-0 px-1">
              <Icon size={14} className="text-neutral-400" />
              <div className="w-12 border-t border-dotted border-neutral-300" />
              <EditableText
                value={ticket.durationText ?? ""}
                field={f("durationText")}
                placeholder="2h 10m"
                className="text-[9px] text-neutral-400 font-medium whitespace-nowrap"
              />
            </div>
            <div className="flex-1 min-w-0 text-right">
              <EditableText
                as="p"
                value={ticket.toPlace}
                field={f("toPlace")}
                fallback="—"
                placeholder="To"
                className="block text-sm font-bold text-neutral-800"
              />
              {ticket.arrivalTime && <p className="text-[11px] text-neutral-500/90">{formatTime12h(ticket.arrivalTime)}</p>}
            </div>
          </div>

          {footerLine && (
            <p className="text-[11px] text-neutral-500/90 flex items-center gap-1 pt-1.5 border-t border-neutral-200/80">
              <Users size={12} className="text-neutral-400/90 shrink-0" /> {footerLine}
            </p>
          )}

          <EditableText
            as="p"
            multiline
            value={ticket.notes ?? ""}
            field={f("notes")}
            placeholder="Add a note about this leg…"
            className="block text-[11px] text-neutral-800 italic"
          />
        </div>
      </div>
    </EditableSection>
  );
}

/** Flight and train legs get their own labeled sections (never merged) so a
 * trip with both reads as two distinct groups, not one mixed list. */
/** Travellers on the package as a whole — the fallback for a leg that doesn't
 * name its own. Passed rather than read from context because this section also
 * renders on the public client-facing page, where there is no builder. */
export type PackagePax = { adults: number; children: number; infants: number };

export function TicketsSection({ tickets, packagePax }: {
  tickets: TicketInput[];
  packagePax?: PackagePax;
}) {
  // Grouped for display but carrying each ticket's position in the original
  // array, because that's what an inline edit has to address — the third
  // train is not form.tickets[2].
  const groups: { type: TicketInput["type"]; icon: React.ElementType; label: string }[] = [
    { type: "FLIGHT", icon: Plane, label: "Flight Details" },
    { type: "TRAIN", icon: TrainFront, label: "Train Details" },
    { type: "HELICOPTER", icon: Helicopter, label: "Helicopter Details" },
    { type: "BUS", icon: Bus, label: "Bus Details" },
    { type: "OTHER", icon: Ticket, label: "Other Transport" },
  ];
  const indexed = tickets.map((t, index) => ({ t, index }));
  if (indexed.length === 0) return null;

  return (
    <>
      {groups.map(({ type, icon, label }) => {
        const rows = indexed.filter(({ t }) => t.type === type);
        if (rows.length === 0) return null;
        return (
          <div key={type} className="space-y-3" style={{ breakInside: "avoid" }}>
            <SectionHeader icon={icon} label={label} />
            <div className="grid gap-3">
              {rows.map(({ t, index }) => (
                <TicketCard key={t.id ?? index} ticket={t} index={index} packagePax={packagePax} />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

/** One add-on tile, shown as what's-included only — never the per-unit price
 * (same convention as TicketCard hiding fare), since the cost is already
 * folded into the package total the client sees on the Price Summary card. */
function AddonCard({ addon, index }: {
  addon: AddonInput;
  /** Position in form.addOns. Both callers render a filtered slice of it —
   * package-level (day == null) here, per-day below — so the position on
   * screen is never the position in the array. */
  index: number;
}) {
  const builder = useOptionalBuilder();
  const canEditDoc = !!builder?.canEdit;

  const actions: SectionAction[] | undefined = canEditDoc ? [
    {
      icon: Pencil, label: "Edit this add-on",
      onClick: () => builder!.openDrawer({ kind: "addons-edit", day: addon.day ?? null }),
    },
    {
      icon: Trash2, label: "Remove this add-on", tone: "danger",
      onClick: () => builder!.setForm((f) => ({
        ...f, addOns: f.addOns.filter((_, i) => i !== index),
      })),
    },
  ] : undefined;

  const DOC = useDocTheme();
  const f = (key: AddonTextKey) => ({ scope: "addon" as const, index, key });

  return (
    <EditableSection actions={actions}>
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: DOC.rule, backgroundColor: DOC.card }}>
        <div
          className="flex items-center gap-2 px-3 py-2  bg-white bg-linear-to-b from-white via-neutral-50 to-neutral-200/60 border-b border-neutral-200/80"
        >
          <span
            className="flex items-center justify-center size-5 rounded-lg bg-primary-50 p-1 ring-1 ring-inset ring-primary-200/80 shadow-sm shadow-primary-200/80 shrink-0"
          >
            {/* Colour prop, not a text-* class: an inline SVG's stroke is exactly
              what html2canvas-pro fails to resolve from an oklch token. */}
            <Gift size={11} color={DOC.accent} />
          </span>
          <p className="text-xs font-semibold text-neutral-800 truncate flex-1">
            <EditableText value={addon.name} field={f("name")} placeholder="Add-on name" />
            {/* Quantity is numeric and priced against, so it stays in the drawer
              — see AddonTextKey. */}
            {addon.quantity > 1 ? ` × ${addon.quantity}` : ""}
            {" "}
            <GapBadge gaps={addonGaps(addon)} />
          </p>
        </div>
        <EditableText
          as="p"
          multiline
          value={addon.notes ?? ""}
          field={f("notes")}
          placeholder="What this includes…"
          className="block p-3 text-[11px] text-neutral-500 leading-relaxed"
        />
      </div>
    </EditableSection>
  );
}

/** General add-ons (day: null) — added from the Package Details tab rather
 * than a specific day's hotel, so they aren't tied to any one Day card and
 * are shown here instead, up top with Flight/Train details. */
export function AddonsSection({ addOns }: { addOns?: AddonInput[] }) {
  const canEditDoc = !!useOptionalBuilder()?.canEdit;
  // An add-on with no name yet is one being written. It has to render in the
  // builder or "Add an add-on" creates something invisible — there'd be
  // nothing to scroll to and nothing to type into. The client still only sees
  // named ones.
  const items = (addOns ?? [])
    .map((a, index) => ({ a, index }))
    .filter(({ a }) => a.day == null && (a.name.trim() || canEditDoc));
  if (items.length === 0) return null;

  return (
    <div className="space-y-3" style={{ breakInside: "avoid" }}>
      <SectionHeader icon={Gift} label="Add-ons Included" />
      <div className="grid grid-cols-2 gap-3">
        {items.map(({ a, index }) => <AddonCard key={index} addon={a} index={index} />)}
      </div>
    </div>
  );
}

/** The shared look for a full-width "add something" control in the document.
 * Both users of it are builder-only and sit in the document's own flow, so
 * they read as part of the page rather than as toolbar chrome bolted on. */
/** Appends a day to the end of the itinerary.
 *
 * The per-day menu can already insert after any given day, but appending is
 * the common case by far and having to open day N's menu to get day N+1 reads
 * backwards — the action belongs at the end of the list, where the new day
 * will actually appear. */
function AddDayButton() {
  const DOC = useDocTheme();
  const builder = useOptionalBuilder();
  if (!builder?.canEdit) return null;
  const lastDay = builder.form.itineraries.length;

  return (
    <button
      type="button"
      onClick={() => builder.addDayAfter(lastDay)}
      className={ADD_CONTROL_CLASS}
      style={{ borderColor: DOC.rule, color: DOC.accent }}
    >
      <CalendarPlus size={12} /> Add day {lastDay + 1}
    </button>
  );
}

/** One control for everything the package as a whole can gain: a flight, a
 * train, a helicopter leg, or an add-on.
 *
 * Replaces four separate per-section buttons. Those only appeared next to
 * sections that already existed, so with an empty package there was nothing to
 * click until a section was conjured into being just to host its own button —
 * and the buttons themselves drifted around the page as sections came and
 * went. One full-width control sits in a fixed place whether the package has
 * nothing in it or everything.
 *
 * The tickets drawer handles all three leg types, so the first three options
 * differ only in which type they pre-create. */
function PackageAddMenu() {
  const DOC = useDocTheme();
  const builder = useOptionalBuilder();
  if (!builder?.canEdit) return null;

  // Clicking "Flight" means "this package has a flight", so it creates one.
  // Before, it opened a drawer that then asked you to press Add — two
  // decisions for one intention, and nothing appeared in the document until
  // the second. Now the leg lands in the document with its placeholders
  // showing, the drawer opens on it for the structured fields, and the caret
  // is already in the carrier name.
  function addTicket(type: TicketInput["type"]) {
    const index = builder!.form.tickets.length;
    builder!.setForm((f) => ({ ...f, tickets: [...f.tickets, emptyTicket(type)] }));
    builder!.openDrawer({ kind: "tickets-edit", type });
    revealField({ scope: "ticket", index, key: "provider" });
  }

  function addAddon() {
    const index = builder!.form.addOns.length;
    builder!.setForm((f) => ({ ...f, addOns: [...f.addOns, emptyAddon(null)] }));
    builder!.openDrawer({ kind: "addons-edit", day: null });
    revealField({ scope: "addon", index, key: "name" });
  }

  // Adds a tile to the destinations strip. `nights: 1` rather than 0 because a
  // zero-night stop contributes nothing to deriveDayLocations and would sit in
  // the strip while affecting no day.
  function addStop() {
    const limit = stopLimitReason(builder!.form.stops.length, builder!.form.itineraries.length);
    if (limit) { toast.error(limit); return; }
    const index = builder!.form.stops.length;
    builder!.setForm((f) => ({ ...f, stops: [...f.stops, { name: "", nights: 1, image: "" }] }));
    builder!.openDrawer({ kind: "stops-edit" });
    revealField({ scope: "stop", index, key: "name" });
  }

  const items: { icon: React.ElementType; label: string; onSelect: () => void }[] = [
    { icon: Plane, label: "Flight", onSelect: () => addTicket("FLIGHT") },
    { icon: TrainFront, label: "Train", onSelect: () => addTicket("TRAIN") },
    { icon: Helicopter, label: "Helicopter", onSelect: () => addTicket("HELICOPTER") },
    { icon: Bus, label: "Bus", onSelect: () => addTicket("BUS") },
    { icon: Ticket, label: "Other transport", onSelect: () => addTicket("OTHER") },
    { icon: Gift, label: "Add-on", onSelect: addAddon },
    { icon: Compass, label: "Destination", onSelect: addStop },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={ADD_CONTROL_CLASS}
          style={{ borderColor: DOC.rule, color: DOC.accent }}
        >
          <Plus size={12} /> Add a destination, flight, train, helicopter or add-on
          <ChevronDown size={11} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-56">
        <DropdownMenuLabel className="text-[11px]">Add to this package</DropdownMenuLabel>
        {items.map(({ icon: Icon, label, onSelect }) => (
          <DropdownMenuItem key={label} onSelect={onSelect}>
            <Icon size={13} /> {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Add-ons tied to one specific day — rendered inline under that day's Hotel
 * section (see DayCardPreview) rather than in the general AddonsSection. */
function DayAddonsSection({ addOns, day }: { addOns: AddonInput[]; day: number }) {
  const DOC = useDocTheme();
  const canEditDoc = !!useOptionalBuilder()?.canEdit;
  const items = addOns
    .map((a, index) => ({ a, index }))
    .filter(({ a }) => a.day === day && (a.name.trim() || canEditDoc));
  if (items.length === 0) return null;

  return (
    <div className="space-y-2" style={{ breakInside: "avoid" }}>
      <div className="flex items-center gap-2 px-1">
        <Gift size={11} color={DOC.accent} className="shrink-0" />
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: DOC.accent }}>Add-ons Included</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map(({ a, index }) => <AddonCard key={index} addon={a} index={index} />)}
      </div>
    </div>
  );
}

/** The stay options for one block of nights, side by side.
 *
 * This is the shape the client reads: one check-in, one check-out, N nights,
 * and every category's hotel in its own column with the recommended one
 * badged. All of it in the SAME document — there is no per-category page and
 * no per-category PDF, so this table is where the whole difference between
 * Standard, Deluxe and Premium is expressed.
 *
 * Rendered only when a package is quoted at more than one category. A package
 * with one stay standard keeps the original single-hotel layout below,
 * untouched — which is every package built before categories existed.
 */

/** Picks the hotel for one column — one standard, one block of nights.
 *
 * Uses the same catalog search the day's own stay uses, and the same field
 * mapping (applyHotelRoomSelection against a blank day), so a Deluxe column and
 * a recommended stay picked from the same room end up describing it identically
 * — right down to the occupancy caps the price is computed from.
 *
 * Writes straight through to the category rather than into form state: only the
 * recommended standard lives on the day row, so there is nowhere in `form` for
 * a Deluxe hotel to sit. Applied to every night of the block, because that is
 * what a stay is — one hotel, N nights.
 */
function StayColumnPicker({
  packageId, optionId, fromDay, nights, currentLabel, searchCity, travelDate, onSaved,
}: {
  packageId: string;
  optionId: string;
  fromDay: number;
  nights: number;
  currentLabel: string | null;
  searchCity: string;
  /** The trip's start date — with fromDay it gives the night this column is
   * booking, which is what keeps out-of-season rooms out of the results. */
  travelDate?: string | null;
  onSaved: () => void | Promise<void>;
}) {
  const [saving, setSaving] = useState(false);

  return (
    <div className="builder-only no-print px-2.5 pb-2">
      <HotelRoomPicker
        value={null}
        initialLabel={currentLabel ?? ""}
        searchCity={searchCity}
        refCoords={null}
        placeholder={currentLabel ? "Change hotel…" : "Pick this standard's hotel…"}
        travelDate={nightISOForDay(travelDate, fromDay)}
        onSelect={async (room) => {
          setSaving(true);
          // Through the same mapping the day's own stay uses, so the two can't
          // describe the same room differently.
          const mapped = applyHotelRoomSelection(emptyDay(fromDay), room);
          const fields = {
            accommodation: mapped.accommodation,
            accommodationPhoto: mapped.accommodationPhoto,
            accommodationRoomPhotos: mapped.accommodationRoomPhotos,
            accommodationLocation: mapped.accommodationLocation,
            accommodationRoomSpecs: mapped.accommodationRoomSpecs,
            accommodationStarRating: mapped.accommodationStarRating,
            accommodationRoomCapacity: mapped.accommodationRoomCapacity,
            accommodationMaxAdults: mapped.accommodationMaxAdults,
            accommodationMaxChildren: mapped.accommodationMaxChildren,
            accommodationExtraBedCapacity: mapped.accommodationExtraBedCapacity,
            roomPricingId: mapped.roomPricingId,
            roomsCount: mapped.roomsCount,
            hotelCheckIn: mapped.hotelCheckIn,
            hotelCheckOut: mapped.hotelCheckOut,
            hotelMealPlan: mapped.hotelMealPlan,
            manualHotelPricePerNight: null,
            manualExtraBeds: null,
            manualExtraBedRate: null,
          };
          // Every night of the block in one call, so the column names one
          // hotel for the whole stay and the run lands atomically rather than
          // one night at a time.
          const blockDays = Array.from({ length: nights }, (_, i) => fromDay + i);
          const r = await saveStayForDay(packageId, optionId, blockDays, fields);
          if (!r.success) toast.error(r.error);
          setSaving(false);
          await onSaved();
        }}
        onClear={async () => {
          setSaving(true);
          await saveStayForDay(packageId, optionId, Array.from({ length: nights }, (_, i) => fromDay + i), {
            accommodation: null, accommodationPhoto: null, accommodationRoomPhotos: [],
            accommodationLocation: null, accommodationRoomSpecs: null, accommodationStarRating: null,
            roomPricingId: null, roomsCount: null, hotelMealPlan: null,
            manualHotelPricePerNight: null,
          });
          setSaving(false);
          await onSaved();
        }}
      />
      {saving && (
        <p className="flex items-center gap-1 pt-1 text-[10px] text-dashboard-base-content/50">
          <Loader2 size={9} className="animate-spin" /> Saving all {nights} night{nights !== 1 ? "s" : ""}…
        </p>
      )}
    </div>
  );
}

function StayColumns({
  categories, day, nights, checkIn, checkOut, packageId, searchCity, travelDate, onStayOptionsChanged,
}: {
  /** Present only in the builder — that is what turns the columns editable.
   * Absent on the client's page and in the PDF, which stay read-only. */
  packageId?: string;
  searchCity?: string;
  /** Trip start date, passed down so each column's picker can ask the catalog
   * for rooms priced for the night it is actually booking. */
  travelDate?: string | null;
  onStayOptionsChanged?: () => void | Promise<void>;
  /** Cheapest first, already sorted by the caller. */
  categories: NonNullable<PreviewData["stayOptions"]>;
  /** The night this block starts on — which cell of each category to show. */
  day: number;
  nights: number;
  checkIn: string;
  checkOut: string;
}) {
  const DOC = useDocTheme();
  // Optional: the document also renders outside the builder (the client's page
  // and the PDF), where there is no context and no editing.
  const builderCtx = useOptionalBuilder();
  const editing = !!packageId && !!onStayOptionsChanged;
  // In the builder EVERY standard gets a column, even one with no hotel yet —
  // an empty column is how the exec sees the gap and where they fill it, and
  // filtering it out made a newly added standard invisible and therefore
  // unfillable.
  //
  // The client's copy still only shows the standards that have a hotel: an
  // empty column on a quote is not an option, it is an unfinished sentence.
  const shown = editing ? categories : categories.filter((c) => c.byDay?.[day]?.hotel?.trim());
  if (shown.length === 0) return null;

  return (
    <div className="space-y-2.5" style={{ breakInside: "avoid" }}>
      {/* Check-in / nights / check-out, once for the whole block. */}
      <div
        className="flex items-center justify-between gap-3 rounded-lg px-3 py-2"
        style={{ backgroundColor: DOC.card, border: `1px solid ${DOC.rule}` }}
      >
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: DOC.inkMuted }}>Check In</p>
          <p className="text-[11.5px] font-semibold" style={{ color: DOC.ink }}>{checkIn || "—"}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="h-px w-8" style={{ backgroundColor: DOC.rule }} />
          <span className="text-[11px] font-bold whitespace-nowrap" style={{ color: DOC.ink }}>
            {nights}N
          </span>
          <MoonStar size={11} color={DOC.accent} />
          <span className="h-px w-8" style={{ backgroundColor: DOC.rule }} />
        </div>
        <div className="min-w-0 text-right">
          <p className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: DOC.inkMuted }}>Check Out</p>
          <p className="text-[11.5px] font-semibold" style={{ color: DOC.ink }}>{checkOut || "—"}</p>
        </div>
      </div>

      {/* Evenly split, so one category reads as a full-width stay and three
          share the page. Four would leave each photo too narrow to show
          anything, which is why the category list is capped at three. */}
      <div className={cn("grid gap-2.5", shown.length === 1 ? "grid-cols-1" : shown.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
        {shown.map((c) => {
          const cell = c.byDay?.[day] ?? { hotel: null };
          const { manualHotelName: hotelName, manualRoomName: roomName } = splitManualHotelName(cell.hotel ?? "");
          return (
            <div
              key={c.id}
              // group/stay + relative: the edit controls float over the card and
              // appear on hover, the same way a section's own actions do. In the
              // flow they read as part of the stay the client is being offered,
              // which is exactly what they are not.
              className="group/stay relative rounded-lg overflow-hidden flex flex-col"
              style={{
                border: `1px solid ${c.isRecommended ? DOC.accent : DOC.rule}`,
                backgroundColor: DOC.card,
              }}
            >
              <div className="relative">
                {cell.photo ? (
                  /* eslint-disable-next-line @next/next/no-img-element -- arbitrary catalog URL, not a static app asset */
                  <img src={cell.photo} alt={hotelName ?? ""} className="w-full aspect-video object-cover" />
                ) : (
                  <div className="w-full aspect-video flex items-center justify-center" style={{ backgroundColor: DOC.paper }}>
                    <Hotel size={16} style={{ color: DOC.inkMuted }} />
                  </div>
                )}

                {/* The badge the client is steered by. On the photo rather than
                    under it so it reads before the hotel's name does. */}
                {c.isRecommended && (
                  <span
                    className="absolute top-1.5 left-1.5 rounded-full px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-wide text-white"
                    style={{ backgroundColor: DOC.accent }}
                  >
                    Recommended
                  </span>
                )}

              </div>

              <div className="px-2.5 py-2 space-y-0.5 flex-1">
                <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: c.isRecommended ? DOC.accentInk : DOC.inkMuted }}>
                  {c.label}
                </p>
                <p
                  className="text-[11.5px] font-semibold leading-tight flex items-start gap-1"
                  style={{ color: cell.hotel ? DOC.ink : DOC.inkMuted }}
                >
                  <span className="min-w-0">{cell.hotel ? titleCase(hotelName ?? cell.hotel) : "No hotel picked yet"}</span>
                  {/* The class beside the name, where it is read with the
                      hotel rather than as a mark on the photo — the column
                      heading is the exec's own label ("Beachfront"), which
                      says nothing about the property's rating. */}
                  {cell.hotel && cell.starRating ? <StayStars raw={cell.starRating} /> : null}
                </p>
                {roomName && (
                  <p className="text-[10px] leading-tight" style={{ color: DOC.inkSoft }}>{roomName}</p>
                )}
                {cell.location && (
                  <p className="text-[10px] leading-tight" style={{ color: DOC.inkMuted }}>{cell.location}</p>
                )}
                {/* The board is a property of the hotel, not of the day, so it
                    belongs in the column — a Premium stay can include dinner
                    where the Standard one does not. The day's own MEALS
                    section still covers what the trip includes. */}
                {cell.mealPlan && (
                  <p className="flex items-center gap-1 text-[10px] leading-tight pt-0.5" style={{ color: DOC.positive }}>
                    <Utensils size={9} /> {cell.mealPlan}
                  </p>
                )}
              </div>

              {packageId && onStayOptionsChanged && (
                <>
                  {/* Floating, not in the flow — see the card's group/stay
                      above. Mirrors EditableSection's own action cluster: same
                      corner, same reveal, same shape, so an exec learns one
                      gesture for "act on this thing" rather than one per
                      surface. */}
                  <div
                    className={cn(
                      "builder-only no-print absolute top-1.5 right-1.5 z-20 flex items-center gap-0.5",
                      "rounded-lg ring-1 ring-inset ring-neutral-200 bg-white p-0.5 shadow-xl shadow-neutral-200/80",
                      "opacity-0 pointer-events-none transition-opacity duration-[120ms]",
                      "group-hover/stay:opacity-100 group-hover/stay:pointer-events-auto",
                      "focus-within:opacity-100 focus-within:pointer-events-auto",
                    )}
                  >
                    <button
                      type="button"
                      aria-label={`Change the ${c.label} hotel`}
                      title={`Change the ${c.label} hotel for ${nights === 1 ? "this night" : `these ${nights} nights`}`}
                      onClick={() => builderCtx?.openDrawer({ kind: "stay-options", day })}
                      className="flex items-center justify-center size-6 rounded-md text-dashboard-base-content/40 hover:bg-dashboard-base-200 hover:text-dashboard-base-content/75 transition-colors duration-[120ms]"
                    >
                      <Pencil size={13} />
                    </button>
                    {categories.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Remove the ${c.label} stay option`}
                      title={`Remove "${c.label}" from this package entirely — the other stays stay`}
                      onClick={async () => {
                        // Removes the OPTION, not just the hotel on it.
                        //
                        // Clearing the fields left the column standing — an
                        // empty card with a picker in it — which is not what
                        // "delete this stay" means to anyone looking at it, and
                        // the remaining stay stayed squeezed into half the row.
                        // Dropping the option is what makes the row reflow to
                        // full width, because the grid sizes off how many there
                        // are.
                        //
                        // Emptying a column without removing it is still
                        // available: that is what the picker's own clear does.
                        const r = await removeStayOption(packageId!, c.id);
                        if (!r.success) { toast.error(r.error); return; }
                        await onStayOptionsChanged?.();
                      }}
                      className="flex items-center justify-center size-6 rounded-md text-dashboard-error/60 hover:bg-dashboard-error/10 hover:text-dashboard-error transition-colors duration-[120ms]"
                    >
                      <Trash2 size={13} />
                    </button>
                    )}
                  </div>

                  {/* Only where there is nothing yet: choosing a first hotel is
                      the column's whole job then. A filled column is changed
                      through Edit above. */}
                  {!cell.hotel && (
                    <StayColumnPicker
                      packageId={packageId}
                      optionId={c.id}
                      fromDay={day}
                      nights={nights}
                      currentLabel={cell.hotel}
                      searchCity={searchCity ?? ""}
                      travelDate={travelDate}
                      onSaved={onStayOptionsChanged}
                    />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}

function DayCardPreview({
  day, allDays, adults, childCount, travelDate, onImageChange, onActivityCaptionChange, shiftedMeals, addOns,
  stayOptions, stayRun: stayBlock, stayContinues, stayContinuesFrom, stayContinuesNights, stayEditing,
}: {
  day: DayItinerary;
  /** The stay standards this package is quoted at. Two or more and this day's
   * stay renders as columns (see StayColumns); one or none and the original
   * single-hotel layout runs, unchanged. */
  stayOptions?: PreviewData["stayOptions"];
  /** Present only in the builder — turns the stay columns editable. */
  stayEditing?: { packageId: string; onStayOptionsChanged: () => void | Promise<void> };
  /** The stay block that STARTS on this night, when one does — the whole run
   * of nights, with every category's hotel. Null on a night that continues a
   * block or has no stay. */
  stayRun?: StayRun | null;
  /** Night 2+ of a block, computed from the categories rather than the day
   * row — see the note where these are built. */
  stayContinues?: boolean;
  /** First day of the block this night belongs to, and how many nights it
   * runs — so the continues line can say where the stay started and how far
   * through it this is. */
  stayContinuesFrom?: number;
  stayContinuesNights?: number;
  /** Every day, so this one can tell whether it continues a multi-night stay
   * that began earlier — see continuesStayFrom. */
  allDays: DayItinerary[];
  adults: number;
  childCount: number;
  travelDate: string;
  onImageChange?: OnImageChange;
  onActivityCaptionChange?: (day: number, activityIndex: number, photoIndex: number, caption: string) => void;
  /** Breakfast-shifted meals for this day — see computeShiftedMeals. Falls
   * back to the raw day.meals if not supplied. */
  shiftedMeals?: string[];
  /** Full package add-ons list — filtered internally (DayAddonsSection) to
   * just this day's, shown right below the Hotel section. */
  addOns?: AddonInput[];
}) {
  const DOC = useDocTheme();
  // Null on the public client-facing page, which renders this same component
  // without a builder around it — that's what keeps every edit affordance
  // below out of the client's copy.
  const builder = useOptionalBuilder();
  // Keeps each activity's original index (for onImageChange targeting) even
  // though blank ones are filtered out of what's actually rendered.
  // Blank activities render in the builder for the same reason blank add-ons
  // and untyped notes do: "add an experience" has to produce something you can
  // see and type into. They stay hidden on the client's document and in the
  // PDF, so an abandoned blank costs nothing there.
  const activities = day.activities
    .map((a, originalIndex) => ({ a, originalIndex }))
    .filter(({ a }) => a.title.trim() || !!builder?.canEdit);
  const hasHotel = day.accommodation || day.hotelCheckIn || day.hotelCheckOut || day.hotelMealPlan;
  // Check-in lands on this day's own date; check-out is the following
  // morning — same "shifted" convention the meal algorithm uses, since a
  // day's hotel is the one you sleep in that night and leave the next day.
  const checkInDate = dayCalendarDate(travelDate, day.day);
  const checkOutDate = dayCalendarDate(travelDate, day.day + 1);
  const mealText = mealIncludedText(day.hotelMealPlan);
  // One photo per stay. The room-photo strip under it was removed — three
  // pictures of the same hotel is a gallery, and the itinerary is not one; the
  // room's own detail is already in the specs line. Room photos are still
  // stored (the catalog fills them in), just not printed here, so nothing is
  // lost if they are wanted back.
  const hasPhotos = !!day.accommodationPhoto || !!onImageChange;
  const canEditDoc = !!builder?.canEdit;
  // Per-section toolbars. Deletes don't confirm: undo covers them now (⌘Z),
  // and a modal on every clear would cost more than the mistake does.
  const stayActions: SectionAction[] | undefined = canEditDoc ? [
    {
      // The way in to quoting this night at more than one standard, and to
      // filling each one — from the catalog, by hand, or via the hotel team.
      // First in the list because "what are we offering for this night" comes
      // before "what are the details of this one hotel".
      icon: Hotel, label: "Stay options",
      onClick: () => builder!.openDrawer({ kind: "stay-options", day: day.day }),
    },
    {
      icon: Pencil, label: "Edit stay",
      onClick: () => builder!.openDrawer(day.hotelPending
        ? { kind: "hotel-request", day: day.day }
        : { kind: "hotel-edit", day: day.day }),
    },
    {
      icon: Repeat, label: "Replace hotel",
      onClick: () => builder!.openDrawer({ kind: "hotel-replace", day: day.day }),
    },
    {
      icon: Trash2, label: "Remove stay", tone: "danger",
      onClick: () => builder!.replaceDay(day.day, removeStay),
    },
  ] : undefined;

  const transportActions: SectionAction[] | undefined = canEditDoc ? [
    {
      icon: Pencil, label: "Edit transport",
      onClick: () => builder!.openDrawer({ kind: "transfer-edit", day: day.day }),
    },
    {
      icon: Trash2, label: "Remove transport", tone: "danger",
      onClick: () => builder!.replaceDay(day.day, removeTransport),
    },
  ] : undefined;

  const mealsActions: SectionAction[] | undefined = canEditDoc ? [
    {
      icon: Pencil, label: "Edit meals",
      onClick: () => builder!.openDrawer({ kind: "meals-edit", day: day.day }),
    },
  ] : undefined;

  /** Controls for one experience, as opposed to the list of them.
   *
   * Every row gets these, including the first. Before this only the first was
   * wrapped in an EditableSection — it's the one paired with the "Experiences"
   * heading — so a day with three experiences offered hover controls on one of
   * them and nothing on the other two. Reordering and deleting a single
   * experience had to go through the drawer.
   *
   * `index` is the position in day.activities, not in the filtered list: blank
   * activities are hidden from the document but still occupy an index, and
   * moving by the visible position would move the wrong one. */
  const activityActions = (index: number, visiblePos: number): SectionAction[] | undefined => {
    if (!canEditDoc) return undefined;
    // Neighbours in the VISIBLE list, so a move lands where the eye expects
    // even with a blank activity sitting between two real ones.
    const prev = activities[visiblePos - 1]?.originalIndex;
    const next = activities[visiblePos + 1]?.originalIndex;
    return [
      {
        icon: Pencil, label: "Edit this experience",
        onClick: () => builder!.openDrawer({ kind: "activities-edit", day: day.day }),
      },
      // Omitted at the ends rather than shown dead. A button that is present,
      // looks live and does nothing is worse than one that isn't there.
      ...(prev != null ? [{
        icon: ArrowUp, label: "Move up",
        onClick: () => builder!.replaceDay(day.day, (d) => moveActivityTo(d, index, prev)),
      }] : []),
      ...(next != null ? [{
        icon: ArrowDown, label: "Move down",
        onClick: () => builder!.replaceDay(day.day, (d) => moveActivityTo(d, index, next)),
      }] : []),
      {
        icon: Trash2, label: "Remove this experience", tone: "danger" as const,
        onClick: () => builder!.replaceDay(day.day, (d) => removeActivity(d, index)),
      },
    ];
  };

  // Night 2+ of a multi-night stay — see stayRun/continuesStayFrom. Null when
  // this day starts its stay, or has no catalog room at all.
  const continuesFrom = continuesStayFrom(allDays, day.day);
  // A catalog room owns its own name, location and specs; a hand-typed stay
  // owns nothing but what was typed. Editing the former in the document would
  // leave the day describing one hotel while priced against another.
  const fromCatalog = day.roomPricingId != null;
  const catalogLock = "From the hotel catalog — use Replace to pick a different room.";
  const extraRooms = (day.extraRooms ?? []).filter((r) => r.roomPricingId > 0);
  const extraCabs = (day.extraCabs ?? []).filter((c) => c.label.trim());

  return (
    <div
      // Scroll target for the sidebar's Itinerary section — see jumpToDay
      // in DayListPanel.
      id={`builder-day-${day.day}`}
      // group/day + relative host the floating day toolbar below. Named group:
      // a bare `group` would also be matched by every group-hover inside the
      // day, so hovering anywhere in a day would reveal that day's per-section
      // controls too.
      className="group/day relative rounded-xl overflow-hidden ring-1 ring-inset ring-neutral-200 shadow-xl shadow-neutral-200/80 bg-white "
    >
      {/* Day-level actions. Floating and hover-only rather than a permanent
          notch in the header row that the title had to lay out around on every
          day, including days nobody is working on. Sits INSIDE the card — the
          card is overflow-hidden for its rounded corners, so the -top-2.5
          straddle the per-section toolbars use would be clipped here. */}
      {builder?.canEdit && (
        <DayActionsMenu
          day={day.day}
          hasAddons={(addOns ?? []).some((a) => a.day === day.day)}
          hasNote={!!day.notes.trim()}
          hasStay={!!hasHotel}
          hasTransport={!!(day.transport || day.transportPickup || day.transportDrop)}
          hasActivities={activities.some(({ a }) => a.title.trim())}
          hasMeals={(shiftedMeals ?? day.meals).length > 0}
          isPending={!!day.hotelPending}
        />
      )}
      {/* Day header — an oversized numeral rather than a small filled badge.
          Paging through the document, those numerals become the rhythm: they
          are the one recurring element large enough to navigate by, which is
          what the old 9px uppercase "DAY 3" eyebrow could never be.

          Deliberately NOT wrapping the whole card in breakInside:avoid — a day
          with several activities and photos routinely runs taller than one PDF
          page, and forcing the entire card onto a fresh page just to avoid a
          mid-card split leaves a large blank gap at the bottom of the previous
          page. Instead, only the Hotel/Transport/Activity sub-cards below are
          individually protected, so a tall day can still split page-to-page at
          a clean boundary between them. */}
      <div
        className="flex items-baseline gap-3.5 px-4 pt-3.5 pb-3 relative z-10 after:absolute after:inset-px after:bg-linear-to-b after:from-white after:to-neutral-50 after:rounded-t-xl after:-z-10"
        style={{ borderBottom: `1px solid ${DOC.rule}` }}
      >
        <span
          className={cn(DISPLAY, "shrink-0 font-bold leading-none")}
          style={{
            fontSize: "30px",
            color: DOC.accent,
            // Optical alignment: the numeral's cap-height sits slightly above
            // the title's baseline on `items-baseline` alone.
            transform: "translateY(1px)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {String(day.day).padStart(2, "0")}
        </span>
        <div className="flex-1 min-w-0">
          {/* Editable in the builder, plain text everywhere else — see
              EditableText. `truncate` is dropped while editing so a long title
              stays readable as it's typed. */}
          <EditableText
            as="p"
            value={day.title}
            field={{ scope: "day", day: day.day, key: "title" }}
            placeholder={`Day ${day.day}`}
            fallback={`Day ${day.day}`}
            className={cn(DISPLAY, "block text-base font-semibold leading-tight font-heading")}
            style={{ color: DOC.ink, letterSpacing: "-0.01em" }}
          />
          <p className="text-[10.5px] mt-0.5 text-neutral-500/90" >
            Day {day.day}{checkInDate && ` · ${formatShortDate(checkInDate)}`}
          </p>
        </div>
      </div>

      <div className="px-3.5 py-3 space-y-3">
        {/* Rendered even when empty in the builder, so there's something to
            click; still hidden entirely on the client-facing document. */}
        <EditableText
          as="p"
          multiline
          value={day.description}
          field={{ scope: "day", day: day.day, key: "description" }}
          placeholder="Add a description for this day…"
          className="block text-xs text-neutral-700/90 leading-relaxed"
        />

        {/* A day with no stay yet. Only ever rendered in the builder, where a
            blank gap is a dead end — the client's copy simply omits the
            section, exactly as before. */}

        {/* Hotel info */}
        {hasHotel && (
          <DaySlot day={day.day} accepts="hotel">
            <EditableSection actions={stayActions}>
              {stayBlock ? (
                // More than one standard quoted, and this is the night the
                // block starts: every category's hotel for these nights, side
                // by side, in the one document.
                <div className="space-y-2">
                  <DaySubHead icon={Hotel} label="Stay At" />
                  <div className={SUBHEAD_INDENT}>
                    <StayColumns
                      categories={stayOptions!}
                      day={day.day}
                      nights={stayBlock.nights}
                      checkIn={stayBlock.checkIn ?? day.hotelCheckIn}
                      checkOut={stayBlock.checkOut ?? day.hotelCheckOut}
                      packageId={stayEditing?.packageId}
                      searchCity={day.accommodationLocation || ""}
                      travelDate={travelDate}
                      onStayOptionsChanged={stayEditing?.onStayOptionsChanged}
                    />
                  </div>
                </div>
              ) : stayContinues ? (
                // Night 2+ of a block whose columns were already listed.
                //
                // This used to render nothing at all, which read as a mistake:
                // the day simply had no stay section, so an exec scrolling a
                // five-night trip saw hotels on day 1 and a hole on days 2 and
                // 3, and could not tell whether the stay carried over or had
                // been forgotten. A single stay has always said so in one line.
                //
                // Repeating all three columns on every night is still the
                // noise this layout removes — so it says the same one line,
                // naming the block rather than the hotels.
                <div className="space-y-2" style={{ breakInside: "avoid" }}>
                  <DaySubHead icon={Hotel} label="Stay" />
                  <div
                    className={cn("flex items-center gap-2 rounded-lg px-3 py-2", SUBHEAD_INDENT)}
                    style={{ backgroundColor: DOC.paper, border: `1px solid ${DOC.rule}` }}
                  >
                    <MoonStar size={12} color={DOC.accent} className="shrink-0" />
                    <p className="text-[11.5px] flex-1 min-w-0" style={{ color: DOC.inkSoft }}>
                      <span className="font-semibold" style={{ color: DOC.ink }}>
                        {day.accommodationLocation?.trim() || "Your stay"}
                      </span>
                      <span>
                        {stayContinuesFrom != null && ` — continuing from day ${stayContinuesFrom}`}
                        {stayContinuesFrom != null && stayContinuesNights
                          ? `, night ${day.day - stayContinuesFrom + 1} of ${stayContinuesNights}`
                          : ""}
                      </span>
                    </p>
                  </div>
                </div>
              ) : continuesFrom != null ? (
                // Night 2+ of the same stay: the client already read the hotel's
                // details on the night it started, so repeating them is noise.
                // One line saying where they are and that nothing has changed.
                <div className="space-y-2" style={{ breakInside: "avoid" }}>
                  <DaySubHead
                    icon={Hotel}
                    label="Stay"
                  />
                  <div
                    className={cn("flex items-center gap-2 rounded-lg px-3 py-2", SUBHEAD_INDENT)}
                    style={{ backgroundColor: DOC.paper, border: `1px solid ${DOC.rule}` }}
                  >
                    <MoonStar size={12} color={DOC.accent} className="shrink-0" />
                    <p className="text-[11.5px] flex-1 min-w-0 flex items-baseline flex-wrap gap-x-1.5" style={{ color: DOC.inkSoft }}>
                      <span className="font-semibold" style={{ color: DOC.ink }}>
                        {day.accommodation}
                      </span>
                      <StayStars raw={day.accommodationStarRating} />
                      <span>{"— continuing from day "}{continuesFrom}</span>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2" style={{ breakInside: "avoid" }}>
                  <DaySubHead
                    icon={Hotel}
                    label="Stay"
                  // canEdit, not merely "is there a builder" — a package locked
                  // for costing review must not offer the affordance at all,
                  // rather than offering one that silently does nothing.
                  />
                  <div className={cn("flex gap-10", SUBHEAD_INDENT)}>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      {/* Stars sit with the NAME, not out on the section rule.
                    They rate this property — parked at the right-hand edge of
                    a "Stay" heading they read as a score for the day. */}
                      <p
                        className={cn(DISPLAY, "text-[12.5px] font-heading text-neutral-900 font-semibold flex items-baseline flex-wrap gap-x-1.5 gap-y-0.5")}
                        style={{ color: DOC.ink }}
                      >
                        <EditableText
                          value={day.accommodation}
                          field={{ scope: "day", day: day.day, key: "accommodation" }}
                          placeholder="Name this hotel…"
                          fallback="Hotel (TBD)"
                          readOnly={fromCatalog}
                          readOnlyReason={catalogLock}
                        />
                        <StayStars raw={day.accommodationStarRating} />
                        <GapBadge gaps={stayGaps(day)} />
                      </p>

                      <div className="flex items-center gap-3">
                        {(day.accommodationLocation || (builder?.canEdit && !fromCatalog)) && (
                          <p className="text-[11px] text-neutral-500/90 flex items-center gap-1">
                            <MapPin size={13} className="text-neutral-400/90 shrink-0" />
                            <EditableText
                              value={day.accommodationLocation}
                              field={{ scope: "day", day: day.day, key: "accommodationLocation" }}
                              placeholder="City, State"
                              readOnly={fromCatalog}
                              readOnlyReason={catalogLock}
                            />
                          </p>
                        )}

                        <p className="text-[11px] text-neutral-500/90 flex items-center gap-1">
                          <Users size={13} className="text-neutral-400/90 shrink-0" />
                          {occupancyText(day, adults, childCount)}
                        </p>
                      </div>



                      {(day.hotelCheckIn || day.hotelCheckOut || checkInDate) && (
                        <StayTimeline day={day} checkInDate={checkInDate} checkOutDate={checkOutDate} />
                      )}

                      {(day.accommodationRoomSpecs || (builder?.canEdit && !fromCatalog)) && (
                        <p className="text-[11px] text-neutral-500/90">
                          <EditableText
                            value={day.accommodationRoomSpecs}
                            field={{ scope: "day", day: day.day, key: "accommodationRoomSpecs" }}
                            placeholder="Room details — bed type, view, size…"
                            readOnly={fromCatalog}
                            readOnlyReason={catalogLock}
                          />
                        </p>
                      )}

                      {(mealText || builder?.canEdit) && (
                        <p className="text-[11px] text-emerald-600 flex items-center gap-1">
                          <Utensils size={10} className="text-emerald-500 shrink-0" />
                          {mealText ?? (
                            <EditableText
                              value={day.hotelMealPlan}
                              field={{ scope: "day", day: day.day, key: "hotelMealPlan" }}
                              placeholder="Meal plan — e.g. MAP, Breakfast & Dinner"
                            />
                          )}
                        </p>
                      )}

                      {extraRooms.length > 0 && (
                        <div className="pt-1.5 space-y-1.5" style={{ borderTop: `1px solid ${DOC.rule}` }}>
                          {extraRooms.map((r, i) => (
                            <div key={i} className="flex items-center gap-2">
                              {r.thumbnail ? (
                                /* eslint-disable-next-line @next/next/no-img-element -- arbitrary catalog URL, not a static app asset */
                                <img src={r.thumbnail} alt="" className="w-14 aspect-64/39 rounded-md object-cover shrink-0" />
                              ) : (
                                <div className="w-14 aspect-64/39 rounded-md bg-neutral-100 flex items-center justify-center shrink-0">
                                  <Hotel size={10} className="text-neutral-300" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-[11px] font-semibold text-neutral-700 truncate">
                                  + {r.quantity > 1 ? `${r.quantity}× ` : ""}{r.label}
                                </p>
                                {r.roomSpecs && (
                                  <p className="text-[10px] text-neutral-400 truncate">{r.roomSpecs}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {hasPhotos && (
                      <div className="w-50 shrink-0 space-y-1">
                        {(day.accommodationPhoto || onImageChange) && (
                          <div className="group/img relative">
                            {day.accommodationPhoto ? (
                              /* eslint-disable-next-line @next/next/no-img-element -- arbitrary catalog URL, not a static app asset */
                              <img src={day.accommodationPhoto} alt="Hotel" className="w-50 aspect-video rounded-lg object-cover" />
                            ) : (
                              <div className="w-50 aspect-video rounded-lg border-2 border-dashed border-neutral-200 bg-neutral-50 flex items-center justify-center">
                                <ImageIcon size={16} className="text-neutral-300" />
                              </div>
                            )}
                            {onImageChange && (
                              <ImageEditButton
                                value={day.accommodationPhoto}
                                onChange={(url) => onImageChange({ kind: "accommodationPhoto", day: day.day }, url)}
                                dialogTitle="Hotel Photo"
                                className="top-1 right-1 size-6"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </EditableSection>
          </DaySlot>
        )}

        <DayAddonsSection addOns={addOns ?? []} day={day.day} />

        {/* Add-affordances for an empty day. Builder-only in every sense:
            gated on canEdit, marked builder-only so they can't reach the PDF,
            and absent entirely from the client-facing document. */}

        {/* Transport */}
        {(day.transport || day.transportPickup || day.transportDrop) && (
          <DaySlot day={day.day} accepts="cab">
            <EditableSection actions={transportActions}>
              <div className="space-y-2" style={{ breakInside: "avoid" }}>
                <DaySubHead
                  icon={Car}
                  label="Transport"
                  meta={[
                    day.transportDistanceKm ? `${day.transportDistanceKm} km` : null,
                    day.transportTravelTime || null,
                    day.transportPickup && day.transportDrop ? `${day.transportPickup} → ${day.transportDrop}` : null,
                  ].filter(Boolean).join(" · ") || null}
                />

                <div className={cn("flex gap-5", SUBHEAD_INDENT)}>
                  <div className="flex-1 min-w-0 space-y-2">
                    {day.transport && (
                      <p className="text-sm font-semibold font-heading text-neutral-900 text-[12.5px]">
                        {day.cabQuantity && day.cabQuantity > 1 ? `${day.cabQuantity}× ` : ""}
                        {day.transport}
                        {day.transportVehicleType && <span className="font-normal text-neutral-500/90 text-[11px]"> · {day.transportVehicleType}</span>}
                        {day.transportSeats && <span className="font-normal text-neutral-500/90 text-[11px]"> · {day.transportSeats} Seats</span>}
                        {" "}
                        <GapBadge gaps={transportGaps(day)} />
                      </p>
                    )}

                    {(day.transportPickup || day.transportDrop || builder?.canEdit) && (
                      <TransferTimeline day={day} />
                    )}

                    {extraCabs.length > 0 && (
                      <div className="pt-1.5 space-y-1.5" style={{ borderTop: `1px solid ${DOC.rule}` }}>
                        {extraCabs.map((c, i) => (
                          <div key={i} className="flex items-center gap-2">
                            {c.thumbnail ? (
                              /* eslint-disable-next-line @next/next/no-img-element -- arbitrary catalog URL, not a static app asset */
                              <img src={c.thumbnail} alt="" className="w-14 aspect-64/39 rounded-md object-cover shrink-0" />
                            ) : (
                              <div className="w-14 aspect-64/39 rounded-md bg-neutral-100 flex items-center justify-center shrink-0">
                                <Car size={10} className="text-neutral-300" />
                              </div>
                            )}
                            <p className="text-[11px] font-semibold text-neutral-700 truncate">
                              + {c.quantity > 1 ? `${c.quantity}× ` : ""}{c.label}
                              {c.vehicleType && <span className="font-normal text-neutral-400"> · {c.vehicleType}</span>}
                              {c.seats && <span className="font-normal text-neutral-400"> · {c.seats} Seats</span>}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {(day.transportPhoto || onImageChange) && (
                    <div className="group/img relative rounded-lg overflow-hidden w-52 h-36 shrink-0">
                      {day.transportPhoto ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary catalog URL, not a static app asset */}
                          <img src={day.transportPhoto} alt="" className="w-52 h-36 object-cover" />
                          {day.transport && (
                            <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 via-black/20 to-transparent px-2 py-1.5 pt-6">
                              <p className="text-xs text-white font-medium truncate">{day.transport}</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="w-52 h-36 bg-neutral-50 border-2 border-dashed border-neutral-200 flex items-center justify-center">
                          <ImageIcon size={18} className="text-neutral-300" />
                        </div>
                      )}
                      {onImageChange && (
                        <ImageEditButton
                          value={day.transportPhoto}
                          onChange={(url) => onImageChange({ kind: "transportPhoto", day: day.day }, url)}
                          dialogTitle="Transport Photo"
                          className="top-1 right-1 size-6"
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </EditableSection>
          </DaySlot>
        )}

        {/* Meals — shifted so breakfast shows on the day it's actually eaten
            (the morning of checkout), not the day the hotel was checked into. */}
        {(shiftedMeals ?? day.meals).length > 0 && (
          <EditableSection actions={mealsActions}>
            <div className="space-y-2" style={{ breakInside: "avoid" }}>
              <DaySubHead
                icon={Utensils}
                label="Meals"
              />
              <div className={SUBHEAD_INDENT}>
                <MealsRow meals={shiftedMeals ?? day.meals} />
              </div>
            </div>
          </EditableSection>
        )}

        {/* Activities */}

        {activities.length > 0 && (
          <DaySlot day={day.day} accepts="activity">
            <div className="space-y-2.5">
              {activities.map(({ a, originalIndex }, idx) => {
                const row = (
                  <ActivityRow
                    key={originalIndex}
                    activity={a}
                    dayNumber={day.day}
                    activityIndex={originalIndex}
                    onImageChange={onImageChange}
                    onCaptionChange={
                      onActivityCaptionChange
                        ? (activityIndex, photoIndex, caption) => onActivityCaptionChange(day.day, activityIndex, photoIndex, caption)
                        : undefined
                    }
                  />
                );
                // The "Experiences" label was previously its own unprotected
                // paragraph — nothing stopped it from landing alone at the
                // bottom of a page with every activity starting fresh on the
                // next one. Pairing it with just the FIRST activity (not the
                // whole list) keeps the heading attached to real content
                // without forcing every activity onto one page together.
                // Item-level controls on every row, list-level controls on the
                // list. The first row carries both: its outer section is what
                // holds the "Experiences" heading, so Add/Replace/Remove-all
                // belong there, while Move and Remove-this belong to the row.
                const item = (
                  <EditableSection actions={activityActions(originalIndex, idx)}>
                    {row}
                  </EditableSection>
                );
                if (idx === 0) {
                  return (
                    // The heading is a label, not a control. It used to carry a
                    // floating add/edit/replace/remove-all toolbar, which put
                    // four buttons over a hairline rule with nothing under them
                    // — the things they acted on were the rows below, each of
                    // which now carries its own. Everything that toolbar offered
                    // is still reachable: add from the day's ⋯ menu, the
                    // foot-of-day button and the sidebar's Itinerary row, and
                    // remove-all from that row's clear button.
                    <div key={originalIndex} className="space-y-2.5" style={{ breakInside: "avoid" }}>
                      <DaySubHead
                        icon={Sparkles}
                        label="Experiences"
                      />
                      <div className={SUBHEAD_INDENT}>{item}</div>
                    </div>
                  );
                }
                // Every later activity carries the same indent, so the whole
                // list stays aligned under the Experiences label above it.
                return <div key={originalIndex} className={SUBHEAD_INDENT}>{item}</div>;
              })}
            </div>
          </DaySlot>
        )}

        {/* Client-facing copy, not an internal remark — it already rendered on
            the sent document and in the PDF. A tone turns it from a stray
            italic line into a real callout, which is the point: a note saying
            "carry photo ID" and one saying "upgrade confirmed" should not look
            identical on the client's copy. */}
        <DayNote day={day} />
      </div>

      {/* The day's own content, at the foot of the day — see DaySectionsBar. */}
      {builder?.canEdit && (
        <DaySectionsBar
          day={day.day}
          hasStay={!!hasHotel}
          hasTransport={!!(day.transport || day.transportPickup || day.transportDrop)}
          hasActivities={activities.some(({ a }) => a.title.trim())}
          hasMeals={(shiftedMeals ?? day.meals).length > 0}
          isPending={!!day.hotelPending}
        />
      )}
    </div>
  );
}

/** Full-bleed cover photo behind the package title — falls back to a brand
 * gradient (never a blank/broken image) when no cover has been set yet.
 * When onCoverImageChange is supplied (the internal builder's live preview),
 * this becomes a drop target: drag an image straight from the browser onto
 * it to replace the cover. Left undefined on the public share page / print
 * export, where the document is read-only. */
function HeroCover({
  form, onCoverImageChange, onCoverImagePositionChange,
}: {
  form: PreviewData;
  onCoverImageChange?: (url: string) => void;
  onCoverImagePositionChange?: (position: number) => void;
}) {
  const DOC = useDocTheme();
  const [coverFailed, setCoverFailed] = useState(false);
  // Reset the failed flag when the cover image URL changes, without an
  // effect — setting state during render (guarded by the changed check) is
  // the React-recommended pattern for "adjust state in response to a prop change".
  const [lastCoverSrc, setLastCoverSrc] = useState(form.coverImage);
  if (form.coverImage !== lastCoverSrc) {
    setLastCoverSrc(form.coverImage);
    setCoverFailed(false);
  }
  const hasImage = !!form.coverImage && !coverFailed;
  const editable = !!onCoverImageChange;
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (!onCoverImageChange) return;
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please drop an image file");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadImageFile(file, "packages");
      onCoverImageChange(url);
      // A brand-new photo resets to a centered crop — the old vertical
      // offset was tuned for whatever image was there before.
      onCoverImagePositionChange?.(50);
      toast.success("Cover image updated");
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      className="group relative w-full overflow-hidden"
      style={{ height: "90mm" }}
      onDragOver={editable ? (e) => { e.preventDefault(); setDragOver(true); } : undefined}
      onDragLeave={editable ? () => setDragOver(false) : undefined}
      onDrop={editable ? handleDrop : undefined}
    >
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary external/catalog URL, not a static app asset
        <img
          src={form.coverImage}
          alt="Cover photo"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: `center ${form.coverImagePosition ?? 50}%` }}
          onError={() => setCoverFailed(true)}
        />
      ) : (
        <div className="absolute inset-0 bg-linear-to-br from-primary-700 via-primary-600 to-primary-900" />
      )}

      {/* Scrim for legibility — heaviest where the title sits */}
      <div className="absolute inset-0 bg-linear-to-t from-neutral-950/95 via-neutral-950/55 to-neutral-950/10" />

      {/* Explicit edit affordance — hover the cover to reveal it, since the
       * drag-and-drop-anywhere-on-the-image behavior isn't obvious on its
       * own. Opens the same drag-drop / upload / paste-link controls as the
       * sidebar's Cover Image field, plus the vertical-position slider. */}
      {editable && (
        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              className="no-print absolute top-4 right-4 z-20 flex items-center justify-center size-9 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Change cover image"
            >
              <Pencil size={15} />
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Change Cover Image</DialogTitle>
              <DialogDescription>
                Drag and drop a photo, upload from your computer, or paste a link.
              </DialogDescription>
            </DialogHeader>
            <ImageDropField
              value={form.coverImage}
              onChange={(url) => onCoverImageChange?.(url)}
              position={form.coverImagePosition}
              onPositionChange={onCoverImagePositionChange}
            />
          </DialogContent>
        </Dialog>
      )}

      {editable && (dragOver || uploading) && (
        <div className="no-print absolute inset-0 z-10 flex items-center justify-center bg-neutral-950/70 border-4 border-dashed border-white/60">
          {uploading ? (
            <div className="flex flex-col items-center gap-2 text-white">
              <Loader2 size={22} className="animate-spin" />
              <span className="text-xs font-semibold">Uploading…</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-white">
              <Upload size={22} />
              <span className="text-xs font-semibold">Drop image to replace cover</span>
            </div>
          )}
        </div>
      )}

      {/* The photo is full-bleed; the words on it are not. Without the inner
          measure the client's name and the title sat hard against the window
          edge while the trip-stats card directly below them started at the
          content margin — the two most prominent things on the page, out of
          line with each other by an inch. */}
      <div className="absolute inset-x-0 bottom-0 pb-[15mm]">
        {/* screen-space and the page margin on ONE element, exactly as the
            trip-stats card below carries them — nested the other way round
            the two would land a few millimetres apart on a wide window, which
            is worse than not aligning them at all. */}
        <div className="screen-space px-[10mm]">
        {/* The client's own name, handwritten, sitting on top of the title —
            so the cover reads as one phrase, "Suraj's / Alleppey & Kochi
            Weekend Escape", and the document looks addressed to a person
            rather than generated for a record.

            The script is set in gold against the title's white so the two
            never read as one run-on line, and tilted a couple of degrees to
            look placed rather than typed. It overlaps the title's cap height
            by a few px (the negative margin), which is what makes the pair a
            lockup instead of two stacked lines.

            `pointer-events-none` because it sits over the editable h1 — the
            name comes from the originating query and isn't editable here, and
            without this it would swallow clicks meant for the title. */}
        {form.clientName && (
          <span
            aria-hidden="true"
            className="-mb-2 ml-1 -rotate-2 origin-bottom-left text-primary-400 text-[32px] leading-none pointer-events-none select-none font-bold block w-max"
            style={{
              fontFamily: "var(--font-script)",
              fontWeight: 700,
              // Belt and braces over the scrim: a photo can be bright exactly
              // where the script sits, and a coloured script is the first thing
              // to disappear into it. Cheap, and it survives the PDF capture.
              textShadow: "0 1px 3px rgba(0,0,0,0.55)",
            }}
          >
            {possessive(form.clientName)}
          </span>
        )}
        <EditableText
          as="h1"
          value={form.title}
          field={{ scope: "package", key: "title" }}
          placeholder="Name this package…"
          fallback="Untitled Package"
          className={cn(DISPLAY, "inline font-heading text-[34px] leading-[1.08] font-bold text-white")}
          style={{
            maxWidth: "150mm",
            letterSpacing: "-0.02em",
            textWrap: "balance",
            textShadow: "0 2px 6px rgba(0,0,0,0.6)",
          }}
        />

        {/* Duration in a hairline gold box — the third beat of the lockup, and
            the one number a client checks first. Nights are shown alongside
            days because "6 days" alone is the figure people misread. */}
        {form.totalDays > 0 && (
          <div className="mt-3 flex gap-3 items-center">
            <span className="inline-flex items-center gap-2.5 rounded-pill border border-primary-50 ring-[0.18em] ring-inset ring-primary-300 px-3 py-1 text-white  text-[13px] font-semibold backdrop-md">
              {form.totalDays} Day{form.totalDays !== 1 ? "s" : ""}
              <span className="h-3.5 w-px bg-primary-300" />
              {form.totalNights} Night{form.totalNights !== 1 ? "s" : ""}
            </span>
            <span className="text-white text-lg font-bold font-heading">TRIP</span>
          </div>
        )}

        {/* The route used to run along here, under the title. It has moved into
            the Prepared For / Travel Manager card below: over a photograph the
            chips fought the scrim for legibility and a long itinerary wrapped to
            three lines that pushed the whole lockup off the cover. On paper it
            reads as document meta, next to who the trip is for. */}
        </div>
      </div>

      {/* Wave transition into the body below — filled with the paper tone,
          not white, or it leaves a pale seam across the hero's bottom edge. */}
      <svg
        viewBox="0 0 1440 74" preserveAspectRatio="none"
        className="absolute -bottom-px left-0 w-full" style={{ height: "20px" }}
      >
        <path fill={DOC.paper} d="M0,32 C240,74 480,0 720,26 C960,52 1200,74 1440,32 L1440,74 L0,74 Z" />
      </svg>
    </div>
  );
}

/** One cell of the trip-stats strip. Label is sentence case, not the 9px bold
 * uppercase the document used to put on every micro-label — at this size
 * uppercase costs legibility and reads as dashboard chrome. The value carries
 * the emphasis instead, in the display face. */
function StatCell({ icon: Icon, label, value, onOpen }: {
  icon: React.ElementType; label: string; value: string;
  /** Makes the cell the way in to whatever panel owns this figure. Travellers
   * are the case that needed it: the count and the children's ages live in
   * the Trip panel, and "Trip" is not a word anyone searches when they want
   * to say how many children are coming — so execs read "2 Children" on the
   * document and had nowhere to click. Only ever supplied inside the builder;
   * the client's document gets a plain cell. */
  onOpen?: () => void;
}) {
  const DOC = useDocTheme();
  return (
    <div
      className={cn(
        "px-4 py-3.5 flex flex-col justify-center min-w-0 relative",
        onOpen && "builder-only-interactive cursor-pointer transition-colors hover:bg-dashboard-primary/8 group/stat",
      )}
      onClick={onOpen}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={onOpen ? (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); }
      } : undefined}
      title={onOpen ? `Edit ${label.toLowerCase()}` : undefined}
    >
      {onOpen && (
        <span className="builder-only no-print absolute top-1.5 right-2 text-[9px] font-semibold uppercase tracking-wide text-dashboard-primary opacity-0 group-hover/stat:opacity-100 transition-opacity">
          edit
        </span>
      )}
      <p
        className="flex items-center gap-1.5 mb-1 text-[11px] font-medium whitespace-nowrap text-neutral-500/90"
      >
        <Icon size={16} className="text-neutral-400/90" /> {label}
      </p>
      <p
        className={cn(DISPLAY, "font-bold font-heading text-sm leading-tight truncate text-neutral-900")}
      >
        {value}
      </p>
    </div>
  );
}

/** Dark, brand-matched close to the document — same surface colour
 * (neutral-950) and contact details as the live site's footer
 * (app/components/navigation/Footer.tsx), scaled down to what makes sense in
 * a static, per-client document (no nav links, no social icons). */
function DocumentFooter({ form }: { form: PreviewData }) {
  const cs = form.companySettings;
  const phone = cs?.phone ?? COMPANY_PHONE;
  const email = cs?.email ?? COMPANY_EMAIL;
  const address = cs?.address ?? COMPANY_ADDRESS;
  const description = cs?.description ?? DEFAULT_COMPANY_DESCRIPTION;
  const disclaimer = cs?.disclaimer ?? DEFAULT_DOCUMENT_DISCLAIMER;

  const contactRows = [
    { icon: Phone, label: "24 × 7 Helpline", value: phone },
    { icon: Mail, label: "Email Us", value: email },
    { icon: MapPin, label: "Head Office", value: address },
  ];

  return (
    <footer className="doc-footer bg-neutral-950 text-slate-300 mt-2" style={{ breakInside: "avoid" }}>
      {/* The dark ground reaches both window edges; the columns inside stop at
          the same measure the rest of the page uses. */}
      <div className="screen-space px-[10mm] pt-9 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-8 pb-7 border-b border-white/10">
          <div className="space-y-3" style={{ maxWidth: "95mm" }}>
            <DyLogo className="h-7 text-primary-500" />
            <p className="text-slate-400 text-[11px] leading-relaxed">
              {description}
            </p>
          </div>

          <div className="flex flex-col gap-3 shrink-0">
            {contactRows.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-2.5">
                <span className="flex items-center justify-center size-8 rounded-lg bg-white/[0.06] border border-white/[0.08] text-slate-400 shrink-0">
                  <Icon size={13} />
                </span>
                <div>
                  <p className="text-[8px] font-bold text-slate-500 tracking-widest uppercase leading-none mb-0.5">{label}</p>
                  <p className="text-[11px] text-slate-200 font-medium">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {form.execName && (
          <div className="flex flex-wrap items-center justify-between gap-3 py-4 border-b border-white/10">
            <p className="text-[11px] text-slate-400">
              Crafted for you by <span className="text-white font-semibold">{form.execName}</span>
              {form.execDesignation && <span> · {form.execDesignation}</span>}
            </p>
            {form.execEmail && <p className="text-[11px] text-primary-400 font-medium">{form.execEmail}</p>}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-5 text-[10px] text-slate-500">
          <p>© {new Date().getFullYear()} Dreams Yatri. All rights reserved.</p>
          <p>{disclaimer}</p>
        </div>
      </div>
    </footer>
  );
}

// Global print rules — scoped so only the .itinerary-print-area prints,
// hiding the rest of the builder chrome (dashboard header, edit tabs, etc).
// print-color-adjust keeps the hero scrim / gradients / dark footer intact
// in the printed PDF instead of Chrome silently dropping backgrounds.
const PRINT_STYLES = `
  .itinerary-print-area, .itinerary-print-area * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* The template's two faces, applied by variable rather than by class.
     .font-heading is Tailwind's own utility (Poppins, from the @theme block in
     globals.css) and would otherwise pin every heading to the brand display
     face no matter which template is active — so it's overridden here, inside
     the document only, to follow --doc-font-heading. The vars themselves are
     set inline on .itinerary-print-area by ItineraryDocument; the fallbacks
     keep an un-themed render (a fragment previewed outside the provider) on
     the house faces instead of dropping to Times. */
  .itinerary-print-area { font-family: var(--doc-font-body, var(--font-inter), sans-serif); }
  .itinerary-print-area .font-heading { font-family: var(--doc-font-heading, var(--font-poppins), sans-serif); }

  /* Builder-only chrome — empty-field placeholders and any other affordance
     that exists purely to make the preview editable.

     Deliberately OUTSIDE the @media print block below. The PDF export path
     (pdfExport.ts) rasterises the live screen DOM through html2canvas, which
     never evaluates print media, so a rule hidden in @media print would not
     apply and this content would land in the client's PDF. The exporter sets
     data-exporting on the root for the duration of the capture instead.
     Browser print (Cmd-P) is covered by the .no-print rule further down.

     data-published is the third output: the same document served as a live web
     page on the client's share link (/custom-package/[id]). It is on screen,
     not printing and not being captured, so neither of the other two hooks
     reaches it — but it is just as much the client's copy as the PDF is, and
     has to hide exactly the same chrome. */
  .itinerary-print-area[data-exporting] .builder-only,
  .itinerary-print-area[data-published] .builder-only { display: none !important; }

  /* Edit affordances that survive on screen because they're gated on the
     editable flag rather than marked .builder-only. None of them render
     without the builder's
     callbacks, so this is belt-and-braces — but the published page is the one
     render nobody internal ever looks at, and a stray control there is seen
     first by the client. */
  .itinerary-print-area[data-published] .no-print { display: none !important; }

  /* The inverse: content that stands in for builder chrome once it's hidden.
     The day-wise summary needs it — an empty cell offers "+ Add hotel" while
     editing and has to fall back to a plain em dash in the client's copy,
     and there is no way to express that with .builder-only alone. Hidden on
     screen, shown for both output paths. */
  .export-only { display: none; }
  .itinerary-print-area[data-exporting] .export-only,
  .itinerary-print-area[data-published] .export-only { display: inline; }

  /* How the published page LOOKS is not here.
     What data-published means — builder chrome hidden, export fallbacks shown
     — is a property of the document and stays above. How that document is
     then presented as a web page (its width, its measure, its type scale) is
     the website's business, and lives in the website's own stylesheet:
     app/(website)/custom-package/[id]/components/published-theme.ts

     Kept apart on purpose. Those rules used to sit in this block, which meant
     a change meant for the client's page was one typo away from the sheet
     that prints and the PDF that is captured. The builder and both exporters
     never load that file at all now, so a web-only change cannot reach them.
     Anything added for the website — new spacing, an interaction's styling —
     belongs there, not here. */

  @media print {
    .export-only { display: inline; }
    body * { visibility: hidden; }
    .itinerary-print-area, .itinerary-print-area * { visibility: visible; }
    .no-print { display: none !important; }

    /* The builder page wraps the preview in a sticky header, a
       position:relative split-pane, and a scrolling overflow-auto <aside> —
       any one of those can clip or mis-position an absolutely-positioned
       print area. Instead, strip every layout constraint on that ancestor
       chain (marked .print-reset) so the print area sits in plain normal
       flow and paginates like any other block content. */
    html, body { height: auto !important; overflow: visible !important; }
    .print-reset {
      position: static !important;
      display: block !important;
      height: auto !important;
      max-height: none !important;
      overflow: visible !important;
    }
    .itinerary-print-area { width: 210mm; margin: 0 auto !important; box-shadow: none !important; border-radius: 0 !important; border: none !important; }

    /* Left/right stay 0 here — the existing 10mm horizontal padding inside
       the page (px-[10mm] on header/main/footer) already provides that
       margin at the full 210mm page width, so reserving it again via @page
       would double it and force the page narrower than its own content.
       Top/bottom get a real page-box margin instead, matching that 10mm. */
    @page { size: A4; margin: 10mm 0mm 10mm 0mm; }
    /* Page 1 always opens on the hero cover — let it bleed to the true top
       edge instead of sitting inside a blank 10mm band. */
    @page :first { margin-top: 0mm; }

    /* The closing dark band is always the very last thing on the document,
       so it always lands on the actual last page — bleed it through that
       page's reserved bottom margin to the true edge, the same "close the
       book" look as the hero's top-edge bleed on page 1. Interior pages
       keep the normal 10mm bottom margin untouched. */
    .doc-footer { padding-bottom: 10mm; margin-bottom: -10mm; }

    /* Never stand a single line of a paragraph alone at the top/bottom of a
       page — pushes the whole paragraph along instead of leaving an orphan. */
    .itinerary-print-area p { orphans: 3; widows: 3; }
  }
`;

export function ItineraryDocument({
  form, onCoverImageChange, onCoverImagePositionChange, onImageChange, onActivityCaptionChange, variant = "card",
  published = false, stayEditing,
}: {
  form: PreviewData;
  /** Present only in the internal builder's live preview — enables dropping
   * an image straight onto the hero to replace the cover. Omitted on the
   * public share page and print/PDF export, which stay read-only. */
  onCoverImageChange?: (url: string) => void;
  onCoverImagePositionChange?: (position: number) => void;
  /** Same "internal builder only" gating as onCoverImageChange, but for
   * every other photo in the document (stops, hotel, room, transport,
   * activities) — see ImageEditTarget for what each edit refers to. */
  onImageChange?: OnImageChange;
  /** Same gating again — edits an activity photo's caption (`photoLabels[i]`)
   * alongside the image itself, from the same edit dialog. */
  onActivityCaptionChange?: (day: number, activityIndex: number, photoIndex: number, caption: string) => void;
  /** "card" (default) keeps the rounded corners + drop shadow used to present
   * the document on the public share page's colored background. "flat" drops
   * both so the on-screen preview reads as a plain A4 page — matching exactly
   * what window.print() produces, where these are already stripped. */
  /** How the page presents itself.
   *
   * "card" is the builder's preview — a sheet lifted off the workspace behind
   * it. "flat" is the same sheet with a hairline instead of a shadow. "page"
   * is for the client's own link, where the document IS the page: no corner
   * radius, no shadow, no border, nothing framing it. A rounded, shadowed
   * rectangle floating on a grey ground reads as a PDF someone embedded, and
   * the whole point of that link is that it is a web page. */
  variant?: "card" | "flat" | "page";
  /** Present only in the builder: makes the stay columns editable in place —
   * pick each standard's hotel, move the Recommended badge, add or drop a
   * standard. Absent on the client's page and in the PDF, which stay
   * read-only, so the same component serves all three. */
  stayEditing?: { packageId: string; onStayOptionsChanged: () => void | Promise<void> };
  /** Rendered as the client's live page on the public share link, rather than
   * inside the builder. Hides every builder affordance and swaps in the same
   * export-only fallbacks the PDF gets (see PRINT_STYLES), so the page and the
   * PDF are the same document rather than two things that drift apart. */
  published?: boolean;
}) {
  // Optional: this same document renders on the client's published page, where
  // there is no provider and nothing is clickable.
  const builder = useOptionalBuilder();

  const travelDateStr = form.travelDate
    ? new Date(form.travelDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "TBD";

  const durationLabel = `${form.totalDays}D / ${form.totalNights}N`;

  const routeSteps = buildRouteSteps(form);

  // Stay blocks, computed from the options rather than from the day rows. The
  // day row only ever carries the recommended stay, so a run derived from it
  // would be wrong the moment one option changed hotel on a night another did
  // not — the block would claim more nights than every column actually holds.
  const stayOptions = form.stayOptions ?? [];
  const stayOptionIds = stayOptions.map((o) => o.id);
  // Which stop each day falls under — the grouping the whole stay block now
  // follows. Three nights in Shimla is one stay; the two in Manali after it
  // are another.
  const stayDayLocations = deriveDayLocations(form.stops, form.itineraries.length);
  const recommendedStay = stayOptions.find((o) => o.isRecommended) ?? stayOptions[0];
  const stayRuns: StayRun[] = stayOptions.length > 1
    ? buildStayRuns(form.itineraries.map((d) => {
        const byOption: Record<string, StayCell> = {};
        for (const o of stayOptions) {
          const cell = o.byDay?.[d.day];
          if (cell) byOption[o.id] = cell;
        }
        return {
          day: d.day,
          // Check-in/out belong to the stay, so they come off the recommended
          // option's own cell first; the day row is the fallback for a package
          // whose options predate those fields being filled in.
          checkIn: recommendedStay?.byDay?.[d.day]?.checkIn ?? d.hotelCheckIn,
          checkOut: recommendedStay?.byDay?.[d.day]?.checkOut ?? d.hotelCheckOut,
          // Where the day is spent — what actually decides where one stay
          // ends. The day's own hotel location wins when it has one, since an
          // exec who typed a town on the day meant that town; otherwise the
          // route stop this day falls under.
          location: d.accommodationLocation?.trim() || stayDayLocations[d.day - 1] || null,
          byOption,
        };
      }), stayOptionIds)
    : [];

  const detailedShiftedMeals = computeShiftedMeals(form.itineraries);

  const paxLine =
    `${form.adults} Adult${form.adults !== 1 ? "s" : ""}` +
    (form.children ? `, ${form.children} Child${form.children !== 1 ? "ren" : ""}` : "") +
    (form.infants ? `, ${form.infants} Infant${form.infants !== 1 ? "s" : ""}` : "");

  // The headline figure. With several standards quoted this is the recommended
  // one's, so the big number and the badge below it never name different
  // prices; with one, it is the package's own as before.
  const recommendedCategory = (form.stayOptions ?? []).find((c) => c.isRecommended)
    ?? (form.stayOptions ?? [])[0];
  const headlineTotal = (form.stayOptions?.length ?? 0) > 1 && (recommendedCategory?.totalPrice ?? 0) > 0
    ? recommendedCategory!.totalPrice!
    : form.totalPrice ? Number(form.totalPrice) : null;
  const priceStr = headlineTotal != null
    ? `${form.currency} ${headlineTotal.toLocaleString("en-IN")}`
    : "To be confirmed";

  // Per-person is the total divided by paying heads and rounded, so it does not
  // generally multiply back to the total. The document prints both side by
  // side, which invites exactly that multiplication, so where it cannot
  // reconcile the number is marked approximate.
  const payingPax = form.adults + form.children;
  // Both figures describe the SAME standard. Left as the package's own while
  // the headline followed the recommended one, the card read "INR 15,750" next
  // to "~INR 5,513 per person" — two different standards, side by side, with
  // nothing to say so.
  const headlinePerPerson = (form.stayOptions?.length ?? 0) > 1 && (recommendedCategory?.pricePerPerson ?? 0) > 0
    ? recommendedCategory!.pricePerPerson!
    : form.pricePerPerson ? Number(form.pricePerPerson) : null;
  const perPersonExact =
    headlinePerPerson != null && headlineTotal != null && payingPax > 0 &&
    headlinePerPerson * payingPax === headlineTotal;

  const perPersonStr = headlinePerPerson
    ? `${perPersonExact ? "" : "~"}${form.currency} ${Math.round(headlinePerPerson).toLocaleString("en-IN")} per person`
    : null;

  // Route map legs derived straight from the ticket list — see the module
  // comment on PreviewData.tickets for why these aren't separate fields.
  const transport = deriveTransportFields(form.tickets);
  // Sections that render nothing when empty still need to exist while editing,
  // or there's no way to add the first line.
  const builderCanEdit = !!useOptionalBuilder()?.canEdit;

  // Template, then the company's house tweaks, then this package's own — each
  // layer only overriding what it actually sets. Resolved once at the root and
  // handed down by context, so every component below paints the same palette
  // without a theme prop threaded through twenty levels of section.
  const DOC = resolveDocTheme(
    form.template ?? form.companySettings?.defaultTemplate,
    form.companySettings?.themeOverrides,
    form.themeOverrides,
  );

  return (
    <DocThemeProvider theme={DOC}>
      <div>
        <style>{PRINT_STYLES}</style>

        {/* ── A4 page ─────────────────────────────────────────────────────────── */}
        <div
          className={cn(
            "itinerary-print-area mx-auto overflow-hidden",
            variant === "page" ? "" : variant === "flat" ? "border" : "rounded-lg shadow-xl",
          )}
          // Empty-string attribute rather than a boolean: the CSS above keys
          // off presence ([data-published]), and React drops the attribute
          // entirely when the value is undefined.
          data-published={published ? "" : undefined}
          style={{
            width: "210mm",
            minHeight: "297mm",
            backgroundColor: DOC.paper,
            borderColor: variant === "flat" ? DOC.rule : undefined,
            // The two faces reach the page as custom properties rather than as
            // classes: PRINT_STYLES maps .font-heading and the page body onto
            // them, and getComputedStyle resolves a var() long before
            // html2canvas-pro sees it — so a font swap survives PDF capture the
            // way an oklch() colour would not.
            ["--doc-font-heading" as string]: DOC.fontHeading,
            ["--doc-font-body" as string]: DOC.fontBody,
            fontFamily: DOC.fontBody,
            color: DOC.ink,
          }}
        >
          {/* ── Masthead ──────────────────────────────────────────────────────
            Logo left, contact right, closed by a hairline. The rule matters:
            it gives the page a top edge to hang from, so the hero below reads
            as a plate set into the document rather than as the page itself. */}
          <header
            className="px-[10mm] pt-5 pb-3.5 h-full"
            style={{ borderBottom: `1px solid ${DOC.rule}` }}
          >
            {/* The rule above spans the window; this row is what stops at the
                measure. Same shape as the site's own header. */}
            <div className="screen-space flex items-end justify-between h-full">
              {/* Colour via className, not style: DyLogo forwards only className,
                and its mask is painted with bg-current — a background-color,
                which html2canvas-pro resolves from oklch just fine (it's the
                inline-SVG *stroke* that doesn't, see SectionHeader). */}
              <DyLogo className="h-9 text-primary-500" />
              <div className="h-9  text-[10.5px] flex items-center gap-4 text-neutral-800" >
                <p className="flex items-center justify-end gap-1.5">
                  <Phone size={16} className="text-neutral-400/90" /> {form.companySettings?.phone ?? COMPANY_PHONE}
                </p>
                <p className="flex items-center justify-end gap-1.5">
                  <Mail size={16} className="text-neutral-400/90" /> {form.companySettings?.email ?? COMPANY_EMAIL}
                </p>
              </div>
            </div>
          </header>

          {/* ── Hero cover ────────────────────────────────────────────────────── */}
          <HeroCover
            form={form}
            onCoverImageChange={onCoverImageChange}
            onCoverImagePositionChange={onCoverImagePositionChange}
          />

          {/* ── Floating trip-stats card, overlapping the hero's wave edge ───── */}
          <div className="screen-space relative z-10 px-[10mm]" style={{ marginTop: "-13mm" }}>
            <div
              className="rounded-md grid grid-cols-3 overflow-hidden bg-white shadow-lg shadow-neutral-200/85"

            >
              <StatCell icon={Calendar} label="Travel date" value={travelDateStr} />
              <StatCell icon={Moon} label="Duration" value={durationLabel} />
              <StatCell
                icon={Users}
                label="Travellers"
                value={paxLine}
                onOpen={builder?.canEdit ? () => builder.setPanelTab("trip") : undefined}
              />
            </div>
          </div>

          {/* ── Body ──────────────────────────────────────────────────────────── */}
          <main className="screen-space px-[10mm] pt-7 pb-2 space-y-7">
            {(form.clientName || form.execName || routeSteps.length > 0 || form.destination) && (
              <div className="rounded-lg ring-1 ring-inset ring-neutral-200 bg-white overflow-hidden shadow-lg shadow-neutral-200/80" style={{ breakInside: "avoid" }}>
                {(form.clientName || form.execName) && (
                  <div className="grid grid-cols-2 divide-x divide-neutral-200/85">
                    {/* Prepared For — the client this itinerary is going to */}
                    <div className="p-3.5">
                      <p className="text-[9px] font-bold text-primary-600/90 uppercase tracking-widest mb-1.5 flex items-center"> <span className="text-lg">🤩</span> &nbsp; Prepared With Love For </p>
                      {form.clientName ? (
                        <>
                          <p className={cn(DISPLAY, "text-xl font-bold font-heading text-neutral-900 truncate")}>{form.clientName}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            <span className="text-[10px] font-semibold text-neutral-600 bg-neutral-50 px-2 py-0.5 rounded-full ring-1 ring-inset ring-neutral-200/80 shadow-sm shadow-neutral-200/80">
                              {form.adults} Adult{form.adults !== 1 ? "s" : ""}
                            </span>
                            {form.children > 0 && (
                              <span className="text-[10px] font-semibold text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-full">
                                {form.children} Child{form.children !== 1 ? "ren" : ""}
                              </span>
                            )}
                            {form.infants > 0 && (
                              <span className="text-[10px] font-semibold text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-full">
                                {form.infants} Infant{form.infants !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                          {form.queryId && (
                            <p className="text-[11px] text-neutral-500 mt-1.5 font-medium tracking-wide">
                              Ref: {refCode(form.queryId)}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-neutral-400 italic">—</p>
                      )}
                    </div>

                    {/* Your Travel Manager — the exec who built it */}
                    <div className="p-3.5">
                      <p className="text-[9px] font-bold text-neutral-700/90 uppercase tracking-widest mb-1.5">Your Travel Manager</p>
                      {form.execName ? (
                        <>
                          <p className={cn(DISPLAY, "text-xl font-bold font-heading text-neutral-900 truncate")}>
                            {form.execName}
                            {form.execDesignation && <span className="font-normal text-neutral-500"> · {form.execDesignation}</span>}
                          </p>
                          {form.execEmail && (
                            <a href={`mailto:${form.execEmail}`} className="flex items-center gap-1 text-neutral-700/90 text-[11px] mt-1.5 hover:underline w-fit">
                              <Mail size={16} className="text-neutral-400/90" /> {form.execEmail}
                            </a>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-neutral-400 italic">—</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Your Route — moved off the cover photo. Full width under the two
                  columns rather than a third column beside them: a route runs to
                  five or six chips and would have been squeezed into a third of
                  the card, wrapping into a stack of one-chip lines. */}
                <div className="border-t border-neutral-200/80 p-3.5">
                  <p className="text-[9px] font-bold text-neutral-500/90 uppercase tracking-widest mb-2">Your Route</p>
                  <RouteStrip form={form} steps={routeSteps} />
                </div>
              </div>
            )}

            <EditableText
              as="p"
              multiline
              value={form.description}
              field={{ scope: "package", key: "description" }}
              placeholder="Describe this package for the client — click to add…"
              className="block text-sm text-neutral-800 leading-relaxed"
            />

            <TicketsSection
              tickets={form.tickets}
              packagePax={{ adults: form.adults, children: form.children, infants: form.infants }}
            />

            <AddonsSection addOns={form.addOns} />

            <PackageAddMenu />

            <PlacesToVisit form={form} onImageChange={onImageChange} />

            <div className="space-y-3">
              <SectionHeader icon={Milestone} label="Detailed Itinerary" />
              <div className="space-y-3">
                {form.itineraries.map((d, i) => (
                  <DayCardPreview
                    key={d.day}
                    day={d}
                    allDays={form.itineraries}
                    adults={form.adults}
                    childCount={form.children}
                    travelDate={form.travelDate}
                    onImageChange={onImageChange}
                    onActivityCaptionChange={onActivityCaptionChange}
                    shiftedMeals={detailedShiftedMeals[i]}
                    addOns={form.addOns}
                    stayOptions={form.stayOptions}
                    stayEditing={stayEditing}
                    stayRun={stayRuns.find((r) => r.fromDay === d.day) ?? null}
                    stayContinues={stayRuns.some((r) => r.fromDay < d.day && d.day <= r.toDay)}
                    stayContinuesFrom={stayRuns.find((r) => r.fromDay < d.day && d.day <= r.toDay)?.fromDay}
                    stayContinuesNights={stayRuns.find((r) => r.fromDay < d.day && d.day <= r.toDay)?.nights}
                  />
                ))}
                <AddDayButton />
              </div>
            </div>

            <ItineraryMap
              startingPoint={form.startingPoint}
              stops={form.stops}
              flightsIncluded={transport.flightsIncluded}
              flightFrom={transport.flightFrom}
              flightTo={transport.flightTo}
              trainIncluded={transport.trainIncluded}
              trainFrom={transport.trainFrom}
              trainTo={transport.trainTo}
            />

            {/* ── What it covers, at a glance, then what it costs ──────────────
              The closing run of the document is deliberately ordered: what's
              included and excluded, then the trip condensed to one table, then
              the price. The number lands last, after the client has read
              everything it buys — rather than before the summary, where it was
              being quoted against a trip they hadn't finished reading. */}
            <div className="grid grid-cols-2 gap-4" style={{ breakInside: "avoid" }}>
              <div className="rounded-lg border border-neutral-200 overflow-hidden shadow-lg shadow-neutral-200/80 bg-white">
                {/* Same card chrome as the ticket/add-on cards above: a gradient
                  bar closed by a hairline, and a ringed icon tile. The tint is
                  emerald rather than primary because this pair is read as a
                  yes/no — the structure is shared, the colour still means
                  something. */}
                <div className="flex items-center gap-2 px-3 py-2 bg-linear-to-b from-emerald-50/60 via-emerald-50 to-emerald-100/80 border-b border-emerald-200/70">
                  <span className="flex items-center justify-center size-5 rounded-lg bg-white p-1 ring-1 ring-inset ring-emerald-200/80 shadow-sm shadow-emerald-200/80 shrink-0">
                    <CheckCircle size={16} color={DOC.positive} />
                  </span>
                  <h3 className={cn(DISPLAY, "text-[13px] font-semibold font-heading text-neutral-900")}>
                    Inclusions
                  </h3>
                </div>
                <EditablePolicyList
                  items={form.inclusions}
                  listKey="inclusions"
                  itemClassName="text-[11.5px] text-neutral-700/90"
                  marker={() => <CheckCircle size={12} color={DOC.positive} className="shrink-0 mt-0.5" />}
                />
              </div>
              <div className="rounded-lg border border-neutral-200 overflow-hidden shadow-lg shadow-neutral-200/80 bg-white">
                <div className="flex items-center gap-2 px-3 py-2 bg-linear-to-b from-primary-50/60 via-primary-50 to-primary-100/80 border-b border-primary-200/70">
                  <span className="flex items-center justify-center size-5 rounded-lg bg-white p-1 ring-1 ring-inset ring-primary-200/80 shadow-sm shadow-primary-200/80 shrink-0">
                    <XCircle size={16} color={DOC.accent} />
                  </span>
                  <h3 className={cn(DISPLAY, "text-[13px] font-semibold font-heading text-neutral-900")}>
                    Exclusions
                  </h3>
                </div>
                <EditablePolicyList
                  items={form.exclusions}
                  listKey="exclusions"
                  itemClassName="text-[11.5px] text-neutral-700/90"
                  marker={() => <XCircle size={12} color="#D98B7F" className="shrink-0 mt-0.5" />}
                />
              </div>
            </div>

            <div className="space-y-3">
              <SectionHeader icon={Calendar} label="Day-wise Summary" />
              <DaySummaryTable
                itineraries={form.itineraries}
                travelDate={form.travelDate}
                stops={form.stops}
                adults={form.adults}
                childCount={form.children}
              />
            </div>

            {/* Price summary — the document's second focal point after the hero.
              On the Tailwind gray ramp the rest of the document uses
              (neutral-800 → 950) rather than the warm near-black it carried
              from the old paper palette, which read as pasted in from another
              file.

              The decoration is inline SVG, not a background image: it has to
              survive the PDF, and html2canvas rasterises inline vector reliably
              while an image URL is one more asset that can lose its race with
              the capture. Two low-contrast passes only — texture that never
              competes with the number. */}
            <div
              className="relative rounded-lg overflow-hidden shadow-lg shadow-neutral-300/60"
              style={{ breakInside: "avoid" }}
            >
              <div className="relative p-5 bg-neutral-900 bg-linear-to-br from-neutral-800 via-neutral-900 to-neutral-950">
                {/* aria-hidden + pointer-events-none: this is texture, not
                    content, and must never be announced or swallow a click. */}
                <svg
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 h-full w-full"
                  preserveAspectRatio="none"
                  viewBox="0 0 400 120"
                >
                  <defs>
                    <linearGradient id="dy-price-fade" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.07" />
                      <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {/* Concentric arcs out of the top-right — the hero's wave
                      gesture, at a whisper. */}
                  <circle cx="368" cy="6" r="74" fill="url(#dy-price-fade)" />
                  <circle cx="368" cy="6" r="50" fill="none" stroke="#FFFFFF" strokeOpacity="0.06" strokeWidth="1" />
                  <circle cx="368" cy="6" r="98" fill="none" stroke="#FFFFFF" strokeOpacity="0.04" strokeWidth="1" />
                  <path d="M0 104 H150" stroke="#FFFFFF" strokeOpacity="0.05" strokeWidth="1" />
                </svg>

                <div className="relative">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="flex items-center justify-center size-5 rounded-lg bg-white/10 ring-1 ring-inset ring-white/15 shrink-0">
                      <IndianRupee size={12} color="#FFFFFF" />
                    </span>
                    <h2 className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-white/70">
                      Price Summary
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-[13px] text-white/90 font-medium">{paxLine}</p>
                      {perPersonStr && <p className="text-[11.5px] text-white/55">{perPersonStr}</p>}
                      {form.infants > 0 && (
                        <p className="text-[10px] text-white/45">Infant charges as applicable / on request</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-white/55 mb-1">Total package price</p>
                      {/* The saving stated plainly above the payable figure. A
                          struck-through number alone reads as a correction; the
                          badge says it is a concession. */}
                      {form.discount && (
                        <div className="flex items-center justify-end gap-2.5 mb-1.5 pr-1">
                          <span className="text-[13px] text-white/45 line-through">
                            {form.currency} {Math.round(form.discount.originalPrice).toLocaleString("en-IN")}
                          </span>
                          <SavingsBadge amount={form.discount.label} prefix="" />
                        </div>
                      )}
                      <p
                        className={cn(DISPLAY, "font-bold text-white leading-none font-heading")}
                        style={{ fontSize: "26px", letterSpacing: "-0.02em" }}
                      >
                        {priceStr}
                      </p>
                    </div>
                  </div>

                  {/* A price per standard, when the trip is quoted at more than
                      one. The recommended figure is the large one above; these
                      are the alternatives, on the same card rather than on a
                      page of their own, because the client is choosing between
                      them and a choice split across two pages is not one.
                      Absent entirely on a package quoted at one standard. */}
                  {(form.stayOptions?.length ?? 0) > 1 && (
                    <div className="mt-3 pt-3 grid gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.14)" }}>
                      <div className={cn(
                        "grid gap-2",
                        (form.stayOptions?.length ?? 0) === 2 ? "grid-cols-2" : "grid-cols-3",
                      )}>
                        {(form.stayOptions ?? []).map((c) => (
                          <div
                            key={c.id}
                            className="rounded-lg px-2.5 py-2"
                            style={{
                              backgroundColor: c.isRecommended ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.05)",
                              border: `1px solid ${c.isRecommended ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.10)"}`,
                            }}
                          >
                            <p className="flex items-center gap-1 text-[8.5px] font-bold uppercase tracking-widest text-white/60">
                              {c.label}
                              {c.isRecommended && (
                                <span className="rounded-full bg-white/85 px-1.5 py-px text-[7.5px] font-bold text-neutral-900">
                                  Recommended
                                </span>
                              )}
                            </p>
                            <p className={cn(DISPLAY, "font-bold text-white leading-tight font-heading mt-0.5")} style={{ fontSize: "15px" }}>
                              {/* Zero means no rate behind those nights yet,
                                  not a free stay — saying "on request" is the
                                  only honest reading, and printing 0 would
                                  make the unfinished column look cheapest. */}
                              {(c.totalPrice ?? 0) > 0
                                ? `${form.currency} ${Math.round(c.totalPrice!).toLocaleString("en-IN")}`
                                : "On request"}
                            </p>
                            {(c.pricePerPerson ?? 0) > 0 && (
                              <p className="text-[9.5px] text-white/55">
                                {form.currency} {Math.round(c.pricePerPerson!).toLocaleString("en-IN")} per person
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                      <p className="text-[9px] text-white/45">
                        The itinerary above is the same for every standard — only the hotels change.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* "Why book with us" stays a real card — it's the one marketing
              block here, and it earns colour. Everything below it is fine
              print and shares the quiet PolicyBlock treatment. */}
            {(form.travelBenefits.length > 0 || builderCanEdit) && (
              <div
                className="rounded-lg border border-neutral-200 overflow-hidden shadow-lg shadow-neutral-200/80 bg-white"
                style={{ breakInside: "avoid" }}
              >
                {/* The one marketing block on the page, so it earns a little
                    more than the plain card chrome: a tinted header that fades
                    into the sheet, and a faint sunburst behind the badge. Still
                    inline SVG for the same reason the price block is — it has
                    to come through the PDF capture. */}
                <div className="relative flex items-center gap-2 px-3 py-2.5 bg-linear-to-b from-primary-50/50 via-white to-white border-b border-neutral-200/80 overflow-hidden">
                  <svg
                    aria-hidden="true"
                    className="pointer-events-none absolute -left-3 -top-6 size-20 text-primary-200/40"
                    viewBox="0 0 100 100"
                    fill="none"
                  >
                    <circle cx="50" cy="50" r="30" stroke="currentColor" strokeWidth="1" />
                    <circle cx="50" cy="50" r="44" stroke="currentColor" strokeWidth="1" />
                  </svg>
                  <span className="relative flex items-center justify-center size-6 rounded-lg bg-white p-1 ring-1 ring-inset ring-primary-200/80 shadow-sm shadow-primary-200/80 shrink-0">
                    <Sparkles size={16} className="text-primary-500" />
                  </span>
                  <h3 className={cn(DISPLAY, "relative text-[13px] font-semibold font-heading text-neutral-900")}>
                    Why book with us
                  </h3>
                </div>
                <EditablePolicyList
                  items={form.travelBenefits}
                  listKey="travelBenefits"
                  // pt-3.5 is the ask: the list sat hard against the header rule
                  // with only the marker's own margin holding it off.
                  itemClassName="!p-0 !px-4 !pt-3.5 !pb-3.5 text-[11px] space-y-1.5 text-neutral-700/90"
                  marker={() => (
                    <span
                      className="mt-1.5 size-1 rounded-full shrink-0 ring-2 ring-primary-100"
                      style={{ backgroundColor: DOC.accent }}
                    />
                  )}
                />
              </div>
            )}

            {/* No outer emptiness check: each block decides for itself, so a
              package with no payment policy yet still offers a way to add one
              while editing and still renders nothing for the client. */}
            <div className="flex flex-col gap-5" style={{ breakInside: "avoid" }}>
              <PolicyBlock label="Terms & Conditions" items={form.termsConditions} listKey="termsConditions" />
              <PolicyBlock label="Payment Policy" items={form.paymentPolicy} listKey="paymentPolicy" />
              <PolicyBlock label="Amendment Policy" items={form.amendmentPolicy} listKey="amendmentPolicy" />
            </div>

            {(form.customPolicySections ?? []).filter((s) => s.items.length > 0).map((section) => (
              <PolicyBlock key={section.id} label={section.title} items={section.items} />
            ))}

            {/* Free text rather than a list, so it edits in place. Hidden
              entirely on the client's copy when empty. */}
            {form.termsNotes.trim()
              ? <TermsAndConditions text={form.termsNotes} />
              : (
                <EditableText
                  as="p"
                  multiline
                  value={form.termsNotes}
                  field={{ scope: "package", key: "termsNotes" }}
                  placeholder="Additional terms or notes for this package — click to add…"
                  className="block text-[11px] leading-relaxed text-neutral-800"
                />
              )}

            <div className="h-2" />
          </main>

          {/* ── Footer ────────────────────────────────────────────────────────── */}
          <DocumentFooter form={form} />
        </div>
      </div>
    </DocThemeProvider>
  );
}