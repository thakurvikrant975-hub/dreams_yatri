"use client";

import React, { useEffect, useRef, useState, useTransition } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import {
  DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  MapPin, Calendar, Users, Phone, Mail, Hotel, Car, Zap,
  Utensils, ChevronDown, ChevronUp, Plus, Trash2, Pencil,
  Save, Send, CheckCircle, AlertCircle, Loader2,
  Package, User, Info, IndianRupee, ArrowLeft,
  Eye, EyeOff, ListChecks, Plane, TrainFront, LogIn, LogOut,
  Image as ImageIcon, X, Sparkles, Percent, CreditCard, Wand2, Copy, Lock,
  ExternalLink, Gift, GripVertical,
} from "lucide-react";
import { Button } from "@/app/(dashboard)/dashboard/(main)/components/ui/button";
import { Input } from "@/app/(dashboard)/dashboard/(main)/components/ui/input";
import { Textarea } from "@/app/(dashboard)/dashboard/(main)/components/ui/textarea";
import { Badge } from "@/app/(dashboard)/dashboard/(main)/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/(dashboard)/dashboard/(main)/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "@/app/(dashboard)/dashboard/(main)/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/app/(dashboard)/dashboard/(main)/components/ui/dropdown-menu";
import { SearchSelect, type Option } from "@/app/(dashboard)/dashboard/(main)/components/dashboard/SearchSelect";
import { LocationSearchSelect } from "@/app/(dashboard)/dashboard/(main)/components/location/LocationSearchSelect";
import { ROUTE_STOP_TYPES, TRANSFER_TYPES, type LocationValue } from "@/app/(dashboard)/dashboard/(main)/components/location/location.types";
import { cn } from "@/app/lib/utils";
import {
  getPackageDetail,
  getQueryLeadInfo,
  saveCustomPackage,
  sendPackageToClient,
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
import { ItineraryDocument, SafeImg, formatTime12h, computeShiftedMeals, type PreviewData, type ImageEditTarget } from "./ItineraryDocument";
import { ItineraryPdfExport } from "./ItineraryPdfExport";
import { SendToClientDialog } from "./SendToClientDialog";
import { HotelRoomPicker } from "./HotelRoomPicker";
import { ImageDropField } from "./ImageDropField";
import { CreatePackageDialog } from "@/app/(dashboard)/dashboard/(main)/(sales)/sales-query/CreatePackageDialog";
import { getItinerarySettings, type ItinerarySettings, type PolicySection } from "@/app/(dashboard)/dashboard/(main)/itinerary-settings/actions";

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

// Geocodes the day's search-city text (Mapbox, India-scoped) so hotel search
// results can show "X km from {city}" — cached in module scope, same pattern
// as ItineraryMap.tsx, since the same city gets searched repeatedly across days.
const cityGeocodeCache = new Map<string, { lat: number; lng: number } | null>();
async function geocodeCity(query: string): Promise<{ lat: number; lng: number } | null> {
  const key = query.trim().toLowerCase();
  if (!key) return null;
  if (cityGeocodeCache.has(key)) return cityGeocodeCache.get(key) ?? null;
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
      `?access_token=${token}&limit=1&country=IN&proximity=78.9629,20.5937`,
    );
    if (!res.ok) { cityGeocodeCache.set(key, null); return null; }
    const data = await res.json();
    const center = data.features?.[0]?.center as [number, number] | undefined; // [lng, lat]
    const result = center ? { lat: center[1], lng: center[0] } : null;
    cityGeocodeCache.set(key, result);
    return result;
  } catch {
    cityGeocodeCache.set(key, null);
    return null;
  }
}

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
// EditableList
// ─────────────────────────────────────────────────────────────────────────────
function EditableList({ label, items, onChange, placeholder, readOnly }: {
  label: string; items: string[]; onChange: (v: string[]) => void; placeholder?: string;
  /** Company-wide standard content (inclusions/exclusions/policies/benefits)
   * that Sales Executives can see but not edit per package — see
   * getCurrentUserRole in action.ts. */
  readOnly?: boolean;
}) {
  const [input, setInput] = useState("");
  function add() {
    const val = input.trim();
    if (val && !items.includes(val)) { onChange([...items, val]); setInput(""); }
  }
  return (
    <div>
      <label className="text-xs font-medium text-dashboard-base-content/90 mb-2 flex items-center gap-1.5">
        {label}
        {readOnly && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-normal text-dashboard-base-content/50">
            <Lock size={10} /> Locked
          </span>
        )}
      </label>
      {!readOnly && (
        <div className="flex gap-2 mb-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
            placeholder={placeholder ?? "Add item…"}
            className="text-sm h-9 flex-1 border-dashboard-neutral-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={add}
            className="h-9 px-3 border-dashboard-base-300 rounded-md bg-dashboard-primary text-dashboard-primary-content hover:bg-dashboard-primary/90"
          >
            <Plus size={16} />
          </Button>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span
            key={i}
            className="flex items-center gap-1 text-xs bg-dashboard-base-200 text-dashboard-base-content px-2.5 py-1 rounded-full border border-dashboard-base-300"
          >
            {item}
            {!readOnly && (
              <button
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                className="text-dashboard-base-content/50 hover:text-dashboard-error transition-colors ml-0.5"
              >×</button>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ExtraPolicyItemsEditor — always-editable "add something just for this
// package" list, shown right under each locked standard list above. Visually
// distinct (dashed border, muted panel) so it never reads as "the same list,
// now editable" — it's a separate, additive set that this exact package
// shows on top of the standard one. Anyone can use this, including Sales
// Executives who can't touch the standard lists themselves.
// ─────────────────────────────────────────────────────────────────────────────
function ExtraPolicyItemsEditor({ items, onChange, placeholder }: {
  items: string[]; onChange: (v: string[]) => void; placeholder?: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-dashboard-primary/30 bg-dashboard-primary/5 p-3">
      <EditableList
        label="Package-specific additions"
        items={items}
        onChange={onChange}
        placeholder={placeholder ?? "Add something just for this package…"}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PhotoPreview — small thumbnail with a remove ("×") button, used for the
// hotel/cab/activity picks below so a sales exec sees confirmation of what
// was chosen instead of just text fields.
// ─────────────────────────────────────────────────────────────────────────────
function PhotoPreview({ src, alt, onRemove }: { src: string; alt: string; onRemove: () => void }) {
  return (
    <div className="relative inline-block shrink-0">
      <Image
        src={src}
        alt={alt}
        width={64}
        height={48}
        className="h-12 w-16 rounded-md object-cover border border-dashboard-base-300"
      />
      <button
        type="button"
        onClick={onRemove}
        className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-dashboard-error text-white text-[10px] leading-none flex items-center justify-center hover:bg-dashboard-error/80"
      >
        ×
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HotelPhotoGallery — the hotel's main photo plus up to 3 room photos, shown
// together once a real hotel room is picked so the builder reads as a photo
// gallery instead of just text fields.
// ─────────────────────────────────────────────────────────────────────────────
function HotelPhotoGallery({ hotelPhoto, roomPhotos, alt, onClear }: {
  hotelPhoto?: string;
  roomPhotos: string[];
  alt: string;
  onClear: () => void;
}) {
  if (!hotelPhoto && roomPhotos.length === 0) return null;
  return (
    <div className="relative rounded-lg border border-dashboard-base-300 bg-dashboard-base-200/40 p-2.5">
      <button
        type="button"
        onClick={onClear}
        className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-dashboard-error text-white text-xs leading-none flex items-center justify-center hover:bg-dashboard-error/80 z-10"
      >
        ×
      </button>
      <div className="flex gap-2">
        {hotelPhoto && (
          <div className="shrink-0">
            <Image
              src={hotelPhoto}
              alt={alt}
              width={140}
              height={112}
              className="h-24 w-32 rounded-lg object-cover border border-dashboard-base-300"
            />
            <p className="text-[9px] text-dashboard-base-content/40 mt-1 text-center">Hotel</p>
          </div>
        )}
        {roomPhotos.length > 0 && (
          <div className="grid grid-cols-3 gap-1.5 flex-1 min-w-0">
            {roomPhotos.slice(0, 3).map((src, i) => (
              <div key={i}>
                <Image
                  src={src}
                  alt={`${alt} — room photo ${i + 1}`}
                  width={100}
                  height={112}
                  className="h-24 w-full rounded-lg object-cover border border-dashboard-base-300"
                />
                {i === 1 && <p className="text-[9px] text-dashboard-base-content/40 mt-1 text-center">Room</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// A drag handle (not the whole row) grabs the pointer listeners — the row
// itself holds a title Input and a description Textarea, and text selection
// inside those needs normal pointer-drag behavior, which a whole-row
// listener would fight with.
function SortableActivityRow({ dndId, children }: { dndId: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: dndId });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex gap-2 rounded-lg border border-violet-100 bg-violet-50/30 p-2.5"
    >
      <button
        type="button"
        className="flex items-center justify-center shrink-0 mt-0.5 size-5 text-violet-400/70 hover:text-violet-600 cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} />
      </button>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ActivityListEditor — per-activity title + description + photo, add/remove
// ─────────────────────────────────────────────────────────────────────────────
function ActivityListEditor({ activities, location, onChange }: {
  activities: ActivityInput[];
  location?: string;
  onChange: (v: ActivityInput[]) => void;
}) {
  // dnd-kit needs a stable id per row to track it across a drag. ActivityInput
  // only gets a real `id` once the whole package has been saved and reloaded
  // — a freshly-added (unsaved) activity has none, and several could exist at
  // once, so `id` alone can't be used as-is. Kept as explicit state (not
  // derived during render via a ref/counter — React's purity rules flag both
  // reading a ref and calling Math.random/Date.now while rendering) and
  // updated in lockstep by the exact three places below that actually change
  // the array's length or order: add, remove, drag-reorder. A plain edit
  // (updateActivity) never touches this, since it changes neither.
  const [dndIds, setDndIds] = useState<string[]>(() => activities.map((_, i) => `row-${i}`));
  const nextDndId = useRef(activities.length);
  // React-blessed "adjust state during render" pattern (same one already
  // used for searchCity/prevLocation above) — catches an external, wholesale
  // replacement of `activities` that didn't go through add/remove/reorder
  // here (e.g. the initial package-load effect populating real day data).
  const [prevActivitiesForIds, setPrevActivitiesForIds] = useState(activities);
  if (activities !== prevActivitiesForIds && activities.length !== dndIds.length) {
    setPrevActivitiesForIds(activities);
    setDndIds(activities.map((_, i) => `row-${i}`));
  }
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = dndIds.indexOf(String(active.id));
    const newIndex = dndIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(activities, oldIndex, newIndex));
    setDndIds((ids) => arrayMove(ids, oldIndex, newIndex));
  }

  function addActivity() {
    onChange([...activities, { title: "", description: "", photo: "", photos: [], photoLabels: [] }]);
    setDndIds((ids) => [...ids, `row-new-${nextDndId.current++}`]);
  }
  function updateActivity(idx: number, patch: Partial<ActivityInput>) {
    onChange(activities.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  }
  function removeActivity(idx: number) {
    onChange(activities.filter((_, i) => i !== idx));
    setDndIds((ids) => ids.filter((_, i) => i !== idx));
  }

  async function fetchActivityOptions(query: string): Promise<Option[]> {
    if (!location) return [];
    const results = await searchActivitiesForBuilder(location, query);
    return results.map((r): Option & { raw: ActivityResult } => ({
      id: r.id,
      label: r.name,
      description: [r.category, r.durationHours ? `${r.durationHours}h` : null].filter(Boolean).join(" · ") || undefined,
      thumbnail: r.thumbnail ?? undefined,
      raw: r,
    }));
  }

  function handleActivitySelect(_id: number | null, option?: Option) {
    const raw = (option as (Option & { raw: ActivityResult }) | undefined)?.raw;
    if (!raw) return;
    onChange([...activities, {
      title: raw.name,
      // The catalog's real write-up — previously this was set to the
      // category/duration tag shown in the picker dropdown (e.g. "Adventure
      // · 2h"), which isn't a description at all and was blank whenever
      // neither was set, which is why it looked like no description ever
      // came through.
      description: raw.description ?? "",
      photo: raw.thumbnail ?? "",
      photos: raw.photos,
      photoLabels: raw.photoLabels,
    }]);
    setDndIds((ids) => [...ids, `row-new-${nextDndId.current++}`]);
  }

  return (
    <DaySectionCard
      icon={Zap}
      label="Activities"
      color="violet"
      badge={activities.length > 0 && (
        <span className="text-[10px] font-semibold text-violet-600 bg-violet-100 rounded-full px-1.5 py-0.5 shrink-0">
          {activities.length}
        </span>
      )}
      action={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addActivity}
          className="h-6 px-2 text-[11px] gap-1 border-violet-200 text-violet-700 hover:bg-violet-100 rounded-md shrink-0"
        >
          <Plus size={11} /> Add Manually
        </Button>
      }
    >
      {location ? (
        <SearchSelect
          value={null}
          onChange={handleActivitySelect}
          fetchOptions={fetchActivityOptions}
          placeholder={`Showing activities near ${location} — search by title or city…`}
        />
      ) : (
        <p className="text-[11px] text-dashboard-base-content/40 italic">
          Add route stops in Package Details to search real activities here
        </p>
      )}
      <div className="space-y-2">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext items={dndIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
            {activities.map((a, idx) => (
              <SortableActivityRow key={dndIds[idx]} dndId={dndIds[idx]}>
                <span className="flex items-center justify-center size-5 rounded-full bg-violet-100 text-violet-600 text-[10px] font-bold shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Input
                      value={a.title}
                      onChange={(e) => updateActivity(idx, { title: e.target.value })}
                      placeholder="Activity title, e.g. Paragliding"
                      className="text-sm h-8 flex-1 border-dashboard-base-300 focus-visible:ring-violet-300 focus-visible:border-violet-400 rounded-md bg-dashboard-base-100"
                    />
                    <button
                      onClick={() => removeActivity(idx)}
                      className="p-1.5 rounded hover:bg-dashboard-error/10 text-dashboard-error/70 hover:text-dashboard-error transition-colors shrink-0"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <Textarea
                    value={a.description}
                    onChange={(e) => updateActivity(idx, { description: e.target.value })}
                    placeholder="Short description of the experience…"
                    rows={2}
                    className="text-xs resize-none border-dashboard-base-300 focus-visible:ring-violet-300 focus-visible:border-violet-400 rounded-md bg-dashboard-base-100"
                  />
                  {a.photos.length > 0 && (
                    <div className="relative rounded-lg border border-dashboard-base-300 bg-dashboard-base-200/40 p-2">
                      <button
                        type="button"
                        onClick={() => updateActivity(idx, { photo: "", photos: [], photoLabels: [] })}
                        className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-dashboard-error text-white text-xs leading-none flex items-center justify-center hover:bg-dashboard-error/80 z-10"
                      >
                        ×
                      </button>
                      <div className="grid grid-cols-3 gap-1.5">
                        {a.photos.slice(0, 3).map((src, i) => (
                          <SafeImg
                            key={i}
                            src={src}
                            alt={a.photoLabels[i] || a.title || "Activity"}
                            className="h-16 w-full rounded-md object-cover border border-dashboard-base-300"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </SortableActivityRow>
            ))}
            </div>
          </SortableContext>
        </DndContext>
        {activities.length === 0 && (
          <p className="text-xs text-dashboard-base-content/40 italic">No activities added for this day.</p>
        )}
      </div>
    </DaySectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RouteStopsEditor — destination + nights per stop, like the packages route
// builder. The parent recalculates total nights/days/destination from these.
// ─────────────────────────────────────────────────────────────────────────────
function RouteStopsEditor({ stops, onChange }: {
  stops: StopInput[];
  onChange: (v: StopInput[]) => void;
}) {
  // Per-row toggle: pick from the real locations catalog (default) vs a
  // plain free-text field, for places not in the catalog yet.
  const [manualRows, setManualRows] = useState<Set<number>>(new Set());

  function addStop() {
    onChange([...stops, { name: "", nights: 1 }]);
  }
  function updateStop(idx: number, patch: Partial<StopInput>) {
    onChange(stops.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }
  function removeStop(idx: number) {
    onChange(stops.filter((_, i) => i !== idx));
    setManualRows((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => { if (i < idx) next.add(i); else if (i > idx) next.add(i - 1); });
      return next;
    });
  }
  function toggleManualRow(idx: number) {
    setManualRows((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  const totalNights = stops.reduce((sum, s) => sum + (s.nights || 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-dashboard-base-content/90 flex items-center gap-1">
          <MapPin size={11} /> Route (Destinations & Nights)
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addStop}
          className="h-6 px-2 text-[11px] gap-1 border-dashboard-base-300 rounded-md"
        >
          <Plus size={11} /> Add Stop
        </Button>
      </div>

      <div className="space-y-2">
        {stops.map((stop, idx) => {
          const isManual = manualRows.has(idx);
          return (
            <div key={idx} className="flex items-center gap-2">
              <span className="shrink-0 text-xs font-semibold text-dashboard-base-content/40 w-4 text-center">{idx + 1}</span>
              <div className="flex-1 min-w-0">
                {isManual ? (
                  <Input
                    value={stop.name}
                    onChange={(e) => updateStop(idx, { name: e.target.value })}
                    placeholder="Type a destination name…"
                    className="text-sm h-8 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
                  />
                ) : (
                  <LocationSearchSelect
                    value={stop.name ? { id: `stop-${idx}`, name: stop.name, type: "CITY", breadcrumb: stop.name, slug: "" } : null}
                    onChange={(loc: LocationValue | null) => updateStop(idx, { name: loc?.name ?? "" })}
                    types={ROUTE_STOP_TYPES}
                    placeholder="Search a location…"
                  />
                )}
              </div>
              <button
                type="button"
                onClick={() => toggleManualRow(idx)}
                title={isManual ? "Choose from locations" : "Can't find it? Type it instead"}
                className="p-1.5 rounded hover:bg-dashboard-base-300 text-dashboard-base-content/50 hover:text-dashboard-base-content transition-colors shrink-0"
              >
                {isManual ? <MapPin size={12} /> : <Pencil size={12} />}
              </button>
              <Input
                type="number" min={0}
                value={stop.nights}
                onChange={(e) => updateStop(idx, { nights: +e.target.value })}
                className="text-sm h-8 w-16 text-center border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
              />
              <span className="text-[11px] text-dashboard-base-content/50 shrink-0 w-2">N</span>
              <button
                onClick={() => removeStop(idx)}
                className="p-1.5 rounded hover:bg-dashboard-error/10 text-dashboard-error/70 hover:text-dashboard-error transition-colors shrink-0"
              >
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}
        {stops.length === 0 && (
          <p className="text-xs text-dashboard-base-content/40 italic">
            No stops added — Duration & Destination(s) below stay manually editable.
          </p>
        )}
      </div>

      {stops.length > 0 && (
        <p className="text-[11px] text-dashboard-base-content/50 mt-1.5">
          Auto duration: <span className="font-semibold text-dashboard-base-content">{totalNights + 1}D / {totalNights}N</span> — syncs Duration & Destination(s) below
        </p>
      )}
    </div>
  );
}

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

function DaySectionCard({
  icon: Icon, label, color, badge, action, children,
}: {
  icon: React.ElementType;
  label: string;
  color: keyof typeof SECTION_THEMES;
  /** Small trailing hint, e.g. a filled-in count. */
  badge?: React.ReactNode;
  /** Right-aligned header action, e.g. an "Add" button. */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const theme = SECTION_THEMES[color];
  return (
    <div className={cn("rounded-xl border overflow-hidden bg-dashboard-base-100", theme.border)}>
      <div className={cn("flex items-center gap-2 px-3 py-2", theme.headerBg)}>
        <span className={cn("flex items-center justify-center size-6 rounded-lg shrink-0", theme.iconBg, theme.iconText)}>
          <Icon size={12} />
        </span>
        <p className={cn("text-xs font-bold uppercase tracking-wide flex-1 min-w-0 truncate", theme.labelText)}>{label}</p>
        {badge}
        {action}
      </div>
      <div className="p-3 space-y-3">{children}</div>
    </div>
  );
}

/** "Remove" / "All days" pair for a DaySectionCard header — the one obvious
 * action that clears a section's pricing link (roomPricingId/cabPricingId)
 * along with its visible fields, instead of an exec having to guess that
 * blanking the name/photo text isn't enough to stop it being priced. */
function RemoveSectionActions({
  onRemove, onRemoveAll, totalDays,
}: {
  onRemove: () => void;
  onRemoveAll: () => void;
  totalDays: number;
}) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <button
        type="button"
        onClick={onRemove}
        className="flex items-center gap-1 text-[10px] font-medium text-dashboard-error/80 hover:text-dashboard-error hover:bg-dashboard-error/10 rounded px-1.5 py-0.5 transition-colors"
        title="Remove for this day (also clears its price)"
      >
        <Trash2 size={10} /> Remove
      </button>
      {totalDays > 1 && (
        <button
          type="button"
          onClick={onRemoveAll}
          className="text-[10px] font-medium text-dashboard-error/80 hover:text-dashboard-error hover:bg-dashboard-error/10 rounded px-1.5 py-0.5 transition-colors"
          title="Remove from every day (also clears their price)"
        >
          All days
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Day Itinerary Card
// ─────────────────────────────────────────────────────────────────────────────
function DayCard({
  day, data, location, totalDays, onChange, onRemove,
  onApplyVehicleToDays, onApplyRoomToDays, onRemoveRoomFromDays, onRemoveCabFromDays, stayPreference,
  focusSection, shiftedMeals,
  dayAddons, onAddAddon, onUpdateAddon, onRemoveAddon,
}: {
  day: number;
  data: DayItinerary;
  location?: string;
  totalDays: number;
  onChange: (d: DayItinerary) => void;
  onRemove: () => void;
  onApplyVehicleToDays: (vehicle: VehicleResult, dayNumbers: number[], cabPricingId: number | null) => void;
  onApplyRoomToDays: (room: HotelRoomResult, dayNumbers: number[]) => void;
  /** Clears the hotel/cab (including their pricing link) for the given day
   * numbers — used for both "remove just this day" and "remove from every
   * day" actions next to the Hotel Info / Transport section headers. */
  onRemoveRoomFromDays: (dayNumbers: number[]) => void;
  onRemoveCabFromDays: (dayNumbers: number[]) => void;
  /** Stay-type preferences from the client's requirement form (e.g. ["STAR_4", "RESORT"]) — shown as a hint above the hotel search so the exec knows what to look for. */
  stayPreference?: string[];
  /** "all" shows every section; anything else hides all but the matching
   * one, across every day card at once — see FOCUS_SECTIONS. */
  focusSection: FocusSection;
  /** This day's meals as actually served (breakfast pulled from the
   * previous day's hotel) — see computeShiftedMeals. Purely informational,
   * shown alongside the day's own raw meals (what tonight's hotel plan
   * covers), which is what's actually editable here. */
  shiftedMeals: string[];
  /** Add-ons added while working on THIS day's hotel — paired with their
   * index in the parent's full form.addOns array (not this filtered list),
   * since that's what onUpdateAddon/onRemoveAddon key off. Shown right below
   * the Hotel section; same underlying list as the Package Details tab's
   * Add-ons card, just filtered to this day plus a quick-add scoped to it. */
  dayAddons: { addon: AddonInput; index: number }[];
  onAddAddon: () => void;
  onUpdateAddon: (idx: number, patch: Partial<AddonInput>) => void;
  onRemoveAddon: (idx: number) => void;
}) {
  const [open, setOpen] = useState(true);

  // After picking a cab, offer to reuse it across the rest of the trip
  // instead of re-searching it for every day. lastCabPricingId travels
  // alongside lastVehicle so reused days stay priced too — null when the
  // pick came from the unscoped fleet catalog (no real rate to reuse).
  const [lastVehicle, setLastVehicle] = useState<VehicleResult | null>(null);
  const [lastCabPricingId, setLastCabPricingId] = useState<number | null>(null);
  const [showApplyPrompt, setShowApplyPrompt] = useState(false);
  const [customDaysOpen, setCustomDaysOpen] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  function dismissApplyPrompt() {
    setShowApplyPrompt(false);
    setCustomDaysOpen(false);
    setSelectedDays([]);
  }

  // Same pattern as the cab prompt above, but for reusing one hotel room
  // across the other nights of a multi-night stay.
  const [lastRoom, setLastRoom] = useState<HotelRoomResult | null>(null);
  const [showRoomApplyPrompt, setShowRoomApplyPrompt] = useState(false);
  const [roomCustomDaysOpen, setRoomCustomDaysOpen] = useState(false);
  const [roomSelectedDays, setRoomSelectedDays] = useState<number[]>([]);

  function dismissRoomApplyPrompt() {
    setShowRoomApplyPrompt(false);
    setRoomCustomDaysOpen(false);
    setRoomSelectedDays([]);
  }

  // Defaults to the day's auto-derived stop, but stays editable — lets a
  // sales exec search hotels/activities in a different city than the one
  // the route stops assigned this day to (e.g. no real inventory there yet).
  // Resets on every distinct `location` prop change (adjusting state during
  // render, per React's guidance, rather than via a setState-in-effect).
  const [searchCity, setSearchCity] = useState(location ?? "");
  const [prevLocation, setPrevLocation] = useState(location);
  if (location !== prevLocation) {
    setPrevLocation(location);
    setSearchCity(location ?? "");
  }

  // Geocodes the search city so hotel results can show distance-from-town —
  // debounced since searchCity is a free-text input the exec can retype.
  const [cityCoords, setCityCoords] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    // Nothing to geocode, and HotelRoomPicker already short-circuits on an
    // empty searchCity — no need to clear cityCoords synchronously here.
    if (!searchCity) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const coords = await geocodeCity(searchCity);
      if (!cancelled) setCityCoords(coords);
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [searchCity]);

  // Same pattern as searchCity/cityCoords above, for the cab search below —
  // kept independent since an exec may want to price cabs from a different
  // city than the hotel (e.g. an arrival-day transfer from the airport city).
  const [searchCabCity, setSearchCabCity] = useState(location ?? "");
  const [prevCabLocation, setPrevCabLocation] = useState(location);
  if (location !== prevCabLocation) {
    setPrevCabLocation(location);
    setSearchCabCity(location ?? "");
  }

  const [cabCityCoords, setCabCityCoords] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (!searchCabCity) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const coords = await geocodeCity(searchCabCity);
      if (!cancelled) setCabCityCoords(coords);
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [searchCabCity]);

  function toggleMeal(m: string) {
    const meals = data.meals.includes(m)
      ? data.meals.filter((x) => x !== m)
      : [...data.meals, m];
    onChange({ ...data, meals });
  }

  /** Full hotel removal for this day — clears every hotel-related field,
   * including roomPricingId (what the pricing engine actually keys off).
   * Previously an exec could only blank the visible accommodation text/photo
   * without a dedicated button, which left roomPricingId pointing at the old
   * room — the price kept showing even though the card looked empty. */
  function handleHotelRoomClear() {
    onChange({
      ...data,
      accommodation: "", accommodationPhoto: "", accommodationRoomPhotos: [],
      accommodationLocation: "", accommodationRoomSpecs: "", accommodationRoomCapacity: null,
      roomPricingId: null, roomsCount: null, extraRooms: [],
      hotelCheckIn: "", hotelCheckOut: "", hotelMealPlan: "", meals: [],
    });
  }

  /** Same idea for the cab — zeroes cabPricingId so a removed vehicle stops
   * contributing to price. Pickup/drop/distance/travel-time are left as-is
   * since those describe the route, not which vehicle covers it. */
  function handleCabRemove() {
    onChange({
      ...data,
      transport: "", transportPhoto: "", transportVehicleType: "", transportSeats: null,
      cabPricingId: null, cabQuantity: null, extraCabs: [],
    });
  }

  function handleHotelRoomSelect(raw: HotelRoomResult) {
    // Fetch which meals this room's plan actually covers instead of leaving
    // the exec to toggle them by hand — falls back to whatever was already
    // set if the plan has no structured meals configured (e.g. room-only).
    const hotelMeals = raw.coveredMeals.map((k) => MEAL_KEY_LABELS[k]).filter((v): v is string => !!v);
    onChange({
      ...data,
      accommodation: `${raw.hotelName} — ${raw.roomName}`,
      accommodationPhoto: raw.hotelPhoto ?? data.accommodationPhoto,
      accommodationRoomPhotos: raw.roomPhotos.length > 0 ? raw.roomPhotos : data.accommodationRoomPhotos,
      accommodationLocation: raw.location ?? data.accommodationLocation,
      accommodationRoomSpecs: raw.roomSpecs ?? data.accommodationRoomSpecs,
      accommodationRoomCapacity: raw.roomCapacity ?? data.accommodationRoomCapacity,
      hotelMealPlan: raw.mealPlanName ?? data.hotelMealPlan,
      meals: hotelMeals.length > 0 ? hotelMeals : data.meals,
      // The hotel's own check-in/check-out policy — previously never fetched
      // at all, so this always stayed blank unless typed in by hand. Stored
      // as 24h "HH:MM" on the hotel record (<input type="time">) — converted
      // to "2:00 PM" here so it reads the same as a hand-typed value both in
      // this field and in the document.
      hotelCheckIn: raw.checkInTime ? formatTime12h(raw.checkInTime) : data.hotelCheckIn,
      hotelCheckOut: raw.checkOutTime ? formatTime12h(raw.checkOutTime) : data.hotelCheckOut,
      // Links this night to the real hotel_room_pricing row so the package
      // price can be computed from its actual date/occupancy-aware rate.
      roomPricingId: raw.id,
    });
    if (totalDays > 1) {
      setLastRoom(raw);
      setShowRoomApplyPrompt(true);
    }
  }

  // Falls back to the unscoped fleet catalog only when there's neither a
  // city nor an exact pickup point to price against yet (e.g. route stops
  // not filled in) — once either is available, cab_pricing (real, bookable
  // rates) takes over.
  async function fetchCabOptions(query: string): Promise<Option[]> {
    const hasPickupPoint = data.transportPickupLat != null && data.transportPickupLng != null;
    if (!searchCabCity && !hasPickupPoint) {
      const results = await searchVehiclesForBuilder(query);
      return results.map((v): Option & { raw: VehicleResult } => ({
        id: v.id,
        label: v.name,
        description: `${CAB_LABELS[v.type] ?? v.type} · ${v.passengerCapacity} seats${v.hasAc ? " · AC" : ""}`,
        thumbnail: v.thumbnail ?? undefined,
        raw: v,
      }));
    }
    // Prefer the exact pickup point (chosen from the Location catalog) over
    // a geocoded guess of the city name — real coordinates make the
    // nearest-priced-city fallback and displayed distances actually accurate.
    // searchCabsForBuilder tolerates an empty city string as long as
    // refCoords is set, going straight to the nearest-priced-city fallback.
    const refCoords = hasPickupPoint
      ? { lat: data.transportPickupLat as number, lng: data.transportPickupLng as number }
      : cabCityCoords;
    const distanceRefLabel = hasPickupPoint ? data.transportPickup : searchCabCity;

    const results = await searchCabsForBuilder(searchCabCity, query, refCoords);
    return results.map((r): Option & { raw: CabPricingResult } => ({
      id: r.id,
      label: r.vehicleName,
      description: [
        `₹${r.price.toLocaleString("en-IN")}/${r.pricingType === "PER_DAY" ? "day" : r.pricingType.toLowerCase()}`,
        `${CAB_LABELS[r.vehicleType] ?? r.vehicleType} · ${r.passengerCapacity} seats${r.hasAc ? " · AC" : ""}`,
        r.cityName && r.cityName.toLowerCase() !== searchCabCity.toLowerCase()
          ? `nearest priced city: ${r.cityName}${r.distanceKm != null ? ` (${r.distanceKm} km away)` : ""}`
          : (r.distanceKm != null ? `${r.distanceKm} km from ${distanceRefLabel}` : null),
      ].filter(Boolean).join(" · "),
      thumbnail: r.thumbnail ?? undefined,
      raw: r,
    }));
  }

  function handleCabSelect(_id: number | null, option?: Option) {
    const raw = (option as (Option & { raw: VehicleResult | CabPricingResult }) | undefined)?.raw;
    if (!raw) return;
    // Only a CabPricingResult references a real, priceable cab_pricing row —
    // raw.id on a plain VehicleResult pick is a vehicles.id from the
    // unscoped fleet catalog, not a rate to compute season pricing from.
    const isPriced = "vehicleName" in raw;
    const vehicle: VehicleResult = isPriced
      ? {
          id: raw.id, name: raw.vehicleName, type: raw.vehicleType,
          passengerCapacity: raw.passengerCapacity, hasAc: raw.hasAc, thumbnail: raw.thumbnail,
        }
      : raw;
    const cabPricingId = isPriced ? raw.id : null;
    onChange({
      ...data,
      transport: vehicle.name,
      transportPhoto: vehicle.thumbnail ?? data.transportPhoto,
      transportVehicleType: CAB_LABELS[vehicle.type] ?? vehicle.type,
      transportSeats: vehicle.passengerCapacity,
      cabPricingId,
    });
    if (totalDays > 1) {
      setLastVehicle(vehicle);
      setLastCabPricingId(cabPricingId);
      setShowApplyPrompt(true);
    }
  }

  // Collapsed-state summary dots — lets an exec scan the whole trip for
  // gaps (e.g. "Day 4 has no cab yet") without opening every card.
  const hasHotel = !!data.accommodation;
  const hasCab = !!data.transport || data.cabPricingId != null;
  const hasMeals = data.meals.length > 0;
  const hasActivities = data.activities.some((a) => a.title.trim());

  return (
    <div className="rounded-2xl border border-dashboard-base-300 bg-dashboard-base-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-dashboard-base-100 border-b border-dashboard-base-300">
        <button onClick={() => setOpen(!open)} className="flex items-center gap-2 flex-1 text-left min-w-0">
          <div className="h-7 w-7 rounded-lg bg-linear-to-br from-dashboard-primary to-dashboard-primary/80 text-dashboard-primary-content text-xs font-bold flex items-center justify-center shrink-0">
            {day}
          </div>
          <div className="flex-1 min-w-0">
            {open
              ? <Input
                value={data.title}
                onChange={(e) => onChange({ ...data, title: e.target.value })}
                placeholder={`Day ${day} title…`}
                className="h-7 text-sm font-semibold border-0 p-0 shadow-none bg-transparent focus-visible:ring-0 text-dashboard-base-content"
                onClick={(e) => e.stopPropagation()}
              />
              : <span className="text-sm font-semibold truncate text-dashboard-base-content">
                {data.title || `Day ${day}`}
              </span>
            }
          </div>
          {!open && (
            <div className="flex items-center gap-1 shrink-0" title="Hotel · Transport · Meals · Activities">
              <span className={cn("size-1.5 rounded-full", hasHotel ? "bg-amber-500" : "bg-dashboard-base-300")} />
              <span className={cn("size-1.5 rounded-full", hasCab ? "bg-sky-500" : "bg-dashboard-base-300")} />
              <span className={cn("size-1.5 rounded-full", hasMeals ? "bg-emerald-500" : "bg-dashboard-base-300")} />
              <span className={cn("size-1.5 rounded-full", hasActivities ? "bg-violet-500" : "bg-dashboard-base-300")} />
            </div>
          )}
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setOpen(!open)}
            className="p-1 rounded hover:bg-dashboard-base-300 transition-colors text-dashboard-base-content/50"
          >
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            onClick={onRemove}
            className="p-1 rounded hover:bg-dashboard-error/10 text-dashboard-error transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {open && (
        <div className="p-4 space-y-4">
          {/* Description */}
          {(focusSection === "all" || focusSection === "details") && (
            <div>
              <label className="text-xs font-medium text-dashboard-base-content/90 mb-1.5 block rounded-md">Day Description</label>
              <Textarea
                value={data.description}
                onChange={(e) => onChange({ ...data, description: e.target.value })}
                placeholder="Describe the day's plan, sightseeing, transfers…"
                rows={3}
                className="text-sm resize-none border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
              />
            </div>
          )}

          {/* Accommodation */}
          {(focusSection === "all" || focusSection === "hotel") && (
          <DaySectionCard
            icon={Hotel}
            label="Hotel Info"
            color="amber"
            action={(data.accommodation || data.roomPricingId != null) && (
              <RemoveSectionActions
                onRemove={handleHotelRoomClear}
                onRemoveAll={() => onRemoveRoomFromDays(Array.from({ length: totalDays }, (_, i) => i + 1))}
                totalDays={totalDays}
              />
            )}
          >
            {stayPreference && stayPreference.length > 0 && (
              <p className="text-[11px] text-dashboard-base-content/70 -mt-1.5 flex flex-wrap items-center gap-1">
                <span className="text-dashboard-base-content/50">Client wants:</span>
                {stayPreference.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-dashboard-primary/10 text-dashboard-primary font-medium"
                  >
                    {STAY_LABELS[t] ?? t}
                  </span>
                ))}
              </p>
            )}
            <div>
              {/* No separate city field — this day's stop (from Route:
                 Destinations & Nights) is the default search scope
                 automatically. Typing a hotel name, city, or state in the
                 search itself reaches anywhere, so switching cities never
                 needs a dedicated input. */}
              <HotelRoomPicker
                value={data.roomPricingId}
                initialLabel={data.accommodation}
                searchCity={searchCity}
                refCoords={cityCoords}
                onSelect={handleHotelRoomSelect}
                onClear={handleHotelRoomClear}
                placeholder={searchCity ? `Search hotels near ${searchCity}…` : "Search hotels by name, city, or state…"}
              />
              <p className="text-[10px] text-dashboard-base-content/40 mt-1">
                {data.accommodation ? `Currently: ${data.accommodation} — click above to change it. ` : ""}
                {searchCity ? `Showing hotels near ${searchCity} by default — search above for a different city.` : "Search by hotel name, city, or state."}
              </p>
            </div>

            {/* Rooms needed — auto-computed from traveller count, but
               overridable when the group is splitting across separately
               booked rooms rather than sharing by pure occupancy. */}
            {data.roomPricingId != null && (
              <div className="flex items-center gap-2">
                <label className="text-[11px] text-dashboard-base-content/60 shrink-0">Rooms needed</label>
                <Input
                  type="number"
                  min={1}
                  value={data.roomsCount ?? ""}
                  onChange={(e) => onChange({
                    ...data,
                    roomsCount: e.target.value ? Math.max(1, parseInt(e.target.value, 10)) : null,
                  })}
                  placeholder="Auto"
                  className="text-sm h-8 w-20 shrink-0 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
                />
                <p className="text-[10px] text-dashboard-base-content/40">
                  Leave blank to auto-compute from traveller count
                </p>
              </div>
            )}

            {/* Additional, different room types for the same night — e.g. one
               couple in this room, another in a different room type. */}
            {(data.extraRooms ?? []).length > 0 && (
              <div className="space-y-2">
                {(data.extraRooms ?? []).map((room, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg border border-dashboard-base-300 p-2">
                    <div className="flex-1 min-w-0">
                      <HotelRoomPicker
                        value={room.roomPricingId || null}
                        initialLabel={room.label}
                        searchCity={searchCity}
                        refCoords={cityCoords}
                        onSelect={(r) => {
                          const next = [...(data.extraRooms ?? [])];
                          next[i] = {
                            roomPricingId: r.id,
                            label: `${r.hotelName} — ${r.roomName}`,
                            quantity: next[i].quantity,
                            thumbnail: r.roomPhotos[0] ?? r.hotelPhoto ?? null,
                            roomCapacity: r.roomCapacity,
                            roomSpecs: r.roomSpecs,
                          };
                          onChange({ ...data, extraRooms: next });
                        }}
                        onClear={() => {
                          const next = [...(data.extraRooms ?? [])];
                          next[i] = { ...next[i], roomPricingId: 0, label: "" };
                          onChange({ ...data, extraRooms: next });
                        }}
                        placeholder="Search another room type…"
                      />
                    </div>
                    <Input
                      type="number"
                      min={1}
                      value={room.quantity}
                      onChange={(e) => {
                        const next = [...(data.extraRooms ?? [])];
                        next[i] = { ...next[i], quantity: Math.max(1, parseInt(e.target.value, 10) || 1) };
                        onChange({ ...data, extraRooms: next });
                      }}
                      className="text-sm h-9 w-16 shrink-0 border-dashboard-base-300 rounded-md"
                    />
                    <Button
                      type="button" variant="ghost" size="icon"
                      className="h-9 w-9 shrink-0 text-dashboard-error hover:bg-dashboard-error/10"
                      onClick={() => onChange({
                        ...data,
                        extraRooms: (data.extraRooms ?? []).filter((_, idx) => idx !== i),
                      })}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button
              type="button" variant="outline" size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => onChange({
                ...data,
                extraRooms: [...(data.extraRooms ?? []), { roomPricingId: 0, label: "", quantity: 1 }],
              })}
            >
              <Plus size={12} /> Add another room type
            </Button>

            {showRoomApplyPrompt && lastRoom && (
              <div className="mb-2 rounded-md border border-dashboard-primary/30 bg-dashboard-primary/5 px-2.5 py-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-dashboard-base-content/80">
                    Use <span className="font-medium">{lastRoom.hotelName} — {lastRoom.roomName}</span> for other nights too?
                  </p>
                  <button
                    type="button"
                    onClick={dismissRoomApplyPrompt}
                    className="text-dashboard-base-content/40 hover:text-dashboard-base-content/70 shrink-0"
                  >
                    <X size={12} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button" size="sm" variant="outline"
                    className="h-6 text-[11px] px-2"
                    onClick={() => {
                      onApplyRoomToDays(lastRoom, Array.from({ length: totalDays }, (_, i) => i + 1));
                      dismissRoomApplyPrompt();
                    }}
                  >
                    All {totalDays} days
                  </Button>
                  <Button
                    type="button" size="sm" variant="outline"
                    className="h-6 text-[11px] px-2"
                    onClick={() => setRoomCustomDaysOpen((v) => !v)}
                  >
                    Custom days…
                  </Button>
                  <Button
                    type="button" size="sm" variant="ghost"
                    className="h-6 text-[11px] px-2"
                    onClick={dismissRoomApplyPrompt}
                  >
                    Just this day
                  </Button>
                </div>
                {roomCustomDaysOpen && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-dashboard-primary/20">
                    {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setRoomSelectedDays((prev) =>
                          prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
                        )}
                        className={cn(
                          "h-6 w-6 rounded-md border text-[11px] font-medium transition-colors",
                          roomSelectedDays.includes(d)
                            ? "bg-dashboard-primary text-dashboard-primary-content border-dashboard-primary"
                            : "border-dashboard-base-300 text-dashboard-base-content/70 hover:bg-dashboard-base-200",
                        )}
                      >
                        {d}
                      </button>
                    ))}
                    <Button
                      type="button" size="sm"
                      className="h-6 text-[11px] px-2 ml-1"
                      disabled={roomSelectedDays.length === 0}
                      onClick={() => {
                        onApplyRoomToDays(lastRoom, roomSelectedDays);
                        dismissRoomApplyPrompt();
                      }}
                    >
                      Apply to {roomSelectedDays.length || ""} day{roomSelectedDays.length !== 1 ? "s" : ""}
                    </Button>
                  </div>
                )}
              </div>
            )}

            <HotelPhotoGallery
              hotelPhoto={data.accommodationPhoto || undefined}
              roomPhotos={data.accommodationRoomPhotos}
              alt={data.accommodation || "Hotel"}
              onClear={() => onChange({ ...data, accommodationPhoto: "", accommodationRoomPhotos: [] })}
            />
            <Input
              value={data.accommodation}
              onChange={(e) => onChange({ ...data, accommodation: e.target.value })}
              placeholder="Hotel name / type"
              className="text-sm h-9 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-dashboard-base-content/60 mb-1 block">Location</label>
                <Input
                  value={data.accommodationLocation}
                  onChange={(e) => onChange({ ...data, accommodationLocation: e.target.value })}
                  placeholder="City, State"
                  className="text-sm h-8 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
                />
              </div>
              <div>
                <label className="text-[11px] text-dashboard-base-content/60 mb-1 block">Room Specs</label>
                <Input
                  value={data.accommodationRoomSpecs}
                  onChange={(e) => onChange({ ...data, accommodationRoomSpecs: e.target.value })}
                  placeholder="1 Double Bed | Mountain View"
                  className="text-sm h-8 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-dashboard-base-content/60 mb-1 flex items-center gap-1 block">
                  <LogIn size={10} /> Check-In
                </label>
                <Input
                  value={data.hotelCheckIn}
                  onChange={(e) => onChange({ ...data, hotelCheckIn: e.target.value })}
                  placeholder="2:00 PM"
                  className="text-sm h-8 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
                />
              </div>
              <div>
                <label className="text-[11px] text-dashboard-base-content/60 mb-1 flex items-center gap-1 block">
                  <LogOut size={10} /> Check-Out
                </label>
                <Input
                  value={data.hotelCheckOut}
                  onChange={(e) => onChange({ ...data, hotelCheckOut: e.target.value })}
                  placeholder="11:00 AM"
                  className="text-sm h-8 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] text-dashboard-base-content/60 mb-1 block">Meal Plan</label>
              <Input
                value={data.hotelMealPlan}
                onChange={(e) => onChange({ ...data, hotelMealPlan: e.target.value })}
                placeholder="MAP - Breakfast & Dinner"
                className="text-sm h-8 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
              />
            </div>
          </DaySectionCard>
          )}

          {/* Add-ons added for this day — shown right below the Hotel section */}
          {(focusSection === "all" || focusSection === "hotel") && (
          <DaySectionCard
            icon={Gift}
            label="Add-ons"
            color="rose"
            badge={dayAddons.length > 0 && (
              <span className="text-[10px] font-semibold text-rose-600 bg-rose-100 rounded-full px-1.5 py-0.5 shrink-0">
                {dayAddons.length}
              </span>
            )}
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onAddAddon}
                className="h-6 px-2 text-[11px] gap-1 border-rose-200 text-rose-700 hover:bg-rose-100 rounded-md shrink-0"
              >
                <Plus size={11} /> Add Add-on
              </Button>
            }
          >
            <p className="text-[11px] text-dashboard-base-content/50 -mt-1">
              Honeymoon kit, permits, etc. added for this day — priced into the package total, shown here in the itinerary
              document under Day {day}&apos;s hotel.
            </p>
            {dayAddons.length === 0 ? (
              <p className="text-[11px] text-dashboard-base-content/40 italic">No add-ons for this day yet.</p>
            ) : (
              <div className="space-y-2">
                {dayAddons.map(({ addon, index }) => (
                  <div key={index} className="rounded-lg border border-rose-100 bg-rose-50/30 p-2.5 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Input
                        value={addon.name}
                        onChange={(e) => onUpdateAddon(index, { name: e.target.value })}
                        placeholder="e.g. Honeymoon Kit"
                        className="text-sm h-8 flex-1 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md bg-dashboard-base-100"
                      />
                      <Input
                        type="number" min={0}
                        value={addon.price ?? ""}
                        onChange={(e) => onUpdateAddon(index, { price: e.target.value ? Number(e.target.value) : null })}
                        placeholder="₹ / unit"
                        className="text-sm h-8 w-24 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md bg-dashboard-base-100"
                      />
                      <Input
                        type="number" min={1}
                        value={addon.quantity}
                        onChange={(e) => onUpdateAddon(index, { quantity: e.target.value ? Number(e.target.value) : 1 })}
                        placeholder="Qty"
                        className="text-sm h-8 w-16 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md bg-dashboard-base-100"
                      />
                      <span className="text-xs font-semibold text-dashboard-base-content/70 w-20 text-right shrink-0">
                        ₹{((addon.price ?? 0) * (addon.quantity || 1)).toLocaleString("en-IN")}
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemoveAddon(index)}
                        className="p-1.5 rounded hover:bg-dashboard-error/10 text-dashboard-error/70 hover:text-dashboard-error transition-colors shrink-0"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <Textarea
                      value={addon.notes}
                      onChange={(e) => onUpdateAddon(index, { notes: e.target.value })}
                      placeholder="What's included — e.g. candle light dinner, cake, bed decoration…"
                      rows={2}
                      className="text-xs resize-none border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md bg-dashboard-base-100"
                    />
                  </div>
                ))}
              </div>
            )}
          </DaySectionCard>
          )}

          {/* Transport */}
          {(focusSection === "all" || focusSection === "cab") && (
          <DaySectionCard
            icon={Car}
            label="Transport / Cab"
            color="sky"
            action={(data.transport || data.cabPricingId != null) && (
              <RemoveSectionActions
                onRemove={handleCabRemove}
                onRemoveAll={() => onRemoveCabFromDays(Array.from({ length: totalDays }, (_, i) => i + 1))}
                totalDays={totalDays}
              />
            )}
          >
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <label className="text-[11px] text-dashboard-base-content/60 mb-1 block">Pickup Point</label>
                <LocationSearchSelect
                  value={data.transportPickup
                    ? {
                        id: "pickup", name: data.transportPickup, type: "AREA",
                        breadcrumb: data.transportPickup, slug: "",
                        latitude: data.transportPickupLat, longitude: data.transportPickupLng,
                      }
                    : null}
                  onChange={(loc: LocationValue | null) => onChange({
                    ...data,
                    transportPickup:    loc?.name ?? "",
                    transportPickupLat: loc?.latitude ?? null,
                    transportPickupLng: loc?.longitude ?? null,
                  })}
                  types={TRANSFER_TYPES}
                  placeholder="Search a pickup location…"
                />
                {data.transportPickupLat != null && (
                  <p className="text-[10px] text-dashboard-base-content/40 mt-1">
                    Located — cab search below prioritizes this exact point.
                  </p>
                )}
              </div>
              <div>
                <label className="text-[11px] text-dashboard-base-content/60 mb-1 block">Drop Point</label>
                <Input
                  value={data.transportDrop}
                  onChange={(e) => onChange({ ...data, transportDrop: e.target.value })}
                  placeholder="Drop point"
                  className="text-sm h-9 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
                />
              </div>
            </div>

            <div className="mb-2">
              <label className="text-[11px] text-dashboard-base-content/60 mb-1 block">
                Search location (city) — defaults to this day&apos;s stop, editable
              </label>
              <Input
                value={searchCabCity}
                onChange={(e) => setSearchCabCity(e.target.value)}
                placeholder="e.g. Manali"
                className="text-sm h-8 mb-2 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
              />
              <SearchSelect
                value={null}
                onChange={handleCabSelect}
                fetchOptions={fetchCabOptions}
                placeholder={
                  searchCabCity ? `Search cabs in ${searchCabCity}…`
                    : data.transportPickup ? `Search cabs near ${data.transportPickup}…`
                    : "Search cab / vehicle fleet…"
                }
              />
              {(searchCabCity || data.transportPickup) && (
                <p className="text-[10px] text-dashboard-base-content/40 mt-1">
                  Shows real cab pricing for {searchCabCity || data.transportPickup} — or the nearest city with rates configured, if none exist there yet.
                </p>
              )}
            </div>

            {/* Cab quantity — e.g. 2 of the same vehicle for a large group. */}
            {data.cabPricingId != null && (
              <div className="flex items-center gap-2 mb-2">
                <label className="text-[11px] text-dashboard-base-content/60 shrink-0">Quantity</label>
                <Input
                  type="number"
                  min={1}
                  value={data.cabQuantity ?? ""}
                  onChange={(e) => onChange({
                    ...data,
                    cabQuantity: e.target.value ? Math.max(1, parseInt(e.target.value, 10)) : null,
                  })}
                  placeholder="1"
                  className="text-sm h-8 w-20 shrink-0 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
                />
              </div>
            )}

            {/* Additional, different cabs for the same day — e.g. one sedan
               plus one SUV, each with its own quantity. */}
            {(data.extraCabs ?? []).length > 0 && (
              <div className="space-y-2 mb-2">
                {(data.extraCabs ?? []).map((cab, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg border border-dashboard-base-300 p-2">
                    <div className="flex-1 min-w-0">
                      <SearchSelect
                        value={null}
                        onChange={(_id, option) => {
                          const raw = (option as (Option & { raw: VehicleResult | CabPricingResult }) | undefined)?.raw;
                          if (!raw) return;
                          const isPriced = "vehicleName" in raw;
                          const vehicleType = isPriced ? raw.vehicleType : raw.type;
                          const next = [...(data.extraCabs ?? [])];
                          next[i] = {
                            cabPricingId: isPriced ? raw.id : null,
                            label: isPriced ? raw.vehicleName : raw.name,
                            quantity: next[i].quantity,
                            vehicleType: CAB_LABELS[vehicleType] ?? vehicleType,
                            seats: raw.passengerCapacity,
                            thumbnail: raw.thumbnail ?? null,
                          };
                          onChange({ ...data, extraCabs: next });
                        }}
                        fetchOptions={fetchCabOptions}
                        placeholder={cab.label || "Search another cab…"}
                      />
                    </div>
                    <Input
                      type="number"
                      min={1}
                      value={cab.quantity}
                      onChange={(e) => {
                        const next = [...(data.extraCabs ?? [])];
                        next[i] = { ...next[i], quantity: Math.max(1, parseInt(e.target.value, 10) || 1) };
                        onChange({ ...data, extraCabs: next });
                      }}
                      className="text-sm h-9 w-16 shrink-0 border-dashboard-base-300 rounded-md"
                    />
                    <Button
                      type="button" variant="ghost" size="icon"
                      className="h-9 w-9 shrink-0 text-dashboard-error hover:bg-dashboard-error/10"
                      onClick={() => onChange({
                        ...data,
                        extraCabs: (data.extraCabs ?? []).filter((_, idx) => idx !== i),
                      })}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button
              type="button" variant="outline" size="sm"
              className="h-8 text-xs gap-1.5 mb-2"
              onClick={() => onChange({
                ...data,
                extraCabs: [...(data.extraCabs ?? []), { cabPricingId: null, label: "", quantity: 1 }],
              })}
            >
              <Plus size={12} /> Add another cab
            </Button>

            {showApplyPrompt && lastVehicle && (
              <div className="mb-2 rounded-md border border-dashboard-primary/30 bg-dashboard-primary/5 px-2.5 py-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-dashboard-base-content/80">
                    Use <span className="font-medium">{lastVehicle.name}</span> for other days too?
                  </p>
                  <button
                    type="button"
                    onClick={dismissApplyPrompt}
                    className="text-dashboard-base-content/40 hover:text-dashboard-base-content/70 shrink-0"
                  >
                    <X size={12} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button" size="sm" variant="outline"
                    className="h-6 text-[11px] px-2"
                    onClick={() => {
                      onApplyVehicleToDays(lastVehicle, Array.from({ length: totalDays }, (_, i) => i + 1), lastCabPricingId);
                      dismissApplyPrompt();
                    }}
                  >
                    All {totalDays} days
                  </Button>
                  <Button
                    type="button" size="sm" variant="outline"
                    className="h-6 text-[11px] px-2"
                    onClick={() => setCustomDaysOpen((v) => !v)}
                  >
                    Custom days…
                  </Button>
                  <Button
                    type="button" size="sm" variant="ghost"
                    className="h-6 text-[11px] px-2"
                    onClick={dismissApplyPrompt}
                  >
                    Just this day
                  </Button>
                </div>
                {customDaysOpen && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-dashboard-primary/20">
                    {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setSelectedDays((prev) =>
                          prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
                        )}
                        className={cn(
                          "h-6 w-6 rounded-md border text-[11px] font-medium transition-colors",
                          selectedDays.includes(d)
                            ? "bg-dashboard-primary text-dashboard-primary-content border-dashboard-primary"
                            : "border-dashboard-base-300 text-dashboard-base-content/70 hover:bg-dashboard-base-200",
                        )}
                      >
                        {d}
                      </button>
                    ))}
                    <Button
                      type="button" size="sm"
                      className="h-6 text-[11px] px-2 ml-1"
                      disabled={selectedDays.length === 0}
                      onClick={() => {
                        onApplyVehicleToDays(lastVehicle, selectedDays, lastCabPricingId);
                        dismissApplyPrompt();
                      }}
                    >
                      Apply to {selectedDays.length || ""} day{selectedDays.length !== 1 ? "s" : ""}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {data.transportPhoto && (
              <div className="mb-2">
                <PhotoPreview
                  src={data.transportPhoto}
                  alt={data.transport || "Vehicle"}
                  onRemove={() => onChange({ ...data, transportPhoto: "" })}
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <Input
                value={data.transport}
                onChange={(e) => onChange({ ...data, transport: e.target.value })}
                placeholder="Vehicle name"
                className="text-sm h-9 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
              />
              <Input
                value={data.transportVehicleType}
                onChange={(e) => onChange({ ...data, transportVehicleType: e.target.value })}
                placeholder="Type, e.g. SUV"
                className="text-sm h-9 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                value={data.transportSeats ?? ""}
                onChange={(e) => onChange({ ...data, transportSeats: e.target.value ? Number(e.target.value) : null })}
                placeholder="Seats"
                className="text-sm h-9 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
              />
              <Input
                type="number"
                value={data.transportDistanceKm ?? ""}
                onChange={(e) => onChange({ ...data, transportDistanceKm: e.target.value ? Number(e.target.value) : null })}
                placeholder="Distance (km)"
                className="text-sm h-9 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
              />
            </div>
            <div className="mt-2">
              <Input
                value={data.transportTravelTime}
                onChange={(e) => onChange({ ...data, transportTravelTime: e.target.value })}
                placeholder="Estimated travel time, e.g. 3h 15m"
                className="text-sm h-9 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
              />
            </div>
          </DaySectionCard>
          )}

          {/* Meals */}
          {(focusSection === "all" || focusSection === "meals") && (
          <DaySectionCard icon={Utensils} label="Meals Included" color="emerald">
            {/* What's actually eaten ON this day — breakfast is pulled from
               the PREVIOUS day's hotel (see computeShiftedMeals), matching
               the Day-wise Summary table and the client-facing document.
               Purely informational: nothing here is directly editable,
               since it's derived from two different days' data. */}
            <div className="rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Actually served on Day {day}</p>
              <p className="text-xs text-emerald-800 mt-0.5">
                {shiftedMeals.length > 0 ? shiftedMeals.join(", ") : "No meals"}
              </p>
            </div>
            <p className="text-[10px] text-dashboard-base-content/50">
              This hotel&apos;s plan covers (tonight&apos;s dinner + tomorrow&apos;s breakfast, if included):
            </p>
            {data.roomPricingId != null ? (
              // A real room is selected — its meal plan is fixed (covered_meals
              // on the room's meal_type), so only those meals show and none can
              // be toggled on/off here; clear the room search to go back to
              // free-text meals below.
              <>
                <div className="flex flex-wrap gap-2">
                  {data.meals.length > 0 ? (
                    data.meals.map((m) => (
                      <span
                        key={m}
                        className="text-xs px-3 py-1 rounded-full border font-medium bg-emerald-600 text-white border-emerald-600"
                      >
                        {m}
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] text-dashboard-base-content/40 italic">No meals included with this room</span>
                  )}
                </div>
                <p className="text-[10px] text-dashboard-base-content/40 mt-1">
                  Set by the selected room&apos;s meal plan.
                </p>
              </>
            ) : (
              <div className="flex flex-wrap gap-2">
                {MEAL_OPTIONS.map((m) => (
                  <button
                    key={m}
                    onClick={() => toggleMeal(m)}
                    className={cn(
                      "text-xs px-3 py-1 rounded-full border font-medium transition-all",
                      data.meals.includes(m)
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-dashboard-base-200 text-dashboard-base-content/50 border-dashboard-base-300 hover:border-emerald-400 hover:text-emerald-700 cursor-pointer"
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </DaySectionCard>
          )}

          {/* Activities */}
          {(focusSection === "all" || focusSection === "activities") && (
            <ActivityListEditor
              activities={data.activities}
              location={searchCity}
              onChange={(activities) => onChange({ ...data, activities })}
            />
          )}

          {/* Notes */}
          {(focusSection === "all" || focusSection === "details") && (
            <div>
              <label className="text-xs font-medium text-dashboard-base-content/90 mb-1.5 block">Notes</label>
              <Input
                value={data.notes}
                onChange={(e) => onChange({ ...data, notes: e.target.value })}
                placeholder="Any additional note for this day…"
                className="text-sm h-9 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Form State Type
// ─────────────────────────────────────────────────────────────────────────────
interface PackageForm {
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
  pricePerPerson: string;
  totalPrice: string;
  marginPercentage: string;
  gstPercentage: string;
  currency: string;
  inclusions: string[];
  exclusions: string[];
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

/** Sum of stop nights → total nights/days + a joined destination string. */
function recalcFromStops(stops: StopInput[]) {
  const totalNights = stops.reduce((sum, s) => sum + (s.nights || 0), 0);
  return {
    totalNights,
    totalDays: totalNights + 1,
    destination: stops.map((s) => s.name).filter(Boolean).join(", "),
  };
}

/**
 * One location name per day, derived from the route stops' night counts —
 * e.g. stops [Manali·2N, Shimla·1N] → [Manali, Manali, Shimla, Shimla] for a
 * 4-day trip (the trailing day inherits the last stop, as the departure day).
 * Powers the hotel/activity search scoping per day without a separate
 * persisted "day → stop" mapping.
 */
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

const emptyDay = (day: number): DayItinerary => ({
  day, title: "", description: "", activities: [],
  meals: [], accommodation: "", accommodationPhoto: "", accommodationRoomPhotos: [],
  accommodationLocation: "", accommodationRoomSpecs: "", accommodationRoomCapacity: null,
  roomPricingId: null,
  hotelCheckIn: "", hotelCheckOut: "", hotelMealPlan: "",
  transport: "", transportPhoto: "", transportVehicleType: "", transportSeats: null,
  transportPickup: "", transportPickupLat: null, transportPickupLng: null,
  transportDrop: "", transportDistanceKm: null, transportTravelTime: "",
  cabPricingId: null,
  notes: "",
});

const emptyTicket = (type: "FLIGHT" | "TRAIN"): TicketInput => ({
  type, provider: "", ticketNumber: "",
  fromPlace: "", toPlace: "", travelDate: "", departureTime: "", arrivalTime: "", durationText: "",
  adults: 0, children: 0, infants: 0, ticketCount: 1,
  fare: null, notes: "",
});

/** "14:30", "09:05" (24h, matches <input type="time">) → minutes-since-midnight,
 * assuming arrival is the next day when it's earlier than departure. */
function computeDurationText(departureTime: string, arrivalTime: string): string {
  if (!departureTime || !arrivalTime) return "";
  const [dh, dm] = departureTime.split(":").map(Number);
  const [ah, am] = arrivalTime.split(":").map(Number);
  if ([dh, dm, ah, am].some((n) => Number.isNaN(n))) return "";
  let diff = (ah * 60 + am) - (dh * 60 + dm);
  if (diff < 0) diff += 24 * 60;
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/** One flight or train leg — every field the exec would need for a ticket
 * confirmation (pax breakdown, travel date, times, auto-computed journey
 * length, fare). Journey length is derived, not typed. */
function TicketEditorCard({
  ticket, onChange, onRemove,
}: {
  ticket: TicketInput;
  onChange: (patch: Partial<TicketInput>) => void;
  onRemove: () => void;
}) {
  const Icon = ticket.type === "FLIGHT" ? Plane : TrainFront;

  function text(key: keyof TicketInput) {
    return (e: React.ChangeEvent<HTMLInputElement>) => onChange({ [key]: e.target.value });
  }
  function num(key: keyof TicketInput) {
    return (e: React.ChangeEvent<HTMLInputElement>) => onChange({ [key]: e.target.value ? Number(e.target.value) : 0 });
  }
  // Journey length is derived from both times, not typed — recompute it
  // against whichever field just changed plus whatever the other already was.
  function time(key: "departureTime" | "arrivalTime") {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      const departureTime = key === "departureTime" ? value : ticket.departureTime;
      const arrivalTime = key === "arrivalTime" ? value : ticket.arrivalTime;
      onChange({ [key]: value, durationText: computeDurationText(departureTime, arrivalTime) });
    };
  }

  return (
    <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-bold text-dashboard-base-content">
          <Icon size={13} className="text-dashboard-primary" /> {ticket.type === "FLIGHT" ? "Flight" : "Train"}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="p-1 rounded hover:bg-dashboard-error/10 text-dashboard-error transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Input
          value={ticket.provider}
          onChange={text("provider")}
          placeholder={ticket.type === "FLIGHT" ? "Airline, e.g. IndiGo" : "Train name, e.g. Rajdhani Express"}
          className="text-sm h-8 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
        />
        <Input
          value={ticket.ticketNumber}
          onChange={text("ticketNumber")}
          placeholder={ticket.type === "FLIGHT" ? "Flight no., e.g. 6E-204" : "Train no., e.g. 12951"}
          className="text-sm h-8 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Input
          value={ticket.fromPlace}
          onChange={text("fromPlace")}
          placeholder="Departure (from)"
          className="text-sm h-8 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
        />
        <Input
          value={ticket.toPlace}
          onChange={text("toPlace")}
          placeholder="Arrival (to)"
          className="text-sm h-8 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
        />
      </div>

      <div>
        <label className="text-[10px] text-dashboard-base-content/50 mb-0.5 block">Travel date</label>
        <Input
          type="date"
          min={new Date().toISOString().slice(0, 10)}
          value={ticket.travelDate}
          onChange={text("travelDate")}
          className="text-sm h-8 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-dashboard-base-content/50 mb-0.5 block">Departure time</label>
          <Input
            type="time"
            value={ticket.departureTime}
            onChange={time("departureTime")}
            className="text-sm h-8 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
          />
        </div>
        <div>
          <label className="text-[10px] text-dashboard-base-content/50 mb-0.5 block">Arrival time</label>
          <Input
            type="time"
            value={ticket.arrivalTime}
            onChange={time("arrivalTime")}
            className="text-sm h-8 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
          />
        </div>
      </div>

      {ticket.durationText && (
        <p className="text-[11px] text-dashboard-base-content/60 flex items-center gap-1 -mt-1">
          <Icon size={10} className="text-dashboard-primary" /> Journey length: <span className="font-semibold text-dashboard-base-content">{ticket.durationText}</span>
        </p>
      )}

      <div className="grid grid-cols-4 gap-2">
        <div>
          <label className="text-[10px] text-dashboard-base-content/50 mb-0.5 block">Adults</label>
          <Input type="number" min={0} value={ticket.adults} onChange={num("adults")} className="text-sm h-8 border-dashboard-base-300 rounded-md" />
        </div>
        <div>
          <label className="text-[10px] text-dashboard-base-content/50 mb-0.5 block">Children</label>
          <Input type="number" min={0} value={ticket.children} onChange={num("children")} className="text-sm h-8 border-dashboard-base-300 rounded-md" />
        </div>
        <div>
          <label className="text-[10px] text-dashboard-base-content/50 mb-0.5 block">Infants</label>
          <Input type="number" min={0} value={ticket.infants} onChange={num("infants")} className="text-sm h-8 border-dashboard-base-300 rounded-md" />
        </div>
        <div>
          <label className="text-[10px] text-dashboard-base-content/50 mb-0.5 block">No. of tickets</label>
          <Input type="number" min={0} value={ticket.ticketCount} onChange={num("ticketCount")} className="text-sm h-8 border-dashboard-base-300 rounded-md" />
        </div>
      </div>

      <div>
        <label className="text-[10px] text-dashboard-base-content/50 mb-0.5 block flex items-center gap-1">
          <IndianRupee size={9} /> Fare (total for this ticket)
        </label>
        <Input
          type="number" min={0}
          value={ticket.fare ?? ""}
          onChange={(e) => onChange({ fare: e.target.value ? Number(e.target.value) : null })}
          placeholder="0"
          className="text-sm h-8 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
        />
      </div>

      <Textarea
        value={ticket.notes}
        onChange={(e) => onChange({ notes: e.target.value })}
        placeholder="Notes (optional) — e.g. class, baggage allowance"
        rows={2}
        className="text-xs resize-none border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
      />
    </div>
  );
}

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
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendLinks, setSendLinks] = useState<{ whatsappUrl: string; shareUrl: string } | null>(null);

  const [form, setForm] = useState<PackageForm>({
    title: "", description: "", coverImage: "", coverImagePosition: 50, destination: "", startingPoint: "",
    totalDays: 3, totalNights: 2, travelDate: "",
    adults: 1, children: 0, infants: 0,
    pricePerPerson: "", totalPrice: "",
    marginPercentage: "25", gstPercentage: "5",
    currency: "INR",
    inclusions: DEFAULT_INCLUSIONS,
    exclusions: DEFAULT_EXCLUSIONS,
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

  // ── Current user's role — gates editing of the standard content lists ──────
  useEffect(() => {
    let cancelled = false;
    getCurrentUserRole().then((role) => {
      if (!cancelled) setUserRole(role);
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
      setForm((f) => ({
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
  }, []);

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

      setForm((f) => ({
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
        setForm((f) => ({
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
  }, [packageId, fromQueryId]);

  // ── Auto-calc total price ──────────────────────────────────────────────────
  useEffect(() => {
    const pp = parseFloat(form.pricePerPerson);
    if (!isNaN(pp)) {
      setForm((f) => ({ ...f, totalPrice: String(pp * (f.adults + f.children)) }));
    }
  }, [form.pricePerPerson, form.adults, form.children]);

  // ── Auto-price from travel date + hotel selected + pax counts ──────────────
  // Recomputes the real hotel cost (season/occupancy-aware) whenever any of
  // those three inputs change — the sales exec still applies it manually via
  // the "Use this price" button so an already-typed price isn't clobbered.
  const roomPricingKey = form.itineraries
    .map((it) => `${it.day}:${it.roomPricingId ?? ""}:${it.roomsCount ?? ""}:${JSON.stringify(it.extraRooms ?? [])}`)
    .join("|");
  useEffect(() => {
    const days = form.itineraries.map((it) => ({
      day: it.day, roomPricingId: it.roomPricingId, roomsCount: it.roomsCount, extraRooms: it.extraRooms,
    }));
    if (days.every((d) => d.roomPricingId == null && (d.extraRooms ?? []).length === 0)) {
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
  const cabPricingKey = form.itineraries
    .map((it) => `${it.day}:${it.cabPricingId ?? ""}:${it.transportDistanceKm ?? ""}:${it.cabQuantity ?? ""}:${JSON.stringify(it.extraCabs ?? [])}`)
    .join("|");
  useEffect(() => {
    const days = form.itineraries.map((it) => ({
      day: it.day, cabPricingId: it.cabPricingId, transportDistanceKm: it.transportDistanceKm,
      cabQuantity: it.cabQuantity, extraCabs: it.extraCabs,
    }));
    if (days.every((d) => d.cabPricingId == null && (d.extraCabs ?? []).length === 0)) {
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
        setSavedOk(true);
        setTimeout(() => setSavedOk(false), 3000);
      }
    });
  }

  // ── Send ───────────────────────────────────────────────────────────────────
  function handleSend() {
    startSend(async () => {
      // Always save first — sendPackageToClient reads straight from the DB
      // row, so any edit made since the last save (a freshly-pasted payment
      // link, a price tweak, a room swap) would otherwise silently never
      // reach the client if the package already existed.
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
      if (!result.success) return;

      const result2 = await sendPackageToClient(packageId);
      if (result2.success && result2.whatsappUrl && result2.shareUrl) {
        setSendLinks({ whatsappUrl: result2.whatsappUrl, shareUrl: result2.shareUrl });
        setSendDialogOpen(true);
      } else if (!result2.success) {
        toast.error(result2.error ?? "Failed to send package");
      }
    });
  }

  // ── Day helpers ────────────────────────────────────────────────────────────
  // Appends blank day cards to reach targetDays — never removes any, even
  // when targetDays is smaller, so a mis-typed Duration can never silently
  // wipe out a day an exec already filled in. Shrinking is only ever done
  // explicitly, via the "Sync now" button on the day-count mismatch warning.
  function growItinerariesTo(itineraries: DayItinerary[], targetDays: number): DayItinerary[] {
    if (targetDays <= itineraries.length) return itineraries;
    const extra = Array.from(
      { length: targetDays - itineraries.length },
      (_, i) => emptyDay(itineraries.length + i + 1),
    );
    return [...itineraries, ...extra];
  }

  // "Sync now" on the mismatch warning — reconciles the day cards to exactly
  // match Duration, in either direction. Removing days here is an explicit,
  // informed click (unlike the Duration field itself, which only ever grows
  // the list) so trimming trailing, presumably-unwanted day cards is safe.
  function syncItinerariesToDuration() {
    setForm((f) => {
      const target = f.totalDays;
      const itineraries = target >= f.itineraries.length
        ? growItinerariesTo(f.itineraries, target)
        : f.itineraries.slice(0, target);
      return { ...f, itineraries };
    });
  }

  function addDay() {
    setForm((f) => {
      const next = f.itineraries.length + 1;
      return {
        ...f,
        itineraries: [...f.itineraries, emptyDay(next)],
        totalDays: next,
        totalNights: next - 1,
      };
    });
  }

  function removeDay(idx: number) {
    setForm((f) => {
      const days = f.itineraries
        .filter((_, i) => i !== idx)
        .map((d, i) => ({ ...d, day: i + 1 }));
      return { ...f, itineraries: days, totalDays: days.length, totalNights: Math.max(0, days.length - 1) };
    });
  }

  function updateDay(idx: number, day: DayItinerary) {
    setForm((f) => {
      const its = [...f.itineraries];
      its[idx] = day;
      return { ...f, itineraries: its };
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

  function addTicket(type: "FLIGHT" | "TRAIN") {
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
              hotelMealPlan: room.mealPlanName ?? it.hotelMealPlan,
              meals: hotelMeals.length > 0 ? hotelMeals : it.meals,
              hotelCheckIn: room.checkInTime ? formatTime12h(room.checkInTime) : it.hotelCheckIn,
              hotelCheckOut: room.checkOutTime ? formatTime12h(room.checkOutTime) : it.hotelCheckOut,
              roomPricingId: room.id,
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
              roomPricingId: null, roomsCount: null, extraRooms: [],
              hotelCheckIn: "", hotelCheckOut: "", hotelMealPlan: "", meals: [],
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

  const dayLocations = deriveDayLocations(form.stops, form.itineraries.length);
  const shiftedMeals = computeShiftedMeals(form.itineraries);
  // Per-section completion, for the focus-mode filter's "3/6" badges.
  const dayFlags = form.itineraries.map((d) => ({
    hotel: !!d.accommodation,
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
    inclusions: [...form.inclusions, ...form.extraPolicyItems.inclusions],
    exclusions: [...form.exclusions, ...form.extraPolicyItems.exclusions],
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

            <ItineraryPdfExport form={previewForm} />

            <Button
              size="sm"
              className="h-8 gap-1.5 bg-dashboard-success text-dashboard-success-content hover:bg-dashboard-success/90 rounded-md"
              onClick={handleSend}
              disabled={isSending || isSaving}
            >
              {isSending
                ? <Loader2 size={13} className="animate-spin" />
                : <Send size={13} />
              }
              <span className="hidden sm:inline text-xs">Send to Client</span>
            </Button>
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
      <div className="print-reset flex justify-center relative h-[calc(100vh-3.5rem)]">

        {/* ── LEFT: Live Preview (persistent on desktop) ───────────────────────── */}
        <aside className="print-reset hidden lg:block flex-1 max-w-[880px] border-r border-dashboard-base-300 overflow-auto h-full bg-dashboard-base-200">
          <div className="print-reset px-6 py-8">
            <ItineraryDocument
              form={previewForm}
              onCoverImageChange={(url) => setForm((f) => ({ ...f, coverImage: url }))}
              onCoverImagePositionChange={(pos) => setForm((f) => ({ ...f, coverImagePosition: pos }))}
              onImageChange={handleItineraryImageChange}
              onActivityCaptionChange={handleActivityCaptionChange}
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
                onCoverImageChange={(url) => setForm((f) => ({ ...f, coverImage: url }))}
              onCoverImagePositionChange={(pos) => setForm((f) => ({ ...f, coverImagePosition: pos }))}
              onImageChange={handleItineraryImageChange}
              onActivityCaptionChange={handleActivityCaptionChange}
              variant="flat"
              />
            </div>
          </div>
        )}

        {/* ── RIGHT: Tabbed Editor ──────────────────────────────────────────────── */}
        <main className="no-print w-full lg:w-100 xl:w-140 shrink-0 overflow-y-auto h-full">
          <div className="px-4 pt-5 pb-4">

            <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-4">
              {/* Compact pill nav — short labels + tight padding so all six
                 fit without the abrupt horizontal clipping a full-width
                 label set forced at this panel's width. The fade mask on
                 the right is a scroll affordance for narrower (lg) widths
                 where it still doesn't quite fit, so a partially-hidden
                 last tab reads as "scroll for more" instead of "cut off". */}
              <div className="sticky top-0 z-10 -mx-4 px-4 bg-dashboard-base-200/95 backdrop-blur">
                <div className="relative">
                  <TabsList className="w-full max-w-full overflow-x-auto flex-nowrap justify-start bg-transparent p-0 gap-1">
                    <TabsTrigger value="client" className="gap-1.5 flex-none px-3 py-2">
                      <User size={13} /> Client
                    </TabsTrigger>
                    <TabsTrigger value="details" className="gap-1.5 flex-none px-3 py-2">
                      <Package size={13} /> Package
                    </TabsTrigger>
                    <TabsTrigger value="itinerary" className="gap-1.5 flex-none px-3 py-2">
                      <Calendar size={13} /> Itinerary
                    </TabsTrigger>
                    <TabsTrigger value="tickets" className="gap-1.5 flex-none px-3 py-2">
                      <Plane size={13} /> Tickets
                    </TabsTrigger>
                    <TabsTrigger value="pricing" className="gap-1.5 flex-none px-3 py-2">
                      <IndianRupee size={13} /> Pricing
                    </TabsTrigger>
                    <TabsTrigger value="inclusions" className="gap-1.5 flex-none px-3 py-2">
                      <ListChecks size={13} /> Inclusions
                    </TabsTrigger>
                  </TabsList>
                  <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l from-dashboard-base-200 to-transparent" />
                </div>
              </div>

              {/* ── Tab: Client Info ─────────────────────────────────────────────── */}
              <TabsContent value="client" className="space-y-3">
                <ClientDetailsSidebar query={query} j={j} t={t} b={b} s={s} tr={tr} ac={ac} />
              </TabsContent>

              {/* ── Tab: Package Details ─────────────────────────────────────────── */}
              <TabsContent value="details" className="space-y-6">
                {/* Package Overview */}
                <div className="rounded-2xl border border-dashboard-base-300 bg-dashboard-base-100 shadow-sm p-5 space-y-4">
                  <h2 className="text-sm font-bold flex items-center gap-2 text-dashboard-base-content">
                    <Package size={15} className="text-dashboard-primary" /> Package Overview
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="text-xs font-medium text-dashboard-base-content/90 mb-1.5 block ">Package Title *</label>
                      <Input
                        value={form.title}
                        onChange={field("title")}
                        placeholder="e.g. Manali Adventure Package"
                        className="text-sm border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs font-medium text-dashboard-base-content/90 mb-1.5 block">Package Description</label>
                      <Textarea
                        value={form.description}
                        onChange={field("description")}
                        placeholder="A short intro shown under the title on the itinerary — e.g. Experience the magic of Manali on this specially curated 5-day adventure…"
                        rows={2}
                        className="text-sm resize-none border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-medium text-dashboard-base-content/90">Cover Image</label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={useDestinationPhoto}
                          disabled={isFetchingCover || !form.destination}
                          className="h-6 px-2 text-[11px] gap-1 border-dashboard-base-300 rounded-md"
                        >
                          {isFetchingCover ? <Loader2 size={11} className="animate-spin" /> : <ImageIcon size={11} />}
                          Use destination photo
                        </Button>
                      </div>
                      <ImageDropField
                        value={form.coverImage}
                        onChange={(url) => setForm((f) => ({ ...f, coverImage: url }))}
                        position={form.coverImagePosition}
                        onPositionChange={(pos) => setForm((f) => ({ ...f, coverImagePosition: pos }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-dashboard-base-content/90 mb-1.5 block">Destination(s)</label>
                      <Input
                        value={form.destination}
                        onChange={field("destination")}
                        placeholder="Manali, Bhuntar, Kullu"
                        disabled={form.stops.length > 0}
                        className="text-sm h-9 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-dashboard-base-content/90 mb-1.5 block">Pickup Point</label>
                      <Input
                        value={form.startingPoint}
                        onChange={field("startingPoint")}
                        placeholder="Delhi"
                        className="text-sm h-9 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-dashboard-base-content/90 mb-1.5 block">Travel Date</label>
                      <Input
                        type="date"
                        value={form.travelDate}
                        onChange={field("travelDate")}
                        className="text-sm h-9 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-dashboard-base-content/90 mb-1.5 block">Duration</label>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Input
                            type="number" min={1}
                            value={form.totalDays}
                            disabled={form.stops.length > 0}
                            onChange={(e) => {
                              const days = Math.max(1, +e.target.value || 1);
                              setForm((f) => ({
                                ...f,
                                totalDays: days,
                                totalNights: Math.max(0, days - 1),
                                // Grows the itinerary to match — never shrinks
                                // it here, so an exec's already-filled-in days
                                // are never silently dropped by a typo.
                                itineraries: growItinerariesTo(f.itineraries, days),
                              }));
                            }}
                            className="text-sm h-9 text-center border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md disabled:opacity-60"
                          />
                          <p className="text-xs text-dashboard-base-content/50 mt-0.5 text-center">Days</p>
                        </div>
                        <div className="flex-1">
                          <Input
                            type="number" min={0}
                            value={form.totalNights}
                            disabled={form.stops.length > 0}
                            onChange={(e) => {
                              const nights = Math.max(0, +e.target.value || 0);
                              const days = nights + 1;
                              setForm((f) => ({
                                ...f,
                                totalNights: nights,
                                totalDays: days,
                                itineraries: growItinerariesTo(f.itineraries, days),
                              }));
                            }}
                            className="text-sm h-9 text-center border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md disabled:opacity-60"
                          />
                          <p className="text-xs text-dashboard-base-content/50 mt-0.5 text-center">Nights</p>
                        </div>
                      </div>
                    </div>
                    <div className="sm:col-span-2 pt-2 border-t border-dashboard-base-300">
                      <RouteStopsEditor
                        stops={form.stops}
                        onChange={(stops) => setForm((f) => ({
                          ...f,
                          stops,
                          ...(stops.length > 0 ? recalcFromStops(stops) : {}),
                        }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Travellers */}
                <div className="rounded-2xl border border-dashboard-base-300 bg-dashboard-base-100 shadow-sm p-5 space-y-4">
                  <h2 className="text-sm font-bold flex items-center gap-2 text-dashboard-base-content">
                    <Users size={15} className="text-dashboard-primary" /> Travellers
                  </h2>
                  <div className="grid grid-cols-3 gap-3">
                    {(["adults", "children", "infants"] as const).map((key) => (
                      <div key={key}>
                        <label className="text-xs font-medium text-dashboard-base-content/75 mb-1.5 block capitalize">{key}</label>
                        <Input
                          type="number" min={0}
                          value={form[key]}
                          onChange={(e) => setForm((f) => ({ ...f, [key]: +e.target.value }))}
                          className="text-sm h-9 text-center border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-dashboard-base-content/50">
                    Pricing is computed automatically from hotels, cabs, tickets, margin & GST — see the Pricing Breakdown tab.
                  </p>
                </div>

                {/* Add-ons */}
                <div className="rounded-2xl border border-dashboard-base-300 bg-dashboard-base-100 shadow-sm p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-bold flex items-center gap-2 text-dashboard-base-content">
                      <Gift size={15} className="text-dashboard-primary" /> Add-ons
                    </h2>
                    <Button type="button" variant="outline" size="sm" onClick={() => addAddon()}>
                      <Plus size={13} className="mr-1.5" /> Add Add-on
                    </Button>
                  </div>
                  <p className="text-[11px] text-dashboard-base-content/50">
                    Priced extras — honeymoon kit, permits, adventure sport fees, etc. Each unit price × quantity feeds into the
                    package total on the Pricing Breakdown tab, at the same {form.marginPercentage || 0}% margin as hotels/cabs.
                  </p>
                  {form.addOns.length === 0 ? (
                    <p className="text-[11px] text-dashboard-base-content/40 italic">No add-ons yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {form.addOns.map((addon, idx) => (
                        <div key={idx} className="rounded-lg border border-dashboard-base-300 bg-dashboard-base-200/20 p-2.5 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-dashboard-base-content/50 bg-dashboard-base-200 rounded-full px-2 py-0.5 shrink-0 whitespace-nowrap">
                              {addon.day != null ? `Day ${addon.day}` : "General"}
                            </span>
                            <Input
                              value={addon.name}
                              onChange={(e) => updateAddon(idx, { name: e.target.value })}
                              placeholder="e.g. Honeymoon Kit"
                              className="text-sm h-8 flex-1 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
                            />
                            <Input
                              type="number" min={0}
                              value={addon.price ?? ""}
                              onChange={(e) => updateAddon(idx, { price: e.target.value ? Number(e.target.value) : null })}
                              placeholder="₹ / unit"
                              className="text-sm h-8 w-28 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
                            />
                            <Input
                              type="number" min={1}
                              value={addon.quantity}
                              onChange={(e) => updateAddon(idx, { quantity: e.target.value ? Number(e.target.value) : 1 })}
                              placeholder="Qty"
                              className="text-sm h-8 w-20 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
                            />
                            <span className="text-xs font-semibold text-dashboard-base-content/70 w-24 text-right shrink-0">
                              ₹{((addon.price ?? 0) * (addon.quantity || 1)).toLocaleString("en-IN")}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeAddon(idx)}
                              className="p-1.5 rounded hover:bg-dashboard-error/10 text-dashboard-error/70 hover:text-dashboard-error transition-colors shrink-0"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                          <Textarea
                            value={addon.notes}
                            onChange={(e) => updateAddon(idx, { notes: e.target.value })}
                            placeholder="What's included — e.g. candle light dinner, cake, bed decoration…"
                            rows={2}
                            className="text-xs resize-none border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Flights & Train */}
                <div className="rounded-2xl border border-dashboard-base-300 bg-dashboard-base-100 shadow-sm p-5 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h2 className="text-sm font-bold flex items-center gap-2 text-dashboard-base-content">
                      <Plane size={15} className="text-dashboard-primary" /> Flights & Train
                    </h2>
                    <p className="text-xs text-dashboard-base-content/60 mt-1">
                      {form.tickets.length > 0
                        ? `${form.tickets.length} ticket${form.tickets.length !== 1 ? "s" : ""} added — priced into the package total.`
                        : "Add flight or train tickets, with fares, on the Tickets tab."}
                    </p>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => setActiveTab("tickets")}>
                    <Plane size={13} className="mr-1.5" /> Manage Tickets
                  </Button>
                </div>
              </TabsContent>

              {/* ── Tab: Itinerary ───────────────────────────────────────────────── */}
              <TabsContent value="itinerary" className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-bold flex items-center gap-2 text-dashboard-base-content">
                    <Calendar size={15} className="text-dashboard-primary" />
                    Day-wise Itinerary
                    <Badge variant="outline" className="text-xs font-normal border-dashboard-base-300 text-dashboard-base-content/50">
                      {form.itineraries.length} days
                    </Badge>
                  </h2>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 border-dashboard-base-300 text-dashboard-base-content rounded-md"
                        >
                          <Wand2 size={13} /> Tools <ChevronDown size={12} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-64">
                        <DropdownMenuItem onClick={autoFillDayTitles}>
                          <Sparkles size={13} className="mr-2 text-dashboard-base-content/60" />
                          Auto-fill Titles
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={autoFillPickupDrop}>
                          <Car size={13} className="mr-2 text-dashboard-base-content/60" />
                          Auto-fill Pickup/Drop
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setAiDialogOpen(true)}>
                          <Wand2 size={13} className="mr-2 text-dashboard-base-content/60" />
                          AI Itinerary Builder
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 border-dashboard-base-300 duration-300 transition-transform hover:scale-105 text-dashboard-base-content rounded-md"
                      onClick={addDay}
                    >
                      <Plus size={13} /> Add Day
                    </Button>
                  </div>
                </div>

                {/* Focus mode — narrows every day card below to just one
                   section at a time, so filling in e.g. every day's hotel
                   back-to-back doesn't mean scrolling past cab/meals/
                   activities each time. Counts show how many days still
                   need that section filled in. */}
                <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-dashboard-base-300 bg-dashboard-base-200/50 p-1">
                  {FOCUS_SECTIONS.map(({ value, label, icon: SectionIcon }) => {
                    const done = focusDoneCounts[value];
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setFocusSection(value)}
                        className={cn(
                          "flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors shrink-0",
                          focusSection === value
                            ? "bg-dashboard-primary text-dashboard-primary-content shadow-sm"
                            : "text-dashboard-base-content/60 hover:bg-dashboard-base-100",
                        )}
                      >
                        <SectionIcon size={12} /> {label}
                        {done !== undefined && (
                          <span
                            className={cn(
                              "text-[10px] rounded-full px-1.5 leading-4",
                              focusSection === value
                                ? "bg-dashboard-primary-content/20"
                                : done < form.itineraries.length
                                  ? "bg-dashboard-warning/20 text-dashboard-warning-content"
                                  : "bg-dashboard-base-300/60",
                            )}
                          >
                            {done}/{form.itineraries.length}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {focusSection !== "all" && (
                  <p className="text-[11px] text-dashboard-base-content/50 flex items-center gap-1 -mt-1">
                    <Eye size={11} className="shrink-0" />
                    Focused on {FOCUS_SECTIONS.find((s) => s.value === focusSection)?.label} — other sections are hidden below across every day.
                    <button
                      type="button"
                      onClick={() => setFocusSection("all")}
                      className="text-dashboard-primary hover:underline shrink-0"
                    >
                      Show all
                    </button>
                  </p>
                )}

                {form.itineraries.length !== form.totalDays && (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-dashboard-warning/40 bg-dashboard-warning/10 px-3 py-2">
                    <p className="text-xs text-dashboard-warning-content flex items-center gap-1.5">
                      <AlertCircle size={13} className="shrink-0" />
                      Duration is set to {form.totalDays} day{form.totalDays !== 1 ? "s" : ""}, but there {form.itineraries.length === 1 ? "is" : "are"} {form.itineraries.length} day card{form.itineraries.length !== 1 ? "s" : ""} below — these won&apos;t match on the client-facing document.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs px-2.5 shrink-0 border-dashboard-warning/50 text-dashboard-warning-content hover:bg-dashboard-warning/20 rounded-md"
                      onClick={syncItinerariesToDuration}
                    >
                      Sync now
                    </Button>
                  </div>
                )}

                <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
                  <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-sm flex items-center gap-2">
                        <Wand2 size={15} className="text-dashboard-primary" /> AI Itinerary Builder
                      </DialogTitle>
                      <DialogDescription className="text-xs">
                        Copy the prompt below into ChatGPT, then paste the JSON it gives you back — day titles, descriptions, activities, and photos get filled in at once. Only empty fields are touched; hotel/cab selection stays manual.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-semibold text-dashboard-base-content/90">Step 1 — Copy this prompt</label>
                          <Button variant="outline" size="sm" onClick={copyAIPrompt} className="h-7 px-2 text-[11px] gap-1 border-dashboard-base-300 rounded-md">
                            <Copy size={11} /> Copy Prompt
                          </Button>
                        </div>
                        <Textarea
                          readOnly
                          value={buildAIPrompt()}
                          rows={8}
                          className="text-[11px] font-mono resize-none border-dashboard-base-300 bg-dashboard-base-200/40 rounded-md"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-dashboard-base-content/90 mb-1.5 block">
                          Step 2 — Paste the JSON response here
                        </label>
                        <Textarea
                          value={aiJsonInput}
                          onChange={(e) => setAiJsonInput(e.target.value)}
                          rows={8}
                          placeholder="Paste the JSON ChatGPT gave you…"
                          className="text-[11px] font-mono resize-none border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
                        />
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setAiDialogOpen(false)} className="border-dashboard-base-300 rounded-md">
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={applyAIItinerary}
                          disabled={!aiJsonInput.trim()}
                          className="gap-1.5 bg-dashboard-primary text-dashboard-primary-content hover:bg-dashboard-primary/90 rounded-md"
                        >
                          <Wand2 size={13} /> Generate Package
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                {form.itineraries.map((day, idx) => (
                  <DayCard
                    key={`day-${day.day}`}
                    day={day.day}
                    data={day}
                    location={dayLocations[idx]}
                    totalDays={form.itineraries.length}
                    onChange={(d) => updateDay(idx, d)}
                    onRemove={() => removeDay(idx)}
                    onApplyVehicleToDays={applyVehicleToDays}
                    onApplyRoomToDays={applyRoomToDays}
                    onRemoveRoomFromDays={removeRoomFromDays}
                    onRemoveCabFromDays={removeCabFromDays}
                    stayPreference={s?.types}
                    focusSection={focusSection}
                    shiftedMeals={shiftedMeals[idx]}
                    dayAddons={form.addOns
                      .map((addon, index) => ({ addon, index }))
                      .filter(({ addon }) => addon.day === day.day)}
                    onAddAddon={() => addAddon(day.day)}
                    onUpdateAddon={updateAddon}
                    onRemoveAddon={removeAddon}
                  />
                ))}
              </TabsContent>

              {/* ── Tab: Tickets ─────────────────────────────────────────────────── */}
              <TabsContent value="tickets" className="space-y-4">
                <div className="rounded-2xl border border-dashboard-base-300 bg-dashboard-base-100 shadow-sm p-5 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h2 className="text-sm font-bold flex items-center gap-2 text-dashboard-base-content">
                      <Plane size={15} className="text-dashboard-primary" /> Flight & Train Tickets
                    </h2>
                    <div className="flex items-center gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => addTicket("FLIGHT")}>
                        <Plus size={13} className="mr-1" /> <Plane size={12} className="mr-1" /> Add Flight
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => addTicket("TRAIN")}>
                        <Plus size={13} className="mr-1" /> <TrainFront size={12} className="mr-1" /> Add Train
                      </Button>
                    </div>
                  </div>

                  {form.tickets.length === 0 ? (
                    <p className="text-xs text-dashboard-base-content/50">
                      No tickets added yet — add a flight or train leg above if the client wants one booked as part of this package.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {form.tickets.map((ticket, idx) => (
                        <TicketEditorCard
                          key={idx}
                          ticket={ticket}
                          onChange={(patch) => updateTicket(idx, patch)}
                          onRemove={() => removeTicket(idx)}
                        />
                      ))}
                    </div>
                  )}

                  {form.tickets.length > 0 && (
                    <div className="flex items-center justify-between gap-3 pt-3 border-t border-dashboard-base-300">
                      <p className="text-xs text-dashboard-base-content/60">
                        {form.tickets.length} ticket{form.tickets.length !== 1 ? "s" : ""} — fare total feeds into the Pricing Breakdown tab
                      </p>
                      <p className="text-sm font-bold text-dashboard-base-content">
                        ₹{form.tickets.reduce((sum, t) => sum + (t.fare ?? 0), 0).toLocaleString("en-IN")}
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* ── Tab: Pricing Breakdown ───────────────────────────────────────── */}
              <TabsContent value="pricing" className="space-y-4">
                <div className="rounded-2xl border border-dashboard-base-300 bg-dashboard-base-100 shadow-sm p-5 space-y-4">
                  <h2 className="text-sm font-bold flex items-center gap-2 text-dashboard-base-content">
                    <IndianRupee size={15} className="text-dashboard-primary" /> Pricing Breakdown
                  </h2>

                  {(computingPrice || computingCabPrice) ? (
                    <div className="flex items-center gap-1.5 text-xs text-dashboard-base-content/60">
                      <Loader2 size={12} className="animate-spin" /> Calculating price from hotels, cabs + dates…
                    </div>
                  ) : (hotelPricing && hotelPricing.days.length > 0) || (cabPricing && cabPricing.days.length > 0) || form.tickets.length > 0 || form.addOns.length > 0 ? (
                    <>
                      {hotelPricing && hotelPricing.days.length > 0 && (
                        <div className="space-y-3">
                          <h3 className="text-xs font-semibold text-dashboard-base-content/80 flex items-center gap-1.5">
                            <Hotel size={12} /> Hotels
                          </h3>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="rounded-lg border border-dashboard-base-300 bg-dashboard-base-200/40 p-3">
                              <p className="text-[11px] text-dashboard-base-content/60 mb-0.5">Hotel Subtotal</p>
                              <p className="text-base font-bold text-dashboard-base-content">₹{hotelPricing.hotelSubtotal.toLocaleString("en-IN")}</p>
                            </div>
                            <div className="rounded-lg border border-dashboard-base-300 bg-dashboard-base-200/40 p-3">
                              <p className="text-[11px] text-dashboard-base-content/60 mb-0.5">Nights Priced</p>
                              <p className="text-base font-bold text-dashboard-base-content">{hotelPricing.nightsCounted}</p>
                            </div>
                            <div className="rounded-lg border border-dashboard-base-300 bg-dashboard-base-200/40 p-3">
                              <p className="text-[11px] text-dashboard-base-content/60 mb-0.5">Per Person (auto)</p>
                              <p className="text-base font-bold text-dashboard-base-content">
                                ₹{(form.adults + form.children) > 0
                                  ? Math.round(hotelPricing.hotelSubtotal / (form.adults + form.children)).toLocaleString("en-IN")
                                  : hotelPricing.hotelSubtotal.toLocaleString("en-IN")}
                              </p>
                            </div>
                          </div>

                          <div className="rounded-lg border border-dashboard-base-300 overflow-hidden">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-dashboard-base-200/60 text-dashboard-base-content/60">
                                  <th className="text-left px-3 py-2 font-semibold">Day</th>
                                  <th className="text-left px-3 py-2 font-semibold">Hotel</th>
                                  <th className="text-right px-3 py-2 font-semibold">Rooms</th>
                                  <th className="text-right px-3 py-2 font-semibold">₹/Room</th>
                                  <th className="text-right px-3 py-2 font-semibold">Extra Beds</th>
                                  <th className="text-right px-3 py-2 font-semibold">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(() => {
                                  // Groups same-day rows (primary room + any extra room types) so
                                  // a day with multiple different rooms gets an explicit
                                  // "₹3,400 + ₹2,500 = ₹5,900" line under it, instead of leaving
                                  // an exec to manually add up scattered rows sharing a day number.
                                  const groups = new Map<number, typeof hotelPricing.days>();
                                  for (const d of hotelPricing.days) {
                                    groups.set(d.day, [...(groups.get(d.day) ?? []), d]);
                                  }
                                  return [...groups.entries()].flatMap(([day, lines]) => [
                                    ...lines.map((d, i) => (
                                      <tr key={`${day}-${i}`} className="border-t border-dashboard-base-300">
                                        <td className="px-3 py-2 font-medium whitespace-nowrap">Day {d.day}</td>
                                        <td className="px-3 py-2 text-dashboard-base-content/70">{d.hotelName} — {d.roomName}</td>
                                        <td className="px-3 py-2 text-right">{d.roomsNeeded}</td>
                                        <td className="px-3 py-2 text-right">₹{d.pricePerRoom.toLocaleString("en-IN")}</td>
                                        <td className="px-3 py-2 text-right">{d.mattresses > 0 ? `${d.mattresses} × ₹${d.extraBedRate.toLocaleString("en-IN")}` : "—"}</td>
                                        <td className="px-3 py-2 text-right font-semibold">₹{d.total.toLocaleString("en-IN")}</td>
                                      </tr>
                                    )),
                                    ...(lines.length > 1 ? [
                                      <tr key={`${day}-sum`} className="border-t border-dashed border-dashboard-base-300 bg-dashboard-base-200/30">
                                        <td colSpan={5} className="px-3 py-1.5 text-right text-dashboard-base-content/60">
                                          Day {day} total: {lines.map((d) => `₹${d.total.toLocaleString("en-IN")}`).join(" + ")}
                                        </td>
                                        <td className="px-3 py-1.5 text-right font-semibold">
                                          = ₹{lines.reduce((sum, d) => sum + d.total, 0).toLocaleString("en-IN")}
                                        </td>
                                      </tr>,
                                    ] : []),
                                  ]);
                                })()}
                              </tbody>
                              <tfoot>
                                <tr className="border-t border-dashboard-base-300 bg-dashboard-base-200/40">
                                  <td colSpan={5} className="px-3 py-2 text-right font-semibold">Hotel Subtotal</td>
                                  <td className="px-3 py-2 text-right font-bold">₹{hotelPricing.hotelSubtotal.toLocaleString("en-IN")}</td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      )}

                      {cabPricing && cabPricing.days.length > 0 && (
                        <div className="space-y-3">
                          <h3 className="text-xs font-semibold text-dashboard-base-content/80 flex items-center gap-1.5">
                            <Car size={12} /> Cabs
                          </h3>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="rounded-lg border border-dashboard-base-300 bg-dashboard-base-200/40 p-3">
                              <p className="text-[11px] text-dashboard-base-content/60 mb-0.5">Cab Subtotal</p>
                              <p className="text-base font-bold text-dashboard-base-content">₹{cabPricing.cabSubtotal.toLocaleString("en-IN")}</p>
                            </div>
                            <div className="rounded-lg border border-dashboard-base-300 bg-dashboard-base-200/40 p-3">
                              <p className="text-[11px] text-dashboard-base-content/60 mb-0.5">Days Priced</p>
                              <p className="text-base font-bold text-dashboard-base-content">{cabPricing.daysCounted}</p>
                            </div>
                            <div className="rounded-lg border border-dashboard-base-300 bg-dashboard-base-200/40 p-3">
                              <p className="text-[11px] text-dashboard-base-content/60 mb-0.5">Per Person (auto)</p>
                              <p className="text-base font-bold text-dashboard-base-content">
                                ₹{(form.adults + form.children) > 0
                                  ? Math.round(cabPricing.cabSubtotal / (form.adults + form.children)).toLocaleString("en-IN")
                                  : cabPricing.cabSubtotal.toLocaleString("en-IN")}
                              </p>
                            </div>
                          </div>

                          <div className="rounded-lg border border-dashboard-base-300 overflow-hidden">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-dashboard-base-200/60 text-dashboard-base-content/60">
                                  <th className="text-left px-3 py-2 font-semibold">Day</th>
                                  <th className="text-left px-3 py-2 font-semibold">Vehicle</th>
                                  <th className="text-left px-3 py-2 font-semibold">Rate Type</th>
                                  <th className="text-right px-3 py-2 font-semibold">Rate</th>
                                  <th className="text-right px-3 py-2 font-semibold">Distance</th>
                                  <th className="text-right px-3 py-2 font-semibold">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(() => {
                                  // Same day-grouping as the hotel table above — a day with
                                  // multiple different cabs gets an explicit sum line.
                                  const groups = new Map<number, typeof cabPricing.days>();
                                  for (const d of cabPricing.days) {
                                    groups.set(d.day, [...(groups.get(d.day) ?? []), d]);
                                  }
                                  return [...groups.entries()].flatMap(([day, lines]) => [
                                    ...lines.map((d, i) => (
                                      <tr key={`${day}-${i}`} className="border-t border-dashboard-base-300">
                                        <td className="px-3 py-2 font-medium whitespace-nowrap">Day {d.day}</td>
                                        <td className="px-3 py-2 text-dashboard-base-content/70">{d.vehicleName}</td>
                                        <td className="px-3 py-2 text-dashboard-base-content/70">
                                          {d.pricingType === "PER_KM" ? "Per KM" : "Per Day"}{d.isWeekend ? " · weekend" : ""}
                                        </td>
                                        <td className="px-3 py-2 text-right">₹{d.rate.toLocaleString("en-IN")}{d.pricingType === "PER_KM" ? "/km" : "/day"}</td>
                                        <td className="px-3 py-2 text-right">{d.pricingType === "PER_KM" && d.distanceKm != null ? `${d.distanceKm} km` : "—"}</td>
                                        <td className="px-3 py-2 text-right font-semibold">₹{d.total.toLocaleString("en-IN")}</td>
                                      </tr>
                                    )),
                                    ...(lines.length > 1 ? [
                                      <tr key={`${day}-sum`} className="border-t border-dashed border-dashboard-base-300 bg-dashboard-base-200/30">
                                        <td colSpan={5} className="px-3 py-1.5 text-right text-dashboard-base-content/60">
                                          Day {day} total: {lines.map((d) => `₹${d.total.toLocaleString("en-IN")}`).join(" + ")}
                                        </td>
                                        <td className="px-3 py-1.5 text-right font-semibold">
                                          = ₹{lines.reduce((sum, d) => sum + d.total, 0).toLocaleString("en-IN")}
                                        </td>
                                      </tr>,
                                    ] : []),
                                  ]);
                                })()}
                              </tbody>
                              <tfoot>
                                <tr className="border-t border-dashboard-base-300 bg-dashboard-base-200/40">
                                  <td colSpan={5} className="px-3 py-2 text-right font-semibold">Cab Subtotal</td>
                                  <td className="px-3 py-2 text-right font-bold">₹{cabPricing.cabSubtotal.toLocaleString("en-IN")}</td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      )}

                      {form.tickets.length > 0 && (
                        <div className="space-y-3">
                          <h3 className="text-xs font-semibold text-dashboard-base-content/80 flex items-center gap-1.5">
                            <Plane size={12} /> Tickets
                          </h3>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-lg border border-dashboard-base-300 bg-dashboard-base-200/40 p-3">
                              <p className="text-[11px] text-dashboard-base-content/60 mb-0.5">Tickets Subtotal</p>
                              <p className="text-base font-bold text-dashboard-base-content">
                                ₹{form.tickets.reduce((sum, t) => sum + (t.fare ?? 0), 0).toLocaleString("en-IN")}
                              </p>
                            </div>
                            <div className="rounded-lg border border-dashboard-base-300 bg-dashboard-base-200/40 p-3">
                              <p className="text-[11px] text-dashboard-base-content/60 mb-0.5">Legs Priced</p>
                              <p className="text-base font-bold text-dashboard-base-content">{form.tickets.length}</p>
                            </div>
                          </div>

                          <div className="rounded-lg border border-dashboard-base-300 overflow-hidden">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-dashboard-base-200/60 text-dashboard-base-content/60">
                                  <th className="text-left px-3 py-2 font-semibold">Type</th>
                                  <th className="text-left px-3 py-2 font-semibold">Provider</th>
                                  <th className="text-left px-3 py-2 font-semibold">Route</th>
                                  <th className="text-right px-3 py-2 font-semibold">Pax</th>
                                  <th className="text-right px-3 py-2 font-semibold">Fare</th>
                                </tr>
                              </thead>
                              <tbody>
                                {form.tickets.map((t, idx) => (
                                  <tr key={idx} className="border-t border-dashboard-base-300">
                                    <td className="px-3 py-2 font-medium whitespace-nowrap">{t.type === "FLIGHT" ? "Flight" : "Train"}</td>
                                    <td className="px-3 py-2 text-dashboard-base-content/70">{[t.provider, t.ticketNumber].filter(Boolean).join(" ") || "—"}</td>
                                    <td className="px-3 py-2 text-dashboard-base-content/70">{t.fromPlace || "—"} → {t.toPlace || "—"}</td>
                                    <td className="px-3 py-2 text-right">{t.adults + t.children + t.infants}</td>
                                    <td className="px-3 py-2 text-right font-semibold">₹{(t.fare ?? 0).toLocaleString("en-IN")}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="border-t border-dashboard-base-300 bg-dashboard-base-200/40">
                                  <td colSpan={4} className="px-3 py-2 text-right font-semibold">Tickets Subtotal</td>
                                  <td className="px-3 py-2 text-right font-bold">
                                    ₹{form.tickets.reduce((sum, t) => sum + (t.fare ?? 0), 0).toLocaleString("en-IN")}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      )}

                      {form.addOns.length > 0 && (
                        <div className="space-y-3">
                          <h3 className="text-xs font-semibold text-dashboard-base-content/80 flex items-center gap-1.5">
                            <Gift size={12} /> Add-ons
                          </h3>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-lg border border-dashboard-base-300 bg-dashboard-base-200/40 p-3">
                              <p className="text-[11px] text-dashboard-base-content/60 mb-0.5">Add-ons Subtotal</p>
                              <p className="text-base font-bold text-dashboard-base-content">
                                ₹{form.addOns.reduce((sum, a) => sum + (a.price ?? 0) * (a.quantity || 1), 0).toLocaleString("en-IN")}
                              </p>
                            </div>
                            <div className="rounded-lg border border-dashboard-base-300 bg-dashboard-base-200/40 p-3">
                              <p className="text-[11px] text-dashboard-base-content/60 mb-0.5">Items</p>
                              <p className="text-base font-bold text-dashboard-base-content">{form.addOns.length}</p>
                            </div>
                          </div>

                          <div className="rounded-lg border border-dashboard-base-300 overflow-hidden">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-dashboard-base-200/60 text-dashboard-base-content/60">
                                  <th className="text-left px-3 py-2 font-semibold">Add-on</th>
                                  <th className="text-right px-3 py-2 font-semibold">₹/unit</th>
                                  <th className="text-right px-3 py-2 font-semibold">Qty</th>
                                  <th className="text-right px-3 py-2 font-semibold">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {form.addOns.map((a, idx) => (
                                  <tr key={idx} className="border-t border-dashboard-base-300">
                                    <td className="px-3 py-2 font-medium whitespace-nowrap">{a.name || "Untitled add-on"}</td>
                                    <td className="px-3 py-2 text-right">₹{(a.price ?? 0).toLocaleString("en-IN")}</td>
                                    <td className="px-3 py-2 text-right">{a.quantity || 1}</td>
                                    <td className="px-3 py-2 text-right font-semibold">₹{((a.price ?? 0) * (a.quantity || 1)).toLocaleString("en-IN")}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="border-t border-dashboard-base-300 bg-dashboard-base-200/40">
                                  <td colSpan={3} className="px-3 py-2 text-right font-semibold">Add-ons Subtotal</td>
                                  <td className="px-3 py-2 text-right font-bold">
                                    ₹{form.addOns.reduce((sum, a) => sum + (a.price ?? 0) * (a.quantity || 1), 0).toLocaleString("en-IN")}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      )}

                      <p className="text-[11px] text-dashboard-base-content/50">
                        Hotels are computed from each day&apos;s selected room (season/occupancy-aware rate) and adult/child count; cabs from each
                        day&apos;s selected cab (season/weekday-weekend-aware rate, per day or per km as configured) — both checked against the travel date;
                        tickets from the fares entered on the Tickets tab; add-ons from the Add-ons list in Package Details. Hotel/cab/add-ons carry
                        the margin % set below; ticket fares only ever carry a flat {TICKET_MARGIN_PCT}% margin, regardless of that setting.
                        Activities aren&apos;t priced automatically — factor those into the ₹/Person field in Package Details if needed.
                      </p>

                      {/* Margin + GST */}
                      <div className="space-y-3 pt-1 border-t border-dashboard-base-300">
                        <h3 className="text-xs font-semibold text-dashboard-base-content/80 flex items-center gap-1.5 pt-3">
                          <Percent size={12} /> Margin & GST
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] text-dashboard-base-content/60 mb-1 block">Margin %</label>
                            <Input
                              type="number" min={0} step="0.1"
                              value={form.marginPercentage}
                              onChange={field("marginPercentage")}
                              placeholder="25"
                              className="text-sm h-9 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-dashboard-base-content/60 mb-1 block">GST %</label>
                            <Input
                              type="number" min={0} step="0.1"
                              value={form.gstPercentage}
                              onChange={field("gstPercentage")}
                              placeholder="5"
                              className="text-sm h-9 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
                            />
                          </div>
                        </div>

                        {(() => {
                          const p = computeFinalPricing();
                          if (p.baseCost <= 0) return null;
                          return (
                            <div className="rounded-lg border border-dashboard-base-300 overflow-hidden">
                              <table className="w-full text-xs">
                                <tbody>
                                  <tr className="border-b border-dashboard-base-300">
                                    <td className="px-3 py-2 text-dashboard-base-content/70">Hotel + Cab Base</td>
                                    <td className="px-3 py-2 text-right font-medium">₹{p.hotelCabBase.toLocaleString("en-IN")}</td>
                                  </tr>
                                  {p.addonsSubtotal > 0 && (
                                    <tr className="border-b border-dashboard-base-300">
                                      <td className="px-3 py-2 text-dashboard-base-content/70">Add-ons Base</td>
                                      <td className="px-3 py-2 text-right font-medium">₹{p.addonsSubtotal.toLocaleString("en-IN")}</td>
                                    </tr>
                                  )}
                                  <tr className="border-b border-dashboard-base-300">
                                    <td className="px-3 py-2 text-dashboard-base-content/70">
                                      + Margin on Hotel/Cab{p.addonsSubtotal > 0 ? "/Add-ons" : ""} ({p.marginPct}%)
                                    </td>
                                    <td className="px-3 py-2 text-right font-medium">₹{p.hotelCabMarginAmount.toLocaleString("en-IN")}</td>
                                  </tr>
                                  {p.ticketsSubtotal > 0 && (
                                    <>
                                      <tr className="border-b border-dashboard-base-300">
                                        <td className="px-3 py-2 text-dashboard-base-content/70">Tickets Base (Flight/Train)</td>
                                        <td className="px-3 py-2 text-right font-medium">₹{p.ticketsSubtotal.toLocaleString("en-IN")}</td>
                                      </tr>
                                      <tr className="border-b border-dashboard-base-300">
                                        <td className="px-3 py-2 text-dashboard-base-content/70">+ Margin on Tickets ({TICKET_MARGIN_PCT}% fixed)</td>
                                        <td className="px-3 py-2 text-right font-medium">₹{p.ticketsMarginAmount.toLocaleString("en-IN")}</td>
                                      </tr>
                                    </>
                                  )}
                                  <tr className="border-b border-dashboard-base-300 bg-dashboard-base-200/40">
                                    <td className="px-3 py-2 font-semibold">= Subtotal</td>
                                    <td className="px-3 py-2 text-right font-semibold">₹{p.taxable.toLocaleString("en-IN")}</td>
                                  </tr>
                                  <tr className="border-b border-dashboard-base-300">
                                    <td className="px-3 py-2 text-dashboard-base-content/70">+ GST ({p.gstPct}%)</td>
                                    <td className="px-3 py-2 text-right font-medium">₹{p.gstAmount.toLocaleString("en-IN")}</td>
                                  </tr>
                                  <tr className="bg-dashboard-primary/5">
                                    <td className="px-3 py-2 font-bold text-dashboard-base-content">= Final Price</td>
                                    <td className="px-3 py-2 text-right font-bold text-dashboard-primary">₹{p.finalPrice.toLocaleString("en-IN")}</td>
                                  </tr>
                                  <tr>
                                    <td className="px-3 py-2 text-dashboard-base-content/70">Per Person</td>
                                    <td className="px-3 py-2 text-right font-semibold">₹{p.perPerson.toLocaleString("en-IN")}</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          );
                        })()}
                      </div>

                      <Button
                        type="button" size="sm" variant="outline"
                        className="border-dashboard-primary/40 text-dashboard-primary hover:bg-dashboard-primary/10"
                        onClick={applyComputedPricing}
                      >
                        Use ₹{computeFinalPricing().perPerson.toLocaleString("en-IN")} as Price Per Person
                      </Button>
                    </>
                  ) : (
                    <p className="text-xs text-dashboard-base-content/50">
                      No hotel rooms, priced cabs, or tickets added yet — search real inventory in the Itinerary tab, or add fares on the Tickets tab, to see a computed breakdown here.
                    </p>
                  )}
                </div>
              </TabsContent>

              {/* ── Tab: Inclusions & Terms ──────────────────────────────────────── */}
              <TabsContent value="inclusions" className="space-y-6">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-dashboard-base-300 bg-dashboard-base-200/40 px-4 py-3">
                  <p className="text-xs text-dashboard-base-content/70 flex items-center gap-1.5">
                    <Lock size={12} /> The standard lists below are company-wide, applied to every itinerary — edited only in Itinerary Settings. Add something just for this package under &quot;Package-specific additions&quot;.
                  </p>
                  {!isSalesExecutive && (
                    <Link
                      href="/dashboard/itinerary-settings"
                      target="_blank"
                      className="text-xs font-semibold text-dashboard-primary hover:underline flex items-center gap-1 shrink-0"
                    >
                      Manage <ExternalLink size={12} />
                    </Link>
                  )}
                </div>

                <div className="rounded-2xl border border-dashboard-base-300 bg-dashboard-base-100 shadow-sm p-5 space-y-5">
                  <h2 className="text-sm font-bold flex items-center gap-2 text-dashboard-base-content">
                    <CheckCircle size={15} className="text-dashboard-primary" /> Inclusions & Exclusions
                  </h2>
                  <EditableList
                    label="Inclusions"
                    items={form.inclusions}
                    onChange={(v) => setForm((f) => ({ ...f, inclusions: v }))}
                    placeholder="Add inclusion…"
                    readOnly
                  />
                  <ExtraPolicyItemsEditor
                    items={form.extraPolicyItems.inclusions}
                    onChange={(v) => updateExtraPolicyItems("inclusions", v)}
                    placeholder="e.g. Complimentary airport pickup…"
                  />
                  <div className="pt-1 border-t border-dashboard-base-300" />
                  <EditableList
                    label="Exclusions"
                    items={form.exclusions}
                    onChange={(v) => setForm((f) => ({ ...f, exclusions: v }))}
                    placeholder="Add exclusion…"
                    readOnly
                  />
                  <ExtraPolicyItemsEditor
                    items={form.extraPolicyItems.exclusions}
                    onChange={(v) => updateExtraPolicyItems("exclusions", v)}
                    placeholder="e.g. Adventure sports insurance…"
                  />
                </div>

                <div className="rounded-2xl border border-dashboard-base-300 bg-dashboard-base-100 shadow-sm p-5 space-y-5">
                  <h2 className="text-sm font-bold flex items-center gap-2 text-dashboard-base-content">
                    <Info size={15} className="text-dashboard-primary" /> Policies
                  </h2>
                  <EditableList
                    label="Terms & Conditions"
                    items={form.termsConditions}
                    onChange={(v) => setForm((f) => ({ ...f, termsConditions: v }))}
                    placeholder="Add a term…"
                    readOnly
                  />
                  <ExtraPolicyItemsEditor
                    items={form.extraPolicyItems.termsConditions}
                    onChange={(v) => updateExtraPolicyItems("termsConditions", v)}
                    placeholder="Add a term specific to this package…"
                  />
                  <div className="pt-1 border-t border-dashboard-base-300" />
                  <EditableList
                    label="Payment Policy"
                    items={form.paymentPolicy}
                    onChange={(v) => setForm((f) => ({ ...f, paymentPolicy: v }))}
                    placeholder="Add a payment rule…"
                    readOnly
                  />
                  <ExtraPolicyItemsEditor
                    items={form.extraPolicyItems.paymentPolicy}
                    onChange={(v) => updateExtraPolicyItems("paymentPolicy", v)}
                    placeholder="Add a payment rule specific to this package…"
                  />
                  <div className="pt-1 border-t border-dashboard-base-300" />
                  <EditableList
                    label="Amendment Policy"
                    items={form.amendmentPolicy}
                    onChange={(v) => setForm((f) => ({ ...f, amendmentPolicy: v }))}
                    placeholder="Add an amendment rule…"
                    readOnly
                  />
                  <ExtraPolicyItemsEditor
                    items={form.extraPolicyItems.amendmentPolicy}
                    onChange={(v) => updateExtraPolicyItems("amendmentPolicy", v)}
                    placeholder="Add an amendment rule specific to this package…"
                  />
                </div>

                <div className="rounded-2xl border border-dashboard-base-300 bg-dashboard-base-100 shadow-sm p-5 space-y-5">
                  <h2 className="text-sm font-bold flex items-center gap-2 text-dashboard-base-content">
                    <Sparkles size={15} className="text-dashboard-primary" /> Why Book With Us
                  </h2>
                  <EditableList
                    label="Benefits"
                    items={form.travelBenefits}
                    onChange={(v) => setForm((f) => ({ ...f, travelBenefits: v }))}
                    placeholder="Add a benefit…"
                    readOnly
                  />
                  <ExtraPolicyItemsEditor
                    items={form.extraPolicyItems.travelBenefits}
                    onChange={(v) => updateExtraPolicyItems("travelBenefits", v)}
                    placeholder="Add a benefit specific to this package…"
                  />
                </div>

                {form.customPolicySections.length > 0 && (
                  <div className="rounded-2xl border border-dashboard-base-300 bg-dashboard-base-100 shadow-sm p-5 space-y-5">
                    <h2 className="text-sm font-bold flex items-center gap-2 text-dashboard-base-content">
                      <Info size={15} className="text-dashboard-primary" /> Custom Policy Sections
                    </h2>
                    {form.customPolicySections.map((section) => (
                      <EditableList
                        key={section.id}
                        label={section.title || "Untitled section"}
                        items={section.items}
                        onChange={() => {}}
                        readOnly
                      />
                    ))}
                  </div>
                )}

                <div className="rounded-2xl border border-dashboard-base-300 bg-dashboard-base-100 shadow-sm p-5 space-y-3">
                  <h2 className="text-sm font-bold flex items-center gap-2 text-dashboard-base-content">
                    <Info size={15} className="text-dashboard-primary" /> Terms & Notes
                  </h2>
                  <Textarea
                    value={form.termsNotes}
                    onChange={field("termsNotes")}
                    rows={4}
                    placeholder="Payment terms, cancellation policy, important notes…"
                    className="text-sm resize-none border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
                  />
                </div>
              </TabsContent>
            </Tabs>

            {/* Bottom action bar */}
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
                variant="outline"
                onClick={() => handleSave("READY")}
                disabled={isSaving || isSending}
                className="gap-2 border-dashboard-primary text-dashboard-primary hover:bg-dashboard-primary/10"
              >
                <CheckCircle size={14} />
                Mark Ready
              </Button>
              <Button
                className="gap-2 bg-dashboard-success text-dashboard-success-content hover:bg-dashboard-success/90"
                onClick={handleSend}
                disabled={isSending || isSaving}
              >
                {isSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Send to Client
              </Button>
            </div>
          </div>
        </main>
      </div>

      {sendLinks && (
        <SendToClientDialog
          open={sendDialogOpen}
          onOpenChange={setSendDialogOpen}
          packageId={packageId}
          whatsappUrl={sendLinks.whatsappUrl}
          shareUrl={sendLinks.shareUrl}
          clientEmail={query.email ?? ""}
          previewForm={previewForm}
        />
      )}
    </div>
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

      {query.customPackage?.sentAt && (
        <SectionCard title="Package Status" icon={<Send size={14} />}>
          <InfoRow
            label="Sent"
            value={new Date(query.customPackage.sentAt).toLocaleString("en-IN", {
              day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
            })}
          />
          {query.assignedAt && (
            <InfoRow
              label="Time to send"
              value={formatDuration(new Date(query.customPackage.sentAt).getTime() - new Date(query.assignedAt).getTime())}
            />
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