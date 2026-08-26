"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Day-level actions — a floating toolbar at the top right of the day card.
//
// Floats rather than sitting in the header row, and appears on hover, for the
// same reason the per-section toolbars do: this is chrome for operating on the
// document, not part of the document. In the flow it was a permanent notch cut
// out of the header that the title had to lay itself out around, on every day,
// forever — including on days nobody was working on.
//
// Three controls, not one menu:
//
//   ⋯  everything the day can gain — stay, transport, experiences, meals,
//      add-on, note. A list, because it's six things and growing.
//   +  add a day below
//   🗑  delete this day
//
// The last two came out of the menu deliberately. They're the two actions that
// operate on the day AS A UNIT rather than on its contents, they're frequent,
// and burying a one-click action two clicks deep to keep a menu tidy is a bad
// trade. Sitting outside also stops "delete" being one careless keyboard-repeat
// away from "add-on" in the same list.
//
// The day's CONTENT — stay, transport, experiences, meals — is reached from
// DaySectionsBar at the foot of the day, where a reader arrives having just
// seen what the day does and does not have. It's listed in this header menu
// too. Two doors to the same room is fine and often better: the foot of the
// day is where you notice something missing, the header is where you are when
// you've scrolled to a day on purpose.
//
// Deleting asks for the word "delete" to be typed. A day carries its hotel,
// transport, activities and add-ons; undo covers it now, but not after a
// reload, so the friction stays.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { CalendarPlus, Trash2, Gift, StickyNote, MoreHorizontal, Hotel, Car, Sparkles, Utensils, Plus, ChevronDown } from "./builder-icons";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/app/(dashboard)/dashboard/(main)/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/app/(dashboard)/dashboard/(main)/components/ui/dialog";
import { Input } from "@/app/(dashboard)/dashboard/(main)/components/ui/input";
import { Button } from "@/app/(dashboard)/dashboard/(main)/components/ui/button";
import { useBuilder, revealField, type DrawerTarget } from "./builder-context";
import { addActivity, emptyAddon } from "./day-mutations";
import { cn } from "@/app/lib/utils";
import { DaySlot } from "./builder-dnd";
import { ADD_CONTROL_CLASS } from "./doc-tokens";
import { useDocTheme } from "./doc-theme";
import { IconTip } from "./builder-ui";

const CONFIRM_WORD = "delete";

/** Matches the per-section toolbars in ItineraryDocument, so every floating
 * control in the document reads as one family. */
const TOOLBAR_BUTTON =
  "flex items-center justify-center size-6 rounded-md transition-colors duration-[120ms] " +
  "text-dashboard-base-content/40 hover:bg-dashboard-base-200 hover:text-dashboard-base-content/75";

/** Everything a day can gain, in the order the document renders it.
 *
 * One definition feeding both the header menu and the foot-of-day button, so
 * the two doors can't come to offer different things.
 *
 * Labels flip on what the day already has, because a menu that says "Add stay"
 * next to a day that has one is lying about what clicking does. But the flip
 * isn't the same for every entry: a day has ONE stay, transport and meal plan,
 * and any number of experiences. Treating experiences like the others left the
 * only route to a second one labelled "Edit experiences", which reads as a
 * dead end — nothing on screen suggested a day could have more than one. */
function dayContentItems({ day, hasStay, hasTransport, hasActivities, hasMeals, isPending }: {
  day: number;
  hasStay: boolean;
  hasTransport: boolean;
  hasActivities: boolean;
  hasMeals: boolean;
  isPending: boolean;
}): {
  icon: React.ElementType;
  label: string;
  on: boolean;
  target: DrawerTarget;
  /** More than one can sit on a day, so having one is not a reason to stop
   * offering another. */
  multiple?: boolean;
  /** Creates the thing in the document before the drawer opens, then scrolls
   * to it and puts the caret in it.
   *
   * Absent where the drawer IS the add UI rather than a form over something
   * that already exists — stay and transport are catalog pickers, and
   * inventing a blank hotel to reveal would put a nameless stay on the
   * client's document. Those still just open. */
  create?: (b: ReturnType<typeof useBuilder>) => void;
}[] {
  return [
    {
      icon: Hotel,
      label: isPending ? "Hotel request" : hasStay ? "Edit stay" : "Add stay",
      on: hasStay || isPending,
      target: isPending
        ? { kind: "hotel-request", day }
        : hasStay ? { kind: "hotel-edit", day } : { kind: "hotel-replace", day },
    },
    {
      icon: Car,
      label: hasTransport ? "Edit transport" : "Add transport",
      on: hasTransport,
      target: { kind: "transfer-edit", day },
    },
    {
      icon: Sparkles,
      label: hasActivities ? "Add another activity" : "Add an activity",
      on: hasActivities,
      target: { kind: "activities-edit", day },
      multiple: true,
      create: (b) => {
        const it = b.form.itineraries.find((d) => d.day === day);
        const index = it ? it.activities.length : 0;
        b.replaceDay(day, (d) => addActivity(d, ""));
        revealField({ scope: "activity", day, index, key: "title" });
      },
    },
    {
      icon: Utensils,
      // No manual add/edit any more — meals are entirely the picked hotel's
      // plan (see applyHotelRoomSelection), so this is a view, not an action.
      label: "View meals",
      on: hasMeals,
      target: { kind: "meals-edit", day },
    },
  ];
}

