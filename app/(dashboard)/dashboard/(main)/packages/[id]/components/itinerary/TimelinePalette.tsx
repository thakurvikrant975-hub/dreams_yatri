"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { BedDouble, Zap, Car, StickyNote, GripVertical } from "lucide-react";
import type { PaletteDragData, TimelineItemKind } from "./timeline.types";

// ── Card definitions ───────────────────────────────────────────────────────────

type PaletteCardDef = {
  kind: TimelineItemKind;
  label: string;
  description: string;
  Icon: React.ElementType;
  iconClass: string;
  borderClass: string;
};

const PALETTE_CARDS: PaletteCardDef[] = [
  {
    kind: "stay",
    label: "Stay",
    description: "Hotel or camp night",
    Icon: BedDouble,
    iconClass: "text-blue-600 bg-blue-50",
    borderClass: "border-blue-200 hover:border-blue-400",
  },
  {
    kind: "activity",
    label: "Activity",
    description: "Sightseeing / experience",
    Icon: Zap,
    iconClass: "text-emerald-600 bg-emerald-50",
    borderClass: "border-emerald-200 hover:border-emerald-400",
  },
  {
    kind: "transfer",
    label: "Transfer",
    description: "Cab / vehicle movement",
    Icon: Car,
    iconClass: "text-orange-600 bg-orange-50",
    borderClass: "border-orange-200 hover:border-orange-400",
  },
  {
    kind: "note",
    label: "Note",
    description: "Info / warning / tip",
    Icon: StickyNote,
    iconClass: "text-violet-600 bg-violet-50",
    borderClass: "border-violet-200 hover:border-violet-400",
  },
];

// ── Single draggable card ──────────────────────────────────────────────────────

function PaletteCard({ def }: { def: PaletteCardDef }) {
  const dragData: PaletteDragData = { source: "palette", kind: def.kind };

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `palette-${def.kind}`,
      data: dragData,
    });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    cursor: isDragging ? "grabbing" : "grab",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-3 rounded-lg border bg-background px-3 py-2.5 transition-colors select-none ${def.borderClass}`}
    >
      {/* grip */}
      <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />

      {/* icon */}
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${def.iconClass}`}>
        <def.Icon className="h-3.5 w-3.5" />
      </span>

      {/* text */}
      <div className="min-w-0">
        <p className="text-xs font-semibold leading-none">{def.label}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground leading-tight truncate">
          {def.description}
        </p>
      </div>
    </div>
  );
}

// ── Palette panel ──────────────────────────────────────────────────────────────

export function TimelinePalette() {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Drag to add
      </p>
      {PALETTE_CARDS.map((def) => (
        <PaletteCard key={def.kind} def={def} />
      ))}
    </div>
  );
}
