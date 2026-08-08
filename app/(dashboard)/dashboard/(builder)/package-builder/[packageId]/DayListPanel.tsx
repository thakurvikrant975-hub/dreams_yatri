"use client";

// ─────────────────────────────────────────────────────────────────────────────
// The sidebar's Itinerary section — pick a day, then work on it.
//
// Two halves, and the split is the whole idea:
//
//   Days      A wrapping row of numbered chips. Drag to reorder, click to
//             select. A row rather than the one-per-line list this used to be,
//             because a day is identified by its NUMBER — the title is a nice
//             confirmation but nobody navigates by it. Twelve numbers fit in
//             three rows; twelve titled rows need a scroll, and the scroll was
//             hiding exactly the readiness information the list existed for.
//
//   Elements  Every part a day can have — stay, transport, experiences, meals,
//             note, add-ons — listed for whichever day is selected, each
//             showing what's actually in it. Click to open that part's editor,
//             or clear it from the day outright.
//
// The elements list is also the honest answer to "what am I missing on day 4".
// Readiness dots on a chip can only say yes/no about three things; this says
// "Transport — not added" in words, next to the control that fixes it.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Hotel, Car, Sparkles, UtensilsCrossed, StickyNote, Gift,
  Plus, X, Trash2, ChevronRight,
} from "lucide-react";
import { cn } from "@/app/lib/utils";
import { useBuilder, type DrawerTarget } from "./builder-context";
import { clearHotelSelection, clearVehicleSelection, continuesStayFrom } from "./day-mutations";
import { Empty, Group } from "./builder-ui";
import type { DayItinerary } from "../action";

