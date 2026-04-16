// app/(dashboard)/dashboard/policies/page.tsx

import { Suspense }        from "react";
import { FileText }        from "lucide-react";
import { getPolicies }     from "./actions";
import { PoliciesTableClient } from "./PoliciesTableClient";
import { CreatePolicyDialog }  from "./PolicyDialog";

// ── Skeleton ──────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-muted" />
        ))}
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 w-32 rounded-lg bg-muted" />
        ))}
      </div>
      <div className="h-10 w-80 rounded-lg bg-muted" />
      <div className="rounded-xl border overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 border-b bg-muted/20 last:border-0" />
        ))}
      </div>
    </div>
  );
}

// ── Data component ────────────────────────────────────────────────────────

async function PoliciesData() {
  const policies = await getPolicies();

  return <PoliciesTableClient policies={policies} />;
}

// ── Page ──────────────────────────────────────────────────────────────────

export default async function PoliciesPage() {
  return (
    <div className="space-y-6 ">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Policies</h1>
            <p className="text-sm text-muted-foreground">
              Reusable policies assigned to packages during package creation
            </p>
          </div>
        </div>

        <CreatePolicyDialog />
      </div>

      <Suspense fallback={<TableSkeleton />}>
        <PoliciesData />
      </Suspense>
    </div>
  );
}