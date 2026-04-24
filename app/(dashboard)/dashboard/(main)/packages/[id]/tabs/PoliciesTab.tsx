"use client";

import { useState, useTransition } from "react";
import { useRouter }  from "next/navigation";
import { Button }   from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { SearchSelect }                from "../../../components/dashboard/SearchSelect";
import { searchPolicies, updatePackagePoliciesByType } from "../../actions";

// ── Types ─────────────────────────────────────────────────────────────────

type Policy = {
  id:    number;
  type:  string;
  title: string;
};

const POLICY_TYPES = [
  "CANCELLATION",
  "DATE_CHANGE",
  "REFUND",
  "TERMS_AND_CONDITIONS",
] as const;

type PolicyType = typeof POLICY_TYPES[number];

const POLICY_TYPE_LABELS: Record<PolicyType, string> = {
  CANCELLATION:         "Cancellation",
  DATE_CHANGE:          "Date Change",
  REFUND:               "Refund",
  TERMS_AND_CONDITIONS: "Terms & Conditions",
};

// ── Main ──────────────────────────────────────────────────────────────────

export function PoliciesTab({
  package_id,
  allPolicies,
  assignedPolicyIds,
}: {
  package_id:        number;
  allPolicies:       Policy[];
  assignedPolicyIds: number[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selections, setSelections] = useState<Record<string, number | null>>(() =>
    POLICY_TYPES.reduce((acc, type) => {
      const found = allPolicies.find(p => p.type === type && assignedPolicyIds.includes(p.id));
      acc[type] = found?.id ?? null;
      return acc;
    }, {} as Record<string, number | null>)
  );

  function handleChange(type: string, val: number | null) {
    setSelections(prev => ({ ...prev, [type]: val }));
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updatePackagePoliciesByType(package_id, selections);
      if (result.success) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Policy Assignments
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {POLICY_TYPES.map(type => {
            const initialLabel = allPolicies.find(p => p.id === selections[type])?.title ?? "";
            return (
              <div key={type} className="space-y-1.5">
                <p className="text-sm font-medium">{POLICY_TYPE_LABELS[type]}</p>
                <SearchSelect
                  value={selections[type]}
                  onChange={val => handleChange(type, val)}
                  fetchOptions={q => searchPolicies(q, type)}
                  placeholder="Select policy..."
                  initialLabel={initialLabel}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
            : "Save Policy Assignments"
          }
        </Button>
      </div>
    </div>
  );
}
