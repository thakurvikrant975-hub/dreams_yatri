"use client";

// ─────────────────────────────────────────────────────────────────────────────
// BuilderDrawer — one drawer, one task.
//
// Mounted once near the root of the builder; what it shows comes from the
// context's `drawer` target, which anything in the preview can set. That
// indirection is the point — a clickable hotel in the document doesn't need to
// own, or even know about, the UI for editing one.
//
// The rule these views follow: a drawer opens scoped to a single decision
// ("swap this hotel", "change what this stay includes"), never a general
// "edit this day" panel. A drawer showing six unrelated fieldsets would just
// reproduce the right-hand form's problem in a narrower column.
// ─────────────────────────────────────────────────────────────────────────────

import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/app/(dashboard)/dashboard/(main)/components/ui/sheet";
import { useBuilder } from "./builder-context";
import { HotelDrawerBody, hotelDrawerHeading } from "./HotelDrawer";

export function BuilderDrawer() {
  const { drawer, closeDrawer, canEdit } = useBuilder();

  // A locked package (costing review) has no editable surfaces at all, so a
  // drawer should never be reachable — belt-and-braces against a stray open()
  // slipping past the affordance-level check.
  const open = !!drawer && canEdit;
  const heading = drawer ? hotelDrawerHeading(drawer) : null;

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) closeDrawer(); }}>
      <SheetContent
        side="right"
        // Wider than the default sheet: the replace view is a list of hotel
        // options with photos and prices, and squeezing that into a narrow
        // column is what makes people bounce back to the old panel.
        className="no-print w-full sm:max-w-lg p-0 gap-0 flex flex-col"
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-dashboard-base-300">
          <SheetTitle className="text-base">{heading?.title ?? ""}</SheetTitle>
          <SheetDescription className="text-xs">{heading?.description ?? ""}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {drawer && <HotelDrawerBody target={drawer} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
