"use client";

// ─────────────────────────────────────────────────────────────────────────────
// The right-hand sidebar — an icon rail with a panel beside it.
//
// Mirrors the shape Canva uses on its left edge: a narrow strip of always-
// present sections, and one wider panel that shows whichever is active. Ours
// is mirrored to the right, so reading outward from the document it goes
// [ document ][ panel ][ rail ].
//
// The point is that everything lives in ONE surface. Before this, package-level
// controls sat in a fixed panel while day-level controls slid over the page in
// a sheet — two different places for the same kind of work, one of which
// covered the thing you were editing. Now the rail answers "where do I go" and
// a contextual drawer answers "change this thing I just clicked", and both
// render in the same column.
//
// A drawer takes precedence over the rail selection while it's open, because
// it's always a direct response to a click and should not require hunting for
// where it went.
// ─────────────────────────────────────────────────────────────────────────────

import {
  User, CalendarDays, MapPin, ListOrdered, Plane, Gift, Hotel, Sparkles, Car,
  PanelRightClose, PanelRightOpen, ArrowLeft,
} from "./builder-icons";
import { cn } from "@/app/lib/utils";
import { useBuilder, type PanelTab, type DrawerTarget } from "./builder-context";
import { HotelReplaceView, HotelEditView, HotelRequestView } from "./HotelDrawer";
import { TransferView, ActivitiesView } from "./DayDrawers";
import { MealsView, AddonsView, TicketsView, NoteView, StopsView } from "./ExtrasDrawers";
import { TICKET_TYPE_LABELS } from "./day-mutations";
import { DayListPanel } from "./DayListPanel";
import { BuilderErrorBoundary } from "./BuilderErrorBoundary";
import { HotelSuggestionsView, ActivitySuggestionsView, CabSuggestionsView } from "./SuggestionsPanel";

const RAIL: { tab: PanelTab; icon: React.ElementType; label: string }[] = [
  { tab: "client", icon: User, label: "Client" },
  { tab: "trip", icon: CalendarDays, label: "Trip" },
  { tab: "stops", icon: MapPin, label: "Destinations" },
  { tab: "itinerary", icon: ListOrdered, label: "Itinerary" },
  { tab: "tickets", icon: Plane, label: "Travel" },
  { tab: "addons", icon: Gift, label: "Add-ons" },
];

/** The catalog half of the rail, separated by a rule. These behave differently
 * enough to earn the divider: everything above configures the package, and
 * everything below is content you drag into a day. */
const CATALOG_RAIL: { tab: PanelTab; icon: React.ElementType; label: string }[] = [
  { tab: "hotels", icon: Hotel, label: "Hotels" },
  { tab: "activities", icon: Sparkles, label: "Things" },
  { tab: "cabs", icon: Car, label: "Cabs" },
];

function headingForDrawer(target: DrawerTarget): { title: string; description: string } {
  switch (target.kind) {
    case "hotel-replace":
      return { title: `Day ${target.day} — choose a stay`, description: "Properties near this day's stop. Picking one prices the night from its real rate." };
    case "hotel-edit":
      return { title: `Day ${target.day} — stay details`, description: "What this night includes. Catalog rooms keep their own name and rates." };
    case "hotel-request":
      return { title: `Day ${target.day} — request a hotel`, description: "Hand this day to the hotel team. It blocks costing review until they fill it in." };
    case "transfer-edit":
      return { title: `Day ${target.day} — transport`, description: "The vehicle covering this day, and the route it runs." };
    case "activities-edit":
      return { title: `Day ${target.day} — experiences`, description: "What the client actually does today, in the order they'll do it." };
    case "meals-edit":
      return { title: `Day ${target.day} — meals`, description: "Which meals this day includes. A room's meal plan sets these automatically." };
    case "note-edit":
      return { title: `Day ${target.day} — note`, description: "A short call-out on the client's itinerary. Shown only when there's something to say." };
    case "addons-edit":
      return target.day == null
        ? { title: "Package add-ons", description: "Extras priced into the whole trip — permits, kits, upgrades." }
        : { title: `Day ${target.day} — add-ons`, description: "Extras for this day. They appear under the day's stay." };
    case "tickets-edit": {
      const label = TICKET_TYPE_LABELS[target.type];
      return { title: `${label} legs`, description: `Every ${label.toLowerCase()} on this trip.` };
    }
    case "stops-edit":
      return { title: "Destinations", description: "Where the trip goes and how many nights at each." };
  }
}

function drawerBody(target: DrawerTarget) {
  switch (target.kind) {
    case "hotel-replace": return <HotelReplaceView day={target.day} />;
    case "hotel-edit": return <HotelEditView day={target.day} />;
    case "hotel-request": return <HotelRequestView day={target.day} />;
    case "transfer-edit": return <TransferView day={target.day} />;
    case "activities-edit": return <ActivitiesView day={target.day} />;
    case "meals-edit": return <MealsView day={target.day} />;
    case "note-edit": return <NoteView day={target.day} />;
    case "addons-edit": return <AddonsView day={target.day} />;
    case "tickets-edit": return <TicketsView type={target.type} />;
    case "stops-edit": return <StopsView />;
  }
}

function headingForTab(tab: PanelTab): { title: string; description: string } {
  switch (tab) {
    case "client": return { title: "Client", description: "Who this itinerary is for, and what they asked for." };
    case "trip": return { title: "Trip setup", description: "Dates, travellers and margin — what the whole document is built from." };
    case "stops": return { title: "Destinations", description: "Where the trip goes and how many nights at each." };
    case "itinerary": return { title: "Itinerary", description: "Drag to reorder days. Dots show what each one is still missing." };
    case "tickets": return { title: "Travel", description: "Flights, trains, helicopters and other legs." };
    case "addons": return { title: "Add-ons", description: "Extras priced into the package." };
    case "hotels": return { title: "Hotels", description: "Rooms priced for this trip's destinations. Drag one onto a day." };
    case "activities": return { title: "Things to do", description: "Experiences from the catalog. Drag one onto a day." };
    case "cabs": return { title: "Cabs", description: "Vehicles priced for this trip's destinations. Drag one onto a day." };
  }
}

