"use client";

import { ItineraryBuilder } from "../../components/ItineraryBuilder";

type Duration = { id: number; label: string };
type Route = { id: number; duration_id: number; name: string };
type StayCategory = { id: number; name: string };

type Props = {
  packageId: number;
  durations: Duration[];
  allRoutes: Route[];
  stayCategories: StayCategory[];
};

export function ItineraryTab({ packageId, durations, allRoutes, stayCategories }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Itinerary</h2>
        <p className="text-sm text-muted-foreground">
          Select a duration and route, then configure each day&apos;s activities.
        </p>
      </div>
      <ItineraryBuilder
        packageId={packageId}
        durations={durations}
        allRoutes={allRoutes}
        stayCategories={stayCategories}
      />
    </div>
  );
}
