"use client";

import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import {
  Loader2, Search, Package, CalendarDays, Route, Check, MapPin,
  Activity, Hotel, StickyNote, Car, Camera, FileText,
} from "lucide-react";
import { cn } from "@/app/lib/utils";
import {
  handleSearchPackagesForCopy,
  handleGetPackageDurationsForCopy,
  handleGetItineraryData,
  handleCopyItineraryDays,
} from "@/app/actions/packages/itinerary-builder.actions";
import type { DayData, CopyFields } from "@/app/services/itinerary-builder.service";
import type { PackageForCopy, DurationForCopy } from "@/app/services/itinerary-builder.service";

// ── Types ──────────────────────────────────────────────────────────────────

type Props = {
  open: boolean;
  onClose: () => void;
  /** Called after a successful copy — the freshly-loaded target day */
  onCopied: (day: DayData) => void;
  /** Current package's destination — used to default the picker to same-destination packages */
  destinationId?: number;
  destinationName?: string;
  /** Current package id — excluded from the picker */
  currentPackageId: number;
  /** Where the copied content lands */
  targetDurationId: number;
  targetRouteId: number;
  targetDay: number;
};

const FIELD_CONFIG: { key: keyof CopyFields; icon: React.ElementType; label: string }[] = [
  { key: "title",       icon: FileText,   label: "Title"       },
  { key: "description", icon: FileText,   label: "Description" },
  { key: "activities",  icon: Activity,   label: "Activities"  },
  { key: "stays",       icon: Hotel,      label: "Hotel"       },
  { key: "notes",       icon: StickyNote, label: "Notes"       },
  { key: "transfers",   icon: Car,        label: "Transfers"   },
  { key: "attractions", icon: Camera,     label: "Photos"      },
];

function countDayContent(day: DayData): string {
  const parts: string[] = [];
  if (day.activities.length)  parts.push(`${day.activities.length} act`);
  if (day.stays.length)       parts.push("hotel");
  if (day.transfers.length)   parts.push(`${day.transfers.length} xfer`);
  if (day.notes.length)       parts.push(`${day.notes.length} note`);
  if (day.attractions.length) parts.push(`${day.attractions.length} photo`);
  return parts.length ? parts.join(", ") : "";
}

// ── Component ──────────────────────────────────────────────────────────────

