"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import {
  DndContext,   
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Image from "next/image";
import { Sheet, SheetContent, SheetTitle } from "../../components/ui/sheet";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Badge } from "../../components/ui/badge";
import { Switch } from "../../components/ui/switch";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { SearchSelect, type Option } from "../../components/dashboard/SearchSelect";
import {
  handleUpsertDayMeta,
  handleAddActivity,
  handleUpdateActivity,
  handleDeleteActivity,
  handleAddTransfer,
  handleUpdateTransfer,
  handleDeleteTransfer,
  handleAddNote,
  handleUpdateNote,
  handleDeleteNote,
  handleUpsertStay,
  handleDeleteStay,
  handleUpdateStayActiveMeals,
  handleReorderItems,
  handleSearchActivities,
  handleSearchRoomPricings,
  handleGetRoomPricingById,
  handleGetActivityVariants,
  handleAddAttraction,
  handleBulkAddAttractions,
  handleUpdateAttraction,
  handleDeleteAttraction,
  handleReorderAttractions,
} from "@/app/actions/packages/itinerary-builder.actions";
import type {
  DayData,
  ActivityItem,
  TransferItem,
  NoteItem,
  StayItem,
  AttractionItem,
  AttractionSourceImages,
  ReorderItem,
  ActivityVariantOption,
} from "@/app/services/itinerary-builder.service";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../components/ui/tooltip";
import { handleGetDaySourceImages } from "@/app/actions/packages/itinerary-builder.actions";
import { LocationSearchSelect } from "../../components/location/LocationSearchSelect";
import type { LocationValue, LocationType } from "../../components/location/location.types";
import {
  Loader2,
  Pencil,
  Trash2,
  Plus,
  Car,
  Activity,
  StickyNote,
  X,
  Check,
  Hotel,
  Save,
  ArrowLeft,
  Lock,
  Camera,
  Package,
  Zap,
  ClipboardPaste,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Sun,
  Moon,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/app/lib/utils";
import type { OccupiedBy } from "./ItineraryBuilderTab";

// ── Types ──────────────────────────────────────────────────────────────────

type StayCategory = {
  id: number;
  label: string;
  slug: string;
  min_duration_days: number | null;
  sort_order: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  packageId: number;
  destinationId: number;
  durationId: number;
  routeId: number;
  day: DayData;
  stayCategories: StayCategory[];
  onSaved: (updated: DayData) => void;
  stopLabel?: string;
  stopCoords?: { lat: number; lng: number };
  stopIndex?: number;
  occupiedBy?: OccupiedBy;
  maxNights?: number;
  totalDays: number;
  onNavigateDay: (direction: "prev" | "next") => void;
};

type DndItem =
  | { dndId: string; sortOrder: number; kind: "transfer"; data: TransferItem }
  | { dndId: string; sortOrder: number; kind: "activity"; data: ActivityItem }
  | { dndId: string; sortOrder: number; kind: "note"; data: NoteItem }
  | { dndId: string; sortOrder: number; kind: "stay"; stays: StayItem[] };

type EditPanelState =
  | { mode: "add"; kind: "transfer" | "activity" | "note" }
  | { mode: "stay" }
  | { mode: "edit"; dndId: string }
  | null;

// ── Kind config ────────────────────────────────────────────────────────────

const KIND_CONFIG = {
  transfer: { Icon: Car,        color: "text-blue-600",    chipBg: "bg-blue-50 border-blue-200 hover:bg-blue-100",         chipApplied: "bg-blue-100 border-blue-400",         barColor: "bg-blue-500",    label: "Transfer" },
  activity: { Icon: Activity,   color: "text-emerald-600", chipBg: "bg-emerald-50 border-emerald-200 hover:bg-emerald-100", chipApplied: "bg-emerald-100 border-emerald-400",   barColor: "bg-emerald-500", label: "Activity" },
  note:     { Icon: StickyNote, color: "text-amber-600",   chipBg: "bg-amber-50 border-amber-200 hover:bg-amber-100",       chipApplied: "bg-amber-100 border-amber-400",       barColor: "bg-amber-500",   label: "Note"     },
  stay:     { Icon: Hotel,      color: "text-violet-600",  chipBg: "bg-violet-50 border-violet-200 hover:bg-violet-100",    chipApplied: "bg-violet-100 border-violet-400",     barColor: "bg-violet-500",  label: "Stay"     },
} as const;

// ── Helpers ────────────────────────────────────────────────────────────────

function buildTimeline(
  transfers: TransferItem[],
  activities: ActivityItem[],
  notes: NoteItem[],
  stays: StayItem[],
  stayBlockOrder: number,
): DndItem[] {
  const items: DndItem[] = [
    ...transfers.map((t) => ({ dndId: `transfer-${t.id}`, sortOrder: t.sort_order, kind: "transfer" as const, data: t })),
    ...activities.map((a) => ({ dndId: `activity-${a.id}`, sortOrder: a.sort_order, kind: "activity" as const, data: a })),
    ...notes.map((n) => ({ dndId: `note-${n.id}`, sortOrder: n.sort_order, kind: "note" as const, data: n })),
    { dndId: "stay-block", sortOrder: stayBlockOrder, kind: "stay" as const, stays },
  ];
  return items.sort((a, b) => a.sortOrder - b.sortOrder);
}

function kindFromDndId(dndId: string): keyof typeof KIND_CONFIG {
  if (dndId.startsWith("transfer-")) return "transfer";
  if (dndId.startsWith("activity-")) return "activity";
  if (dndId.startsWith("note-")) return "note";
  return "stay";
}

function editPanelTitle(panel: EditPanelState): string {
  if (!panel) return "";
  if (panel.mode === "stay") return "Hotel Stay";
  if (panel.mode === "add") return `Add ${KIND_CONFIG[panel.kind].label}`;
  const kind = kindFromDndId(panel.dndId);
  return `Edit ${KIND_CONFIG[kind].label}`;
}

// ── Palette chip (draggable) ───────────────────────────────────────────────

function PaletteChip({
  kind,
  disabled,
  isApplied,
  onClick,
}: {
  kind: keyof typeof KIND_CONFIG;
  disabled: boolean;
  isApplied?: boolean;
  onClick: () => void;
}) {
  const { Icon, color, chipBg, chipApplied, label } = KIND_CONFIG[kind];
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette-${kind}`,
    data: { source: "palette", kind },
    disabled,
  });

  return (
    <button
      type="button"
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={cn(
        "relative flex flex-col items-center gap-2 px-4 py-3 rounded-xl border cursor-grab select-none transition-all flex-1",
        isApplied ? chipApplied : chipBg,
        isDragging && "opacity-40 scale-95 cursor-grabbing shadow-lg",
        disabled && "opacity-40 cursor-not-allowed pointer-events-none",
      )}
      onClick={onClick}
      {...listeners}
      {...attributes}
    >
      {isApplied && (
        <span className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-green-500 flex items-center justify-center shadow-sm">
          <Check className="h-2.5 w-2.5 text-white" />
        </span>
      )}
      <Icon className={cn("h-5 w-5", color)} />
      <span className={cn("text-[10px] font-bold uppercase tracking-widest", color)}>{label}</span>
    </button>
  );
}

// ── Sortable row ───────────────────────────────────────────────────────────

function SortableRow({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="group cursor-grab active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

// ── Timeline row card ──────────────────────────────────────────────────────

function TimelineRowCard({
  kind,
  isActive,
  onEdit,
  onDelete,
  deletePending,
  children,
}: {
  kind: keyof typeof KIND_CONFIG;
  isActive: boolean;
  onEdit: () => void;
  onDelete?: () => void;
  deletePending: boolean;
  children: React.ReactNode;
}) {
  const { barColor } = KIND_CONFIG[kind];
  return (
    <div className={cn(
      "flex items-stretch rounded-xl border bg-white overflow-hidden transition-all duration-150",
      isActive ? "ring-2 ring-primary/50 border-primary/20 shadow-sm" : "hover:shadow-sm hover:border-neutral-200",
    )}>
      <div className={cn("w-1 shrink-0", barColor)} />
      <div className="flex-1 flex items-center gap-3 py-2.5 px-3 min-w-0">
        <div className="flex-1 min-w-0">{children}</div>
        <div className={cn(
          "flex items-center gap-0.5 shrink-0 transition-opacity",
          isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}>
          <Button
            size="sm" variant="ghost"
            className={cn("h-7 w-7 p-0 rounded-lg", isActive && "bg-primary/10 text-primary hover:bg-primary/20")}
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {onDelete && (
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg hover:text-destructive hover:bg-destructive/10"
              onClick={(e) => { e.stopPropagation(); onDelete(); }} disabled={deletePending}
            >
              {deletePending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Transfer form helpers ──────────────────────────────────────────────────

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function useRoadDistance(pickup: LocationValue | null, drop: LocationValue | null) {
  const [roadKm, setRoadKm] = useState<number | null>(null);
  const [roadMin, setRoadMin] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const lat1 = pickup?.latitude, lng1 = pickup?.longitude;
    const lat2 = drop?.latitude, lng2 = drop?.longitude;
    if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) {
      setRoadKm(null);
      setRoadMin(null);
      return;
    }
    const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!TOKEN) {
      setRoadKm(Math.round(haversineKm(lat1, lng1, lat2, lng2)));
      setRoadMin(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${lng1},${lat1};${lng2},${lat2}?access_token=${TOKEN}&geometries=geojson&overview=false&steps=false`,
    )
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const route = data.routes?.[0];
        if (route) {
          setRoadKm(Math.round(route.distance / 1000));
          setRoadMin(Math.round(route.duration / 60));
        } else {
          setRoadKm(Math.round(haversineKm(lat1, lng1, lat2, lng2)));
          setRoadMin(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRoadKm(Math.round(haversineKm(lat1, lng1, lat2, lng2)));
          setRoadMin(null);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [pickup?.latitude, pickup?.longitude, drop?.latitude, drop?.longitude]);

  return { roadKm, roadMin, loading };
}

type TransferFormData = {
  pickup: LocationValue | null;
  drop: LocationValue | null;
  notes: string;
};

function transferFormToInput(data: TransferFormData) {
  return {
    pickup_name: data.pickup?.name ?? "",
    pickup_location_id: data.pickup?.id ?? null,
    pickup_lat: data.pickup?.latitude ?? null,
    pickup_lng: data.pickup?.longitude ?? null,
    drop_name: data.drop?.name ?? "",
    drop_location_id: data.drop?.id ?? null,
    drop_lat: data.drop?.latitude ?? null,
    drop_lng: data.drop?.longitude ?? null,
    vehicle_id: null,
    num_vehicles: 1,
    notes: data.notes || null,
  };
}

// ── Edit forms ─────────────────────────────────────────────────────────────

function TransferEditForm({
  item,
  pending,
  onSave,
  onCancel,
  onDelete,
  stopCoords,
}: {
  item: TransferItem;
  pending: boolean;
  onSave: (data: TransferFormData) => void;
  onCancel: () => void;
  onDelete: () => void;
  stopCoords?: { lat: number; lng: number };
}) {
  const [form, setForm] = useState<TransferFormData>({
    pickup: item.route
      ? {
          id: item.route.pickup_location_id ?? "",
          name: item.route.pickup_name,
          type: (item.route.pickup_location_type ?? "CITY") as LocationType,
          breadcrumb: item.route.pickup_name,
          slug: "",
          latitude: item.route.pickup_lat ?? undefined,
          longitude: item.route.pickup_lng ?? undefined,
        }
      : null,
    drop: item.route
      ? {
          id: item.route.drop_location_id ?? "",
          name: item.route.drop_name,
          type: (item.route.drop_location_type ?? "CITY") as LocationType,
          breadcrumb: item.route.drop_name,
          slug: "",
          latitude: item.route.drop_lat ?? undefined,
          longitude: item.route.drop_lng ?? undefined,
        }
      : null,
    notes: item.notes ?? "",
  });

  const isValid = !!form.pickup && !!form.drop;

  const { roadKm: distKm, roadMin: distMin, loading: distLoading } = useRoadDistance(form.pickup, form.drop);
  const displayKm = distKm ?? (distLoading ? (item.route?.distance_km ?? null) : null);
  const displayMin = distMin ?? (distLoading ? (item.route?.duration_min ?? null) : null);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Pickup Location <span className="text-destructive">*</span></Label>
        <LocationSearchSelect value={form.pickup} onChange={(v) => setForm(f => ({ ...f, pickup: v }))} placeholder="Search pickup point…" mapCenter={stopCoords} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Drop Location <span className="text-destructive">*</span></Label>
        <LocationSearchSelect value={form.drop} onChange={(v) => setForm(f => ({ ...f, drop: v }))} placeholder="Search drop point…" mapCenter={stopCoords} />
      </div>
      {(displayKm != null || distLoading) && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
          {distLoading && displayKm == null
            ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            : <Car className="h-3.5 w-3.5 shrink-0" />}
          {displayKm != null && (
            <>
              <span>{displayKm} km by road</span>
              {displayMin != null && (
                <span className="text-muted-foreground/60">
                  · ~{Math.floor(displayMin / 60)}h{displayMin % 60 > 0 ? ` ${displayMin % 60}m` : ""}
                </span>
              )}
            </>
          )}
        </div>
      )}
      <div className="space-y-1.5">
        <Label className="text-xs">Notes</Label>
        <Input value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} className="h-9 text-xs" placeholder="Optional note…" />
      </div>
      <div className="flex items-center justify-between pt-2">
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5" onClick={onDelete} disabled={pending}>
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onCancel} disabled={pending}>Cancel</Button>
          <Button size="sm" onClick={() => onSave(form)} disabled={pending || !isValid} className="gap-1.5">
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

