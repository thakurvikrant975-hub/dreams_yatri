"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Findings panel — costing's per-element notes on a package under review.
//
// The point of pinning a finding to an element is that a rejection stops being
// a paragraph the exec has to map back onto their itinerary. "Day 3 · Cab —
// rate is above our contracted Ertiga price" is actionable on its own; "pricing
// looks wrong, please review" is not.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertOctagon, Lightbulb, Check, Plus, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import {
  addReviewNote, resolveReviewNote, type ReviewNote,
} from "@/app/(dashboard)/dashboard/(builder)/package-builder/review-notes.actions";

/** The elements a finding can be pinned to, in the order the document renders
 * them. Kept as a list rather than free text so a finding always lands on
 * something the document can highlight. */
const TARGETS = [
  { kind: "PRICING", label: "Pricing" },
  { kind: "STAY", label: "Stay" },
  { kind: "TRANSPORT", label: "Transport" },
  { kind: "ACTIVITY", label: "Experience" },
  { kind: "MEAL", label: "Meals" },
  { kind: "TICKET", label: "Ticket" },
  { kind: "ADDON", label: "Add-on" },
  { kind: "DAY", label: "Whole day" },
  { kind: "PACKAGE", label: "Whole package" },
] as const;

type TargetKind = (typeof TARGETS)[number]["kind"];

/** Which targets are about a specific day, and so need a day number. PRICING
 * and PACKAGE are about the package as a whole. */
function needsDay(kind: TargetKind): boolean {
  return kind !== "PACKAGE" && kind !== "PRICING";
}

function targetLabel(n: ReviewNote): string {
  const base = TARGETS.find((t) => t.kind === n.targetKind)?.label ?? n.targetKind;
  if (n.day == null) return base;
  return `Day ${n.day} · ${base}`;
}

export function CostingFindings({
  packageId, notes, canReview, totalDays,
}: {
  packageId: string;
  notes: ReviewNote[];
  /** False for the exec, and for costing once the package is no longer at
   * READY — the list still renders, just without the controls. */
  canReview: boolean;
  totalDays: number;
}) {
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<TargetKind>("PRICING");
  const [day, setDay] = useState(1);
  const [severity, setSeverity] = useState<"ERROR" | "SUGGESTION">("ERROR");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const open = notes.filter((n) => n.status === "OPEN");
  const closed = notes.filter((n) => n.status === "RESOLVED");
  const errors = open.filter((n) => n.severity === "ERROR").length;

  function submit() {
    const text = message.trim();
    if (!text) { toast.error("Say what needs changing."); return; }
    startTransition(async () => {
      const r = await addReviewNote({
        packageId, targetKind: kind,
        day: needsDay(kind) ? day : null,
        severity, message: text,
      });
      if (r.success) {
        toast.success(r.message);
        setMessage(""); setAdding(false);
      } else toast.error(r.message);
    });
  }

  function close(noteId: string) {
    startTransition(async () => {
      const r = await resolveReviewNote(packageId, noteId);
      if (r.success) toast.success(r.message); else toast.error(r.message);
    });
  }

  return (
    <div className="rounded-lg border border-dashboard-base-300 bg-white overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-dashboard-base-300">
        <div>
          <h3 className="text-sm font-semibold text-dashboard-base-content">Findings</h3>
          <p className="text-[11px] text-dashboard-neutral mt-0.5">
            {open.length === 0
              ? "Nothing raised on this package."
              : `${open.length} open${errors > 0 ? ` · ${errors} blocking` : ""}`}
          </p>
        </div>
        {canReview && !adding && (
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setAdding(true)}>
            <Plus className="size-3.5" /> Raise
          </Button>
        )}
      </div>

      {adding && canReview && (
        <div className="p-4 space-y-3 border-b border-dashboard-base-300 bg-dashboard-base-200/30">
          <div className="flex flex-wrap gap-2">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as TargetKind)}
              className="h-8 rounded-md border border-dashboard-base-300 bg-white px-2 text-xs"
            >
              {TARGETS.map((t) => <option key={t.kind} value={t.kind}>{t.label}</option>)}
            </select>
            {needsDay(kind) && (
              <select
                value={day}
                onChange={(e) => setDay(Number(e.target.value))}
                className="h-8 rounded-md border border-dashboard-base-300 bg-white px-2 text-xs"
              >
                {Array.from({ length: Math.max(1, totalDays) }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>Day {d}</option>
                ))}
              </select>
            )}
            {/* Severity is a real distinction, not a label: an ERROR blocks
                approval, a SUGGESTION does not. */}
            <div className="flex rounded-md border border-dashboard-base-300 overflow-hidden">
              {(["ERROR", "SUGGESTION"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeverity(s)}
                  className={`px-2.5 h-8 text-xs font-medium transition-colors ${
                    severity === s
                      ? s === "ERROR" ? "bg-rose-500 text-white" : "bg-amber-500 text-white"
                      : "bg-white text-dashboard-neutral hover:bg-dashboard-base-200"
                  }`}
                >
                  {s === "ERROR" ? "Blocking" : "Suggestion"}
                </button>
              ))}
            </div>
          </div>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="What is wrong, and what should it be? e.g. Ertiga is quoted at ₹5,500/day — our contracted rate is ₹4,200."
            className="text-xs"
          />
          <div className="flex gap-2">
            <Button size="sm" className="h-8" onClick={submit} disabled={isPending}>
              {isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Add finding"}
            </Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => { setAdding(false); setMessage(""); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="divide-y divide-dashboard-base-300">
        {open.length === 0 && closed.length === 0 && (
          <p className="px-4 py-6 text-center text-xs text-dashboard-neutral">
            No findings yet.
          </p>
        )}
        {[...open, ...closed].map((n) => {
          const isError = n.severity === "ERROR";
          const done = n.status === "RESOLVED";
          return (
            <div key={n.id} className={`px-4 py-3 ${done ? "opacity-55" : ""}`}>
              <div className="flex items-start gap-2">
                {isError
                  ? <AlertOctagon className={`size-3.5 shrink-0 mt-0.5 ${done ? "text-dashboard-neutral" : "text-rose-500"}`} />
                  : <Lightbulb className={`size-3.5 shrink-0 mt-0.5 ${done ? "text-dashboard-neutral" : "text-amber-500"}`} />}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-dashboard-neutral">
                    {targetLabel(n)}
                  </p>
                  <p className={`text-xs mt-0.5 text-dashboard-base-content ${done ? "line-through" : ""}`}>
                    {n.message}
                  </p>
                  <p className="text-[10px] text-dashboard-neutral mt-1">
                    {n.createdByName ?? "Costing"}
                    {done && n.resolvedByName ? ` · closed by ${n.resolvedByName}` : ""}
                  </p>
                </div>
                {canReview && !done && (
                  <button
                    type="button"
                    onClick={() => close(n.id)}
                    disabled={isPending}
                    title="Close this finding"
                    className="shrink-0 flex items-center justify-center size-6 rounded-md text-dashboard-neutral hover:bg-dashboard-base-200 hover:text-emerald-600 transition-colors"
                  >
                    <Check className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
