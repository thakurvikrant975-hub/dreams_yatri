"use client";

import { useState, useEffect, useTransition } from "react";
import {
  MultiStepModal,
  useMultiStep,
  type Step,
} from "../../components/dashboard/MultiStepModel";
import { SearchSelect } from "../../components/dashboard/SearchSelect";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Badge } from "../../components/ui/badge";
import {
  createItinerary,
  deleteItinerary,
  getItinerariesForRoute,
  searchHotels,
  searchActivities,
} from "../actions";
import { Plus, Trash2, Loader2, Hotel, Activity, Car, StickyNote } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────

type Duration = { id: number; label: string };
type Route = { id: number; duration_id: number; name: string };
type Itinerary = {
  id: number;
  day: number;
  title: string;
  description: string | null;
  meals: unknown;
  itinerary_hotels: { id: number; hotel_id: number; stay_category_id: number }[];
  itinerary_activities: { id: number; activity_id: number }[];
  itinerary_transfers: { id: number; pickup_point: string; drop_point: string; cab_type: string; duration_text: string }[];
  itinerary_notes: { id: number; type: string; message: string }[];
};
type StayCategory = { id: number; name: string };

type Props = {
  packageId: number;
  durations: Duration[];
  allRoutes: Route[];
  stayCategories: StayCategory[];
};

// ── Step: Basic Info ──────────────────────────────────────────────────────

