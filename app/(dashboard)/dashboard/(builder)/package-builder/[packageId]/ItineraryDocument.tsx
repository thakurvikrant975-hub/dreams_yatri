"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Calendar, Hotel, Car, Utensils, CheckCircle, XCircle,
  IndianRupee, Users, MapPin, Info, LogIn, LogOut,
  Plane, TrainFront, Helicopter, Sparkles, Phone, Mail, Upload, Loader2, Pencil, Image as ImageIcon,
  Coffee, Soup, UtensilsCrossed, Compass, Moon, Milestone, ArrowRight, Gift, Plus,
  StickyNote, AlertTriangle, AlertOctagon, ChevronDown, CalendarPlus, Lock, MoonStar,
} from "lucide-react";
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
import { planRoomOccupancy } from "@/app/lib/room-capacity";
import { continuesStayFrom } from "./day-mutations";
import { EditableText } from "./EditableText";
import { useOptionalBuilder, type PolicyListKey } from "./builder-context";
import { EditablePolicyList } from "./EditablePolicyList";
import { DayActionsMenu, DaySectionsBar } from "./DayActionsMenu";

// Re-exported for existing consumers (e.g. CustomPackageHero) that import it
// from here — the implementation itself lives in route-builder-utils since
// it's a plain function server components need too (see hotel-requests).
export { deriveDayLocations };

// ─────────────────────────────────────────────────────────────────────────────
// Document design tokens
// ─────────────────────────────────────────────────────────────────────────────

/** The printed document's palette, as literal hex rather than Tailwind theme
 * classes. Two reasons this can't just use `bg-primary-600` and friends:
 *
 *  1. html2canvas-pro (the PDF export path) can't reliably resolve this app's
 *     oklch() theme tokens — the same limitation already documented on
 *     SectionHeader's icon colour below, which this centralises.
 *  2. The document is a *printed* artefact, not a screen surface. It wants a
 *     warm paper ground rather than the UI's pure #fff, so it deliberately
 *     doesn't inherit the dashboard's neutral ramp.
 *
 * `accent` is this app's established rgb fallback for --color-primary-600
 * (see the .prose-editor/.prose-article rules in globals.css). */
const DOC = {
  /** Warm off-white page ground — reads as paper stock, not screen. */
  paper: "#FDFBF7",
  /** Pure white, reserved for cards that should lift off the paper. */
  card: "#FFFFFF",
  ink: "#191817",
  inkSoft: "#57534E",
  inkMuted: "#8C857D",
  /** Warm hairline, tuned to sit on `paper` without going grey-blue. */
  rule: "#E9E3DA",
  accent: "#c0392b",
  accentSoft: "#FBF1EF",
  /** Secondary accent for the "included / confirmed" tone. */
  positive: "#059669",
} as const;

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

export type NoteTone = "neutral" | "info" | "success" | "warning" | "error";

export const NOTE_TONES: Record<NoteTone, {
  label: string; bg: string; border: string; ink: string; icon: string;
}> = {
  neutral: { label: "Note",    bg: "#F6F3EE", border: "#E4DDD2", ink: "#57534E", icon: "#8C857D" },
  info:    { label: "Info",    bg: "#EEF4FC", border: "#CBDDF5", ink: "#1E4E8C", icon: "#2F6FBF" },
  success: { label: "Good",    bg: "#ECF7F1", border: "#C6E6D6", ink: "#12634A", icon: "#0F8A5F" },
  warning: { label: "Heads up",bg: "#FDF4E7", border: "#F2DEBE", ink: "#8A5A16", icon: "#C07E1E" },
  error:   { label: "Important", bg: "#FDEEEC", border: "#F5CFC9", ink: "#9B2C1E", icon: "#C0392B" },
};

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
            "no-print absolute z-20 flex items-center justify-center rounded-full bg-black/55 hover:bg-black/75 text-white opacity-0 group-hover:opacity-100 transition-opacity",
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

/** Day N's actual calendar date — Day 1 is the travel date itself, Day 2 is
 * travel date + 1, etc. Same offset the pricing engine uses to pick
 * season/weekend rates per day (package-pricing.service.ts), just surfaced
 * here for display. Null when there's no travel date to anchor to yet. */
