// app/(dashboard)/dashboard/packages/page.tsx
import { Suspense }             from "react";
import Link                     from "next/link";
import { Package as PkgIcon }   from "lucide-react";
import { Button } from "../components/ui/button";
import { getPackages }          from "./actions";
import { PackagesTableClient }  from "./PackagesTableClient";

function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted" />)}
      </div>
      <div className="rounded-xl border overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 border-b bg-muted/20 last:border-0" />)}
      </div>
    </div>
  );
}

async function PackagesData() {
  const packages = await getPackages();
  return <PackagesTableClient packages={packages} />;
}

export default async function PackagesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <PkgIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Packages</h1>
            <p className="text-sm text-muted-foreground">
              Create and manage travel packages with durations, itineraries and pricing
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href="/dashboard/packages/new">+ New Package</Link>
        </Button>
      </div>

      <Suspense fallback={<Skeleton />}>
        <PackagesData />
      </Suspense>
    </div>
  );
}