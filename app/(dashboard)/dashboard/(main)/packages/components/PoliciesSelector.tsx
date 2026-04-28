"use client";

import { useState, useTransition } from "react";
import { Button } from "../../components/ui/button";
import { setPackagePolicies } from "../actions";
import { Loader2, Save, Check } from "lucide-react";
import { cn } from "@/app/lib/utils";

type Policy = { id: number; label: string };

type Props = {
  packageId: number;
  allPolicies: Policy[];
  selectedIds: number[];
};

export function PoliciesSelector({ packageId, allPolicies, selectedIds: initial }: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set(initial));
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleSave() {
    startTransition(async () => {
      await setPackagePolicies(packageId, Array.from(selected));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <div className="space-y-4">
      {allPolicies.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No policies found.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {allPolicies.map((policy) => {
          const isSelected = selected.has(policy.id);
          return (
            <button
              key={policy.id}
              type="button"
              onClick={() => toggle(policy.id)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm text-left transition-all",
                isSelected
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border hover:border-muted-foreground/40 text-foreground"
              )}
            >
              <div
                className={cn(
                  "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                  isSelected ? "bg-primary border-primary" : "border-muted-foreground/40"
                )}
              >
                {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
              </div>
              <span className="truncate">{policy.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-muted-foreground">{selected.size} policies selected</p>
        <Button onClick={handleSave} disabled={pending} size="sm">
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5 mr-2" />
          )}
          {saved ? "Saved!" : "Save Policies"}
        </Button>
      </div>
    </div>
  );
}