function dayCalendarDate(travelDate: string, dayNumber: number): Date | null {
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
import type { DayItinerary, ActivityInput, StopInput, TicketInput, AddonInput } from "../action";
import { deriveTransportFields } from "@/app/lib/deriveTicketTransport";

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
  /** Company-wide header/footer content from /dashboard/itinerary-settings —
   * optional so callers that haven't fetched it yet fall back to the
   * hardcoded defaults below rather than rendering blank contact info. */
  companySettings?: {
    phone: string;
    email: string;
    address: string;
    description: string;
    disclaimer: string;
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
  if (tone === "muted" || !Icon) {
    return (
      <div className="flex items-center gap-2.5" style={{ breakAfter: "avoid" }}>
        <h2
          className="text-[10px] font-semibold uppercase tracking-[0.16em] whitespace-nowrap"
          style={{ color: DOC.inkMuted }}
        >
          {label}
        </h2>
        <span className="h-px flex-1" style={{ backgroundColor: DOC.rule }} />
      </div>
    );
  }

  const iconColor = tone === "emerald" ? DOC.positive : DOC.accent;
  const badgeBg = tone === "emerald" ? "#E8F6F1" : DOC.accentSoft;
  return (
    <div className="flex items-center gap-2.5" style={{ breakAfter: "avoid" }}>
      <span
        className="flex items-center justify-center size-7 rounded-full shrink-0"
        style={{ backgroundColor: badgeBg }}
      >
        <Icon size={14} color={iconColor} />
      </span>
      <h2
        className={cn(DISPLAY, "text-[16px] font-semibold whitespace-nowrap")}
        style={{ color: DOC.ink, letterSpacing: "-0.01em" }}
      >
        {label}
      </h2>
      <span className="h-px flex-1" style={{ backgroundColor: DOC.rule }} />
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
          <span
            title="Company-wide content — edited in Itinerary Settings"
            className="builder-only no-print shrink-0 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider"
            style={{ color: DOC.inkMuted }}
          >
            <Lock size={9} /> Company-wide
          </span>
        )}
      </div>
      {listKey ? (
        <EditablePolicyList
          items={items}
          listKey={listKey}
          itemClassName="text-[11px] pl-0.5 !p-0 space-y-1.5"
          style={{ color: DOC.inkSoft }}
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
  const builder = useOptionalBuilder();
  const canEdit = !!builder?.canEdit;
  const title = (day.notesTitle ?? "").trim();
  const body = day.notes.trim();
  if (!title && !body) return null;

  const tone = noteTone(day.notesType);
  const t = NOTE_TONES[tone];
  const Icon = NOTE_TONE_ICONS[tone];

  return (
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
            {canEdit && (
              <CardEditButton
                label={`Edit note for day ${day.day}`}
                onEdit={() => builder!.openDrawer({ kind: "note-edit", day: day.day })}
              />
            )}
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
  );
}

/** A day's running cost, shown beside its number. */
/** Wraps an editable block in the day so it outlines on hover and reveals its
 * controls — the "this is editable, and here's how" affordance that a
 * document-as-editor needs and that a static document must not show.
 *
 * The outline is `outline`, not `border`: a border would shift the block's
 * layout by a pixel on hover, which on a paginated A4 document can push
 * content across a page boundary while you're pointing at it. */
function EditableSection({ onEdit, children }: {
  onEdit?: () => void;
  children: React.ReactNode;
}) {
  if (!onEdit) return <>{children}</>;
  return (
    <div
      className="group/section relative -mx-1.5 px-1.5 py-1 rounded-lg transition-[outline-color] outline outline-2 outline-transparent hover:outline-dashboard-primary/25"
      style={{ breakInside: "avoid" }}
    >
      {children}
    </div>
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
  const inner = (
    <>
      <Icon size={11} color={DOC.accent} className="shrink-0" />
      <span
        className="text-[9.5px] font-semibold uppercase tracking-[0.14em] shrink-0"
        style={{ color: DOC.accent }}
      >
        {label}
      </span>
      {meta && (
        <span className="text-[10px] truncate min-w-0" style={{ color: DOC.inkMuted }}>
          {meta}
        </span>
      )}
      <span className="h-px flex-1" style={{ backgroundColor: DOC.rule }} />
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
    <button
      type="button"
      onClick={onEdit}
      title={`Edit ${label.toLowerCase()}`}
      className="group/sub flex w-full items-center gap-2 text-left rounded-[3px] hover:bg-dashboard-primary/6 focus-visible:outline-2 focus-visible:outline-dashboard-primary/60"
      style={{ breakAfter: "avoid" }}
    >
      {inner}
    </button>
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
  if (!activity.title.trim()) return null;
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
        <span className="flex items-center justify-center size-5 rounded-full bg-primary-100 text-primary-600 shrink-0 mt-0.5">
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
                className="block text-xs font-semibold text-neutral-800"
              />
              <EditableText
                as="p"
                multiline
                value={activity.description}
                field={{ scope: "activity", day: dayNumber, index: activityIndex, key: "description" }}
                placeholder="Describe this experience…"
                className="block text-xs text-neutral-500 mt-0.5"
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
              <div key={i} className="group relative rounded-lg overflow-hidden">
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
              className="flex-1 flex items-center justify-between gap-1 px-2 py-1.5 rounded-lg border text-[11px] font-medium bg-emerald-50/60 border-emerald-200 text-neutral-700"
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
    <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden" style={{ breakInside: "avoid" }}>
      <div className="flex items-center gap-2 px-4 py-3 bg-neutral-50 border-b border-neutral-100">
        <span className="flex items-center justify-center size-6 rounded-lg bg-neutral-100 shrink-0">
          <Info size={13} className="text-neutral-500" />
        </span>
        <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-600">Additional Notes</h3>
      </div>
      <div className="p-4 space-y-3.5">
        {blocks.map((block, i) => (
          <div key={i} className="space-y-1.5">
            {block.title && (
              <p className="text-xs font-bold text-neutral-800">{block.title}</p>
            )}
            {block.isList ? (
              <ul className="space-y-1">
                {block.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-2 text-xs text-neutral-600 leading-relaxed">
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
export function DaySummaryTable({
  itineraries, travelDate, stops = [],
}: {
  itineraries: DayItinerary[];
  travelDate?: string;
  /** Route stops — used to derive which city each day is in when the day's
   * own hotel doesn't have a location on file yet. */
  stops?: StopInput[];
}) {
  const shiftedMeals = computeShiftedMeals(itineraries);
  const dayLocations = deriveDayLocations(stops, itineraries.length);
  return (
    // No breakInside:avoid on this outer wrapper: for a long itinerary, the
    // WHOLE table would then be one indivisible unit taller than a single
    // page, which forces the browser to ignore the hint and split it at an
    // arbitrary point anyway (mid-row). Instead each <tr> below is protected
    // individually, so the table breaks cleanly between days — with the
    // header row repeating on each new page, standard table pagination.
    <div className="rounded-xl border border-neutral-200 overflow-hidden">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="bg-primary-50/70 text-primary-700/80 uppercase tracking-wide text-[9px]" style={{ breakInside: "avoid" }}>
            <th className="text-left px-3 py-2.5 font-bold">Day</th>
            <th className="text-left px-3 py-2.5 font-bold">Destination</th>
            <th className="text-left px-3 py-2.5 font-bold">Hotel</th>
            <th className="text-left px-3 py-2.5 font-bold">Meals</th>
            <th className="text-left px-3 py-2.5 font-bold">Cab</th>
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
            return (
            <tr key={d.day} className={`border-t border-neutral-100 ${i % 2 === 1 ? "bg-neutral-50/60" : ""}`} style={{ breakInside: "avoid" }}>
              <td className="px-3 py-2 font-semibold text-neutral-700 whitespace-nowrap">
                Day {d.day}
                {date && (
                  <span className="block font-normal text-neutral-400 text-[10px]">
                    {formatShortDate(date)}
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-neutral-600">
                {destination ? titleCase(destination) : "—"}
                {isLastDay && d.transportDrop && (
                  <span className="block text-[10px] text-neutral-400">Drop: {titleCase(d.transportDrop)}</span>
                )}
              </td>
              <td className="px-3 py-2 text-neutral-600">{d.accommodation || "—"}</td>
              <td className="px-3 py-2 text-neutral-600">{shiftedMeals[i].length > 0 ? shiftedMeals[i].join(", ") : "—"}</td>
              <td className="px-3 py-2 text-neutral-600">{d.transport || d.transportVehicleType || "—"}</td>
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

function StopTile({
  stop, img, onImageChange, stopIndex,
}: {
  stop: StopInput;
  img: string | null;
  onImageChange?: OnImageChange;
  stopIndex: number;
}) {
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
    <div className="group relative flex-1 min-w-0">
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary external/catalog/AI-sourced URL, not a static app asset
        <img src={img} alt={stop.name} className="w-full h-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <div className="w-full h-full bg-linear-to-br from-primary-500 to-primary-700 flex items-center justify-center">
          <MapPin size={22} className="text-white/70" />
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/30 to-transparent px-2.5 py-2 pt-8">
        <p className="text-white text-xs font-bold truncate leading-tight">{stop.name ? titleCase(stop.name) : "—"}</p>
        <p className="text-white/75 text-[10px] font-medium">{stop.nights} Night{stop.nights !== 1 ? "s" : ""}</p>
      </div>
      {onImageChange && (
        <ImageEditButton
          value={img ?? ""}
          onChange={(url) => onImageChange({ kind: "stop", stopIndex }, url)}
          dialogTitle={`${stop.name ? titleCase(stop.name) : "Stop"} Photo`}
          className="top-1.5 right-1.5 size-6"
        />
      )}
    </div>
  );
}

function PlacesToVisit({ form, onImageChange }: { form: PreviewData; onImageChange?: OnImageChange }) {
  if (form.stops.length === 0) return null;
  const dayLocations = deriveDayLocations(form.stops, form.itineraries.length);
  const packageFallback = form.coverImage
    || form.itineraries.find((d) => d.accommodationPhoto)?.accommodationPhoto
    || null;

  return (
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
const TICKET_TYPE_ICONS: Record<TicketInput["type"], typeof Plane> = {
  FLIGHT: Plane, TRAIN: TrainFront, HELICOPTER: Helicopter,
};
const TICKET_PROVIDER_FALLBACKS: Record<TicketInput["type"], string> = {
  FLIGHT: "Airline TBD", TRAIN: "Train TBD", HELICOPTER: "Operator TBD",
};

const TICKET_TYPE_LABEL: Record<TicketInput["type"], string> = {
  FLIGHT: "Flight", TRAIN: "Train", HELICOPTER: "Helicopter",
};

function TicketCard({ ticket, packagePax }: { ticket: TicketInput; packagePax?: PackagePax }) {
  const builder = useOptionalBuilder();
  const Icon = TICKET_TYPE_ICONS[ticket.type];
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

  return (
    <div className="rounded-xl border border-neutral-200 overflow-hidden" style={{ breakInside: "avoid" }}>
      {/* Header — carrier + travel date */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-primary-50/70 border-b border-primary-100">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex items-center justify-center size-5 rounded-lg bg-primary-100 shrink-0">
            <Icon size={11} className="text-primary-600" />
          </span>
          <p className="text-xs font-semibold text-neutral-800 truncate">
            {ticket.provider || TICKET_PROVIDER_FALLBACKS[ticket.type]}
            {ticket.ticketNumber && <span className="font-normal text-neutral-500"> · {ticket.ticketNumber}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {ticket.travelDate && (
            <span className="text-[10px] font-semibold text-primary-700">{formatTicketDate(ticket.travelDate)}</span>
          )}
          {builder?.canEdit && (
            <CardEditButton
              label={`Edit ${TICKET_TYPE_LABEL[ticket.type].toLowerCase()} leg`}
              onEdit={() => builder.openDrawer({ kind: "tickets-edit" })}
            />
          )}
        </div>
      </div>

      {/* Route */}
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-neutral-800 truncate">{ticket.fromPlace || "—"}</p>
            {ticket.departureTime && <p className="text-[11px] text-neutral-500">{formatTime12h(ticket.departureTime)}</p>}
          </div>
          <div className="flex flex-col items-center gap-1 shrink-0 px-1">
            <Icon size={11} className="text-primary-400" />
            <div className="w-12 border-t border-dotted border-neutral-300" />
            {ticket.durationText && (
              <span className="text-[9px] text-neutral-400 font-medium whitespace-nowrap">{ticket.durationText}</span>
            )}
          </div>
          <div className="flex-1 min-w-0 text-right">
            <p className="text-sm font-bold text-neutral-800 truncate">{ticket.toPlace || "—"}</p>
            {ticket.arrivalTime && <p className="text-[11px] text-neutral-500">{formatTime12h(ticket.arrivalTime)}</p>}
          </div>
        </div>

        {footerLine && (
          <p className="text-[11px] text-neutral-500 flex items-center gap-1 pt-1.5 border-t border-neutral-100">
            <Users size={10} className="text-neutral-400 shrink-0" /> {footerLine}
          </p>
        )}

        {ticket.notes && <p className="text-[11px] text-neutral-400 italic">{ticket.notes}</p>}
      </div>
    </div>
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
  const flights = tickets.filter((t) => t.type === "FLIGHT");
  const trains = tickets.filter((t) => t.type === "TRAIN");
  const helicopters = tickets.filter((t) => t.type === "HELICOPTER");
  if (flights.length === 0 && trains.length === 0 && helicopters.length === 0) return null;

  return (
    <>
      {flights.length > 0 && (
        <div className="space-y-3" style={{ breakInside: "avoid" }}>
          <SectionHeader icon={Plane} label="Flight Details" />
          <div className="grid gap-3">
            {flights.map((t, i) => <TicketCard key={t.id ?? i} ticket={t} packagePax={packagePax} />)}
          </div>
        </div>
      )}
      {trains.length > 0 && (
        <div className="space-y-3" style={{ breakInside: "avoid" }}>
          <SectionHeader icon={TrainFront} label="Train Details" />
          <div className="grid gap-3">
            {trains.map((t, i) => <TicketCard key={t.id ?? i} ticket={t} packagePax={packagePax} />)}
          </div>
        </div>
      )}
      {helicopters.length > 0 && (
        <div className="space-y-3" style={{ breakInside: "avoid" }}>
          <SectionHeader icon={Helicopter} label="Helicopter Details" />
          <div className="grid gap-3">
            {helicopters.map((t, i) => <TicketCard key={t.id ?? i} ticket={t} packagePax={packagePax} />)}
          </div>
        </div>
      )}
    </>
  );
}

/** One add-on tile, shown as what's-included only — never the per-unit price
 * (same convention as TicketCard hiding fare), since the cost is already
 * folded into the package total the client sees on the Price Summary card. */
function AddonCard({ addon }: { addon: AddonInput }) {
  const builder = useOptionalBuilder();
  return (
    <div className="rounded-xl border border-rose-100 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-rose-50/70 border-b border-rose-100">
        <span className="flex items-center justify-center size-5 rounded-lg bg-rose-100 shrink-0">
          <Gift size={11} className="text-rose-600" />
        </span>
        <p className="text-xs font-semibold text-neutral-800 truncate flex-1">
          {addon.name}{addon.quantity > 1 ? ` × ${addon.quantity}` : ""}
        </p>
        {builder?.canEdit && (
          <CardEditButton
            label={`Edit add-on: ${addon.name}`}
            onEdit={() => builder.openDrawer({ kind: "addons-edit", day: addon.day ?? null })}
          />
        )}
      </div>
      {addon.notes && (
        <p className="p-3 text-[11px] text-neutral-500 leading-relaxed">{addon.notes}</p>
      )}
    </div>
  );
}

/** General add-ons (day: null) — added from the Package Details tab rather
 * than a specific day's hotel, so they aren't tied to any one Day card and
 * are shown here instead, up top with Flight/Train details. */
export function AddonsSection({ addOns }: { addOns?: AddonInput[] }) {
  const items = (addOns ?? []).filter((a) => a.name.trim() && a.day == null);
  if (items.length === 0) return null;

  return (
    <div className="space-y-3" style={{ breakInside: "avoid" }}>
      <SectionHeader icon={Gift} label="Add-ons Included" />
      <div className="grid grid-cols-2 gap-3">
        {items.map((a, i) => <AddonCard key={i} addon={a} />)}
      </div>
    </div>
  );
}

/** The shared look for a full-width "add something" control in the document.
 * Both users of it are builder-only and sit in the document's own flow, so
 * they read as part of the page rather than as toolbar chrome bolted on. */
const ADD_CONTROL_CLASS =
  "builder-only no-print w-full flex items-center justify-center gap-1.5 rounded-lg " +
  "border border-dashed px-3 py-2.5 text-[11px] font-medium transition-colors " +
  "hover:bg-dashboard-primary/6";

/** Appends a day to the end of the itinerary.
 *
 * The per-day menu can already insert after any given day, but appending is
 * the common case by far and having to open day N's menu to get day N+1 reads
 * backwards — the action belongs at the end of the list, where the new day
 * will actually appear. */
function AddDayButton() {
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
  const builder = useOptionalBuilder();
  if (!builder?.canEdit) return null;

  const items: { icon: React.ElementType; label: string; onSelect: () => void }[] = [
    { icon: Plane, label: "Flight", onSelect: () => builder.openDrawer({ kind: "tickets-edit" }) },
    { icon: TrainFront, label: "Train", onSelect: () => builder.openDrawer({ kind: "tickets-edit" }) },
    { icon: Helicopter, label: "Helicopter", onSelect: () => builder.openDrawer({ kind: "tickets-edit" }) },
    { icon: Gift, label: "Add-on", onSelect: () => builder.openDrawer({ kind: "addons-edit", day: null }) },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={ADD_CONTROL_CLASS}
          style={{ borderColor: DOC.rule, color: DOC.accent }}
        >
          <Plus size={12} /> Add flight, train, helicopter or add-on
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

/** Opens the drawer that owns an already-created element. Sits on the card
 * itself, so the way to change a ticket is to click the ticket. */
function CardEditButton({ onEdit, label }: { onEdit: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={label}
      title={label}
      className="builder-only no-print shrink-0 flex items-center gap-1 rounded-md border border-dashed px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider transition-colors hover:bg-dashboard-primary/6"
      style={{ borderColor: DOC.rule, color: DOC.accent }}
    >
      <Pencil size={9} /> Edit
    </button>
  );
}

/** Add-ons tied to one specific day — rendered inline under that day's Hotel
 * section (see DayCardPreview) rather than in the general AddonsSection. */
function DayAddonsSection({ addOns, day }: { addOns: AddonInput[]; day: number }) {
  const items = addOns.filter((a) => a.name.trim() && a.day === day);
  if (items.length === 0) return null;

  return (
    <div className="space-y-2" style={{ breakInside: "avoid" }}>
      <div className="flex items-center gap-2 px-1">
        <Gift size={11} className="text-rose-500 shrink-0" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-rose-600">Add-ons Included</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map((a, i) => <AddonCard key={i} addon={a} />)}
      </div>
    </div>
  );
}

function DayCardPreview({
  day, allDays, adults, childCount, travelDate, onImageChange, onActivityCaptionChange, shiftedMeals, addOns,
}: {
  day: DayItinerary;
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
  // Null on the public client-facing page, which renders this same component
  // without a builder around it — that's what keeps every edit affordance
  // below out of the client's copy.
  const builder = useOptionalBuilder();
  // Keeps each activity's original index (for onImageChange targeting) even
  // though blank ones are filtered out of what's actually rendered.
  const activities = day.activities
    .map((a, originalIndex) => ({ a, originalIndex }))
    .filter(({ a }) => a.title.trim());
  const hasHotel = day.accommodation || day.hotelCheckIn || day.hotelCheckOut || day.hotelMealPlan;
  // Check-in lands on this day's own date; check-out is the following
  // morning — same "shifted" convention the meal algorithm uses, since a
  // day's hotel is the one you sleep in that night and leave the next day.
  const checkInDate = dayCalendarDate(travelDate, day.day);
  const checkOutDate = dayCalendarDate(travelDate, day.day + 1);
  const mealText = mealIncludedText(day.hotelMealPlan);
  const hasPhotos = day.accommodationPhoto || day.accommodationRoomPhotos.length > 0 || !!onImageChange;
  // One place each section's "open my drawer" lives, so the hover wrapper and
  // the marker's own Edit button can't drift to different targets.
  const canEditDoc = !!builder?.canEdit;
  // Night 2+ of a multi-night stay — see stayRun/continuesStayFrom. Null when
  // this day starts its stay, or has no catalog room at all.
  const continuesFrom = continuesStayFrom(allDays, day.day);
  const stayEdit = canEditDoc
    ? () => builder!.openDrawer(day.hotelPending
        ? { kind: "hotel-request", day: day.day }
        : { kind: "hotel-edit", day: day.day })
    : undefined;
  const transportEdit = canEditDoc
    ? () => builder!.openDrawer({ kind: "transfer-edit", day: day.day })
    : undefined;
  const mealsEdit = canEditDoc
    ? () => builder!.openDrawer({ kind: "meals-edit", day: day.day })
    : undefined;
  const activitiesEdit = canEditDoc
    ? () => builder!.openDrawer({ kind: "activities-edit", day: day.day })
    : undefined;
  const extraRooms = (day.extraRooms ?? []).filter((r) => r.roomPricingId > 0);
  const extraCabs = (day.extraCabs ?? []).filter((c) => c.label.trim());

  return (
    <div
      // Scroll target for the day rail — see jumpToDay in DayLayersRail.
      id={`builder-day-${day.day}`}
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: DOC.card, border: `1px solid ${DOC.rule}` }}
    >
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
        className="flex items-baseline gap-3.5 px-4 pt-3.5 pb-3"
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
            className={cn(DISPLAY, "block text-[15px] font-semibold leading-tight")}
            style={{ color: DOC.ink, letterSpacing: "-0.01em" }}
          />
          <p className="text-[10.5px] mt-0.5" style={{ color: DOC.inkMuted }}>
            Day {day.day}{checkInDate && ` · ${formatShortDate(checkInDate)}`}
          </p>
        </div>

        {/* One menu for everything this day can gain or lose — replaces the
            three separate dashed "Add …" rows, which appeared and vanished
            depending on what the day already had and pushed the document's
            own layout around as it filled up. */}
        {builder?.canEdit && (
          <div className="shrink-0 self-center">
            <DayActionsMenu
              day={day.day}
              hasAddons={(addOns ?? []).some((a) => a.day === day.day)}
              hasNote={!!day.notes.trim()}
            />
          </div>
        )}
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
          className="block text-xs text-neutral-600 leading-relaxed"
        />

        {/* A day with no stay yet. Only ever rendered in the builder, where a
            blank gap is a dead end — the client's copy simply omits the
            section, exactly as before. */}

        {/* Hotel info */}
        {hasHotel && (
          <EditableSection onEdit={stayEdit}>
          {continuesFrom != null ? (
            // Night 2+ of the same stay: the client already read the hotel's
            // details on the night it started, so repeating them is noise.
            // One line saying where they are and that nothing has changed.
            <div className="space-y-2" style={{ breakInside: "avoid" }}>
              <DaySubHead icon={Hotel} label="Stay" onEdit={stayEdit} />
              <div
                className={cn("flex items-center gap-2 rounded-lg px-3 py-2", SUBHEAD_INDENT)}
                style={{ backgroundColor: DOC.paper, border: `1px solid ${DOC.rule}` }}
              >
                <MoonStar size={12} color={DOC.accent} className="shrink-0" />
                <p className="text-[11.5px] flex-1 min-w-0" style={{ color: DOC.inkSoft }}>
                  <span className="font-semibold" style={{ color: DOC.ink }}>
                    {day.accommodation}
                  </span>
                  {" — continuing from day "}{continuesFrom}
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
              onEdit={stayEdit}
            />
            <div className={cn("flex gap-3", SUBHEAD_INDENT)}>
              <div className="flex-1 min-w-0 space-y-1.5">
                <p className={cn(DISPLAY, "text-[12.5px] font-semibold")} style={{ color: DOC.ink }}>
                  {day.accommodation || "Hotel (TBD)"}
                </p>

                {day.accommodationLocation && (
                  <p className="text-[11px] text-neutral-500 flex items-center gap-1">
                    <MapPin size={10} className="text-neutral-400 shrink-0" /> {day.accommodationLocation}
                  </p>
                )}

                <p className="text-[11px] text-neutral-500 flex items-center gap-1">
                  <Users size={10} className="text-neutral-400 shrink-0" />
                  {occupancyText(day, adults, childCount)}
                </p>

                {(day.hotelCheckIn || day.hotelCheckOut || checkInDate) && (
                  <div className="flex items-center gap-2 pt-1">
                    <div className="flex flex-col items-center gap-0.5 shrink-0">
                      <LogIn size={12} className="text-primary-500" />
                      <span className="text-[8px] text-neutral-400 font-medium uppercase tracking-wide">Check-in</span>
                      <span className="text-[11px] font-semibold text-neutral-700">{day.hotelCheckIn ? formatTime12h(day.hotelCheckIn) : "—"}</span>
                      {checkInDate && <span className="text-[9px] text-neutral-400">{formatShortDate(checkInDate)}</span>}
                    </div>
                    <div className="flex-1 self-center" style={{ borderTop: `1px dashed ${DOC.rule}` }} />
                    <div className="flex flex-col items-center gap-0.5 shrink-0">
                      <LogOut size={12} className="text-primary-500" />
                      <span className="text-[8px] text-neutral-400 font-medium uppercase tracking-wide">Check-out</span>
                      <span className="text-[11px] font-semibold text-neutral-700">{day.hotelCheckOut ? formatTime12h(day.hotelCheckOut) : "—"}</span>
                      {checkOutDate && <span className="text-[9px] text-neutral-400">{formatShortDate(checkOutDate)}</span>}
                    </div>
                  </div>
                )}

                {day.accommodationRoomSpecs && (
                  <p className="text-[11px] text-neutral-500">({day.accommodationRoomSpecs})</p>
                )}

                {mealText && (
                  <p className="text-[11px] text-neutral-500 flex items-center gap-1">
                    <Utensils size={10} className="text-primary-400 shrink-0" /> {mealText}
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
                <div className="w-40 shrink-0 space-y-1">
                  {(day.accommodationPhoto || onImageChange) && (
                    <div className="group relative">
                      {day.accommodationPhoto ? (
                        /* eslint-disable-next-line @next/next/no-img-element -- arbitrary catalog URL, not a static app asset */
                        <img src={day.accommodationPhoto} alt="Hotel" className="w-40 h-24 rounded-lg object-cover" />
                      ) : (
                        <div className="w-40 h-24 rounded-lg border-2 border-dashed border-neutral-200 bg-neutral-50 flex items-center justify-center">
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
                  {day.accommodationRoomPhotos.length > 0 && (
                    <div className="grid grid-cols-2 gap-1">
                      {day.accommodationRoomPhotos.slice(0, 2).map((src, i) => (
                        <div key={i} className="group relative">
                          {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary catalog URL, not a static app asset */}
                          <img src={src} alt={`Room ${i + 1}`} className="h-14 w-full rounded-md object-cover" />
                          {onImageChange && (
                            <ImageEditButton
                              value={src}
                              onChange={(url) => onImageChange({ kind: "roomPhoto", day: day.day, photoIndex: i }, url)}
                              dialogTitle={`Room Photo ${i + 1}`}
                              className="top-0.5 right-0.5 size-5"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          )}
          </EditableSection>
        )}

        <DayAddonsSection addOns={addOns ?? []} day={day.day} />

        {/* Add-affordances for an empty day. Builder-only in every sense:
            gated on canEdit, marked builder-only so they can't reach the PDF,
            and absent entirely from the client-facing document. */}

        {/* Transport */}
        {(day.transport || day.transportPickup || day.transportDrop) && (
          <EditableSection onEdit={transportEdit}>
          <div className="space-y-2" style={{ breakInside: "avoid" }}>
            <DaySubHead
              icon={Car}
              label="Transport"
              onEdit={transportEdit}
              meta={[
                day.transportDistanceKm ? `${day.transportDistanceKm} km` : null,
                day.transportTravelTime || null,
                day.transportPickup && day.transportDrop ? `${day.transportPickup} → ${day.transportDrop}` : null,
              ].filter(Boolean).join(" · ") || null}
            />

            <div className={cn("flex gap-3", SUBHEAD_INDENT)}>
              <div className="flex-1 min-w-0 space-y-2">
                {day.transport && (
                  <p className="text-sm font-semibold text-neutral-800">
                    {day.cabQuantity && day.cabQuantity > 1 ? `${day.cabQuantity}× ` : ""}
                    {day.transport}
                    {day.transportVehicleType && <span className="font-normal text-neutral-500"> · {day.transportVehicleType}</span>}
                    {day.transportSeats && <span className="font-normal text-neutral-500"> · {day.transportSeats} Seats</span>}
                  </p>
                )}

                {(day.transportPickup || day.transportDrop) && (
                  <div className="flex gap-2.5">
                    <div className="flex flex-col items-center">
                      <MapPin size={13} className="text-neutral-400 shrink-0" />
                      <span className="w-0.5 flex-1 min-h-6 bg-primary-200 my-1" />
                      <MapPin size={13} className="text-neutral-400 shrink-0" />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-between text-xs py-0.5">
                      <p className="text-neutral-500">
                        Pickup Point: <span className="font-semibold text-neutral-800">{day.transportPickup || "—"}</span>
                      </p>
                      {(day.transportDistanceKm || day.transportTravelTime) && (
                        <p className="text-[11px] text-neutral-400 py-1">
                          {[
                            day.transportDistanceKm ? `${day.transportDistanceKm} km` : null,
                            day.transportTravelTime || null,
                          ].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      <p className="text-neutral-500">
                        Drop Point: <span className="font-semibold text-neutral-800">{day.transportDrop || "—"}</span>
                      </p>
                    </div>
                  </div>
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
                <div className="group relative rounded-lg overflow-hidden w-52 h-36 shrink-0">
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
        )}

        {/* Meals — shifted so breakfast shows on the day it's actually eaten
            (the morning of checkout), not the day the hotel was checked into. */}
        {(shiftedMeals ?? day.meals).length > 0 && (
          <EditableSection onEdit={mealsEdit}>
          <div className="space-y-2" style={{ breakInside: "avoid" }}>
            <DaySubHead
              icon={Utensils}
              label="Meals"
              onEdit={mealsEdit}
            />
            <div className={SUBHEAD_INDENT}>
              <MealsRow meals={shiftedMeals ?? day.meals} />
            </div>
          </div>
          </EditableSection>
        )}

        {/* Activities */}

        {activities.length > 0 && (
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
              if (idx === 0) {
                return (
                  <EditableSection key={originalIndex} onEdit={activitiesEdit}>
                  <div className="space-y-2.5" style={{ breakInside: "avoid" }}>
                    <DaySubHead
                      icon={Sparkles}
                      label="Experiences"
                      onEdit={activitiesEdit}
                    />
                    <div className={SUBHEAD_INDENT}>{row}</div>
                  </div>
                  </EditableSection>
                );
              }
              // Every later activity carries the same indent, so the whole
              // list stays aligned under the Experiences label above it.
              return <div key={originalIndex} className={SUBHEAD_INDENT}>{row}</div>;
            })}
          </div>
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
          hasActivities={activities.length > 0}
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
  form, durationLabel, onCoverImageChange, onCoverImagePositionChange,
}: {
  form: PreviewData;
  durationLabel: string;
  onCoverImageChange?: (url: string) => void;
  onCoverImagePositionChange?: (position: number) => void;
}) {
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

  // Journey route — pickup point, each stop with its night count, then the
  // drop point. Pickup/drop come from the first/last day's transport fields;
  // either (or both) is simply left out of the strip when not set.
  const firstDay = form.itineraries[0];
  const lastDay = form.itineraries[form.itineraries.length - 1];
  const pickupPoint = firstDay?.transportPickup || "";
  const dropPoint = lastDay?.transportDrop || "";
  const routeSteps: { label: string; nights?: number; kind: "pickup" | "drop" | "stop" }[] = [
    ...(pickupPoint ? [{ label: `${pickupPoint} pickup`, kind: "pickup" as const }] : []),
    ...form.stops.filter((s) => s.name.trim()).map((s) => ({ label: titleCase(s.name), nights: s.nights, kind: "stop" as const })),
    ...(dropPoint ? [{ label: `${dropPoint} drop`, kind: "drop" as const }] : []),
  ];

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
      <div className="absolute inset-0 bg-linear-to-t from-neutral-950/95 via-neutral-950/35 to-neutral-950/10" />

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

      <div className="absolute inset-x-0 bottom-0 px-[10mm] pb-[15mm]">
        {/* Eyebrow: a hairline plus plain small caps rather than a filled
            pill. The pill competed with the title for attention; a rule
            leads the eye into it instead. */}
        {form.totalDays > 0 && (
          <div className="flex items-center gap-2.5 mb-3">
            <span className="h-px w-7 bg-white/50" />
            <span className="inline-flex items-center gap-1.5 text-white/90 text-[10px] font-semibold tracking-[0.18em] uppercase">
              <Compass size={11} /> {form.totalDays} Day Journey
            </span>
          </div>
        )}
        <EditableText
          as="h1"
          value={form.title}
          field={{ scope: "package", key: "title" }}
          placeholder="Name this package…"
          fallback="Untitled Package"
          className={cn(DISPLAY, "block text-[34px] leading-[1.08] font-bold text-white")}
          style={{ maxWidth: "150mm", letterSpacing: "-0.02em", textWrap: "balance" }}
        />

        {routeSteps.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1 mt-3" style={{ maxWidth: "175mm" }}>
            {routeSteps.map((step, i) => (
              <div key={i} className="flex items-center gap-1">
                {i > 0 && <ArrowRight size={11} className="text-white/40 shrink-0 mx-0.5" />}
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 backdrop-blur-sm px-1.5 py-0.5 text-[10px] text-white whitespace-nowrap">
                  {step.kind === "stop"
                    ? <MapPin size={9} className="shrink-0 text-white/60" />
                    : <Car size={9} className="shrink-0 text-white/60" />}
                  {step.label}
                  {step.nights != null && (
                    <span className="rounded-full bg-white/20 px-1 py-0.5 text-[7px] font-bold text-white/90">
                      {step.nights}N
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2.5">
            <span className="flex items-center gap-1.5 text-white text-sm font-semibold">
              <MapPin size={14} className="shrink-0" />
              {form.startingPoint ? `${form.startingPoint} → ` : ""}{form.destination || "—"}
            </span>
            <span className="text-white/50">·</span>
            <span className="text-white/85 text-sm font-medium">{durationLabel}</span>
          </div>
        )}
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
function StatCell({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="px-4 py-3.5 flex flex-col justify-center min-w-0">
      <p
        className="flex items-center gap-1.5 mb-1 text-[10px] font-medium whitespace-nowrap"
        style={{ color: DOC.inkMuted }}
      >
        <Icon size={10} color={DOC.inkMuted} /> {label}
      </p>
      <p
        className={cn(DISPLAY, "font-semibold text-[13.5px] leading-tight truncate")}
        style={{ color: DOC.ink }}
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
      <div className="px-[10mm] pt-9 pb-6">
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

  /* Builder-only chrome — empty-field placeholders and any other affordance
     that exists purely to make the preview editable.

     Deliberately OUTSIDE the @media print block below. The PDF export path
     (pdfExport.ts) rasterises the live screen DOM through html2canvas, which
     never evaluates print media, so a rule hidden in @media print would not
     apply and this content would land in the client's PDF. The exporter sets
     data-exporting on the root for the duration of the capture instead.
     Browser print (Cmd-P) is covered by the .no-print rule further down. */
  .itinerary-print-area[data-exporting] .builder-only { display: none !important; }
  @media print {
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
  variant?: "card" | "flat";
}) {
  const travelDateStr = form.travelDate
    ? new Date(form.travelDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "TBD";

  const durationLabel = `${form.totalDays}D / ${form.totalNights}N`;

  const detailedShiftedMeals = computeShiftedMeals(form.itineraries);

  const paxLine =
    `${form.adults} Adult${form.adults !== 1 ? "s" : ""}` +
    (form.children ? `, ${form.children} Child${form.children !== 1 ? "ren" : ""}` : "") +
    (form.infants ? `, ${form.infants} Infant${form.infants !== 1 ? "s" : ""}` : "");

  const priceStr = form.totalPrice
    ? `${form.currency} ${Number(form.totalPrice).toLocaleString("en-IN")}`
    : "To be confirmed";

  const perPersonStr = form.pricePerPerson
    ? `${form.currency} ${Number(form.pricePerPerson).toLocaleString("en-IN")} per person`
    : null;

  // Route map legs derived straight from the ticket list — see the module
  // comment on PreviewData.tickets for why these aren't separate fields.
  const transport = deriveTransportFields(form.tickets);
  // Sections that render nothing when empty still need to exist while editing,
  // or there's no way to add the first line.
  const builderCanEdit = !!useOptionalBuilder()?.canEdit;

  return (
    <div>
      <style>{PRINT_STYLES}</style>

      {/* ── A4 page ─────────────────────────────────────────────────────────── */}
      <div
        className={cn(
          "itinerary-print-area mx-auto overflow-hidden",
          variant === "flat" ? "border border-neutral-200" : "rounded-lg shadow-xl",
        )}
        style={{ width: "210mm", minHeight: "297mm", backgroundColor: DOC.paper }}
      >
        {/* ── Masthead ──────────────────────────────────────────────────────
            Logo left, contact right, closed by a hairline. The rule matters:
            it gives the page a top edge to hang from, so the hero below reads
            as a plate set into the document rather than as the page itself. */}
        <header
          className="flex items-end justify-between px-[10mm] pt-5 pb-3.5"
          style={{ borderBottom: `1px solid ${DOC.rule}` }}
        >
          {/* Colour via className, not style: DyLogo forwards only className,
              and its mask is painted with bg-current — a background-color,
              which html2canvas-pro resolves from oklch just fine (it's the
              inline-SVG *stroke* that doesn't, see SectionHeader). */}
          <DyLogo className="h-7 text-primary-600" />
          <div className="text-right text-[10.5px] space-y-0.5" style={{ color: DOC.inkSoft }}>
            <p className="flex items-center justify-end gap-1.5">
              <Phone size={10} color={DOC.accent} /> {form.companySettings?.phone ?? COMPANY_PHONE}
            </p>
            <p className="flex items-center justify-end gap-1.5">
              <Mail size={10} color={DOC.accent} /> {form.companySettings?.email ?? COMPANY_EMAIL}
            </p>
          </div>
        </header>

        {/* ── Hero cover ────────────────────────────────────────────────────── */}
        <HeroCover
          form={form}
          durationLabel={durationLabel}
          onCoverImageChange={onCoverImageChange}
          onCoverImagePositionChange={onCoverImagePositionChange}
        />

        {/* ── Floating trip-stats card, overlapping the hero's wave edge ───── */}
        <div className="relative z-10 px-[10mm]" style={{ marginTop: "-13mm" }}>
          <div
            className="rounded-2xl grid grid-cols-4 overflow-hidden"
            style={{
              backgroundColor: DOC.card,
              // Softer, warmer lift than the old near-black shadow — on a
              // paper ground a cool grey shadow reads as a screen artefact.
              boxShadow: "0 12px 32px -10px rgba(80,60,40,0.22)",
              border: `1px solid ${DOC.rule}`,
              breakInside: "avoid",
            }}
          >
            <StatCell icon={Calendar} label="Travel date" value={travelDateStr} />
            <StatCell icon={Moon} label="Duration" value={durationLabel} />
            <StatCell icon={Users} label="Travellers" value={paxLine} />
            {/* Price is the one cell that inverts — it's the number the client
                is looking for, and it anchors the strip's right edge. */}
            <div
              className="px-4 py-3.5 flex flex-col justify-center min-w-0"
              style={{ backgroundColor: DOC.accent }}
            >
              <p className="flex items-center gap-1.5 mb-1 text-[10px] font-medium text-white/80 whitespace-nowrap">
                <IndianRupee size={10} color="#ffffff" /> Total price
              </p>
              <p className={cn(DISPLAY, "font-bold text-white text-[14px] leading-tight truncate")}>
                {priceStr}
              </p>
            </div>
          </div>
        </div>

        {/* ── Body ──────────────────────────────────────────────────────────── */}
        <main className="px-[10mm] pt-7 pb-2 space-y-7">
          {(form.clientName || form.execName) && (
            <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden" style={{ breakInside: "avoid" }}>
              <div className="grid grid-cols-2 divide-x divide-neutral-100">
                {/* Prepared For — the client this itinerary is going to */}
                <div className="p-3.5">
                  <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5">Prepared For</p>
                  {form.clientName ? (
                    <>
                      <p className="text-sm font-bold text-neutral-800 truncate">{form.clientName}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        <span className="text-[10px] font-semibold text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-full">
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
                        <p className="text-[11px] text-neutral-400 mt-1.5 font-medium tracking-wide">
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
                  <p className="text-[9px] font-bold text-primary-500/80 uppercase tracking-widest mb-1.5">Your Travel Manager</p>
                  {form.execName ? (
                    <>
                      <p className="text-sm font-bold text-neutral-800 truncate">
                        {form.execName}
                        {form.execDesignation && <span className="font-normal text-neutral-500"> · {form.execDesignation}</span>}
                      </p>
                      {form.execEmail && (
                        <a href={`mailto:${form.execEmail}`} className="flex items-center gap-1 text-primary-600 text-[11px] mt-1.5 hover:underline w-fit">
                          <Mail size={10} /> {form.execEmail}
                        </a>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-neutral-400 italic">—</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <EditableText
            as="p"
            multiline
            value={form.description}
            field={{ scope: "package", key: "description" }}
            placeholder="Describe this package for the client — click to add…"
            className="block text-sm text-neutral-600 leading-relaxed"
          />

          <TicketsSection
            tickets={form.tickets}
            packagePax={{ adults: form.adults, children: form.children, infants: form.infants }}
          />

          <AddonsSection addOns={form.addOns} />

          <PackageAddMenu />

          <PlacesToVisit form={form} onImageChange={onImageChange} />

          <div className="space-y-3">
            <SectionHeader icon={Calendar} label="Day-wise Summary" />
            <DaySummaryTable itineraries={form.itineraries} travelDate={form.travelDate} stops={form.stops} />
          </div>

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

          {/* Price summary — the document's second focal point after the hero,
              so it gets real scale (26px display) rather than the 17px it had.
              Warm near-black instead of neutral-950: a cool grey-blue block on
              a warm paper ground reads as pasted-in from another document. */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ breakInside: "avoid", boxShadow: "0 14px 32px -12px rgba(60,40,25,0.45)" }}
          >
            <div className="p-5" style={{ backgroundColor: "#1C1A18" }}>
              <div className="flex items-center gap-2 mb-3">
                <IndianRupee size={13} color="#E8A598" />
                <h2
                  className="text-[9.5px] font-semibold uppercase tracking-[0.16em]"
                  style={{ color: "#E8A598" }}
                >
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
                  <p
                    className={cn(DISPLAY, "font-bold text-white leading-none")}
                    style={{ fontSize: "26px", letterSpacing: "-0.02em" }}
                  >
                    {priceStr}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4" style={{ breakInside: "avoid" }}>
            <div
              className="rounded-2xl overflow-hidden"
              style={{ backgroundColor: DOC.card, border: `1px solid ${DOC.rule}` }}
            >
              <div
                className="flex items-center gap-2 px-4 py-3"
                style={{ backgroundColor: "#F0F8F5", borderBottom: `1px solid ${DOC.rule}` }}
              >
                <CheckCircle size={13} color={DOC.positive} />
                <h3 className={cn(DISPLAY, "text-[13px] font-semibold")} style={{ color: "#0B6B4F" }}>
                  Inclusions
                </h3>
              </div>
              <EditablePolicyList
                items={form.inclusions}
                listKey="inclusions"
                itemClassName="text-[11.5px]"
                style={{ color: DOC.inkSoft }}
                marker={() => <CheckCircle size={12} color={DOC.positive} className="shrink-0 mt-0.5" />}
              />
            </div>
            <div
              className="rounded-2xl overflow-hidden"
              style={{ backgroundColor: DOC.card, border: `1px solid ${DOC.rule}` }}
            >
              <div
                className="flex items-center gap-2 px-4 py-3"
                style={{ backgroundColor: DOC.accentSoft, borderBottom: `1px solid ${DOC.rule}` }}
              >
                <XCircle size={13} color={DOC.accent} />
                <h3 className={cn(DISPLAY, "text-[13px] font-semibold")} style={{ color: DOC.accent }}>
                  Exclusions
                </h3>
              </div>
              <EditablePolicyList
                items={form.exclusions}
                listKey="exclusions"
                itemClassName="text-[11.5px]"
                style={{ color: DOC.inkSoft }}
                marker={() => <XCircle size={12} color="#D98B7F" className="shrink-0 mt-0.5" />}
              />
            </div>
          </div>

          {/* "Why book with us" stays a real card — it's the one marketing
              block here, and it earns colour. Everything below it is fine
              print and shares the quiet PolicyBlock treatment. */}
          {(form.travelBenefits.length > 0 || builderCanEdit) && (
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                backgroundColor: DOC.accentSoft,
                border: `1px solid ${DOC.rule}`,
                breakInside: "avoid",
              }}
            >
              <div className="flex items-center gap-2 px-4 pt-3.5 pb-2">
                <Sparkles size={13} color={DOC.accent} />
                <h3 className={cn(DISPLAY, "text-[13px] font-semibold")} style={{ color: DOC.ink }}>
                  Why book with us
                </h3>
              </div>
              <EditablePolicyList
                items={form.travelBenefits}
                listKey="travelBenefits"
                itemClassName="px-4 pb-3.5 !p-0 !px-4 !pb-3.5 text-[11px] space-y-1.5"
                style={{ color: DOC.inkSoft }}
                marker={() => (
                  <span
                    className="mt-1.5 size-0.75 rounded-full shrink-0"
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
                className="block text-[11px] leading-relaxed"
                style={{ color: DOC.inkSoft }}
              />
            )}

          <div className="h-2" />
        </main>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <DocumentFooter form={form} />
      </div>
    </div>
  );
}