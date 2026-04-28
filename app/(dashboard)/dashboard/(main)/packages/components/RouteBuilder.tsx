"use client";

import { useState, useTransition, useEffect } from "react";
import {
  MultiStepModal,
  useMultiStep,
  type Step,
} from "../../components/dashboard/MultiStepModel";
import { StopsEditor, type StopInput } from "./StopsEditor";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { Switch } from "../../components/ui/switch";
import { Textarea } from "../../components/ui/textarea";
import {
  createDurationWithRoute,
  createRouteWithStops,
  deleteDuration,
  deleteRoute,
  deleteStop,
} from "../actions";
import {
  Plus, Trash2, ChevronDown, ChevronRight, MapPin, Loader2,
} from "lucide-react";
import { cn } from "@/app/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────

type Stop = { id: number; location: string; stay_days: number; sort_order: number };
type Route = { id: number; duration_id: number; name: string; slug: string; is_active: boolean; meta_title: string | null; meta_desc: string | null; sort_order: number; stops: Stop[] };
type Duration = { id: number; package_id: number; label: string; days: number; nights: number; is_default: boolean; sort_order: number; routes: Route[] };

type Props = {
  packageId: number;
  initialDurations: Duration[];
};

// ── Step 1: Duration ──────────────────────────────────────────────────────

function DurationStep() {
  const { setStepData, stepData } = useMultiStep();
  const d = (stepData["duration"] ?? {}) as Record<string, unknown>;

  const [label, setLabel] = useState((d.label as string) ?? "");
  const [days, setDays] = useState((d.days as number) ?? 1);
  const [nights, setNights] = useState((d.nights as number) ?? 1);
  const [isDefault, setIsDefault] = useState((d.is_default as boolean) ?? false);

  useEffect(() => {
    setStepData("duration", { label, days, nights, is_default: isDefault, sort_order: 0 });
  }, [label, days, nights, isDefault]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Label *</Label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. 7 Nights / 8 Days" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Days</Label>
          <Input type="number" min={1} value={days} onChange={(e) => setDays(Number(e.target.value))} />
        </div>
        <div className="space-y-1.5">
          <Label>Nights</Label>
          <Input type="number" min={0} value={nights} onChange={(e) => setNights(Number(e.target.value))} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Switch checked={isDefault} onCheckedChange={setIsDefault} />
        <Label>Set as default duration</Label>
      </div>
    </div>
  );
}

// ── Step 2: Route ─────────────────────────────────────────────────────────

function RouteStep() {
  const { setStepData, stepData } = useMultiStep();
  const r = (stepData["route"] ?? {}) as Record<string, unknown>;

  const [name, setName] = useState((r.name as string) ?? "");
  const [isActive, setIsActive] = useState((r.is_active as boolean) ?? true);
  const [metaTitle, setMetaTitle] = useState((r.meta_title as string) ?? "");
  const [metaDesc, setMetaDesc] = useState((r.meta_desc as string) ?? "");

  useEffect(() => {
    setStepData("route", { name, is_active: isActive, meta_title: metaTitle || undefined, meta_desc: metaDesc || undefined, sort_order: 0 });
  }, [name, isActive, metaTitle, metaDesc]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Route Name *</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Delhi → Manali → Delhi" />
      </div>
      <div className="flex items-center gap-3">
        <Switch checked={isActive} onCheckedChange={setIsActive} />
        <Label>Active</Label>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Meta Title (optional)</Label>
        <Input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} className="text-sm" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Meta Description (optional)</Label>
        <Textarea value={metaDesc} onChange={(e) => setMetaDesc(e.target.value)} rows={2} className="text-sm" />
      </div>
    </div>
  );
}

// ── Step 3: Stops ─────────────────────────────────────────────────────────

function StopsStep() {
  const { setStepData, stepData } = useMultiStep();
  const [stops, setStops] = useState<StopInput[]>(
    (stepData["stops"]?.stops as StopInput[]) ?? []
  );

  function handleChange(updated: StopInput[]) {
    setStops(updated);
    setStepData("stops", { stops: updated });
  }

  return <StopsEditor value={stops} onChange={handleChange} />;
}

// ── STEPS CONFIG ──────────────────────────────────────────────────────────

const STEPS: Step[] = [
  {
    id: "duration",
    title: "Duration",
    description: "Set the package duration",
    validate: (data) => (!data.label ? "Duration label is required" : null),
  },
  {
    id: "route",
    title: "Route",
    description: "Define the route",
    validate: (data) => (!data.name ? "Route name is required" : null),
  },
  {
    id: "stops",
    title: "Stops",
    description: "Add route stops",
    optional: true,
  },
];

// ── Route Add Steps (for existing duration) ───────────────────────────────

const ROUTE_STEPS: Step[] = [
  {
    id: "route",
    title: "Route",
    description: "Define the route",
    validate: (data) => (!data.name ? "Route name is required" : null),
  },
  { id: "stops", title: "Stops", description: "Add route stops", optional: true },
];

// ── Main Component ────────────────────────────────────────────────────────

