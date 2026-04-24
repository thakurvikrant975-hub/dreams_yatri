"use client";

import { useState, useTransition } from "react";
import { useRouter }  from "next/navigation";
import { Button }   from "../../../components/ui/button";
import { Input }    from "../../../components/ui/input";
import { Label }    from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { Badge }    from "../../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "../../../components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "../../../components/ui/alert-dialog";
import {
  CalendarDays, Plus, Pencil, Trash2, Loader2,
  Hotel, Activity, Utensils, X, Search,
  FileText, Car, Bell,
} from "lucide-react";
import { toast } from "sonner";
import {
  upsertItineraryDayFull,
  clearItineraryDay,
  getItineraryDayDetails,
} from "../../actions";
import type { RouteOption } from "../../actions";
import { MultiStepModal } from "../../../components/dashboard/MultiStepModel";
import type { Step } from "../../../components/dashboard/MultiStepModel";

// ── Constants ─────────────────────────────────────────────────────────────

const MEAL_OPTIONS = ["Breakfast", "Lunch", "Dinner"];
const BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!;

// ── Types ─────────────────────────────────────────────────────────────────

type HotelOption = {
  id:          number;
  name:        string;
  slug:        string;
  star_rating: number | null;
  category:    string | null;
  destination: { name: string };
  images:      { url: string; thumbnail: string | null }[];
};

type ActivityOption = {
  id:             number;
  name:           string;
  slug:           string;
  category:       string | null;
  duration_hours: unknown;
  destination:    { name: string };
};

type StayCategory = {
  id:         number;
  slug:       string;
  label:      string;
  is_default: boolean;
  sort_order: number;
  is_active:  boolean;
};

type ItineraryDay = {
  id:           number;
  day:          number;
  title:        string;
  description:  string | null;
  activity_ids: unknown;
  meals:        unknown;
  route_index:  number | null;
  route_id:     number | null;
  hotel_id:     number | null;
  hotel_days:   number | null;
  hotel: {
    id:          number;
    name:        string;
    star_rating: number | null;
    category:    string | null;
  } | null;
};

type Duration = {
  id:          number;
  label:       string;
  days:        number;
  nights:      number;
  routes:      unknown;
  is_default:  boolean;
  itineraries: ItineraryDay[];
};

type HotelAssignment = {
  stay_category_id: number;
  hotel_id:         number | null;
  hotel_days:       number | null;
};

type TransferInput = {
  cab_type:      string;
  pickup_point:  string;
  drop_point:    string;
  duration_text: string;
};

type NoteInput = {
  message:            string;
  type:               string;
  position:           string;
  optional_link_text: string;
  optional_link_url:  string;
};

type FullDayData = NonNullable<Awaited<ReturnType<typeof getItineraryDayDetails>>>;

// ── Activity search & select ───────────────────────────────────────────────

