"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensors,
  useSensor,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { toast } from "sonner";
import {
  removeStayAction,
  removeActivityAction,
  removeTransferAction,
  removeNoteAction,
  reorderTimelineAction,
} from "@/app/actions/packages/itinerary.actions";
import {
  getRoomPricingForStayCategoryAction,
  getActivitiesForPackageAction,
} from "@/app/actions/packages/package.actions";
import type { PackageStayCategory } from "@/app/types/packages";
import {
  buildTimelineItems,
  toTimelineId,
  type TimelineItem,
  type TimelineItemKind,
  type DragData,
  type PendingDrop,
  type RoomOption,
  type ActivityOption,
} from "./timeline.types";
import type { ItineraryDayView } from "@/app/types/packages";
import { TimelineCanvas, CANVAS_DROPPABLE_ID } from "./TimelineCanvas";
import { TimelinePalette } from "./TimelinePalette";
import { DragOverlayCard } from "./DragOverlayCard";
import { DayHeader } from "./DayHeader";
import { AddItemDialog } from "./AddItemDialog";

// ── Props ──────────────────────────────────────────────────────────────────────

type Props = {
  packageId: number;
  destinationId: number;
  selectedDay: ItineraryDayView;
  categories: PackageStayCategory[];
  onSaveHeader: (title: string, desc: string) => Promise<void>;
  onRefresh: () => void;
};

// ── Remove action map ──────────────────────────────────────────────────────────

const REMOVE_ACTIONS: Record<
  TimelineItemKind,
  (id: number) => Promise<{ success: boolean; error?: string }>
> = {
  stay: removeStayAction,
  activity: removeActivityAction,
  transfer: removeTransferAction,
  note: removeNoteAction,
};

// ── Timeline ───────────────────────────────────────────────────────────────────

