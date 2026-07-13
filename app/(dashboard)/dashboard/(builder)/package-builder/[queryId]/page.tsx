"use client";

import React, { useEffect, useState, useTransition } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import {
  MapPin, Calendar, Users, Phone, Mail, Hotel, Car, Zap,
  Utensils, ChevronDown, ChevronUp, Plus, Trash2, Pencil,
  Save, Send, CheckCircle, AlertCircle, Loader2,
  Package, User, Info, IndianRupee, ArrowLeft,
  Eye, EyeOff, ListChecks, Plane, TrainFront, LogIn, LogOut,
  Image as ImageIcon, Printer, X, Sparkles,
} from "lucide-react";
import { Button } from "@/app/(dashboard)/dashboard/(main)/components/ui/button";
import { Input } from "@/app/(dashboard)/dashboard/(main)/components/ui/input";
import { Textarea } from "@/app/(dashboard)/dashboard/(main)/components/ui/textarea";
import { Badge } from "@/app/(dashboard)/dashboard/(main)/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/(dashboard)/dashboard/(main)/components/ui/tabs"; 
import { Switch } from "@/app/(dashboard)/dashboard/(main)/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "@/app/(dashboard)/dashboard/(main)/components/ui/dialog";
import { SearchSelect, type Option } from "@/app/(dashboard)/dashboard/(main)/components/dashboard/SearchSelect";
import { LocationSearchSelect } from "@/app/(dashboard)/dashboard/(main)/components/location/LocationSearchSelect";
import { ROUTE_STOP_TYPES, TRANSFER_TYPES, type LocationValue } from "@/app/(dashboard)/dashboard/(main)/components/location/location.types";
import { cn } from "@/app/lib/utils";
import {
  getQueryDetail,
  saveCustomPackage,
  sendPackageToClient,
  getDestinationCoverImage,
  searchHotelRoomsForBuilder,
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
} from "../action";
import { computeBuilderHotelPricing, type BuilderHotelPricingResult } from "@/app/services/package-pricing.service";
import { ItineraryDocument } from "./ItineraryDocument";
import { CreatePackageDialog } from "@/app/(dashboard)/dashboard/(main)/(sales)/sales-query/CreatePackageDialog";

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
  "Daily breakfast",
  "All transfers by private cab",
  "GST & service taxes",
];

const DEFAULT_EXCLUSIONS = [
  "Airfare / train tickets",
  "Personal expenses",
  "Meals not mentioned",
  "Adventure activity charges",
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
    <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 shadow-xs overflow-hidden">
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
function EditableList({ label, items, onChange, placeholder }: {
  label: string; items: string[]; onChange: (v: string[]) => void; placeholder?: string;
}) {
  const [input, setInput] = useState("");
  function add() {
    const val = input.trim();
    if (val && !items.includes(val)) { onChange([...items, val]); setInput(""); }
  }
  return (
    <div>
      <label className="text-xs font-medium text-dashboard-base-content/90 mb-2 block">{label}</label>
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
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span
            key={i}
            className="flex items-center gap-1 text-xs bg-dashboard-base-200 text-dashboard-base-content px-2.5 py-1 rounded-full border border-dashboard-base-300"
          >
            {item}
            <button
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="text-dashboard-base-content/50 hover:text-dashboard-error transition-colors ml-0.5"
            >×</button>
          </span>
        ))}
      </div>
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

