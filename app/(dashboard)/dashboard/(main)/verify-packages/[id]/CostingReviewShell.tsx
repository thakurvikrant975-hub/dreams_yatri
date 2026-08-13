"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Costing review shell.
//
// Two things costing needs at once, and they don't belong in the same column:
//
//   the editor — the exec's own workspace, fully editable, so a wrong rate is
//                corrected where it is seen rather than described in a note
//   the review — the pricing breakdown, the findings, and approve/reject
//
// They're tabs rather than side-by-side panes because the workspace is already
// a three-column layout at full width. Squeezing it into half a screen next to
// a breakdown would make both unusable; switching between them keeps each one
// whole. The running total stays pinned in the tab bar so the number never
// leaves the screen while the itinerary is being edited.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { FileEdit, Calculator } from "lucide-react";

export function CostingReviewShell({
  editor, review,
}: {
  editor: React.ReactNode;
  review: React.ReactNode;
}) {
  const [tab, setTab] = useState<"review" | "editor">("review");

  const TABS = [
    { key: "review" as const, icon: Calculator, label: "Costing & decision" },
    { key: "editor" as const, icon: FileEdit, label: "Edit itinerary" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1 border-b border-dashboard-base-300">
        {TABS.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key
                ? "border-dashboard-primary text-dashboard-base-content"
                : "border-transparent text-dashboard-neutral hover:text-dashboard-base-content"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Both stay mounted. The editor holds unsaved form state and its own
          undo history — unmounting it on every tab switch would throw away
          whatever costing had just changed but not yet saved, which is the
          fastest way to make someone stop trusting a tool. */}
      <div className={tab === "review" ? "" : "hidden"}>{review}</div>
      <div className={tab === "editor" ? "" : "hidden"}>{editor}</div>
    </div>
  );
}
