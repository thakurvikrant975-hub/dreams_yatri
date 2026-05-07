"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../../components/ui/sheet";
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
} from "@/app/actions/packages/itinerary-builder.actions";
import type {
  DayData,
  ActivityItem,
  TransferItem,
  NoteItem,
  StayItem,
  ReorderItem,
} from "@/app/services/itinerary-builder.service";
import {
  GripVertical,
  Loader2,
  Pencil,
  Trash2,
  Plus,
  Car,
  Activity,
  StickyNote,
  Bed,
  X,
  Check,
  Hotel,
  Save,
} from "lucide-react";
import { cn } from "@/app/lib/utils";

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
};

type DndItem =
  | { dndId: string; sortOrder: number; kind: "transfer"; data: TransferItem }
  | { dndId: string; sortOrder: number; kind: "activity"; data: ActivityItem }
  | { dndId: string; sortOrder: number; kind: "note"; data: NoteItem }
  | { dndId: string; sortOrder: number; kind: "stay"; stays: StayItem[] };

type AddMode = "transfer" | "activity" | "note" | null;

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

// ── Sortable wrapper ───────────────────────────────────────────────────────

function SortableRow({
  id,
  children,
}: {
  id: string;
  children: (dragHandleProps: React.HTMLAttributes<HTMLButtonElement>) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="group relative"
      {...attributes}
    >
      {children(listeners ?? {})}
    </div>
  );
}

// ── Transfer card ──────────────────────────────────────────────────────────