export function CopyFromPackageDialog({
  open, onClose, onCopied, destinationId, destinationName, currentPackageId,
  targetDurationId, targetRouteId, targetDay,
}: Props) {
  const [query, setQuery]                   = useState("");
  const [sameDestOnly, setSameDestOnly]     = useState(!!destinationId);
  const [packages, setPackages]             = useState<PackageForCopy[]>([]);
  const [selectedPkg, setSelectedPkg]       = useState<PackageForCopy | null>(null);
  const [durations, setDurations]           = useState<DurationForCopy[]>([]);
  const [selectedDurationId, setDurId]      = useState<number | null>(null);
  const [selectedRouteId, setRouteId]       = useState<number | null>(null);
  const [days, setDays]                     = useState<DayData[] | null>(null);
  const [loadingDur, setLoadingDur]         = useState(false);
  const [loadingDays, setLoadingDays]       = useState(false);
  const [isPending, startTransition]        = useTransition();
  const [fields, setFields]                 = useState<CopyFields>({
    title: true, description: true, activities: true,
    stays: true, notes: true, transfers: true, attractions: true,
  });
  const [copyingDay, setCopyingDay]         = useState<number | null>(null);

  // Reset the same-destination default each time the dialog opens
  useEffect(() => {
    if (open) setSameDestOnly(!!destinationId);
  }, [open, destinationId]);

  // Search — re-runs on query change and on same-destination toggle
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      startTransition(async () => {
        const res = await handleSearchPackagesForCopy(
          query,
          sameDestOnly ? destinationId : undefined,
          currentPackageId,
        );
        if (res.success) setPackages(res.data);
      });
    }, query ? 300 : 0);
    return () => clearTimeout(timer);
  }, [open, query, sameDestOnly, destinationId, currentPackageId]);

  async function selectPackage(pkg: PackageForCopy) {
    setSelectedPkg(pkg);
    setDurId(null);
    setRouteId(null);
    setDays(null);
    setLoadingDur(true);
    const res = await handleGetPackageDurationsForCopy(pkg.id);
    setLoadingDur(false);
    if (!res.success) return;
    setDurations(res.data);
    const def = res.data.find((d) => d.is_default) ?? res.data[0];
    if (!def) return;
    setDurId(def.id);
    const firstRoute = def.routes[0];
    if (!firstRoute) return;
    setRouteId(firstRoute.id);
    loadDays(pkg.id, def.id, firstRoute.id);
  }

  async function loadDays(pkgId: number, durationId: number, routeId: number) {
    setDays(null);
    setLoadingDays(true);
    const res = await handleGetItineraryData(pkgId, durationId, routeId);
    setLoadingDays(false);
    if (res.success) setDays(res.data as DayData[]);
  }

  function selectDuration(dur: DurationForCopy) {
    if (!selectedPkg) return;
    setDurId(dur.id);
    const firstRoute = dur.routes[0];
    if (!firstRoute) return;
    setRouteId(firstRoute.id);
    loadDays(selectedPkg.id, dur.id, firstRoute.id);
  }

  function selectRoute(routeId: number) {
    if (!selectedPkg || !selectedDurationId) return;
    setRouteId(routeId);
    loadDays(selectedPkg.id, selectedDurationId, routeId);
  }

  function toggleField(key: keyof CopyFields) {
    setFields((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function reset() {
    setQuery("");
    setSelectedPkg(null);
    setDurations([]);
    setDurId(null);
    setRouteId(null);
    setDays(null);
    setFields({ title: true, description: true, activities: true, stays: true, notes: true, transfers: true, attractions: true });
  }

  async function handleCopyDay(day: DayData) {
    if (selectedDurationId == null || selectedRouteId == null || !selectedPkg) return;
    if (!Object.values(fields).some(Boolean)) { toast.error("Select at least one field to copy"); return; }

    setCopyingDay(day.day);
    const res = await handleCopyItineraryDays(
      selectedPkg.id, selectedDurationId, selectedRouteId,
      currentPackageId, targetDurationId, targetRouteId,
      [{ targetDay, sourceDays: [day.day] }],
      fields,
      "replace",
    );
    setCopyingDay(null);

    if (!res.success) { toast.error(res.message ?? "Copy failed"); return; }

    const refreshed = await handleGetItineraryData(currentPackageId, targetDurationId, targetRouteId);
    if (refreshed.success) {
      const updated = (refreshed.data as DayData[]).find((d) => d.day === targetDay);
      if (updated) onCopied(updated);
    }

    toast.success(`Day ${targetDay} updated from "${selectedPkg.title}" — Day ${day.day}`);
    reset();
    onClose();
  }

  const selectedDuration = durations.find((d) => d.id === selectedDurationId);
  const daysWithContent  = days?.filter((d) =>
    d.title || d.description || d.activities.length || d.stays.length ||
    d.transfers.length || d.notes.length || d.attractions.length,
  ) ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-3xl p-0 gap-0 flex flex-col max-h-[85vh]">
        <DialogHeader className="px-5 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4 text-muted-foreground" />
            Copy Day from Another Package
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Pick a day — the fields you select below will be copied into Day {targetDay}
          </p>
        </DialogHeader>

        {/* ── What to copy ─────────────────────────────────────────────── */}
        <div className="px-5 py-3 border-b shrink-0 flex flex-wrap gap-1.5">
          {FIELD_CONFIG.map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleField(key)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all",
                fields[key]
                  ? "bg-primary/10 border-primary/40 text-primary"
                  : "bg-muted/30 border-border text-muted-foreground hover:border-primary/30",
              )}
            >
              <div className={cn(
                "h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0",
                fields[key] ? "bg-primary border-primary" : "border-border",
              )}>
                {fields[key] && <Check className="h-2.5 w-2.5 text-white" />}
              </div>
              <Icon className="h-3 w-3 shrink-0" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* ── Left: Package picker ───────────────────────────────────── */}
          <div className="w-60 shrink-0 border-r flex flex-col">
            <div className="p-3 border-b space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search packages…"
                  className="pl-8 h-8 text-xs"
                />
              </div>
              {destinationId && (
                <button
                  type="button"
                  onClick={() => setSameDestOnly((v) => !v)}
                  className={cn(
                    "w-full flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-medium transition-colors",
                    sameDestOnly
                      ? "bg-primary/10 text-primary border-primary/40"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                  title={sameDestOnly ? "Showing only packages in the same destination" : "Showing all destinations"}
                >
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">
                    {sameDestOnly ? (destinationName ?? "Same destination") : "All destinations"}
                  </span>
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {isPending ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : packages.length === 0 ? (
                <div className="text-center py-8 px-2 space-y-1.5">
                  <p className="text-xs text-muted-foreground">No packages found</p>
                  {sameDestOnly && (
                    <button
                      type="button"
                      onClick={() => setSameDestOnly(false)}
                      className="text-[10px] text-primary hover:underline cursor-pointer"
                    >
                      Search all destinations
                    </button>
                  )}
                </div>
              ) : packages.map((pkg) => {
                const active = selectedPkg?.id === pkg.id;
                return (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => selectPackage(pkg)}
                    className={cn(
                      "w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted text-foreground",
                    )}
                  >
                    <p className="font-medium line-clamp-2 leading-snug">{pkg.title}</p>
                    <p className={cn("text-[10px] mt-0.5", active ? "text-primary-foreground/70" : "text-muted-foreground")}>
                      {pkg.destination}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Right: Day list ────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {!selectedPkg ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Package className="h-8 w-8 text-muted-foreground/20" />
                <p className="text-sm">Select a package to see its days</p>
              </div>
            ) : loadingDur ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Duration + Route chips */}
                {(durations.length > 1 || (selectedDuration?.routes?.length ?? 0) > 1) && (
                  <div className="px-4 py-3 border-b space-y-2 shrink-0">
                    {durations.length > 1 && (
                      <div className="flex flex-wrap gap-1.5">
                        {durations.map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => selectDuration(d)}
                            className={cn(
                              "flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-medium transition-colors",
                              selectedDurationId === d.id
                                ? "bg-primary text-primary-foreground border-primary"
                                : "border-border hover:bg-muted",
                            )}
                          >
                            <CalendarDays className="h-3 w-3" />
                            {d.label}
                          </button>
                        ))}
                      </div>
                    )}
                    {selectedDuration && selectedDuration.routes.length > 1 && (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedDuration.routes.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => selectRoute(r.id)}
                            className={cn(
                              "flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-medium transition-colors",
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

                {/* Day list */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {loadingDays ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : daysWithContent.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-1 text-muted-foreground">
                      <p className="text-sm">No days with content yet</p>
                      <p className="text-xs text-muted-foreground/60">Try a different duration or route</p>
                    </div>
                  ) : daysWithContent.map((day) => {
                    const isCopying = copyingDay === day.day;
                    const contentSummary = countDayContent(day);
                    return (
                      <button
                        key={day.day}
                        type="button"
                        disabled={copyingDay !== null}
                        onClick={() => handleCopyDay(day)}
                        className={cn(
                          "w-full text-left px-3 py-2.5 rounded-lg border transition-all group",
                          "border-border hover:border-primary/40 hover:bg-primary/5",
                          copyingDay !== null && !isCopying && "opacity-40",
                        )}
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-bold text-primary">Day {day.day}</span>
                          {contentSummary && (
                            <span className="text-[9px] text-muted-foreground/70">{contentSummary}</span>
                          )}
                          {isCopying ? (
                            <Loader2 className="h-3 w-3 animate-spin text-primary ml-auto" />
                          ) : (
                            <Check className="h-3 w-3 text-emerald-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </div>
                        <p className="text-xs font-medium line-clamp-1">{day.title}</p>
                        {day.description && (
                          <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                            {day.description}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
