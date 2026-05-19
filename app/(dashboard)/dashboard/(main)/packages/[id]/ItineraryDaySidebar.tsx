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
  handleReorderItems,
  handleSearchActivities,
  handleSearchRoomPricings,
  handleGetVehicles,
  handleGetActivityVariants,
  handleAddAttraction,
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
  VehicleOption,
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
import { LocationPickerField } from "../../components/dashboard/LocationPickerField";
import type { LocationResult } from "../../components/dashboard/LocationSearchInput";
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
  occupiedBy?: OccupiedBy;
  totalDays?: number;
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
  transfer: { Icon: Car,        color: "text-blue-600",    chipBg: "bg-blue-50 border-blue-200 hover:bg-blue-100",    barColor: "bg-blue-500",   label: "Transfer" },
  activity: { Icon: Activity,   color: "text-emerald-600", chipBg: "bg-emerald-50 border-emerald-200 hover:bg-emerald-100", barColor: "bg-emerald-500", label: "Activity" },
  note:     { Icon: StickyNote, color: "text-amber-600",   chipBg: "bg-amber-50 border-amber-200 hover:bg-amber-100",   barColor: "bg-amber-500",  label: "Note"     },
  stay:     { Icon: Hotel,      color: "text-violet-600",  chipBg: "bg-violet-50 border-violet-200 hover:bg-violet-100",  barColor: "bg-violet-500", label: "Stay"     },
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
  onClick,
}: {
  kind: keyof typeof KIND_CONFIG;
  disabled: boolean;
  onClick: () => void;
}) {
  const { Icon, color, chipBg, label } = KIND_CONFIG[kind];
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
        "flex flex-col items-center gap-2 px-4 py-3 rounded-xl border cursor-grab select-none transition-all flex-1",
        chipBg,
        isDragging && "opacity-40 scale-95 cursor-grabbing shadow-lg",
        disabled && "opacity-40 cursor-not-allowed pointer-events-none",
      )}
      onClick={onClick}
      {...listeners}
      {...attributes}
    >
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

type TransferFormData = {
  pickup: LocationResult | null;
  drop: LocationResult | null;
  vehicle_id: number | null;
  num_vehicles: string;
  cost_price: string;
  sell_price: string;
  notes: string;
};

function transferFormToInput(data: TransferFormData) {
  return {
    pickup_name: data.pickup?.place_name ?? "",
    pickup_place_id: data.pickup?.place_id ?? null,
    pickup_lat: data.pickup?.latitude ?? null,
    pickup_lng: data.pickup?.longitude ?? null,
    drop_name: data.drop?.place_name ?? "",
    drop_place_id: data.drop?.place_id ?? null,
    drop_lat: data.drop?.latitude ?? null,
    drop_lng: data.drop?.longitude ?? null,
    vehicle_id: data.vehicle_id,
    num_vehicles: Number(data.num_vehicles) || 1,
    cost_price: data.cost_price ? Number(data.cost_price) : null,
    sell_price: data.sell_price ? Number(data.sell_price) : null,
    notes: data.notes || null,
  };
}

// ── Edit forms ─────────────────────────────────────────────────────────────