function TransferCard({
  item,
  editing,
  pending,
  onEdit,
  onSave,
  onCancel,
  onDelete,
}: {
  item: TransferItem;
  editing: boolean;
  pending: boolean;
  onEdit: () => void;
  onSave: (data: { cab_type: string; pickup_point: string; drop_point: string; duration_text: string }) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [cabType, setCabType] = useState(item.cab_type ?? "");
  const [pickup, setPickup] = useState(item.pickup_point ?? "");
  const [drop, setDrop] = useState(item.drop_point ?? "");
  const [duration, setDuration] = useState(item.duration_text ?? "");

  useEffect(() => {
    if (editing) {
      setCabType(item.cab_type ?? "");
      setPickup(item.pickup_point ?? "");
      setDrop(item.drop_point ?? "");
      setDuration(item.duration_text ?? "");
    }
  }, [editing, item]);

  const preview = [item.pickup_point, item.drop_point].filter(Boolean).join(" → ") ||
    item.cab_type || "No details";

  return (
    <div className={cn("rounded-lg border bg-background p-3", editing && "border-primary/40 bg-primary/5")}>
      {!editing ? (
        <div className="flex items-start gap-2">
          <Car className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium">Transfer</p>
            <p className="text-[11px] text-muted-foreground truncate">{preview}</p>
            {item.cab_type && <p className="text-[10px] text-muted-foreground/60">{item.cab_type}{item.duration_text ? ` · ${item.duration_text}` : ""}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onEdit}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 hover:text-destructive" onClick={onDelete} disabled={pending}>
              {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 mb-2">
            <Car className="h-3.5 w-3.5 text-blue-500" />
            <p className="text-xs font-semibold">Edit Transfer</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Pickup Point</Label>
              <Input value={pickup} onChange={(e) => setPickup(e.target.value)} className="h-7 text-xs mt-0.5" placeholder="Delhi Airport" />
            </div>
            <div>
              <Label className="text-[10px]">Drop Point</Label>
              <Input value={drop} onChange={(e) => setDrop(e.target.value)} className="h-7 text-xs mt-0.5" placeholder="Hotel XYZ" />
            </div>
            <div>
              <Label className="text-[10px]">Cab Type</Label>
              <Input value={cabType} onChange={(e) => setCabType(e.target.value)} className="h-7 text-xs mt-0.5" placeholder="Tempo Traveller" />
            </div>
            <div>
              <Label className="text-[10px]">Duration</Label>
              <Input value={duration} onChange={(e) => setDuration(e.target.value)} className="h-7 text-xs mt-0.5" placeholder="~4 hrs" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="h-7 text-xs gap-1" onClick={() => onSave({ cab_type: cabType, pickup_point: pickup, drop_point: drop, duration_text: duration })} disabled={pending}>
              {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Save
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancel} disabled={pending}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Activity card ──────────────────────────────────────────────────────────

function ActivityCard({
  item,
  editing,
  pending,
  onEdit,
  onToggleOptional,
  onCancel,
  onDelete,
}: {
  item: ActivityItem;
  editing: boolean;
  pending: boolean;
  onEdit: () => void;
  onToggleOptional: (val: boolean) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={cn("rounded-lg border bg-background p-3", editing && "border-primary/40 bg-primary/5")}>
      {!editing ? (
        <div className="flex items-start gap-2">
          <Activity className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-xs font-medium">{item.activity.name}</p>
              {item.is_optional && (
                <Badge variant="outline" className="text-[9px] h-3.5 px-1 py-0">Optional</Badge>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground/60">
              {[item.activity.category, item.activity.duration_hours != null ? `${item.activity.duration_hours}h` : null].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onEdit}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 hover:text-destructive" onClick={onDelete} disabled={pending}>
              {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Activity className="h-3.5 w-3.5 text-green-500" />
            <p className="text-xs font-semibold">{item.activity.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id={`optional-${item.id}`}
              checked={item.is_optional}
              onCheckedChange={onToggleOptional}
              disabled={pending}
            />
            <Label htmlFor={`optional-${item.id}`} className="text-xs">Optional activity</Label>
            {pending && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancel}>Done</Button>
        </div>
      )}
    </div>
  );
}

// ── Note card ──────────────────────────────────────────────────────────────

const NOTE_TYPE_COLORS: Record<string, string> = {
  info: "text-blue-500",
  warning: "text-amber-500",
  success: "text-green-500",
};

function NoteCard({
  item,
  editing,
  pending,
  onEdit,
  onSave,
  onCancel,
  onDelete,
}: {
  item: NoteItem;
  editing: boolean;
  pending: boolean;
  onEdit: () => void;
  onSave: (data: { message: string; type: string; position: string; optional_link_text: string; optional_link_url: string }) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [message, setMessage] = useState(item.message);
  const [type, setType] = useState(item.type);
  const [position, setPosition] = useState(item.position);
  const [linkText, setLinkText] = useState(item.optional_link_text ?? "");
  const [linkUrl, setLinkUrl] = useState(item.optional_link_url ?? "");

  useEffect(() => {
    if (editing) {
      setMessage(item.message);
      setType(item.type);
      setPosition(item.position);
      setLinkText(item.optional_link_text ?? "");
      setLinkUrl(item.optional_link_url ?? "");
    }
  }, [editing, item]);

  return (
    <div className={cn("rounded-lg border bg-background p-3", editing && "border-primary/40 bg-primary/5")}>
      {!editing ? (
        <div className="flex items-start gap-2">
          <StickyNote className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", NOTE_TYPE_COLORS[item.type] ?? "text-muted-foreground")} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium line-clamp-2">{item.message}</p>
            <p className="text-[10px] text-muted-foreground/60 capitalize">{item.type} · {item.position}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onEdit}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 hover:text-destructive" onClick={onDelete} disabled={pending}>
              {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 mb-2">
            <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-semibold">Edit Note</p>
          </div>
          <div>
            <Label className="text-[10px]">Message</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} className="text-xs mt-0.5 min-h-16 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px]">Position</Label>
              <Select value={position} onValueChange={setPosition}>
                <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="top">Top</SelectItem>
                  <SelectItem value="bottom">Bottom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Link Text (optional)</Label>
              <Input value={linkText} onChange={(e) => setLinkText(e.target.value)} className="h-7 text-xs mt-0.5" />
            </div>
            <div>
              <Label className="text-[10px]">Link URL (optional)</Label>
              <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className="h-7 text-xs mt-0.5" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="h-7 text-xs gap-1" onClick={() => onSave({ message, type, position, optional_link_text: linkText, optional_link_url: linkUrl })} disabled={pending || !message.trim()}>
              {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Save
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancel} disabled={pending}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Stay block ─────────────────────────────────────────────────────────────

function StayBlock({
  stays,
  stayCategories,
  itineraryId,
  stayBlockOrder,
  packageId,
  destinationId,
  pending,
  onStaysChange,
}: {
  stays: StayItem[];
  stayCategories: StayCategory[];
  itineraryId: number | null;
  stayBlockOrder: number;
  packageId: number;
  destinationId: number;
  pending: boolean;
  onStaysChange: (stays: StayItem[]) => void;
}) {
  const [assigningCategoryId, setAssigningCategoryId] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  const fetchRooms = useCallback(
    async (query: string): Promise<Option[]> => {
      const res = await handleSearchRoomPricings(destinationId, query);
      if (!res.success) return [];
      return res.data.map((p) => ({
        id: p.id,
        label: `${p.hotel.name}${p.room ? ` — ${p.room.name}` : ""}`,
        description: `${p.plan_name ?? "Standard"} · ₹${p.price_per_night.toLocaleString("en-IN")}/night`,
      }));
    },
    [destinationId],
  );

  async function handleAssign(categoryId: number, roomPricingId: number) {
    if (!itineraryId) return;
    setSavingId(categoryId);
    const res = await handleUpsertStay(itineraryId, categoryId, roomPricingId, stayBlockOrder, packageId);
    setSavingId(null);
    if (!res.success) { toast.error(res.message); return; }

    // Fetch updated room pricing info from search to get hotel/room details
    const searchRes = await handleSearchRoomPricings(destinationId, "");
    const pricing = searchRes.success ? searchRes.data.find((p) => p.id === roomPricingId) : null;
    if (!pricing) { toast.success("Stay saved"); setAssigningCategoryId(null); return; }

    const category = stayCategories.find((c) => c.id === categoryId)!;
    const existing = stays.find((s) => s.stay_category_id === categoryId);
    const newStay: StayItem = {
      id: existing?.id ?? Date.now(),
      stay_category_id: categoryId,
      sort_order: stayBlockOrder,
      room_pricing: pricing,
      stay_category: category,
    };
    onStaysChange(
      existing
        ? stays.map((s) => (s.stay_category_id === categoryId ? newStay : s))
        : [...stays, newStay],
    );
    setAssigningCategoryId(null);
    toast.success("Stay assigned");
  }

  async function handleRemove(stay: StayItem) {
    setSavingId(stay.stay_category_id);
    const res = await handleDeleteStay(stay.id, packageId);
    setSavingId(null);
    if (!res.success) { toast.error(res.message); return; }
    onStaysChange(stays.filter((s) => s.id !== stay.id));
    toast.success("Stay removed");
  }

  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="flex items-center gap-2 mb-3">
        <Hotel className="h-3.5 w-3.5 text-purple-500" />
        <p className="text-xs font-semibold">Hotel Stay</p>
        <Badge variant="outline" className="text-[9px] h-3.5 px-1 py-0">{stays.length}/{stayCategories.length} assigned</Badge>
      </div>

      {stayCategories.length === 0 ? (
        <p className="text-xs text-muted-foreground/60 italic">No stay categories configured for this package</p>
      ) : (
        <div className="space-y-2">
          {stayCategories.map((cat) => {
            const stay = stays.find((s) => s.stay_category_id === cat.id);
            const isAssigning = assigningCategoryId === cat.id;
            const isSaving = savingId === cat.id;

            return (
              <div key={cat.id} className="rounded-md border bg-muted/20 p-2">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{cat.label}</span>
                  <div className="flex items-center gap-1">
                    {stay && !isAssigning && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 w-5 p-0 hover:text-primary text-muted-foreground/60"
                        onClick={() => setAssigningCategoryId(cat.id)}
                        title="Change"
                      >
                        <Pencil className="h-2.5 w-2.5" />
                      </Button>
                    )}
                    {stay && !isAssigning && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 w-5 p-0 hover:text-destructive text-muted-foreground/60"
                        onClick={() => handleRemove(stay)}
                        disabled={isSaving || !itineraryId}
                      >
                        {isSaving ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <X className="h-2.5 w-2.5" />}
                      </Button>
                    )}
                    {isAssigning && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 w-5 p-0 text-muted-foreground"
                        onClick={() => setAssigningCategoryId(null)}
                      >
                        <X className="h-2.5 w-2.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {isAssigning ? (
                  <div className="mt-1">
                    <SearchSelect
                      fetchOptions={fetchRooms}
                      placeholder="Search hotel / room…"
                      onChange={(id) => { if (id) handleAssign(cat.id, id); }}
                    />
                    {isSaving && <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1"><Loader2 className="h-2.5 w-2.5 animate-spin" />Saving…</p>}
                  </div>
                ) : stay ? (
                  <div>
                    <p className="text-xs font-medium">{stay.room_pricing.hotel.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {stay.room_pricing.room?.name ?? "Room"} · {stay.room_pricing.plan_name ?? "Standard"} · ₹{stay.room_pricing.price_per_night.toLocaleString("en-IN")}/night
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="text-[11px] text-primary/70 hover:text-primary flex items-center gap-1 disabled:opacity-50"
                    onClick={() => setAssigningCategoryId(cat.id)}
                    disabled={!itineraryId || pending}
                  >
                    <Plus className="h-3 w-3" />
                    Assign hotel
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Add forms ──────────────────────────────────────────────────────────────

function AddTransferForm({
  onSave,
  onCancel,
  pending,
}: {
  onSave: (data: { cab_type: string; pickup_point: string; drop_point: string; duration_text: string }) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const [cabType, setCabType] = useState("");
  const [pickup, setPickup] = useState("");
  const [drop, setDrop] = useState("");
  const [duration, setDuration] = useState("");

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 p-3 space-y-2">
      <div className="flex items-center gap-1.5 mb-2">
        <Car className="h-3.5 w-3.5 text-blue-500" />
        <p className="text-xs font-semibold">Add Transfer</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px]">Pickup Point</Label>
          <Input value={pickup} onChange={(e) => setPickup(e.target.value)} className="h-7 text-xs mt-0.5" placeholder="Delhi Airport" />
        </div>
        <div>
          <Label className="text-[10px]">Drop Point</Label>
          <Input value={drop} onChange={(e) => setDrop(e.target.value)} className="h-7 text-xs mt-0.5" placeholder="Hotel XYZ" />
        </div>
        <div>
          <Label className="text-[10px]">Cab Type</Label>
          <Input value={cabType} onChange={(e) => setCabType(e.target.value)} className="h-7 text-xs mt-0.5" placeholder="Tempo Traveller" />
        </div>
        <div>
          <Label className="text-[10px]">Duration</Label>
          <Input value={duration} onChange={(e) => setDuration(e.target.value)} className="h-7 text-xs mt-0.5" placeholder="~4 hrs" />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button size="sm" className="h-7 text-xs gap-1" onClick={() => onSave({ cab_type: cabType, pickup_point: pickup, drop_point: drop, duration_text: duration })} disabled={pending || (!pickup && !drop && !cabType)}>
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Add
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancel} disabled={pending}>Cancel</Button>
      </div>
    </div>
  );
}

function AddActivityForm({
  destinationId,
  onSave,
  onCancel,
  pending,
}: {
  destinationId: number;
  onSave: (activityId: number, isOptional: boolean) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const [activityId, setActivityId] = useState<number | null>(null);
  const [isOptional, setIsOptional] = useState(false);

  const fetchActivities = useCallback(
    async (query: string): Promise<Option[]> => {
      const res = await handleSearchActivities(destinationId, query);
      if (!res.success) return [];
      return res.data.map((a) => ({
        id: a.id,
        label: a.name,
        description: [a.category, a.duration_hours != null ? `${a.duration_hours}h` : null].filter(Boolean).join(" · "),
      }));
    },
    [destinationId],
  );

  return (
    <div className="rounded-lg border border-green-200 bg-green-50/50 dark:bg-green-950/20 p-3 space-y-2">
      <div className="flex items-center gap-1.5 mb-2">
        <Activity className="h-3.5 w-3.5 text-green-500" />
        <p className="text-xs font-semibold">Add Activity</p>
      </div>
      <div>
        <Label className="text-[10px]">Activity</Label>
        <div className="mt-0.5">
          <SearchSelect
            value={activityId}
            onChange={(val) => setActivityId(val)}
            fetchOptions={fetchActivities}
            placeholder="Search activities…"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="add-optional" checked={isOptional} onCheckedChange={setIsOptional} />
        <Label htmlFor="add-optional" className="text-xs">Optional activity</Label>
      </div>
      <div className="flex gap-2 pt-1">
        <Button size="sm" className="h-7 text-xs gap-1" onClick={() => activityId && onSave(activityId, isOptional)} disabled={pending || !activityId}>
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Add
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancel} disabled={pending}>Cancel</Button>
      </div>
    </div>
  );
}

function AddNoteForm({
  onSave,
  onCancel,
  pending,
}: {
  onSave: (data: { message: string; type: string; position: string; optional_link_text: string; optional_link_url: string }) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const [message, setMessage] = useState("");
  const [type, setType] = useState("info");
  const [position, setPosition] = useState("bottom");
  const [linkText, setLinkText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-2">
      <div className="flex items-center gap-1.5 mb-2">
        <StickyNote className="h-3.5 w-3.5 text-amber-500" />
        <p className="text-xs font-semibold">Add Note</p>
      </div>
      <div>
        <Label className="text-[10px]">Message</Label>
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} className="text-xs mt-0.5 min-h-16 resize-none" placeholder="Enter note message…" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px]">Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="success">Success</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px]">Position</Label>
          <Select value={position} onValueChange={setPosition}>
            <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="top">Top</SelectItem>
              <SelectItem value="bottom">Bottom</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px]">Link Text (optional)</Label>
          <Input value={linkText} onChange={(e) => setLinkText(e.target.value)} className="h-7 text-xs mt-0.5" />
        </div>
        <div>
          <Label className="text-[10px]">Link URL (optional)</Label>
          <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className="h-7 text-xs mt-0.5" />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button size="sm" className="h-7 text-xs gap-1" onClick={() => onSave({ message, type, position, optional_link_text: linkText, optional_link_url: linkUrl })} disabled={pending || !message.trim()}>
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Add
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancel} disabled={pending}>Cancel</Button>
      </div>
    </div>
  );
}

// ── Main sidebar ───────────────────────────────────────────────────────────

export function ItineraryDaySidebar({
  open,
  onClose,
  packageId,
  destinationId,
  durationId,
  routeId,
  day: initialDay,
  stayCategories,
  onSaved,
}: Props) {
  const [itineraryId, setItineraryId] = useState<number | null>(initialDay.id);
  const [title, setTitle] = useState(initialDay.title);
  const [description, setDescription] = useState(initialDay.description ?? "");
  const [transfers, setTransfers] = useState<TransferItem[]>(initialDay.transfers);
  const [activities, setActivities] = useState<ActivityItem[]>(initialDay.activities);
  const [notes, setNotes] = useState<NoteItem[]>(initialDay.notes);
  const [stays, setStays] = useState<StayItem[]>(initialDay.stays);
  const [stayBlockOrder, setStayBlockOrder] = useState(
    initialDay.stays[0]?.sort_order ?? 100,
  );
  const [savingMeta, setSavingMeta] = useState(false);
  const [pending, setPending] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const timeline = useMemo(
    () => buildTimeline(transfers, activities, notes, stays, stayBlockOrder),
    [transfers, activities, notes, stays, stayBlockOrder],
  );
  const dndIds = useMemo(() => timeline.map((i) => i.dndId), [timeline]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  // Auto-create day record on first open
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
    return { id: itineraryId, day: initialDay.day, title, description: description || null, activities, transfers, notes, stays };
  }

  // ── Day meta save ────────────────────────────────────────────────────────

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

  // ── DnD reorder ──────────────────────────────────────────────────────────

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
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
        if (item.stays.length > 0) {
          updates.push({ kind: "stay", itinerary_id: itineraryId, sort_order: i });
        }
      }
    });

    if (updates.length > 0) {
      handleReorderItems(updates, packageId);
    }
  }

  // ── Transfer CRUD ────────────────────────────────────────────────────────

  async function addTransfer(data: { cab_type: string; pickup_point: string; drop_point: string; duration_text: string }) {
    if (!itineraryId) return;
    setPending(true);
    const res = await handleAddTransfer(itineraryId, data, packageId);
    setPending(false);
    if (!res.success) { toast.error(res.message); return; }
    setAddMode(null);
    // Refetch to get the new transfer with its id and sort_order
    const refreshed = await handleGetItinerary();
    if (refreshed) setTransfers(refreshed.transfers);
    toast.success("Transfer added");
    onSaved(currentDayData());
  }

  async function saveTransfer(id: number, data: { cab_type: string; pickup_point: string; drop_point: string; duration_text: string }) {
    setPending(true);
    const res = await handleUpdateTransfer(id, data, packageId);
    setPending(false);
    if (!res.success) { toast.error(res.message); return; }
    setTransfers((prev) => prev.map((t) => t.id === id ? { ...t, ...data } : t));
    setEditingId(null);
    toast.success("Transfer updated");
  }

  async function deleteTransfer(id: number) {
    const key = `transfer-${id}`;
    setDeletingId(key);
    const res = await handleDeleteTransfer(id, packageId);
    setDeletingId(null);
    if (!res.success) { toast.error(res.message); return; }
    setTransfers((prev) => prev.filter((t) => t.id !== id));
    toast.success("Transfer deleted");
    onSaved(currentDayData());
  }

  // ── Activity CRUD ────────────────────────────────────────────────────────

  async function addActivity(activityId: number, isOptional: boolean) {
    if (!itineraryId) return;
    setPending(true);
    const res = await handleAddActivity(itineraryId, activityId, isOptional, packageId);
    setPending(false);
    if (!res.success) { toast.error(res.message); return; }
    setAddMode(null);
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

  async function deleteActivity(id: number) {
    const key = `activity-${id}`;
    setDeletingId(key);
    const res = await handleDeleteActivity(id, packageId);
    setDeletingId(null);
    if (!res.success) { toast.error(res.message); return; }
    setActivities((prev) => prev.filter((a) => a.id !== id));
    toast.success("Activity deleted");
    onSaved(currentDayData());
  }

  // ── Note CRUD ────────────────────────────────────────────────────────────

  async function addNote(data: { message: string; type: string; position: string; optional_link_text: string; optional_link_url: string }) {
    if (!itineraryId) return;
    setPending(true);
    const res = await handleAddNote(itineraryId, data, packageId);
    setPending(false);
    if (!res.success) { toast.error(res.message); return; }
    setAddMode(null);
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
    setEditingId(null);
    toast.success("Note updated");
  }

  async function deleteNote(id: number) {
    const key = `note-${id}`;
    setDeletingId(key);
    const res = await handleDeleteNote(id, packageId);
    setDeletingId(null);
    if (!res.success) { toast.error(res.message); return; }
    setNotes((prev) => prev.filter((n) => n.id !== id));
    toast.success("Note deleted");
    onSaved(currentDayData());
  }

  // ── Refetch helper ───────────────────────────────────────────────────────

  async function handleGetItinerary() {
    const { handleGetItineraryData: fetch } = await import("@/app/actions/packages/itinerary-builder.actions");
    const res = await fetch(packageId, durationId, routeId);
    if (!res.success) return null;
    return (res.data as DayData[]).find((d) => d.day === initialDay.day) ?? null;
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const hasNoItems = transfers.length === 0 && activities.length === 0 && notes.length === 0;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col gap-0 p-0">
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-primary">{initialDay.day}</span>
            </div>
            <SheetTitle className="text-sm">Day {initialDay.day} — Itinerary</SheetTitle>
          </div>
        </SheetHeader>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Day meta */}
          <div className="space-y-2">
            <div>
              <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Day Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 text-sm"
                placeholder={`Day ${initialDay.day}`}
              />
            </div>
            <div>
              <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 text-xs resize-none min-h-16"
                placeholder="Brief description of this day…"
              />
            </div>
            <Button size="sm" className="gap-1.5 h-8" onClick={saveMeta} disabled={savingMeta || !title.trim()}>
              {savingMeta ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save Day
            </Button>
          </div>

          <div className="border-t" />

          {/* Add buttons */}
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Add to Timeline</p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={addMode === "transfer" ? "default" : "outline"}
                className="h-7 text-xs gap-1.5"
                onClick={() => setAddMode(addMode === "transfer" ? null : "transfer")}
                disabled={!itineraryId}
              >
                <Car className="h-3 w-3" />Transfer
              </Button>
              <Button
                size="sm"
                variant={addMode === "activity" ? "default" : "outline"}
                className="h-7 text-xs gap-1.5"
                onClick={() => setAddMode(addMode === "activity" ? null : "activity")}
                disabled={!itineraryId}
              >
                <Activity className="h-3 w-3" />Activity
              </Button>
              <Button
                size="sm"
                variant={addMode === "note" ? "default" : "outline"}
                className="h-7 text-xs gap-1.5"
                onClick={() => setAddMode(addMode === "note" ? null : "note")}
                disabled={!itineraryId}
              >
                <StickyNote className="h-3 w-3" />Note
              </Button>
            </div>

            {/* Add form panels */}
            {addMode === "transfer" && (
              <div className="mt-3">
                <AddTransferForm onSave={addTransfer} onCancel={() => setAddMode(null)} pending={pending} />
              </div>
            )}
            {addMode === "activity" && (
              <div className="mt-3">
                <AddActivityForm destinationId={destinationId} onSave={addActivity} onCancel={() => setAddMode(null)} pending={pending} />
              </div>
            )}
            {addMode === "note" && (
              <div className="mt-3">
                <AddNoteForm onSave={addNote} onCancel={() => setAddMode(null)} pending={pending} />
              </div>
            )}
          </div>

          {/* DnD Timeline */}
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Timeline {timeline.length > 0 && <span className="normal-case font-normal">· drag to reorder</span>}
            </p>

            {hasNoItems && stays.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 rounded-xl border border-dashed bg-muted/20">
                <p className="text-xs text-muted-foreground">No items yet</p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">Add transfers, activities, or notes above</p>
              </div>
            ) : (
              <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                <SortableContext items={dndIds} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {timeline.map((item) => (
                      <SortableRow key={item.dndId} id={item.dndId}>
                        {(dragHandleProps) => (
                          <div className="flex items-start gap-2">
                            <button
                              type="button"
                              className="mt-2.5 cursor-grab active:cursor-grabbing shrink-0 text-muted-foreground/30 hover:text-muted-foreground transition-colors"
                              {...dragHandleProps}
                              aria-label="Drag to reorder"
                            >
                              <GripVertical className="h-4 w-4" />
                            </button>
                            <div className="flex-1 min-w-0">
                              {item.kind === "transfer" && (
                                <TransferCard
                                  item={item.data}
                                  editing={editingId === item.dndId}
                                  pending={deletingId === item.dndId}
                                  onEdit={() => setEditingId(editingId === item.dndId ? null : item.dndId)}
                                  onSave={(data) => saveTransfer(item.data.id, data)}
                                  onCancel={() => setEditingId(null)}
                                  onDelete={() => deleteTransfer(item.data.id)}
                                />
                              )}
                              {item.kind === "activity" && (
                                <ActivityCard
                                  item={item.data}
                                  editing={editingId === item.dndId}
                                  pending={deletingId === item.dndId || pending}
                                  onEdit={() => setEditingId(editingId === item.dndId ? null : item.dndId)}
                                  onToggleOptional={(val) => toggleOptional(item.data.id, val)}
                                  onCancel={() => setEditingId(null)}
                                  onDelete={() => deleteActivity(item.data.id)}
                                />
                              )}
                              {item.kind === "note" && (
                                <NoteCard
                                  item={item.data}
                                  editing={editingId === item.dndId}
                                  pending={deletingId === item.dndId}
                                  onEdit={() => setEditingId(editingId === item.dndId ? null : item.dndId)}
                                  onSave={(data) => saveNote(item.data.id, data)}
                                  onCancel={() => setEditingId(null)}
                                  onDelete={() => deleteNote(item.data.id)}
                                />
                              )}
                              {item.kind === "stay" && (
                                <StayBlock
                                  stays={item.stays}
                                  stayCategories={stayCategories}
                                  itineraryId={itineraryId}
                                  stayBlockOrder={stayBlockOrder}
                                  packageId={packageId}
                                  destinationId={destinationId}
                                  pending={pending}
                                  onStaysChange={(updated) => {
                                    setStays(updated);
                                    onSaved({ ...currentDayData(), stays: updated });
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        )}
                      </SortableRow>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
