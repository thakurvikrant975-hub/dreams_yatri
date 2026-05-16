// app/(dashboard)/dashboard/policies/page.tsx

import { Suspense }        from "react";
import { FileText }        from "lucide-react";
import { getPolicies }     from "./actions";
import { PoliciesTableClient } from "./PoliciesTableClient";
import { CreatePolicyDialog }  from "./PolicyDialog";
import { PageHeader } from "../components/dashboard/PageHeader";

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
  const { policies } = await getPolicies();

  return <PoliciesTableClient policies={policies} />;
}

// ── Page ──────────────────────────────────────────────────────────────────

export default async function PoliciesPage() {
  return (
    <div className="space-y-6 ">
            <PageHeader
                title="Policies"
                description="Reusable policies assigned to packages during package creation"
                icon={FileText}
                actions={<CreatePolicyDialog />}
            />

      <Suspense fallback={<TableSkeleton />}>
        <PoliciesData />
      </Suspense>
    </div>
  );
}