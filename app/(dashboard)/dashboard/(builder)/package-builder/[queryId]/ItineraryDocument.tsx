"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Calendar, Hotel, Car, Utensils, CheckCircle, XCircle,
  IndianRupee, Users, MapPin, Info, LogIn, LogOut,
  Plane, TrainFront, Sparkles, Phone, Mail, Upload, Loader2, Pencil, Image as ImageIcon,
  Coffee, Soup, UtensilsCrossed, Compass, Moon, Milestone, ArrowRight,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "@/app/(dashboard)/dashboard/(main)/components/ui/dialog";
import { cn } from "@/app/lib/utils";
import { ItineraryMap } from "./ItineraryMap";
import { ImageDropField } from "./ImageDropField";
import { uploadImageFile } from "@/app/lib/uploadImageFile";

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

/** Small round edit affordance shown on hover (parent needs a `group` class)
 * — opens the same drag-drop / upload / paste-link controls as the cover
 * image's popup, scoped to whichever photo it's attached to. Position/size
 * via `className` (e.g. "top-1 right-1 size-6") since it's reused at very
 * different thumbnail sizes across the document. */
function ImageEditButton({
  value, onChange, dialogTitle, className,
}: {
  value: string;
  onChange: (url: string) => void;
  dialogTitle: string;
  className?: string;
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
      </DialogContent>
    </Dialog>
  );
}

// Real contact details — kept identical to app/components/navigation/Footer.tsx
// (the live marketing site's footer) so a client sees the same phone/email
// whether they're on the website or reading this document.
const COMPANY_PHONE = "+91 9812345678";
const COMPANY_EMAIL = "hello@dreamyatri.com";
const COMPANY_ADDRESS = "Shimla, Himachal Pradesh - 171001";

// TODO: swap in the real payment link once it's available — the "Pay Now"
// button on the price summary opens this in a new tab.
const PAYMENT_LINK = "";

/** "AB12CD34" — the last 8 characters of the query's cuid, uppercased, as a
 * short human-referenceable quote number instead of exposing the client's
 * raw phone/email back to them on their own document. */
function refCode(queryId: string): string {
  return queryId.slice(-8).toUpperCase();
}

/** "manali" / "NEW DELHI" → "Manali" / "New Delhi" — route stop names are
 * free-typed by the exec, so casing isn't guaranteed. */
function titleCase(text: string): string {
  return text.replace(/\w\S*/g, (word) => word[0].toUpperCase() + word.slice(1).toLowerCase());
}