function TransferEditForm({
  item,
  vehicles,
  pending,
  onSave,
  onCancel,
  onDelete,
}: {
  item: TransferItem;
  vehicles: VehicleOption[];
  pending: boolean;
  onSave: (data: TransferFormData) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [form, setForm] = useState<TransferFormData>({
    pickup: item.route ? { place_name: item.route.pickup_name, place_id: "", address: item.route.pickup_name, latitude: 0, longitude: 0 } : null,
    drop: item.route ? { place_name: item.route.drop_name, place_id: "", address: item.route.drop_name, latitude: 0, longitude: 0 } : null,
    vehicle_id: item.vehicle_id,
    num_vehicles: String(item.num_vehicles),
    cost_price: item.cost_price != null ? String(item.cost_price) : "",
    sell_price: item.sell_price != null ? String(item.sell_price) : "",
    notes: item.notes ?? "",
  });

  const isValid = !!form.pickup && !!form.drop;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Pickup Location <span className="text-destructive">*</span></Label>
        <LocationPickerField value={form.pickup} onChange={(v) => setForm(f => ({ ...f, pickup: v }))} placeholder="Search pickup point…" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Drop Location <span className="text-destructive">*</span></Label>
        <LocationPickerField value={form.drop} onChange={(v) => setForm(f => ({ ...f, drop: v }))} placeholder="Search drop point…" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Vehicle</Label>
          <Select value={form.vehicle_id ? String(form.vehicle_id) : "none"} onValueChange={(v) => setForm(f => ({ ...f, vehicle_id: v === "none" ? null : Number(v) }))}>
            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No vehicle</SelectItem>
              {vehicles.map((v) => <SelectItem key={v.id} value={String(v.id)}>{v.name} ({v.passenger_capacity} pax)</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">No. of Vehicles</Label>
          <Input type="number" min={1} value={form.num_vehicles} onChange={(e) => setForm(f => ({ ...f, num_vehicles: e.target.value }))} className="h-9 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Cost Price (₹)</Label>
          <Input type="number" min={0} placeholder="0" value={form.cost_price} onChange={(e) => setForm(f => ({ ...f, cost_price: e.target.value }))} className="h-9 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Sell Price (₹)</Label>
          <Input type="number" min={0} placeholder="0" value={form.sell_price} onChange={(e) => setForm(f => ({ ...f, sell_price: e.target.value }))} className="h-9 text-xs" />
        </div>
      </div>
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
  onToggleOptional,
  onChangeVariant,
  onCancel,
  onDelete,
}: {
  item: ActivityItem;
  pending: boolean;
  onToggleOptional: (val: boolean) => void;
  onChangeVariant: (variantId: number | null) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [variants, setVariants] = useState<ActivityVariantOption[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);

  useEffect(() => {
    setLoadingVariants(true);
    handleGetActivityVariants(item.activity.id).then((res) => {
      setLoadingVariants(false);
      if (res.success) setVariants(res.data);
    });
  }, [item.activity.id]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-muted/30 p-3">
        <p className="text-sm font-medium">{item.activity.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {[item.activity.category, item.activity.duration_hours != null ? `${item.activity.duration_hours}h` : null].filter(Boolean).join(" · ")}
        </p>
      </div>

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
  vehicles, pending, onSave, onCancel,
}: {
  vehicles: VehicleOption[];
  pending: boolean;
  onSave: (data: TransferFormData) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<TransferFormData>({
    pickup: null, drop: null, vehicle_id: null,
    num_vehicles: "1", cost_price: "", sell_price: "", notes: "",
  });
  const isValid = !!form.pickup && !!form.drop;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Pickup Location <span className="text-destructive">*</span></Label>
        <LocationPickerField value={form.pickup} onChange={(v) => setForm(f => ({ ...f, pickup: v }))} placeholder="Search pickup point…" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Drop Location <span className="text-destructive">*</span></Label>
        <LocationPickerField value={form.drop} onChange={(v) => setForm(f => ({ ...f, drop: v }))} placeholder="Search drop point…" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Vehicle</Label>
          <Select value={form.vehicle_id ? String(form.vehicle_id) : "none"} onValueChange={(v) => setForm(f => ({ ...f, vehicle_id: v === "none" ? null : Number(v) }))}>
            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select vehicle…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No vehicle</SelectItem>
              {vehicles.map((v) => <SelectItem key={v.id} value={String(v.id)}>{v.name} ({v.passenger_capacity} pax)</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">No. of Vehicles</Label>
          <Input type="number" min={1} value={form.num_vehicles} onChange={(e) => setForm(f => ({ ...f, num_vehicles: e.target.value }))} className="h-9 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Cost Price (₹)</Label>
          <Input type="number" min={0} placeholder="0" value={form.cost_price} onChange={(e) => setForm(f => ({ ...f, cost_price: e.target.value }))} className="h-9 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Sell Price (₹)</Label>
          <Input type="number" min={0} placeholder="0" value={form.sell_price} onChange={(e) => setForm(f => ({ ...f, sell_price: e.target.value }))} className="h-9 text-xs" />
        </div>
      </div>
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

function AddActivityForm({
  destinationId, pending, onSave, onCancel,
}: {
  destinationId: number;
  pending: boolean;
  onSave: (activityId: number, isOptional: boolean, variantId: number | null) => void;
  onCancel: () => void;
}) {
  const [activityId, setActivityId] = useState<number | null>(null);
  const [isOptional, setIsOptional] = useState(false);
  const [variants, setVariants] = useState<ActivityVariantOption[]>([]);
  const [variantId, setVariantId] = useState<number | null>(null);
  const [loadingVariants, setLoadingVariants] = useState(false);

  const fetchActivities = useCallback(async (query: string): Promise<Option[]> => {
    const res = await handleSearchActivities(destinationId, query);
    if (!res.success) return [];
    return res.data.map((a) => ({
      id: a.id,
      label: a.name,
      description: [a.category, a.duration_hours != null ? `${a.duration_hours}h` : null].filter(Boolean).join(" · "),
    }));
  }, [destinationId]);

  async function handleActivitySelect(id: number | null) {
    setActivityId(id);
    setVariants([]);
    setVariantId(null);
    if (!id) return;
    setLoadingVariants(true);
    const res = await handleGetActivityVariants(id);
    setLoadingVariants(false);
    if (!res.success) return;
    setVariants(res.data);
    if (res.data.length === 1) setVariantId(res.data[0].id);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Activity <span className="text-destructive">*</span></Label>
        <SearchSelect value={activityId} onChange={handleActivitySelect} fetchOptions={fetchActivities} placeholder="Search activities…" />
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
  stays, stayCategories, itineraryId, stayBlockOrder, packageId, destinationId, pending, currentDay, maxNights, onStaysChange,
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
  onStaysChange: (stays: StayItem[]) => void;
}) {
  const [assigningCategoryId, setAssigningCategoryId] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  // Single shared num_nights for all categories (a stay covers the same nights across all tiers)
  const [numNights, setNumNights] = useState<number>(
    stays[0]?.num_nights ?? 1,
  );

  const fetchRooms = useCallback(async (query: string): Promise<Option[]> => {
    const res = await handleSearchRoomPricings(destinationId, query);
    if (!res.success) return [];
    return res.data.map((p) => ({
      id: p.id,
      label: `${p.hotel.name}${p.room ? ` — ${p.room.name}` : ""}`,
      description: `${p.plan_name ?? "Standard"} · ₹${p.price_per_night.toLocaleString("en-IN")}/night`,
    }));
  }, [destinationId]);

  async function handleAssign(categoryId: number, roomPricingId: number) {
    if (!itineraryId) return;
    setSavingId(categoryId);
    const res = await handleUpsertStay(itineraryId, categoryId, roomPricingId, stayBlockOrder, packageId, numNights);
    setSavingId(null);
    if (!res.success) { toast.error(res.message); return; }
    const searchRes = await handleSearchRoomPricings(destinationId, "");
    const pricing = searchRes.success ? searchRes.data.find((p) => p.id === roomPricingId) : null;
    if (!pricing) { toast.success("Stay saved"); setAssigningCategoryId(null); return; }
    const category = stayCategories.find((c) => c.id === categoryId)!;
    const existing = stays.find((s) => s.stay_category_id === categoryId);
    const newStay: StayItem = {
      id: existing?.id ?? Date.now(),
      stay_category_id: categoryId,
      sort_order: stayBlockOrder,
      num_nights: numNights,
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

  return (
    <div className="space-y-4">

      {/* Nights selector */}
      <div className="rounded-xl border bg-violet-50/60 border-violet-200 p-3 space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-violet-800">Number of Nights</p>
            <p className="text-[10px] text-violet-600/70 mt-0.5">How many consecutive nights does this stay cover?</p>
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
            <div key={cat.id} className="rounded-xl border bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{cat.label}</span>
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
                <div>
                  <p className="text-sm font-medium">{stay.room_pricing.hotel.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {stay.room_pricing.room?.name ?? "Room"} · {stay.room_pricing.plan_name ?? "Standard"} · ₹{stay.room_pricing.price_per_night.toLocaleString("en-IN")}/night
                  </p>
                </div>
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
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [addPending, setAddPending] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    if (!open || sourceImages) return;
    setLoadingImages(true);
    handleGetDaySourceImages(itineraryId, packageId).then((res) => {
      setLoadingImages(false);
      if (res.success) setSourceImages(res.data);
      else toast.error(res.message ?? "Failed to load images");
    });
  }, [open, itineraryId, packageId, sourceImages]);

  const images = sourceImages?.[activeSource] ?? [];
  const grouped = images.reduce<Record<string, typeof images[0][]>>((acc, img) => {
    (acc[img.group_label] ??= []).push(img);
    return acc;
  }, {});

  async function handleAdd() {
    if (!selectedUrl) return;
    setAddPending(true);
    const res = await handleAddAttraction(itineraryId, selectedUrl, caption.trim(), packageId);
    setAddPending(false);
    if (!res.success) { toast.error(res.message ?? "Failed to add attraction"); return; }
    onAttractionsChange([...attractions, res.data]);
    setSelectedUrl(null);
    setCaption("");
    toast.success("Attraction added");
    onClose();
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    const res = await handleDeleteAttraction(id, packageId);
    setDeletingId(null);
    if (!res.success) { toast.error(res.message); return; }
    onAttractionsChange(attractions.filter((a) => a.id !== id));
    toast.success("Removed");
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

          {/* Existing attractions — single scrollable row */}
          {attractions.length > 0 && (
            <div className="px-5 py-3 border-b bg-muted/20">
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                {attractions.map((a) => (
                  <TooltipProvider key={a.id}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="relative shrink-0 group">
                          <div className="w-16 h-12 rounded-lg overflow-hidden border bg-muted">
                            <img
                              src={`${R2}/${a.image_key}`}
                              alt={a.caption || "Attraction"}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDelete(a.id)}
                            disabled={deletingId === a.id}
                            className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            {deletingId === a.id
                              ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                              : <X className="h-2.5 w-2.5" />}
                          </button>
                        </div>
                      </TooltipTrigger>
                      {a.caption && <TooltipContent>{a.caption}</TooltipContent>}
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
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
                    onClick={() => { setActiveSource(key); setSelectedUrl(null); }}
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

              {/* Image grid */}
              <div className="flex-1 overflow-y-auto p-4">
                {loadingImages ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : images.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Camera className="h-7 w-7 text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">No images available</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      {activeSource === "PACKAGE"
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
                            const isSelected = selectedUrl === img.url;
                            return (
                              <button
                                key={img.id}
                                type="button"
                                onClick={() => setSelectedUrl(isSelected ? null : img.url)}
                                className={cn(
                                  "relative aspect-square rounded-lg overflow-hidden border-2 transition-all",
                                  isSelected
                                    ? "border-primary ring-2 ring-primary/30"
                                    : "border-transparent hover:border-primary/50",
                                )}
                              >
                                <img
                                  src={`${R2}/${img.thumbnail ?? img.url}`}
                                  alt=""
                                  className="absolute inset-0 w-full h-full object-cover"
                                />
                                {isSelected && (
                                  <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                    <Check className="h-4 w-4 text-white drop-shadow" />
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

              {/* Caption + add — shown when image selected */}
              {selectedUrl && (
                <div className="border-t px-4 py-3 flex items-center gap-3 bg-background">
                  <div className="w-10 h-8 rounded-md overflow-hidden border shrink-0">
                    <img src={`${R2}/${selectedUrl}`} alt="" className="w-full h-full object-cover" />
                  </div>
                  <input
                    type="text"
                    value={caption}
                    maxLength={50}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Add a caption (optional)…"
                    className="flex-1 h-8 px-2.5 text-xs rounded-md border bg-background outline-none focus:ring-1 focus:ring-primary/30"
                    autoFocus
                  />
                  <span className={cn("text-[10px] shrink-0", caption.length > 50 ? "text-destructive" : "text-muted-foreground/50")}>
                    {caption.length}/50
                  </span>
                  <Button size="sm" onClick={handleAdd} disabled={addPending} className="gap-1.5 shrink-0">
                    {addPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Add
                  </Button>
                </div>
              )}
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
  open, onClose, packageId, destinationId, durationId, routeId, day: initialDay, stayCategories, onSaved, stopLabel, occupiedBy, totalDays,
}: Props) {
  const [itineraryId, setItineraryId] = useState<number | null>(initialDay.id);
  const [title, setTitle] = useState(initialDay.title);
  const [description, setDescription] = useState(initialDay.description ?? "");
  const [transfers, setTransfers] = useState<TransferItem[]>(initialDay.transfers);
  const [activities, setActivities] = useState<ActivityItem[]>(initialDay.activities);
  const [notes, setNotes] = useState<NoteItem[]>(initialDay.notes);
  const [stays, setStays] = useState<StayItem[]>(initialDay.stays);
  const [attractions, setAttractions] = useState<AttractionItem[]>(initialDay.attractions);
  const [stayBlockOrder, setStayBlockOrder] = useState(initialDay.stays[0]?.sort_order ?? 100);
  const [savingMeta, setSavingMeta] = useState(false);
  const [pending, setPending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [editPanel, setEditPanel] = useState<EditPanelState>(null);
  const [activeDragKind, setActiveDragKind] = useState<string | null>(null);
  const [attractionsOpen, setAttractionsOpen] = useState(false);

  useEffect(() => {
    handleGetVehicles().then((res) => { if (res.success) setVehicles(res.data); });
  }, []);

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
    return { id: itineraryId, day: initialDay.day, title, description: description || null, activities, transfers, notes, stays, attractions };
  }

  // ── Day meta save ──────────────────────────────────────────────────────

  async function saveMeta() {
    if (!title.trim()) return;
    setSavingMeta(true);
    const res = await handleUpsertDayMeta(packageId, durationId, routeId, initialDay.day, {
      title: title.trim(),
      description: description.trim() || null,
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
                <button type="button" onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Day meta — shrink-0 */}
              <div className="px-5 pt-4 pb-4 border-b shrink-0">
                <div className="flex flex-col gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Title</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-9" placeholder={`Day ${initialDay.day}`} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Description</Label>
                    <Input value={description} onChange={(e) => setDescription(e.target.value)} className="h-9" placeholder="Brief description of this day…" />
                  </div>

                  {/* Attractions row */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => itineraryId && setAttractionsOpen(true)}
                      disabled={!itineraryId}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors shrink-0",
                        "border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary/50 hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed",
                      )}
                    >
                      <Camera className="h-3 w-3" />
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

              {/* Palette — shrink-0 */}
              <div className="px-5 pt-4 pb-4 border-b shrink-0">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-3">Add Elements</p>
                <div className="flex gap-2">
                  <PaletteChip kind="transfer" disabled={!itineraryId} onClick={() => setEditPanel({ mode: "add", kind: "transfer" })} />
                  <PaletteChip kind="stay" disabled={!itineraryId || !!occupiedBy} onClick={() => setEditPanel({ mode: "stay" })} />
                  <PaletteChip kind="activity" disabled={!itineraryId} onClick={() => setEditPanel({ mode: "add", kind: "activity" })} />
                  <PaletteChip kind="note" disabled={!itineraryId} onClick={() => setEditPanel({ mode: "add", kind: "note" })} />
                </div>
                {!itineraryId && (
                  <p className="text-[10px] text-muted-foreground/50 mt-2.5">Save the day title first to enable adding elements</p>
                )}
              </div>

              {/* Timeline + Attractions — fills remaining height with own scroll */}
              <div className="flex-1 overflow-y-auto flex flex-col px-5 pt-4 pb-4">
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
                                    {[
                                      item.data.vehicle?.name,
                                      item.data.route?.distance_km != null ? `${item.data.route.distance_km} km` : null,
                                      item.data.sell_price != null ? `₹${item.data.sell_price.toLocaleString("en-IN")}` : null,
                                    ].filter(Boolean).join(" · ") || "No details"}
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
                                  <p className="text-xs font-medium flex items-center gap-1.5 flex-wrap">
                                    {item.data.activity.name}
                                    {item.data.is_optional && <Badge variant="outline" className="text-[9px] h-3.5 px-1 py-0">Optional</Badge>}
                                  </p>
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
                                  <p className="text-xs font-medium">Hotel Stay</p>
                                  <p className="text-[10px] text-muted-foreground/60">
                                    {item.stays.length > 0
                                      ? `${item.stays[0].room_pricing.hotel.name}${item.stays.length > 1 ? ` +${item.stays.length - 1} more` : ""} · ${item.stays.length}/${stayCategories.length} assigned`
                                      : `${item.stays.length}/${stayCategories.length} assigned`}
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
                  <AddTransferForm vehicles={vehicles} pending={pending} onSave={addTransfer} onCancel={() => setEditPanel(null)} />
                )}
                {editPanel?.mode === "add" && editPanel.kind === "activity" && (
                  <AddActivityForm destinationId={destinationId} pending={pending} onSave={addActivity} onCancel={() => setEditPanel(null)} />
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
                    maxNights={(totalDays ?? 99) - initialDay.day + 1}
                    onStaysChange={(updated) => {
                      setStays(updated);
                      onSaved({ ...currentDayData(), stays: updated });
                    }}
                  />
                )}

                {/* Edit forms */}
                {editPanel?.mode === "edit" && editPanelItem?.kind === "transfer" && (
                  <TransferEditForm
                    item={editPanelItem.data} vehicles={vehicles} pending={pending}
                    onSave={(data) => saveTransfer(editPanelItem.data.id, data)}
                    onCancel={() => setEditPanel(null)}
                    onDelete={() => deleteTransfer(editPanelItem.data.id)}
                  />
                )}
                {editPanel?.mode === "edit" && editPanelItem?.kind === "activity" && (
                  <ActivityEditForm
                    item={editPanelItem.data} pending={pending}
                    onToggleOptional={(val) => toggleOptional(editPanelItem.data.id, val)}
                    onChangeVariant={(variantId) => changeVariant(editPanelItem.data.id, variantId)}
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
