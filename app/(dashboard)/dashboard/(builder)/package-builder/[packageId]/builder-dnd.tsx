"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Dragging catalog items out of the sidebar and onto a day.
//
// Native HTML5 drag-and-drop, deliberately, even though the builder already
// uses dnd-kit for day reordering. Two reasons:
//
//   • The source and the target live in two independent scroll containers a
//     screen apart. Native DnD gets edge auto-scroll from the browser for
//     free; dnd-kit needs both scrollers registered and still fights the
//     document's own scrolling.
//   • ItineraryDocument is also the public client-facing page and the PDF
//     source. Putting dnd-kit's droppables in it would ship the whole library
//     to every visitor who opens an itinerary link, to power an interaction
//     that only exists behind a login.
//
// One quirk shapes the design: dataTransfer's *payload* is unreadable during
// dragover — only its `types` are. So the item's kind is encoded as the MIME
// type itself. That's what lets a day's stay slot know a hotel is overhead and
// light up, while ignoring an activity.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { cn } from "@/app/lib/utils";
import { useOptionalBuilder } from "./builder-context";
import {
  applyHotelRoomSelection, applyVehicleSelection, continuesStayFrom,
  type AnyVehicleHit,
} from "./day-mutations";
import type { HotelRoomResult, ActivityResult } from "../action";

export type DragKind = "hotel" | "activity" | "cab";

export type CatalogDrag =
  | { kind: "hotel"; item: HotelRoomResult }
  | { kind: "activity"; item: ActivityResult }
  | { kind: "cab"; item: AnyVehicleHit };

/** The kind travels as the MIME type, because that's the only part of a
 * dataTransfer a dragover handler is allowed to read. */
const MIME: Record<DragKind, string> = {
  hotel: "application/x-builder-hotel",
  activity: "application/x-builder-activity",
  cab: "application/x-builder-cab",
};

// ─────────────────────────────────────────────────────────────────────────────
// What's currently being dragged
//
// A module-level store rather than context: the drag source is in the sidebar
// and the slots that need to light up are deep inside the document, and a
// provider spanning both would have to wrap a component tree that also renders
// outside the builder entirely. useSyncExternalStore keeps every subscriber on
// the same value with no provider at all.
// ─────────────────────────────────────────────────────────────────────────────

let activeKind: DragKind | null = null;
const listeners = new Set<() => void>();

function setActiveKind(kind: DragKind | null) {
  if (activeKind === kind) return;
  activeKind = kind;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Which kind of catalog item is mid-drag, or null. Server-rendered as null:
 * nothing is being dragged during SSR by definition. */
export function useActiveDragKind(): DragKind | null {
  return useSyncExternalStore(subscribe, () => activeKind, () => null);
}

// ─────────────────────────────────────────────────────────────────────────────
// Drag source
// ─────────────────────────────────────────────────────────────────────────────

/** Spread onto whatever the exec grabs in the sidebar. */
export function dragSourceProps(drag: CatalogDrag): React.HTMLAttributes<HTMLElement> & { draggable: true } {
  return {
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData(MIME[drag.kind], JSON.stringify(drag.item));
      // A text fallback so dropping outside the app does something sane
      // instead of navigating away to a garbage URL.
      e.dataTransfer.setData("text/plain", labelFor(drag));
      e.dataTransfer.effectAllowed = "copy";
      setActiveKind(drag.kind);
    },
    onDragEnd: () => setActiveKind(null),
  };
}

