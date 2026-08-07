"use client";

// ─────────────────────────────────────────────────────────────────────────────
// One control per day, instead of three stacked "Add …" buttons.
//
// The three separate add-buttons only ever appeared for whichever pieces the
// day was missing, so an empty day showed three dashed rows and a full day
// showed none — the affordance moved around and took vertical space in the
// document itself. A single menu keeps the preview looking like the document
// it is, and gives day-level actions (add/delete) somewhere to live.
//
// Deleting asks for the word "delete" to be typed. That is deliberately more
// friction than a normal confirm: a day carries its hotel, its transport, its
// activities and its add-ons, none of it recoverable here — there is no undo
// in the builder yet.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { Plus, Hotel, Car, Sparkles, CalendarPlus, Trash2, ChevronDown, Utensils, Gift, StickyNote } from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/app/(dashboard)/dashboard/(main)/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/app/(dashboard)/dashboard/(main)/components/ui/dialog";
import { Input } from "@/app/(dashboard)/dashboard/(main)/components/ui/input";
import { Button } from "@/app/(dashboard)/dashboard/(main)/components/ui/button";
import { useBuilder } from "./builder-context";

const CONFIRM_WORD = "delete";

export function DayActionsMenu({ day, hasStay, hasTransport, hasActivities, hasMeals, hasAddons, hasNote, isPending }: {
  day: number;
  hasStay: boolean;
  hasTransport: boolean;
  hasActivities: boolean;
  hasMeals: boolean;
  hasAddons: boolean;
  hasNote: boolean;
  /** Awaiting the hotel team — the stay row points at the request. */
  isPending: boolean;
}) {
  const { openDrawer, addDayAfter, removeDay, requestFieldFocus, form } = useBuilder();
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
            className="builder-only no-print flex items-center gap-1 rounded-md border border-dashed border-dashboard-base-300 px-2 py-1 text-[10px] font-medium text-dashboard-base-content/60 hover:bg-dashboard-primary/6 hover:text-dashboard-primary transition-colors"
          >
            <Plus size={11} /> Add <ChevronDown size={10} />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="text-[11px]">Add to day {day}</DropdownMenuLabel>
          {/* Already-present pieces are offered as "Edit" rather than hidden:
              a menu whose contents change shape as a day fills up is harder to
              build a habit around than one that always has the same rows. */}
          <DropdownMenuItem
            onSelect={() => openDrawer(
              isPending
                ? { kind: "hotel-request", day }
                : { kind: hasStay ? "hotel-edit" : "hotel-replace", day },
            )}
          >
            <Hotel size={13} /> {isPending ? "Hotel request" : hasStay ? "Edit stay" : "Stay"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openDrawer({ kind: "transfer-edit", day })}>
            <Car size={13} /> {hasTransport ? "Edit transport" : "Transport"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openDrawer({ kind: "activities-edit", day })}>
            <Sparkles size={13} /> {hasActivities ? "Edit experiences" : "Experiences"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openDrawer({ kind: "meals-edit", day })}>
            <Utensils size={13} /> {hasMeals ? "Edit meals" : "Meals"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openDrawer({ kind: "addons-edit", day })}>
            <Gift size={13} /> {hasAddons ? "Edit add-ons" : "Add-on"}
          </DropdownMenuItem>
          {/* A note is plain text, so it opens the inline editor in the
              document rather than a drawer — a drawer for one textarea would
              be more chrome than the thing it edits. */}
          <DropdownMenuItem onSelect={() => requestFieldFocus({ scope: "day", day, key: "notes" })}>
            <StickyNote size={13} /> {hasNote ? "Edit note" : "Note"}
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
