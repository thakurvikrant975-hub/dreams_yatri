"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Day list — structure, navigation and readiness for the sidebar's Itinerary
// section.
//
// This used to be a third column pinned to the LEFT of the preview, which put
// the builder's controls on both edges of a document that wanted the width
// more than either of them did. It now lives in the right-hand panel like
// everything else; the document gained a sticky day-tab strip for the plain
// "take me to day 6" case, so what's left here is the work that genuinely
// needs a list: reordering, deleting, and seeing at a glance which days are
// still missing something.
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

import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Hotel, Car, Sparkles, Plus, Trash2 } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { useBuilder } from "./builder-context";
import { Empty } from "./builder-ui";

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

/** Everything a row shows, minus the drag handle and delete — shared so the
 * locked-for-review list is the same list, not a second one that can drift. */
function DayRowContent({ index }: { index: number }) {
  const { form, dayCosts } = useBuilder();
  const d = form.itineraries[index];
  if (!d) return null;

  const cost = dayCosts.get(d.day);
  const hasStay = !!d.accommodation || !!d.hotelPending;
  const hasCab = !!d.transport || d.cabPricingId != null;
  const hasActs = d.activities.some((a) => a.title.trim());

  return (
    <button
      type="button"
      onClick={() => jumpToDay(d.day)}
      className="flex-1 min-w-0 text-left"
    >
      <div className="flex items-baseline gap-1.5">
        <span className="text-[11px] font-bold tabular-nums text-dashboard-primary shrink-0">
          {String(d.day).padStart(2, "0")}
        </span>
        <span className="text-[11.5px] truncate text-dashboard-base-content/80">
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
  );
}

function StaticDayRow({ index }: { index: number }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg px-1.5 py-1.5 hover:bg-dashboard-base-200/60">
      <DayRowContent index={index} />
    </div>
  );
}

function DayRow({ id, index }: { id: string; index: number }) {
  const { form, removeDay } = useBuilder();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const d = form.itineraries[index];
  if (!d) return null;

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

      <DayRowContent index={index} />

      {/* Hidden until hover: a delete sitting permanently beside every row in a
          ten-row list is ten chances to lose a day's work by mis-aiming. The
          last day has none — a package with no days can't be built at all. */}
      {form.itineraries.length > 1 && (
        <button
          type="button"
          onClick={() => removeDay(d.day)}
          aria-label={`Delete day ${d.day}`}
          title={`Delete day ${d.day}`}
          className="shrink-0 flex items-center justify-center size-6 rounded-md text-dashboard-base-content/30 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
}

export function DayListPanel() {
  const { form, canEdit, moveDay, addDayAfter } = useBuilder();

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

  const addDay = (
    <button
      type="button"
      onClick={() => addDayAfter(form.itineraries.length)}
      className="w-full flex items-center justify-center gap-1 rounded-lg border border-dashed border-dashboard-base-300 py-2 text-[11.5px] font-medium text-dashboard-base-content/60 hover:bg-dashboard-base-200/60"
    >
      <Plus size={12} /> Add day {form.itineraries.length + 1}
    </button>
  );

  // Locked for costing review: the list still reads — readiness and structure
  // are exactly what someone reviewing wants — it just can't be rearranged.
  if (!canEdit) {
    return (
      <div className="p-3 space-y-0.5">
        {form.itineraries.map((d) => (
          <StaticDayRow key={d.day} index={d.day - 1} />
        ))}
      </div>
    );
  }

  if (form.itineraries.length === 0) {
    return (
      <div className="p-3">
        <Empty action={addDay}>No days yet. Every itinerary starts with one.</Empty>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2">
      <div className="space-y-0.5">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            {ids.map((id, i) => <DayRow key={id} id={id} index={i} />)}
          </SortableContext>
        </DndContext>
      </div>
      {addDay}
    </div>
  );
}
