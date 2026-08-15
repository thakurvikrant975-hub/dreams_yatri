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

import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { toast } from "sonner";
import {
  Hotel, Car, Sparkles, UtensilsCrossed, StickyNote, Gift,
  Plus, X, Trash2, ChevronRight, Wand2, Copy,
} from "./builder-icons";
import { cn } from "@/app/lib/utils";
import { useBuilder, scrollToDay, type DrawerTarget } from "./builder-context";
import { removeStay, removeTransport, continuesStayFrom, dayReadiness, emptyDay } from "./day-mutations";
import { Empty, Group } from "./builder-ui";
import type { DayItinerary } from "@/app/(dashboard)/dashboard/(builder)/package-builder/action";
import { Button } from "@/app/(dashboard)/dashboard/(main)/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/app/(dashboard)/dashboard/(main)/components/ui/dialog";
import { Textarea } from "@/app/(dashboard)/dashboard/(main)/components/ui/textarea";

// ─────────────────────────────────────────────────────────────────────────────
// Days
// ─────────────────────────────────────────────────────────────────────────────

/** Three micro-dots under the day number: stay, transport, experiences. Not a
 * substitute for the elements list below — this is the "which day should I
 * look at" glance, that's the "what does it need" answer. */
function ChipDots({ d }: { d: DayItinerary }) {
  const r = dayReadiness(d);
  const on = [r.stay, r.transport, r.experiences];
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
  /** Any number can sit on a day, so a filled row still offers "add", not just
   * "open". Without this the row read as a single occupied slot. */
  multiple?: boolean;
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
        {canEdit && (!filled || el.multiple)
          ? <Plus size={12} className="shrink-0 text-dashboard-base-content/30" />
          : filled && <ChevronRight size={12} className="shrink-0 text-dashboard-base-content/25" />}
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
        : () => replaceDay(n, removeStay),
      clearBlockedBy: continuedFrom
        ? `Part of a stay that starts on day ${continuedFrom} — remove it there`
        : undefined,
    },
    {
      icon: Car,
      label: "Transport",
      value: d.transport || null,
      open: { kind: "transfer-edit", day: n },
      clear: () => replaceDay(n, removeTransport),
    },
    {
      icon: Sparkles,
      label: "Experiences",
      value: acts.length ? acts.map((a) => a.title.trim()).join(", ") : null,
      open: { kind: "activities-edit", day: n },
      multiple: true,
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
// AI Itinerary Builder — copy-a-prompt / paste-back-JSON workflow: no direct
// LLM API call from this app — the exec copies the generated prompt into
// their own ChatGPT session, pastes the JSON it returns back here, and we
// parse + merge it into the form. Kept strictly additive (never overwrites a
// day/field the exec has already filled in).
// ─────────────────────────────────────────────────────────────────────────────

/** Detects the "[label](https://...)" markdown-link/citation pattern
 * sometimes left behind when copying a JSON response out of ChatGPT's chat
 * bubble (as opposed to its code block's own copy button) — a link wrapped
 * around plain text inside a JSON string is still syntactically valid JSON,
 * so JSON.parse succeeds but every wrapped field ends up garbled. Recurses
 * through the whole parsed value looking for the tell-tale "](http" bytes. */
function looksLikeMarkdownLinkCorruption(value: unknown): boolean {
  if (typeof value === "string") return /\]\(https?:\/\//.test(value);
  if (Array.isArray(value)) return value.some(looksLikeMarkdownLinkCorruption);
  if (value && typeof value === "object") return Object.values(value).some(looksLikeMarkdownLinkCorruption);
  return false;
}

type AIItineraryActivity = { title?: string; description?: string; photos?: string[] };
type AIItineraryDay = {
  day?: number; title?: string; description?: string;
  transportPickup?: string; transportDrop?: string; transportDistanceKm?: number;
  travelTimeApprox?: string; activities?: AIItineraryActivity[];
};
type AIItineraryResponse = {
  description?: string; coverImage?: string;
  stops?: { name?: string; image?: string }[];
  days?: AIItineraryDay[];
};

// ─────────────────────────────────────────────────────────────────────────────

export function DayListPanel() {
  const builder = useBuilder();
  const { form, canEdit, moveDay, addDayAfter, removeDay, replaceDay, setForm } = builder;

  const { selectedDay, setSelectedDay } = builder;
  const days = form.itineraries;
  const current = days.find((d) => d.day === selectedDay);

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
    scrollToDay(day);
  }

  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiJsonInput, setAiJsonInput] = useState("");

  /** Builds the copy-paste prompt from the package's current state — title,
   * day count, destinations with night counts (falls back to the single
   * `destination` + total nights when no stops have been added yet), pickup
   * point, and the last day's drop point. */
  function buildAIPrompt(): string {
    const destinationsLine = form.stops.length > 0
      ? form.stops.map((s) => `${s.name} (${s.nights} Night${s.nights !== 1 ? "s" : ""})`).join(", ")
      : `${form.destination || "the destination"} (${Math.max(form.totalNights, 1)} Night${Math.max(form.totalNights, 1) !== 1 ? "s" : ""})`;
    const pickup = form.startingPoint.trim() || "(not specified — choose a sensible pickup point for this destination)";
    const lastDay = form.itineraries[form.itineraries.length - 1];
    const drop = lastDay?.transportDrop.trim() || "(not specified — same as the pickup point unless the route suggests otherwise)";
    const totalPax = form.adults + form.children;
    const paxLine = `${form.adults} Adult${form.adults !== 1 ? "s" : ""}` +
      (form.children > 0 ? ` + ${form.children} Child${form.children !== 1 ? "ren" : ""}` : "");

    return `AI Itinerary Builder Prompt

Create a JSON itinerary for my travel package builder tool so I can paste it directly. Respond with the JSON wrapped in a single \`\`\`json code block — nothing before or after it, no explanation. This matters because I'll copy it using the code block's own copy button.

Critical: every value in the JSON must be a plain string — never a markdown link or citation like [text](url). If you look anything up (e.g. to find real image URLs), still write the result as a plain string value, not a hyperlink/citation. A markdown link anywhere inside the JSON will break the import.

Package: "${form.title || "Untitled Package"}" — ${form.totalDays} Day${form.totalDays !== 1 ? "s" : ""} / ${form.totalNights} Night${form.totalNights !== 1 ? "s" : ""}
Destinations (in order, with nights at each): ${destinationsLine}
Travellers: ${paxLine}${totalPax === 0 ? " (assume 2 adults if unspecified)" : ""}
Pickup point: ${pickup}
Drop point: ${drop}

Spend the itinerary days in the order the destinations are listed, matching the night count at each one.

Return exactly this JSON shape:

{
  "description": "2-3 sentence overview of the whole trip",
  "coverImage": "<a real, working, high-quality landscape photo URL representing the overall trip>",
  "stops": [
    { "name": "<destination name, matching the list above>", "image": "<real landscape photo URL of this destination>" }
  ],
  "days": [
    {
      "day": 1,
      "title": "<day title, under 10 words>",
      "description": "<day description, 35-55 words — see style example below>",
      "transportPickup": "<pickup point for this day's transfer>",
      "transportDrop": "<drop point for this day's transfer>",
      "transportDistanceKm": <approximate distance in km as a number>,
      "travelTimeApprox": "<approx travel time, e.g. \\"2h 30m\\">",
      "activities": [
        {
          "title": "<activity title, a short descriptive phrase — see style example below>",
          "description": "<activity description, 25-40 words — see style example below>",
          "photos": ["<real landscape photo URL 1>", "<real landscape photo URL 2>", "<real landscape photo URL 3>"]
        }
      ]
    }
  ]
}

Style examples (match this tone, level of detail, and length — not generic one-liners):

Day description:
"Arrive at Kochi Airport/Railway Station and meet your driver for a scenic drive to Munnar. En route enjoy waterfalls, tea gardens, and misty valleys. Check in to your hotel and relax in the cool mountain climate. Evening free for leisure or nearby nature walks. (paid activity at your own cost)."

Activity title + description:
"Tea Garden Walk in Munnar" — "Take a refreshing walk through Munnar's sprawling tea plantations, surrounded by rolling green hills and fresh mountain air. Enjoy scenic views, learn about tea cultivation, and experience the tranquil beauty of Kerala's famous hill station."

Note activity titles are a full descriptive phrase naming the place (e.g. "Tea Garden Walk in Munnar", "Fort Kochi Heritage Walk") — never a bare noun like "Tea Gardens" or "Fort Kochi" alone.

Rules:
- Exactly one "days" entry per day (${form.totalDays} total), numbered sequentially from 1.
- 2-3 activities per day is enough — don't overload the day.
- Every image must be a REAL, WORKING, direct image URL that actually loads — from Unsplash, Pexels, Pixabay, a Google Images result, or any other real photo source. Landscape orientation, high quality, visually relevant to that destination/activity. Double-check each URL is real before including it — do not invent or guess a URL.
- Do not include hotel or cab pricing/selection — that's handled separately, manually.
- Keep titles and descriptions professional and vivid, matching the style examples above — no fluff, no emojis.
- One more time: no markdown links, no citations, no [text](url) formatting anywhere in the JSON — plain strings only. Wrap the whole response in a single \`\`\`json code block.`;
  }

  function copyAIPrompt() {
    navigator.clipboard.writeText(buildAIPrompt());
    toast.success("Prompt copied — paste it into ChatGPT, then paste the JSON it gives you back here.");
  }

  /** Parses the pasted JSON and merges it into the form — fills only empty
   * fields (title/description/pickup/drop/distance), replaces a day's
   * activities only when that day currently has none, and extends the
   * itinerary if the response has more days than currently exist. Never
   * touches hotel/cab selection (roomPricingId/cabPricingId untouched). */
  function applyAIItinerary() {
    let parsed: AIItineraryResponse;
    try {
      const cleaned = aiJsonInput.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      toast.error("That doesn't look like valid JSON — check the format and try again.");
      return;
    }
    if (!parsed || typeof parsed !== "object") {
      toast.error("Unexpected response shape — please try again.");
      return;
    }
    if (looksLikeMarkdownLinkCorruption(parsed)) {
      toast.error(
        "This response looks corrupted — it has markdown links mixed into the text (a common artifact of copying from ChatGPT's chat bubble instead of its code block). Ask it to resend as a single ```json code block with no citations, then paste that instead.",
        { duration: 9000 },
      );
      return;
    }

    try {
      setForm((f) => {
        const next = { ...f };

        if (parsed.description && !next.description.trim()) next.description = parsed.description;
        if (parsed.coverImage && !next.coverImage.trim()) next.coverImage = parsed.coverImage;

        if (Array.isArray(parsed.stops) && parsed.stops.length > 0) {
          const validStops = parsed.stops.filter((s): s is { name: string; image?: string } => !!s?.name);
          if (next.stops.length === 0 && validStops.length > 0) {
            const perStopNights = Math.max(1, Math.round((next.totalNights || validStops.length) / validStops.length));
            next.stops = validStops.map((s) => ({ name: s.name, nights: perStopNights, image: s.image || undefined }));
          } else {
            next.stops = next.stops.map((st) => {
              if (st.image) return st;
              const match = validStops.find((s) => s.name.trim().toLowerCase() === st.name.trim().toLowerCase());
              return match?.image ? { ...st, image: match.image } : st;
            });
          }
        }

        if (Array.isArray(parsed.days) && parsed.days.length > 0) {
          const byDayNum = new Map<number, AIItineraryDay>();
          parsed.days.forEach((d, i) => { if (d) byDayNum.set(d.day ?? i + 1, d); });

          let itineraries = next.itineraries;
          if (parsed.days.length > itineraries.length) {
            const extra = Array.from(
              { length: parsed.days.length - itineraries.length },
              (_, i) => emptyDay(itineraries.length + i + 1),
            );
            itineraries = [...itineraries, ...extra];
            next.totalDays = itineraries.length;
            next.totalNights = Math.max(0, itineraries.length - 1);
          }

          next.itineraries = itineraries.map((day) => {
            const src = byDayNum.get(day.day);
            if (!src) return day;
            const updated = { ...day };
            if (src.title && !updated.title.trim()) updated.title = src.title;
            if (src.description && !updated.description.trim()) updated.description = src.description;
            if (src.transportPickup && !updated.transportPickup.trim()) updated.transportPickup = src.transportPickup;
            if (src.transportDrop && !updated.transportDrop.trim()) updated.transportDrop = src.transportDrop;
            if (src.transportDistanceKm != null && updated.transportDistanceKm == null) updated.transportDistanceKm = src.transportDistanceKm;
            if (src.travelTimeApprox && !updated.transportTravelTime.trim()) updated.transportTravelTime = src.travelTimeApprox;
            if (Array.isArray(src.activities) && src.activities.length > 0 && updated.activities.every((a) => !a.title.trim())) {
              updated.activities = src.activities
                .filter((a): a is { title: string; description?: string; photos?: string[] } => !!a?.title)
                .map((a) => {
                  const photos = Array.isArray(a.photos) ? a.photos.filter((p): p is string => !!p).slice(0, 3) : [];
                  return {
                    title: a.title,
                    description: a.description ?? "",
                    photo: photos[0] ?? "",
                    photos,
                    photoLabels: photos.map(() => a.title),
                  };
                });
            }
            return updated;
          });
        }

        return next;
      });
    } catch {
      toast.error("Couldn't apply that response — its shape didn't match what was expected.");
      return;
    }

    setAiJsonInput("");
    setAiDialogOpen(false);
    toast.success("Itinerary generated from the AI response.");
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
      <Group
        label="Days"
        hint={canEdit ? "Drag to reorder. Click to open a day." : undefined}
        action={
          canEdit ? (
            <button
              type="button"
              onClick={() => setAiDialogOpen(true)}
              title="AI Itinerary Builder"
              className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[10.5px] font-medium text-dashboard-base-content/40 hover:bg-dashboard-primary/10 hover:text-dashboard-primary"
            >
              <Wand2 size={11} /> AI Itinerary
            </button>
          ) : undefined
        }
      >
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

      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Wand2 size={15} className="text-dashboard-primary" /> AI Itinerary Builder
            </DialogTitle>
            <DialogDescription className="text-xs">
              Copy the prompt below into ChatGPT, then paste the JSON it gives you back — day titles, descriptions, activities, and photos get filled in at once. Only empty fields are touched; hotel/cab selection stays manual.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-dashboard-base-content/90">Step 1 — Copy this prompt</label>
                <Button variant="outline" size="sm" onClick={copyAIPrompt} className="h-7 px-2 text-[11px] gap-1 border-dashboard-base-300 rounded-md">
                  <Copy size={11} /> Copy Prompt
                </Button>
              </div>
              <Textarea
                readOnly
                value={buildAIPrompt()}
                rows={8}
                className="text-[11px] font-mono resize-none border-dashboard-base-300 bg-dashboard-base-200/40 rounded-md"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-dashboard-base-content/90 mb-1.5 block">
                Step 2 — Paste the JSON response here
              </label>
              <Textarea
                value={aiJsonInput}
                onChange={(e) => setAiJsonInput(e.target.value)}
                rows={8}
                placeholder="Paste the JSON ChatGPT gave you…"
                className="text-[11px] font-mono resize-none border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setAiDialogOpen(false)} className="border-dashboard-base-300 rounded-md">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={applyAIItinerary}
                disabled={!aiJsonInput.trim()}
                className="gap-1.5 bg-dashboard-primary text-dashboard-primary-content hover:bg-dashboard-primary/90 rounded-md"
              >
                <Wand2 size={13} /> Generate Package
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
