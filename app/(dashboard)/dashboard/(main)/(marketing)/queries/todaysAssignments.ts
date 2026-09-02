/**
 * The arithmetic behind the "Today's Assignments" popup, kept out of the
 * component so it can be exercised directly (scripts/test-todays-assignments.ts)
 * — the numbers on this panel are read as a daily fact about the team, and a
 * miscount here is the kind that gets believed.
 */
import { istDayKey } from "../../lead-report/ist";
import type { PackageQuery } from "./actions";

/** Only what the count needs — so a fixture doesn't have to be a whole lead. */
export type AssignmentLead = Pick<
    PackageQuery,
    "createdAt" | "assignedTo" | "assignedToName" | "assignedAt"
>;

export type OwnerRow = { key: string; name: string; count: number };

export type TodaysAssignments = {
    /** Who was handed what today, biggest first. Sums to `handedOutToday`. */
    rows: OwnerRow[];
    /** Today's intake. The two figures below split it, and add back up to it. */
    totalReceivedToday: number;
    receivedAssigned: number;
    receivedUnassigned: number;
    /** Assignments made today, whenever the lead itself came in. */
    handedOutToday: number;
    /** How many of those were leads that came in before today. */
    carriedOver: number;
};

export function summariseTodaysAssignments(
    queries: AssignmentLead[],
    now: Date = new Date(),
): TodaysAssignments {
    // The IST calendar day, not the viewer's. "Today" here means the working
    // day the lead manager is having — a laptop left on another timezone must
    // not quietly shift which leads are counted, and the lead report already
    // draws the day's boundary at IST midnight.
    const today = istDayKey(now);
    const onToday = (d: Date | string | null) => !!d && istDayKey(d) === today;

    /*
     * Two different populations, deliberately kept apart. This is the whole
     * point of the panel's shape.
     *
     * Today's INTAKE is every lead that came in today, and it is the only
     * thing the received figures describe: they split it exactly.
     *
     * What was HANDED OUT today is a different set — most of a morning's
     * assignments are last night's leads — so it is reported on its own, with
     * a carried-over count, rather than sitting in the same row of tiles.
     * Reading one against the other is what made this panel look broken: 43
     * assignments beside 32 leads received is not a miscount, it is yesterday
     * evening's intake being handed out today.
     */
    const receivedToday = queries.filter((q) => onToday(q.createdAt));
    const receivedAssigned = receivedToday.filter((q) => q.assignedTo).length;
    const receivedUnassigned = receivedToday.length - receivedAssigned;

    const assignedToday = queries.filter((q) => q.assignedTo && onToday(q.assignedAt));

    const byOwner = new Map<string, OwnerRow>();
    for (const q of assignedToday) {
        const key = q.assignedTo!;
        const row = byOwner.get(key);
        if (row) row.count += 1;
        else byOwner.set(key, { key, name: q.assignedToName?.trim() || "Unnamed", count: 1 });
    }

    return {
        rows: [...byOwner.values()].sort((a, b) => b.count - a.count),
        totalReceivedToday: receivedToday.length,
        receivedAssigned,
        receivedUnassigned,
        handedOutToday: assignedToday.length,
        carriedOver: assignedToday.filter((q) => !onToday(q.createdAt)).length,
    };
}
