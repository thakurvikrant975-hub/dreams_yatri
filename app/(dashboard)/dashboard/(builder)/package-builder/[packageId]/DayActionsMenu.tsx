"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Day-level actions, in the day's header.
//
// Deliberately only the things that act on the DAY: an add-on or a note (both
// of which have nothing in the document to click until they exist), and adding
// or deleting a day.
//
// The day's CONTENT — stay, transport, experiences, meals — is reached from
// DaySectionsBar at the foot of the day instead, where a reader arrives having
// just seen what the day does and does not have. Mixing both in one header
// menu made a nine-item list where the common cases were buried.
//
// Deleting asks for the word "delete" to be typed. A day carries its hotel,
// transport, activities and add-ons; undo covers it now, but not after a
// reload, so the friction stays.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { CalendarPlus, Trash2, Gift, StickyNote, MoreHorizontal, Hotel, Car, Sparkles, Utensils } from "lucide-react";
import { cn } from "@/app/lib/utils";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/app/(dashboard)/dashboard/(main)/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/app/(dashboard)/dashboard/(main)/components/ui/dialog";
import { Input } from "@/app/(dashboard)/dashboard/(main)/components/ui/input";
import { Button } from "@/app/(dashboard)/dashboard/(main)/components/ui/button";
import { useBuilder, type DrawerTarget } from "./builder-context";
import { DaySlot, type SlotKind } from "./builder-dnd";

const CONFIRM_WORD = "delete";

export function DayActionsMenu({ day, hasAddons, hasNote }: {
  day: number;
  hasAddons: boolean;
  hasNote: boolean;
}) {
  const { openDrawer, addDayAfter, removeDay, form } = useBuilder();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typed, setTyped] = useState("");

  const isLastDay = form.itineraries.length <= 1;
  const confirmed = typed.trim().toLowerCase() === CONFIRM_WORD;

  function doDelete() {
    if (!confirmed || isLastDay) return;
    removeDay(day);
    setConfirmOpen(false);
    setTyped("");
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            // builder-only: real rendered chrome, and html2canvas rasterises
            // the screen DOM, so @media print alone would not keep it out of
            // an exported PDF.
            aria-label={`Day ${day} actions`}
            className="builder-only no-print flex items-center justify-center size-7 rounded-md text-dashboard-base-content/40 hover:bg-dashboard-primary/8 hover:text-dashboard-primary transition-colors"
          >
            <MoreHorizontal size={13} />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="text-[11px]">Day {day}</DropdownMenuLabel>
          {/* Both of these are invisible in the document until they exist, so
              this menu is the only way in. Everything the day's sections cover
              lives at the foot of the day instead — see DaySectionsBar. */}
          <DropdownMenuItem onSelect={() => openDrawer({ kind: "addons-edit", day })}>
            <Gift size={13} /> {hasAddons ? "Edit add-ons" : "Add an add-on"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openDrawer({ kind: "note-edit", day })}>
            <StickyNote size={13} /> {hasNote ? "Edit note" : "Add a note"}
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[11px]">Itinerary</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => addDayAfter(day)}>
            <CalendarPlus size={13} /> Add a day below
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isLastDay}
            onSelect={(e) => {
              e.preventDefault();
              if (isLastDay) return;
              setTyped("");
              setConfirmOpen(true);
            }}
            className="text-dashboard-error focus:text-dashboard-error"
          >
            <Trash2 size={13} /> Delete this day
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
// menu item to hunt through. Same treatment as the "Add day" control below the
// itinerary, so the two read as the same kind of thing.
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
  const { openDrawer } = useBuilder();

  // `accepts` is what makes an EMPTY day reachable by drag. The day's rendered
  // sections are the natural drop targets, but a day with no stay has no stay
  // section to aim at — so its "Add stay" button is the target instead, which
  // is also where someone would already be pointing.
  const items: {
    icon: React.ElementType;
    label: string;
    on: boolean;
    target: DrawerTarget;
    accepts?: SlotKind;
  }[] = [
    {
      icon: Hotel,
      label: isPending ? "Hotel request" : hasStay ? "Stay" : "Add stay",
      on: hasStay || isPending,
      target: isPending
        ? { kind: "hotel-request" as const, day }
        : hasStay ? { kind: "hotel-edit" as const, day } : { kind: "hotel-replace" as const, day },
      accepts: "hotel",
    },
    {
      icon: Car,
      label: hasTransport ? "Transport" : "Add transport",
      on: hasTransport,
      target: { kind: "transfer-edit" as const, day },
      accepts: "cab",
    },
    {
      icon: Sparkles,
      label: hasActivities ? "Experiences" : "Add experiences",
      on: hasActivities,
      target: { kind: "activities-edit" as const, day },
      accepts: "activity",
    },
    {
      icon: Utensils,
      label: hasMeals ? "Meals" : "Add meals",
      on: hasMeals,
      target: { kind: "meals-edit" as const, day },
    },
  ];

  return (
    <div className="builder-only no-print flex flex-wrap gap-1.5 px-3.5 pb-3">
      {items.map(({ icon: Icon, label, on, target, accepts }) => {
        const button = (
          <button
            type="button"
            onClick={() => openDrawer(target)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors",
              on
                ? "border-dashboard-base-300 text-dashboard-base-content/70 hover:bg-dashboard-base-200/60"
                // Nothing there yet — dashed, so an incomplete day reads as
                // incomplete at a glance rather than looking the same as a full one.
                : "border-dashed border-dashboard-primary/35 text-dashboard-primary/80 hover:bg-dashboard-primary/6",
            )}
          >
            <Icon size={12} /> {label}
          </button>
        );
        // Already on the day: the section itself is the drop target, and a
        // second one down here would just be two places that do the same thing.
        return accepts && !on
          ? <DaySlot key={label} day={day} accepts={accepts}>{button}</DaySlot>
          : <div key={label}>{button}</div>;
      })}
    </div>
  );
}
