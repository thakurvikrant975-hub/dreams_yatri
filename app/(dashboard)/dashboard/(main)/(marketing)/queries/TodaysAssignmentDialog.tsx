"use client";

import { useMemo, useState } from "react";
import { CalendarCheck2, UserCheck, Inbox, UserX } from "lucide-react";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { summariseTodaysAssignments } from "./todaysAssignments";
import type { PackageQuery } from "./actions";

export function TodaysAssignmentDialog({ queries }: { queries: PackageQuery[] }) {
    const [open, setOpen] = useState(false);
    // Counted from the `queries` prop this dialog is handed — that list is
    // already the full, unfiltered/unpaginated fetch QueriesTable itself works
    // from (see getQueries), so no extra server round-trip is needed for a
    // same-day snapshot like this.
    const {
        rows, totalReceivedToday, receivedAssigned, receivedUnassigned,
        handedOutToday, carriedOver,
    } = useMemo(() => summariseTodaysAssignments(queries), [queries]);
    const maxCount = Math.max(1, ...rows.map((r) => r.count));

    const tiles = [
        { label: "Received", value: totalReceivedToday, icon: Inbox, tone: "text-dashboard-primary", warn: false },
        { label: "Assigned", value: receivedAssigned, icon: UserCheck, tone: "text-dashboard-info", warn: false },
        { label: "Unassigned", value: receivedUnassigned, icon: UserX, tone: "text-dashboard-warning", warn: receivedUnassigned > 0 },
    ];

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="gap-1.5">
                    <CalendarCheck2 className="size-3.5" /> Today&apos;s Assignments
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto bg-dashboard-base-100 border border-dashboard-base-300 rounded-2xl p-0">
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-dashboard-base-300">
                    <DialogTitle className="flex items-center gap-2.5 text-dashboard-base-content">
                        <CalendarCheck2 className="size-4 text-dashboard-primary" />
                        Today&apos;s Query Assignments
                    </DialogTitle>
                    <DialogDescription>
                        Today&apos;s intake and where it went, then everything handed out today —
                        including leads that came in earlier.
                    </DialogDescription>
                </DialogHeader>

                <div className="px-6 py-4 space-y-5">
                    {/* Today's intake. Assigned + Unassigned add up to Received,
                        which is the reconciliation the old three tiles broke. */}
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-dashboard-base-content/50 mb-2">
                            Leads received today
                        </p>
                        <div className="grid grid-cols-3 gap-2.5">
                            {tiles.map(({ label, value, icon: Icon, tone, warn }) => (
                                <div
                                    key={label}
                                    className={`rounded-lg border px-3 py-2.5 text-center ${warn ? "border-dashboard-warning/50 bg-dashboard-warning/5" : "border-dashboard-base-300"}`}
                                >
                                    <Icon className={`size-3.5 ${tone} mx-auto mb-1`} />
                                    <p className="text-lg font-bold text-dashboard-base-content leading-none">{value}</p>
                                    <p className="text-[10px] text-dashboard-base-content/50 mt-1">{label}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Per-exec breakdown of what was handed out today */}
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-dashboard-base-content/50">
                            Handed out today
                        </p>
                        {/* Says in words why this total can run ahead of the
                            leads received above — the reading that made the
                            old tiles look like a miscount. */}
                        {handedOutToday > 0 && (
                            <p className="text-[11px] text-dashboard-base-content/40 mt-0.5 mb-2">
                                {carriedOver > 0
                                    ? `${handedOutToday} in total — ${handedOutToday - carriedOver} of today's leads, ${carriedOver} that came in earlier.`
                                    : `${handedOutToday} in total, all from today's leads.`}
                            </p>
                        )}
                        {rows.length === 0 ? (
                            <p className="text-sm text-dashboard-base-content/40 italic py-6 text-center">
                                Nothing handed out to anyone yet today.
                            </p>
                        ) : (
                            <ul className="space-y-2 mt-2">
                                {rows.map((r) => (
                                    <li key={r.key} className="flex items-center gap-3">
                                        <span className="w-24 shrink-0 truncate text-sm text-dashboard-base-content">{r.name}</span>
                                        <div className="flex-1 h-2 rounded-full bg-dashboard-base-200 overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-dashboard-primary"
                                                style={{ width: `${(r.count / maxCount) * 100}%` }}
                                            />
                                        </div>
                                        <span className="w-6 shrink-0 text-right text-sm font-semibold text-dashboard-base-content tabular-nums">{r.count}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
