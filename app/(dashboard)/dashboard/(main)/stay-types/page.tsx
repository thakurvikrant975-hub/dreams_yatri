// app/(dashboard)/dashboard/stay-types/page.tsx
import { Suspense }       from "react";
import { Hotel }          from "lucide-react";
import { getStayTypes }   from "./actions";
import { StayTypesClient } from "./StayTypesClient";

async function StayTypesData() {
  const stayTypes = await getStayTypes();
  return <StayTypesClient stayTypes={stayTypes} />;
}

export default async function StayTypesPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Hotel className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Stay Types</h1>
            <p className="text-sm text-muted-foreground">
              Global stay categories — Standard, Deluxe, Super Deluxe, etc.
            </p>
          </div>
        </div>
      </div>
      <Suspense fallback={<div className="animate-pulse space-y-3">{Array.from({length:4}).map((_,i)=><div key={i} className="h-14 bg-muted rounded-xl"/>)}</div>}>
        <StayTypesData />
      </Suspense>
    </div>
  );
}