function RailButton({ entry }: {
  entry: { tab: PanelTab; icon: React.ElementType; label: string };
}) {
  const { drawer, panelTab, setPanelTab } = useBuilder();
  const { tab, icon: Icon, label } = entry;
  // A drawer suppresses the rail's active state: what's on screen is the
  // drawer, and highlighting a section that isn't showing would be a lie about
  // where you are.
  const active = !drawer && panelTab === tab;

  return (
    <button
      type="button"
      onClick={() => setPanelTab(active ? null : tab)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group/rail w-[56px] flex flex-col items-center gap-1 rounded-lg py-2 transition-colors duration-[120ms]",
        active ? "bg-dashboard-primary/10" : "hover:bg-dashboard-base-200",
      )}
    >
      {/* Icon and label carry different weights on purpose. One colour for
          both made the label as faint as the glyph, and the label is the part
          that actually tells you what the section is — the icons are close
          enough in silhouette at 17px that several are only distinguishable by
          the word underneath. So: light icon, dark grey label. */}
      <Icon
        size={17}
        className={cn(
          "transition-colors duration-[120ms]",
          active
            ? "text-dashboard-primary"
            : "text-dashboard-base-content/35 group-hover/rail:text-dashboard-base-content/55",
        )}
      />
      <span
        className={cn(
          "text-[9.5px] font-medium leading-none transition-colors duration-[120ms]",
          active ? "text-dashboard-primary" : "text-dashboard-base-content/70",
        )}
      >
        {label}
      </span>
    </button>
  );
}

export function BuilderSidebar({ clientPanel, tripPanel }: {
  /** Rendered under the Client tab — owned by page.tsx, which has the query. */
  clientPanel: React.ReactNode;
  /** Trip Setup, which needs pricing props page.tsx computes. */
  tripPanel: React.ReactNode;
}) {
  const { drawer, closeDrawer, panelTab, setPanelTab } = useBuilder();

  const open = !!drawer || panelTab !== null;
  const heading = drawer ? headingForDrawer(drawer) : panelTab ? headingForTab(panelTab) : null;

  function body() {
    if (drawer) return drawerBody(drawer);
    switch (panelTab) {
      case "client": return clientPanel;
      case "trip": return tripPanel;
      case "stops": return <StopsView />;
      case "itinerary": return <DayListPanel />;
      case "tickets": return <TicketsView type="FLIGHT" />;
      case "addons": return <AddonsView day={null} />;
      case "hotels": return <HotelSuggestionsView />;
      case "activities": return <ActivitySuggestionsView />;
      case "cabs": return <CabSuggestionsView />;
      default: return null;
    }
  }

  return (
    <div className="no-print flex h-full shrink-0">
      {open && (
        <section className="w-[336px] xl:w-[380px] shrink-0 h-full flex flex-col border-l border-dashboard-base-300 bg-dashboard-base-100">
          <header className="px-4 pt-4 pb-3 border-b border-dashboard-base-300 shrink-0">
            <div className="flex items-start gap-2">
              {/* A drawer is a detour from wherever the rail was — this returns
                  to it rather than closing the whole panel. */}
              {drawer && (
                <button
                  type="button"
                  onClick={closeDrawer}
                  aria-label="Back"
                  className="shrink-0 mt-0.5 flex items-center justify-center size-6 rounded-md text-dashboard-base-content/40 hover:bg-dashboard-base-200 hover:text-dashboard-base-content/70"
                >
                  <ArrowLeft size={14} />
                </button>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-[15px] font-semibold tracking-[-0.01em] truncate">
                  {heading?.title}
                </h2>
                <p className="text-[11.5px] leading-relaxed text-dashboard-base-content/55 mt-0.5">
                  {heading?.description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { closeDrawer(); setPanelTab(null); }}
                aria-label="Collapse panel"
                title="Collapse panel"
                className="shrink-0 mt-0.5 flex items-center justify-center size-6 rounded-md text-dashboard-base-content/35 hover:bg-dashboard-base-200 hover:text-dashboard-base-content/70"
              >
                <PanelRightClose size={14} />
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto overscroll-contain">
            {/* Keyed on what's showing, so leaving a section that threw and
                coming back is a fresh attempt rather than the error you
                already dismissed. */}
            <BuilderErrorBoundary key={drawer?.kind ?? panelTab ?? "none"} label="This panel">
              {body()}
            </BuilderErrorBoundary>
          </div>
        </section>
      )}

      <nav
        aria-label="Builder sections"
        className="w-[68px] shrink-0 h-full flex flex-col items-center gap-1 border-l border-dashboard-base-300 bg-dashboard-base-100 py-3"
      >
        {RAIL.map((entry) => <RailButton key={entry.tab} entry={entry} />)}

        <span className="my-1 h-px w-8 bg-dashboard-base-300" />

        {CATALOG_RAIL.map((entry) => <RailButton key={entry.tab} entry={entry} />)}

        {!open && (
          <button
            type="button"
            onClick={() => setPanelTab("client")}
            aria-label="Expand panel"
            title="Expand panel"
            className="mt-auto flex items-center justify-center size-8 rounded-lg text-dashboard-base-content/35 hover:bg-dashboard-base-200 hover:text-dashboard-base-content/70"
          >
            <PanelRightOpen size={15} />
          </button>
        )}
      </nav>
    </div>
  );
}
