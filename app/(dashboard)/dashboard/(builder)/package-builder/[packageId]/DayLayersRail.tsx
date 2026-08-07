"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Day rail — structure, navigation and readiness in one narrow column.
//
// Borrowed from the layers panel in Figma/Canva, and deliberately narrower in
// scope than one. It lists DAYS only, not the document's sections: hero,
// places, tickets, itinerary, price summary, inclusions and terms render in a
// fixed order that is a deliberate reading sequence for a client, and making
// that draggable would mean an exec can produce a document where terms precede
// the itinerary — worse for the reader, with nothing stopping it.
//
// What it does earn:
//   • Reordering. Dragging a 400px day card is miserable; dragging a row is
//     not. This is also the only place days can be reordered at all now.
//   • Navigation. Eight days is a long scroll.
//   • Readiness. Dots for stay / transport / experiences, so "day 4 has no
//     cab" is visible without scrolling or failing at Mark Ready — the
//     checklist idea from the original plan, which had nowhere else to live.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, PanelLeftClose, PanelLeftOpen, Hotel, Car, Sparkles, Plus } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { useBuilder } from "./builder-context";

/** Scrolls the preview to a day. The document tags each card with this id. */
function jumpToDay(day: number) {
  document.getElementById(`builder-day-${day}`)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function ReadyDot({ on, title, icon: Icon }: { on: boolean; title: string; icon: React.ElementType }) {
  return (
    <span
      title={title}
      className={cn(
        "flex items-center justify-center size-4 rounded-full shrink-0",
        on ? "text-dashboard-primary" : "text-dashboard-base-content/20",
      )}
    >
      <Icon size={10} />
    </span>
  );
}

function DayRow({ id, index }: { id: string; index: number }) {
  const { form, dayCosts } = useBuilder();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const d = form.itineraries[index];
  if (!d) return null;

  const cost = dayCosts.get(d.day);
  const hasStay = !!d.accommodation || !!d.hotelPending;
  const hasCab = !!d.transport || d.cabPricingId != null;
  const hasActs = d.activities.some((a) => a.title.trim());

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group flex items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-left",
        isDragging ? "bg-dashboard-base-200 shadow-sm" : "hover:bg-dashboard-base-200/60",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder day ${d.day}`}
        className="shrink-0 cursor-grab text-dashboard-base-content/25 hover:text-dashboard-base-content/60"
      >
        <GripVertical size={13} />
      </button>

      <button
        type="button"
        onClick={() => jumpToDay(d.day)}
        className="flex-1 min-w-0 text-left"
      >
        <div className="flex items-baseline gap-1.5">
          <span className="text-[11px] font-bold tabular-nums text-dashboard-primary shrink-0">
            {String(d.day).padStart(2, "0")}
          </span>
          <span className="text-[11px] truncate text-dashboard-base-content/80">
            {d.title || "Untitled day"}
          </span>
        </div>
        <div className="flex items-center gap-0.5 mt-0.5">
          <ReadyDot on={hasStay} icon={Hotel} title={hasStay ? "Stay set" : "No stay yet"} />
          <ReadyDot on={hasCab} icon={Car} title={hasCab ? "Transport set" : "No transport yet"} />
          <ReadyDot on={hasActs} icon={Sparkles} title={hasActs ? "Experiences added" : "No experiences yet"} />
          {cost && cost.total > 0 && (
            <span className="ml-auto text-[9.5px] tabular-nums text-dashboard-base-content/45">
              ₹{cost.total.toLocaleString("en-IN")}
            </span>
          )}
        </div>
      </button>
    </div>
  );
}

export function DayLayersRail() {
  const { form, canEdit, moveDay, addDayAfter } = useBuilder();
  const [open, setOpen] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Identity for dnd-kit. Day numbers are positional and change on every
  // reorder, so they can't be the drag id — the index is stable for the
  // duration of a drag, which is all dnd-kit needs.
  const ids = form.itineraries.map((_, i) => `layer-${i}`);

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    moveDay(ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
  }

  if (!canEdit) return null;

  if (!open) {
    return (
      <div className="no-print shrink-0 border-r border-dashboard-base-300 bg-dashboard-base-100 px-1 py-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Show days"
          aria-label="Show days"
          className="flex items-center justify-center size-7 rounded-md text-dashboard-base-content/50 hover:bg-dashboard-base-200"
        >
          <PanelLeftOpen size={14} />
        </button>
      </div>
    );
  }

  return (
    <aside className="no-print shrink-0 w-52 border-r border-dashboard-base-300 bg-dashboard-base-100 flex flex-col">
      <div className="flex items-center justify-between gap-1 px-2.5 py-2 border-b border-dashboard-base-300">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-dashboard-base-content/50">
          Days
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          title="Hide days"
          aria-label="Hide days"
          className="flex items-center justify-center size-6 rounded-md text-dashboard-base-content/40 hover:bg-dashboard-base-200"
        >
          <PanelLeftClose size={13} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            {ids.map((id, i) => <DayRow key={id} id={id} index={i} />)}
          </SortableContext>
        </DndContext>
      </div>

      <div className="p-1.5 border-t border-dashboard-base-300">
        <button
          type="button"
          onClick={() => addDayAfter(form.itineraries.length)}
          className="w-full flex items-center justify-center gap-1 rounded-md border border-dashed border-dashboard-base-300 py-1.5 text-[11px] font-medium text-dashboard-base-content/60 hover:bg-dashboard-base-200/60"
        >
          <Plus size={11} /> Add day {form.itineraries.length + 1}
        </button>
      </div>
    </aside>
  );
}