function labelFor(drag: CatalogDrag): string {
  switch (drag.kind) {
    case "hotel": return `${drag.item.hotelName} — ${drag.item.roomName}`;
    case "activity": return drag.item.name;
    case "cab": return "vehicleName" in drag.item ? drag.item.vehicleName : drag.item.name;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Drop target
// ─────────────────────────────────────────────────────────────────────────────

/** What a slot on a day will take.
 *
 * A rendered section takes exactly one kind — a day's stay section has no
 * meaning for an activity, and pretending otherwise would mean guessing. The
 * day's single "Add to this day" control takes all three, because an empty day
 * has no sections to aim at and that button is the only thing on screen to
 * drop onto. Which one it becomes is read off the payload's MIME type, so it's
 * still the drag that decides, not a guess. */
export type SlotKind = DragKind;

/**
 * Wraps a section of a day card so a dragged catalog item can be dropped on it.
 *
 * Renders children untouched outside the builder, when editing is off, and
 * during export — the document has three lives and only one of them drags.
 */
export function DaySlot({ day, accepts, children, className }: {
  day: number;
  accepts: SlotKind | SlotKind[];
  children: React.ReactNode;
  className?: string;
}) {
  const builder = useOptionalBuilder();
  if (!builder?.canEdit) return <>{children}</>;
  return (
    <ActiveDaySlot day={day} accepts={accepts} className={className}>
      {children}
    </ActiveDaySlot>
  );
}

function ActiveDaySlot({ day, accepts, children, className }: {
  day: number;
  accepts: SlotKind | SlotKind[];
  children: React.ReactNode;
  className?: string;
}) {
  const { form, replaceDay } = useOptionalBuilder()!;
  const dragging = useActiveDragKind();
  const [over, setOver] = useState(false);

  const kinds = Array.isArray(accepts) ? accepts : [accepts];
  // What this drag would actually become if dropped here. Null when the slot
  // doesn't want it — which is also what keeps the highlight honest.
  const landing = dragging && kinds.includes(dragging) ? dragging : null;
  const armed = landing != null;

  // A stay that continues from an earlier day is one reservation. Dropping a
  // different hotel onto the middle of it would leave a run no hotel could
  // honour, so this slot declines rather than quietly splitting the booking.
  const blocked = landing === "hotel" ? continuesStayFrom(form.itineraries, day) : null;

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    setActiveKind(null);

    // The payload's own MIME type says which kind arrived, so a multi-kind
    // slot doesn't have to trust the hover state to still be current.
    const list = Array.isArray(accepts) ? accepts : [accepts];
    const arrived = list.find((k) => e.dataTransfer.types.includes(MIME[k]));
    if (!arrived) return;

    const raw = e.dataTransfer.getData(MIME[arrived]);
    if (!raw) return;

    let item: unknown;
    try {
      item = JSON.parse(raw);
    } catch {
      // The payload is something this build didn't write — a stale tab from a
      // previous deploy, or another app's drag entirely. Dropping silently is
      // better than throwing inside a drop handler.
      return;
    }

    switch (arrived) {
      case "hotel": {
        // Re-checked here rather than reused from `blocked` above: that's
        // derived from the hover state, and a multi-kind slot may not have
        // been hovering a hotel.
        const run = continuesStayFrom(form.itineraries, day);
        if (run) {
          toast.error(`Day ${day}'s stay is part of a booking that starts on day ${run}. Change it there.`);
          return;
        }
        const room = item as HotelRoomResult;
        replaceDay(day, (it) => applyHotelRoomSelection(it, room));
        toast.success(`Day ${day}: ${room.hotelName}`);
        break;
      }
      case "cab": {
        const hit = item as AnyVehicleHit;
        replaceDay(day, (it) => applyVehicleSelection(it, hit));
        toast.success(`Day ${day}: ${"vehicleName" in hit ? hit.vehicleName : hit.name}`);
        break;
      }
      case "activity": {
        const a = item as ActivityResult;
        // Same shape the experiences drawer builds, so a dragged activity and a
        // clicked one produce the identical day.
        replaceDay(day, (it) => ({
          ...it,
          activities: [...it.activities, {
            title: a.name,
            description: a.description ?? "",
            photo: a.photos[0] ?? a.thumbnail ?? "",
            photos: a.photos.slice(0, 3),
            photoLabels: a.photoLabels.slice(0, 3),
          }],
        }));
        toast.success(`Day ${day}: ${a.name}`);
        break;
      }
    }
  }, [accepts, day, form.itineraries, replaceDay]);

  return (
    <div
      onDragOver={(e) => {
        // Only claim drags this slot can actually take. Not calling
        // preventDefault is what tells the browser "not a drop target here",
        // which is also what gives the cursor its no-entry badge.
        if (!kinds.some((k) => e.dataTransfer.types.includes(MIME[k]))) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = blocked ? "none" : "copy";
        if (!over) setOver(true);
      }}
      onDragLeave={(e) => {
        // Ignore the dragleave that fires when the pointer crosses onto a
        // child — the relatedTarget is still inside this slot.
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setOver(false);
      }}
      onDrop={onDrop}
      className={cn(
        "relative rounded-lg transition-colors duration-[120ms]",
        // Armed but not hovered: a faint dashed hint on every slot that could
        // take this item, so the drop targets are discoverable rather than
        // something you have to already know about.
        armed && !blocked && "outline-2 outline-dashed outline-offset-2 outline-dashboard-primary/25",
        armed && blocked && "outline-2 outline-dashed outline-offset-2 outline-red-400/30",
        over && !blocked && "outline-dashboard-primary bg-dashboard-primary/[0.06]",
        over && blocked && "outline-red-400 bg-red-50/60",
        className,
      )}
    >
      {children}
      {over && (
        <span
          className={cn(
            "no-print absolute -top-2.5 left-2 z-30 rounded-full px-2 py-0.5",
            "text-[10px] font-semibold text-white shadow-sm",
            blocked ? "bg-red-500" : "bg-dashboard-primary",
          )}
        >
          {blocked ? `Starts on day ${blocked}` : landing ? DROP_LABEL[landing](day) : ""}
        </span>
      )}
    </div>
  );
}

const DROP_LABEL: Record<SlotKind, (day: number) => string> = {
  hotel: (d) => `Set day ${d}'s stay`,
  cab: (d) => `Set day ${d}'s transport`,
  activity: (d) => `Add to day ${d}`,
};
