"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { Loader2, Calendar, Wand2, BedDouble, Zap, Car, StickyNote, ChevronRight, AlertTriangle } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Label } from "../../../components/ui/label";
import { Card, CardContent } from "../../../components/ui/card";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "../../../components/ui/select";
import { toast } from "sonner";
import {
  generateDaysAction,
  getItineraryGridAction,
  upsertDayAction,
} from "@/app/actions/packages/itinerary.actions";
import { buildTimelineItems } from "../components/itinerary/timeline.types";
import { Timeline } from "../components/itinerary/Timeline";
import type {
  PackageDuration,
  PackageStayCategory,
  RouteWithStops,
  ItineraryDayView,
} from "@/app/types/packages";

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  packageId: number;
  destinationId: number;
  durations: PackageDuration[];
  routes: RouteWithStops[];
  categories: PackageStayCategory[];
  cabOptions: { id: number; cab_type: string }[];
};

// ── Component ─────────────────────────────────────────────────────────────────

export function ItineraryTab({
  packageId,
  destinationId,
  durations,
  routes,
  categories,
}: Props) {
  const [selectedDurationId, setSelectedDurationId] = useState(
    durations[0]?.id ? String(durations[0].id) : ""
  );
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [days, setDays] = useState<ItineraryDayView[]>([]);
  const [missingDays, setMissingDays] = useState<number[]>([]);
  const [totalDays, setTotalDays] = useState(0);
  const [gridLoading, setGridLoading] = useState(false);
  const [selectedDayId, setSelectedDayId] = useState<number | null>(null);

  const [isPending, startTransition] = useTransition();
  const [isGenerating, startGenerating] = useTransition();

  const filteredRoutes = routes.filter(
    (r) => String(r.duration_id) === selectedDurationId
  );
  const selectedDay = days.find((d) => d.id === selectedDayId) ?? null;

  // ── Load grid ──────────────────────────────────────────────────────────────

  const loadGrid = useCallback(async () => {
    if (!selectedDurationId || !selectedRouteId) return;
    setGridLoading(true);
    const res = await getItineraryGridAction(
      packageId,
      parseInt(selectedDurationId),
      parseInt(selectedRouteId)
    );
    if (res.success) {
      setDays(res.data.days);
      setMissingDays(res.data.missing_days);
      setTotalDays(res.data.total_days);
      if (res.data.days.length > 0 && !selectedDayId) {
        setSelectedDayId(res.data.days[0].id);
      }
    }
    setGridLoading(false);
  }, [packageId, selectedDurationId, selectedRouteId, selectedDayId]);

  useEffect(() => {
    if (filteredRoutes.length > 0) {
      setSelectedRouteId(String(filteredRoutes[0].id));
    } else {
      setSelectedRouteId("");
      setDays([]);
      setSelectedDayId(null);
    }
  }, [selectedDurationId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadGrid();
  }, [selectedDurationId, selectedRouteId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-generate days ─────────────────────────────────────────────────────

  function handleGenerate() {
    if (!selectedDurationId || !selectedRouteId) return;
    startGenerating(async () => {
      const res = await generateDaysAction(
        packageId,
        parseInt(selectedDurationId),
        parseInt(selectedRouteId)
      );
      if (res.success) {
        toast.success(
          `Generated ${res.data.created} day${res.data.created !== 1 ? "s" : ""} (${res.data.skipped} skipped)`
        );
        loadGrid();
      } else {
        toast.error(res.error);
      }
    });
  }

  // ── Save day header (passed down to Timeline → DayHeader) ─────────────────

  const handleSaveHeader = useCallback(
    async (title: string, desc: string) => {
      if (!selectedDay) return;
      const res = await upsertDayAction({
        package_id: packageId,
        duration_id: parseInt(selectedDurationId),
        route_id: parseInt(selectedRouteId),
        day: selectedDay.day,
        title,
        description: desc || undefined,
      });
      if (!res.success) throw new Error(res.error);
      // Reflect new title in the day list without a full reload
      setDays((d) =>
        d.map((x) =>
          x.id === selectedDay.id
            ? { ...x, title, description: desc || null }
            : x
        )
      );
    },
    [packageId, selectedDurationId, selectedRouteId, selectedDay]
  );

  // ── Guard: no durations ───────────────────────────────────────────────────

  if (durations.length === 0) {
    return (
      <Card>
        <CardContent className="pt-8 pb-8 text-center">
          <Calendar className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-muted-foreground">No durations defined</p>
          <p className="text-xs text-muted-foreground">Add durations in the Basic tab first</p>
        </CardContent>
      </Card>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <Card>
        <CardContent className="pb-4 pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-40 space-y-1">
              <Label className="text-xs">Duration</Label>
              <Select value={selectedDurationId} onValueChange={setSelectedDurationId}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {durations.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-50 space-y-1">
              <Label className="text-xs">Route</Label>
              <Select
                value={selectedRouteId}
                onValueChange={setSelectedRouteId}
                disabled={filteredRoutes.length === 0}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue
                    placeholder={
                      filteredRoutes.length === 0
                        ? "No routes for this duration"
                        : "Select route"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {filteredRoutes.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedRouteId && (
              <>
                <div className="text-sm text-muted-foreground">
                  {days.length} / {totalDays} days
                  {missingDays.length > 0 && (
                    <span className="ml-1 text-amber-600">
                      · {missingDays.length} missing
                    </span>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="ml-auto"
                >
                  {isGenerating ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="mr-1 h-3.5 w-3.5" />
                  )}
                  Auto-generate
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* States: no route selected / loading / no days / grid */}
      {!selectedRouteId ? (
        <div className="flex flex-col items-center rounded-xl border bg-muted/20 py-16 text-center">
          <Calendar className="mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Select a duration and route to view the itinerary
          </p>
        </div>
      ) : gridLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : days.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border bg-muted/20 py-16 text-center">
          <Calendar className="mb-2 h-8 w-8 text-muted-foreground" />
          <p className="mb-1 text-sm font-medium text-muted-foreground">
            No itinerary days yet
          </p>
          <p className="mb-4 text-xs text-muted-foreground">
            Click Auto-generate to create day records from the route
          </p>
          <Button size="sm" variant="outline" onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="mr-1 h-3.5 w-3.5" />
            )}
            Auto-generate Days
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-[180px_1fr] gap-4 items-start min-h-150">

          {/* Left: day list */}
          <div className="rounded-xl border overflow-hidden">
            <div className="border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
              {totalDays} Days
            </div>
            <div className="max-h-150 divide-y overflow-y-auto">
              {days.map((day) => {
                const isSelected = day.id === selectedDayId;
                const stayCount = day.itineraryStays?.length ?? 0;
                const actCount = day.itinerary_activities?.length ?? 0;
                const transferCount = day.itinerary_transfers?.length ?? 0;
                const noteCount = day.itinerary_notes?.length ?? 0;
                const isEmpty =
                  stayCount === 0 &&
                  actCount === 0 &&
                  transferCount === 0 &&
                  noteCount === 0;

                return (
                  <button
                    key={day.id}
                    className={`w-full px-3 py-2.5 text-left transition-colors hover:bg-muted/30 ${
                      isSelected ? "border-l-2 border-primary bg-primary/10" : ""
                    }`}
                    onClick={() => setSelectedDayId(day.id)}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                        {day.day}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{day.title}</p>
                        <div className="mt-0.5 flex gap-1">
                          {stayCount > 0 && <BedDouble className="h-2.5 w-2.5 text-muted-foreground" />}
                          {actCount > 0 && <Zap className="h-2.5 w-2.5 text-muted-foreground" />}
                          {transferCount > 0 && <Car className="h-2.5 w-2.5 text-muted-foreground" />}
                          {noteCount > 0 && <StickyNote className="h-2.5 w-2.5 text-muted-foreground" />}
                          {isEmpty && (
                            <span className="text-[10px] text-muted-foreground">empty</span>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <ChevronRight className="h-3 w-3 shrink-0 text-primary" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {missingDays.length > 0 && (
              <div className="border-t bg-amber-50 p-2">
                <p className="flex items-center gap-1 text-[10px] text-amber-700">
                  <AlertTriangle className="h-3 w-3" />
                  Days {missingDays.join(", ")} missing
                </p>
              </div>
            )}
          </div>

          {/* Right: timeline (canvas + palette inside DndContext) */}
          {!selectedDay ? (
            <div className="flex flex-col items-center justify-center rounded-xl border py-16 text-muted-foreground">
              <Calendar className="mb-2 h-7 w-7" />
              <p className="text-sm">Select a day from the list</p>
            </div>
          ) : (
            <Timeline
              key={selectedDay.id}
              packageId={packageId}
              destinationId={destinationId}
              selectedDay={selectedDay}
              categories={categories}
              onSaveHeader={handleSaveHeader}
              onRefresh={loadGrid}
            />
          )}
        </div>
      )}
    </div>
  );
}