export function RouteBuilder({ packageId, initialDurations }: Props) {
  const [durations, setDurations] = useState<Duration[]>(initialDurations);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [addRouteFor, setAddRouteFor] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();

  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleCreateDurationWithRoute(data: Record<string, unknown>) {
    setSubmitting(true);
    try {
      const result = await createDurationWithRoute(
        packageId,
        data as Parameters<typeof createDurationWithRoute>[1],
        data as Parameters<typeof createDurationWithRoute>[2],
        (data.stops as StopInput[]) ?? []
      );
      setDurations((prev) => [
        ...prev,
        { ...result.duration, routes: [{ ...result.route, stops: (data.stops as StopInput[] ?? []).map((s, i) => ({ ...s, id: i, route_id: result.route.id })) }] },
      ]);
      setExpanded((prev) => new Set([...prev, result.duration.id]));
      setAddOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddRoute(data: Record<string, unknown>) {
    if (!addRouteFor) return;
    setSubmitting(true);
    try {
      const route = await createRouteWithStops(
        addRouteFor,
        packageId,
        data as Parameters<typeof createRouteWithStops>[2],
        (data.stops as StopInput[]) ?? []
      );
      setDurations((prev) =>
        prev.map((d) =>
          d.id === addRouteFor
            ? { ...d, routes: [...d.routes, { ...route, stops: (data.stops as StopInput[] ?? []).map((s, i) => ({ ...s, id: i, route_id: route.id })) }] }
            : d
        )
      );
      setAddRouteFor(null);
    } finally {
      setSubmitting(false);
    }
  }

  function handleDeleteDuration(id: number) {
    startTransition(async () => {
      await deleteDuration(id, packageId);
      setDurations((prev) => prev.filter((d) => d.id !== id));
    });
  }

  function handleDeleteRoute(routeId: number, durationId: number) {
    startTransition(async () => {
      await deleteRoute(routeId, packageId);
      setDurations((prev) =>
        prev.map((d) => d.id === durationId ? { ...d, routes: d.routes.filter((r) => r.id !== routeId) } : d)
      );
    });
  }

  function handleDeleteStop(stopId: number, routeId: number, durationId: number) {
    startTransition(async () => {
      await deleteStop(stopId, packageId);
      setDurations((prev) =>
        prev.map((d) =>
          d.id === durationId
            ? { ...d, routes: d.routes.map((r) => r.id === routeId ? { ...r, stops: r.stops.filter((s) => s.id !== stopId) } : r) }
            : d
        )
      );
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setAddOpen(true)} size="sm">
          <Plus className="h-3.5 w-3.5 mr-2" />
          Add Duration + Route
        </Button>
      </div>

      {durations.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-10">
          No durations yet. Add your first duration and route.
        </p>
      )}

      <div className="space-y-3">
        {durations.map((dur) => (
          <div key={dur.id} className="border rounded-lg overflow-hidden">
            <div
              className="flex items-center gap-3 px-4 py-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => toggleExpand(dur.id)}
            >
              {expanded.has(dur.id) ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
              <div className="flex-1 min-w-0">
                <span className="font-medium text-sm">{dur.label}</span>
                <span className="text-xs text-muted-foreground ml-2">{dur.days}D / {dur.nights}N</span>
              </div>
              {dur.is_default && <Badge variant="secondary" className="text-xs">Default</Badge>}
              <span className="text-xs text-muted-foreground">{dur.routes.length} routes</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleDeleteDuration(dur.id); }}
                className="text-muted-foreground hover:text-destructive transition-colors ml-2"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {expanded.has(dur.id) && (
              <div className="p-4 space-y-3">
                {dur.routes.map((route) => (
                  <div key={route.id} className="border rounded-md overflow-hidden">
                    <div className="flex items-center gap-3 px-3 py-2 bg-muted/10">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="flex-1 text-sm font-medium">{route.name}</span>
                      <Badge variant={route.is_active ? "default" : "secondary"} className="text-xs">
                        {route.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <button
                        type="button"
                        onClick={() => handleDeleteRoute(route.id, dur.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {route.stops.length > 0 && (
                      <div className="px-3 py-2 space-y-1">
                        {route.stops.map((stop) => (
                          <div key={stop.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[9px] font-semibold">{stop.sort_order}</span>
                            <span className="flex-1">{stop.location}</span>
                            <span>{stop.stay_days}N</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteStop(stop.id, route.id, dur.id)}
                              className="hover:text-destructive transition-colors"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full border border-dashed"
                  onClick={() => setAddRouteFor(dur.id)}
                >
                  <Plus className="h-3.5 w-3.5 mr-2" />
                  Add Route to this Duration
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Duration + Route Modal */}
      <MultiStepModal
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add Duration & Route"
        description="Create a new duration with its route and stops"
        steps={STEPS}
        onComplete={handleCreateDurationWithRoute}
        isSubmitting={submitting}
        submitLabel="Create"
      >
        <DurationStep />
        <RouteStep />
        <StopsStep />
      </MultiStepModal>

      {/* Add Route to Existing Duration Modal */}
      <MultiStepModal
        open={addRouteFor !== null}
        onOpenChange={(open) => !open && setAddRouteFor(null)}
        title="Add Route"
        description="Create a new route with stops"
        steps={ROUTE_STEPS}
        onComplete={handleAddRoute}
        isSubmitting={submitting}
        submitLabel="Create Route"
      >
        <RouteStep />
        <StopsStep />
      </MultiStepModal>
    </div>
  );
}
