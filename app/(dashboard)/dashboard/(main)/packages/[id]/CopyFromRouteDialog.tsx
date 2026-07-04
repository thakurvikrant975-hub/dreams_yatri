"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel,
} from "../../components/ui/select";
import { Badge } from "../../components/ui/badge";
import { cn } from "@/app/lib/utils";
import {
  Loader2, Copy, Activity, Hotel, StickyNote, Car, Camera, FileText, Check,
  Replace, Plus,
} from "lucide-react";
import { handleGetItineraryData, handleCopyItineraryDays } from "@/app/actions/packages/itinerary-builder.actions";
import type { DayData } from "@/app/services/itinerary-builder.service";

// ── Types ──────────────────────────────────────────────────────────────────

type RouteStop = {
  place_name: string;
  stay_days: number;
  location: { latitude: number | null; longitude: number | null } | null;
};

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
  open:              boolean;
  onClose:           () => void;
  packageId:         number;
  durations:         Duration[];
  targetDurationId:  number;
  targetRouteId:     number;
  stopName:          string;
  targetStopDays:    DayData[];
  onCopied:          (updatedDays: DayData[]) => void;
};

type CopyFields = {
  title:       boolean;
  description: boolean;
  activities:  boolean;
  stays:       boolean;
  notes:       boolean;
  transfers:   boolean;
  attractions: boolean;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function getStopDayRange(stops: RouteStop[] | undefined, placeName: string): { startDay: number; endDay: number } | null {
  if (!stops?.length) return null;
  let cursor = 0;
  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    const isLast = i === stops.length - 1;
    const count = stop.stay_days + (isLast ? 1 : 0);
    const startDay = cursor + 1;
    const endDay = cursor + count;
    cursor += count;
    if (stop.place_name === placeName) return { startDay, endDay };
  }
  return null;
}

function countSourceContent(day: DayData): string {
  const parts: string[] = [];
  if (day.activities.length)  parts.push(`${day.activities.length} act`);
  if (day.stays.length)       parts.push(`hotel`);
  if (day.transfers.length)   parts.push(`${day.transfers.length} xfer`);
  if (day.notes.length)       parts.push(`${day.notes.length} note`);
  if (day.attractions.length) parts.push(`${day.attractions.length} photo`);
  return parts.length ? parts.join(", ") : "empty";
}

// ── Component ──────────────────────────────────────────────────────────────

