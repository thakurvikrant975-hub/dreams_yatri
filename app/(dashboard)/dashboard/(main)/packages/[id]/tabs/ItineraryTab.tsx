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
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from "../../../components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "../../../components/ui/alert-dialog";
import {
  CalendarDays, Plus, Pencil, Trash2, Loader2,
  Hotel, Activity, Utensils, X, Search,
} from "lucide-react";
import { toast } from "sonner";
import { upsertItineraryDay, clearItineraryDay } from "../../actions";
import type { RouteOption } from "../../actions";

// ── Constants ─────────────────────────────────────────────────────────────

const MEAL_OPTIONS = ["Breakfast", "Lunch", "Dinner"];
const BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!;

// ── Types ─────────────────────────────────────────────────────────────────

type Hotel = {
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
  duration_hours: unknown; // Prisma Decimal — not displayed
  destination:    { name: string };
};

type ItinHotel = {
  hotel_id:    number;
  stay_map_id: number;
  nights:      number;
  hotel: {
    id:          number;
    name:        string;
    star_rating: number | null;
    category:    string | null;
  };
  stay_map: {
    stay_type: { id: number; name: string };
  };
};

type ItineraryDay = {
  id:           number;
  day:          number;
  title:        string;
  description:  string | null;
  activity_ids: unknown;
  meals:        unknown;
  route_index:  number | null;
  itin_hotels:  ItinHotel[];
};

type Duration = {
  id:          number;
  label:       string;
  days:        number;
  nights:      number;
  routes:      unknown;
  is_default:  boolean;  // ← properly typed
  itineraries: ItineraryDay[];
};

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

// ── Day Dialog ────────────────────────────────────────────────────────────

function DayDialog({
  open,
  onOpenChange,
  package_id,
  duration_id,
  day,
  routes,
  hotels,
  activities,
  existing,
}: {
  open:         boolean;
  onOpenChange: (b: boolean) => void;
  package_id:   number;
  duration_id:  number;
  day:          number;
  routes:       RouteOption[];
  hotels:       Hotel[];
  activities:   ActivityOption[];
  existing?:    ItineraryDay;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title,       setTitle]      = useState(existing?.title       ?? `Day ${day}`);
  const [description, setDesc]       = useState(existing?.description ?? "");
  const [meals,       setMeals]      = useState<string[]>(
    (existing?.meals as string[] | null) ?? []
  );
  const [activityIds, setActivityIds] = useState<number[]>(
    (existing?.activity_ids as number[] | null) ?? []
  );
  const [routeIndex,  setRouteIndex] = useState<string>(
    existing?.route_index != null ? String(existing.route_index) : "all"
  );

  function toggleMeal(meal: string) {
    setMeals(prev => prev.includes(meal) ? prev.filter(m => m !== meal) : [...prev, meal]);
  }

  async function handleSave() {
    if (!title.trim()) { toast.error("Title is required"); return; }
    startTransition(async () => {
      const r = await upsertItineraryDay(package_id, duration_id, day, {
        title,
        description,
        activity_ids: activityIds,
        meals,
        route_index:  routeIndex === "all" ? null : Number(routeIndex),
      });
      if (r.success) {
        toast.success(r.message);
        onOpenChange(false);
        router.refresh(); // ← refresh so new/updated day appears in card list
      } else {
        toast.error(r.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Day {day} — {existing ? "Edit" : "Add"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <Label>Title <span className="text-destructive">*</span></Label>
            <Input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Arrival in Srinagar" />
          </div>

          {/* Route filter (only show when multiple routes) */}
          {routes.length > 1 && (
            <div className="space-y-1.5">
              <Label>Applies to Route</Label>
              <Select value={routeIndex} onValueChange={setRouteIndex}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Routes (shared day)</SelectItem>
                  {routes.map(r => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      Route {r.id + 1}: {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                "All Routes" = this day appears regardless of which route is selected
              </p>
            </div>
          )}

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDesc(e.target.value)}
              placeholder="What happens on this day..." rows={3} />
          </div>

          {/* Meals */}
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

          {/* Hotel assignments are managed per stay-type via the hotel assignment panel */}

          {/* Activities */}
          <div className="space-y-1.5">
            <Label>Activities for this Day</Label>
            <ActivitySelector
              activities={activities}
              selectedIds={activityIds}
              onChange={setActivityIds}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Save Day"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main ItineraryTab ─────────────────────────────────────────────────────

type AssignedStayType = {
  id:           number;
  stay_type_id: number;
  name:         string;
  is_default:   boolean;
};

export function ItineraryTab({
  package_id,
  durations,
  hotels,
  activities,
  assignedStayTypes,
}: {
  package_id:        number;
  durations:         Duration[];
  hotels:            Hotel[];
  activities:        ActivityOption[];
  assignedStayTypes: AssignedStayType[];
}) {
  const router = useRouter();
  const defaultDuration = durations.find(d => d.is_default) ?? durations[0];

  const [selectedDurationId, setSelectedDurationId] = useState(
    defaultDuration?.id?.toString() ?? ""
  );
  const [addingDay,   setAddingDay]   = useState<number | null>(null);
  const [editingDay,  setEditingDay]  = useState<ItineraryDay | null>(null);
  const [isPending,   startTransition] = useTransition();

  const duration  = durations.find(d => d.id === Number(selectedDurationId));
  const routes    = duration ? (duration.routes as RouteOption[]) : [];
  const days      = duration?.itineraries ?? [];
  const totalDays = duration?.days ?? 0;
  const dayNumbers = Array.from({ length: totalDays }, (_, i) => i + 1);

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
            {routes.map(r => (
              <Badge key={r.id} variant={r.is_default ? "default" : "outline"} className="text-xs">
                Route {r.id + 1}: {r.label}
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
                {/* Day header */}
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
                      const routeLabel = entry.route_index != null
                        ? (routes.find(r => r.id === entry.route_index)?.label ?? `Route ${(entry.route_index ?? 0) + 1}`)
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
                                <Button variant="ghost" size="icon" className="h-7 w-7"
                                  onClick={() => setEditingDay(entry)}>
                                  <Pencil className="h-3.5 w-3.5" />
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
                              {entry.itin_hotels.length > 0 && (
                                <span className="flex items-center gap-1">
                                  <Hotel className="h-3 w-3" />
                                  {entry.itin_hotels.length} hotel{entry.itin_hotels.length !== 1 ? "s" : ""} assigned
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

      {/* Dialogs */}
      {addingDay !== null && duration && (
        <DayDialog
          open={true}
          onOpenChange={open => !open && setAddingDay(null)}
          package_id={package_id}
          duration_id={duration.id}
          day={addingDay}
          routes={routes}
          hotels={hotels}
          activities={activities}
        />
      )}

      {editingDay && duration && (
        <DayDialog
          open={true}
          onOpenChange={open => !open && setEditingDay(null)}
          package_id={package_id}
          duration_id={duration.id}
          day={editingDay.day}
          routes={routes}
          hotels={hotels}
          activities={activities}
          existing={editingDay}
        />
      )}
    </div>
  );
}