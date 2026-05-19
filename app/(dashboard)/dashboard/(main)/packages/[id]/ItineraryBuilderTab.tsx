"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { StayTiersSection } from "./StayTiersSection";
import { ItineraryDaySidebar } from "./ItineraryDaySidebar";
import { handleGetItineraryData } from "@/app/actions/packages/itinerary-builder.actions";
import type { DayData, StayCategoryFull } from "@/app/services/itinerary-builder.service";
import {
  CalendarDays,
  Loader2,
  Route,
  Bed,
  Car,
  Activity,
  StickyNote,
  ChevronRight,
  Camera,
} from "lucide-react";
import { cn } from "@/app/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

type RouteStop = { place_name: string; stay_days: number };
type RouteRow = { id: number; name: string; stops?: RouteStop[] };

type Duration = {
  id: number;
  label: string;
  days: number;
  nights: number;
  is_default: boolean;
  routes: RouteRow[];
};

type Props = {
  packageId: number;
  destinationId: number;
  durations: Duration[];
  stayCategories: StayCategoryFull[];
};

// ── Occupied-by type ───────────────────────────────────────────────────────

export type OccupiedBy = {
  fromDay: number;
  numNights: number;
  hotelName: string;
  nightIndex: number; // 1-based: which night of that stay is this day
};

// ── Stop label helper ──────────────────────────────────────────────────────

function getStopLabel(dayNumber: number, stops: RouteStop[]): string {
  const ordinals = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];
  let cursor = 0;
  for (const stop of stops) {
    const nights = stop.stay_days ?? 0;
    const isLast = stops[stops.length - 1] === stop;
    // Each stop owns `nights` days; the last stop gets +1 for the departure day
    const daysForStop = nights + (isLast ? 1 : 0);
    for (let i = 0; i < daysForStop; i++) {
      cursor++;
      if (cursor === dayNumber) {
        const dayInStop = i + 1;
        const prefix = isLast && dayInStop === daysForStop ? "Last Day" : (ordinals[i] ?? `Day ${dayInStop}`);
        return `${prefix} in ${stop.place_name}`;
      }
    }
  }
  return "";
}

// ── Day Card ───────────────────────────────────────────────────────────────

function DayCard({ day, occupiedBy, onClick }: { day: DayData; occupiedBy?: OccupiedBy; onClick: () => void }) {
  const hasAny =
    day.id !== null &&
    day.activities.length + day.transfers.length + day.notes.length + day.stays.length + day.attractions.length > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-left p-3 rounded-xl border transition-all hover:border-primary/50 hover:shadow-sm group",
        occupiedBy ? "bg-violet-50/60 border-violet-200" : day.id ? "bg-background" : "bg-muted/20 border-dashed",
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-primary">Day {day.day}</span>
        <ChevronRight className="h-3 w-3 text-muted-foreground/40 group-hover:text-primary transition-colors" />
      </div>

      <p className="text-xs font-medium line-clamp-2 mb-2">{day.title}</p>

      {occupiedBy ? (
        <div className="flex items-center gap-1 mt-1">
          <Bed className="h-2.5 w-2.5 text-violet-500 shrink-0" />
          <span className="text-[10px] text-violet-600 font-medium truncate">
            Night {occupiedBy.nightIndex} of {occupiedBy.numNights} · from Day {occupiedBy.fromDay}
          </span>
        </div>
      ) : hasAny ? (
        <div className="flex flex-wrap gap-1.5">
          {day.transfers.length > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Car className="h-2.5 w-2.5" />{day.transfers.length}
            </span>
          )}
          {day.activities.length > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Activity className="h-2.5 w-2.5" />{day.activities.length}
            </span>
          )}
          {day.stays.length > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Bed className="h-2.5 w-2.5" />
              {day.stays[0]?.num_nights > 1 ? `${day.stays[0].num_nights} nights` : day.stays.length}
            </span>
          )}
          {day.notes.length > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <StickyNote className="h-2.5 w-2.5" />{day.notes.length}
            </span>
          )}
          {day.attractions.length > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Camera className="h-2.5 w-2.5" />{day.attractions.length}
            </span>
          )}
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground/50 italic">No items yet</p>
      )}
    </button>
  );
}

// ── Main Tab ───────────────────────────────────────────────────────────────

