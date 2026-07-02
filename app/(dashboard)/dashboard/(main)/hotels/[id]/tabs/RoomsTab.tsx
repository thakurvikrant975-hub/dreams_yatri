"use client";

import { useState, useTransition } from "react";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { Switch } from "../../../components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "../../../components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/app/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "../../../components/ui/alert-dialog";
import { ImagePicker, type PickedImage } from "../../../components/dashboard/ImagePicker";
import {
  Plus, Pencil, Trash2, Star, Loader2, ChevronDown, ChevronUp, ChevronRight, Images,
  Check, ChevronsUpDown, Search, X as XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/app/lib/utils";
import {
  createRoom, updateRoom, deleteRoom,
  createRoomImages, deleteRoomImage, setPrimaryRoomImage,
} from "../../actions";

// ── Types ─────────────────────────────────────────────────────────────────

type RoomImage = {
  id: number;
  room_id: number;
  url: string;
  thumbnail: string | null;
  alt: string | null;
  is_primary: boolean;
  sort_order: number;
};

type DBRoom = {
  id: number;
  hotel_id: number;
  name: string;
  slug: string;
  area_sqft: number | null;
  bed_type: string | null;
  view_type: string | null;
  bed_count: number;
  max_occupancy: number;
  max_adults: number;
  max_children: number;
  extra_bed_capacity: number;
  child_cot_available: boolean;
  amenities: unknown;
  features: unknown;
  bathroom: unknown;
  facilities: unknown;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  images: RoomImage[];
};

// ── Constants ─────────────────────────────────────────────────────────────

const BED_TYPES = [
  "1 Single Bed", "2 Single Beds",
  "1 Double Bed", "2 Double Beds",
  "1 Queen Bed",  "2 Queen Beds",
  "1 King Bed",   "2 King Beds",
  "1 California King Bed",
  "Twin Beds", "Twin + Extra Bed",
  "Queen + Sofa Bed", "King + Sofa Bed",
  "Bunk Bed", "Family Bed",
  "Sofa Bed", "Rollaway Bed",
  "Crib / Cot", "Murphy Bed", "Futon Bed",
  "Multiple Beds", "Mixed Bed Configuration",
];
const VIEW_TYPES = [
  "No View",
  "Sea View", "Ocean View", "Beach View", "Bay View", "Harbor View",
  "Backwater View", "Lake View", "River View", "Lagoon View", "Marina View",
  "Inter-coastal View",
  "Mountain View", "Hill View", "Valley View", "Forest View", "Jungle View",
  "Garden View", "Pool View", "Courtyard View", "Terrace View", "Park View",
  "Resort View", "Golf Course View", "Balcony View",
  "City View", "Landmark View", "Monument View", "Temple View",
  "Palace View", "Desert View", "Countryside View", "Airport View",
];
const AMENITY_GROUPS: { group: string; items: string[] }[] = [
  {
    group: "Popular Amenities",
    items: [
      "Wi-Fi", "Air Conditioning", "TV", "Hot Water", "Housekeeping",
      "Room Service", "Laundry Service", "Iron / Ironing Board", "In-room Dining",
      "Swimming Pool", "Gym / Fitness Centre", "Restaurant", "Bar", "Parking",
      "Elevator / Lift", "Reception", "Power Backup",
    ],
  },
  {
    group: "Room Features",
    items: [
      "Work Desk", "Sofa", "Sitting Area", "Wardrobe / Closet", "Reading Chair",
      "Telephone", "Charging Points", "Minibar", "Intercom",
    ],
  },
  {
    group: "Bathroom",
    items: [
      "Bathtub", "Shower", "Rain Shower", "Hairdryer", "Geyser / Water Heater",
      "Shaving Mirror", "Dental Kit", "Slippers", "Toiletries", "Towels",
    ],
  },
  {
    group: "Kitchen & Appliances",
    items: [
      "Electric Kettle", "Coffee / Tea Maker", "Refrigerator", "Microwave",
      "Water Purifier", "Kitchen / Kitchenette", "Washing Machine", "Laundromat",
    ],
  },
  {
    group: "Media & Entertainment",
    items: ["Cable TV", "Smart TV", "Streaming Services", "Music System"],
  },
  {
    group: "Climate Control",
    items: ["Heater", "Ceiling Fan", "Blackout Curtains", "Humidifier"],
  },
  {
    group: "Safety & Security",
    items: [
      "Electronic Safe", "CCTV", "Smoke Detector", "Fire Extinguisher",
      "First Aid Kit", "Peep Hole", "Security Alarms", "Security Guard",
    ],
  },
  {
    group: "Outdoor & Space",
    items: [
      "Balcony / Terrace", "Private Pool", "Jacuzzi", "Garden Access",
      "Outdoor Furniture", "Prayer Room",
    ],
  },
  {
    group: "Comfort & Extras",
    items: [
      "Mineral Water", "Extra Pillows / Blankets", "Newspaper", "Luggage Storage",
      "Connecting Rooms Available", "Pool / Beach Towels", "Luggage Assistance",
    ],
  },
  {
    group: "Accessibility & Childcare",
    items: [
      "Wheelchair Accessible", "Child Safety Socket Covers", "Baby Cot / Crib",
      "High Chair", "Kids' Club",
    ],
  },
  {
    group: "General Services",
    items: [
      "Concierge", "Doctor on Call", "First-Aid Services", "Lounge",
      "Smoking Rooms", "Multilingual Staff", "Caretaker", "24-Hour Reception",
    ],
  },
  {
    group: "Food & Drink",
    items: ["Dining Area", "Barbeque", "Poolside Bar", "Cafe / Coffee Shop"],
  },
  {
    group: "Spa & Wellness",
    items: [
      "Spa", "Sauna", "Steam Room", "Massage", "Hammam",
      "Hot Spring Bath (Within Premise)",
    ],
  },
  {
    group: "Sports & Activities",
    items: [
      "Beach", "Outdoor Sports", "Skiing", "Cycling", "Golf Course",
      "Kayaking", "Snorkelling", "Water Sports", "Canoeing",
      "Indoor Games Room", "Indoor Games", "Library",
    ],
  },
  {
    group: "Business & Conferences",
    items: [
      "Business Center", "Conference Room", "Printer", "Photocopier", "Projector",
    ],
  },
  {
    group: "Transfers",
    items: [
      "Airport Transfers", "Pickup / Drop", "Railway Station Transfers",
      "Bus Station Transfers", "Metro Station Transfers",
    ],
  },
  {
    group: "Entertainment",
    items: [
      "Professional Photography", "Night Club", "Beach Club",
      "DJ", "Live Music", "Casino", "Bonfire",
    ],
  },
  {
    group: "Shopping & Payment",
    items: [
      "Grocery / Supermarket (Within Premise)", "Souvenir Shop", "Pharmacy",
      "ATM", "Currency Exchange",
    ],
  },
  {
    group: "Pet Essentials",
    items: ["Pet Bowls", "Pet Baskets"],
  },
  {
    group: "Wildlife & Safari",
    items: ["Jungle Safari"],
  },
];

type RoomFormState = {
  name: string;
  slug: string;
  bed_type: string;
  bed_count: number;
  view_type: string;
  area_sqft: string;
  max_occupancy: number;
  max_adults: number;
  max_children: number;
  extra_bed_capacity: number;
  child_cot_available: boolean;
  description: string;
  amenities: string[];
  is_active: boolean;
  images: PickedImage[];
};

const EMPTY_FORM: RoomFormState = {
  name: "",
  slug: "",
  bed_type: "",
  bed_count: 1,
  view_type: "",
  area_sqft: "",
  max_occupancy: 2,
  max_adults: 2,
  max_children: 1,
  extra_bed_capacity: 0,
  child_cot_available: false,
  description: "",
  amenities: [],
  is_active: true,
  images: [],
};

// ── Helpers ───────────────────────────────────────────────────────────────

function toFormState(room: DBRoom): RoomFormState {
  return {
    name:                room.name,
    slug:                room.slug,
    bed_type:            room.bed_type ?? "",
    bed_count:           room.bed_count ?? 1,
    view_type:           room.view_type ?? "",
    area_sqft:           room.area_sqft ? String(room.area_sqft) : "",
    max_occupancy:       room.max_occupancy      ?? 2,
    max_adults:          room.max_adults         ?? room.max_occupancy ?? 2,
    max_children:        room.max_children       ?? 1,
    extra_bed_capacity:  room.extra_bed_capacity ?? 0,
    child_cot_available: room.child_cot_available ?? false,
    description:         room.description ?? "",
    amenities: [
      ...(Array.isArray(room.amenities) ? (room.amenities as string[]) : []),
      ...(Array.isArray(room.features)  ? (room.features  as string[]) : []),
    ],
    is_active:  room.is_active,
    images:     [],
  };
}

function buildFormData(form: RoomFormState): FormData {
  const fd = new FormData();
  fd.append("name",                form.name);
  fd.append("slug",                form.slug);
  fd.append("bed_type",            form.bed_type);
  fd.append("bed_count",           String(form.bed_count));
  fd.append("view_type",           form.view_type);
  fd.append("area_sqft",           form.area_sqft);
  fd.append("max_occupancy",       String(form.max_occupancy));
  fd.append("max_adults",          String(form.max_adults));
  fd.append("max_children",        String(form.max_children));
  fd.append("extra_bed_capacity",  String(form.extra_bed_capacity));
  fd.append("child_cot_available", String(form.child_cot_available));
  fd.append("description",         form.description);
  fd.append("amenities",           JSON.stringify(form.amenities));
  fd.append("features",            JSON.stringify([]));
  fd.append("is_active",           String(form.is_active));
  return fd;
}

function toSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").trim();
}

