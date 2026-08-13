"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Revision history — a button, and a table behind it.
//
// A package can come back many times, and the reasons are prose rather than
// labels. Stacked inline they push the findings and the breakdown off screen on
// exactly the packages where those matter most; a table in a modal gives each
// reason room to be read and keeps the sequence scannable.
//
// The button carries the count, so a reviewer knows this package has history
// before opening anything — which is the part that changes how they read the
// rest of the screen.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "../../components/ui/dialog";
import type { RevisionEntry } from "@/app/(dashboard)/dashboard/(builder)/package-builder/review-notes.actions";

function when(d: Date | string): string {
  return new Date(d).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

export function RevisionHistoryDialog({ entries, variant = "panel" }: {
  entries: RevisionEntry[];
  /** "header" is the compact toolbar pill; "panel" fills a sidebar column. */
  variant?: "panel" | "header";
}) {
  const [open, setOpen] = useState(false);
  // Nothing to show on a first pass, and an empty "0 revisions" control would
  // just be noise in a toolbar that is already busy.
  if (entries.length === 0) return null;

  const header = variant === "header";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          title={`Sent back ${entries.length} ${entries.length === 1 ? "time" : "times"} before`}
          className={
            header
              ? "h-8 flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 text-amber-800 hover:bg-amber-100 transition-colors"
              : "w-full flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-left hover:bg-amber-100/70 transition-colors"
          }
        >
          <span className="flex items-center gap-1.5 min-w-0">
            <RotateCcw className={header ? "size-3.5 shrink-0" : "size-3.5 shrink-0 text-amber-600"} />
            <span className={header ? "text-xs font-medium" : "text-xs font-semibold text-amber-900"}>
              {header ? "Revisions" : "Sent back before"}
            </span>
          </span>
          <span
            className={
              header
                ? "text-[11px] font-bold"
                : "shrink-0 text-[11px] font-bold text-amber-800 bg-amber-200/70 rounded-full px-2 py-0.5"
            }
          >
            {entries.length}{header ? "" : "×"}
          </span>
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Revision history</DialogTitle>
          <DialogDescription>
            Every time this package was pulled back, newest first. A package
            returned repeatedly for the same objection is worth reading
            differently from one on its first pass.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-auto rounded-lg border border-dashboard-base-300">
          <table className="w-full text-sm border-separate" style={{ borderSpacing: 0 }}>
            <thead className="sticky top-0">
              <tr className="bg-dashboard-base-200">
                <th className="text-left font-semibold px-3 py-2 text-xs w-40 border-b border-dashboard-base-300">When</th>
                <th className="text-left font-semibold px-3 py-2 text-xs border-b border-dashboard-base-300">Reason</th>
                <th className="text-left font-semibold px-3 py-2 text-xs w-32 border-b border-dashboard-base-300">By</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={e.id} className={i % 2 === 1 ? "bg-dashboard-base-200/40" : ""}>
                  <td className="align-top px-3 py-2.5 text-[11px] text-dashboard-neutral whitespace-nowrap border-b border-dashboard-base-300/70">
                    {when(e.at)}
                    {/* Recalled after approval is the entry worth noticing: a
                        number already signed off was withdrawn. */}
                    {e.wasVerified && (
                      <span className="block mt-0.5 text-[10px] font-medium text-amber-700">
                        after approval
                      </span>
                    )}
                  </td>
                  <td className="align-top px-3 py-2.5 text-xs text-dashboard-base-content border-b border-dashboard-base-300/70">
                    {e.note || <span className="text-dashboard-neutral italic">No reason given</span>}
                  </td>
                  <td className="align-top px-3 py-2.5 text-[11px] text-dashboard-neutral border-b border-dashboard-base-300/70">
                    {e.byName ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
