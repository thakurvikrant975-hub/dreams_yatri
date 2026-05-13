// app/(dashboard)/dashboard/activities/page.tsx

import { Suspense } from "react";
import { Activity } from "lucide-react";
import { getActivities, getDestinationsForSelect } from "./actions";
import { ActivitiesTableClient } from "./ActivitiesTableClient";
import { CreateActivityDialog } from "./ActivityDialog";
import { PageHeader } from "../components/dashboard/PageHeader";

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
      <PageHeader
        title="Activities"
        description="Manage activities across all destinations"
        icon={Activity}
        actions={<CreateActivityDialog destinations={destinations} />}
      />

      <Suspense fallback={<TableSkeleton />}>
        <ActivitiesData />
      </Suspense>
    </div>
  );
}