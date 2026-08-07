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
import { useBuilder, type DrawerTarget } from "./builder-context";
import { HotelReplaceView, HotelEditView } from "./HotelDrawer";
import { TransferView, ActivitiesView } from "./DayDrawers";
import { MealsView, AddonsView, TicketsView } from "./ExtrasDrawers";

/** Header copy per target. Exhaustive over DrawerTarget — adding a drawer kind
 * without a heading is a compile error rather than a blank title bar. */
function headingFor(target: DrawerTarget): { title: string; description: string } {
  switch (target.kind) {
    case "hotel-replace":
      return {
        title: `Day ${target.day} — choose a stay`,
        description: "Properties near this day's stop. Picking one prices the night from its real rate.",
      };
    case "hotel-edit":
      return {
        title: `Day ${target.day} — stay details`,
        description: "What this night includes. Room capacity and rates come from the catalog and aren't editable here.",
      };
    case "transfer-edit":
      return {
        title: `Day ${target.day} — transport`,
        description: "The vehicle covering this day, and the route it runs. Only a rated vehicle is costed into the package.",
      };
    case "activities-edit":
      return {
        title: `Day ${target.day} — experiences`,
        description: "What the client actually does today, in the order they'll do it.",
      };
    case "meals-edit":
      return {
        title: `Day ${target.day} — meals`,
        description: "Which meals this day includes. A room's meal plan sets these automatically.",
      };
    case "addons-edit":
      return target.day == null
        ? {
            title: "Package add-ons",
            description: "Extras priced into the whole trip — permits, kits, upgrades.",
          }
        : {
            title: `Day ${target.day} — add-ons`,
            description: "Extras for this day. They appear under the day's stay on the itinerary.",
          };
    case "tickets-edit":
      return {
        title: "Flights, trains & helicopters",
        description: "Every leg of the journey. The route map on the itinerary is built from these.",
      };
  }
}

function bodyFor(target: DrawerTarget) {
  switch (target.kind) {
    case "hotel-replace": return <HotelReplaceView day={target.day} />;
    case "hotel-edit": return <HotelEditView day={target.day} />;
    case "transfer-edit": return <TransferView day={target.day} />;
    case "activities-edit": return <ActivitiesView day={target.day} />;
    case "meals-edit": return <MealsView day={target.day} />;
    case "addons-edit": return <AddonsView day={target.day} />;
    case "tickets-edit": return <TicketsView />;
  }
}

export function BuilderDrawer() {
  const { drawer, closeDrawer, canEdit } = useBuilder();

  // A locked package (costing review) has no editable surfaces at all, so a
  // drawer should never be reachable — belt-and-braces against a stray open()
  // slipping past the affordance-level check.
  const open = !!drawer && canEdit;
  const heading = drawer ? headingFor(drawer) : null;

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
          {drawer && bodyFor(drawer)}
        </div>
      </SheetContent>
    </Sheet>
  );
}