// ─────────────────────────────────────────────────────────────────────────────
// ActivityListEditor — per-activity title + description + photo, add/remove
// ─────────────────────────────────────────────────────────────────────────────
function ActivityListEditor({ activities, location, onChange }: {
  activities: ActivityInput[];
  location?: string;
  onChange: (v: ActivityInput[]) => void;
}) {
  function addActivity() {
    onChange([...activities, { title: "", description: "", photo: "", photos: [], photoLabels: [] }]);
  }
  function updateActivity(idx: number, patch: Partial<ActivityInput>) {
    onChange(activities.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  }
  function removeActivity(idx: number) {
    onChange(activities.filter((_, i) => i !== idx));
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
      description: [raw.category, raw.durationHours ? `${raw.durationHours}h` : null].filter(Boolean).join(" · "),
      photo: raw.thumbnail ?? "",
      photos: raw.photos,
      photoLabels: raw.photoLabels,
    }]);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-dashboard-base-content/90 flex items-center gap-1">
          <Zap size={11} /> Activities
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addActivity}
          className="h-6 px-2 text-[11px] gap-1 border-dashboard-base-300 rounded-md"
        >
          <Plus size={11} /> Add Manually
        </Button>
      </div>
      {location ? (
        <div className="mb-2">
          <SearchSelect
            value={null}
            onChange={handleActivitySelect}
            fetchOptions={fetchActivityOptions}
            placeholder={`Search activities in ${location}…`}
          />
        </div>
      ) : (
        <p className="text-[11px] text-dashboard-base-content/40 italic mb-2">
          Add route stops in Package Details to search real activities here
        </p>
      )}
      <div className="space-y-2">
        {activities.map((a, idx) => (
          <div key={idx} className="rounded-lg border border-dashboard-base-300 p-2.5 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Input
                value={a.title}
                onChange={(e) => updateActivity(idx, { title: e.target.value })}
                placeholder="Activity title, e.g. Paragliding"
                className="text-sm h-8 flex-1 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
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
              className="text-xs resize-none border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
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
                    <Image
                      key={i}
                      src={src}
                      alt={a.photoLabels[i] || a.title || "Activity"}
                      width={100}
                      height={80}
                      className="h-16 w-full rounded-md object-cover border border-dashboard-base-300"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        {activities.length === 0 && (
          <p className="text-xs text-dashboard-base-content/40 italic">No activities added for this day.</p>
        )}
      </div>
    </div>
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
// Day Itinerary Card
// ─────────────────────────────────────────────────────────────────────────────
function DayCard({
  day, data, location, totalDays, onChange, onRemove,
  onApplyVehicleToDays, onApplyRoomToDays,
}: {
  day: number;
  data: DayItinerary;
  location?: string;
  totalDays: number;
  onChange: (d: DayItinerary) => void;
  onRemove: () => void;
  onApplyVehicleToDays: (vehicle: VehicleResult, dayNumbers: number[]) => void;
  onApplyRoomToDays: (room: HotelRoomResult, dayNumbers: number[]) => void;
}) {
  const [open, setOpen] = useState(true);

  // After picking a cab, offer to reuse it across the rest of the trip
  // instead of re-searching it for every day.
  const [lastVehicle, setLastVehicle] = useState<VehicleResult | null>(null);
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
    // Nothing to geocode, and fetchHotelRooms already short-circuits on an
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

  async function fetchHotelRooms(query: string, page = 1): Promise<Option[]> {
    if (!searchCity) return [];
    const results = await searchHotelRoomsForBuilder(searchCity, query, cityCoords, page);
    return results.map((r): Option & { raw: HotelRoomResult } => ({
      id: r.id,
      label: `${r.hotelName} — ${r.roomName}`,
      description: [
        `₹${r.pricePerNight.toLocaleString("en-IN")}/night`,
        r.mealPlanName,
        r.distanceKm != null ? `${r.distanceKm} km from ${searchCity}` : null,
      ].filter(Boolean).join(" · "),
      thumbnail: r.thumbnail ?? undefined,
      badge: r.category ?? undefined,
      raw: r,
    }));
  }

  function handleHotelRoomSelect(_id: number | null, option?: Option) {
    const raw = (option as (Option & { raw: HotelRoomResult }) | undefined)?.raw;
    if (!raw) {
      // The SearchSelect's "×" clear button — reset just the hotel-specific
      // fields so a stale roomPricingId doesn't linger against blanked-out text.
      onChange({
        ...data,
        accommodation: "", accommodationPhoto: "", accommodationRoomPhotos: [],
        roomPricingId: null,
      });
      return;
    }
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
    const vehicle: VehicleResult = "vehicleName" in raw
      ? {
          id: raw.id, name: raw.vehicleName, type: raw.vehicleType,
          passengerCapacity: raw.passengerCapacity, hasAc: raw.hasAc, thumbnail: raw.thumbnail,
        }
      : raw;
    onChange({
      ...data,
      transport: vehicle.name,
      transportPhoto: vehicle.thumbnail ?? data.transportPhoto,
      transportVehicleType: CAB_LABELS[vehicle.type] ?? vehicle.type,
      transportSeats: vehicle.passengerCapacity,
    });
    if (totalDays > 1) {
      setLastVehicle(vehicle);
      setShowApplyPrompt(true);
    }
  }

  return (
    <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-dashboard-base-100 border-b border-dashboard-base-300">
        <button onClick={() => setOpen(!open)} className="flex items-center gap-2 flex-1 text-left">
          <div className="h-7 w-7 rounded-lg bg-dashboard-primary text-dashboard-primary-content text-xs font-bold flex items-center justify-center shrink-0">
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

          {/* Accommodation */}
          <div className="rounded-lg border border-dashboard-base-300 p-3 space-y-3">
            <label className="text-xs font-medium text-dashboard-base-content/90 flex items-center gap-1 block">
              <Hotel size={11} /> Hotel Info
            </label>
            <div>
              <label className="text-[11px] text-dashboard-base-content/60 mb-1 block">
                Search location (city) — defaults to this day&apos;s stop, editable
              </label>
              <Input
                value={searchCity}
                onChange={(e) => setSearchCity(e.target.value)}
                placeholder="e.g. Manali"
                className="text-sm h-8 mb-2 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
              />
              {searchCity ? (
                <>
                  <SearchSelect
                    value={data.roomPricingId}
                    initialLabel={data.accommodation}
                    onChange={handleHotelRoomSelect}
                    fetchOptions={fetchHotelRooms}
                    pageSize={20}
                    placeholder={`Search hotel rooms in ${searchCity}…`}
                  />
                  <p className="text-[10px] text-dashboard-base-content/40 mt-1">
                    {data.accommodation ? `Currently: ${data.accommodation} — click above to change it. ` : ""}
                    Searches real inventory in {searchCity}
                  </p>
                </>
              ) : (
                <p className="text-[11px] text-dashboard-base-content/40 italic">
                  Enter a city above to search real hotel rooms
                </p>
              )}
            </div>

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
          </div>

          {/* Transport */}
          <div>
            <label className="text-xs font-medium text-dashboard-base-content/90 mb-1.5 flex items-center gap-1 block">
              <Car size={11} /> Transport
            </label>
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
                      onApplyVehicleToDays(lastVehicle, Array.from({ length: totalDays }, (_, i) => i + 1));
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
                        onApplyVehicleToDays(lastVehicle, selectedDays);
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
          </div>

          {/* Meals */}
          <div>
            <label className="text-xs font-medium text-dashboard-base-content/90 mb-1.5 flex items-center gap-1 block">
              <Utensils size={11} /> Meals Included
            </label>
            <div className="flex flex-wrap gap-2">
              {MEAL_OPTIONS.map((m) => (
                <button
                  key={m}
                  onClick={() => toggleMeal(m)}
                  className={cn(
                    "text-xs px-3 py-1 rounded-full border font-medium transition-all",
                    data.meals.includes(m)
                      ? "bg-dashboard-primary text-dashboard-primary-content border-dashboard-primary"
                      : "bg-dashboard-base-200 text-dashboard-base-content/50 border-dashboard-base-300 hover:border-dashboard-primary/50 hover:text-dashboard-primary cursor-pointer"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Activities */}
          <ActivityListEditor
            activities={data.activities}
            location={searchCity}
            onChange={(activities) => onChange({ ...data, activities })}
          />

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-dashboard-base-content/90 mb-1.5 block">Notes</label>
            <Input
              value={data.notes}
              onChange={(e) => onChange({ ...data, notes: e.target.value })}
              placeholder="Any additional note for this day…"
              className="text-sm h-9 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
            />
          </div>
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
  flightsIncluded: boolean;
  flightNotes: string;
  flightFrom: string;
  flightTo: string;
  trainIncluded: boolean;
  trainNotes: string;
  trainFrom: string;
  trainTo: string;
  stops: StopInput[];
  itineraries: DayItinerary[];
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

const emptyDay = (day: number): DayItinerary => ({
  day, title: "", description: "", activities: [],
  meals: [], accommodation: "", accommodationPhoto: "", accommodationRoomPhotos: [],
  accommodationLocation: "", accommodationRoomSpecs: "", accommodationRoomCapacity: null,
  roomPricingId: null,
  hotelCheckIn: "", hotelCheckOut: "", hotelMealPlan: "",
  transport: "", transportPhoto: "", transportVehicleType: "", transportSeats: null,
  transportPickup: "", transportPickupLat: null, transportPickupLng: null,
  transportDrop: "", transportDistanceKm: null,
  notes: "",
});

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function PackageBuilderDetailPage() {
  const params = useParams<{ queryId: string }>();
  const queryId = params.queryId;

  const [query, setQuery] = useState<QueryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("client");
  const [packageId, setPackageId] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);
  const [isFetchingCover, setIsFetchingCover] = useState(false);
  const [hotelPricing, setHotelPricing] = useState<BuilderHotelPricingResult | null>(null);
  const [computingPrice, setComputingPrice] = useState(false);

  const [isSaving, startSave] = useTransition();
  const [isSending, startSend] = useTransition();

  const [form, setForm] = useState<PackageForm>({
    title: "", description: "", coverImage: "", destination: "", startingPoint: "",
    totalDays: 3, totalNights: 2, travelDate: "",
    adults: 1, children: 0, infants: 0,
    pricePerPerson: "", totalPrice: "",
    currency: "INR",
    inclusions: DEFAULT_INCLUSIONS,
    exclusions: DEFAULT_EXCLUSIONS,
    termsNotes: "Package price is subject to availability. 50% advance required to confirm booking.",
    flightsIncluded: false,
    flightNotes: "",
    flightFrom: "",
    flightTo: "",
    trainIncluded: false,
    trainNotes: "",
    trainFrom: "",
    trainTo: "",
    stops: [],
    itineraries: [emptyDay(1), emptyDay(2), emptyDay(3)],
    execName: "", execEmail: "", execDesignation: "",
  });

  // ── Load query ─────────────────────────────────────────────────────────────
  useEffect(() => {
    // Guards against React Strict Mode's dev-only double-invocation: without
    // this, the first (soon-to-be-cancelled) run could still consume the
    // "Use It" sessionStorage payload and apply it, and then the second run's
    // slower async destination-cover fetch resolves afterwards and clobbers
    // the correctly-applied package cover with the generic destination one.
    let cancelled = false;
    (async () => {
      const data = await getQueryDetail(queryId);
      if (cancelled) return;
      setQuery(data);
      if (!data) { setLoading(false); return; }

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
        // Pre-select flight/train inclusion from what the client asked for
        // when the query was created — a sales exec can still flip these
        // off below if the customer's requirements change.
        flightsIncluded: tr?.includeFlights ?? f.flightsIncluded,
        trainIncluded: tr?.includeTrain ?? f.trainIncluded,
        itineraries: Array.from({ length: j?.noOfDays ?? 3 }, (_, i) => emptyDay(i + 1)),
        execName: data.assignedToName ?? "",
        execEmail: data.execEmail ?? "",
        execDesignation: data.execDesignation ?? "",
      }));

      if (data.customPackage) {
        const cp = data.customPackage;
        setPackageId(cp.id);
        setForm((f) => ({
          ...f,
          title: cp.title,
          description: cp.description ?? "",
          coverImage: cp.coverImage ?? "",
          pricePerPerson: cp.pricePerPerson?.toString() ?? "",
          totalPrice: cp.totalPrice?.toString() ?? "",
          flightsIncluded: cp.flightsIncluded,
          flightNotes: cp.flightNotes ?? "",
          flightFrom: cp.flightFrom ?? "",
          flightTo: cp.flightTo ?? "",
          trainIncluded: cp.trainIncluded,
          trainNotes: cp.trainNotes ?? "",
          trainFrom: cp.trainFrom ?? "",
          trainTo: cp.trainTo ?? "",
          stops: cp.stops,
          itineraries: cp.itineraries.length > 0 ? cp.itineraries : f.itineraries,
        }));
      } else {
        // No package built yet — suggest the destination's catalog photo as
        // the default cover so the header isn't blank from the first draft.
        const destinationName = j?.destinations?.[0] ?? data.destination;
        if (destinationName) {
          const suggested = await getDestinationCoverImage(destinationName);
          if (cancelled) return;
          if (suggested) setForm((f) => ({ ...f, coverImage: suggested }));
        }
      }

      // ── "Use It" from the Package Library — a copy payload waiting in
      // sessionStorage from the redirect. Confirm before clobbering an
      // existing saved draft; a brand-new query just applies it directly.
      const copyKey = `pkgCopyPayload:${queryId}`;
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
  }, [queryId]);

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
  const roomPricingKey = form.itineraries.map((it) => `${it.day}:${it.roomPricingId ?? ""}`).join("|");
  useEffect(() => {
    const days = form.itineraries.map((it) => ({ day: it.day, roomPricingId: it.roomPricingId }));
    if (days.every((d) => d.roomPricingId == null)) {
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

  function applyHotelPricing() {
    if (!hotelPricing || hotelPricing.hotelSubtotal <= 0) return;
    const totalPax = form.adults + form.children;
    const perPerson = totalPax > 0 ? Math.round(hotelPricing.hotelSubtotal / totalPax) : Math.round(hotelPricing.hotelSubtotal);
    setForm((f) => ({ ...f, pricePerPerson: String(perPerson) }));
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  function handleSave(status: "DRAFT" | "READY" = "DRAFT") {
    startSave(async () => {
      const result = await saveCustomPackage({
        queryId,
        ...form,
        pricePerPerson: form.pricePerPerson ? parseFloat(form.pricePerPerson) : null,
        totalPrice: form.totalPrice ? parseFloat(form.totalPrice) : null,
        status,
      });
      if (result.success) {
        setPackageId(result.id);
        setSavedOk(true);
        setTimeout(() => setSavedOk(false), 3000);
      }
    });
  }

  // ── Send ───────────────────────────────────────────────────────────────────
  function handleSend() {
    startSend(async () => {
      let pkgId = packageId;
      if (!pkgId) {
        const result = await saveCustomPackage({
          queryId,
          ...form,
          pricePerPerson: form.pricePerPerson ? parseFloat(form.pricePerPerson) : null,
          totalPrice: form.totalPrice ? parseFloat(form.totalPrice) : null,
          status: "READY",
        });
        if (!result.success) return;
        pkgId = result.id;
        setPackageId(pkgId);
      }
      const result = await sendPackageToClient(pkgId);
      if (result.success && result.whatsappUrl) {
        window.open(result.whatsappUrl, "_blank");
        if (result.shareUrl) {
          const link = result.shareUrl;
          toast.success("Sent! Client link ready.", {
            description: link,
            action: {
              label: "Copy link",
              onClick: () => navigator.clipboard.writeText(link),
            },
          });
        }
      }
    });
  }

  // ── Day helpers ────────────────────────────────────────────────────────────
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

  /** Reuses one picked cab across multiple days — only the vehicle itself
   * carries over; pickup/drop/distance stay per-day since those are route-specific. */
  function applyVehicleToDays(vehicle: VehicleResult, dayNumbers: number[]) {
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
              roomPricingId: room.id,
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

  function field<K extends keyof PackageForm>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
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

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col">

      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-dashboard-base-300 bg-dashboard-base-100/95 backdrop-blur shadow-xs">
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
                {query.name}
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
              queryId={query.id}
              destination={j?.destinations?.join(", ") ?? query.destination ?? null}
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

            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 border-dashboard-base-300 hover:bg-dashboard-base-200 text-dashboard-base-content rounded-md"
              onClick={() => window.print()}
            >
              <Printer size={13} />
              <span className="hidden sm:inline text-xs">Print / Save as PDF</span>
            </Button>

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
      <div className="flex relative h-[calc(100vh-3.5rem)]">

        {/* ── LEFT: Live Preview (persistent on desktop) ───────────────────────── */}
        <aside className="hidden lg:block flex-1 border-r border-dashboard-base-300 overflow-auto h-full bg-dashboard-base-200">
          <div className="px-6 py-8">
            <ItineraryDocument form={form} />
          </div>
        </aside>

        {/* Mobile preview overlay */}
        {mobilePreviewOpen && (
          <div className="lg:hidden fixed inset-0 z-30 bg-dashboard-base-200 overflow-auto">
            <div className="no-print flex items-center justify-between px-4 py-3 border-b border-dashboard-base-300 sticky top-0 bg-dashboard-base-100 z-10">
              <span className="text-sm font-semibold text-dashboard-base-content">Live Preview</span>
              <button onClick={() => setMobilePreviewOpen(false)}>
                <EyeOff size={16} className="text-dashboard-base-content/50" />
              </button>
            </div>
            <div className="px-4 py-6">
              <ItineraryDocument form={form} />
            </div>
          </div>
        )}

        {/* ── RIGHT: Tabbed Editor ──────────────────────────────────────────────── */}
        <main className="w-full lg:w-100 xl:w-140 shrink-0 overflow-y-auto h-full">
          <div className="px-4 pt-5 pb-4">

            <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-4">
              <TabsList className="w-full sm:w-fit overflow-x-auto sticky top-0 z-10 bg-dashboard-base-200/95 backdrop-blur">
                <TabsTrigger value="client" className="gap-1.5">
                  <User size={13} /> Client Info
                </TabsTrigger>
                <TabsTrigger value="details" className="gap-1.5">
                  <Package size={13} /> Package Details
                </TabsTrigger>
                <TabsTrigger value="itinerary" className="gap-1.5">
                  <Calendar size={13} /> Itinerary
                </TabsTrigger>
                <TabsTrigger value="pricing" className="gap-1.5">
                  <IndianRupee size={13} /> Pricing Breakdown
                </TabsTrigger>
                <TabsTrigger value="inclusions" className="gap-1.5">
                  <ListChecks size={13} /> Inclusions & Terms
                </TabsTrigger>
              </TabsList>

              {/* ── Tab: Client Info ─────────────────────────────────────────────── */}
              <TabsContent value="client" className="space-y-3">
                <ClientDetailsSidebar query={query} j={j} t={t} b={b} s={s} tr={tr} ac={ac} />
              </TabsContent>

              {/* ── Tab: Package Details ─────────────────────────────────────────── */}
              <TabsContent value="details" className="space-y-6">
                {/* Package Overview */}
                <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 p-5 space-y-4">
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
                      <div className="flex gap-2">
                        <Input
                          value={form.coverImage}
                          onChange={field("coverImage")}
                          placeholder="https://…"
                          className="text-sm h-9 flex-1 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
                        />
                        {form.coverImage && (
                          // eslint-disable-next-line @next/next/no-img-element -- arbitrary external URL, not a static app asset
                          <img
                            src={form.coverImage}
                            alt=""
                            className="h-9 w-14 rounded-md object-cover border border-dashboard-base-300 shrink-0"
                          />
                        )}
                      </div>
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
                            onChange={(e) => setForm((f) => ({
                              ...f,
                              totalDays: +e.target.value,
                              totalNights: Math.max(0, +e.target.value - 1),
                            }))}
                            className="text-sm h-9 text-center border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md disabled:opacity-60"
                          />
                          <p className="text-xs text-dashboard-base-content/50 mt-0.5 text-center">Days</p>
                        </div>
                        <div className="flex-1">
                          <Input
                            type="number" min={0}
                            value={form.totalNights}
                            disabled={form.stops.length > 0}
                            onChange={(e) => setForm((f) => ({ ...f, totalNights: +e.target.value }))}
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

                {/* Travellers & Pricing */}
                <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 p-5 space-y-4">
                  <h2 className="text-sm font-bold flex items-center gap-2 text-dashboard-base-content">
                    <IndianRupee size={15} className="text-dashboard-primary" /> Travellers & Pricing
                  </h2>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
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
                    <div>
                      <label className="text-xs font-medium text-dashboard-base-content/90 mb-1.5 block">₹ / Person</label>
                      <Input
                        type="number" min={0}
                        value={form.pricePerPerson}
                        onChange={field("pricePerPerson")}
                        placeholder="0"
                        className="text-sm h-9 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-dashboard-base-content/90 mb-1.5 block">Total ₹</label>
                      <Input
                        type="number" min={0}
                        value={form.totalPrice}
                        onChange={field("totalPrice")}
                        placeholder="Auto"
                        className="text-sm h-9 bg-dashboard-base-200 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
                      />
                    </div>
                  </div>

                  {computingPrice ? (
                    <div className="flex items-center gap-1.5 text-xs text-dashboard-base-content/60">
                      <Loader2 size={12} className="animate-spin" /> Calculating price from hotels + dates…
                    </div>
                  ) : hotelPricing && hotelPricing.hotelSubtotal > 0 ? (
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-dashboard-primary/30 bg-dashboard-primary/5 px-3 py-2.5">
                      <div className="text-xs text-dashboard-base-content">
                        <span className="font-semibold">Computed hotel cost: ₹{hotelPricing.hotelSubtotal.toLocaleString("en-IN")}</span>
                        <span className="text-dashboard-base-content/60">
                          {" "}— {hotelPricing.nightsCounted} night{hotelPricing.nightsCounted !== 1 ? "s" : ""}, {form.adults + form.children} pax
                          {form.travelDate ? `, from ${new Date(form.travelDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}` : ""}
                        </span>
                      </div>
                      <Button
                        type="button" size="sm" variant="outline"
                        className="h-7 text-xs shrink-0 border-dashboard-primary/40 text-dashboard-primary hover:bg-dashboard-primary/10"
                        onClick={applyHotelPricing}
                      >
                        Use this price
                      </Button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-dashboard-base-content/50">
                      Pick hotels via the room search below to auto-calculate price from real, date-aware rates.
                    </p>
                  )}
                </div>

                {/* Flights & Train */}
                <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 p-5 space-y-4">
                  <h2 className="text-sm font-bold flex items-center gap-2 text-dashboard-base-content">
                    <Plane size={15} className="text-dashboard-primary" /> Flights & Train
                  </h2>
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-xs font-medium text-dashboard-base-content/90 flex items-center gap-1.5">
                      <Plane size={12} /> Flights included in this package
                    </label>
                    <Switch
                      checked={form.flightsIncluded}
                      onCheckedChange={(v) => setForm((f) => ({ ...f, flightsIncluded: v }))}
                    />
                  </div>
                  {form.flightsIncluded && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          value={form.flightFrom}
                          onChange={field("flightFrom")}
                          placeholder={`From (defaults to ${form.startingPoint || "starting point"})`}
                          className="text-sm h-9 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
                        />
                        <Input
                          value={form.flightTo}
                          onChange={field("flightTo")}
                          placeholder="To, e.g. Kochi — shown on the map"
                          className="text-sm h-9 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
                        />
                      </div>
                      <Input
                        value={form.flightNotes}
                        onChange={field("flightNotes")}
                        placeholder="e.g. Delhi ⇄ Leh round-trip economy class"
                        className="text-sm h-9 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
                      />
                    </>
                  )}
                  <div className="flex items-center justify-between gap-3 pt-1 border-t border-dashboard-base-300">
                    <label className="text-xs font-medium text-dashboard-base-content/90 flex items-center gap-1.5 pt-3">
                      <TrainFront size={12} /> Train tickets included
                    </label>
                    <div className="pt-3">
                      <Switch
                        checked={form.trainIncluded}
                        onCheckedChange={(v) => setForm((f) => ({ ...f, trainIncluded: v }))}
                      />
                    </div>
                  </div>
                  {form.trainIncluded && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          value={form.trainFrom}
                          onChange={field("trainFrom")}
                          placeholder={`From (defaults to ${form.startingPoint || "starting point"})`}
                          className="text-sm h-9 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
                        />
                        <Input
                          value={form.trainTo}
                          onChange={field("trainTo")}
                          placeholder="To, e.g. Ernakulam — shown on the map"
                          className="text-sm h-9 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
                        />
                      </div>
                      <Input
                        value={form.trainNotes}
                        onChange={field("trainNotes")}
                        placeholder="e.g. AC 2-tier, New Delhi ⇄ Udhampur"
                        className="text-sm h-9 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
                      />
                    </>
                  )}
                </div>
              </TabsContent>

              {/* ── Tab: Itinerary ───────────────────────────────────────────────── */}
              <TabsContent value="itinerary" className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold flex items-center gap-2 text-dashboard-base-content">
                    <Calendar size={15} className="text-dashboard-primary" />
                    Day-wise Itinerary
                    <Badge variant="outline" className="text-xs font-normal border-dashboard-base-300 text-dashboard-base-content/50">
                      {form.itineraries.length} days
                    </Badge>
                  </h2>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 border-dashboard-base-300 text-dashboard-base-content rounded-md"
                      onClick={autoFillDayTitles}
                      title="Fills a starting title for any day that doesn't have one yet — never overwrites an existing title"
                    >
                      <Sparkles size={13} /> Auto-fill Titles
                    </Button>
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
                  />
                ))}
              </TabsContent>

              {/* ── Tab: Pricing Breakdown ───────────────────────────────────────── */}
              <TabsContent value="pricing" className="space-y-4">
                <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 p-5 space-y-4">
                  <h2 className="text-sm font-bold flex items-center gap-2 text-dashboard-base-content">
                    <IndianRupee size={15} className="text-dashboard-primary" /> Pricing Breakdown
                  </h2>

                  {computingPrice ? (
                    <div className="flex items-center gap-1.5 text-xs text-dashboard-base-content/60">
                      <Loader2 size={12} className="animate-spin" /> Calculating price from hotels + dates…
                    </div>
                  ) : hotelPricing && hotelPricing.days.length > 0 ? (
                    <>
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
                            {hotelPricing.days.map((d) => (
                              <tr key={d.day} className="border-t border-dashboard-base-300">
                                <td className="px-3 py-2 font-medium whitespace-nowrap">Day {d.day}</td>
                                <td className="px-3 py-2 text-dashboard-base-content/70">{d.hotelName} — {d.roomName}</td>
                                <td className="px-3 py-2 text-right">{d.roomsNeeded}</td>
                                <td className="px-3 py-2 text-right">₹{d.pricePerRoom.toLocaleString("en-IN")}</td>
                                <td className="px-3 py-2 text-right">{d.mattresses > 0 ? `${d.mattresses} × ₹${d.extraBedRate.toLocaleString("en-IN")}` : "—"}</td>
                                <td className="px-3 py-2 text-right font-semibold">₹{d.total.toLocaleString("en-IN")}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-dashboard-base-300 bg-dashboard-base-200/40">
                              <td colSpan={5} className="px-3 py-2 text-right font-semibold">Hotel Subtotal</td>
                              <td className="px-3 py-2 text-right font-bold">₹{hotelPricing.hotelSubtotal.toLocaleString("en-IN")}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      <p className="text-[11px] text-dashboard-base-content/50">
                        Computed from each day&apos;s selected hotel room (season/occupancy-aware rate), the travel date, and adult/child count.
                        Cabs, activities, and margin aren&apos;t priced automatically — factor those into the ₹/Person field in Package Details.
                      </p>

                      <Button
                        type="button" size="sm" variant="outline"
                        className="border-dashboard-primary/40 text-dashboard-primary hover:bg-dashboard-primary/10"
                        onClick={applyHotelPricing}
                      >
                        Use ₹{(form.adults + form.children) > 0
                          ? Math.round(hotelPricing.hotelSubtotal / (form.adults + form.children)).toLocaleString("en-IN")
                          : hotelPricing.hotelSubtotal.toLocaleString("en-IN")} as Price Per Person
                      </Button>
                    </>
                  ) : (
                    <p className="text-xs text-dashboard-base-content/50">
                      No hotel rooms picked yet — search and select real hotel rooms in the Itinerary tab to see a computed breakdown here.
                    </p>
                  )}
                </div>
              </TabsContent>

              {/* ── Tab: Inclusions & Terms ──────────────────────────────────────── */}
              <TabsContent value="inclusions" className="space-y-6">
                <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 p-5 space-y-5">
                  <h2 className="text-sm font-bold flex items-center gap-2 text-dashboard-base-content">
                    <CheckCircle size={15} className="text-dashboard-primary" /> Inclusions & Exclusions
                  </h2>
                  <EditableList
                    label="Inclusions"
                    items={form.inclusions}
                    onChange={(v) => setForm((f) => ({ ...f, inclusions: v }))}
                    placeholder="Add inclusion…"
                  />
                  <EditableList
                    label="Exclusions"
                    items={form.exclusions}
                    onChange={(v) => setForm((f) => ({ ...f, exclusions: v }))}
                    placeholder="Add exclusion…"
                  />
                </div>

                <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 p-5 space-y-3">
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
// Sidebar content
// ─────────────────────────────────────────────────────────────────────────────
function ClientDetailsSidebar({ query, j, t, b, s, tr, ac }: {
  query: QueryDetail;
  j: any; t: any; b: any; s: any; tr: any; ac: any;
}) {
  return (
    <>
      <SectionCard title="Client Info" icon={<User size={14} />}>
        <InfoRow label="Name" value={query.name} />
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
          <InfoRow label="Adults" value={t.adults} />
          {(t.children ?? 0) > 0 && <InfoRow label="Children" value={t.children} />}
          {(t.infants ?? 0) > 0 && <InfoRow label="Infants" value={t.infants} />}
          <SpecialNote text={t.specialDemands} />
        </SectionCard>
      )}

      {b && (
        <SectionCard title="Budget" icon={<IndianRupee size={14} />}>
          <InfoRow label="Range" value={`₹${b.min?.toLocaleString("en-IN")} – ₹${b.max?.toLocaleString("en-IN")}`} />
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