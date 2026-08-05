"use client";

import { useMemo, useState } from "react";
import { isToday } from "date-fns";
import { CalendarCheck2, UserCheck, Inbox, UserX } from "lucide-react";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import type { PackageQuery } from "./actions";

// Computed entirely from the `queries` prop this dialog is handed — that
// list is already the full, unfiltered/unpaginated fetch QueriesTable itself
// works from (see getQueries), so no extra server round-trip is needed for a
// same-day snapshot like this.
function useTodaysAssignments(queries: PackageQuery[]) {
    return useMemo(() => {
        const assignedToday = queries.filter((q) => q.assignedAt && isToday(new Date(q.assignedAt)));
        const receivedToday = queries.filter((q) => isToday(new Date(q.createdAt)));
        const unassignedToday = receivedToday.filter((q) => !q.assignedTo);

        const byExec = new Map<string, { name: string; count: number }>();
        for (const q of assignedToday) {
            const key = q.assignedTo ?? "unknown";
            const name = q.assignedToName ?? "Unassigned";
            const entry = byExec.get(key);
            if (entry) entry.count += 1;
            else byExec.set(key, { name, count: 1 });
        }
        const rows = [...byExec.values()].sort((a, b) => b.count - a.count);

        return {
            rows,
            totalAssignedToday: assignedToday.length,
            totalReceivedToday: receivedToday.length,
            totalUnassignedToday: unassignedToday.length,
        };
    }, [queries]);
}

export function TodaysAssignmentDialog({ queries }: { queries: PackageQuery[] }) {
    const [open, setOpen] = useState(false);
    const { rows, totalAssignedToday, totalReceivedToday, totalUnassignedToday } = useTodaysAssignments(queries);
    const maxCount = Math.max(1, ...rows.map((r) => r.count));

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
                        How many leads each sales executive was handed today, and how today&apos;s intake broke down.
                    </DialogDescription>
                </DialogHeader>

                <div className="px-6 py-4 space-y-5">
                    {/* Today's headline numbers */}
                    <div className="grid grid-cols-3 gap-2.5">
                        <div className="rounded-lg border border-dashboard-base-300 px-3 py-2.5 text-center">
                            <Inbox className="size-3.5 text-dashboard-primary mx-auto mb-1" />
                            <p className="text-lg font-bold text-dashboard-base-content leading-none">{totalReceivedToday}</p>
                            <p className="text-[10px] text-dashboard-base-content/50 mt-1">Received</p>
                        </div>
                        <div className="rounded-lg border border-dashboard-base-300 px-3 py-2.5 text-center">
                            <UserCheck className="size-3.5 text-dashboard-info mx-auto mb-1" />
                            <p className="text-lg font-bold text-dashboard-base-content leading-none">{totalAssignedToday}</p>
                            <p className="text-[10px] text-dashboard-base-content/50 mt-1">Assigned</p>
                        </div>
                        <div className={`rounded-lg border px-3 py-2.5 text-center ${totalUnassignedToday > 0 ? "border-dashboard-warning/50 bg-dashboard-warning/5" : "border-dashboard-base-300"}`}>
                            <UserX className="size-3.5 text-dashboard-warning mx-auto mb-1" />
                            <p className="text-lg font-bold text-dashboard-base-content leading-none">{totalUnassignedToday}</p>
                            <p className="text-[10px] text-dashboard-base-content/50 mt-1">Unassigned</p>
                        </div>
                    </div>

                    {/* Per-exec breakdown */}
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-dashboard-base-content/50 mb-2">
                            Given to which sales executive
                        </p>
                        {rows.length === 0 ? (
                            <p className="text-sm text-dashboard-base-content/40 italic py-6 text-center">
                                No queries assigned to anyone yet today.
                            </p>
                        ) : (
                            <ul className="space-y-2">
                                {rows.map((r) => (
                                    <li key={r.name} className="flex items-center gap-3">
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
