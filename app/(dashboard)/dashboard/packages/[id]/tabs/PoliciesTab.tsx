"use client";

import { useState, useTransition } from "react";
import { useRouter }  from "next/navigation";
import { Button }   from "../../../components/ui/button";
import { Badge }    from "../../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Loader2, FileText, Plus, X, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────

type Policy = {
  id:    number;
  type:  string;
  title: string;
};

const POLICY_TYPE_LABELS: Record<string, string> = {
  CANCELLATION:         "Cancellation",
  DATE_CHANGE:          "Date Change",
  REFUND:               "Refund",
  TERMS_AND_CONDITIONS: "T&C",
};

const POLICY_TYPE_COLORS: Record<string, string> = {
  CANCELLATION:         "bg-red-50 text-red-700 border-red-200",
  DATE_CHANGE:          "bg-blue-50 text-blue-700 border-blue-200",
  REFUND:               "bg-green-50 text-green-700 border-green-200",
  TERMS_AND_CONDITIONS: "bg-purple-50 text-purple-700 border-purple-200",
};

import { updatePackagePolicies } from "../../actions";

// ── Main ──────────────────────────────────────────────────────────────────

export function PoliciesTab({
  package_id,
  allPolicies,
  assignedPolicyIds: initialAssigned,
}: {
  package_id:        number;
  allPolicies:       Policy[];
  assignedPolicyIds: number[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [assignedIds, setAssignedIds] = useState<number[]>(initialAssigned);

  const assigned   = allPolicies.filter(p => assignedIds.includes(p.id));
  const unassigned = allPolicies.filter(p => !assignedIds.includes(p.id));

  // Group unassigned by type for display
  const groupedUnassigned = unassigned.reduce((acc, p) => {
    const type = p.type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(p);
    return acc;
  }, {} as Record<string, Policy[]>);

  function handleToggle(policy_id: number, add: boolean) {
    const newIds = add
      ? [...assignedIds, policy_id]
      : assignedIds.filter(id => id !== policy_id);
    setAssignedIds(newIds);
  }

  async function handleSave() {
    startTransition(async () => {
      const result = await updatePackagePolicies(package_id, assignedIds);
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

      {/* Assigned */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Assigned Policies
            {assigned.length > 0 && (
              <Badge variant="secondary" className="text-xs ml-1">{assigned.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {assigned.length === 0 ? (
            <div className="text-center py-6 border-2 border-dashed rounded-xl">
              <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No policies assigned</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Add from the available policies below
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {assigned.map(p => (
                <div key={p.id}
                  className="flex items-center justify-between rounded-lg border p-3 bg-background">
                  <div className="flex items-center gap-3">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded border ${POLICY_TYPE_COLORS[p.type] ?? "bg-muted text-muted-foreground"}`}>
                      {POLICY_TYPE_LABELS[p.type] ?? p.type}
                    </span>
                    <p className="text-sm font-medium">{p.title}</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleToggle(p.id, false)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available to add */}
      {unassigned.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" /> Available Policies
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(groupedUnassigned).map(([type, policies]) => (
              <div key={type} className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {POLICY_TYPE_LABELS[type] ?? type}
                </p>
                <div className="space-y-1.5">
                  {policies.map(p => (
                    <div key={p.id}
                      className="flex items-center justify-between rounded-lg border p-3 bg-muted/20">
                      <p className="text-sm">{p.title}</p>
                      <Button type="button" variant="outline" size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleToggle(p.id, true)}>
                        <Plus className="h-3 w-3 mr-1" /> Add
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {allPolicies.length === 0 && (
        <div className="text-center py-12 border-2 border-dashed rounded-xl">
          <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium text-muted-foreground">No policies exist yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Create policies first in the Policies dashboard
          </p>
        </div>
      )}

      {allPolicies.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isPending}>
            {isPending
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
              : "Save Policy Assignments"
            }
          </Button>
        </div>
      )}
    </div>
  );
}