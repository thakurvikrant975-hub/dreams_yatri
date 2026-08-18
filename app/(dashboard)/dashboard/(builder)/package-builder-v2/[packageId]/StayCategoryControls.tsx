"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Editing the stay standards, in the document.
//
// Deliberately not a tab bar. The last attempt made the standards alternate
// views of the editor — pick a tier, edit "its" document — which is exactly the
// thing that turned one quote into three documents. Here every standard is on
// screen at once, in the columns the client will read, and each column is
// edited where it sits: pick this column's hotel, move the Recommended badge,
// drop a standard. What the exec is looking at is what gets sent.
//
// Everything writes through stay-categories.actions, which keeps the day row —
// the compatibility surface the v1 builder, the hotel-request workflow and the
// pricing service still read — mirroring the recommended standard.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Loader2, Plus, Star, Trash2 } from "lucide-react";
import { cn } from "@/app/lib/utils";
import {
  STAY_CATEGORIES, stayCategoryLabel, type StayCategoryName,
} from "@/app/(dashboard)/dashboard/(builder)/package-builder/stay-categories";
import {
  addStayCategory, removeStayCategory, setRecommendedStayCategory,
} from "@/app/(dashboard)/dashboard/(builder)/package-builder/stay-categories.actions";

export type EditableCategory = {
  id: string;
  category: StayCategoryName;
  isRecommended: boolean;
};

/** The strip above a stay block: which standards this package is quoted at,
 * which one is recommended, and how to add or drop one. Rendered once per
 * block rather than once per package because that is where the exec is looking
 * when they think about it — the columns are right underneath. */
export function StayCategoryControls({
  packageId, categories, onChanged,
}: {
  packageId: string;
  categories: EditableCategory[];
  /** Re-read the categories after a change — the document renders from them. */
  onChanged: () => void | Promise<void>;
}) {
  const [busy, startBusy] = useTransition();
  const [pending, setPending] = useState<string | null>(null);

  const used = new Set(categories.map((c) => c.category));
  const addable = STAY_CATEGORIES.filter((c) => !used.has(c));

  function run(label: string, fn: () => Promise<{ success: boolean; error?: string }>) {
    setPending(label);
    startBusy(async () => {
      const r = await fn();
      setPending(null);
      if (!r.success) { toast.error(r.error ?? "That didn't work."); return; }
      await onChanged();
    });
  }

  return (
    <div className="builder-only no-print flex flex-wrap items-center gap-1.5 pb-1.5">
      <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-dashboard-base-content/45">
        <Star size={10} /> Standards
      </span>

      {categories.map((c) => (
        <span
          key={c.id}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
            c.isRecommended
              ? "border-dashboard-primary bg-dashboard-primary/10 text-dashboard-primary"
              : "border-dashboard-base-300 text-dashboard-base-content/70",
          )}
        >
          {stayCategoryLabel(c.category)}
          {c.isRecommended ? (
            <Check size={9} />
          ) : (
            <button
              type="button"
              title="Recommend this standard — it carries the badge and the highlighted price"
              disabled={busy}
              onClick={() => run(c.id, () => setRecommendedStayCategory(packageId, c.id))}
              className="text-dashboard-base-content/40 hover:text-dashboard-primary"
            >
              {pending === c.id ? <Loader2 size={9} className="animate-spin" /> : "recommend"}
            </button>
          )}
          {categories.length > 1 && (
            <button
              type="button"
              title={`Remove the ${stayCategoryLabel(c.category)} standard and its hotels`}
              disabled={busy}
              onClick={() => run(`rm-${c.id}`, () => removeStayCategory(packageId, c.id))}
              className="text-dashboard-base-content/35 hover:text-dashboard-error"
            >
              <Trash2 size={9} />
            </button>
          )}
        </span>
      ))}

      {addable.map((cat) => (
        <button
          key={cat}
          type="button"
          disabled={busy}
          title={`Quote a ${stayCategoryLabel(cat)} standard as well`}
          onClick={() => run(cat, async () => {
            const r = await addStayCategory(packageId, cat);
            if (r.success) toast.success(`${stayCategoryLabel(cat)} added — pick its hotel for each night.`);
            return r;
          })}
          className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-dashboard-base-300 px-2 py-0.5 text-[10px] text-dashboard-base-content/55 hover:border-dashboard-primary hover:text-dashboard-primary"
        >
          {pending === cat ? <Loader2 size={9} className="animate-spin" /> : <Plus size={9} />}
          {stayCategoryLabel(cat)}
        </button>
      ))}
    </div>
  );
}