export function ItineraryBuilderTab({ packageId, destinationId, durations, stayCategories: initialStayCategories }: Props) {
  const defaultDuration = durations.find((d) => d.is_default) ?? durations[0] ?? null;
  const [selectedDurationId, setSelectedDurationId] = useState<number | null>(defaultDuration?.id ?? null);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(
    defaultDuration?.routes[0]?.id ?? null,
  );
  const [stayCategories, setStayCategories] = useState<StayCategoryFull[]>(initialStayCategories);
  const [days, setDays] = useState<DayData[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openDay, setOpenDay] = useState<DayData | null>(null);

  const selectedDuration = durations.find((d) => d.id === selectedDurationId) ?? null;

  const loadDays = useCallback(
    async (durationId: number, routeId: number) => {
      setLoading(true);
      const res = await handleGetItineraryData(packageId, durationId, routeId);
      setLoading(false);
      if (res.success) {
        setDays(res.data as DayData[]);
      } else {
        toast.error(res.message ?? "Failed to load itinerary");
      }
    },
    [packageId],
  );

  useEffect(() => {
    if (selectedDurationId && selectedRouteId) {
      loadDays(selectedDurationId, selectedRouteId);
    } else {
      setDays(null);
    }
  }, [selectedDurationId, selectedRouteId, loadDays]);

  function selectDuration(durationId: number) {
    const dur = durations.find((d) => d.id === durationId);
    setSelectedDurationId(durationId);
    setSelectedRouteId(dur?.routes[0]?.id ?? null);
    setDays(null);
    setSidebarOpen(false);
  }

  function selectRoute(routeId: number) {
    setSelectedRouteId(routeId);
    setDays(null);
    setSidebarOpen(false);
  }

  function handleDaySaved(updatedDay: DayData) {
    setDays((prev) => (prev ? prev.map((d) => (d.day === updatedDay.day ? updatedDay : d)) : prev));
  }

  // Build a map of days that are "covered" by a multi-night stay from a prior day
  const occupiedDays = useMemo((): Map<number, OccupiedBy> => {
    const map = new Map<number, OccupiedBy>();
    if (!days) return map;
    for (const day of days) {
      for (const stay of day.stays) {
        const nights = stay.num_nights ?? 1;
        for (let i = 1; i < nights; i++) {
          const coveredDay = day.day + i;
          if (!map.has(coveredDay)) {
            map.set(coveredDay, {
              fromDay: day.day,
              numNights: nights,
              hotelName: stay.room_pricing.hotel.name,
              nightIndex: i + 1,
            });
          }
        }
      }
    }
    return map;
  }, [days]);

  if (durations.length === 0) {
    return (
      <div className="space-y-5">
        <StayTiersSection
          packageId={packageId}
          initialCategories={stayCategories}
          onCategoriesChange={setStayCategories}
        />
        <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-dashed bg-muted/30">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
            <CalendarDays className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">No durations yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Create route variants first in the Route Builder tab
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Stay Tiers setup section */}
      <StayTiersSection
        packageId={packageId}
        initialCategories={stayCategories}
        onCategoriesChange={setStayCategories}
      />

      {/* Duration chips */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Duration</p>
        <div className="flex flex-wrap gap-2">
          {durations.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => selectDuration(d.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
                selectedDurationId === d.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-muted",
              )}
            >
              <CalendarDays className="h-3 w-3" />
              {d.label}
              {d.is_default && (
                <Badge className="h-3.5 text-[9px] px-1 py-0 ml-0.5">Default</Badge>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Route variant chips */}
      {selectedDuration && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Route Variant</p>
          {selectedDuration.routes.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 italic">
              No routes for this duration yet
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {selectedDuration.routes.map((r, idx) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => selectRoute(r.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
                    selectedRouteId === r.id
                      ? "bg-primary/10 text-primary border-primary/40"
                      : "border-border hover:bg-muted",
                  )}
                >
                  <Route className="h-3 w-3" />
                  {r.name}
                  {idx === 0 && (
                    <Badge className="h-3.5 text-[9px] px-1 py-0 ml-0.5">Default</Badge>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Day grid */}
      {selectedRouteId && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-muted-foreground">
              {selectedDuration ? `${selectedDuration.days} days` : "Days"}
            </p>
            {days && (
              <p className="text-[10px] text-muted-foreground/60">
                Click a day to edit its itinerary
              </p>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : days ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {days.map((day) => (
                <DayCard
                  key={day.day}
                  day={day}
                  occupiedBy={occupiedDays.get(day.day)}
                  onClick={() => {
                    setOpenDay(day);
                    setSidebarOpen(true);
                  }}
                />
              ))}
            </div>
          ) : null}
        </div>
      )}

      {/* Day sidebar */}
      {openDay && selectedDurationId && selectedRouteId && (() => {
        const selectedRoute = selectedDuration?.routes.find((r) => r.id === selectedRouteId);
        const stopLabel = selectedRoute?.stops
          ? getStopLabel(openDay.day, selectedRoute.stops)
          : undefined;
        const totalDays = selectedDuration?.days ?? 99;
        return (
          <ItineraryDaySidebar
            key={`${selectedDurationId}-${selectedRouteId}-${openDay.day}`}
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            packageId={packageId}
            destinationId={destinationId}
            durationId={selectedDurationId}
            routeId={selectedRouteId}
            day={openDay}
            stayCategories={stayCategories}
            onSaved={handleDaySaved}
            stopLabel={stopLabel}
            occupiedBy={occupiedDays.get(openDay.day)}
            totalDays={totalDays}
          />
        );
      })()}
    </div>
  );
}
