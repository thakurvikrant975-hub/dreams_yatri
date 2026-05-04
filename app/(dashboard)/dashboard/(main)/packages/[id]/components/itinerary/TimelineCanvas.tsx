"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { PackagePlus } from "lucide-react";
import { TimelineItem as TimelineItemCard } from "./TimelineItem";
import { toTimelineId } from "./timeline.types";
import type { TimelineItem } from "./timeline.types";

// ── Constants ──────────────────────────────────────────────────────────────────

export const CANVAS_DROPPABLE_ID = "timeline-canvas";

// ── Props ──────────────────────────────────────────────────────────────────────

type Props = {
  items: TimelineItem[];
  onRemove: (item: TimelineItem) => void;
  /** IDs (toTimelineId format) of items currently being removed optimistically */
  removingIds: Set<string>;
  /** True while a palette card is being dragged — activates drop-zone highlight */
  isPaletteActive: boolean;
};

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({ isPaletteActive }: { isPaletteActive: boolean }) {
  return (
    <div
      className={`flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-10 transition-colors ${
        isPaletteActive
          ? "border-primary bg-primary/5 text-primary"
          : "border-muted text-muted-foreground"
      }`}
    >
      <PackagePlus className="h-7 w-7 opacity-40" />
      <p className="text-xs font-medium">
        {isPaletteActive ? "Drop here" : "Drag items from the palette"}
      </p>
    </div>
  );
}

// ── Canvas ─────────────────────────────────────────────────────────────────────

export function TimelineCanvas({
  items,
  onRemove,
  removingIds,
  isPaletteActive,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: CANVAS_DROPPABLE_ID });

  const sortableIds = items.map((item) => toTimelineId(item.kind, item.id));

  const isHighlighted = isPaletteActive && isOver;

  return (
    <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
      <div
        ref={setNodeRef}
        className={`flex min-h-48 flex-col gap-2 rounded-lg p-1 transition-colors ${
          isHighlighted ? "bg-primary/5 outline outline-2 outline-primary outline-dashed rounded-lg" : ""
        }`}
      >
        {items.length === 0 ? (
          <EmptyState isPaletteActive={isPaletteActive} />
        ) : (
          <>
            {items.map((item) => {
              const id = toTimelineId(item.kind, item.id);
              return (
                <TimelineItemCard
                  key={id}
                  item={item}
                  onRemove={onRemove}
                  isRemoving={removingIds.has(id)}
                />
              );
            })}

            {/* Bottom drop zone — palette card lands here when dragged past all items */}
            {isPaletteActive && (
              <div
                className={`h-10 rounded-md border-2 border-dashed transition-colors ${
                  isOver
                    ? "border-primary bg-primary/5"
                    : "border-muted/50"
                }`}
              />
            )}
          </>
        )}
      </div>
    </SortableContext>
  );
}
