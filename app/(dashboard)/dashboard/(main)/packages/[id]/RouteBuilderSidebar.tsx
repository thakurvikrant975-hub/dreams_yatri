"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import {
  DndContext, closestCenter, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable,
  verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  MultiStepSheet, useMultiStepSheet, type SheetStep,
} from "../../components/dashboard/MultiStepSheet";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Switch } from "../../components/ui/switch";
import { LocationSearchSelect } from "../../components/location/LocationSearchSelect";
import type { LocationValue, LocationType } from "../../components/location/location.types";
import {
  DBImageSelector, type SelectableImage,
} from "../../components/dashboard/DBImageSelector";
import { handleSaveRouteVariant } from "@/app/actions/packages/route-builder.actions";
import { handleCheckItineraryDaysContent } from "@/app/actions/packages/itinerary-builder.actions";
import { type StopInput, type DurationMeta } from "@/app/services/route-builder.service";
import { deriveRouteName } from "@/app/lib/route-builder-utils";
import {
  GripVertical, Plus, Trash2, MapPin,
  Route, CalendarDays, RotateCcw,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

export type StopRow = {
  id: string;
  location: LocationValue | null;
  stay_nights: number;
};

export type EditingRoute = {
  routeId: number;
  name: string;
  meta_title: string | null;
  meta_desc: string | null;
  durationId: number;
  durationLabel: string;
  durationDays: number;
  durationNights: number;
  durationIsDefault: boolean;
  durationIsActive: boolean;
  durationSortOrder: number;
  durationThumbnail: string | null;
  stops: {
    id: number;
    place_name: string;
    stay_days: number;
    sort_order: number;
    location_id: string | null;
    location: {
      id: string;
      latitude: number | null;
      longitude: number | null;
      type: string;
      slug: string;
    } | null;
  }[];
};

function uid() { return Math.random().toString(36).slice(2, 9); }

// ── Dynamic map ────────────────────────────────────────────────────────────

const RoutePreviewMap = dynamic(
  () => import("./RoutePreviewMap").then((m) => m.RoutePreviewMap),
  { ssr: false, loading: () => <div className="h-64 rounded-lg bg-muted animate-pulse" /> },
);

// ── Sortable stop row ──────────────────────────────────────────────────────

function SortableStopRow({
  row, index, total, onChange, onRemove,
}: {
  row: StopRow; index: number; total: number;
  onChange: (id: string, patch: Partial<StopRow>) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: row.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex gap-2 items-start ${isDragging ? "opacity-50" : ""}`}
    >
      <button type="button" {...attributes} {...listeners}
        className="mt-2 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0">
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="mt-2 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold shrink-0">
        {index + 1}
      </div>

      <div className="flex-1 min-w-0">
        <LocationSearchSelect
          value={row.location}
          onChange={(loc) => onChange(row.id, { location: loc })}
          placeholder={`Stop ${index + 1} — search location`}
        />
      </div>

      <div className="w-20 shrink-0 relative">
        <input
          type="number" min={0} value={row.stay_nights}
          onChange={(e) => onChange(row.id, { stay_nights: Math.max(0, parseInt(e.target.value) || 0) })}
          className="w-full rounded-md border border-input bg-background text-sm py-2 pl-2 pr-6 focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">n</span>
      </div>

      <button type="button" disabled={total <= 1} onClick={() => onRemove(row.id)}
        className="mt-2 text-muted-foreground hover:text-destructive disabled:opacity-30 shrink-0">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

// ── Step 1: Stops ──────────────────────────────────────────────────────────

function StopsStep({
  stops, setStops,
}: { stops: StopRow[]; setStops: React.Dispatch<React.SetStateAction<StopRow[]>> }) {
  const { setStepData } = useMultiStepSheet();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const totalNights = useMemo(() => stops.reduce((s, r) => s + r.stay_nights, 0), [stops]);
  const autoName = useMemo(
    () => deriveRouteName(stops.filter((s) => s.location).map((s) => ({ place_name: s.location!.name }))),
    [stops],
  );
  const mapStops = useMemo(
    () => stops
      .filter((s) => s.location)
      .map((s) => ({
        place_name: s.location!.name,
        latitude: s.location!.latitude ?? 0,
        longitude: s.location!.longitude ?? 0,
        stay_days: s.stay_nights,
      })),
    [stops],
  );

  useEffect(() => { setStepData("stops", { stops }); }, [stops, setStepData]);

  function addStop() { setStops((p) => [...p, { id: uid(), location: null, stay_nights: 1 }]); }
  function updateStop(id: string, patch: Partial<StopRow>) {
    setStops((p) => p.map((r) => r.id === id ? { ...r, ...patch } : r));
  }
  function removeStop(id: string) { setStops((p) => p.filter((r) => r.id !== id)); }
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setStops((p) => {
        const from = p.findIndex((s) => s.id === active.id);
        const to = p.findIndex((s) => s.id === over.id);
        return arrayMove(p, from, to);
      });
    }
  }

  return (
    <div className="space-y-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={stops.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {stops.map((row, i) => (
              <SortableStopRow key={row.id} row={row} index={i} total={stops.length}
                onChange={updateStop} onRemove={removeStop} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Button type="button" variant="outline" size="sm" onClick={addStop} className="gap-1.5">
        <Plus className="h-3.5 w-3.5" /> Add Stop
      </Button>

      {totalNights > 0 && (
        <div className="rounded-lg bg-muted/50 border px-3 py-2.5 text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Auto duration</span>
            <span className="font-semibold">{totalNights + 1}D / {totalNights}N</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Route name</span>
            <span className="font-medium text-right max-w-[55%] truncate">{autoName || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Coords filled</span>
            <span className="font-medium">{stops.filter((s) => s.location).length} / {stops.length}</span>
          </div>
        </div>
      )}

      {mapStops.length > 0 && <RoutePreviewMap stops={mapStops} />}
    </div>
  );
}

// ── Step 2: Route Meta ─────────────────────────────────────────────────────

function RouteMetaStep({ autoName, init }: {
  autoName: string;
  init: { name: string; meta_title: string; meta_desc: string };
}) {
  const { setStepData, stepData } = useMultiStepSheet();

  // stepData["meta"] persists across step navigation — read from it on remount
  // so values aren't lost when user goes to step 3 and comes back.
  // null means "from DB / never typed" → auto-fill; "" means "user cleared" → stay empty.
  const saved = stepData["meta"] as {
    name?: string;
    meta_title?: string | null;
    meta_desc?: string | null;
  } | undefined;

  const defaultName = init.name || autoName;

  // Lazy init so it only runs once per mount
  const [name, setName] = useState<string>(() => saved?.name ?? defaultName);
  const [metaTitle, setMetaTitle] = useState<string>(() =>
    saved !== undefined
      ? (saved.meta_title ?? defaultName)   // null from DB → auto-fill; "" user cleared → stay empty
      : (init.meta_title || defaultName)    // first create visit → auto-fill from route name
  );
  const [metaDesc, setMetaDesc] = useState<string>(() =>
    saved !== undefined
      ? (saved.meta_desc ?? "")
      : (init.meta_desc ?? "")
  );

  useEffect(() => {
    setStepData("meta", {
      name: name.trim() || undefined,
      // Save "" (not null) for empty so we can distinguish "user cleared" from "never typed (DB null)"
      meta_title: metaTitle.trim(),
      meta_desc: metaDesc.trim(),
    });
  }, [name, metaTitle, metaDesc, setStepData]);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Route Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)}
          placeholder={autoName || "Auto-generated from stops"} />
        {autoName && name !== autoName && (
          <p className="text-[11px] text-muted-foreground">
            Auto: <span className="font-medium">{autoName}</span>
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label>Meta Title <span className="text-muted-foreground font-normal text-xs">(SEO)</span></Label>
        <Input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)}
          placeholder="Page title for this route" />
      </div>
      <div className="space-y-1.5">
        <Label>Meta Description <span className="text-muted-foreground font-normal text-xs">(SEO)</span></Label>
        <Textarea value={metaDesc} onChange={(e) => setMetaDesc(e.target.value)}
          placeholder="Short description for search engines" rows={3} />
      </div>
    </div>
  );
}

// ── Step 3: Duration ───────────────────────────────────────────────────────

function DurationStep({
  autoNights, packageImages, init,
}: {
  autoNights: number;
  packageImages: SelectableImage[];
  init?: {
    days: number; nights: number; label: string;
    is_default: boolean; is_active: boolean;
    sort_order: number; thumbnail_url: string | null;
  };
}) {
  const { setStepData, stepData } = useMultiStepSheet();

  const autoDays = autoNights + 1;
  const autoLabel = `${autoDays}D / ${autoNights}N`;

  // Read persisted stepData on remount so values survive step navigation
  const saved = stepData["duration"] as {
    days?: number; nights?: number; label?: string;
    is_default?: boolean; is_active?: boolean;
    sort_order?: number; thumbnail_url?: string | null;
  } | undefined;

  const [nights, setNights] = useState<number>(() => saved?.nights ?? init?.nights ?? autoNights);
  const [days, setDays] = useState<number>(() => saved?.days ?? init?.days ?? autoDays);
  const [label, setLabel] = useState<string>(() => saved?.label ?? init?.label ?? autoLabel);
  const [isDefault, setIsDefault] = useState<boolean>(() => saved?.is_default ?? init?.is_default ?? false);
  const [isActive, setIsActive] = useState<boolean>(() => saved?.is_active ?? init?.is_active ?? true);
  const [sortOrder, setSortOrder] = useState<number>(() => saved?.sort_order ?? init?.sort_order ?? 0);
  const [thumbnail, setThumbnail] = useState<string | null>(() =>
    // Use 'in' check so explicit null (user cleared) is preserved, not confused with "unset"
    saved && "thumbnail_url" in saved ? (saved.thumbnail_url ?? null) : (init?.thumbnail_url ?? null)
  );

  // Keep days in sync when nights changes (unless admin has edited days manually)
  const [daysManual, setDaysManual] = useState(false);

  function handleNightsChange(val: number) {
    setNights(val);
    if (!daysManual) setDays(val + 1);
    setLabel(`${daysManual ? days : val + 1}D / ${val}N`);
  }

  function handleDaysChange(val: number) {
    setDaysManual(true);
    setDays(val);
  }

  function resetToAuto() {
    setNights(autoNights);
    setDays(autoDays);
    setLabel(autoLabel);
    setDaysManual(false);
  }

  useEffect(() => {
    setStepData("duration", { days, nights, label, is_default: isDefault, is_active: isActive, sort_order: sortOrder, thumbnail_url: thumbnail });
  }, [days, nights, label, isDefault, isActive, sortOrder, thumbnail, setStepData]);

  const isModified = nights !== autoNights || days !== autoDays;

  return (
    <div className="space-y-5">
      {/* Days / Nights / Label */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Duration</Label>
          {isModified && (
            <button type="button" onClick={resetToAuto}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
              <RotateCcw className="h-3 w-3" /> Reset to auto
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nights</Label>
            <Input type="number" min={0} value={nights}
              onChange={(e) => handleNightsChange(Math.max(0, parseInt(e.target.value) || 0))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Days</Label>
            <Input type="number" min={1} value={days}
              onChange={(e) => handleDaysChange(Math.max(1, parseInt(e.target.value) || 1))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Sort Order</Label>
            <Input type="number" min={0} value={sortOrder}
              onChange={(e) => setSortOrder(Math.max(0, parseInt(e.target.value) || 0))} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Label</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)}
            placeholder={autoLabel} />
          <p className="text-[11px] text-muted-foreground">
            Shown on frontend — e.g. <span className="font-medium">{autoLabel}</span>
          </p>
        </div>
      </div>

      {/* Toggles */}
      <div className="rounded-lg border divide-y">
        <div className="flex items-center justify-between px-3 py-3">
          <div>
            <p className="text-sm font-medium">Default Duration</p>
            <p className="text-xs text-muted-foreground">Pre-selected on the package page</p>
          </div>
          <Switch checked={isDefault} onCheckedChange={setIsDefault} />
        </div>
        <div className="flex items-center justify-between px-3 py-3">
          <div>
            <p className="text-sm font-medium">Active</p>
            <p className="text-xs text-muted-foreground">Hide from frontend if off</p>
          </div>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>
      </div>

      {/* Thumbnail */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Thumbnail</Label>
        <p className="text-xs text-muted-foreground -mt-1">
          Select from the package&apos;s uploaded images
        </p>
        <DBImageSelector
          images={packageImages}
          value={thumbnail}
          onChange={setThumbnail}
          cols={4}
          emptyMessage="No images yet — upload images in the Images tab first."
        />
        {thumbnail && (
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-[10px] gap-1">
              Thumbnail set
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Steps config ───────────────────────────────────────────────────────────

const STEPS: SheetStep[] = [
  {
    id: "stops",
    title: "Stops",
    description: "Add destinations and nights per stop",
    icon: <MapPin className="h-4 w-4" />,
    validate: (data) => {
      const rows = (data.stops as StopRow[] | undefined) ?? [];
      if (!rows.filter((r) => r.location).length) return "Add at least one stop with a location";
      return null;
    },
  },
  {
    id: "meta",
    title: "Route",
    description: "Name and SEO details",
    icon: <Route className="h-4 w-4" />,
    optional: true,
  },
  {
    id: "duration",
    title: "Duration",
    description: "Duration settings and thumbnail",
    icon: <CalendarDays className="h-4 w-4" />,
  },
];

// ── Main Sidebar ───────────────────────────────────────────────────────────

type Props = {
  packageId: number;
  editing: EditingRoute | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  packageImages: SelectableImage[];
};

export function RouteBuilderSidebar({ packageId, editing, open, onClose, onSaved, packageImages }: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const [stops, setStops] = useState<StopRow[]>([{ id: uid(), location: null, stay_nights: 1 }]);

  useEffect(() => {
    if (open) {
      if (editing) {
        setStops(editing.stops.map((s) => ({
          id: uid(),
          stay_nights: s.stay_days,
          location: s.location ? {
            id: s.location.id,
            name: s.place_name,
            type: s.location.type as LocationType,
            breadcrumb: s.place_name,
            slug: s.location.slug,
            latitude: s.location.latitude,
            longitude: s.location.longitude,
          } : null,
        })));
      } else {
        setStops([{ id: uid(), location: null, stay_nights: 1 }]);
      }
    }
  }, [open, editing]);

  const autoName = useMemo(
    () => deriveRouteName(stops.filter((s) => s.location).map((s) => ({ place_name: s.location!.name }))),
    [stops],
  );

  const autoNights = useMemo(() => stops.reduce((s, r) => s + r.stay_nights, 0), [stops]);

  const initialStepData = useMemo((): Record<string, Record<string, unknown>> => {
    if (!editing) return {};
    return {
      stops: { stops },
      meta: { name: editing.name, meta_title: editing.meta_title, meta_desc: editing.meta_desc },
      duration: {
        days: editing.durationDays, nights: editing.durationNights,
        label: editing.durationLabel, is_default: editing.durationIsDefault,
        is_active: editing.durationIsActive, sort_order: editing.durationSortOrder,
        thumbnail_url: editing.durationThumbnail,
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.routeId]);

  async function handleComplete(data: Record<string, unknown>) {
    const rows = (data.stops as StopRow[] | undefined) ?? stops;
    const stopInputs: StopInput[] = rows
      .filter((r) => r.location)
      .map((s) => ({
        place_name: s.location!.name,
        stay_days: s.stay_nights,
        location_id: s.location!.id || null,
      }));

    const meta = data as { name?: string; meta_title?: string | null; meta_desc?: string | null };
    const dur = data as DurationMeta & { thumbnail_url?: string | null };

    const durationMeta: DurationMeta = {
      days: typeof dur.days === "number" ? dur.days : undefined,
      nights: typeof dur.nights === "number" ? dur.nights : undefined,
      label: typeof dur.label === "string" ? dur.label : undefined,
      is_default: typeof dur.is_default === "boolean" ? dur.is_default : undefined,
      is_active: typeof dur.is_active === "boolean" ? dur.is_active : undefined,
      sort_order: typeof dur.sort_order === "number" ? dur.sort_order : undefined,
      thumbnail_url: dur.thumbnail_url ?? null,
    };

    // Guard: if editing and total days would decrease, check for itinerary content
    if (editing) {
      const newAutoNights = stopInputs.reduce((s, r) => s + r.stay_days, 0);
      const newDays = typeof dur.days === "number" ? dur.days : newAutoNights + 1;
      const oldDays = editing.durationDays;

      if (newDays < oldDays) {
        setIsSaving(true);
        const check = await handleCheckItineraryDaysContent(
          packageId, editing.routeId, editing.durationId, newDays + 1, oldDays,
        );
        setIsSaving(false);
        if (!check.success) {
          toast.error(check.message ?? "Failed to verify days");
          return;
        }
        if (check.hasContent) {
          toast.error(
            `Days ${newDays + 1}–${oldDays} have itinerary content. Clear those days in the Itinerary Builder before reducing.`,
          );
          return;
        }
      }
    }

    setIsSaving(true);
    try {
      const res = await handleSaveRouteVariant(
        packageId,
        stopInputs,
        {
          name: meta.name || undefined,
          meta_title: (meta.meta_title as string)?.trim() || null,
          meta_desc: (meta.meta_desc as string)?.trim() || null,
        },
        durationMeta,
        editing?.routeId,
      );

      if (!res.success) { toast.error(res.message); return; }

      // Warn if stop order/nights changed — itinerary day numbers may have shifted
      if (editing) {
        const newAutoNights = stopInputs.reduce((s, r) => s + r.stay_days, 0);
        const newDays = typeof dur.days === "number" ? dur.days : newAutoNights + 1;
        if (newDays !== editing.durationDays) {
          toast.warning("Route saved. Day numbers may have shifted — review the Itinerary Builder.");
        } else {
          toast.success("Route updated");
        }
      } else {
        toast.success("Route created");
      }

      onSaved();
      onClose();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <MultiStepSheet
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={editing ? "Edit Route Variant" : "New Route Variant"}
      description={editing ? `Editing: ${editing.name}` : "Define stops to auto-generate route and duration"}
      steps={STEPS}
      onComplete={handleComplete}
      isSubmitting={isSaving}
      submitLabel={editing ? "Save Changes" : "Create Route"}
      initialStepData={initialStepData}
    >
      {/* Step 1: Stops */}
      <StopsStep stops={stops} setStops={setStops} />

      {/* Step 2: Route Meta */}
      <RouteMetaStep
        autoName={autoName}
        init={{
          name: editing?.name ?? "",
          meta_title: editing?.meta_title ?? "",
          meta_desc: editing?.meta_desc ?? "",
        }}
      />

      {/* Step 3: Duration */}
      <DurationStep
        autoNights={autoNights}
        packageImages={packageImages}
        init={editing ? {
          days: editing.durationDays,
          nights: editing.durationNights,
          label: editing.durationLabel,
          is_default: editing.durationIsDefault,
          is_active: editing.durationIsActive,
          sort_order: editing.durationSortOrder,
          thumbnail_url: editing.durationThumbnail,
        } : undefined}
      />

    </MultiStepSheet>
  );
}
