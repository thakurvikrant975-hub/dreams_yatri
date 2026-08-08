"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Day layers — structure and navigation in one narrow column on the left.
//
// Borrowed from the layers panel in Figma/Canva, and deliberately narrower in
// scope than one. It lists DAYS only, not the document's sections: hero,
// places, tickets, itinerary, price summary, inclusions and terms render in a
// fixed order that is a deliberate reading sequence for a client, and making
// that draggable would mean an exec can produce a document where terms precede
// the itinerary — worse for the reader, with nothing stopping it.
//
// It shares one thing with the Itinerary section on the right: which day is
// selected, via the provider. Clicking day 5 here scrolls the preview to day 5
// AND swings the right-hand elements list onto day 5 — the two panels are two
// views of one choice, and letting each keep its own would mean the left rail
// could say "day 5" while the right offered day 1's stay.
//
// Where the right-hand chips answer "which day", this answers "in what order,
// and is it finished" — it has the width for titles and labelled readiness
// icons, which a 44px chip does not.
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
import { dayReadiness } from "./day-mutations";

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
  const { form, dayCosts, selectedDay, setSelectedDay } = useBuilder();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const d = form.itineraries[index];
  if (!d) return null;

  const cost = dayCosts.get(d.day);
  const ready = dayReadiness(d);
  const selected = selectedDay === d.day;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group flex items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-left",
        isDragging && "bg-dashboard-base-200 shadow-sm",
        !isDragging && selected && "bg-dashboard-primary/[0.08]",
        !isDragging && !selected && "hover:bg-dashboard-base-200/60",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder day ${d.day}`}
        className="shrink-0 cursor-grab active:cursor-grabbing text-dashboard-base-content/25 hover:text-dashboard-base-content/60"
      >
        <GripVertical size={13} />
      </button>

      <button
        type="button"
        onClick={() => { setSelectedDay(d.day); jumpToDay(d.day); }}
        aria-pressed={selected}
        className="flex-1 min-w-0 text-left"
      >
        <div className="flex items-baseline gap-1.5">
          <span className="text-[11px] font-bold tabular-nums text-dashboard-primary shrink-0">
            {String(d.day).padStart(2, "0")}
          </span>
          <span className={cn(
            "text-[11px] truncate",
            selected ? "text-dashboard-base-content font-medium" : "text-dashboard-base-content/80",
          )}>
            {d.title || "Untitled day"}
          </span>
        </div>
        <div className="flex items-center gap-0.5 mt-0.5">
          <ReadyDot on={ready.stay} icon={Hotel} title={ready.stay ? "Stay set" : "No stay yet"} />
          <ReadyDot on={ready.transport} icon={Car} title={ready.transport ? "Transport set" : "No transport yet"} />
          <ReadyDot on={ready.experiences} icon={Sparkles} title={ready.experiences ? "Experiences added" : "No experiences yet"} />
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
  const { form, canEdit, moveDay, addDayAfter, setSelectedDay } = useBuilder();
  // Collapsed by default. The Itinerary section on the right lists the same
  // days and is where the per-day work happens, so opening with both expanded
  // spends 208px of document width on a second copy of information already on
  // screen. Reordering is worth the column when you want it — it just isn't
  // what most sessions start with.
  const [open, setOpen] = useState(false);

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
    const to = ids.indexOf(String(over.id));
    moveDay(ids.indexOf(String(active.id)), to);
    // Follow the day that was just dragged. Its number is now its new
    // position, and staying on whatever number happens to sit where it used to
    // be would look like the selection jumped to a different day.
    setSelectedDay(to + 1);
  }

  // Nothing here is readable-only: reordering and adding are the entire
  // purpose, and both are off once the package is locked for costing review.
  // The Itinerary section on the right still lists the days for a reviewer.
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
          onClick={() => {
            addDayAfter(form.itineraries.length);
            setSelectedDay(form.itineraries.length + 1);
          }}
          className="w-full flex items-center justify-center gap-1 rounded-md border border-dashed border-dashboard-base-300 py-1.5 text-[11px] font-medium text-dashboard-base-content/60 hover:bg-dashboard-base-200/60"
        >
          <Plus size={11} /> Add day {form.itineraries.length + 1}
        </button>
      </div>
    </aside>
  );
}
