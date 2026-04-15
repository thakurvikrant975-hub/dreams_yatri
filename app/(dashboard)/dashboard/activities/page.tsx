// app/(dashboard)/dashboard/activities/page.tsx

import { Suspense }              from "react";
import { Activity }              from "lucide-react";
import { getActivities, getDestinationsForSelect } from "./actions";
import { ActivitiesTableClient } from "./ActivitiesTableClient";
import { CreateActivityDialog }  from "./ActivityDialog";

function TableSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-10 w-80 rounded-lg bg-muted" />
      <div className="rounded-xl border overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 border-b bg-muted/20 last:border-0" />
        ))}
      </div>
    </div>
  );
}

async function ActivitiesData() {
  const [activities, destinations] = await Promise.all([
    getActivities(),
    getDestinationsForSelect(),
  ]);

  return (
    <ActivitiesTableClient
      activities={activities}
      destinations={destinations}
    />
  );
}

export default async function ActivitiesPage() {
  const destinations = await getDestinationsForSelect();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Activities</h1>
            <p className="text-sm text-muted-foreground">
              Manage activities across all destinations
            </p>
          </div>
        </div>

        <CreateActivityDialog destinations={destinations} />
      </div>

      <Suspense fallback={<TableSkeleton />}>
        <ActivitiesData />
      </Suspense>
    </div>
  );
}