// ── Searchable Select ─────────────────────────────────────────────────────

function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
}: {
  options:           string[];
  value:             string;
  onChange:          (v: string) => void;
  placeholder?:      string;
  searchPlaceholder?: string;
}) {
  const [open,   setOpen]   = useState(false);
  const [query,  setQuery]  = useState("");

  const filtered = query.trim()
    ? options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(""); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border border-dashboard-base-content/20 bg-dashboard-base-100 px-3 py-2 text-sm cursor-pointer",
            "hover:bg-dashboard-base-200 transition-colors",
            !value && "text-dashboard-base-content/40",
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-dashboard-base-content/40 ml-1" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        style={{ width: "var(--radix-popover-trigger-width)" }}
        className="p-0 rounded-xl border border-dashboard-base-content/20 bg-dashboard-base-100 shadow-lg"
      >
        {/* Search input */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-dashboard-base-content/10">
          <Search className="h-3.5 w-3.5 shrink-0 text-dashboard-base-content/40" />
          <input
            autoFocus
            placeholder={searchPlaceholder}
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-dashboard-base-content/30 text-dashboard-base-content"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")}
              className="text-dashboard-base-content/30 hover:text-dashboard-base-content cursor-pointer">
              <XIcon className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Scrollable list */}
        <div className="max-h-56 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-dashboard-base-content/40">No match</p>
          ) : filtered.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => { onChange(opt === value ? "" : opt); setOpen(false); setQuery(""); }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left cursor-pointer transition-colors",
                opt === value
                  ? "bg-dashboard-primary/10 text-dashboard-primary"
                  : "hover:bg-dashboard-base-200 text-dashboard-base-content",
              )}
            >
              <Check className={cn("h-3.5 w-3.5 shrink-0", opt === value ? "opacity-100" : "opacity-0")} />
              {opt}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Grouped Amenities Picker ──────────────────────────────────────────────

function GroupedAmenitiesPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [query, setQuery]           = useState("");
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const open = new Set<string>();
    for (const g of AMENITY_GROUPS) {
      if (g.items.some(i => selected.includes(i))) open.add(g.group);
    }
    return open;
  });

  const selSet   = new Set(selected);
  const searching = query.trim().length > 0;
  const filtered = AMENITY_GROUPS
    .map(g => ({ ...g, items: searching ? g.items.filter(i => i.toLowerCase().includes(query.toLowerCase())) : g.items }))
    .filter(g => g.items.length > 0);

  function toggle(item: string) {
    onChange(selSet.has(item) ? selected.filter(x => x !== item) : [...selected, item]);
  }

  function toggleGroupAll(items: string[]) {
    const allSel = items.every(i => selSet.has(i));
    onChange(allSel
      ? selected.filter(x => !items.includes(x))
      : [...selected, ...items.filter(i => !selSet.has(i))],
    );
  }

  function toggleGroupOpen(group: string) {
    setOpenGroups(prev => {
      const next = new Set(prev);
      next.has(group) ? next.delete(group) : next.add(group);
      return next;
    });
  }

  return (
    <div className="border border-dashboard-base-content/15 rounded-xl overflow-hidden">
      {/* Search + total count */}
      <div className="flex items-center gap-2 px-3 py-2 bg-dashboard-base-200/50 border-b border-dashboard-base-content/10">
        <Search className="h-3.5 w-3.5 shrink-0 text-dashboard-base-content/40" />
        <input
          placeholder="Search amenities…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-dashboard-base-content/30 text-dashboard-base-content"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")}
            className="text-dashboard-base-content/30 hover:text-dashboard-base-content cursor-pointer">
            <XIcon className="h-3 w-3" />
          </button>
        )}
        {selected.length > 0 && (
          <span className="shrink-0 text-[10px] font-medium text-dashboard-primary bg-dashboard-primary/10 px-1.5 py-0.5 rounded-full">
            {selected.length} selected
          </span>
        )}
      </div>

      {/* Groups */}
      <div className="max-h-80 overflow-y-auto divide-y divide-dashboard-base-content/8">
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-xs text-dashboard-base-content/40">No amenities match</p>
        ) : filtered.map(({ group, items }) => {
          const inGroup  = items.filter(i => selSet.has(i)).length;
          const allSel   = inGroup === items.length;
          const isOpen   = searching || openGroups.has(group);

          return (
            <div key={group}>
              {/* Group header */}
              <div className="flex items-center justify-between px-3 py-2 bg-dashboard-base-200/30">
                <button
                  type="button"
                  onClick={() => !searching && toggleGroupOpen(group)}
                  className="flex items-center gap-1.5 flex-1 text-left cursor-pointer"
                >
                  {!searching && (isOpen
                    ? <ChevronDown  className="h-3.5 w-3.5 text-dashboard-base-content/40 shrink-0" />
                    : <ChevronRight className="h-3.5 w-3.5 text-dashboard-base-content/40 shrink-0" />
                  )}
                  <span className="text-xs font-semibold text-dashboard-base-content/70">{group}</span>
                  {inGroup > 0 && (
                    <span className="text-[10px] font-medium text-dashboard-primary bg-dashboard-primary/10 px-1.5 py-0.5 rounded-full">
                      {inGroup}/{items.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => toggleGroupAll(items)}
                  className="text-[10px] font-medium text-dashboard-primary/70 hover:text-dashboard-primary cursor-pointer ml-2 shrink-0"
                >
                  {allSel ? "Clear" : "All"}
                </button>
              </div>

              {/* Items grid */}
              {isOpen && (
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 px-4 py-2">
                  {items.map(item => (
                    <label key={item} className="flex items-center gap-2 py-1 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={selSet.has(item)}
                        onChange={() => toggle(item)}
                        className="h-3.5 w-3.5 accent-primary shrink-0 cursor-pointer"
                      />
                      <span className="text-xs text-dashboard-base-content/70 group-hover:text-dashboard-base-content transition-colors leading-tight">
                        {item}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tag Pill ──────────────────────────────────────────────────────────────

function TagPills({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  function toggle(opt: string) {
    onChange(
      selected.includes(opt) ? selected.filter((x) => x !== opt) : [...selected, opt]
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
              active
                ? "bg-dashboard-primary/10 border-dashboard-primary text-dashboard-primary"
                : "bg-dashboard-base-100 border-dashboard-base-content/20 text-dashboard-base-content/60 hover:border-dashboard-primary/50"
            )}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ── Stepper ───────────────────────────────────────────────────────────────

function Stepper({
  value,
  onChange,
  min = 0,
  max = 20,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center border border-dashboard-base-content/20 rounded-lg overflow-hidden bg-dashboard-base-100 h-9">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="w-9 h-full flex items-center justify-center text-lg text-dashboard-base-content/50 hover:bg-dashboard-base-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
      >
        −
      </button>
      <span className="w-10 text-center text-sm font-bold text-dashboard-base-content tabular-nums">
        {String(value).padStart(2, "0")}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="w-9 h-full flex items-center justify-center text-lg text-dashboard-base-content/50 hover:bg-dashboard-base-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
      >
        +
      </button>
    </div>
  );
}

function OccupancyRow({
  label,
  description,
  value,
  onChange,
  min,
  max,
  hint,
}: {
  label:       string;
  description: string;
  value:       number;
  onChange:    (v: number) => void;
  min?:        number;
  max?:        number;
  hint?:       string;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-dashboard-base-content/10 last:border-0">
      <div className="flex-1 pr-4">
        <p className="text-sm font-semibold text-dashboard-base-content">{label}</p>
        <p className="text-xs text-dashboard-base-content/50 mt-0.5">{description}</p>
        {hint && <p className="text-[10px] text-dashboard-primary/60 mt-0.5">{hint}</p>}
      </div>
      <Stepper value={value} onChange={onChange} min={min} max={max} />
    </div>
  );
}

function OccupancyToggleRow({
  label,
  description,
  enabled,
  count,
  onToggle,
  onCount,
  min = 1,
  max = 5,
}: {
  label:       string;
  description: string;
  enabled:     boolean;
  count:       number;
  onToggle:    (on: boolean) => void;
  onCount:     (v: number) => void;
  min?:        number;
  max?:        number;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-dashboard-base-content/10">
      <div className="flex-1 pr-4">
        <p className="text-sm font-semibold text-dashboard-base-content">{label}</p>
        <p className="text-xs text-dashboard-base-content/50 mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-3">
        <Switch checked={enabled} onCheckedChange={onToggle} />
        {enabled && <Stepper value={count} onChange={onCount} min={min} max={max} />}
      </div>
    </div>
  );
}

function OccupancySwitchRow({
  label,
  description,
  value,
  onChange,
}: {
  label:       string;
  description: string;
  value:       boolean;
  onChange:    (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-dashboard-base-content/10">
      <div className="flex-1 pr-4">
        <p className="text-sm font-semibold text-dashboard-base-content">{label}</p>
        <p className="text-xs text-dashboard-base-content/50 mt-0.5">{description}</p>
      </div>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}

// ── Room Form ─────────────────────────────────────────────────────────────

function RoomForm({
  initial,
  onSave,
  onCancel,
  isSaving,
  isNew = false,
}: {
  initial: RoomFormState;
  onSave: (form: RoomFormState) => void;
  onCancel: () => void;
  isSaving: boolean;
  isNew?: boolean;
}) {
  const [form, setForm] = useState<RoomFormState>(initial);

  function update<K extends keyof RoomFormState>(key: K, value: RoomFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    const capped = val.charAt(0).toUpperCase() + val.slice(1);
    update("name", capped);
    if (!initial.slug) update("slug", toSlug(capped));
  }

  function handleBaseAdultsChange(v: number) {
    setForm(prev => {
      const autoMaxAdults = v + (prev.extra_bed_capacity ?? 1);
      return {
        ...prev,
        max_occupancy: v,
        max_adults: Math.max(prev.max_adults ?? autoMaxAdults, autoMaxAdults),
      };
    });
  }

  function handleExtraBedsChange(v: number) {
    setForm(prev => {
      if (v === 0) return { ...prev, extra_bed_capacity: 0 };
      const autoMaxAdults = (prev.max_occupancy ?? 2) + v;
      return {
        ...prev,
        extra_bed_capacity: v,
        max_adults: Math.max(prev.max_adults ?? autoMaxAdults, autoMaxAdults),
      };
    });
  }

  return (
    <div className="border border-dashboard-base-content/20 rounded-xl p-4 space-y-4 bg-dashboard-base-200/60">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm text-dashboard-base-content">Room Name <span className="text-dashboard-error">*</span></Label>
          <Input placeholder="Deluxe Queen Room" value={form.name} onChange={handleNameChange} autoFocus
            className="bg-dashboard-base-100 border-dashboard-base-content/20" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm text-dashboard-base-content">Slug <span className="text-dashboard-error">*</span></Label>
          <Input placeholder="deluxe-queen-room" value={form.slug}
            onChange={(e) => update("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
            className="bg-dashboard-base-100 border-dashboard-base-content/20" />
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 space-y-1.5">
          <Label className="text-sm text-dashboard-base-content">Bed Type</Label>
          <SearchableSelect
            options={BED_TYPES}
            value={form.bed_type}
            onChange={(v) => update("bed_type", v)}
            placeholder="Select bed type…"
            searchPlaceholder="Search bed type…"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm text-dashboard-base-content">Bed Count</Label>
          <Stepper value={form.bed_count} onChange={(v) => update("bed_count", v)} min={1} max={10} />
        </div>
        <div className="flex-1 space-y-1.5">
          <Label className="text-sm text-dashboard-base-content">View Type</Label>
          <SearchableSelect
            options={VIEW_TYPES}
            value={form.view_type}
            onChange={(v) => update("view_type", v)}
            placeholder="Select view…"
            searchPlaceholder="Search view…"
          />
        </div>
        <div className="w-32 space-y-1.5">
          <Label className="text-sm text-dashboard-base-content">Area (sq ft)</Label>
          <Input type="number" placeholder="350" value={form.area_sqft}
            onChange={(e) => update("area_sqft", e.target.value)}
            className="bg-dashboard-base-100 border-dashboard-base-content/20" />
        </div>
      </div>

      {/* ── Guest Occupancy ─────────────────────────────── */}
      <div className="border border-dashboard-base-content/15 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 bg-dashboard-base-200/60 border-b border-dashboard-base-content/10">
          <p className="text-xs font-bold uppercase tracking-widest text-dashboard-base-content/50">Guest Occupancy</p>
          <p className="text-[11px] text-dashboard-base-content/40 mt-0.5">
            Base occupancy is from standard beds. Max occupancy includes extra beds.
          </p>
        </div>
        <div className="px-4 divide-y divide-dashboard-base-content/8 bg-dashboard-base-100">
          <OccupancyRow
            label="Base Adults"
            description="Adults accommodated on standard beds (no surcharge)"
            value={form.max_occupancy}
            onChange={handleBaseAdultsChange}
            min={1} max={10}
          />
          <OccupancyToggleRow
            label="Extra Bed Available"
            description="Additional mattresses / rollaway beds available per room"
            enabled={form.extra_bed_capacity > 0}
            count={form.extra_bed_capacity || 1}
            onToggle={(on) => handleExtraBedsChange(on ? 1 : 0)}
            onCount={handleExtraBedsChange}
            min={1} max={5}
          />
          <OccupancyRow
            label="Max Adults"
            description="Hard cap on total adults in this room (including extra beds)"
            value={form.max_adults}
            onChange={(v) => update("max_adults", v)}
            min={form.max_occupancy} max={15}
            hint={`Suggested: ${form.max_occupancy} base + ${form.extra_bed_capacity} extra = ${form.max_occupancy + form.extra_bed_capacity}`}
          />
          <OccupancyRow
            label="Max Children"
            description="Maximum children that can be accommodated (may share adult beds)"
            value={form.max_children}
            onChange={(v) => update("max_children", v)}
            min={0} max={6}
          />
          <OccupancySwitchRow
            label="Child Cot / Crib Available"
            description="Baby cot or crib available on request (no extra charge)"
            value={form.child_cot_available}
            onChange={(v) => update("child_cot_available", v)}
          />
          <div className="flex items-center justify-between py-3">
            <div className="flex-1 pr-4">
              <p className="text-sm font-semibold text-dashboard-base-content/60">Max Occupancy</p>
              <p className="text-xs text-dashboard-base-content/40 mt-0.5">Total hard cap (adults + children) — computed</p>
            </div>
            <div className="flex items-center justify-center w-28 h-9 rounded-lg bg-dashboard-base-200/60 border border-dashboard-base-content/15">
              <span className="text-sm font-bold text-dashboard-base-content tabular-nums">
                {String((form.max_adults ?? 2) + (form.max_children ?? 1)).padStart(2, "0")}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm text-dashboard-base-content">Description</Label>
        <Textarea placeholder="Spacious room with panoramic views..." value={form.description}
          onChange={(e) => { const v = e.target.value; update("description", v.charAt(0).toUpperCase() + v.slice(1)); }}
          rows={2} className="bg-dashboard-base-100 border-dashboard-base-content/20" />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm text-dashboard-base-content">Amenities</Label>
        <GroupedAmenitiesPicker selected={form.amenities} onChange={(v) => update("amenities", v)} />
      </div>

      {isNew && (
        <div className="space-y-1.5">
          <Label className="text-sm text-dashboard-base-content">
            Room Photos <span className="text-xs text-dashboard-base-content/50">(optional)</span>
          </Label>
          <ImagePicker folder="hotels" value={form.images} onChange={(imgs) => update("images", imgs)}
            maxFiles={8} label="Add Room Photos" hint="JPG, PNG, WebP" />
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-dashboard-base-content/10">
        <div className="flex items-center gap-2">
          <Switch checked={form.is_active} onCheckedChange={(v) => update("is_active", v)} />
          <span className="text-sm text-dashboard-base-content/60">Active</span>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isSaving}
            className="text-dashboard-base-content/60 hover:text-dashboard-base-content hover:bg-dashboard-base-300 cursor-pointer">
            Cancel
          </Button>
          <Button type="button" size="sm" disabled={!form.name || !form.slug || isSaving} onClick={() => onSave(form)}
            className="bg-dashboard-primary text-dashboard-primary-content hover:bg-dashboard-primary/90 cursor-pointer">
            {isSaving ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Saving...</> : "Save Room"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Room Image Thumb ──────────────────────────────────────────────────────

function RoomImageThumb({
  image,
  room_id,
  hotel_id,
  onDelete,
  onSetPrimary,
}: {
  image: RoomImage;
  room_id: number;
  hotel_id: number;
  onDelete: () => void;
  onSetPrimary: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!;

  return (
    <div
      className={cn(
        "group relative aspect-square rounded-xl overflow-hidden border-2 bg-dashboard-base-200",
        image.is_primary ? "border-dashboard-primary" : "border-dashboard-base-content/20 hover:border-dashboard-base-content/40"
      )}
    >
      <img src={`${base}/${image.url}`} alt={image.alt ?? "Room image"} className="w-full h-full object-cover" />
      {image.is_primary && (
        <Badge className="absolute bottom-1 left-1 text-[9px] px-1.5 py-0 pointer-events-none bg-dashboard-primary text-dashboard-primary-content">
          <Star className="h-2.5 w-2.5 mr-0.5" /> Primary
        </Badge>
      )}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
        {!image.is_primary && (
          <Button type="button" size="sm" variant="secondary" className="text-[10px] h-6 px-2 cursor-pointer"
            disabled={isPending}
            onClick={() => startTransition(async () => {
              const r = await setPrimaryRoomImage(image.id, room_id, hotel_id);
              if (r.success) { toast.success(r.message); onSetPrimary(); }
              else toast.error(r.message);
            })}>
            <Star className="h-2.5 w-2.5 mr-1" /> Set Primary
          </Button>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" size="sm"
              className="text-[10px] h-6 px-2 bg-dashboard-error text-dashboard-error-content hover:bg-dashboard-error/90 cursor-pointer">
              <Trash2 className="h-2.5 w-2.5 mr-1" /> Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Image</AlertDialogTitle>
              <AlertDialogDescription>This will permanently delete the image from storage.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => startTransition(async () => {
                  const r = await deleteRoomImage(image.id, room_id, hotel_id, image.url, image.thumbnail ?? undefined);
                  if (r.success) { toast.success(r.message); onDelete(); }
                  else toast.error(r.message);
                })}
                className="bg-dashboard-error text-dashboard-error-content hover:bg-dashboard-error/90 cursor-pointer">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// ── Room Images Section ───────────────────────────────────────────────────

function RoomImagesSection({
  room,
  hotel_id,
  images,
  onImagesChanged,
}: {
  room: DBRoom;
  hotel_id: number;
  images: RoomImage[];
  onImagesChanged: (updated: RoomImage[]) => void;
}) {
  const [picks, setPicks] = useState<PickedImage[]>([]);
  const [isPending, startTransition] = useTransition();

  function handleDelete(id: number) {
    onImagesChanged(images.filter((img) => img.id !== id));
  }

  function handleSetPrimary(id: number) {
    onImagesChanged(images.map((img) => ({ ...img, is_primary: img.id === id })));
  }

  function handleSave() {
    const uploaded = picks.filter((p) => p.status === "uploaded" && p.key);
    if (uploaded.length === 0) { toast.error("Wait for uploads to finish"); return; }

    startTransition(async () => {
      const result = await createRoomImages(
        room.id,
        hotel_id,
        uploaded.map((p) => ({ url: p.key!, thumbnail: p.key, alt: p.name }))
      );
      if (result.success) {
        toast.success(result.message);
        setPicks([]);
        const added: RoomImage[] = uploaded.map((p, i) => ({
          id: Date.now() + i,
          room_id: room.id,
          url: p.key!,
          thumbnail: p.key ?? null,
          alt: p.name,
          is_primary: images.length === 0 && i === 0,
          sort_order: images.length + i,
        }));
        onImagesChanged([...images, ...added]);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="mt-4 space-y-3 pt-4 border-t border-dashboard-base-content/10">
      <p className="text-xs font-medium text-dashboard-base-content/50 uppercase tracking-wider flex items-center gap-1.5">
        <Images className="h-3.5 w-3.5" /> Room Photos ({images.length})
      </p>

      {images.length > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {images
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((img) => (
              <RoomImageThumb
                key={img.id}
                image={img}
                room_id={room.id}
                hotel_id={hotel_id}
                onDelete={() => handleDelete(img.id)}
                onSetPrimary={() => handleSetPrimary(img.id)}
              />
            ))}
        </div>
      )}

      <ImagePicker
        folder="hotels"
        value={picks}
        onChange={setPicks}
        maxFiles={10}
        label="Add Room Photos"
        hint="JPG, PNG, WebP"
      />

      {picks.length > 0 && (
        <div className="flex justify-end">
          <Button
            type="button" size="sm"
            onClick={handleSave}
            disabled={isPending || picks.some((p) => p.status === "uploading")}
            className="gap-1.5 bg-dashboard-primary text-dashboard-primary-content hover:bg-dashboard-primary/90 cursor-pointer"
          >
            {isPending
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving...</>
              : <>Save {picks.filter((p) => p.status === "uploaded").length} Photo{picks.length !== 1 ? "s" : ""}</>
            }
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Room Row ──────────────────────────────────────────────────────────────

function RoomRow({
  room,
  hotel_id,
  onEdit,
  onDelete,
}: {
  room: DBRoom;
  hotel_id: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [images, setImages] = useState<RoomImage[]>(room.images);
  const [isPending, startTransition] = useTransition();
  const amenities = Array.isArray(room.amenities) ? (room.amenities as string[]) : [];

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteRoom(room.id, hotel_id);
      if (result.success) { toast.success(result.message); onDelete(); }
      else toast.error(result.message);
    });
  }

  return (
    <div className="border border-dashboard-base-content/20 rounded-xl overflow-hidden bg-dashboard-base-100">
      {/* Room summary row */}
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-dashboard-base-200 transition-colors cursor-default">
        <div className="h-12 w-16 rounded-lg bg-dashboard-base-200 border border-dashboard-base-content/10 shrink-0 overflow-hidden">
          {(() => {
            const primary = images.find((img) => img.is_primary) ?? images[0];
            return primary ? (
              <img src={`${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${primary.url}`} alt={room.name} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-dashboard-base-content/30 text-xs">No photo</div>
            );
          })()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm text-dashboard-base-content">{room.name}</p>
            {!room.is_active && (
              <Badge className="text-[10px] px-1.5 py-0 bg-dashboard-base-300 text-dashboard-base-content/50 border border-dashboard-base-content/20">Inactive</Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {room.bed_type && <span className="text-xs text-dashboard-base-content/50">{room.bed_type}</span>}
            {room.view_type && <span className="text-xs text-dashboard-base-content/50">· {room.view_type}</span>}
            {room.area_sqft && <span className="text-xs text-dashboard-base-content/50">· {room.area_sqft} sq ft</span>}
            <span className="text-xs text-dashboard-base-content/50">
              · {room.max_occupancy ?? 2} base{(room.extra_bed_capacity ?? 0) > 0 ? ` +${room.extra_bed_capacity} extra` : ""} · max {room.max_adults ?? "—"}A/{room.max_children ?? "—"}C
            </span>
            {amenities.slice(0, 3).map((a) => (
              <Badge key={a} className="text-[10px] px-1.5 py-0 bg-dashboard-primary/10 text-dashboard-primary border border-dashboard-primary/20">{a}</Badge>
            ))}
            {amenities.length > 3 && (
              <Badge className="text-[10px] px-1.5 py-0 bg-dashboard-base-200 text-dashboard-base-content/50 border border-dashboard-base-content/20">+{amenities.length - 3}</Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button type="button" variant="ghost" size="sm"
            className="h-7 text-xs gap-1 text-dashboard-base-content/60 hover:text-dashboard-base-content hover:bg-dashboard-base-200 cursor-pointer"
            onClick={() => setExpanded((p) => !p)}>
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {images.length > 0 ? `${images.length} photos` : "Photos"}
          </Button>
          <Button type="button" variant="ghost" size="icon"
            className="h-7 w-7 text-dashboard-base-content/50 hover:text-dashboard-primary hover:bg-dashboard-primary/10 cursor-pointer"
            onClick={onEdit}>
            <Pencil className="h-3 w-3" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="ghost" size="icon"
                className="h-7 w-7 text-dashboard-base-content/50 hover:text-dashboard-error hover:bg-dashboard-error/10 cursor-pointer"
                disabled={isPending}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Room</AlertDialogTitle>
                <AlertDialogDescription>
                  Delete <span className="font-semibold">{room.name}</span>? This will also delete all room images, pricing plans, and occupancy prices linked to this room.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}
                  className="bg-dashboard-error text-dashboard-error-content hover:bg-dashboard-error/90 cursor-pointer">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 bg-dashboard-base-200/30 border-t border-dashboard-base-content/10">
          <RoomImagesSection room={room} hotel_id={hotel_id} images={images} onImagesChanged={setImages} />
        </div>
      )}
    </div>
  );
}

// ── Main RoomsTab ─────────────────────────────────────────────────────────

export function RoomsTab({
  hotel_id,
  rooms: initialRooms,
}: {
  hotel_id: number;
  rooms: DBRoom[];
}) {
  const [rooms, setRooms] = useState<DBRoom[]>(initialRooms);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAdd(form: RoomFormState) {
    startTransition(async () => {
      const result = await createRoom(hotel_id, buildFormData(form));
      if (result.success) {
        const roomId = result.id!;
        const uploaded = form.images.filter((p) => p.status === "uploaded" && p.key);
        if (uploaded.length > 0) {
          const imgResult = await createRoomImages(
            roomId,
            hotel_id,
            uploaded.map((p) => ({ url: p.key!, thumbnail: p.key, alt: p.name }))
          );
          if (!imgResult.success) toast.error("Room created but photos failed to save");
        }
        toast.success(result.message);
        setAdding(false);
        setRooms((prev) => [
          ...prev,
          {
            id: roomId,
            hotel_id,
            name: form.name,
            slug: form.slug,
            bed_type:            form.bed_type || null,
            bed_count:           form.bed_count,
            view_type:           form.view_type || null,
            area_sqft:           form.area_sqft ? Number(form.area_sqft) : null,
            max_occupancy:       form.max_occupancy,
            max_adults:          form.max_adults,
            max_children:        form.max_children,
            extra_bed_capacity:  form.extra_bed_capacity,
            child_cot_available: form.child_cot_available,
            description: form.description || null,
            amenities: form.amenities,
            features: [],
            bathroom: null,
            facilities: null,
            is_active: form.is_active,
            sort_order: prev.length,
            images: uploaded.map((p, i) => ({
              id: Date.now() + i,
              room_id: roomId,
              url: p.key!,
              thumbnail: p.key ?? null,
              alt: p.name,
              is_primary: i === 0,
              sort_order: i,
            })),
          },
        ]);
      } else {
        toast.error(result.message);
      }
    });
  }

  function handleEdit(id: number, form: RoomFormState) {
    startTransition(async () => {
      const result = await updateRoom(id, hotel_id, buildFormData(form));
      if (result.success) {
        toast.success(result.message);
        setEditId(null);
        setRooms((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  name:                form.name,
                  bed_type:            form.bed_type || null,
                  bed_count:           form.bed_count,
                  view_type:           form.view_type || null,
                  area_sqft:           form.area_sqft ? Number(form.area_sqft) : null,
                  max_occupancy:       form.max_occupancy,
                  max_adults:          form.max_adults,
                  max_children:        form.max_children,
                  extra_bed_capacity:  form.extra_bed_capacity,
                  child_cot_available: form.child_cot_available,
                  description:         form.description || null,
                  amenities:           form.amenities,
                  features:            [],
                  is_active:           form.is_active,
                }
              : r
          )
        );
      } else {
        toast.error(result.message);
      }
    });
  }

  function handleDelete(id: number) {
    setRooms((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-5 bg-dashboard-base-100 p-8 rounded-xl shadow-lg border border-dashboard-base-content/20">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-dashboard-base-content">Rooms</p>
          <p className="text-xs text-dashboard-base-content/50 mt-0.5">
            {rooms.length} room{rooms.length !== 1 ? "s" : ""} · Manage room types, specs and photos
          </p>
        </div>
        {!adding && editId === null && (
          <Button size="sm"
            className="gap-1.5 bg-dashboard-primary text-dashboard-primary-content hover:bg-dashboard-primary/90 cursor-pointer"
            onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" /> Add Room
          </Button>
        )}
      </div>

      {adding && (
        <RoomForm initial={EMPTY_FORM} onSave={handleAdd} onCancel={() => setAdding(false)} isSaving={isPending} isNew />
      )}

      <div className="space-y-3">
        {rooms.map((room) =>
          editId === room.id ? (
            <RoomForm key={room.id} initial={toFormState(room)}
              onSave={(form) => handleEdit(room.id, form)} onCancel={() => setEditId(null)} isSaving={isPending} />
          ) : (
            <RoomRow key={room.id} room={room} hotel_id={hotel_id}
              onEdit={() => setEditId(room.id)} onDelete={() => handleDelete(room.id)} />
          )
        )}
      </div>

      {rooms.length === 0 && !adding && (
        <div className="flex flex-col items-center justify-center py-12 rounded-xl border border-dashed border-dashboard-base-content/20 bg-dashboard-base-200/30">
          <p className="text-sm font-medium text-dashboard-base-content/50">No rooms added yet</p>
          <p className="text-xs text-dashboard-base-content/40 mt-1">Click &ldquo;Add Room&rdquo; to define your first room type</p>
        </div>
      )}
    </div>
  );
}