function ActivitySelector({
  activities,
  selectedIds,
  onChange,
}: {
  activities:  ActivityOption[];
  selectedIds: number[];
  onChange:    (ids: number[]) => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = activities.filter(a =>
    !search ||
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.destination.name.toLowerCase().includes(search.toLowerCase())
  );
  const selected = activities.filter(a => selectedIds.includes(a.id));

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map(a => (
            <span key={a.id}
              className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
              {a.name}
              <button type="button" onClick={() => onChange(selectedIds.filter(id => id !== a.id))}>
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="space-y-1.5">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search activities..."
            className="pl-8 h-8 text-sm"
          />
        </div>
        {search && (
          <div className="rounded-lg border bg-background max-h-40 overflow-y-auto">
            {filtered.filter(a => !selectedIds.includes(a.id)).map(a => (
              <button
                key={a.id}
                type="button"
                className="w-full flex items-center justify-between text-sm px-3 py-2 hover:bg-muted text-left"
                onClick={() => { onChange([...selectedIds, a.id]); setSearch(""); }}
              >
                <span>{a.name}</span>
                <span className="text-xs text-muted-foreground">{a.destination.name}</span>
              </button>
            ))}
            {filtered.filter(a => !selectedIds.includes(a.id)).length === 0 && (
              <p className="text-xs text-muted-foreground p-3">No activities found</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Multi-Step Day Dialog ─────────────────────────────────────────────────

function MultiStepDayDialog({
  open,
  onOpenChange,
  package_id,
  duration_id,
  day,
  routes,
  hotels,
  activities,
  stayCategories,
  existing,
  existingFullData,
}: {
  open:              boolean;
  onOpenChange:      (b: boolean) => void;
  package_id:        number;
  duration_id:       number;
  day:               number;
  routes:            RouteOption[];
  hotels:            HotelOption[];
  activities:        ActivityOption[];
  stayCategories:    StayCategory[];
  existing?:         ItineraryDay;
  existingFullData?: FullDayData | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const fd = existingFullData ?? null;

  // ── Form state ───────────────────────────────────────────────────────────
  const [title,       setTitle]       = useState(fd?.title       ?? existing?.title       ?? `Day ${day}`);
  const [description, setDescription] = useState(fd?.description ?? existing?.description ?? "");
  const [meals,       setMeals]       = useState<string[]>(
    (fd?.meals as string[] | null) ?? (existing?.meals as string[] | null) ?? []
  );
  const [routeId, setRouteId] = useState<string>(
    existing?.route_id != null ? String(existing.route_id) : "all"
  );
  const [hotelAssignments, setHotelAssignments] = useState<HotelAssignment[]>(
    stayCategories.map(cat => {
      const match = fd?.itinerary_hotels.find(h => h.stay_category_id === cat.id);
      return {
        stay_category_id: cat.id,
        hotel_id:         match?.hotel_id  ?? null,
        hotel_days:       match?.hotel_days ?? null,
      };
    })
  );
  const [selectedActivityIds, setSelectedActivityIds] = useState<number[]>(
    fd?.itinerary_activities.map(a => a.activity_id) ??
    (existing?.activity_ids as number[] | null) ?? []
  );
  const [transfers, setTransfers] = useState<TransferInput[]>(
    fd?.itinerary_transfers.map(t => ({
      cab_type:      t.cab_type      ?? "",
      pickup_point:  t.pickup_point  ?? "",
      drop_point:    t.drop_point    ?? "",
      duration_text: t.duration_text ?? "",
    })) ?? []
  );
  const [notes, setNotes] = useState<NoteInput[]>(
    fd?.itinerary_notes.map(n => ({
      message:            n.message,
      type:               n.type,
      position:           n.position,
      optional_link_text: n.optional_link_text ?? "",
      optional_link_url:  n.optional_link_url  ?? "",
    })) ?? []
  );

  // ── Helpers ───────────────────────────────────────────────────────────────

  function toggleMeal(meal: string) {
    setMeals(prev => prev.includes(meal) ? prev.filter(m => m !== meal) : [...prev, meal]);
  }

  function updateHotel(stay_category_id: number, patch: Partial<HotelAssignment>) {
    setHotelAssignments(prev =>
      prev.map(a => a.stay_category_id === stay_category_id ? { ...a, ...patch } : a)
    );
  }

  function addTransfer() {
    setTransfers(prev => [...prev, { cab_type: "", pickup_point: "", drop_point: "", duration_text: "" }]);
  }
  function removeTransfer(i: number) { setTransfers(prev => prev.filter((_, idx) => idx !== i)); }
  function updateTransfer(i: number, patch: Partial<TransferInput>) {
    setTransfers(prev => prev.map((t, idx) => idx === i ? { ...t, ...patch } : t));
  }

  function addNote() {
    setNotes(prev => [...prev, { message: "", type: "info", position: "bottom", optional_link_text: "", optional_link_url: "" }]);
  }
  function removeNote(i: number) { setNotes(prev => prev.filter((_, idx) => idx !== i)); }
  function updateNote(i: number, patch: Partial<NoteInput>) {
    setNotes(prev => prev.map((n, idx) => idx === i ? { ...n, ...patch } : n));
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleComplete(_data: Record<string, unknown>) {
    if (!title.trim()) { toast.error("Title is required"); return; }
    startTransition(async () => {
      const resolvedRouteId = routeId === "all" ? null : Number(routeId);
      const r = await upsertItineraryDayFull(package_id, duration_id, day, {
        title,
        description,
        meals,
        route_index:  resolvedRouteId,
        route_id:     resolvedRouteId,
        activity_ids: selectedActivityIds,
        hotels:       hotelAssignments
          .filter(a => a.hotel_id !== null)
          .map(a => ({
            stay_category_id: a.stay_category_id,
            hotel_id:         a.hotel_id!,
            hotel_days:       a.hotel_days,
          })),
        activities:  selectedActivityIds,
        transfers:   transfers
          .filter(t => t.pickup_point || t.drop_point || t.cab_type)
          .map(t => ({
            cab_type:      t.cab_type      || null,
            pickup_point:  t.pickup_point  || null,
            drop_point:    t.drop_point    || null,
            duration_text: t.duration_text || null,
          })),
        notes: notes
          .filter(n => n.message.trim())
          .map(n => ({
            message:            n.message,
            type:               n.type,
            position:           n.position,
            optional_link_text: n.optional_link_text || null,
            optional_link_url:  n.optional_link_url  || null,
          })),
      });
      if (r.success) {
        toast.success(r.message);
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(r.message);
      }
    });
  }

  // ── Steps definition ──────────────────────────────────────────────────────

  const steps: Step[] = [
    { id: "basic",      title: "Basic Info",  description: "Title, description & meals",     icon: <FileText className="h-4 w-4" /> },
    { id: "hotels",     title: "Hotels",      description: "Assign hotels per stay type",    icon: <Hotel    className="h-4 w-4" /> },
    { id: "activities", title: "Activities",  description: "Activities for this day",        icon: <Activity className="h-4 w-4" />, optional: true },
    { id: "transfers",  title: "Transfers",   description: "Cab & transfer details",         icon: <Car      className="h-4 w-4" />, optional: true },
    { id: "notes",      title: "Notes",       description: "Alert & informational notes",    icon: <Bell     className="h-4 w-4" />, optional: true },
  ];

  return (
    <MultiStepModal
      open={open}
      onOpenChange={onOpenChange}
      title={`Day ${day} — ${existing ? "Edit" : "Add"}`}
      steps={steps}
      onComplete={handleComplete}
      isSubmitting={isPending}
      submitLabel="Save Day"
    >
      {/* ── Step 1: Basic Info ─────────────────────────────────────────────── */}
      <div className="space-y-5">
        {routes.length > 1 && (
          <div className="space-y-1.5">
            <Label>Applies to Route</Label>
            <Select value={routeId} onValueChange={setRouteId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Routes (shared day)</SelectItem>
                {routes.map((r: any) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.label ?? r.name ?? `Route ${r.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              "All Routes" = this day appears regardless of which route is selected
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Title <span className="text-destructive">*</span></Label>
          <Input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Arrival in Srinagar" />
        </div>

        <div className="space-y-1.5">
          <Label>Description</Label>
          <Textarea value={description} onChange={e => setDescription(e.target.value)}
            placeholder="What happens on this day..." rows={3} />
        </div>

        <div className="space-y-1.5">
          <Label>Meals Included</Label>
          <div className="flex gap-2">
            {MEAL_OPTIONS.map(meal => (
              <button
                key={meal}
                type="button"
                onClick={() => toggleMeal(meal)}
                className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border-2 transition-all ${
                  meals.includes(meal)
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border text-muted-foreground hover:border-muted-foreground/40"
                }`}
              >
                <Utensils className="h-3 w-3" />
                {meal}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Step 2: Hotels per Stay Category ───────────────────────────────── */}
      <div className="space-y-3">
        {stayCategories.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No stay categories defined for this package. Add them in the Stay Types tab.
          </p>
        ) : (
          stayCategories.map(cat => {
            const assignment = hotelAssignments.find(a => a.stay_category_id === cat.id)!;
            const selectedHotel = hotels.find(h => h.id === assignment.hotel_id);
            return (
              <div key={cat.id} className="rounded-lg border p-3 space-y-2.5">
                <p className="text-sm font-medium">{cat.label}</p>
                <Select
                  value={assignment.hotel_id ? String(assignment.hotel_id) : "none"}
                  onValueChange={v => updateHotel(cat.id, { hotel_id: v === "none" ? null : Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select hotel (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No hotel</SelectItem>
                    {hotels.map(h => (
                      <SelectItem key={h.id} value={String(h.id)}>
                        {h.name}
                        <span className="text-muted-foreground ml-1 text-xs">
                          ({h.destination.name}{h.star_rating ? ` · ${h.star_rating}★` : ""})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedHotel && (
                  <div className="flex items-center gap-3 bg-muted/20 rounded-lg p-2">
                    {selectedHotel.images[0] && (
                      <img
                        src={`${BASE}/${selectedHotel.images[0].thumbnail ?? selectedHotel.images[0].url}`}
                        alt={selectedHotel.name}
                        className="h-10 w-14 rounded object-cover shrink-0"
                      />
                    )}
                    <div className="flex-1 text-xs text-muted-foreground">
                      {selectedHotel.star_rating ? `${selectedHotel.star_rating}★ ` : ""}
                      {selectedHotel.category} · {selectedHotel.destination.name}
                    </div>
                    <div className="shrink-0 space-y-0.5">
                      <Label className="text-xs">Nights</Label>
                      <Input
                        type="number"
                        min="1"
                        value={assignment.hotel_days ?? ""}
                        onChange={e => updateHotel(cat.id, { hotel_days: e.target.value ? Number(e.target.value) : null })}
                        className="w-20 h-7 text-sm"
                        placeholder="1"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Step 3: Activities ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <ActivitySelector
          activities={activities}
          selectedIds={selectedActivityIds}
          onChange={setSelectedActivityIds}
        />
        {selectedActivityIds.length === 0 && (
          <p className="text-xs text-muted-foreground">No activities selected. You can skip this step.</p>
        )}
      </div>

      {/* ── Step 4: Cab / Transfers ────────────────────────────────────────── */}
      <div className="space-y-3">
        {transfers.map((t, i) => (
          <div key={i} className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Transfer {i + 1}</p>
              <Button type="button" variant="ghost" size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={() => removeTransfer(i)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Cab Type</Label>
                <Input value={t.cab_type}
                  onChange={e => updateTransfer(i, { cab_type: e.target.value })}
                  placeholder="e.g. SUV, Sedan" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Duration</Label>
                <Input value={t.duration_text}
                  onChange={e => updateTransfer(i, { duration_text: e.target.value })}
                  placeholder="e.g. 3 hours" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Pickup Point</Label>
                <Input value={t.pickup_point}
                  onChange={e => updateTransfer(i, { pickup_point: e.target.value })}
                  placeholder="e.g. Airport" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Drop Point</Label>
                <Input value={t.drop_point}
                  onChange={e => updateTransfer(i, { drop_point: e.target.value })}
                  placeholder="e.g. Hotel" className="h-8 text-sm" />
              </div>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="w-full" onClick={addTransfer}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Transfer
        </Button>
        {transfers.length === 0 && (
          <p className="text-xs text-muted-foreground text-center">No transfers yet. You can skip this step.</p>
        )}
      </div>

      {/* ── Step 5: Alert Notes ────────────────────────────────────────────── */}
      <div className="space-y-3">
        {notes.map((n, i) => (
          <div key={i} className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Note {i + 1}</p>
              <Button type="button" variant="ghost" size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={() => removeNote(i)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Message <span className="text-destructive">*</span></Label>
              <Textarea value={n.message}
                onChange={e => updateNote(i, { message: e.target.value })}
                placeholder="Alert message..." rows={2} className="text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Select value={n.type} onValueChange={v => updateNote(i, { type: v })}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="danger">Danger</SelectItem>
                    <SelectItem value="tip">Tip</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Position</Label>
                <Select value={n.position} onValueChange={v => updateNote(i, { position: v })}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top">Top</SelectItem>
                    <SelectItem value="bottom">Bottom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Link Text (optional)</Label>
                <Input value={n.optional_link_text}
                  onChange={e => updateNote(i, { optional_link_text: e.target.value })}
                  placeholder="Learn more" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Link URL (optional)</Label>
                <Input value={n.optional_link_url}
                  onChange={e => updateNote(i, { optional_link_url: e.target.value })}
                  placeholder="https://..." className="h-8 text-sm" />
              </div>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="w-full" onClick={addNote}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Note
        </Button>
        {notes.length === 0 && (
          <p className="text-xs text-muted-foreground text-center">No notes yet. You can skip this step.</p>
        )}
      </div>
    </MultiStepModal>
  );
}

// ── Main ItineraryTab ─────────────────────────────────────────────────────

export function ItineraryTab({
  package_id,
  durations,
  hotels,
  activities,
  stayCategories,
}: {
  package_id:     number;
  durations:      Duration[];
  hotels:         HotelOption[];
  activities:     ActivityOption[];
  stayCategories: StayCategory[];
}) {
  const router = useRouter();
  const defaultDuration = durations.find(d => d.is_default) ?? durations[0];

  const [selectedDurationId, setSelectedDurationId] = useState(
    defaultDuration?.id?.toString() ?? ""
  );
  const [addingDay,     setAddingDay]     = useState<number | null>(null);
  const [loadingEditId, setLoadingEditId] = useState<number | null>(null);
  const [editingData,   setEditingData]   = useState<{
    entry: ItineraryDay;
    full:  FullDayData;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const duration  = durations.find(d => d.id === Number(selectedDurationId));
  const routes    = duration ? (duration.routes || []) as any : [];
  const days      = duration?.itineraries ?? [];
  const totalDays = duration?.days ?? 0;
  const dayNumbers = Array.from({ length: totalDays }, (_, i) => i + 1);

  async function handleEdit(entry: ItineraryDay) {
    setLoadingEditId(entry.id);
    try {
      const full = await getItineraryDayDetails(entry.id);
      if (full) {
        setEditingData({ entry, full });
      } else {
        toast.error("Day not found — please refresh");
      }
    } catch {
      toast.error("Failed to load day details");
    } finally {
      setLoadingEditId(null);
    }
  }

  function handleDelete(day: number) {
    if (!duration) return;
    startTransition(async () => {
      const r = await clearItineraryDay(package_id, duration.id, day);
      if (r.success) {
        toast.success(r.message);
        router.refresh();
      } else {
        toast.error(r.message);
      }
    });
  }

  if (durations.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed rounded-xl">
        <CalendarDays className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Add durations first, then build the itinerary</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Duration selector */}
      <div className="flex items-center gap-3">
        <p className="text-sm font-medium shrink-0">Duration:</p>
        <Select value={selectedDurationId} onValueChange={setSelectedDurationId}>
          <SelectTrigger className="w-60">
            <SelectValue placeholder="Select duration" />
          </SelectTrigger>
          <SelectContent>
            {durations.map(d => (
              <SelectItem key={d.id} value={String(d.id)}>
                {d.label}
                {d.is_default && <span className="text-muted-foreground ml-1 text-xs">(Default)</span>}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {duration && (
          <span className="text-xs text-muted-foreground">
            {days.length}/{totalDays} days planned
          </span>
        )}
      </div>

      {/* Route info banner */}
      {routes.length > 1 && (
        <div className="rounded-lg bg-muted/30 border px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Routes in this duration:</p>
          <div className="flex flex-wrap gap-2">
            {routes.map((r: any) => (
              <Badge key={r.id} variant={r.is_default ? "default" : "outline"} className="text-xs">
                {r.label ?? r.name ?? `Route ${r.id}`}
              </Badge>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            Days can be shared across all routes or scoped to a specific route
          </p>
        </div>
      )}

      {/* Day cards */}
      {duration && (
        <div className="space-y-3">
          {dayNumbers.map(dayNum => {
            const dayEntries = days.filter(d => d.day === dayNum);

            return (
              <div key={dayNum} className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-medium text-primary">{dayNum}</span>
                  </div>
                  <p className="text-sm font-medium">Day {dayNum}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs ml-auto border-dashed border"
                    onClick={() => setAddingDay(dayNum)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Entry
                  </Button>
                </div>

                {dayEntries.length === 0 ? (
                  <div className="ml-9 border-2 border-dashed rounded-xl py-4 text-center">
                    <p className="text-xs text-muted-foreground">No itinerary for this day yet</p>
                  </div>
                ) : (
                  <div className="ml-9 space-y-2">
                    {dayEntries.map(entry => {
                      const actIds   = (entry.activity_ids as number[] | null) ?? [];
                      const mealList = (entry.meals as string[] | null)         ?? [];
                      const routeLabel = entry.route_id != null
                        ? (routes.find((r: any) => r.id === entry.route_id)?.label ?? `Route ${entry.route_id}`)
                        : entry.route_index != null
                          ? (routes.find((r: any) => r.id === entry.route_index)?.label ?? `Route ${entry.route_index + 1}`)
                          : "All routes";

                      return (
                        <Card key={entry.id} className="border-l-4 border-l-primary/40">
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-1">
                                <CardTitle className="text-sm">{entry.title}</CardTitle>
                                {routes.length > 1 && (
                                  <Badge variant="outline" className="text-[10px]">{routeLabel}</Badge>
                                )}
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  disabled={loadingEditId !== null}
                                  onClick={() => handleEdit(entry)}
                                >
                                  {loadingEditId === entry.id
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <Pencil className="h-3.5 w-3.5" />
                                  }
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon"
                                      className="h-7 w-7 text-destructive hover:text-destructive">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Day Entry</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Delete <strong>{entry.title}</strong>?
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDelete(entry.day)}
                                        className="bg-destructive text-white hover:bg-destructive/90">
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0 space-y-1.5">
                            {entry.description && (
                              <p className="text-xs text-muted-foreground">{entry.description}</p>
                            )}
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                              {entry.hotel && (
                                <span className="flex items-center gap-1">
                                  <Hotel className="h-3 w-3" />
                                  {entry.hotel.name}
                                  {entry.hotel_days != null && ` · ${entry.hotel_days}N`}
                                </span>
                              )}
                              {actIds.length > 0 && (
                                <span className="flex items-center gap-1">
                                  <Activity className="h-3 w-3" />
                                  {actIds.length} activit{actIds.length !== 1 ? "ies" : "y"}
                                </span>
                              )}
                              {mealList.length > 0 && (
                                <span className="flex items-center gap-1">
                                  <Utensils className="h-3 w-3" />
                                  {mealList.join(", ")}
                                </span>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Dialog */}
      {addingDay !== null && duration && (
        <MultiStepDayDialog
          open={true}
          onOpenChange={open => !open && setAddingDay(null)}
          package_id={package_id}
          duration_id={duration.id}
          day={addingDay}
          routes={routes}
          hotels={hotels}
          activities={activities}
          stayCategories={stayCategories}
        />
      )}

      {/* Edit Dialog */}
      {editingData !== null && duration && (
        <MultiStepDayDialog
          open={true}
          onOpenChange={open => !open && setEditingData(null)}
          package_id={package_id}
          duration_id={duration.id}
          day={editingData.entry.day}
          routes={routes}
          hotels={hotels}
          activities={activities}
          stayCategories={stayCategories}
          existing={editingData.entry}
          existingFullData={editingData.full}
        />
      )}
    </div>
  );
}
