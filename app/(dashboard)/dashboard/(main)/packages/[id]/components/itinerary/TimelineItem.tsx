"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  BedDouble,
  Zap,
  Car,
  StickyNote,
  GripVertical,
  X,
  Info,
  AlertTriangle,
  Lightbulb,
  AlertCircle,
} from "lucide-react";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import type { TimelineItem, CanvasDragData } from "./timeline.types";
import { toTimelineId } from "./timeline.types";

// ── Props ──────────────────────────────────────────────────────────────────────

type Props = {
  item: TimelineItem;
  onRemove: (item: TimelineItem) => void;
  isRemoving?: boolean;
};

// ── Note type icon map ─────────────────────────────────────────────────────────

const NOTE_ICONS: Record<string, React.ElementType> = {
  info: Info,
  warning: AlertTriangle,
  tip: Lightbulb,
  important: AlertCircle,
};

// ── Inner card content (kind-specific) ────────────────────────────────────────

function StayContent({ item }: { item: Extract<TimelineItem, { kind: "stay" }> }) {
  const { room_pricing } = item.data;
  const hotelName = room_pricing.hotel.name;
  const roomName = room_pricing.room?.name ?? null;
  const price = Number(room_pricing.price_per_night);

  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <BedDouble className="h-3.5 w-3.5 shrink-0 text-blue-500" />
        <span className="text-xs font-semibold truncate">{hotelName}</span>
      </div>
      <div className="mt-0.5 flex items-center gap-2">
        {roomName && (
          <span className="text-[10px] text-muted-foreground truncate">{roomName}</span>
        )}
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
          ₹{price.toLocaleString()}/night
        </Badge>
      </div>
    </div>
  );
}

function ActivityContent({ item }: { item: Extract<TimelineItem, { kind: "activity" }> }) {
  const { activity } = item.data;
  const price = activity.price ? Number(activity.price) : null;

  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <Zap className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
        <span className="text-xs font-semibold truncate">{activity.name}</span>
        {item.data.is_optional && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
            Optional
          </Badge>
        )}
      </div>
      <div className="mt-0.5 flex items-center gap-2">
        {activity.category && (
          <span className="text-[10px] text-muted-foreground">{activity.category}</span>
        )}
        {price !== null && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
            ₹{price.toLocaleString()}
          </Badge>
        )}
      </div>
    </div>
  );
}

function TransferContent({ item }: { item: Extract<TimelineItem, { kind: "transfer" }> }) {
  const { cab_type, pickup_point, drop_point, duration_text } = item.data;

  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <Car className="h-3.5 w-3.5 shrink-0 text-orange-500" />
        <span className="text-xs font-semibold">
          {pickup_point && drop_point
            ? `${pickup_point} → ${drop_point}`
            : pickup_point ?? drop_point ?? "Transfer"}
        </span>
      </div>
      <div className="mt-0.5 flex items-center gap-2">
        {cab_type && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
            {cab_type}
          </Badge>
        )}
        {duration_text && (
          <span className="text-[10px] text-muted-foreground">{duration_text}</span>
        )}
      </div>
    </div>
  );
}

function NoteContent({ item }: { item: Extract<TimelineItem, { kind: "note" }> }) {
  const { message, type } = item.data;
  const NoteIcon = NOTE_ICONS[type] ?? Info;

  const colorClass: Record<string, string> = {
    info: "text-blue-500",
    warning: "text-amber-500",
    tip: "text-emerald-500",
    important: "text-red-500",
  };

  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <NoteIcon className={`h-3.5 w-3.5 shrink-0 ${colorClass[type] ?? "text-muted-foreground"}`} />
        <span className="text-xs font-semibold capitalize">{type}</span>
      </div>
      <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-2">{message}</p>
    </div>
  );
}

// ── Kind → accent color ────────────────────────────────────────────────────────

const KIND_BORDER: Record<TimelineItem["kind"], string> = {
  stay: "border-l-blue-400",
  activity: "border-l-emerald-400",
  transfer: "border-l-orange-400",
  note: "border-l-violet-400",
};

// ── Sortable item wrapper ──────────────────────────────────────────────────────

export function TimelineItem({ item, onRemove, isRemoving }: Props) {
  const dndId = toTimelineId(item.kind, item.id);
  const dragData: CanvasDragData = { source: "canvas", kind: item.kind, id: item.id };

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: dndId, data: dragData });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex items-center gap-2 rounded-md border border-l-4 bg-background px-3 py-2 shadow-sm ${KIND_BORDER[item.kind]}`}
    >
      {/* drag handle */}
      <button
        {...listeners}
        {...attributes}
        className="shrink-0 cursor-grab touch-none text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing focus:outline-none"
        tabIndex={-1}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* content */}
      {item.kind === "stay" && <StayContent item={item} />}
      {item.kind === "activity" && <ActivityContent item={item} />}
      {item.kind === "transfer" && <TransferContent item={item} />}
      {item.kind === "note" && <NoteContent item={item} />}

      {/* remove button */}
      <Button
        variant="ghost"
        size="icon"
        className="ml-auto h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
        onClick={() => onRemove(item)}
        disabled={isRemoving}
        aria-label="Remove item"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
