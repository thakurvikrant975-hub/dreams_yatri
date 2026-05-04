"use client";

import { useState, useTransition } from "react";
import { Loader2, ShieldCheck, Check } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { toast } from "sonner";
import { setPackagePoliciesAction } from "@/app/actions/packages/package.actions";

type Policy = {
  id: number;
  type: string;
  title: string;
  points: string[];
};

type Props = {
  packageId: number;
  allPolicies: Policy[];
  activePolicyIds: number[];
};

const TYPE_LABELS: Record<string, string> = {
  CANCELLATION: "Cancellation Policy",
  DATE_CHANGE: "Date Change Policy",
  REFUND: "Refund Policy",
};

const TYPE_COLORS: Record<string, string> = {
  CANCELLATION: "destructive",
  DATE_CHANGE: "secondary",
  REFUND: "outline",
};

export function PoliciesTab({ packageId, allPolicies, activePolicyIds }: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set(activePolicyIds));
  const [isPending, startTransition] = useTransition();

  const byType = allPolicies.reduce<Record<string, Policy[]>>((acc, p) => {
    if (!acc[p.type]) acc[p.type] = [];
    acc[p.type].push(p);
    return acc;
  }, {});

  const types = Object.keys(byType).sort();

  function toggle(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSave() {
    startTransition(async () => {
      const res = await setPackagePoliciesAction(packageId, Array.from(selected));
      if (res.success) toast.success("Policies saved");
      else toast.error(res.error);
    });
  }

  if (allPolicies.length === 0) {
    return (
      <Card>
        <CardContent className="pt-8 pb-8 text-center">
          <ShieldCheck className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No policies defined yet</p>
          <p className="text-xs text-muted-foreground">Create policies in Settings to attach them here</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {types.map(type => (
        <Card key={type}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">
                {TYPE_LABELS[type] ?? type}
              </CardTitle>
              <Badge variant={TYPE_COLORS[type] as "destructive" | "secondary" | "outline" | "default" ?? "outline"} className="text-xs">
                {byType[type].filter(p => selected.has(p.id)).length} / {byType[type].length} selected
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {byType[type].map(policy => (
              <div
                key={policy.id}
                className={`rounded-lg border p-4 cursor-pointer transition-colors ${
                  selected.has(policy.id)
                    ? "border-primary bg-primary/5"
                    : "hover:border-muted-foreground/30"
                }`}
                onClick={() => toggle(policy.id)}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                    selected.has(policy.id) ? "bg-primary border-primary" : "border-input"
                  }`}>
                    {selected.has(policy.id) && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{policy.title}</p>
                    {policy.points.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {policy.points.slice(0, 3).map((point, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                            <span className="text-muted-foreground/60 shrink-0">·</span>
                            {point}
                          </li>
                        ))}
                        {policy.points.length > 3 && (
                          <li className="text-xs text-muted-foreground">
                            +{policy.points.length - 3} more points
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {selected.size} polic{selected.size !== 1 ? "ies" : "y"} attached to this package
        </p>
        <Button onClick={handleSave} disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Policies
        </Button>
      </div>
    </div>
  );
}
