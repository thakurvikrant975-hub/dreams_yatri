"use client";

// ─────────────────────────────────────────────────────────────────────────────
// "Apply this to other days" / "Remove it from other days".
//
// A hotel usually spans a stretch of nights rather than the whole trip, so
// all-or-nothing is the wrong shape — the old panel already had custom day
// selection and that's worth keeping. One component serves hotels and cabs
// both: it only knows how to pick days and hand them back.
//
// Deliberately not a drawer of its own. It's a step inside the decision you're
// already making, not a separate task.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { cn } from "@/app/lib/utils";
import { Button } from "@/app/(dashboard)/dashboard/(main)/components/ui/button";
import { useBuilder } from "./builder-context";

export function ApplyToDays({
  sourceDay, label, confirmLabel, onApply, tone = "primary",
}: {
  /** Excluded from the choices — it's where the value is coming from. */
  sourceDay: number;
  label: string;
  confirmLabel: string;
  onApply: (days: number[]) => void;
  tone?: "primary" | "danger";
}) {
  const { form } = useBuilder();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);

  const others = form.itineraries.map((it) => it.day).filter((d) => d !== sourceDay);
  if (others.length === 0) return null;

  function toggle(d: number) {
    setPicked((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]));
  }

  function commit() {
    if (picked.length === 0) return;
    onApply(picked);
    setPicked([]);
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "w-full flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed py-2 text-xs font-medium transition-colors",
          tone === "danger"
            ? "border-dashboard-error/40 text-dashboard-error/80 hover:bg-dashboard-error/5"
            : "border-dashboard-base-300 text-dashboard-base-content/70 hover:bg-dashboard-base-200/50",
        )}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-dashboard-base-300 p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium text-dashboard-base-content/70">{label}</p>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setPicked(others)}
            className="text-[10px] font-medium text-dashboard-primary hover:underline"
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setPicked([])}
            className="text-[10px] font-medium text-dashboard-base-content/50 hover:underline"
          >
            None
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {others.map((d) => {
          const on = picked.includes(d);
          return (
            <button
              key={d}
              type="button"
              onClick={() => toggle(d)}
              aria-pressed={on}
              className={cn(
                "rounded-md px-2 py-1 text-[11px] font-medium border transition-colors",
                on
                  ? "border-dashboard-primary cursor-pointer bg-dashboard-primary/10 text-dashboard-primary"
                  : "border-dashboard-base-300 text-dashboard-base-content/60 hover:bg-dashboard-base-200/60",
              )}
            >
              Day {d}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button" size="sm"
          className={cn("h-8 text-xs flex-1", tone === "danger" && "bg-dashboard-error hover:bg-dashboard-error/90")}
          disabled={picked.length === 0}
          onClick={commit}
        >
          {confirmLabel} ({picked.length})
        </Button>
        <Button
          type="button" size="sm" variant="ghost" className="h-8 text-xs"
          onClick={() => { setOpen(false); setPicked([]); }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
