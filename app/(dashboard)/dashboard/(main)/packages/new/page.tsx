// app/(dashboard)/dashboard/packages/new/page.tsx
import { getDestinationsForSelect } from "../actions";
import { PackageCreateForm }        from "./PackageCreateForm";
import { ChevronLeft }              from "lucide-react";
import { Button } from "../../components/ui/button";
import Link                         from "next/link";

export default async function NewPackagePage() {
  const destinations = await getDestinationsForSelect();
  return (
    <div className=" space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/packages"><ChevronLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold">New Package</h1>
          <p className="text-sm text-muted-foreground">
            Start with basic info — add durations, pricing and itinerary after creation
          </p>
        </div>
      </div>
      <PackageCreateForm destinations={destinations} />
    </div>
  );
}