function ActivityEditForm({
  item,
  pending,
  destinationId,
  onToggleOptional,
  onChangeVariant,
  onChangeActivity,
  onCancel,
  onDelete,
}: {
  item: ActivityItem;
  pending: boolean;
  destinationId: number;
  onToggleOptional: (val: boolean) => void;
  onChangeVariant: (variantId: number | null) => void;
  onChangeActivity: (activityId: number, variantId: number | null) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [variants, setVariants] = useState<ActivityVariantOption[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  const [newActivityId, setNewActivityId] = useState<number | null>(null);
  const [newVariants, setNewVariants] = useState<ActivityVariantOption[]>([]);
  const [newVariantId, setNewVariantId] = useState<number | null>(null);
  const [loadingNewVariants, setLoadingNewVariants] = useState(false);

  useEffect(() => {
    setLoadingVariants(true);
    handleGetActivityVariants(item.activity.id).then((res) => {
      setLoadingVariants(false);
      if (res.success) setVariants(res.data);
    });
  }, [item.activity.id]);

  const fetchActivities = useCallback(async (query: string): Promise<Option[]> => {
    const res = await handleSearchActivities(destinationId, query);
    if (!res.success) return [];
    const items: Option[] = res.data.items.map((a) => ({
      id: a.id,
      label: a.name,
      description: [
        a.category,
        a.duration_hours != null ? `${a.duration_hours}h` : null,
        !a.has_pricing ? "⚠ No pricing set" : null,
      ].filter(Boolean).join(" · "),
    }));
    if (res.data.has_more) items.push({ id: -1, label: "Showing top 20 — refine search to see more" });
    return items;
  }, [destinationId]);

  async function handleNewActivitySelect(id: number | null) {
    setNewActivityId(id);
    setNewVariants([]);
    setNewVariantId(null);
    if (!id) return;
    setLoadingNewVariants(true);
    const res = await handleGetActivityVariants(id);
    setLoadingNewVariants(false);
    if (!res.success) return;
    setNewVariants(res.data);
    if (res.data.length === 1) setNewVariantId(res.data[0].id);
  }

  return (
    <div className="space-y-4">
      {!isChanging ? (
        <div className="rounded-xl border bg-muted/30 p-3 flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium">{item.activity.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {[item.activity.category, item.activity.duration_hours != null ? `${item.activity.duration_hours}h` : null].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsChanging(true)}
            disabled={pending}
            className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
          >
            <Pencil className="h-3 w-3" /> Change
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Select New Activity <span className="text-destructive">*</span></Label>
              <button
                type="button"
                onClick={() => { setIsChanging(false); setNewActivityId(null); setNewVariants([]); setNewVariantId(null); }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
            <SearchSelect value={newActivityId} onChange={handleNewActivitySelect} fetchOptions={fetchActivities} placeholder="Search activities…" />
          </div>
          {newActivityId && (
            <div className="space-y-1.5">
              <Label className="text-xs">Pricing Variant</Label>
              {loadingNewVariants ? (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1"><Loader2 className="h-3 w-3 animate-spin" /> Loading variants…</p>
              ) : newVariants.length === 0 ? (
                <p className="text-xs text-muted-foreground/60 italic mt-1">No variants — will price at ₹0</p>
              ) : (
                <Select value={newVariantId ? String(newVariantId) : "none"} onValueChange={(v) => setNewVariantId(v === "none" ? null : Number(v))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select variant…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No variant (₹0)</SelectItem>
                    {newVariants.map((v) => {
                      const adultTier = v.pricingTiers.find((t) => t.label.toLowerCase().includes("adult")) ?? v.pricingTiers[0];
                      return <SelectItem key={v.id} value={String(v.id)}>{v.name}{adultTier ? ` · ₹${adultTier.price}` : ""}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
          {newActivityId && (
            <Button size="sm" onClick={() => onChangeActivity(newActivityId, newVariantId)} disabled={pending} className="w-full gap-1.5">
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Confirm Change
            </Button>
          )}
        </div>
      )}

      {!isChanging && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Pricing Variant</Label>
            {loadingVariants ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1"><Loader2 className="h-3 w-3 animate-spin" /> Loading variants…</p>
            ) : variants.length === 0 ? (
              <p className="text-xs text-muted-foreground/60 italic mt-1">No variants — will price at ₹0</p>
            ) : (
              <Select value={item.variant_id ? String(item.variant_id) : "none"} onValueChange={(v) => onChangeVariant(v === "none" ? null : Number(v))} disabled={pending}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select variant…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No variant (₹0)</SelectItem>
                  {variants.map((v) => {
                    const adultTier = v.pricingTiers.find((t) => t.label.toLowerCase().includes("adult")) ?? v.pricingTiers[0];
                    return <SelectItem key={v.id} value={String(v.id)}>{v.name}{adultTier ? ` · ₹${adultTier.price}` : ""}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Switch id={`optional-${item.id}`} checked={item.is_optional} onCheckedChange={onToggleOptional} disabled={pending} />
            <Label htmlFor={`optional-${item.id}`} className="text-sm">Mark as optional activity</Label>
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
        </>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5" onClick={onDelete} disabled={pending}>
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Done</Button>
      </div>
    </div>
  );
}

function NoteEditForm({
  item,
  pending,
  onSave,
  onCancel,
  onDelete,
}: {
  item: NoteItem;
  pending: boolean;
  onSave: (data: { message: string; type: string; position: string; optional_link_text: string; optional_link_url: string }) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [message, setMessage] = useState(item.message);
  const [type, setType] = useState(item.type);
  const [position, setPosition] = useState(item.position);
  const [linkText, setLinkText] = useState(item.optional_link_text ?? "");
  const [linkUrl, setLinkUrl] = useState(item.optional_link_url ?? "");

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Message</Label>
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} className="text-sm min-h-20 resize-none" placeholder="Enter note message…" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="success">Success</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Position</Label>
          <Select value={position} onValueChange={setPosition}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="top">Top</SelectItem>
              <SelectItem value="bottom">Bottom</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Link Text (optional)</Label>
          <Input value={linkText} onChange={(e) => setLinkText(e.target.value)} className="h-9 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Link URL (optional)</Label>
          <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className="h-9 text-xs" />
        </div>
      </div>
      <div className="flex items-center justify-between pt-2">
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5" onClick={onDelete} disabled={pending}>
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onCancel} disabled={pending}>Cancel</Button>
          <Button size="sm" onClick={() => onSave({ message, type, position, optional_link_text: linkText, optional_link_url: linkUrl })} disabled={pending || !message.trim()} className="gap-1.5">
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Add forms ──────────────────────────────────────────────────────────────

function AddTransferForm({
  pending, onSave, onCancel, stopCoords,
}: {
  pending: boolean;
  onSave: (data: TransferFormData) => void;
  onCancel: () => void;
  stopCoords?: { lat: number; lng: number };
}) {
  const [form, setForm] = useState<TransferFormData>({
    pickup: null, drop: null, notes: "",
  });
  const isValid = !!form.pickup && !!form.drop;

  const { roadKm, roadMin, loading: distLoading } = useRoadDistance(form.pickup, form.drop);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Pickup Location <span className="text-destructive">*</span></Label>
        <LocationSearchSelect value={form.pickup} onChange={(v) => setForm(f => ({ ...f, pickup: v }))} placeholder="Search pickup point…" mapCenter={stopCoords} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Drop Location <span className="text-destructive">*</span></Label>
        <LocationSearchSelect value={form.drop} onChange={(v) => setForm(f => ({ ...f, drop: v }))} placeholder="Search drop point…" mapCenter={stopCoords} />
      </div>
      {(roadKm != null || distLoading) && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
          {distLoading && roadKm == null
            ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            : <Car className="h-3.5 w-3.5 shrink-0" />}
          {roadKm != null && (
            <>
              <span>{roadKm} km by road</span>
              {roadMin != null && (
                <span className="text-muted-foreground/60">
                  · ~{Math.floor(roadMin / 60)}h{roadMin % 60 > 0 ? ` ${roadMin % 60}m` : ""}
                </span>
              )}
            </>
          )}
        </div>
      )}
      <div className="space-y-1.5">
        <Label className="text-xs">Notes</Label>
        <Input value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} className="h-9 text-xs" placeholder="Optional note…" />
      </div>
      <div className="flex gap-2 pt-2 justify-end">
        <Button size="sm" variant="outline" onClick={onCancel} disabled={pending}>Cancel</Button>
        <Button size="sm" onClick={() => onSave(form)} disabled={pending || !isValid} className="gap-1.5">
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Add Transfer
        </Button>
      </div>
    </div>
  );
}

type ActivityListItem = {
  id: number;
  name: string;
  category: string | null;
  duration_hours: number | null;
  has_pricing: boolean;
};

function AddActivityForm({
  destinationId, stopPlaceName, pending, onSave, onCancel,
}: {
  destinationId: number;
  stopPlaceName?: string;
  pending: boolean;
  onSave: (activityId: number, isOptional: boolean, variantId: number | null) => void;
  onCancel: () => void;
}) {
  const [activityId, setActivityId] = useState<number | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<ActivityListItem | null>(null);
  const [isOptional, setIsOptional] = useState(false);
  const [variants, setVariants] = useState<ActivityVariantOption[]>([]);
  const [variantId, setVariantId] = useState<number | null>(null);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [searchQuery, setSearchQuery] = useState(stopPlaceName ?? "");
  const [allActivities, setAllActivities] = useState<ActivityListItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [hasMore, setHasMore] = useState(false);

  // Load immediately on mount, debounce on typed search
  useEffect(() => {
    let cancelled = false;
    const delay = searchQuery ? 300 : 0;
    const timer = setTimeout(async () => {
      setLoadingList(true);
      const res = await handleSearchActivities(destinationId, searchQuery);
      if (cancelled) return;
      setLoadingList(false);
      if (!res.success) return;
      setAllActivities(res.data.items);
      setHasMore(res.data.has_more);
    }, delay);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [searchQuery, destinationId]);

  async function handleActivitySelect(item: ActivityListItem) {
    setActivityId(item.id);
    setSelectedActivity(item);
    setVariants([]);
    setVariantId(null);
    setLoadingVariants(true);
    const res = await handleGetActivityVariants(item.id);
    setLoadingVariants(false);
    if (!res.success) return;
    setVariants(res.data);
    if (res.data.length === 1) setVariantId(res.data[0].id);
  }

  return (
    <div className="space-y-4">
      {/* Activity picker */}
      <div className="space-y-2">
        <Label className="text-xs">Activity <span className="text-destructive">*</span></Label>

        {/* Search input */}
        <div className="relative">
          <Activity className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search activities…"
            className="h-9 text-xs pl-8 pr-8"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Selected activity badge */}
        {selectedActivity && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
            <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-emerald-800 truncate">{selectedActivity.name}</p>
              <p className="text-[10px] text-emerald-600/70">
                {[selectedActivity.category, selectedActivity.duration_hours != null ? `${selectedActivity.duration_hours}h` : null].filter(Boolean).join(" · ")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setActivityId(null); setSelectedActivity(null); setVariants([]); setVariantId(null); }}
              className="text-emerald-500 hover:text-emerald-700 shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Activity list */}
        <div className="rounded-xl border overflow-hidden">
          {loadingList ? (
            <div className="flex items-center justify-center py-6 gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading activities…
            </div>
          ) : allActivities.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              No activities found
            </div>
          ) : (
            <div className="max-h-56 overflow-y-auto divide-y">
              {allActivities.map((item) => {
                const isSelected = activityId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleActivitySelect(item)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 flex items-start gap-2.5 transition-colors",
                      isSelected
                        ? "bg-emerald-50 border-l-2 border-l-emerald-500"
                        : "hover:bg-muted/50",
                    )}
                  >
                    <div className={cn(
                      "mt-0.5 h-3.5 w-3.5 rounded-full border-2 shrink-0 flex items-center justify-center",
                      isSelected ? "border-emerald-500 bg-emerald-500" : "border-muted-foreground/30",
                    )}>
                      {isSelected && <Check className="h-2 w-2 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium leading-snug truncate">{item.name}</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                        {[
                          item.category,
                          item.duration_hours != null ? `${item.duration_hours}h` : null,
                          !item.has_pricing ? "⚠ No pricing" : null,
                        ].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </button>
                );
              })}
              {hasMore && (
                <p className="px-3 py-2 text-[10px] text-muted-foreground/60 text-center bg-muted/30">
                  Showing top 20 — type to refine search
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {activityId && (
        <div className="space-y-1.5">
          <Label className="text-xs">Pricing Variant</Label>
          {loadingVariants ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1"><Loader2 className="h-3 w-3 animate-spin" /> Loading variants…</p>
          ) : variants.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 italic mt-1">No variants — will price at ₹0</p>
          ) : (
            <Select value={variantId ? String(variantId) : "none"} onValueChange={(v) => setVariantId(v === "none" ? null : Number(v))}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select variant…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No variant (₹0)</SelectItem>
                {variants.map((v) => {
                  const adultTier = v.pricingTiers.find((t) => t.label.toLowerCase().includes("adult")) ?? v.pricingTiers[0];
                  return <SelectItem key={v.id} value={String(v.id)}>{v.name}{adultTier ? ` · ₹${adultTier.price}` : ""}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
      <div className="flex items-center gap-3">
        <Switch id="add-optional" checked={isOptional} onCheckedChange={setIsOptional} />
        <Label htmlFor="add-optional" className="text-sm">Mark as optional</Label>
      </div>
      <div className="flex gap-2 pt-2 justify-end">
        <Button size="sm" variant="outline" onClick={onCancel} disabled={pending}>Cancel</Button>
        <Button size="sm" onClick={() => activityId && onSave(activityId, isOptional, variantId)} disabled={pending || !activityId} className="gap-1.5">
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Add Activity
        </Button>
      </div>
    </div>
  );
}

function AddNoteForm({
  pending, onSave, onCancel,
}: {
  pending: boolean;
  onSave: (data: { message: string; type: string; position: string; optional_link_text: string; optional_link_url: string }) => void;
  onCancel: () => void;
}) {
  const [message, setMessage] = useState("");
  const [type, setType] = useState("info");
  const [position, setPosition] = useState("bottom");
  const [linkText, setLinkText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Message <span className="text-destructive">*</span></Label>
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} className="text-sm min-h-20 resize-none" placeholder="Enter note message…" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="success">Success</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Position</Label>
          <Select value={position} onValueChange={setPosition}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="top">Top</SelectItem>
              <SelectItem value="bottom">Bottom</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Link Text (optional)</Label>
          <Input value={linkText} onChange={(e) => setLinkText(e.target.value)} className="h-9 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Link URL (optional)</Label>
          <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className="h-9 text-xs" />
        </div>
      </div>
      <div className="flex gap-2 pt-2 justify-end">
        <Button size="sm" variant="outline" onClick={onCancel} disabled={pending}>Cancel</Button>
        <Button size="sm" onClick={() => onSave({ message, type, position, optional_link_text: linkText, optional_link_url: linkUrl })} disabled={pending || !message.trim()} className="gap-1.5">
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Add Note
        </Button>
      </div>
    </div>
  );
}

// ── Stay block ─────────────────────────────────────────────────────────────

function StayBlock({
  stays, stayCategories, itineraryId, stayBlockOrder, packageId, destinationId, pending, currentDay, maxNights, stopIndex, onStaysChange,
}: {
  stays: StayItem[];
  stayCategories: StayCategory[];
  itineraryId: number | null;
  stayBlockOrder: number;
  packageId: number;
  destinationId: number;
  pending: boolean;
  currentDay: number;
  maxNights: number;
  stopIndex?: number;
  onStaysChange: (stays: StayItem[]) => void;
}) {
  const [assigningCategoryId, setAssigningCategoryId] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  // Single shared num_nights — clamped to stop boundary
  const [numNights, setNumNights] = useState<number>(
    Math.min(stays[0]?.num_nights ?? 1, Math.max(1, maxNights)),
  );

  const R2_BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!;
  const fetchRooms = useCallback(async (query: string): Promise<Option[]> => {
    const res = await handleSearchRoomPricings(destinationId, query, itineraryId ?? undefined, stayBlockOrder, stopIndex);
    if (!res.success) return [];
    const items: Option[] = res.data.items.map((p) => {
      const hotelType = [p.hotel.category, p.hotel.stay_type].filter(Boolean).join(" · ");
      const roomImg = p.room?.images?.[0];
      const imgKey = roomImg ? (roomImg.thumbnail ?? roomImg.url) : p.hotel.thumbnail;
      return {
        id: p.id,
        label: `${p.hotel.name}${p.room ? ` — ${p.room.name}` : ""}`,
        description: [hotelType, p.room?.bed_type, p.plan_name ?? "Standard", `₹${p.price_per_night.toLocaleString("en-IN")}/night`].filter(Boolean).join(" · "),
        thumbnail: imgKey ? `${R2_BASE}/${imgKey}` : "",
      };
    });
    if (res.data.has_more) items.push({ id: -1, label: "Showing top 50 — refine search to see more" });
    return items;
  }, [destinationId, itineraryId, stayBlockOrder, stopIndex, R2_BASE]);

  async function handleAssign(categoryId: number, roomPricingId: number) {
    if (!itineraryId) return;
    setSavingId(categoryId);
    const [saveRes, pricingRes] = await Promise.all([
      handleUpsertStay(itineraryId, categoryId, roomPricingId, stayBlockOrder, packageId, numNights),
      handleGetRoomPricingById(roomPricingId),
    ]);
    setSavingId(null);
    if (!saveRes.success) { toast.error(saveRes.message); return; }
    const pricing = pricingRes.data;
    if (!pricing) { toast.success("Stay saved"); setAssigningCategoryId(null); return; }
    const category = stayCategories.find((c) => c.id === categoryId)!;
    const existing = stays.find((s) => s.stay_category_id === categoryId);
    const newStay: StayItem = {
      id: saveRes.id,
      stay_category_id: categoryId,
      sort_order: stayBlockOrder,
      num_nights: numNights,
      active_meals: existing?.active_meals ?? [],
      room_pricing: pricing,
      stay_category: category,
    };
    onStaysChange(existing ? stays.map((s) => (s.stay_category_id === categoryId ? newStay : s)) : [...stays, newStay]);
    setAssigningCategoryId(null);
    toast.success("Stay assigned");
  }

  async function handleUpdateNights(newNights: number) {
    setNumNights(newNights);
    // Update all already-assigned stays with new num_nights
    if (!itineraryId || stays.length === 0) return;
    setSavingId(-1);
    await Promise.all(
      stays.map((s) =>
        handleUpsertStay(itineraryId, s.stay_category_id, s.room_pricing.id, stayBlockOrder, packageId, newNights),
      ),
    );
    setSavingId(null);
    onStaysChange(stays.map((s) => ({ ...s, num_nights: newNights })));
    toast.success(`Stay updated to ${newNights} night${newNights !== 1 ? "s" : ""}`);
  }

  async function handleRemove(stay: StayItem) {
    setSavingId(stay.stay_category_id);
    const res = await handleDeleteStay(stay.id, packageId);
    setSavingId(null);
    if (!res.success) { toast.error(res.message); return; }
    onStaysChange(stays.filter((s) => s.id !== stay.id));
    toast.success("Stay removed");
  }

  // Coverage preview: "Covers Day 1, 2, 3"
  const coverageDays = Array.from({ length: numNights }, (_, i) => currentDay + i);

  if (stayCategories.length === 0) {
    return <p className="text-sm text-muted-foreground/60 italic">No stay categories configured for this package.</p>;
  }

  // Departure day — last day of the last stop, no overnight stay possible
  if (maxNights === 0) {
    return (
      <div className="rounded-xl border border-muted-foreground/20 bg-muted/30 p-5 text-center space-y-1">
        <p className="text-sm font-medium text-muted-foreground">Departure Day</p>
        <p className="text-xs text-muted-foreground/70">This is the last day of the trip — no overnight stay is needed.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Nights selector */}
      <div className="rounded-xl border bg-violet-50/60 border-violet-200 p-3 space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-violet-800">Number of Nights</p>
            <p className="text-[10px] text-violet-600/70 mt-0.5">
              Max {maxNights} night{maxNights !== 1 ? "s" : ""} — limited to this stop&apos;s remaining days
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="sm" variant="outline"
              className="h-7 w-7 p-0 rounded-lg border-violet-200 hover:bg-violet-100"
              disabled={numNights <= 1 || savingId === -1}
              onClick={() => handleUpdateNights(numNights - 1)}
            >−</Button>
            <span className="w-8 text-center text-sm font-bold text-violet-800">{numNights}</span>
            <Button
              size="sm" variant="outline"
              className="h-7 w-7 p-0 rounded-lg border-violet-200 hover:bg-violet-100"
              disabled={numNights >= maxNights || savingId === -1}
              onClick={() => handleUpdateNights(numNights + 1)}
            >+</Button>
          </div>
        </div>
        {/* Coverage badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-violet-600/70">Covers:</span>
          {coverageDays.map((d) => (
            <span key={d} className="text-[10px] bg-violet-200/70 text-violet-800 font-semibold px-1.5 py-0.5 rounded-md">
              Day {d}
            </span>
          ))}
          {savingId === -1 && <Loader2 className="h-3 w-3 animate-spin text-violet-500" />}
        </div>
      </div>

      {/* Per-category room assignments */}
      <div className="space-y-3">
        {stayCategories.map((cat) => {
          const stay = stays.find((s) => s.stay_category_id === cat.id);
          const isAssigning = assigningCategoryId === cat.id;
          const isSaving = savingId === cat.id;

          return (
            <div key={cat.id} className={cn("rounded-xl border p-3", stay ? "bg-muted/20" : "bg-amber-50/60 border-amber-200")}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{cat.label}</span>
                  {!stay && !isAssigning && (
                    <span className="text-[9px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded">
                      Not assigned
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {stay && !isAssigning && (
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground/50 hover:text-primary" onClick={() => setAssigningCategoryId(cat.id)} title="Change">
                      <Pencil className="h-3 w-3" />
                    </Button>
                  )}
                  {stay && !isAssigning && (
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground/50 hover:text-destructive" onClick={() => handleRemove(stay)} disabled={isSaving || !itineraryId}>
                      {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                    </Button>
                  )}
                  {isAssigning && (
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground" onClick={() => setAssigningCategoryId(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
              {isAssigning ? (
                <div>
                  <SearchSelect fetchOptions={fetchRooms} placeholder="Search hotel / room…" onChange={(id) => { if (id) handleAssign(cat.id, id); }} />
                  {isSaving && <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Saving…</p>}
                </div>
              ) : stay ? (
                (() => {
                  const rp = stay.room_pricing;
                  const roomImg = rp.room?.images?.[0];
                  const imgKey = roomImg ? (roomImg.thumbnail ?? roomImg.url) : rp.hotel.thumbnail;
                  const R2_BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!;
                  return (
                    <div className="flex items-start gap-3">
                      {imgKey ? (
                        <Image
                          src={`${R2_BASE}/${imgKey}`}
                          alt={rp.hotel.name}
                          width={64}
                          height={48}
                          className="h-12 w-16 rounded-lg object-cover shrink-0 border"
                        />
                      ) : (
                        <div className="h-12 w-16 rounded-lg bg-muted border flex items-center justify-center shrink-0">
                          <Hotel className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-snug">{rp.hotel.name}</p>
                        {(rp.hotel.category || rp.hotel.stay_type) && (
                          <p className="text-[10px] font-medium text-violet-600/80">
                            {[rp.hotel.category, rp.hotel.stay_type].filter(Boolean).join(" · ")}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {[rp.room?.name, rp.room?.bed_type, rp.plan_name ?? "Standard"].filter(Boolean).join(" · ")}
                        </p>
                        <p className="text-xs font-medium text-primary/80 mt-0.5">
                          ₹{rp.price_per_night.toLocaleString("en-IN")}/night
                        </p>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <button
                  type="button"
                  className="text-sm text-primary/70 hover:text-primary flex items-center gap-1.5 disabled:opacity-50"
                  onClick={() => setAssigningCategoryId(cat.id)}
                  disabled={!itineraryId || pending}
                >
                  <Plus className="h-3.5 w-3.5" /> Assign hotel
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Attractions modal ──────────────────────────────────────────────────────

const R2 = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!;
const MAX_ATTRACTIONS = 8;

type AttractionSourceKey = "PACKAGE" | "HOTEL" | "ACTIVITY";

const SOURCE_TABS: { key: AttractionSourceKey; label: string; Icon: React.ElementType }[] = [
  { key: "PACKAGE",  label: "Package",  Icon: Package  },
  { key: "HOTEL",    label: "Hotel",    Icon: Hotel    },
  { key: "ACTIVITY", label: "Activity", Icon: Zap      },
];

function AttractionsModal({
  open,
  onClose,
  itineraryId,
  packageId,
  attractions,
  onAttractionsChange,
  hasStay,
  hasActivity,
}: {
  open: boolean;
  onClose: () => void;
  itineraryId: number;
  packageId: number;
  attractions: AttractionItem[];
  onAttractionsChange: (updated: AttractionItem[]) => void;
  hasStay: boolean;
  hasActivity: boolean;
}) {
  const [sourceImages, setSourceImages] = useState<AttractionSourceImages | null>(null);
  const [loadingImages, setLoadingImages] = useState(false);
  const [activeSource, setActiveSource] = useState<AttractionSourceKey>("PACKAGE");
  const [addingUrl, setAddingUrl] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Caption editing state — map of id → draft caption
  const [editCaptions, setEditCaptions] = useState<Record<number, string>>(
    () => Object.fromEntries(attractions.map((a) => [a.id, a.caption])),
  );
  const [savingAll, setSavingAll] = useState(false);

  // Sync newly-added attractions into the caption map
  useEffect(() => {
    setEditCaptions((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const a of attractions) {
        if (!(a.id in next)) { next[a.id] = a.caption; changed = true; }
      }
      return changed ? next : prev;
    });
  }, [attractions]);

  useEffect(() => {
    if (!open || sourceImages) return;
    setLoadingImages(true);
    handleGetDaySourceImages(itineraryId, packageId).then((res) => {
      setLoadingImages(false);
      if (res.success) setSourceImages(res.data);
      else toast.error(res.message ?? "Failed to load images");
    });
  }, [open, itineraryId, packageId, sourceImages]);

  // Keys of already-added attractions — used to hide them from the picker
  const addedKeys = new Set(attractions.map((a) => a.image_key));

  const allImages = sourceImages?.[activeSource] ?? [];
  // Filter out images already added so they can't be selected again
  const images = allImages.filter((img) => !addedKeys.has(img.url));
  const grouped = images.reduce<Record<string, typeof images[0][]>>((acc, img) => {
    (acc[img.group_label] ??= []).push(img);
    return acc;
  }, {});

  async function handleAddOne(imageKey: string) {
    if (addingUrl || atLimit) return;
    setAddingUrl(imageKey);
    const res = await handleBulkAddAttractions(itineraryId, [imageKey], packageId);
    setAddingUrl(null);
    if (!res.success) { toast.error(res.message ?? "Failed to add attraction"); return; }
    onAttractionsChange([...attractions, ...res.data]);
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    const res = await handleDeleteAttraction(id, packageId);
    setDeletingId(null);
    if (!res.success) { toast.error(res.message); return; }
    onAttractionsChange(attractions.filter((a) => a.id !== id));
    toast.success("Removed");
  }

  // Changed captions = attractions whose draft differs from committed value
  const changedCaptions = attractions.filter(
    (a) => (editCaptions[a.id] ?? "").trim() !== a.caption,
  );
  const hasUnsavedCaptions = changedCaptions.length > 0;

  async function handleSaveAll() {
    if (!hasUnsavedCaptions || savingAll) return;
    setSavingAll(true);
    const results = await Promise.all(
      changedCaptions.map((a) =>
        handleUpdateAttraction(a.id, (editCaptions[a.id] ?? "").trim(), packageId).then(
          (res) => ({ id: a.id, caption: (editCaptions[a.id] ?? "").trim(), res }),
        ),
      ),
    );
    setSavingAll(false);
    const failed = results.filter((r) => !r.res.success);
    if (failed.length) {
      toast.error(`Failed to save ${failed.length} caption(s)`);
    }
    const saved = results.filter((r) => r.res.success);
    if (saved.length) {
      onAttractionsChange(
        attractions.map((a) => {
          const s = saved.find((r) => r.id === a.id);
          return s ? { ...a, caption: s.caption } : a;
        }),
      );
      toast.success(`${saved.length} caption(s) saved`);
    }
  }

  const atLimit = attractions.length >= MAX_ATTRACTIONS;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Camera className="h-4 w-4 text-primary" />
            Attractions
            <span className="text-xs text-muted-foreground font-normal">
              {attractions.length}/{MAX_ATTRACTIONS}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-0 max-h-[70vh] overflow-hidden">

          {/* Warning if no stay and no activity */}
          {!hasStay && !hasActivity && (
            <div className="mx-5 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Add a hotel stay or activity to this day first — their images will appear in the Hotel and Activity tabs.
            </div>
          )}

          {/* Existing attractions — editable grid with caption inputs */}
          {attractions.length > 0 && (
            <div className="px-5 py-3 border-b">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2.5">
                Added ({attractions.length}/{MAX_ATTRACTIONS})
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {attractions.map((a) => (
                  <div key={a.id} className="flex flex-col">
                    {/* Thumbnail + delete button */}
                    <div className="relative group">
                      <div className="aspect-video rounded-lg overflow-hidden border bg-muted">
                        <img
                          src={`${R2}/${a.image_key}`}
                          alt={editCaptions[a.id] ?? a.caption}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDelete(a.id)}
                        disabled={deletingId === a.id}
                        className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                      >
                        {deletingId === a.id
                          ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                          : <X className="h-2.5 w-2.5" />}
                      </button>
                    </div>
                    {/* Caption inline input */}
                    {(() => {
                      const isDirty = (editCaptions[a.id] ?? "").trim() !== a.caption;
                      return (
                        <input
                          type="text"
                          value={editCaptions[a.id] ?? ""}
                          onChange={(e) =>
                            setEditCaptions((prev) => ({ ...prev, [a.id]: e.target.value.slice(0, 50) }))
                          }
                          placeholder="Add caption…"
                          maxLength={50}
                          className={cn(
                            "mt-1 w-full text-[11px] px-1.5 py-0.5 rounded border bg-transparent outline-none transition-colors placeholder:text-muted-foreground/40",
                            isDirty
                              ? "border-primary/50 ring-1 ring-primary/30 focus:ring-primary/50"
                              : "border-transparent hover:border-input focus:border-input focus:bg-background",
                          )}
                        />
                      );
                    })()}
                  </div>
                ))}
              </div>

              {/* Save captions footer — only when there are unsaved changes */}
              {hasUnsavedCaptions && (
                <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                  <p className="text-[11px] text-primary/80">
                    {changedCaptions.length} caption{changedCaptions.length > 1 ? "s" : ""} with unsaved changes
                  </p>
                  <button
                    type="button"
                    onClick={handleSaveAll}
                    disabled={savingAll}
                    className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {savingAll && <Loader2 className="h-3 w-3 animate-spin" />}
                    {savingAll ? "Saving…" : "Save Captions"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Add section */}
          {!atLimit ? (
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Source tabs */}
              <div className="flex border-b px-5">
                {SOURCE_TABS.map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveSource(key)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors",
                      activeSource === key
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Image grid — click to add immediately */}
              <div className="flex-1 overflow-y-auto p-4">
                {loadingImages ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : images.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Camera className="h-7 w-7 text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {allImages.length > 0 ? "All images already added" : "No images available"}
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      {allImages.length > 0
                        ? "Remove one above to add a different image"
                        : activeSource === "PACKAGE"
                          ? "Upload images in the Images tab first"
                          : activeSource === "HOTEL"
                            ? hasStay ? "No hotel images uploaded yet" : "Assign a hotel stay to this day first"
                            : hasActivity ? "No activity images uploaded yet" : "Add an activity to this day first"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(grouped).map(([groupLabel, imgs]) => (
                      <div key={groupLabel}>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                          {groupLabel}
                        </p>
                        <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5">
                          {imgs.map((img) => {
                            const isAdding = addingUrl === img.url;
                            return (
                              <button
                                key={img.id}
                                type="button"
                                onClick={() => handleAddOne(img.url)}
                                disabled={!!addingUrl || atLimit}
                                className={cn(
                                  "relative aspect-square rounded-lg overflow-hidden border-2 transition-all",
                                  "border-transparent hover:border-primary/50 hover:ring-2 hover:ring-primary/20",
                                  (!!addingUrl || atLimit) && "cursor-not-allowed opacity-60",
                                  isAdding && "opacity-100",
                                )}
                              >
                                <img
                                  src={`${R2}/${img.thumbnail ?? img.url}`}
                                  alt=""
                                  className="absolute inset-0 w-full h-full object-cover"
                                />
                                {isAdding && (
                                  <div className="absolute inset-0 bg-primary/30 flex items-center justify-center">
                                    <Loader2 className="h-4 w-4 text-white drop-shadow animate-spin" />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">Limit of {MAX_ATTRACTIONS} attractions reached</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Meals section ─────────────────────────────────────────────────────────

const MEAL_DEFS = [
  { key: "breakfast", label: "Breakfast", Icon: Coffee,
    color: "text-orange-500",  activeClass: "bg-orange-100 border-orange-400",
    inactiveClass: "bg-orange-50 border-orange-200" },
  { key: "lunch",     label: "Lunch",     Icon: Sun,
    color: "text-yellow-500",  activeClass: "bg-yellow-100 border-yellow-400",
    inactiveClass: "bg-yellow-50 border-yellow-200" },
  { key: "dinner",    label: "Dinner",    Icon: Moon,
    color: "text-indigo-500",  activeClass: "bg-indigo-100 border-indigo-400",
    inactiveClass: "bg-indigo-50 border-indigo-200" },
] as const;

// Derive which meals a meal-type covers.
// Uses covered_meals if configured; falls back to keyword scanning the plan/type name.
function getEffectiveMeals(mealType: { name: string; covered_meals: string[] } | null, planName?: string | null): string[] {
  if (!mealType) return [];
  if (mealType.covered_meals.length > 0) return mealType.covered_meals;
  // Fallback: scan the meal type name and plan name for meal keywords
  const text = `${mealType.name} ${planName ?? ""}`.toLowerCase();
  const detected: string[] = [];
  if (text.includes("breakfast")) detected.push("breakfast");
  if (text.includes("lunch"))     detected.push("lunch");
  if (text.includes("dinner"))    detected.push("dinner");
  return detected;
}

function DayMealsSection({
  meals,
  onChange,
  excludedMeals,
  onExcludedChange,
  stays,
  onStaysChange,
  packageId,
  activities,
  disabled,
}: {
  meals: string[];
  onChange: (meals: string[]) => void;
  excludedMeals: string[];
  onExcludedChange: (excluded: string[]) => void;
  stays: StayItem[];
  onStaysChange: (stays: StayItem[]) => void;
  packageId: number;
  activities: ActivityItem[];
  disabled?: boolean;
}) {
  const [savingStayId, setSavingStayId] = useState<number | null>(null);

  // Per-stay derived meals: active_meals overrides the plan's covered meals when set
  const stayMealData = useMemo(() =>
    stays.map(stay => {
      const planCovered = getEffectiveMeals(stay.room_pricing.meal_type, stay.room_pricing.plan_name);
      // active_meals = what meals this hotel actually serves on THIS specific day
      // [] means "use plan default" (all covered); non-empty = explicit selection by team
      const active = stay.active_meals.length > 0 ? stay.active_meals : planCovered;
      return {
        stayId:        stay.id,
        categoryLabel: stay.stay_category.label,
        hotelName:     stay.room_pricing.hotel.name,
        planName:      stay.room_pricing.plan_name,
        planCovered,        // what the plan can provide
        activeMeals: active, // what's actually served this day
      };
    }),
    [stays],
  );

  // Union of all hotel-active meal keys
  const hotelActiveSet = useMemo(
    () => new Set(stayMealData.flatMap(s => s.activeMeals)),
    [stayMealData],
  );

  // Activity-derived meals (key → activity name)
  const activityDerived = useMemo(() => {
    const result: Record<string, string> = {};
    for (const act of activities) {
      for (const m of act.activity.included_meals) {
        if (!result[m]) result[m] = act.activity.name;
      }
    }
    return result;
  }, [activities]);

  const allDerived = useMemo(
    () => new Set([...hotelActiveSet, ...Object.keys(activityDerived)]),
    [hotelActiveSet, activityDerived],
  );

  const excludedSet = useMemo(() => new Set(excludedMeals), [excludedMeals]);

  // Effective meals = (hotel active + activity + manual) minus excluded
  const effectiveSet = useMemo(() => {
    const all = new Set([...allDerived, ...meals]);
    for (const e of excludedSet) all.delete(e);
    return all;
  }, [allDerived, meals, excludedSet]);

  const hasHotelMeals = stays.length > 0;
  const hasActMeals   = Object.keys(activityDerived).length > 0;

  async function toggleStayMeal(stayId: number, mealKey: string) {
    const stay = stays.find(s => s.id === stayId);
    if (!stay) return;
    const planCovered = getEffectiveMeals(stay.room_pricing.meal_type, stay.room_pricing.plan_name);
    // current active = explicit list or the full plan default
    const current = stay.active_meals.length > 0 ? stay.active_meals : planCovered;
    const next = current.includes(mealKey)
      ? current.filter(m => m !== mealKey)
      : [...current, mealKey];
    // Optimistic update
    onStaysChange(stays.map(s => s.id === stayId ? { ...s, active_meals: next } : s));
    setSavingStayId(stayId);
    await handleUpdateStayActiveMeals(stayId, next, packageId);
    setSavingStayId(null);
  }

  function toggleManual(key: string) {
    if (allDerived.has(key)) return;
    onChange(meals.includes(key) ? meals.filter(m => m !== key) : [...meals, key]);
  }

  function toggleExclusion(key: string) {
    if (!allDerived.has(key)) return;
    onExcludedChange(
      excludedSet.has(key)
        ? excludedMeals.filter(e => e !== key)
        : [...excludedMeals, key],
    );
  }

  return (
    <div className="px-5 pt-4 pb-4 border-b space-y-3">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <UtensilsCrossed className="h-3 w-3 text-muted-foreground" />
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Meals Included</p>
        </div>
        {effectiveSet.size > 0 && (
          <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">
            {effectiveSet.size} meal{effectiveSet.size !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Hotel stays — per-category, per-meal toggles */}
      {hasHotelMeals && (
        <div className="space-y-1.5">
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground/60 font-bold flex items-center gap-1">
            <Hotel className="h-2.5 w-2.5" /> Hotel Meals
            <span className="normal-case font-normal tracking-normal text-muted-foreground/40 ml-0.5">— tap to include/exclude per hotel</span>
          </p>
          {stayMealData.map(s => (
            <div key={s.stayId} className="rounded-lg bg-muted/30 px-2.5 py-2 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-muted-foreground">{s.categoryLabel}</span>
                <span className="text-[9px] text-muted-foreground/50 truncate max-w-[150px]" title={s.planName ?? s.hotelName}>
                  {s.planName ?? s.hotelName}
                </span>
                {savingStayId === s.stayId && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />}
              </div>
              {s.planCovered.length > 0 ? (
                <div className="flex gap-1.5">
                  {MEAL_DEFS.filter(m => s.planCovered.includes(m.key)).map(({ key, label, Icon, activeClass, inactiveClass }) => {
                    const on = s.activeMeals.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={disabled || savingStayId === s.stayId}
                        onClick={() => toggleStayMeal(s.stayId, key)}
                        className={cn(
                          "flex items-center gap-1 text-[9px] font-bold rounded-lg px-2 py-1 border transition-all cursor-pointer select-none",
                          on ? activeClass : cn(inactiveClass, "opacity-50"),
                        )}
                      >
                        <Icon className="h-2.5 w-2.5" />
                        {label}
                        {on
                          ? <Check className="h-2 w-2 ml-0.5" />
                          : <X className="h-2 w-2 ml-0.5 opacity-60" />
                        }
                      </button>
                    );
                  })}
                </div>
              ) : (
                <span className="text-[10px] text-muted-foreground/40 italic">No meals in plan</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Activity meals */}
      {hasActMeals && (
        <div className="space-y-1">
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground/60 font-bold flex items-center gap-1">
            <Activity className="h-2.5 w-2.5" /> Activity Meals
          </p>
          {MEAL_DEFS.filter(({ key }) => activityDerived[key]).map(({ key, label, Icon, color }) => {
            const excluded = excludedSet.has(key);
            return (
              <div
                key={key}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg bg-muted/30 px-2.5 py-1.5 cursor-pointer select-none transition-all",
                  excluded && "opacity-40",
                )}
                onClick={() => toggleExclusion(key)}
                title={excluded ? "Click to re-include" : "Click to exclude"}
              >
                <Icon className={cn("h-3 w-3 shrink-0", color)} />
                <span className={cn("text-[10px] font-semibold", excluded && "line-through")}>{label}:</span>
                <span className="text-[10px] text-muted-foreground truncate flex-1">{activityDerived[key]}</span>
                {excluded
                  ? <span className="text-[9px] text-destructive font-bold shrink-0">excluded</span>
                  : <X className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                }
              </div>
            );
          })}
        </div>
      )}

      {/* Manual toggles */}
      <div className="space-y-1.5">
        {(hasHotelMeals || hasActMeals) && (
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground/60 font-bold">
            Add Manually
          </p>
        )}
        <div className="flex gap-2">
          {MEAL_DEFS.map(({ key, label, Icon, color, activeClass, inactiveClass }) => {
            const fromDerived = allDerived.has(key);
            const excluded    = excludedSet.has(key);
            const included    = effectiveSet.has(key);
            return (
              <button
                key={key}
                type="button"
                disabled={disabled}
                onClick={() => fromDerived ? toggleExclusion(key) : toggleManual(key)}
                title={fromDerived ? (excluded ? "Re-include from hotel/activity" : "Exclude from this day") : undefined}
                className={cn(
                  "relative flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl border flex-1 select-none transition-all cursor-pointer",
                  included ? activeClass : cn(inactiveClass, !disabled && "hover:opacity-80"),
                  disabled && "cursor-default",
                )}
              >
                {included && !excluded && (
                  <span className="absolute top-1.5 right-1.5 h-3.5 w-3.5 rounded-full bg-green-500 flex items-center justify-center shadow-sm">
                    <Check className="h-2 w-2 text-white" />
                  </span>
                )}
                {excluded && (
                  <span className="absolute top-1.5 right-1.5 h-3.5 w-3.5 rounded-full bg-destructive flex items-center justify-center shadow-sm">
                    <X className="h-2 w-2 text-white" />
                  </span>
                )}
                <Icon className={cn("h-4 w-4", color)} />
                <span className={cn("text-[10px] font-bold uppercase tracking-widest leading-none", color)}>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Empty state */}
      {!hasHotelMeals && !hasActMeals && (
        <p className="text-[10px] text-muted-foreground/50">
          Toggle meals manually, or add a hotel stay / activity that includes meals — they'll appear here automatically.
        </p>
      )}
    </div>
  );
}

// ── Timeline drop zone ─────────────────────────────────────────────────────

function TimelineDropZone({ children, isEmpty }: { children: React.ReactNode; isEmpty: boolean }) {
  const { isOver, setNodeRef } = useDroppable({ id: "timeline-drop" });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "h-full min-h-32 rounded-xl transition-all duration-150",
        isOver && "bg-primary/5 ring-2 ring-primary/25 ring-dashed",
      )}
    >
      {isEmpty && !isOver ? (
        <div className="flex flex-col items-center justify-center h-32 gap-2">
          <div className="h-10 w-10 rounded-full bg-muted/60 flex items-center justify-center">
            <Plus className="h-4 w-4 text-muted-foreground/30" />
          </div>
          <p className="text-xs text-muted-foreground/40">Drag elements here or click above to add</p>
        </div>
      ) : isEmpty && isOver ? (
        <div className="flex flex-col items-center justify-center h-32 gap-2">
          <p className="text-sm font-medium text-primary/70">Drop to add</p>
        </div>
      ) : children}
    </div>
  );
}

// ── Main sidebar ───────────────────────────────────────────────────────────

export function ItineraryDaySidebar({
  open, onClose, packageId, destinationId, durationId, routeId, day: initialDay, stayCategories, onSaved, stopLabel, stopCoords, stopIndex, occupiedBy, maxNights: maxNightsProp, totalDays, onNavigateDay,
}: Props) {
  const [itineraryId, setItineraryId] = useState<number | null>(initialDay.id);
  const [title, setTitle] = useState(initialDay.title);
  const [description, setDescription] = useState(initialDay.description ?? "");
  const [meals, setMeals] = useState<string[]>(initialDay.meals ?? []);
  const [excludedMeals, setExcludedMeals] = useState<string[]>(initialDay.excluded_meals ?? []);
  const [transfers, setTransfers] = useState<TransferItem[]>(initialDay.transfers);
  const [activities, setActivities] = useState<ActivityItem[]>(initialDay.activities);
  const [notes, setNotes] = useState<NoteItem[]>(initialDay.notes);
  const [stays, setStays] = useState<StayItem[]>(initialDay.stays);
  const [attractions, setAttractions] = useState<AttractionItem[]>(initialDay.attractions);
  const [stayBlockOrder, setStayBlockOrder] = useState(initialDay.stays[0]?.sort_order ?? 100);
  const [savingMeta, setSavingMeta] = useState(false);
  const [pending, setPending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editPanel, setEditPanel] = useState<EditPanelState>(null);
  const [activeDragKind, setActiveDragKind] = useState<string | null>(null);
  const [attractionsOpen, setAttractionsOpen] = useState(false);


  const timeline = useMemo(
    () => buildTimeline(transfers, activities, notes, stays, stayBlockOrder),
    [transfers, activities, notes, stays, stayBlockOrder],
  );
  const dndIds = useMemo(() => timeline.map((i) => i.dndId), [timeline]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    if (!open) return;
    if (initialDay.id !== null) return;
    handleUpsertDayMeta(packageId, durationId, routeId, initialDay.day, {
      title: initialDay.title,
      description: null,
    }).then((res) => {
      if (res.success) setItineraryId(res.data.id);
      else toast.error("Failed to initialize day");
    });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function currentDayData(): DayData {
    return { id: itineraryId, day: initialDay.day, title, description: description || null, meals, excluded_meals: excludedMeals, activities, transfers, notes, stays, attractions };
  }

  // ── Day meta save ──────────────────────────────────────────────────────

  async function saveMeta() {
    if (!title.trim()) return;
    setSavingMeta(true);
    const res = await handleUpsertDayMeta(packageId, durationId, routeId, initialDay.day, {
      title: title.trim(),
      description: description.trim() || null,
      meals,
      excluded_meals: excludedMeals,
    });
    setSavingMeta(false);
    if (!res.success) { toast.error(res.message); return; }
    if (res.data) setItineraryId(res.data.id);
    toast.success("Day saved");
    onSaved(currentDayData());
  }

  // ── DnD ───────────────────────────────────────────────────────────────

  function handleDragStart(event: DragStartEvent) {
    const src = event.active.data.current?.source;
    if (src === "palette") setActiveDragKind(event.active.data.current?.kind ?? null);
    else setActiveDragKind(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDragKind(null);

    // Palette → timeline drop
    if (active.data.current?.source === "palette") {
      const kind = active.data.current.kind as "transfer" | "activity" | "note" | "stay";
      if (over && itineraryId) {
        if (kind === "stay") {
          setEditPanel({ mode: "stay" });
        } else {
          setEditPanel({ mode: "add", kind });
        }
      }
      return;
    }

    // Existing items reorder
    if (!over || active.id === over.id || !itineraryId) return;
    const oldIdx = timeline.findIndex((i) => i.dndId === String(active.id));
    const newIdx = timeline.findIndex((i) => i.dndId === String(over.id));
    if (oldIdx === -1 || newIdx === -1) return;

    const reordered = arrayMove(timeline, oldIdx, newIdx);
    const updates: ReorderItem[] = [];
    reordered.forEach((item, i) => {
      if (item.kind === "transfer") {
        setTransfers((prev) => prev.map((t) => (t.id === item.data.id ? { ...t, sort_order: i } : t)));
        updates.push({ kind: "transfer", id: item.data.id, sort_order: i });
      } else if (item.kind === "activity") {
        setActivities((prev) => prev.map((a) => (a.id === item.data.id ? { ...a, sort_order: i } : a)));
        updates.push({ kind: "activity", id: item.data.id, sort_order: i });
      } else if (item.kind === "note") {
        setNotes((prev) => prev.map((n) => (n.id === item.data.id ? { ...n, sort_order: i } : n)));
        updates.push({ kind: "note", id: item.data.id, sort_order: i });
      } else if (item.kind === "stay") {
        setStayBlockOrder(i);
        if (item.stays.length > 0) updates.push({ kind: "stay", itinerary_id: itineraryId, sort_order: i });
      }
    });
    if (updates.length > 0) handleReorderItems(updates, packageId);
  }

  // ── Transfer CRUD ──────────────────────────────────────────────────────

  async function addTransfer(data: TransferFormData) {
    if (!itineraryId) return;
    setPending(true);
    const res = await handleAddTransfer(itineraryId, transferFormToInput(data), packageId);
    setPending(false);
    if (!res.success) { toast.error(res.message); return; }
    setEditPanel(null);
    const refreshed = await handleGetItinerary();
    if (refreshed) setTransfers(refreshed.transfers);
    toast.success("Transfer added");
    onSaved(currentDayData());
  }

  async function saveTransfer(id: number, data: TransferFormData) {
    setPending(true);
    const res = await handleUpdateTransfer(id, transferFormToInput(data), packageId);
    setPending(false);
    if (!res.success) { toast.error(res.message); return; }
    const refreshed = await handleGetItinerary();
    if (refreshed) setTransfers(refreshed.transfers);
    setEditPanel(null);
    toast.success("Transfer updated");
  }

  async function deleteTransfer(id: number) {
    const key = `transfer-${id}`;
    setDeletingId(key);
    const res = await handleDeleteTransfer(id, packageId);
    setDeletingId(null);
    if (!res.success) { toast.error(res.message); return; }
    setTransfers((prev) => prev.filter((t) => t.id !== id));
    setEditPanel(null);
    toast.success("Transfer deleted");
    onSaved(currentDayData());
  }

  // ── Activity CRUD ──────────────────────────────────────────────────────

  async function addActivity(activityId: number, isOptional: boolean, variantId: number | null) {
    if (!itineraryId) return;
    setPending(true);
    const res = await handleAddActivity(itineraryId, activityId, isOptional, packageId, variantId);
    setPending(false);
    if (!res.success) { toast.error(res.message); return; }
    setEditPanel(null);
    const refreshed = await handleGetItinerary();
    if (refreshed) setActivities(refreshed.activities);
    toast.success("Activity added");
    onSaved(currentDayData());
  }

  async function toggleOptional(id: number, isOptional: boolean) {
    setPending(true);
    const res = await handleUpdateActivity(id, { is_optional: isOptional }, packageId);
    setPending(false);
    if (!res.success) { toast.error(res.message); return; }
    setActivities((prev) => prev.map((a) => a.id === id ? { ...a, is_optional: isOptional } : a));
  }

  async function changeVariant(id: number, variantId: number | null) {
    setPending(true);
    const res = await handleUpdateActivity(id, { variant_id: variantId }, packageId);
    setPending(false);
    if (!res.success) { toast.error(res.message); return; }
    setActivities((prev) => prev.map((a) => a.id === id ? { ...a, variant_id: variantId, variant: null } : a));
  }

  async function deleteActivity(id: number) {
    const key = `activity-${id}`;
    setDeletingId(key);
    const res = await handleDeleteActivity(id, packageId);
    setDeletingId(null);
    if (!res.success) { toast.error(res.message); return; }
    setActivities((prev) => prev.filter((a) => a.id !== id));
    setEditPanel(null);
    toast.success("Activity deleted");
    onSaved(currentDayData());
  }

  async function changeActivityItem(id: number, newActivityId: number, isOptional: boolean, variantId: number | null) {
    if (!itineraryId) return;
    setPending(true);
    const deleteRes = await handleDeleteActivity(id, packageId);
    if (!deleteRes.success) { toast.error(deleteRes.message); setPending(false); return; }
    const addRes = await handleAddActivity(itineraryId, newActivityId, isOptional, packageId, variantId);
    setPending(false);
    if (!addRes.success) { toast.error(addRes.message); return; }
    const refreshed = await handleGetItinerary();
    if (refreshed) setActivities(refreshed.activities);
    setEditPanel(null);
    toast.success("Activity changed");
    onSaved(currentDayData());
  }

  // ── Note CRUD ──────────────────────────────────────────────────────────

  async function addNote(data: { message: string; type: string; position: string; optional_link_text: string; optional_link_url: string }) {
    if (!itineraryId) return;
    setPending(true);
    const res = await handleAddNote(itineraryId, data, packageId);
    setPending(false);
    if (!res.success) { toast.error(res.message); return; }
    setEditPanel(null);
    const refreshed = await handleGetItinerary();
    if (refreshed) setNotes(refreshed.notes);
    toast.success("Note added");
    onSaved(currentDayData());
  }

  async function saveNote(id: number, data: { message: string; type: string; position: string; optional_link_text: string; optional_link_url: string }) {
    setPending(true);
    const res = await handleUpdateNote(id, data, packageId);
    setPending(false);
    if (!res.success) { toast.error(res.message); return; }
    setNotes((prev) => prev.map((n) => n.id === id ? { ...n, ...data, optional_link_text: data.optional_link_text || null, optional_link_url: data.optional_link_url || null } : n));
    setEditPanel(null);
    toast.success("Note updated");
  }

  async function deleteNote(id: number) {
    const key = `note-${id}`;
    setDeletingId(key);
    const res = await handleDeleteNote(id, packageId);
    setDeletingId(null);
    if (!res.success) { toast.error(res.message); return; }
    setNotes((prev) => prev.filter((n) => n.id !== id));
    setEditPanel(null);
    toast.success("Note deleted");
    onSaved(currentDayData());
  }

  // ── Refetch helper ─────────────────────────────────────────────────────

  async function handleGetItinerary() {
    const { handleGetItineraryData: fetch } = await import("@/app/actions/packages/itinerary-builder.actions");
    const res = await fetch(packageId, durationId, routeId);
    if (!res.success) return null;
    return (res.data as DayData[]).find((d) => d.day === initialDay.day) ?? null;
  }

  // ── Derived state ──────────────────────────────────────────────────────

  const hasNoItems = transfers.length === 0 && activities.length === 0 && notes.length === 0;
  const isTimelineEmpty = hasNoItems && stays.length === 0;

  const editPanelItem = useMemo(() => {
    if (!editPanel || editPanel.mode !== "edit") return null;
    return timeline.find((i) => i.dndId === editPanel.dndId) ?? null;
  }, [editPanel, timeline]);

  const panelTitle = editPanelTitle(editPanel);
  const panelKind: keyof typeof KIND_CONFIG | null =
    editPanel?.mode === "add" ? editPanel.kind :
    editPanel?.mode === "stay" ? "stay" :
    editPanel?.mode === "edit" ? kindFromDndId(editPanel.dndId) :
    null;

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" showCloseButton={false} className="w-full sm:max-w-xl p-0 flex flex-col gap-0 overflow-hidden">
        <SheetTitle className="sr-only">Day {initialDay.day} — Itinerary Builder</SheetTitle>

        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveDragKind(null)}>

          {/* ── Sliding wrapper ── */}
          <div className="relative flex-1 overflow-hidden flex flex-col">

            {/* ── Main panel ── */}
            <div className={cn(
              "absolute inset-0 flex flex-col bg-background transition-transform duration-300 ease-in-out",
              editPanel ? "-translate-x-full" : "translate-x-0",
            )}>
              {/* Header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b shrink-0">
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-black text-primary">{initialDay.day}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold leading-none">Day {initialDay.day}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                    {stopLabel ?? "Itinerary Builder"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onNavigateDay("prev")}
                    disabled={initialDay.day <= 1}
                    className="h-8 w-8 rounded-lg flex items-center justify-center cursor-pointer text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Previous day"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateDay("next")}
                    disabled={initialDay.day >= totalDays}
                    className="h-8 w-8 rounded-lg flex items-center justify-center cursor-pointer text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Next day"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground cursor-pointer hover:bg-muted/60 hover:text-foreground transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto flex flex-col">

              {/* Day meta */}
              <div className="px-5 pt-4 pb-4 border-b">
                <div className="flex flex-col gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Title</Label>
                      <button
                        type="button"
                        onClick={async () => { try { setTitle(await navigator.clipboard.readText()); } catch {} }}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                      >
                        <ClipboardPaste className="h-3 w-3" /> Paste
                      </button>
                    </div>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-9" placeholder={`Day ${initialDay.day}`} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Description</Label>
                      <button
                        type="button"
                        onClick={async () => { try { setDescription(await navigator.clipboard.readText()); } catch {} }}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                      >
                        <ClipboardPaste className="h-3 w-3" /> Paste
                      </button>
                    </div>
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="text-sm min-h-18 resize-none" placeholder="Brief description of this day…" />
                  </div>

                  {/* Attractions row */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => itineraryId && setAttractionsOpen(true)}
                      disabled={!itineraryId}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors shrink-0",
                        "border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary/50 hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer",
                      )}
                    >
                      <Camera className="h-3 w-3 " />
                      Attractions
                      {attractions.length > 0 && (
                        <span className="bg-primary/10 text-primary text-[10px] font-bold px-1 rounded">
                          {attractions.length}
                        </span>
                      )}
                    </button>
                    {/* Small preview row */}
                    {attractions.length > 0 && (
                      <div className="flex gap-1 overflow-x-auto flex-1 min-w-0">
                        {attractions.map((a) => (
                          <TooltipProvider key={a.id}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="shrink-0 w-8 h-6 rounded overflow-hidden border border-muted">
                                  <img
                                    src={`${R2}/${a.image_key}`}
                                    alt={a.caption || ""}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              </TooltipTrigger>
                              {a.caption && <TooltipContent>{a.caption}</TooltipContent>}
                            </Tooltip>
                          </TooltipProvider>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Palette */}
              <div className="px-5 pt-4 pb-4 border-b">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-3">Add Elements</p>
                <div className="flex gap-2">
                  <PaletteChip kind="transfer" disabled={!itineraryId} isApplied={transfers.length > 0} onClick={() => setEditPanel({ mode: "add", kind: "transfer" })} />
                  <PaletteChip kind="stay" disabled={!itineraryId || !!occupiedBy || maxNightsProp === 0} isApplied={stays.length > 0} onClick={() => setEditPanel({ mode: "stay" })} />
                  <PaletteChip kind="activity" disabled={!itineraryId} isApplied={activities.length > 0} onClick={() => setEditPanel({ mode: "add", kind: "activity" })} />
                  <PaletteChip kind="note" disabled={!itineraryId} isApplied={notes.length > 0} onClick={() => setEditPanel({ mode: "add", kind: "note" })} />
                </div>
                {!itineraryId && (
                  <p className="text-[10px] text-muted-foreground/50 mt-2.5">Save the day title first to enable adding elements</p>
                )}
              </div>

              {/* Meals — shrink-0 */}
              <DayMealsSection meals={meals} onChange={setMeals} excludedMeals={excludedMeals} onExcludedChange={setExcludedMeals} stays={stays} onStaysChange={setStays} packageId={packageId} activities={activities} />

              {/* Timeline */}
              <div className="flex flex-col px-5 pt-4 pb-4">
                <div className="flex items-center justify-between mb-3 shrink-0">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Timeline</p>
                  {timeline.length > 0 && (
                    <span className="text-[10px] bg-muted px-2.5 py-1 rounded-full text-muted-foreground font-medium">
                      {timeline.length} item{timeline.length !== 1 ? "s" : ""} · drag to reorder
                    </span>
                  )}
                </div>

                {/* Drop zone */}
                <div>
                  <TimelineDropZone isEmpty={isTimelineEmpty}>
                    <SortableContext items={dndIds} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2">
                        {timeline.map((item) => {
                          const isActive = editPanel?.mode === "edit" && editPanel.dndId === item.dndId;
                          return (
                            <SortableRow key={item.dndId} id={item.dndId}>
                              {item.kind === "transfer" && (
                                <TimelineRowCard
                                  kind="transfer" isActive={isActive}
                                  onEdit={() => setEditPanel({ mode: "edit", dndId: item.dndId })}
                                  onDelete={() => deleteTransfer(item.data.id)}
                                  deletePending={deletingId === item.dndId}
                                >
                                  <p className="text-xs font-medium truncate">
                                    {item.data.route ? `${item.data.route.pickup_name} → ${item.data.route.drop_name}` : "Route not set"}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground/60 truncate">
                                    {item.data.route?.distance_km != null
                                      ? `${item.data.route.distance_km} km by road`
                                      : "No details"}
                                  </p>
                                </TimelineRowCard>
                              )}
                              {item.kind === "activity" && (
                                <TimelineRowCard
                                  kind="activity" isActive={isActive}
                                  onEdit={() => setEditPanel({ mode: "edit", dndId: item.dndId })}
                                  onDelete={() => deleteActivity(item.data.id)}
                                  deletePending={deletingId === item.dndId}
                                >
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="text-xs font-medium">{item.data.activity.name}</p>
                                    {item.data.is_optional && <Badge variant="outline" className="text-[9px] h-3.5 px-1 py-0">Optional</Badge>}
                                    {item.data.variant_id === null && (
                                      <span className="text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded leading-none">
                                        ₹0
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-muted-foreground/60">
                                    {[item.data.activity.category, item.data.activity.duration_hours != null ? `${item.data.activity.duration_hours}h` : null].filter(Boolean).join(" · ")}
                                  </p>
                                </TimelineRowCard>
                              )}
                              {item.kind === "note" && (
                                <TimelineRowCard
                                  kind="note" isActive={isActive}
                                  onEdit={() => setEditPanel({ mode: "edit", dndId: item.dndId })}
                                  onDelete={() => deleteNote(item.data.id)}
                                  deletePending={deletingId === item.dndId}
                                >
                                  <p className="text-xs font-medium line-clamp-1">{item.data.message}</p>
                                  <p className="text-[10px] text-muted-foreground/60 capitalize">{item.data.type} · {item.data.position}</p>
                                </TimelineRowCard>
                              )}
                              {item.kind === "stay" && occupiedBy ? (
                                <div className="flex items-stretch rounded-xl border overflow-hidden bg-violet-50/60 border-violet-200">
                                  <div className="w-1 shrink-0 bg-violet-500" />
                                  <div className="flex-1 flex items-center gap-2.5 py-2.5 px-3 min-w-0">
                                    <Lock className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                                    <div className="min-w-0">
                                      <p className="text-xs font-medium text-violet-800">Covered by Day {occupiedBy.fromDay}</p>
                                      <p className="text-[10px] text-violet-600/70 truncate">
                                        {occupiedBy.hotelName} · Night {occupiedBy.nightIndex} of {occupiedBy.numNights}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ) : item.kind === "stay" ? (
                                <TimelineRowCard
                                  kind="stay" isActive={editPanel?.mode === "stay"}
                                  onEdit={() => setEditPanel({ mode: "stay" })}
                                  deletePending={false}
                                >
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="text-xs font-medium">Hotel Stay</p>
                                    {item.stays.length < stayCategories.length && (
                                      <span className="text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded leading-none">
                                        {stayCategories.length - item.stays.length} unassigned
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-muted-foreground/60">
                                    {item.stays.length > 0
                                      ? `${item.stays[0].room_pricing.hotel.name}${item.stays.length > 1 ? ` +${item.stays.length - 1} more` : ""} · ${item.stays.length}/${stayCategories.length} assigned`
                                      : `0/${stayCategories.length} assigned`}
                                  </p>
                                </TimelineRowCard>
                              ) : null}
                            </SortableRow>
                          );
                        })}
                      </div>
                    </SortableContext>
                  </TimelineDropZone>
                </div>

              </div>

              </div>{/* end scrollable body */}

              {/* Footer */}
              <div className="border-t px-5 py-4 shrink-0 flex items-center justify-end bg-background/95 backdrop-blur-sm">
                <Button onClick={saveMeta} disabled={savingMeta || !title.trim()} className="gap-2">
                  {savingMeta ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Day
                </Button>
              </div>
            </div>

            {/* ── Edit panel (slides in from right) ── */}
            <div className={cn(
              "absolute inset-0 flex flex-col bg-background transition-transform duration-300 ease-in-out",
              editPanel ? "translate-x-0" : "translate-x-full",
            )}>
              {/* Edit panel header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b shrink-0">
                <button
                  type="button"
                  onClick={() => setEditPanel(null)}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors shrink-0"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                {panelKind && (
                  <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", KIND_CONFIG[panelKind].chipBg)}>
                    {(() => { const { Icon, color } = KIND_CONFIG[panelKind]; return <Icon className={cn("h-4 w-4", color)} />; })()}
                  </div>
                )}
                <p className="text-sm font-bold flex-1">{panelTitle}</p>
              </div>

              {/* Edit panel body */}
              <div className="flex-1 overflow-y-auto px-5 py-5">
                {/* Add forms */}
                {editPanel?.mode === "add" && editPanel.kind === "transfer" && (
                  <AddTransferForm pending={pending} onSave={addTransfer} onCancel={() => setEditPanel(null)} stopCoords={stopCoords} />
                )}
                {editPanel?.mode === "add" && editPanel.kind === "activity" && (
                  <AddActivityForm destinationId={destinationId} stopPlaceName={stopLabel?.split(" in ").pop()} pending={pending} onSave={addActivity} onCancel={() => setEditPanel(null)} />
                )}
                {editPanel?.mode === "add" && editPanel.kind === "note" && (
                  <AddNoteForm pending={pending} onSave={addNote} onCancel={() => setEditPanel(null)} />
                )}

                {/* Stay panel */}
                {editPanel?.mode === "stay" && (
                  <StayBlock
                    stays={stays} stayCategories={stayCategories}
                    itineraryId={itineraryId} stayBlockOrder={stayBlockOrder}
                    packageId={packageId} destinationId={destinationId}
                    pending={pending}
                    currentDay={initialDay.day}
                    maxNights={maxNightsProp ?? 99}
                    stopIndex={stopIndex}
                    onStaysChange={(updated) => {
                      setStays(updated);
                      onSaved({ ...currentDayData(), stays: updated });
                    }}
                  />
                )}

                {/* Edit forms */}
                {editPanel?.mode === "edit" && editPanelItem?.kind === "transfer" && (
                  <TransferEditForm
                    item={editPanelItem.data} pending={pending}
                    onSave={(data) => saveTransfer(editPanelItem.data.id, data)}
                    onCancel={() => setEditPanel(null)}
                    onDelete={() => deleteTransfer(editPanelItem.data.id)}
                    stopCoords={stopCoords}
                  />
                )}
                {editPanel?.mode === "edit" && editPanelItem?.kind === "activity" && (
                  <ActivityEditForm
                    item={editPanelItem.data} pending={pending}
                    destinationId={destinationId}
                    onToggleOptional={(val) => toggleOptional(editPanelItem.data.id, val)}
                    onChangeVariant={(variantId) => changeVariant(editPanelItem.data.id, variantId)}
                    onChangeActivity={(newId, variantId) => changeActivityItem(editPanelItem.data.id, newId, editPanelItem.data.is_optional, variantId)}
                    onCancel={() => setEditPanel(null)}
                    onDelete={() => deleteActivity(editPanelItem.data.id)}
                  />
                )}
                {editPanel?.mode === "edit" && editPanelItem?.kind === "note" && (
                  <NoteEditForm
                    item={editPanelItem.data} pending={pending}
                    onSave={(data) => saveNote(editPanelItem.data.id, data)}
                    onCancel={() => setEditPanel(null)}
                    onDelete={() => deleteNote(editPanelItem.data.id)}
                  />
                )}
              </div>
            </div>

          </div>

          {/* DragOverlay — floating chip while dragging from palette */}
          <DragOverlay>
            {activeDragKind && activeDragKind in KIND_CONFIG && (() => {
              const k = activeDragKind as keyof typeof KIND_CONFIG;
              const { Icon, color, chipBg, label } = KIND_CONFIG[k];
              return (
                <div className={cn("flex items-center gap-2 px-4 py-2.5 rounded-xl border shadow-xl cursor-grabbing", chipBg)}>
                  <Icon className={cn("h-4 w-4", color)} />
                  <span className={cn("text-xs font-bold", color)}>{label}</span>
                </div>
              );
            })()}
          </DragOverlay>

        </DndContext>

        {/* Attractions modal — outside DndContext to avoid conflicts */}
        {itineraryId && (
          <AttractionsModal
            open={attractionsOpen}
            onClose={() => setAttractionsOpen(false)}
            itineraryId={itineraryId}
            packageId={packageId}
            attractions={attractions}
            onAttractionsChange={setAttractions}
            hasStay={stays.length > 0}
            hasActivity={activities.length > 0}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