function BasicStep({ existingDays }: { existingDays: number[] }) {
  const { setStepData, stepData } = useMultiStep();
  const b = (stepData["basic"] ?? {}) as Record<string, unknown>;
  const [day, setDay] = useState((b.day as number) ?? 1);
  const [title, setTitle] = useState((b.title as string) ?? "");
  const [desc, setDesc] = useState((b.description as string) ?? "");
  const [breakfast, setBreakfast] = useState((b.breakfast as boolean) ?? false);
  const [lunch, setLunch] = useState((b.lunch as boolean) ?? false);
  const [dinner, setDinner] = useState((b.dinner as boolean) ?? false);

  useEffect(() => {
    setStepData("basic", {
      day, title, description: desc || undefined,
      meals: { breakfast, lunch, dinner },
    });
  }, [day, title, desc, breakfast, lunch, dinner]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Day *</Label>
          <Input type="number" min={1} value={day} onChange={(e) => setDay(Number(e.target.value))} />
          {existingDays.includes(day) && (
            <p className="text-xs text-amber-600">Day {day} already exists for this route.</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>Title *</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Arrive in Manali" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="Day details..." />
      </div>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Meals Included</Label>
        <div className="flex gap-4">
          {([["breakfast", breakfast, setBreakfast], ["lunch", lunch, setLunch], ["dinner", dinner, setDinner]] as const).map(
            ([label, val, setter]) => (
              <label key={label} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={val} onChange={(e) => setter(e.target.checked)} className="rounded" />
                <span className="capitalize">{label}</span>
              </label>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ── Step: Hotels ──────────────────────────────────────────────────────────

function HotelsStep({ stayCategories }: { stayCategories: StayCategory[] }) {
  const { setStepData, stepData } = useMultiStep();
  type HotelEntry = { hotel_id: number; stay_category_id: number; label: string };
  const [entries, setEntries] = useState<HotelEntry[]>((stepData["hotels"]?.hotels as HotelEntry[]) ?? []);
  const [hotelId, setHotelId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(stayCategories[0]?.id ?? null);
  const [hotelLabel, setHotelLabel] = useState("");

  function addEntry() {
    if (!hotelId || !categoryId) return;
    const entry = { hotel_id: hotelId, stay_category_id: categoryId, label: hotelLabel };
    const updated = [...entries, entry];
    setEntries(updated);
    setStepData("hotels", { hotels: updated });
    setHotelId(null);
    setHotelLabel("");
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Hotel</Label>
          <SearchSelect
            value={hotelId}
            onChange={(val, opt) => { setHotelId(val); setHotelLabel(opt?.label ?? ""); }}
            fetchOptions={searchHotels}
            placeholder="Search hotel..."
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Category</Label>
          <select
            value={categoryId ?? ""}
            onChange={(e) => setCategoryId(Number(e.target.value))}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            {stayCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <Button type="button" size="sm" onClick={addEntry} className="h-9">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {entries.map((e, i) => (
        <div key={i} className="flex items-center gap-2 bg-muted/40 rounded-md px-3 py-2 text-sm">
          <Hotel className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="flex-1">{e.label || `Hotel #${e.hotel_id}`}</span>
          <Badge variant="outline" className="text-xs">{stayCategories.find((c) => c.id === e.stay_category_id)?.name}</Badge>
          <button type="button" onClick={() => { const u = entries.filter((_, j) => j !== i); setEntries(u); setStepData("hotels", { hotels: u }); }}>
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      ))}
      {entries.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No hotels added. This step is optional.</p>}
    </div>
  );
}

// ── Step: Activities ──────────────────────────────────────────────────────

function ActivitiesStep() {
  const { setStepData, stepData } = useMultiStep();
  type ActivityEntry = { activity_id: number; label: string };
  const [entries, setEntries] = useState<ActivityEntry[]>((stepData["activities"]?.activities as ActivityEntry[]) ?? []);
  const [actId, setActId] = useState<number | null>(null);
  const [actLabel, setActLabel] = useState("");

  function addEntry() {
    if (!actId) return;
    const updated = [...entries, { activity_id: actId, label: actLabel }];
    setEntries(updated);
    setStepData("activities", { activities: updated });
    setActId(null);
    setActLabel("");
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-end">
        <div className="flex-1 space-y-1">
          <Label className="text-xs">Activity</Label>
          <SearchSelect
            value={actId}
            onChange={(val, opt) => { setActId(val); setActLabel(opt?.label ?? ""); }}
            fetchOptions={searchActivities}
            placeholder="Search activity..."
          />
        </div>
        <Button type="button" size="sm" onClick={addEntry} className="h-9">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {entries.map((e, i) => (
        <div key={i} className="flex items-center gap-2 bg-muted/40 rounded-md px-3 py-2 text-sm">
          <Activity className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="flex-1">{e.label || `Activity #${e.activity_id}`}</span>
          <button type="button" onClick={() => { const u = entries.filter((_, j) => j !== i); setEntries(u); setStepData("activities", { activities: u }); }}>
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      ))}
      {entries.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No activities. This step is optional.</p>}
    </div>
  );
}

// ── Step: Transfers ───────────────────────────────────────────────────────

function TransfersStep() {
  const { setStepData, stepData } = useMultiStep();
  type TransferEntry = { pickup_point: string; drop_point: string; cab_type: string; duration_text: string };
  const [entries, setEntries] = useState<TransferEntry[]>((stepData["transfers"]?.transfers as TransferEntry[]) ?? []);
  const [pickup, setPickup] = useState("");
  const [drop, setDrop] = useState("");
  const [cabType, setCabType] = useState("");
  const [durationText, setDurationText] = useState("");

  function addEntry() {
    if (!pickup || !drop) return;
    const updated = [...entries, { pickup_point: pickup, drop_point: drop, cab_type: cabType, duration_text: durationText }];
    setEntries(updated);
    setStepData("transfers", { transfers: updated });
    setPickup(""); setDrop(""); setCabType(""); setDurationText("");
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {([["Pickup", pickup, setPickup], ["Drop", drop, setDrop], ["Cab Type", cabType, setCabType], ["Duration", durationText, setDurationText]] as const).map(
          ([label, val, setter]) => (
            <div key={label} className="space-y-1">
              <Label className="text-xs">{label}</Label>
              <Input value={val} onChange={(e) => setter(e.target.value)} className="h-8 text-sm" placeholder={label} />
            </div>
          )
        )}
      </div>
      <Button type="button" size="sm" variant="outline" onClick={addEntry} className="w-full">
        <Plus className="h-3.5 w-3.5 mr-2" /> Add Transfer
      </Button>
      {entries.map((e, i) => (
        <div key={i} className="flex items-center gap-2 bg-muted/40 rounded-md px-3 py-2 text-sm">
          <Car className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="flex-1">{e.pickup_point} → {e.drop_point}</span>
          <span className="text-xs text-muted-foreground">{e.cab_type}</span>
          <button type="button" onClick={() => { const u = entries.filter((_, j) => j !== i); setEntries(u); setStepData("transfers", { transfers: u }); }}>
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Step: Notes ───────────────────────────────────────────────────────────

function NotesStep() {
  const { setStepData, stepData } = useMultiStep();
  type NoteEntry = { type?: string; message: string };
  const [entries, setEntries] = useState<NoteEntry[]>((stepData["notes"]?.notes as NoteEntry[]) ?? []);
  const [type, setType] = useState("info");
  const [message, setMessage] = useState("");

  function addEntry() {
    if (!message.trim()) return;
    const updated = [...entries, { type, message: message.trim() }];
    setEntries(updated);
    setStepData("notes", { notes: updated });
    setMessage("");
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[auto_1fr_auto] gap-2 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Type</Label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 py-1 text-sm">
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="tip">Tip</option>
            <option value="important">Important</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Note</Label>
          <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Note text..." className="h-8 text-sm" />
        </div>
        <Button type="button" size="sm" onClick={addEntry} className="h-8">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {entries.map((e, i) => (
        <div key={i} className="flex items-center gap-2 bg-muted/40 rounded-md px-3 py-2 text-sm">
          <StickyNote className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Badge variant="outline" className="text-xs shrink-0">{e.type}</Badge>
          <span className="flex-1">{e.message}</span>
          <button type="button" onClick={() => { const u = entries.filter((_, j) => j !== i); setEntries(u); setStepData("notes", { notes: u }); }}>
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

const STEPS: Step[] = [
  { id: "basic", title: "Basic", description: "Day info & meals", validate: (d) => (!d.title ? "Title is required" : !d.day ? "Day is required" : null) },
  { id: "hotels", title: "Hotels", description: "Hotel assignments", optional: true },
  { id: "activities", title: "Activities", description: "Activities for the day", optional: true },
  { id: "transfers", title: "Transfers", description: "Transport details", optional: true },
  { id: "notes", title: "Notes", description: "Additional notes", optional: true },
];

export function ItineraryBuilder({ packageId, durations, allRoutes, stayCategories }: Props) {
  const [selectedDurationId, setSelectedDurationId] = useState<number | null>(durations[0]?.id ?? null);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [loadingItineraries, setLoadingItineraries] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();

  const filteredRoutes = allRoutes.filter((r) => r.duration_id === selectedDurationId);

  useEffect(() => {
    if (!selectedRouteId) {
      setItineraries([]);
      return;
    }
    setLoadingItineraries(true);
    getItinerariesForRoute(selectedRouteId).then((rows) => {
      setItineraries(rows as Itinerary[]);
      setLoadingItineraries(false);
    });
  }, [selectedRouteId]);

  async function handleCreate(data: Record<string, unknown>) {
    if (!selectedDurationId || !selectedRouteId) return;
    setSubmitting(true);
    try {
      const it = await createItinerary({
        package_id: packageId,
        duration_id: selectedDurationId,
        route_id: selectedRouteId,
        day: data.day as number,
        title: data.title as string,
        description: data.description as string | undefined,
        meals: data.meals,
        hotels: (data.hotels as { hotel_id: number; stay_category_id: number }[]) ?? [],
        activities: (data.activities as { activity_id: number }[]) ?? [],
        transfers: (data.transfers as { pickup_point: string; drop_point: string; cab_type: string; duration_text: string }[]) ?? [],
        notes: (data.notes as { type?: string; message: string }[]) ?? [],
      });
      setItineraries((prev) => [...prev, { ...it, itinerary_hotels: [], itinerary_activities: [], itinerary_transfers: [], itinerary_notes: [] }].sort((a, b) => a.day - b.day));
      setAddOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  function handleDelete(id: number) {
    startTransition(async () => {
      await deleteItinerary(id, packageId);
      setItineraries((prev) => prev.filter((it) => it.id !== id));
    });
  }

  const existingDays = itineraries.map((it) => it.day);

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Duration</label>
          <select
            value={selectedDurationId ?? ""}
            onChange={(e) => { setSelectedDurationId(Number(e.target.value)); setSelectedRouteId(null); }}
            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            <option value="">Select duration...</option>
            {durations.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Route</label>
          <select
            value={selectedRouteId ?? ""}
            onChange={(e) => setSelectedRouteId(Number(e.target.value))}
            disabled={!selectedDurationId}
            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm disabled:opacity-50"
          >
            <option value="">Select route...</option>
            {filteredRoutes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
      </div>

      {/* Itineraries list */}
      {selectedRouteId && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{itineraries.length} days configured</p>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-2" />
              Add Day
            </Button>
          </div>

          {loadingItineraries && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          <div className="space-y-2">
            {itineraries.map((it) => (
              <div key={it.id} className="border rounded-lg px-4 py-3">
                <div className="flex items-start gap-3">
                  <span className="w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center shrink-0">
                    {it.day}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{it.title}</p>
                    {it.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{it.description}</p>}
                    <div className="flex gap-2 mt-1.5 flex-wrap">
                      {it.itinerary_hotels.length > 0 && <Badge variant="outline" className="text-xs"><Hotel className="h-2.5 w-2.5 mr-1" />{it.itinerary_hotels.length} hotels</Badge>}
                      {it.itinerary_activities.length > 0 && <Badge variant="outline" className="text-xs"><Activity className="h-2.5 w-2.5 mr-1" />{it.itinerary_activities.length} activities</Badge>}
                      {it.itinerary_transfers.length > 0 && <Badge variant="outline" className="text-xs"><Car className="h-2.5 w-2.5 mr-1" />{it.itinerary_transfers.length} transfers</Badge>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(it.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!selectedRouteId && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Select a duration and route to manage itinerary.
        </p>
      )}

      <MultiStepModal
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add Itinerary Day"
        description="Configure day details, hotels, activities, transfers and notes"
        steps={STEPS}
        onComplete={handleCreate}
        isSubmitting={submitting}
        submitLabel="Create Day"
      >
        <BasicStep existingDays={existingDays} />
        <HotelsStep stayCategories={stayCategories} />
        <ActivitiesStep />
        <TransfersStep />
        <NotesStep />
      </MultiStepModal>
    </div>
  );
}