export function Timeline({
  packageId,
  destinationId,
  selectedDay,
  categories,
  onSaveHeader,
  onRefresh,
}: Props) {
  // ── Items state — rebuilt whenever the selected day changes ────────────────
  const [items, setItems] = useState<TimelineItem[]>(() =>
    buildTimelineItems(selectedDay)
  );

  useEffect(() => {
    setItems(buildTimelineItems(selectedDay));
  }, [selectedDay.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Palette data — loaded once on mount ────────────────────────────────────
  const [roomOptions, setRoomOptions] = useState<RoomOption[]>([]);
  const [activityOptions, setActivityOptions] = useState<ActivityOption[]>([]);

  useEffect(() => {
    Promise.all([
      getRoomPricingForStayCategoryAction(packageId, categories.map((c) => c.id)),
      getActivitiesForPackageAction(destinationId),
    ]).then(([rooms, activities]) => {
      setRoomOptions(
        (rooms as RoomOption[]).map((r) => ({
          ...r,
          price_per_night: Number(r.price_per_night),
        }))
      );
      setActivityOptions(
        (activities as ActivityOption[]).map((a) => ({
          ...a,
          price: Number(a.price),
          duration_hours: a.duration_hours ? Number(a.duration_hours) : null,
        }))
      );
    });
  }, [packageId, destinationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Drag state ─────────────────────────────────────────────────────────────
  const [activeDragData, setActiveDragData] = useState<DragData | null>(null);
  const [pendingDrop, setPendingDrop] = useState<PendingDrop | null>(null);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ── Drag handlers ──────────────────────────────────────────────────────────

  function handleDragStart(event: DragStartEvent) {
    setActiveDragData(event.active.data.current as DragData);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDragData(null);

    const activeData = active.data.current as DragData | undefined;
    if (!activeData) return;

    // ── Palette → canvas: open add dialog ──────────────────────────────────
    if (activeData.source === "palette") {
      if (!over) return;

      const overId = String(over.id);
      let insertIndex = items.length; // default: append

      if (overId !== CANVAS_DROPPABLE_ID) {
        const idx = items.findIndex(
          (item) => toTimelineId(item.kind, item.id) === overId
        );
        if (idx !== -1) insertIndex = idx;
      }

      setPendingDrop({ kind: activeData.kind, insertIndex });
      return;
    }

    // ── Canvas → canvas: reorder ───────────────────────────────────────────
    if (activeData.source === "canvas") {
      if (!over || active.id === over.id) return;
      if (String(over.id) === CANVAS_DROPPABLE_ID) return;

      const oldIndex = items.findIndex(
        (item) => toTimelineId(item.kind, item.id) === String(active.id)
      );
      const newIndex = items.findIndex(
        (item) => toTimelineId(item.kind, item.id) === String(over.id)
      );
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(items, oldIndex, newIndex).map(
        (item, i) => ({ ...item, sort_order: i })
      );

      setItems(reordered); // optimistic

      reorderTimelineAction({
        items: reordered.map(({ kind, id, sort_order }) => ({
          kind,
          id,
          sort_order,
        })),
      }).then((res) => {
        if (!res.success) {
          toast.error("Failed to save order");
          setItems(items); // revert
        }
      });
    }
  }

  // ── Remove ─────────────────────────────────────────────────────────────────

  const handleRemove = useCallback(
    (item: TimelineItem) => {
      const dndId = toTimelineId(item.kind, item.id);
      setRemovingIds((prev) => new Set(prev).add(dndId));

      REMOVE_ACTIONS[item.kind](item.id).then((res) => {
        setRemovingIds((prev) => {
          const next = new Set(prev);
          next.delete(dndId);
          return next;
        });
        if (res.success) {
          setItems((prev) =>
            prev
              .filter((i) => toTimelineId(i.kind, i.id) !== dndId)
              .map((i, idx) => ({ ...i, sort_order: idx }))
          );
        } else {
          toast.error(res.error ?? "Failed to remove item");
        }
      });
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Add success: reorder to correct position + refresh ────────────────────

  const handleAddSuccess = useCallback(
    async (kind: TimelineItemKind, newId: number) => {
      if (!pendingDrop) return;
      const { insertIndex } = pendingDrop;

      const reorderItems = [
        ...items.slice(0, insertIndex).map((item, i) => ({
          kind: item.kind,
          id: item.id,
          sort_order: i,
        })),
        { kind, id: newId, sort_order: insertIndex },
        ...items.slice(insertIndex).map((item, i) => ({
          kind: item.kind,
          id: item.id,
          sort_order: insertIndex + 1 + i,
        })),
      ];

      await reorderTimelineAction({ items: reorderItems });
      setPendingDrop(null);
      onRefresh();
    },
    [items, pendingDrop, onRefresh]
  );

  const isPaletteActive =
    activeDragData?.source === "palette";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col gap-3">
        <DayHeader
          dayNumber={selectedDay.day}
          title={selectedDay.title}
          description={selectedDay.description}
          onSave={onSaveHeader}
        />

        <div className="grid grid-cols-[1fr_200px] gap-3 items-start">
          {/* Canvas */}
          <TimelineCanvas
            items={items}
            onRemove={handleRemove}
            removingIds={removingIds}
            isPaletteActive={isPaletteActive}
          />

          {/* Palette */}
          <div className="rounded-xl border p-3">
            <TimelinePalette />
          </div>
        </div>
      </div>

      {/* Floating card while dragging */}
      <DragOverlay dropAnimation={null}>
        {activeDragData && <DragOverlayCard data={activeDragData} />}
      </DragOverlay>

      {/* Post-drop form dialog */}
      <AddItemDialog
        open={!!pendingDrop}
        pending={pendingDrop}
        dayId={selectedDay.id}
        roomOptions={roomOptions}
        activityOptions={activityOptions}
        categories={categories.map((c) => ({
          id: c.id,
          slug: c.slug,
          label: c.label,
        }))}
        onSuccess={handleAddSuccess}
        onClose={() => setPendingDrop(null)}
      />
    </DndContext>
  );
}
