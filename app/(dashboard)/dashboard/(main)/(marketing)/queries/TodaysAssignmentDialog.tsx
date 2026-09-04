"use client";

import { useMemo, useState } from "react";
import { CalendarCheck2, UserCheck, Clock, AlertTriangle } from "lucide-react";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { summariseTodaysAssignments } from "./todaysAssignments";
import { istShortDay } from "../../lead-report/ist";
import type { PackageQuery } from "./actions";

export function TodaysAssignmentDialog({ queries }: { queries: PackageQuery[] }) {
    const [open, setOpen] = useState(false);
    // Counted from the `queries` prop this dialog is handed — that list is
    // already the full, unfiltered/unpaginated fetch QueriesTable itself works
    // from (see getQueries), so no extra server round-trip is needed for a
    // same-day snapshot like this.
    const { summary, yesterdayLabel } = useMemo(() => {
        // One clock for both, so the label can never name a different day
        // than the count it explains.
        const now = new Date();
        return {
            summary: summariseTodaysAssignments(queries, now),
            // Named, not called "before that" — a manager checking this
            // against the day's mails has to know which day is meant.
            yesterdayLabel: istShortDay(new Date(now.getTime() - 24 * 60 * 60 * 1000)),
        };
    }, [queries]);
    const {
        rows, totalReceivedToday, receivedAssigned, receivedUnassigned,
        handedOutToday, handedOutFromToday, carriedOver,
        unassignedYesterday, unassignedOlder,
    } = summary;
    const backlog = unassignedYesterday + unassignedOlder;
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
                        Everything handed out today — today&apos;s leads and the ones that
                        came in earlier — then what is still waiting for an owner.
                    </DialogDescription>
                </DialogHeader>

                <div className="px-6 py-4 space-y-5">
                    {/* Handed out today leads the panel because it is the one
                        figure that ties out against the day's assignment mails:
                        one mail per handover, whichever day the lead arrived.
                        Received/assigned/unassigned used to sit here and could
                        not be reconciled with an inbox at all — 48 received
                        against 62 mails reads as a miscount until you know 14
                        of those mails were yesterday's leads. */}
                    <div className="rounded-xl border border-dashboard-primary/30 bg-dashboard-primary/5 px-4 py-3.5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-dashboard-base-content/50">
                            Handed out today
                        </p>
                        <p className="mt-1.5 flex items-baseline gap-2">
                            <span className="text-3xl font-bold leading-none text-dashboard-base-content tabular-nums">
                                {handedOutToday}
                            </span>
                            <span className="text-xs text-dashboard-base-content/50">
                                in total
                            </span>
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                            <div className="rounded-lg border border-dashboard-base-300 bg-dashboard-base-100 px-3 py-2">
                                <p className="text-lg font-bold leading-none text-dashboard-base-content tabular-nums">
                                    {handedOutFromToday}
                                </p>
                                <p className="mt-1 text-[11px] text-dashboard-base-content/50">
                                    of today&apos;s leads
                                </p>
                            </div>
                            <div className="rounded-lg border border-dashboard-base-300 bg-dashboard-base-100 px-3 py-2">
                                <p className="text-lg font-bold leading-none text-dashboard-base-content tabular-nums">
                                    {carriedOver}
                                </p>
                                <p className="mt-1 text-[11px] text-dashboard-base-content/50">
                                    came in earlier
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Today's intake, now secondary: it answers "is anything
                        from today still sitting?", not "how many mails went
                        out?". Assigned + waiting add up to what came in. */}
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-dashboard-base-content/50 mb-2">
                            {totalReceivedToday === 0
                                ? "Leads received today"
                                : totalReceivedToday === 1
                                    ? "Of the 1 lead received today"
                                    : `Of the ${totalReceivedToday} leads received today`}
                        </p>
                        {totalReceivedToday === 0 ? (
                            <p className="text-sm text-dashboard-base-content/40 italic">
                                No new leads have come in today yet.
                            </p>
                        ) : (
                            <div className="grid grid-cols-2 gap-2.5">
                                <div className="flex items-center gap-2.5 rounded-lg border border-dashboard-base-300 px-3 py-2">
                                    <UserCheck className="size-4 shrink-0 text-dashboard-info" />
                                    <div className="min-w-0">
                                        <p className="text-base font-bold leading-none text-dashboard-base-content tabular-nums">
                                            {receivedAssigned}
                                        </p>
                                        <p className="mt-1 text-[11px] text-dashboard-base-content/50">assigned</p>
                                    </div>
                                </div>
                                <div className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 ${receivedUnassigned > 0 ? "border-dashboard-warning/50 bg-dashboard-warning/5" : "border-dashboard-base-300"}`}>
                                    <Clock className={`size-4 shrink-0 ${receivedUnassigned > 0 ? "text-dashboard-warning" : "text-dashboard-base-content/40"}`} />
                                    <div className="min-w-0">
                                        <p className="text-base font-bold leading-none text-dashboard-base-content tabular-nums">
                                            {receivedUnassigned}
                                        </p>
                                        <p className="mt-1 text-[11px] text-dashboard-base-content/50">still waiting</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* The backlog neither figure above can show. Leads arrive
                        all evening and the day turns at IST midnight, so last
                        night's unassigned leads belong to "yesterday" by the
                        time anyone opens this — and appeared in no figure at
                        all, which is exactly where leads went missing. */}
                    {backlog > 0 && (
                        <div className="flex items-start gap-2.5 rounded-lg border border-dashboard-warning/40 bg-dashboard-warning/5 px-3 py-2.5">
                            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-dashboard-warning" />
                            <div className="min-w-0">
                                <p className="text-xs font-medium text-dashboard-base-content">
                                    {backlog} earlier lead{backlog === 1 ? "" : "s"} still waiting for an owner
                                </p>
                                <p className="mt-0.5 text-[11px] text-dashboard-base-content/50">
                                    {unassignedYesterday > 0 && `${unassignedYesterday} from yesterday (${yesterdayLabel})`}
                                    {unassignedYesterday > 0 && unassignedOlder > 0 && ", "}
                                    {unassignedOlder > 0 && `${unassignedOlder} from days before ${yesterdayLabel}`}
                                    {" — these came in on earlier days, so neither figure above counts them."}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Per-exec breakdown of what was handed out today. The
                        total now sits in the card above, so this is only the
                        split. */}
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-dashboard-base-content/50">
                            Who got them
                        </p>
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
