"use client";

import { RouteBuilder } from "../../components/RouteBuilder";

type Stop = { id: number; location: string; stay_days: number; sort_order: number };
type Route = { id: number; duration_id: number; name: string; slug: string; is_active: boolean; meta_title: string | null; meta_desc: string | null; sort_order: number; stops: Stop[] };
type Duration = { id: number; package_id: number; label: string; days: number; nights: number; is_default: boolean; sort_order: number; routes: Route[] };

type Props = {
  packageId: number;
  durations: Duration[];
};

export function RoutesTab({ packageId, durations }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Routes & Durations</h2>
        <p className="text-sm text-muted-foreground">Manage durations, routes, and stops for this package.</p>
      </div>
      <RouteBuilder packageId={packageId} initialDurations={durations} />
    </div>
  );
}
