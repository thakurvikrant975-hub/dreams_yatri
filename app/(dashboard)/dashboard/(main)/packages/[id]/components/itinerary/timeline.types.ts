import type {
  ItineraryStayView,
  ItineraryActivityView,
  ItineraryTransfer,
  ItineraryNote,
} from "@/app/types/packages";

// ── Item kinds ─────────────────────────────────────────────────────────────────

export type TimelineItemKind = "stay" | "activity" | "transfer" | "note";

// ── Unified timeline item ──────────────────────────────────────────────────────

export type TimelineStay = {
  kind: "stay";
  id: number;
  sort_order: number;
  data: ItineraryStayView;
};

export type TimelineActivity = {
  kind: "activity";
  id: number;
  sort_order: number;
  data: ItineraryActivityView;
};

export type TimelineTransfer = {
  kind: "transfer";
  id: number;
  sort_order: number;
  data: ItineraryTransfer;
};

export type TimelineNote = {
  kind: "note";
  id: number;
  sort_order: number;
  data: ItineraryNote;
};

export type TimelineItem =
  | TimelineStay
  | TimelineActivity
  | TimelineTransfer
  | TimelineNote;

// ── dnd-kit drag data ──────────────────────────────────────────────────────────

// Attached to useDraggable / useSortable .data.current
export type CanvasDragData = {
  source: "canvas";
  kind: TimelineItemKind;
  id: number;
};

export type PaletteDragData = {
  source: "palette";
  kind: TimelineItemKind;
};

export type DragData = CanvasDragData | PaletteDragData;

// ── Reorder payload ────────────────────────────────────────────────────────────

export type ReorderItem = {
  kind: TimelineItemKind;
  id: number;
  sort_order: number;
};

// ── Palette data types (loaded once per session, passed as props) ──────────────

export type RoomOption = {
  id: number;
  price_per_night: number;
  hotel: {
    id: number;
    name: string;
    destination: { id: number; name: string };
  };
  room: { id: number; name: string } | null;
};

export type ActivityOption = {
  id: number;
  name: string;
  price: number;
  duration_hours: number | null;
  category: string | null;
};

// ── Pending palette drop ────────────────────────────────────────────────────────

export type PendingDrop = {
  kind: TimelineItemKind;
  insertIndex: number;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Stable dnd-kit ID — avoids collisions across tables. */
export function toTimelineId(kind: TimelineItemKind, id: number): string {
  return `${kind}-${id}`;
}

/** Merge all sub-arrays from an ItineraryDayView into one sorted list. */
export function buildTimelineItems(day: {
  itineraryStays: ItineraryStayView[];
  itinerary_activities: ItineraryActivityView[];
  itinerary_transfers: ItineraryTransfer[];
  itinerary_notes: ItineraryNote[];
}): TimelineItem[] {
  const items: TimelineItem[] = [
    ...day.itineraryStays.map((s): TimelineStay => ({
      kind: "stay",
      id: s.id,
      sort_order: s.sort_order,
      data: s,
    })),
    ...day.itinerary_activities.map((a): TimelineActivity => ({
      kind: "activity",
      id: a.id,
      sort_order: a.sort_order,
      data: a,
    })),
    ...day.itinerary_transfers.map((t): TimelineTransfer => ({
      kind: "transfer",
      id: t.id,
      sort_order: t.sort_order,
      data: t,
    })),
    ...day.itinerary_notes.map((n): TimelineNote => ({
      kind: "note",
      id: n.id,
      sort_order: n.sort_order,
      data: n,
    })),
  ];

  return items.sort((a, b) => a.sort_order - b.sort_order);
}