/** Scrolls the preview to a day. Every day card carries this id. */
function jumpToDay(day: number) {
  document.getElementById(`builder-day-${day}`)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ─────────────────────────────────────────────────────────────────────────────
// Days
// ─────────────────────────────────────────────────────────────────────────────

/** Three micro-dots under the day number: stay, transport, experiences. Not a
 * substitute for the elements list below — this is the "which day should I
 * look at" glance, that's the "what does it need" answer. */
function ChipDots({ d }: { d: DayItinerary }) {
  const on = [
    !!d.accommodation || !!d.hotelPending,
    !!d.transport || d.cabPricingId != null,
    d.activities.some((a) => a.title.trim()),
  ];
  return (
    <span className="flex items-center gap-[3px]">
      {on.map((v, i) => (
        <span
          key={i}
          className={cn(
            "size-[3.5px] rounded-full",
            v ? "bg-dashboard-primary" : "bg-dashboard-base-content/20",
          )}
        />
      ))}
    </span>
  );
}

const chipClass = (selected: boolean) => cn(
  "flex flex-col items-center justify-center gap-1 size-11 shrink-0 rounded-[10px] border",
  "transition-colors duration-[120ms]",
  selected
    ? "border-dashboard-primary bg-dashboard-primary/10 text-dashboard-primary"
    : "border-dashboard-base-300 text-dashboard-base-content/70 hover:bg-dashboard-base-200/60",
);

function ChipFace({ d }: { d: DayItinerary }) {
  return (
    <>
      <span className="text-[12px] font-bold tabular-nums leading-none">
        {String(d.day).padStart(2, "0")}
      </span>
      <ChipDots d={d} />
    </>
  );
}

function DayChip({ id, index, selected, onSelect }: {
  id: string; index: number; selected: boolean; onSelect: () => void;
}) {
  const { form } = useBuilder();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const d = form.itineraries[index];
  if (!d) return null;

  return (
    <button
      ref={setNodeRef}
      type="button"
      // The chip IS the drag handle. At 44px there's no room for a separate
      // grip, and a chip is small enough to drag comfortably by its whole
      // body — the 4px activation distance keeps a click from becoming one.
      {...attributes}
      {...listeners}
      onClick={onSelect}
      title={d.title || `Day ${d.day}`}
      aria-pressed={selected}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        chipClass(selected),
        "cursor-grab active:cursor-grabbing",
        isDragging && "shadow-md z-10",
      )}
    >
      <ChipFace d={d} />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Elements
// ─────────────────────────────────────────────────────────────────────────────

type Element = {
  icon: React.ElementType;
  label: string;
  /** What's in it now, or null for "nothing yet". */
  value: string | null;
  /** Where clicking goes — the same drawer the preview would have opened. */
  open: DrawerTarget;
  /** Takes it off the day. Absent when there's nothing to take off, and when
   * removal isn't this surface's call to make. */
  clear?: () => void;
  /** Blocks removal with a reason, rather than silently doing something
   * surprising — a continued stay belongs to the day that booked it. */
  clearBlockedBy?: string;
};

function ElementRow({ el, canEdit }: { el: Element; canEdit: boolean }) {
  const { openDrawer } = useBuilder();
  const filled = el.value != null;

  return (
    <div className="group flex items-stretch rounded-[10px] border border-dashboard-base-300 hover:bg-dashboard-base-200/40 transition-colors duration-[120ms]">
      <button
        type="button"
        onClick={() => openDrawer(el.open)}
        className="flex-1 min-w-0 flex items-center gap-2.5 px-2.5 py-2 text-left"
      >
        <el.icon
          size={14}
          className={cn("shrink-0", filled ? "text-dashboard-primary" : "text-dashboard-base-content/30")}
        />
        <span className="flex-1 min-w-0">
          <span className="block text-[11.5px] font-medium text-dashboard-base-content/85">
            {el.label}
          </span>
          <span
            className={cn(
              "block text-[10.5px] truncate",
              filled ? "text-dashboard-base-content/55" : "text-dashboard-base-content/35 italic",
            )}
          >
            {el.value ?? "Not added"}
          </span>
        </span>
        {!filled && canEdit && <Plus size={12} className="shrink-0 text-dashboard-base-content/30" />}
        {filled && <ChevronRight size={12} className="shrink-0 text-dashboard-base-content/25" />}
      </button>

      {/* Only ever shown for something that IS on the day — a clear button next
          to an empty row is a control that does nothing. */}
      {filled && canEdit && (el.clear || el.clearBlockedBy) && (
        <button
          type="button"
          onClick={() => el.clear?.()}
          disabled={!el.clear}
          aria-label={`Remove ${el.label.toLowerCase()}`}
          title={el.clearBlockedBy ?? `Remove ${el.label.toLowerCase()} from this day`}
          className={cn(
            "shrink-0 flex items-center justify-center w-8 rounded-r-[10px] transition-opacity",
            el.clear
              ? "text-dashboard-base-content/25 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-red-50 hover:text-red-600"
              : "text-dashboard-base-content/15 cursor-not-allowed opacity-0 group-hover:opacity-100",
          )}
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

/** Everything day `n` can hold, in the order it appears in the document. */
function elementsFor(
  form: ReturnType<typeof useBuilder>["form"],
  n: number,
  replaceDay: ReturnType<typeof useBuilder>["replaceDay"],
  setForm: ReturnType<typeof useBuilder>["setForm"],
): Element[] {
  const d = form.itineraries.find((it) => it.day === n);
  if (!d) return [];

  const acts = d.activities.filter((a) => a.title.trim());
  const dayAddons = form.addOns.filter((a) => a.day === n);
  const continuedFrom = continuesStayFrom(form.itineraries, n);

  const stayValue = d.accommodation
    ? d.accommodation
    : d.hotelPending
      ? "Requested from the hotel team"
      : null;

  return [
    {
      icon: Hotel,
      label: "Stay",
      value: stayValue,
      open: { kind: d.accommodation ? "hotel-edit" : "hotel-replace", day: n },
      // A multi-night booking is one reservation. Clearing the middle of it
      // here would leave a run the hotel can't honour, so removal has to
      // happen on the day that started it.
      clear: continuedFrom
        ? undefined
        : () => replaceDay(n, (it) => ({
            ...clearHotelSelection(it),
            hotelPending: false,
            hotelPendingNote: "",
            hotelRequestType: null,
          })),
      clearBlockedBy: continuedFrom
        ? `Part of a stay that starts on day ${continuedFrom} — remove it there`
        : undefined,
    },
    {
      icon: Car,
      label: "Transport",
      value: d.transport || null,
      open: { kind: "transfer-edit", day: n },
      clear: () => replaceDay(n, clearVehicleSelection),
    },
    {
      icon: Sparkles,
      label: "Experiences",
      value: acts.length ? acts.map((a) => a.title.trim()).join(", ") : null,
      open: { kind: "activities-edit", day: n },
      clear: () => replaceDay(n, (it) => ({ ...it, activities: [] })),
    },
    {
      icon: UtensilsCrossed,
      label: "Meals",
      value: d.meals.length ? d.meals.join(", ") : null,
      open: { kind: "meals-edit", day: n },
      clear: () => replaceDay(n, (it) => ({ ...it, meals: [] })),
    },
    {
      icon: StickyNote,
      label: "Note",
      value: d.notesTitle?.trim() || d.notes.trim() || null,
      open: { kind: "note-edit", day: n },
      clear: () => replaceDay(n, (it) => ({
        ...it, notes: "", notesType: null, notesTitle: null,
      })),
    },
    {
      icon: Gift,
      label: "Add-ons",
      value: dayAddons.length ? dayAddons.map((a) => a.name).join(", ") : null,
      open: { kind: "addons-edit", day: n },
      // Add-ons live on the package keyed by day, not inside the day, so this
      // is the one clear that can't go through replaceDay.
      clear: () => setForm((f) => ({ ...f, addOns: f.addOns.filter((a) => a.day !== n) })),
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────

export function DayListPanel() {
  const builder = useBuilder();
  const { form, canEdit, moveDay, addDayAfter, removeDay, replaceDay, setForm } = builder;

  const days = form.itineraries;
  const [selectedDay, setSelectedDay] = useState(1);

  // Days are renumbered on every insert, delete and reorder, so the selection
  // has to be re-derived rather than trusted. Falling back to the last day
  // means deleting the day you were on lands you somewhere real instead of on
  // an empty elements list.
  const current = days.find((d) => d.day === selectedDay) ?? days[days.length - 1];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Identity for dnd-kit. Day numbers are positional and change on every
  // reorder, so they can't be the drag id — the index is stable for the
  // duration of a drag, which is all dnd-kit needs.
  const ids = days.map((_, i) => `layer-${i}`);

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    moveDay(from, to);
    // Follow the day that was just dragged. Its number is now its new
    // position, and staying on whatever number happens to sit where it used to
    // be would look like the selection jumped to a different day.
    setSelectedDay(to + 1);
  }

  function select(day: number) {
    setSelectedDay(day);
    jumpToDay(day);
  }

  const addDay = (
    <button
      type="button"
      onClick={() => { addDayAfter(days.length); setSelectedDay(days.length + 1); }}
      title={`Add day ${days.length + 1}`}
      aria-label={`Add day ${days.length + 1}`}
      className="flex items-center justify-center size-11 shrink-0 rounded-[10px] border border-dashed border-dashboard-base-300 text-dashboard-base-content/45 hover:bg-dashboard-base-200/60 hover:text-dashboard-base-content"
    >
      <Plus size={15} />
    </button>
  );

  if (days.length === 0) {
    return (
      <div className="p-4">
        <Empty action={canEdit ? addDay : undefined}>
          No days yet. Every itinerary starts with one.
        </Empty>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5">
      <Group label="Days" hint={canEdit ? "Drag to reorder. Click to open a day." : undefined}>
        <div className="flex flex-wrap gap-1.5">
          {canEdit ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={ids} strategy={rectSortingStrategy}>
                {ids.map((id, i) => (
                  <DayChip
                    key={id}
                    id={id}
                    index={i}
                    selected={current?.day === i + 1}
                    onSelect={() => select(i + 1)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          ) : (
            // Locked for costing review: still the same chips, still navigable
            // — structure and readiness are exactly what a reviewer wants — but
            // nothing here rearranges the trip.
            days.map((d) => (
              <button
                key={d.day}
                type="button"
                onClick={() => select(d.day)}
                title={d.title || `Day ${d.day}`}
                aria-pressed={current?.day === d.day}
                className={chipClass(current?.day === d.day)}
              >
                <ChipFace d={d} />
              </button>
            ))
          )}
          {canEdit && addDay}
        </div>
      </Group>

      {current && (
        <Group
          label={`Day ${current.day} — elements`}
          action={
            canEdit && days.length > 1 ? (
              <button
                type="button"
                onClick={() => removeDay(current.day)}
                title={`Delete day ${current.day}`}
                className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[10.5px] font-medium text-dashboard-base-content/40 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={11} /> Delete day
              </button>
            ) : undefined
          }
        >
          <p className="text-[11.5px] text-dashboard-base-content/55 -mt-0.5 mb-1 truncate">
            {current.title || "Untitled day"}
          </p>
          <div className="space-y-1.5">
            {elementsFor(form, current.day, replaceDay, setForm).map((el) => (
              <ElementRow key={el.label} el={el} canEdit={canEdit} />
            ))}
          </div>
        </Group>
      )}
    </div>
  );
}