/** "14:30" (24h, as stored from <input type="time">) → "2:30 PM". */
function formatTime12h(hhmm: string): string {
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

/** "1 Room | 2 Adults, 1 Child" — computed against room capacity so it
 * always reflects the query's actual traveller count, not stale text. */
function occupancyText(capacity: number | null, adults: number, children: number): string {
  const totalPax = adults + children;
  const rooms = capacity && capacity > 0 ? Math.max(1, Math.ceil(totalPax / capacity)) : 1;
  return `${rooms} Room${rooms !== 1 ? "s" : ""} | ${adults} Adult${adults !== 1 ? "s" : ""}` +
    (children > 0 ? `, ${children} Child${children !== 1 ? "ren" : ""}` : "");
}

/** Parses free-text meal-plan strings ("MAP - Breakfast & Dinner") into a
 * clean "Breakfast & Dinner included" summary line. */
function mealIncludedText(planText: string): string | null {
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
import type { DayItinerary, ActivityInput, StopInput, TicketInput } from "../action";
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
  stops: StopInput[];
  itineraries: DayItinerary[];
  /** Flight/train legs with fares — flightsIncluded/flightFrom/etc for the
   * route map are derived from this list (see deriveTransportFields) rather
   * than stored separately, so they can never drift out of sync. */
  tickets: TicketInput[];
  /** Who this itinerary is being prepared for — from the originating query,
   * not typed into the package draft itself. Empty on the rare package with
   * no linked query (shouldn't happen in practice, but kept optional-safe). */
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  /** The originating query's id — shown as a short quote reference under the
   * client name instead of exposing their raw phone/email back to them. */
  queryId: string;
  execName: string;
  execEmail: string;
  execDesignation: string;
  /** Real destination photo per route stop name, resolved from the catalog —
   * optional since the public share-link path (getSharedPackage) may not
   * always have a match; the strip falls back gracefully when absent. */
  stopImages?: Record<string, string | null>;
}

/** Icon-badge + bold label + trailing rule — the section-opener used
 * throughout the document so every part of the trip reads as one
 * consistent, edited publication rather than a stack of unrelated boxes. */
function SectionHeader({
  icon: Icon, label, tone = "primary",
}: {
  icon: React.ElementType;
  label: string;
  tone?: "primary" | "emerald";
}) {
  const badge = tone === "emerald" ? "bg-emerald-100 text-emerald-600" : "bg-primary-100 text-primary-600";
  const rule = tone === "emerald" ? "bg-emerald-100" : "bg-primary-100";
  return (
    <div className="flex items-center gap-2.5" style={{ breakAfter: "avoid" }}>
      <span className={`flex items-center justify-center size-7 rounded-xl shrink-0 ${badge}`}>
        <Icon size={14} />
      </span>
      <h2 className="text-[15px] font-extrabold text-neutral-900 tracking-tight whitespace-nowrap">{label}</h2>
      <span className={`h-px flex-1 ${rule}`} />
    </div>
  );
}

function ActivityRow({
  activity, dayNumber, activityIndex, onImageChange,
}: {
  activity: ActivityInput;
  dayNumber?: number;
  activityIndex?: number;
  onImageChange?: OnImageChange;
}) {
  if (!activity.title.trim()) return null;
  const gallery = activity.photos.length > 0 ? activity.photos : (activity.photo ? [activity.photo] : []);
  const editable = !!onImageChange && dayNumber != null && activityIndex != null;
  // At least one (empty) tile so there's still an "add a photo" affordance
  // when this activity has none yet — read-only view just shows nothing.
  const slots: (string | null)[] = gallery.length > 0 ? gallery.slice(0, 3) : (editable ? [null] : []);

  return (
    <div className="space-y-2" style={{ breakInside: "avoid" }}>
      <div className="flex items-start gap-2">
        <span className="flex items-center justify-center size-5 rounded-full bg-primary-100 text-primary-600 shrink-0 mt-0.5">
          <Sparkles size={11} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-neutral-800">{activity.title}</p>
          {activity.description && (
            <p className="text-xs text-neutral-500 mt-0.5">{activity.description}</p>
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
                    {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary catalog URL, not a static app asset */}
                    <img src={src} alt={activity.photoLabels[i] || activity.title} className="w-full h-30 object-cover" />
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
        <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-600">Terms & Conditions</h3>
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

/** Compact "Day | Hotel | Meals | Cab" grid so the pattern across the whole
 * trip is visible at a glance, ahead of the detailed per-day cards below. */
function DaySummaryTable({ itineraries }: { itineraries: DayItinerary[] }) {
  return (
    <div className="rounded-xl border border-neutral-200 overflow-hidden" style={{ breakInside: "avoid" }}>
      <table className="w-full text-[11px]">
        <thead>
          <tr className="bg-primary-50/70 text-primary-700/80 uppercase tracking-wide text-[9px]">
            <th className="text-left px-3 py-2.5 font-bold">Day</th>
            <th className="text-left px-3 py-2.5 font-bold">Hotel</th>
            <th className="text-left px-3 py-2.5 font-bold">Meals</th>
            <th className="text-left px-3 py-2.5 font-bold">Cab</th>
          </tr>
        </thead>
        <tbody>
          {itineraries.map((d, i) => (
            <tr key={d.day} className={`border-t border-neutral-100 ${i % 2 === 1 ? "bg-neutral-50/60" : ""}`}>
              <td className="px-3 py-2 font-semibold text-neutral-700 whitespace-nowrap">Day {d.day}</td>
              <td className="px-3 py-2 text-neutral-600">{d.accommodation || "—"}</td>
              <td className="px-3 py-2 text-neutral-600">{d.meals.length > 0 ? d.meals.join(", ") : "—"}</td>
              <td className="px-3 py-2 text-neutral-600">{d.transport || d.transportVehicleType || "—"}</td>
            </tr>
          ))}
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
/** One location name per day, derived from the route stops' night counts —
 * mirrors deriveDayLocations in page.tsx (kept as a local copy since that
 * one isn't exported) so a stop's own days can be found here too. */
function deriveDayLocations(stops: StopInput[], totalDays: number): string[] {
  if (stops.length === 0) return Array(totalDays).fill("");
  const locations: string[] = [];
  for (const stop of stops) {
    for (let i = 0; i < stop.nights && locations.length < totalDays; i++) {
      locations.push(stop.name);
    }
  }
  const lastStopName = stops[stops.length - 1]?.name ?? "";
  while (locations.length < totalDays) locations.push(lastStopName);
  return locations;
}

/** A photo that actually belongs to this stop — an activity photo from one
 * of its days first (what the client asked to see: what they'll be doing
 * there), then that stop's own hotel photo — before any package-wide
 * fallback, so a stop without a catalog match still shows something from
 * its own itinerary instead of a random unrelated day. */
function firstDayPhotoForStop(itineraries: DayItinerary[], dayNumbers: Set<number>): string | null {
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
          return (
            <div key={i} className="group relative flex-1 min-w-0">
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element -- arbitrary external/catalog URL, not a static app asset
                <img src={img} alt={s.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-linear-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                  <MapPin size={22} className="text-white/70" />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/30 to-transparent px-2.5 py-2 pt-8">
                <p className="text-white text-xs font-bold truncate leading-tight">{s.name ? titleCase(s.name) : "—"}</p>
                <p className="text-white/75 text-[10px] font-medium">{s.nights} Night{s.nights !== 1 ? "s" : ""}</p>
              </div>
              {onImageChange && (
                <ImageEditButton
                  value={img ?? ""}
                  onChange={(url) => onImageChange({ kind: "stop", stopIndex: i }, url)}
                  dialogTitle={`${s.name ? titleCase(s.name) : "Stop"} Photo`}
                  className="top-1.5 right-1.5 size-6"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Same light-header-strip card language as the Stay/Transport sub-cards
 * inside each day (icon badge + tinted header, not a heavy gradient) so a
 * ticket reads as part of the same document instead of a bolted-on style.
 * Fare is deliberately never shown here — it's priced into the package total
 * but not itemized per-leg on the client-facing document. */
function TicketCard({ ticket }: { ticket: TicketInput }) {
  const Icon = ticket.type === "FLIGHT" ? Plane : TrainFront;
  const paxLine = [
    ticket.adults ? `${ticket.adults} Adult${ticket.adults !== 1 ? "s" : ""}` : null,
    ticket.children ? `${ticket.children} Child${ticket.children !== 1 ? "ren" : ""}` : null,
    ticket.infants ? `${ticket.infants} Infant${ticket.infants !== 1 ? "s" : ""}` : null,
  ].filter(Boolean).join(", ");
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
            {ticket.provider || (ticket.type === "FLIGHT" ? "Airline TBD" : "Train TBD")}
            {ticket.ticketNumber && <span className="font-normal text-neutral-500"> · {ticket.ticketNumber}</span>}
          </p>
        </div>
        {ticket.travelDate && (
          <span className="text-[10px] font-semibold text-primary-700 shrink-0">{formatTicketDate(ticket.travelDate)}</span>
        )}
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
function TicketsSection({ tickets }: { tickets: TicketInput[] }) {
  const flights = tickets.filter((t) => t.type === "FLIGHT");
  const trains = tickets.filter((t) => t.type === "TRAIN");
  if (flights.length === 0 && trains.length === 0) return null;

  return (
    <>
      {flights.length > 0 && (
        <div className="space-y-3" style={{ breakInside: "avoid" }}>
          <SectionHeader icon={Plane} label="Flight Details" />
          <div className="grid gap-3">
            {flights.map((t, i) => <TicketCard key={t.id ?? i} ticket={t} />)}
          </div>
        </div>
      )}
      {trains.length > 0 && (
        <div className="space-y-3" style={{ breakInside: "avoid" }}>
          <SectionHeader icon={TrainFront} label="Train Details" />
          <div className="grid gap-3">
            {trains.map((t, i) => <TicketCard key={t.id ?? i} ticket={t} />)}
          </div>
        </div>
      )}
    </>
  );
}

function DayCardPreview({
  day, adults, childCount, onImageChange,
}: {
  day: DayItinerary;
  adults: number;
  childCount: number;
  onImageChange?: OnImageChange;
}) {
  // Keeps each activity's original index (for onImageChange targeting) even
  // though blank ones are filtered out of what's actually rendered.
  const activities = day.activities
    .map((a, originalIndex) => ({ a, originalIndex }))
    .filter(({ a }) => a.title.trim());
  const hasHotel = day.accommodation || day.hotelCheckIn || day.hotelCheckOut || day.hotelMealPlan;
  const mealText = mealIncludedText(day.hotelMealPlan);
  const hasPhotos = day.accommodationPhoto || day.accommodationRoomPhotos.length > 0 || !!onImageChange;
  const extraRooms = (day.extraRooms ?? []).filter((r) => r.roomPricingId > 0);
  const extraCabs = (day.extraCabs ?? []).filter((c) => c.label.trim());

  return (
    <div
      className="rounded-2xl border border-neutral-200 overflow-hidden bg-white shadow-sm"
    >
      {/* Day header — numbered badge + title. Deliberately NOT wrapping the
          whole card in breakInside:avoid — a day with several activities and
          photos routinely runs taller than one PDF page, and forcing the
          entire card onto a fresh page just to avoid a mid-card split leaves
          a large blank gap at the bottom of the previous page. Instead, only
          the Hotel/Transport/Activity sub-cards below are individually
          protected, so a tall day can still split page-to-page at a clean
          boundary between them. */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-neutral-100 bg-linear-to-r from-primary-50/70 to-transparent">
        <span className="shrink-0 flex items-center justify-center size-9 rounded-xl bg-linear-to-br from-primary-500 to-primary-700 text-white text-sm font-extrabold shadow-sm">
          {day.day}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-widest text-primary-500 leading-none mb-0.5">Day {day.day}</p>
          <p className="text-sm font-bold text-neutral-800 truncate leading-tight">
            {day.title || `Day ${day.day}`}
          </p>
        </div>
      </div>

      <div className="px-3.5 py-3 space-y-3">
        {day.description && (
          <p className="text-xs text-neutral-600 leading-relaxed">{day.description}</p>
        )}

        {/* Hotel info */}
        {hasHotel && (
          <div className="rounded-xl border border-neutral-200 overflow-hidden" style={{ breakInside: "avoid" }}>
            <div className="flex items-center gap-2 px-3 py-2 bg-primary-50/70 border-b border-primary-100">
              <span className="flex items-center justify-center size-5 rounded-lg bg-primary-100 shrink-0">
                <Hotel size={11} className="text-primary-600" />
              </span>
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary-700">Stay</p>
            </div>
            <div className="flex gap-3 p-3">
              <div className="flex-1 min-w-0 space-y-1.5">
                <p className="text-xs font-bold text-neutral-800">
                  {day.accommodation || "Hotel (TBD)"}
                </p>

                {day.accommodationLocation && (
                  <p className="text-[11px] text-neutral-500 flex items-center gap-1">
                    <MapPin size={10} className="text-neutral-400 shrink-0" /> {day.accommodationLocation}
                  </p>
                )}

                <p className="text-[11px] text-neutral-500 flex items-center gap-1">
                  <Users size={10} className="text-neutral-400 shrink-0" />
                  {occupancyText(day.accommodationRoomCapacity, adults, childCount)}
                </p>

                {(day.hotelCheckIn || day.hotelCheckOut) && (
                  <div className="flex items-center gap-2 pt-1">
                    <div className="flex flex-col items-center gap-0.5 shrink-0">
                      <LogIn size={12} className="text-primary-500" />
                      <span className="text-[8px] text-neutral-400 font-medium uppercase tracking-wide">Check-in</span>
                      <span className="text-[11px] font-semibold text-neutral-700">{day.hotelCheckIn || "—"}</span>
                    </div>
                    <div className="flex-1 border-t border-dashed border-neutral-300 self-center" />
                    <div className="flex flex-col items-center gap-0.5 shrink-0">
                      <LogOut size={12} className="text-primary-500" />
                      <span className="text-[8px] text-neutral-400 font-medium uppercase tracking-wide">Check-out</span>
                      <span className="text-[11px] font-semibold text-neutral-700">{day.hotelCheckOut || "—"}</span>
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
                  <div className="pt-1 border-t border-neutral-100 space-y-0.5">
                    {extraRooms.map((r, i) => (
                      <p key={i} className="text-[11px] text-neutral-500">
                        + {r.quantity > 1 ? `${r.quantity}× ` : ""}{r.label}
                      </p>
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

        {/* Transport */}
        {(day.transport || day.transportPickup || day.transportDrop) && (
          <div className="rounded-xl border border-neutral-200 overflow-hidden" style={{ breakInside: "avoid" }}>
            <div className="flex items-center gap-2 px-3 py-2 bg-neutral-50 border-b border-neutral-100">
              <span className="flex items-center justify-center size-5 rounded-lg bg-neutral-200/70 shrink-0">
                <Car size={11} className="text-neutral-600" />
              </span>
              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-600">Transport</p>
              {(day.transportDistanceKm || (day.transportPickup && day.transportDrop)) && (
                <span className="text-[10px] text-neutral-400 truncate">
                  · {[
                    day.transportDistanceKm ? `${day.transportDistanceKm} km` : null,
                    day.transportPickup && day.transportDrop ? `${day.transportPickup} → ${day.transportDrop}` : null,
                  ].filter(Boolean).join(" · ")}
                </span>
              )}
            </div>

            <div className="flex gap-3 p-3">
              <div className="flex-1 min-w-0 space-y-2">
                {day.transport && (
                  <p className="text-sm font-semibold text-neutral-800">
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
                      {day.transportDistanceKm && (
                        <p className="text-[11px] text-neutral-400 py-1">{day.transportDistanceKm} km</p>
                      )}
                      <p className="text-neutral-500">
                        Drop Point: <span className="font-semibold text-neutral-800">{day.transportDrop || "—"}</span>
                      </p>
                    </div>
                  </div>
                )}

                {extraCabs.length > 0 && (
                  <div className="pt-1 border-t border-neutral-100 space-y-0.5">
                    {extraCabs.map((c, i) => (
                      <p key={i} className="text-[11px] text-neutral-500">
                        + {c.quantity > 1 ? `${c.quantity}× ` : ""}{c.label}
                      </p>
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
        )}

        {/* Meals */}
        {day.meals.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Meals</p>
            <MealsRow meals={day.meals} />
          </div>
        )}

        {/* Activities */}
        {activities.length > 0 && (
          <div className="space-y-2.5 pt-2.5 border-t border-neutral-100">
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Experiences</p>
            {activities.map(({ a, originalIndex }) => (
              <ActivityRow
                key={originalIndex}
                activity={a}
                dayNumber={day.day}
                activityIndex={originalIndex}
                onImageChange={onImageChange}
              />
            ))}
          </div>
        )}

        {day.notes && (
          <p className="text-[11px] text-neutral-400 italic border-t border-neutral-100 pt-2.5">{day.notes}</p>
        )}
      </div>
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
  const hasImage = !!form.coverImage;
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
  const routeSteps: { label: string; nights?: number }[] = [
    ...(pickupPoint ? [{ label: `${pickupPoint} pickup` }] : []),
    ...form.stops.filter((s) => s.name.trim()).map((s) => ({ label: titleCase(s.name), nights: s.nights })),
    ...(dropPoint ? [{ label: `${dropPoint} drop` }] : []),
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
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: `center ${form.coverImagePosition ?? 50}%` }}
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
        {form.totalDays > 0 && (
          <span className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/25 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full mb-3">
            <Compass size={11} /> {form.totalDays} Day Journey
          </span>
        )}
        <h1 className="text-[30px] leading-[1.15] font-extrabold text-white" style={{ maxWidth: "150mm" }}>
          {form.title || "Untitled Package"}
        </h1>

        {routeSteps.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1 mt-3" style={{ maxWidth: "175mm" }}>
            {routeSteps.map((step, i) => (
              <div key={i} className="flex items-center gap-1">
                {i > 0 && <ArrowRight size={11} className="text-white/40 shrink-0 mx-0.5" />}
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 backdrop-blur-sm px-1.5 py-0.5 text-[10px] text-white whitespace-nowrap">
                  <MapPin size={9} className="shrink-0 text-white/60" />
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

      {/* Wave transition into the white body below */}
      <svg
        viewBox="0 0 1440 74" preserveAspectRatio="none"
        className="absolute -bottom-px left-0 w-full text-white" style={{ height: "20px" }}
      >
        <path fill="currentColor" d="M0,32 C240,74 480,0 720,26 C960,52 1200,74 1440,32 L1440,74 L0,74 Z" />
      </svg>
    </div>
  );
}

function StatCell({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="p-3.5 flex flex-col justify-center min-w-0">
      <p className="text-neutral-400 flex items-center gap-1 mb-1 text-[9px] font-bold uppercase tracking-wide whitespace-nowrap">
        <Icon size={10} /> {label}
      </p>
      <p className="font-bold text-neutral-800 text-[13px] leading-tight truncate">{value}</p>
    </div>
  );
}

/** Dark, brand-matched close to the document — same surface colour
 * (neutral-950) and contact details as the live site's footer
 * (app/components/navigation/Footer.tsx), scaled down to what makes sense in
 * a static, per-client document (no nav links, no social icons). */
function DocumentFooter({ form }: { form: PreviewData }) {
  const contactRows = [
    { icon: Phone, label: "24 × 7 Helpline", value: COMPANY_PHONE },
    { icon: Mail, label: "Email Us", value: COMPANY_EMAIL },
    { icon: MapPin, label: "Head Office", value: COMPANY_ADDRESS },
  ];

  return (
    <footer className="bg-neutral-950 text-slate-300 mt-2" style={{ breakInside: "avoid" }}>
      <div className="px-[10mm] pt-9 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-8 pb-7 border-b border-white/10">
          <div className="space-y-3" style={{ maxWidth: "95mm" }}>
            <DyLogo className="h-7 text-primary-500" />
            <p className="text-slate-400 text-[11px] leading-relaxed">
              At Dreams Yatri, we turn journeys into stories. From Himalayan escapes to luxury international
              holidays, our experts design custom, budget-smart, worry-free trips — so you focus on memories,
              not logistics.
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
          <p>This is a custom itinerary, subject to availability at the time of booking.</p>
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
    @page { size: A4; margin: 0; }
  }
`;

export function ItineraryDocument({
  form, onCoverImageChange, onCoverImagePositionChange, onImageChange, variant = "card",
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

  return (
    <div>
      <style>{PRINT_STYLES}</style>

      {/* ── A4 page ─────────────────────────────────────────────────────────── */}
      <div
        className={cn(
          "itinerary-print-area mx-auto bg-white overflow-hidden",
          variant === "flat" ? "border border-neutral-200" : "rounded-lg shadow-xl",
        )}
        style={{ width: "210mm", minHeight: "297mm" }}
      >
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <header className="flex items-center justify-between px-[10mm] py-4">
          <DyLogo className="h-7 text-primary-600" />
          <div className="text-right text-[11px] text-neutral-500 space-y-0.5">
            <p className="flex items-center justify-end gap-1.5"><Phone size={10} className="text-primary-500" /> {COMPANY_PHONE}</p>
            <p className="flex items-center justify-end gap-1.5"><Mail size={10} className="text-primary-500" /> {COMPANY_EMAIL}</p>
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
          <div className="bg-white rounded-2xl  border-neutral-100 grid grid-cols-4 divide-x divide-neutral-100 overflow-hidden" style={{ boxShadow: "0 10px 30px -8px rgba(0,0,0,0.18)" }}>
            <StatCell icon={Calendar} label="Travel Date" value={travelDateStr} />
            <StatCell icon={Moon} label="Duration" value={durationLabel} />
            <StatCell icon={Users} label="Travellers" value={paxLine} />
            <div className="p-3.5 bg-linear-to-br from-primary-500 to-primary-600 flex flex-col justify-center min-w-0">
              <p className="text-white/75 flex items-center gap-1 mb-1 text-[9px] font-bold uppercase tracking-wide whitespace-nowrap">
                <IndianRupee size={10} /> Total Price
              </p>
              <p className="font-extrabold text-white text-[13px] leading-tight truncate">{priceStr}</p>
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

          {form.description && (
            <p className="text-sm text-neutral-600 leading-relaxed">{form.description}</p>
          )}

          <TicketsSection tickets={form.tickets} />

          <PlacesToVisit form={form} onImageChange={onImageChange} />

          <div className="space-y-3">
            <SectionHeader icon={Calendar} label="Day-wise Summary" />
            <DaySummaryTable itineraries={form.itineraries} />
          </div>

          <div className="space-y-3">
            <SectionHeader icon={Milestone} label="Detailed Itinerary" />
            <div className="space-y-3">
              {form.itineraries.map((d) => (
                <DayCardPreview
                  key={d.day}
                  day={d}
                  adults={form.adults}
                  childCount={form.children}
                  onImageChange={onImageChange}
                />
              ))}
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

          <div className="rounded-2xl overflow-hidden" style={{ breakInside: "avoid", boxShadow: "0 12px 28px -10px rgba(0,0,0,0.35)" }}>
            <div className="bg-linear-to-br from-neutral-900 via-neutral-950 to-neutral-950 p-5">
              <div className="flex items-center gap-2.5 mb-4">
                <span className="flex items-center justify-center size-7 rounded-xl bg-primary-500/20 text-primary-400 shrink-0">
                  <IndianRupee size={14} />
                </span>
                <h2 className="text-[13px] font-extrabold text-white uppercase tracking-wide">Price Summary</h2>
              </div>

              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-white/90 font-medium">{paxLine}</p>
                  {perPersonStr && <p className="text-xs text-white/60">{perPersonStr}</p>}
                  {form.infants > 0 && (
                    <p className="text-[10px] text-white/50">Infant charges as applicable / on request</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-white/60 uppercase tracking-widest font-bold mb-0.5">Total Package Price</p>
                  <p className="text-[28px] font-extrabold text-white leading-none">{priceStr}</p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-white/10">
                <p className="text-[10px] text-white/60">Secure your booking online, anytime.</p>
                <a
                  href={PAYMENT_LINK || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 bg-primary-500 hover:bg-primary-400 text-white font-bold text-xs px-4 py-2 rounded-full transition-colors shrink-0"
                >
                  Pay Now <ArrowRight size={13} />
                </a>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4" style={{ breakInside: "avoid" }}>
            <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50/70 border-b border-emerald-100">
                <span className="flex items-center justify-center size-6 rounded-lg bg-emerald-100 shrink-0">
                  <CheckCircle size={13} className="text-emerald-600" />
                </span>
                <h3 className="text-xs font-bold uppercase tracking-wide text-emerald-700">Inclusions</h3>
              </div>
              <ul className="p-4 space-y-2 text-xs text-neutral-600">
                {form.inclusions.map((i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle size={12} className="text-emerald-500 shrink-0 mt-0.5" />
                    <span>{i}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-primary-50/70 border-b border-primary-100">
                <span className="flex items-center justify-center size-6 rounded-lg bg-primary-100 shrink-0">
                  <XCircle size={13} className="text-primary-600" />
                </span>
                <h3 className="text-xs font-bold uppercase tracking-wide text-primary-700">Exclusions</h3>
              </div>
              <ul className="p-4 space-y-2 text-xs text-neutral-600">
                {form.exclusions.map((i) => (
                  <li key={i} className="flex items-start gap-2">
                    <XCircle size={12} className="text-primary-400 shrink-0 mt-0.5" />
                    <span>{i}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {form.termsNotes && <TermsAndConditions text={form.termsNotes} />}

          <div className="h-2" />
        </main>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <DocumentFooter form={form} />
      </div>
    </div>
  );
}
