"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Moving between the packages built for one query.
//
// A query can carry more than one package: an exec duplicates a draft to quote
// the same trip a second way — a cheaper hotel set, a shorter route — and both
// are real quotes the client may be sent. The sales-query table links exactly
// one of them per row (whichever needs attention, else the newest), which is
// right for a list but means the second package has no route in from the
// builder. Duplicate a package and you land in the copy with no way back to
// the original except leaving the builder and opening the query's detail
// sheet, which nobody finds.
//
// So the header says which package you are in, and how many there are. It is a
// plain link list rather than a select: each package is its own page, and the
// browser should treat it that way — middle-click to open the other quote in a
// tab is exactly what an exec comparing two of them wants.
//
// Renders nothing for the ordinary single-package query, which is most of
// them. getSiblingPackages returns an empty list below two for that reason.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { Layers, Check } from "lucide-react";
import { cn } from "@/app/lib/utils";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/app/(dashboard)/dashboard/(main)/components/ui/dropdown-menu";
import { getSiblingPackages, type SiblingPackage } from "./action";

/** What the package is doing right now, in the words the exec uses for it.
 * Deliberately not the raw status: READY reads as "ready to send" to everyone
 * who has not learned that it means "sitting with costing". */
function stateOf(p: SiblingPackage): { label: string; className: string } {
  if (p.rejectedAt && p.status === "DRAFT") {
    return { label: "Needs rework", className: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300" };
  }
  if (p.status === "SENT") {
    return { label: "Sent", className: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" };
  }
  if (p.status === "READY" && p.verified) {
    return { label: "Approved", className: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300" };
  }
  if (p.status === "READY") {
    return { label: "In review", className: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" };
  }
  return { label: "Draft", className: "bg-dashboard-base-300 text-dashboard-base-content/70" };
}

export function PackageSwitcher({ packageId, basePath, className }: {
  packageId: string;
  /** Where a sibling lives — the builder this switcher is mounted in, so a
   * switch inside v2 stays in v2 rather than dropping the exec into v1. */
  basePath: string;
  className?: string;
}) {
  const [packages, setPackages] = useState<SiblingPackage[]>([]);

  useEffect(() => {
    let cancelled = false;
    getSiblingPackages(packageId)
      .then((rows) => { if (!cancelled) setPackages(rows); })
      // Silent. This is a convenience on a header whose job is the package in
      // front of you; a failed read here must not look like a broken builder.
      .catch(() => { if (!cancelled) setPackages([]); });
    return () => { cancelled = true; };
  }, [packageId]);

  if (packages.length < 2) return null;

  const index = packages.findIndex((p) => p.id === packageId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 h-7 px-2 rounded-md shrink-0 cursor-pointer",
            "border border-dashboard-base-300 bg-dashboard-base-200/60",
            "text-[11px] font-semibold text-dashboard-base-content/75",
            "hover:bg-dashboard-base-200 hover:text-dashboard-base-content transition-colors",
            className,
          )}
          title="This query has more than one package"
        >
          <Layers size={12} />
          {/* Ordered newest first, so "1 of 3" is the most recent quote. */}
          <span>{index >= 0 ? index + 1 : "—"} of {packages.length}</span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-[11px] font-semibold text-dashboard-base-content/60">
          {packages.length} packages for this query
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {packages.map((p) => {
          const state = stateOf(p);
          return (
            <DropdownMenuItem key={p.id} asChild className="cursor-pointer">
              <a
                href={`${basePath}/${p.id}`}
                // The current one is a link too, not a disabled row: clicking
                // the package you are already in should reload it, not feel
                // broken.
                className="flex items-start gap-2 py-1.5"
              >
                <span className="w-3.5 shrink-0 pt-0.5">
                  {p.isCurrent && <Check size={13} className="text-dashboard-primary" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn(
                    "block text-xs truncate",
                    p.isCurrent ? "font-semibold text-dashboard-base-content" : "text-dashboard-base-content/85",
                  )}>
                    {p.title || "Untitled package"}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5">
                    <span className={cn("rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wide", state.className)}>
                      {state.label}
                    </span>
                    {p.pricePerPerson ? (
                      <span className="text-[10px] tabular-nums text-dashboard-base-content/55">
                        ₹{Math.round(p.pricePerPerson).toLocaleString("en-IN")}/person
                      </span>
                    ) : (
                      <span className="text-[10px] text-dashboard-base-content/40">no price yet</span>
                    )}
                  </span>
                  {/* Who built it, when two execs have quoted the same lead. */}
                  {p.builtByName && (
                    <span className="mt-0.5 block text-[10px] text-dashboard-base-content/45 truncate">
                      {p.builtByName} · {new Date(p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>
                  )}
                </span>
              </a>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
