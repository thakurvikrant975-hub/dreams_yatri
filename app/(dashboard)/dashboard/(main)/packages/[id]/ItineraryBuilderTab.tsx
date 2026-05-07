"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { ItineraryDaySidebar } from "./ItineraryDaySidebar";
import { handleGetItineraryData } from "@/app/actions/packages/itinerary-builder.actions";
import type { DayData } from "@/app/services/itinerary-builder.service";
import {
  CalendarDays,
  Loader2,
  Route,
  Bed,
  Car,
  Activity,
  StickyNote,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/app/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

type RouteRow = { id: number; name: string };

type Duration = {
  id: number;
  label: string;
  days: number;
  nights: number;
  is_default: boolean;
  routes: RouteRow[];
};

type StayCategory = {
  id: number;
  label: string;
  slug: string;
  min_duration_days: number | null;
  sort_order: number;
};

type Props = {
  packageId: number;
  destinationId: number;
  durations: Duration[];
  stayCategories: StayCategory[];
};

// ── Day Card ───────────────────────────────────────────────────────────────

function DayCard({ day, onClick }: { day: DayData; onClick: () => void }) {
  const hasAny =
    day.id !== null &&
    (day.activities.length + day.transfers.length + day.notes.length + day.stays.length > 0);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-left p-3 rounded-xl border transition-all hover:border-primary/50 hover:shadow-sm group",
        day.id ? "bg-background" : "bg-muted/20 border-dashed",
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-primary">
          Day {day.day}
        </span>
        <ChevronRight className="h-3 w-3 text-muted-foreground/40 group-hover:text-primary transition-colors" />
      </div>

      <p className="text-xs font-medium line-clamp-2 mb-2 text-foreground">
        {day.title}
      </p>

      {hasAny ? (
        <div className="flex flex-wrap gap-1">
          {day.transfers.length > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Car className="h-2.5 w-2.5" />
              {day.transfers.length}
            </span>
          )}
          {day.activities.length > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Activity className="h-2.5 w-2.5" />
              {day.activities.length}
            </span>
          )}
          {day.stays.length > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Bed className="h-2.5 w-2.5" />
              {day.stays.length}
            </span>
          )}
          {day.notes.length > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <StickyNote className="h-2.5 w-2.5" />
              {day.notes.length}
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

export function ItineraryBuilderTab({ packageId, destinationId, durations, stayCategories }: Props) {
  const defaultDuration = durations.find((d) => d.is_default) ?? durations[0] ?? null;
  const [selectedDurationId, setSelectedDurationId] = useState<number | null>(defaultDuration?.id ?? null);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(
    defaultDuration?.routes[0]?.id ?? null,
  );
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

  function openDaySidebar(day: DayData) {
    setOpenDay(day);
    setSidebarOpen(true);
  }

  function handleDaySaved(updatedDay: DayData) {
    setDays((prev) => (prev ? prev.map((d) => (d.day === updatedDay.day ? updatedDay : d)) : prev));
  }

  if (durations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-dashed bg-muted/30">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
          <CalendarDays className="h-5 w-5 text-primary" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">No durations yet</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Create route variants first in the Route Builder tab
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
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
              {selectedDuration.routes.map((r) => (
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
                <DayCard key={day.day} day={day} onClick={() => openDaySidebar(day)} />
              ))}
            </div>
          ) : null}
        </div>
      )}

      {/* Sidebar */}
      {openDay && selectedDurationId && selectedRouteId && (
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
        />
      )}
    </div>
  );
}
