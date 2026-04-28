"use client";

import { PoliciesSelector } from "../../components/PoliciesSelector";

type Policy = { id: number; label: string };

type Props = {
  packageId: number;
  allPolicies: Policy[];
  selectedIds: number[];
};

export function PoliciesTab({ packageId, allPolicies, selectedIds }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Policies</h2>
        <p className="text-sm text-muted-foreground">Select which policies apply to this package.</p>
      </div>
      <PoliciesSelector
        packageId={packageId}
        allPolicies={allPolicies}
        selectedIds={selectedIds}
      />
    </div>
  );
}
