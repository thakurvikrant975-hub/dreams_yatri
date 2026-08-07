"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Inclusions / exclusions, editable where they're read.
//
// The list an exec sees is a merge of company-wide standard content and this
// package's own additions. Only the additions are theirs to change, so the
// distinction has to be legible rather than enforced silently: a standard line
// shows a lock on hover and simply doesn't respond to a click, while a custom
// line edits in place and can be removed.
//
// Which is which comes from the index, not from matching text — see
// standardCount in builder-context.tsx.
//
// Renders exactly as before on the client-facing page and in exported PDFs:
// no builder, no affordances, and every control marked builder-only so it
// can't reach a capture (html2canvas rasterises the screen DOM, so @media
// print alone would not hold it back).
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { Lock, Plus, X } from "lucide-react";
import { cn } from "@/app/lib/utils";
import {
  useOptionalBuilder, standardCount, addExtraPolicyItem,
  updateExtraPolicyItem, removeExtraPolicyItem, type PolicyListKey,
} from "./builder-context";

export function EditablePolicyList({
  items, listKey, itemClassName, style, marker,
}: {
  /** The already-merged, already-filtered list the document renders. */
  items: string[];
  listKey: PolicyListKey;
  itemClassName?: string;
  /** Carried onto the list so it keeps the document's ink colour. */
  style?: React.CSSProperties;
  /** Leading glyph for each row — the tick or cross the section uses. */
  marker: (opts: { muted: boolean }) => React.ReactNode;
}) {
  const builder = useOptionalBuilder();
  const canEdit = !!builder?.canEdit;
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);

  const standard = builder ? standardCount(builder.form, listKey) : items.length;

  function commitAdd() {
    const value = draft.trim();
    setDraft("");
    setAdding(false);
    if (!value || !builder) return;
    builder.setForm((f) => addExtraPolicyItem(f, listKey, value));
  }

  return (
    <ul className={cn("p-4 space-y-2", itemClassName)} style={style}>
      {items.map((text, i) => {
        const isCustom = i >= standard;
        const extraIndex = i - standard;
        return (
          <li key={`${i}-${text}`} className="flex items-start gap-2 group/row">
            {marker({ muted: false })}
            {canEdit && isCustom ? (
              <>
                <input
                  value={text}
                  onChange={(e) =>
                    builder!.setForm((f) => updateExtraPolicyItem(f, listKey, extraIndex, e.target.value))
                  }
                  className="flex-1 min-w-0 bg-transparent outline-none rounded-[3px] px-1 -mx-1 focus:ring-2 focus:ring-dashboard-primary/40"
                />
                <button
                  type="button"
                  aria-label="Remove"
                  onClick={() => builder!.setForm((f) => removeExtraPolicyItem(f, listKey, extraIndex))}
                  className="builder-only no-print shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity text-dashboard-error"
                >
                  <X size={11} />
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 min-w-0">{text}</span>
                {canEdit && (
                  <span
                    title="Standard content — edited in Itinerary Settings"
                    className="builder-only no-print shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity text-neutral-400"
                  >
                    <Lock size={10} />
                  </span>
                )}
              </>
            )}
          </li>
        );
      })}

      {canEdit && (
        <li className="builder-only no-print pt-1">
          {adding ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitAdd}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); commitAdd(); }
                if (e.key === "Escape") { e.preventDefault(); setDraft(""); setAdding(false); }
              }}
              placeholder="Add a line for this package…"
              className="w-full bg-transparent outline-none rounded-[3px] px-1 ring-2 ring-dashboard-primary/40"
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex items-center gap-1 text-dashboard-primary/70 hover:text-dashboard-primary"
            >
              <Plus size={11} /> Add
            </button>
          )}
        </li>
      )}
    </ul>
  );
}