export function DayActionsMenu({
  day, hasAddons, hasNote, hasStay, hasTransport, hasActivities, hasMeals, isPending,
}: {
  day: number;
  hasAddons: boolean;
  hasNote: boolean;
  hasStay: boolean;
  hasTransport: boolean;
  hasActivities: boolean;
  hasMeals: boolean;
  isPending: boolean;
}) {
  const builder = useBuilder();
  const { openDrawer, addDayAfter, removeDay, form } = builder;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typed, setTyped] = useState("");
  // Radix portals the open menu outside this card, so pointing at it stops
  // being "hovering the day" and the hover-only toolbar — including the
  // trigger the menu belongs to — would vanish out from under the pointer.
  const [menuOpen, setMenuOpen] = useState(false);

  const isLastDay = form.itineraries.length <= 1;
  const confirmed = typed.trim().toLowerCase() === CONFIRM_WORD;

  function addAddonToDay() {
    const index = builder.form.addOns.length;
    builder.setForm((f) => ({ ...f, addOns: [...f.addOns, emptyAddon(day)] }));
    openDrawer({ kind: "addons-edit", day });
    revealField({ scope: "addon", index, key: "name" });
  }

  /** A note needs a TYPE to exist — DayNote renders from notesType, and the
   * tone is the one thing about a note with no inline representation. An
   * existing note is left exactly as it is; this only ever starts one. */
  function addNote() {
    if (!hasNote) {
      builder.replaceDay(day, (d) => ({ ...d, notesType: d.notesType ?? "neutral" }));
    }
    openDrawer({ kind: "note-edit", day });
    revealField({ scope: "day", day, key: "notes" });
  }

  function doDelete() {
    if (!confirmed || isLastDay) return;
    removeDay(day);
    setConfirmOpen(false);
    setTyped("");
  }

  return (
    <>
      <div
        className={cn(
          // builder-only as well as no-print: html2canvas rasterises the screen
          // DOM, so @media print alone would not keep this out of a PDF.
          "builder-only no-print absolute top-2.5 right-2.5 z-30 flex items-center gap-0.5",
          "rounded-lg p-0.5 bg-white ring-1 ring-inset ring-neutral-200  shadow-xl shadow-neutral-200/80",
          "transition-opacity duration-[120ms]",
          menuOpen || confirmOpen
            ? "opacity-100"
            : "opacity-0 pointer-events-none group-hover/day:opacity-100 group-hover/day:pointer-events-auto focus-within:opacity-100 focus-within:pointer-events-auto",
        )}
      >
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <IconTip label="Add or edit this day's contents">
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Day ${day} contents`}
              className={TOOLBAR_BUTTON}
            >
              <MoreHorizontal size={13} />
            </button>
          </DropdownMenuTrigger>
        </IconTip>

        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="text-[11px]">Day {day}</DropdownMenuLabel>
          {/* The same content list the foot-of-day button offers. Reachable
              from both on purpose — this is where you are having scrolled to a
              day deliberately, that is where you are having just read it. */}
          {dayContentItems({ day, hasStay, hasTransport, hasActivities, hasMeals, isPending })
            .map(({ icon: Icon, label, target, create }) => (
              <DropdownMenuItem key={label} onSelect={() => { create?.(builder); openDrawer(target); }}>
                <Icon size={13} /> {label}
              </DropdownMenuItem>
            ))}

          <DropdownMenuSeparator />
          {/* Both land at the FOOT of the day's content, well below this
              header — which is why neither merely opens a drawer. They create
              the thing with its placeholders showing, then scroll it into view
              with the caret in it, so "add a note" produces a note you are
              looking at rather than one you have to go find. */}
          <DropdownMenuItem onSelect={addAddonToDay}>
            <Gift size={13} /> {hasAddons ? "Add another add-on" : "Add an add-on"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={addNote}>
            <StickyNote size={13} /> {hasNote ? "Edit note" : "Add a note"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Out of the menu and onto the toolbar: both act on the day as a unit
          rather than on its contents, both are frequent, and a one-click
          action doesn't belong two clicks deep just to keep a list tidy. */}
      <IconTip label="Add a day below">
        <button
          type="button"
          onClick={() => addDayAfter(day)}
          aria-label={`Add a day below day ${day}`}
          className={TOOLBAR_BUTTON}
        >
          <CalendarPlus size={13} />
        </button>
      </IconTip>

      {/* aria-disabled rather than disabled: a disabled button takes no pointer
          events, so its tooltip never opens — and the tooltip is the only thing
          explaining WHY it's off, which is exactly when it's needed. */}
      <IconTip label={isLastDay ? "A package needs at least one day" : "Delete this day"}>
        <button
          type="button"
          aria-disabled={isLastDay}
          onClick={() => { if (isLastDay) return; setTyped(""); setConfirmOpen(true); }}
          aria-label={`Delete day ${day}`}
          className={cn(
            "flex items-center justify-center size-6 rounded-md transition-colors duration-[120ms]",
            isLastDay
              ? "text-dashboard-base-content/20 cursor-not-allowed"
              : "text-dashboard-error/70 hover:bg-dashboard-error/10 hover:text-dashboard-error",
          )}
        >
          <Trash2 size={13} />
        </button>
      </IconTip>
      </div>

      <Dialog open={confirmOpen} onOpenChange={(o) => { setConfirmOpen(o); if (!o) setTyped(""); }}>
        <DialogContent className="no-print sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete day {day}?</DialogTitle>
            <DialogDescription>
              This removes the day along with its stay, transport, experiences and any
              add-ons attached to it. The days after it are renumbered. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label htmlFor={`confirm-delete-day-${day}`} className="text-xs text-dashboard-base-content/70">
              Type <span className="font-semibold text-dashboard-base-content">{CONFIRM_WORD}</span> to confirm.
            </label>
            <Input
              id={`confirm-delete-day-${day}`}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && confirmed) { e.preventDefault(); doDelete(); } }}
              placeholder={CONFIRM_WORD}
              autoComplete="off"
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!confirmed}
              onClick={doDelete}
            >
              Delete day {day}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// The day's content, reached from the foot of the day.
//
// Placed at the end rather than in the header on purpose: by the time a reader
// is here they have just seen what this day does and doesn't have, so "add
// transport" lands as an answer to something they noticed rather than as a
// menu item to hunt through.
//
// One full-width control rather than the four chips this used to be. Four
// buttons in a row implied four separate decisions, and a day with everything
// already on it showed four controls that all meant "edit" — a row of chrome
// as wide as the day it belonged to. It now reads as the same offer as the
// package-level "Add a destination, flight, train…" menu, one altitude down,
// which is what it always was.
// ─────────────────────────────────────────────────────────────────────────────

export function DaySectionsBar({ day, hasStay, hasTransport, hasActivities, hasMeals, isPending }: {
  day: number;
  hasStay: boolean;
  hasTransport: boolean;
  hasActivities: boolean;
  hasMeals: boolean;
  /** Awaiting the hotel team — the stay entry points at the request instead. */
  isPending: boolean;
}) {
  const builder = useBuilder();
  const DOC = useDocTheme();
  const { openDrawer } = builder;
  const items = dayContentItems({ day, hasStay, hasTransport, hasActivities, hasMeals, isPending });

  // What this day still has room for, named in the button itself. A generic
  // "Add to this day" makes you open the menu to find out whether there's
  // anything worth adding; this answers that before the click.
  //
  // A repeatable slot always has room, so experiences stay in the offer no
  // matter how many the day already has.
  const open = items
    .filter((i) => !i.on || i.multiple)
    .map((i) => i.label.replace(/^Add (another |an |a )?/, ""));
  const label = open.length === 0
    ? "Edit this day's stay, transport, experiences or meals"
    : `Add ${humanList(open)}`;

  const control = (
    <button
      type="button"
      className={ADD_CONTROL_CLASS}
      style={{ borderColor: DOC.rule, color: DOC.accent }}
    >
      <Plus size={12} /> {label}
      <ChevronDown size={11} />
    </button>
  );

  return (
    <div className="builder-only no-print px-3.5 pb-3">
      {/* The drop target wraps the menu rather than being the menu's trigger.
          DropdownMenuTrigger asChild clones its props onto whatever element it
          is given, which for a DaySlot would be the wrapper div — leaving a
          real button nested inside something claiming to be one.

          This is the only drop target on a day with no sections rendered yet,
          so it takes all three draggable kinds and lets the payload's MIME type
          decide which it becomes. A day that already has a section gets its
          highlight there too; this one stays live either way, since the section
          may be scrolled out of view. */}
      <DaySlot day={day} accepts={["hotel", "cab", "activity"]}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{control}</DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-56">
          <DropdownMenuLabel className="text-[11px]">Day {day}</DropdownMenuLabel>
          {items.map(({ icon: Icon, label: itemLabel, target, create }) => (
            <DropdownMenuItem key={itemLabel} onSelect={() => { create?.(builder); openDrawer(target); }}>
              <Icon size={13} /> {itemLabel}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      </DaySlot>
    </div>
  );
}

/** "stay, transport and meals" — an Oxford-comma-free list, because the button
 * is chrome and reads better short. */
function humanList(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}
