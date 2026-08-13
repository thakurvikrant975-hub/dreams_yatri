import { RotateCcw } from "lucide-react";
import { getRevisionHistory } from "@/app/(dashboard)/dashboard/(builder)/package-builder/review-notes.actions";

// ─────────────────────────────────────────────────────────────────────────────
// Revision history.
//
// When this package came back, and why. A package on its third pass is not the
// same review as one on its first: the reviewer needs to know whether they are
// looking at a fresh quote or at something that has already been argued over,
// and what was said the last time.
//
// custom_packages only ever holds the LATEST revision — each request overwrites
// the one before — so this reads the activity log, where each is a separate row.
// Packages revised before that logging existed show nothing here; that is
// honest, and better than inventing a history from the single surviving note.
// ─────────────────────────────────────────────────────────────────────────────

function when(d: Date): string {
  return d.toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

export async function RevisionHistory({ packageId }: { packageId: string }) {
  const entries = await getRevisionHistory(packageId);
  if (entries.length === 0) return null;

  return (
    <div className="rounded-lg border border-dashboard-base-300 bg-white overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-dashboard-base-300">
        <span className="flex items-center gap-2">
          <RotateCcw className="size-3.5 text-dashboard-neutral" />
          <h3 className="text-sm font-semibold text-dashboard-base-content">Sent back before</h3>
        </span>
        <span className="text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
          {entries.length}×
        </span>
      </div>

      <ol className="divide-y divide-dashboard-base-300">
        {entries.map((e) => (
          <li key={e.id} className="px-4 py-3">
            <p className="text-xs text-dashboard-base-content">{e.note}</p>
            <p className="text-[10px] text-dashboard-neutral mt-1">
              {e.byName ?? "Someone"} · {when(e.at)}
              {/* Pulled back AFTER approval is worth calling out — it means a
                  number this reviewer (or a predecessor) had already signed off
                  was recalled, which is the case most worth a second look. */}
              {e.wasVerified && (
                <span className="ml-1.5 text-amber-700">· after it was approved</span>
              )}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