export function CopyFromRouteDialog({
  open, onClose,
  packageId, durations,
  targetDurationId, targetRouteId,
  stopName, targetStopDays,
  onCopied,
}: Props) {
  const [sourceKey,     setSourceKey]     = useState<string>("");   // "durationId:routeId"
  const [sourceDays,    setSourceDays]    = useState<DayData[] | null>(null);
  const [loadingSource, setLoadingSource] = useState(false);
  // dayMappings[targetDayNumber] = set of source day numbers to copy from
  const [dayMappings,   setDayMappings]   = useState<Record<number, number[]>>({});
  const [fields,        setFields]        = useState<CopyFields>({
    title: true, description: true, activities: true,
    stays: true, notes: true, transfers: true, attractions: true,
  });
  const [mode,    setMode]    = useState<"replace" | "append">("replace");
  const [copying, setCopying] = useState(false);

  // Source options: all routes in any duration that have a stop with the same place_name,
  // excluding the current target route
  const sourceOptions = durations.flatMap((dur) =>
    dur.routes
      .filter((r) => {
        if (r.id === targetRouteId && dur.id === targetDurationId) return false;
        return r.stops?.some((s) => s.place_name === stopName) ?? false;
      })
      .map((r) => ({ key: `${dur.id}:${r.id}`, durationLabel: dur.label, routeName: r.name, durationId: dur.id, routeId: r.id, stops: r.stops ?? [] }))
  );

  // Load source days when sourceKey changes
  const loadSourceDays = useCallback(async (durId: number, routeId: number, stops: RouteStop[]) => {
    setLoadingSource(true);
    setSourceDays(null);
    const res = await handleGetItineraryData(packageId, durId, routeId);
    setLoadingSource(false);
    if (!res.success) { toast.error("Failed to load source itinerary"); return; }

    const allDays = res.data as DayData[];
    const range = getStopDayRange(stops, stopName);
    const filtered = range
      ? allDays.filter((d) => d.day >= range.startDay && d.day <= range.endDay)
      : allDays;
    setSourceDays(filtered);

    // Auto-set default mappings (1:1, source day → matching target day by index)
    const defaults: Record<number, number[]> = {};
    targetStopDays.forEach((td, i) => {
      const srcDay = filtered[i];
      defaults[td.day] = srcDay ? [srcDay.day] : [];
    });
    setDayMappings(defaults);
  }, [packageId, stopName, targetStopDays]);

  useEffect(() => {
    if (!sourceKey) { setSourceDays(null); setDayMappings({}); return; }
    const opt = sourceOptions.find((o) => o.key === sourceKey);
    if (!opt) return;
    loadSourceDays(opt.durationId, opt.routeId, opt.stops);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setSourceKey("");
      setSourceDays(null);
      setDayMappings({});
      setMode("replace");
      setCopying(false);
      setFields({ title: true, description: true, activities: true, stays: true, notes: true, transfers: true, attractions: true });
    }
  }, [open]);

  function toggleSourceDay(targetDay: number, srcDay: number) {
    setDayMappings((prev) => {
      const current = prev[targetDay] ?? [];
      return {
        ...prev,
        [targetDay]: current.includes(srcDay)
          ? current.filter((d) => d !== srcDay)
          : [...current, srcDay],
      };
    });
  }

  function toggleField(key: keyof CopyFields) {
    setFields((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleCopy() {
    const mappings = targetStopDays
      .map((td) => ({ targetDay: td.day, sourceDays: dayMappings[td.day] ?? [] }))
      .filter((m) => m.sourceDays.length > 0);

    if (mappings.length === 0) { toast.error("Select at least one source day to copy from"); return; }
    const anyField = Object.values(fields).some(Boolean);
    if (!anyField) { toast.error("Select at least one field to copy"); return; }

    const opt = sourceOptions.find((o) => o.key === sourceKey)!;
    setCopying(true);
    const res = await handleCopyItineraryDays(
      packageId, opt.durationId, opt.routeId,
      targetDurationId, targetRouteId,
      mappings, fields, mode,
    );
    setCopying(false);

    if (!res.success) { toast.error(res.message ?? "Copy failed"); return; }

    toast.success(`Copied ${mappings.length} day${mappings.length > 1 ? "s" : ""} successfully`);

    // Reload target days so the parent grid refreshes
    const refreshed = await handleGetItineraryData(packageId, targetDurationId, targetRouteId);
    if (refreshed.success) {
      const all = refreshed.data as DayData[];
      onCopied(all);
    }
    onClose();
  }

  const canCopy = !!sourceKey && !loadingSource && sourceDays !== null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Copy className="h-4 w-4 text-primary" />
            Copy &ldquo;{stopName}&rdquo; days from another route
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Select a source route that passes through {stopName} and map its days to your current itinerary.
          </p>
        </DialogHeader>

        <div className="px-6 py-5 space-y-6">

          {/* ── Source route picker ─────────────────────────────────────── */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Source route</label>
            {sourceOptions.length === 0 ? (
              <p className="text-xs text-muted-foreground/60 italic py-2">
                No other routes have a &ldquo;{stopName}&rdquo; stop yet.
              </p>
            ) : (
              <Select value={sourceKey} onValueChange={setSourceKey}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Choose a route to copy from…" />
                </SelectTrigger>
                <SelectContent>
                  {durations.map((dur) => {
                    const opts = sourceOptions.filter((o) => o.durationId === dur.id);
                    if (opts.length === 0) return null;
                    return (
                      <SelectGroup key={dur.id}>
                        <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                          {dur.label}
                        </SelectLabel>
                        {opts.map((o) => (
                          <SelectItem key={o.key} value={o.key} className="text-sm">
                            {o.routeName}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* ── Day mapping ─────────────────────────────────────────────── */}
          {sourceKey && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Day mapping</p>

              {loadingSource ? (
                <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading source days…
                </div>
              ) : sourceDays && (
                <div className="space-y-3">
                  {targetStopDays.map((td, tIdx) => (
                    <div key={td.day} className="rounded-xl border border-border p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-primary shrink-0">
                          Target Day {td.day}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">{td.title}</span>
                        {td.id && (
                          <Badge variant="outline" className="text-[9px] ml-auto shrink-0 text-amber-600 border-amber-200 bg-amber-50">
                            Has content
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">Copy from:</p>
                      <div className="flex flex-wrap gap-2">
                        {sourceDays.length === 0 ? (
                          <p className="text-xs text-muted-foreground/50 italic">Source has no days for this stop</p>
                        ) : sourceDays.map((sd) => {
                          const selected = (dayMappings[td.day] ?? []).includes(sd.day);
                          return (
                            <button
                              key={sd.day}
                              type="button"
                              onClick={() => toggleSourceDay(td.day, sd.day)}
                              className={cn(
                                "group flex flex-col gap-0.5 rounded-lg border px-2.5 py-1.5 text-left transition-all text-xs",
                                selected
                                  ? "bg-primary/10 border-primary/40 text-primary"
                                  : "bg-muted/30 border-border hover:border-primary/30 hover:bg-primary/5",
                              )}
                            >
                              <div className="flex items-center gap-1.5">
                                {selected && <Check className="h-3 w-3 shrink-0" />}
                                <span className="font-medium">Day {sd.day}</span>
                              </div>
                              <span className="text-[10px] text-muted-foreground line-clamp-1 max-w-36">{sd.title}</span>
                              <span className="text-[9px] text-muted-foreground/60">{countSourceContent(sd)}</span>
                            </button>
                          );
                        })}
                      </div>
                      {(dayMappings[td.day] ?? []).length > 1 && (
                        <p className="text-[10px] text-amber-600 flex items-center gap-1">
                          <Plus className="h-3 w-3" />
                          {(dayMappings[td.day] ?? []).length} days will be merged — activities, notes & transfers are combined; hotel from first selected day
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── What to copy ────────────────────────────────────────────── */}
          {canCopy && (
            <div className="space-y-2.5">
              <p className="text-xs font-medium text-muted-foreground">What to copy</p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { key: "title",       icon: FileText,   label: "Title"              },
                  { key: "description", icon: FileText,   label: "Description"        },
                  { key: "activities",  icon: Activity,   label: "Activities"         },
                  { key: "stays",       icon: Hotel,      label: "Hotel / Stay"       },
                  { key: "notes",       icon: StickyNote, label: "Notes"              },
                  { key: "transfers",   icon: Car,        label: "Transfers"          },
                  { key: "attractions", icon: Camera,     label: "Attraction Photos"  },
                ] as { key: keyof CopyFields; icon: React.ElementType; label: string }[]).map(({ key, icon: Icon, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleField(key)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-left transition-all",
                      fields[key]
                        ? "bg-primary/10 border-primary/40 text-primary font-medium"
                        : "bg-muted/30 border-border text-muted-foreground hover:border-primary/30",
                    )}
                  >
                    <div className={cn(
                      "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                      fields[key] ? "bg-primary border-primary" : "border-border",
                    )}>
                      {fields[key] && <Check className="h-2.5 w-2.5 text-white" />}
                    </div>
                    <Icon className="h-3 w-3 shrink-0" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Mode toggle ─────────────────────────────────────────────── */}
          {canCopy && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Copy mode</p>
              <div className="flex gap-2">
                {([
                  { value: "replace", icon: Replace, label: "Replace",  desc: "Clear existing content then copy" },
                  { value: "append",  icon: Plus,    label: "Append",   desc: "Keep existing content and add to it" },
                ] as const).map(({ value, icon: Icon, label, desc }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    className={cn(
                      "flex-1 flex items-start gap-2 rounded-xl border p-3 text-left transition-all",
                      mode === value
                        ? "bg-primary/10 border-primary/40"
                        : "border-border hover:border-primary/30 hover:bg-muted/30",
                    )}
                  >
                    <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", mode === value ? "text-primary" : "text-muted-foreground")} />
                    <div>
                      <p className={cn("text-xs font-medium", mode === value ? "text-primary" : "text-foreground")}>
                        {label}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={copying}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!canCopy || copying}
            onClick={handleCopy}
            className="gap-1.5"
          >
            {copying
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Copying…</>
              : <><Copy className="h-3.5 w-3.5" />Copy Days</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
