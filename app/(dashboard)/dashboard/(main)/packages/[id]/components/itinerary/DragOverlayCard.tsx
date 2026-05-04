"use client";

import { BedDouble, Zap, Car, StickyNote } from "lucide-react";
import type { DragData, TimelineItemKind } from "./timeline.types";

const KIND_CONFIG: Record<
  TimelineItemKind,
  { label: string; Icon: React.ElementType; className: string }
> = {
  stay: {
    label: "Stay",
    Icon: BedDouble,
    className: "border-blue-300 bg-blue-50 text-blue-700",
  },
  activity: {
    label: "Activity",
    Icon: Zap,
    className: "border-emerald-300 bg-emerald-50 text-emerald-700",
  },
  transfer: {
    label: "Transfer",
    Icon: Car,
    className: "border-orange-300 bg-orange-50 text-orange-700",
  },
  note: {
    label: "Note",
    Icon: StickyNote,
    className: "border-violet-300 bg-violet-50 text-violet-700",
  },
};

export function DragOverlayCard({ data }: { data: DragData }) {
  const { label, Icon, className } = KIND_CONFIG[data.kind];

  return (
    <div
      className={`flex items-center gap-2 rounded-md border px-3 py-2 shadow-lg cursor-grabbing ${className}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="text-xs font-semibold">{label}</span>
    </div>
  );
}
