"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, formatDistanceToNow, isToday } from "date-fns";
import {
    CalendarClock, Eye, Phone, Mail, PhoneCall,
    MapPin, Users, Calendar, StickyNote, TrendingUp,
    RotateCcw, ClipboardList, Inbox, Send, Clock, UserCheck,
    CircleX, Package, Plus, Focus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
    Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from "../../components/ui/tooltip";
import { DateRangePicker } from "../../components/ui/date-range-picker";
import { DataTable, type ColumnDef } from "../../components/dashboard/Datatable";
import { TableFilters } from "../../components/dashboard/Tablefilters";
import { MinNumberFilter } from "../../components/dashboard/MinNumberFilter";
import { Stats } from "../../components/dashboard/Stats";
import { SalesQueryStatusBadge, PackageVerificationBadge, PackageSentBadge, HotelRequestBadge, LibraryStatusBadge } from "./Salesquerybadges";
import { AddFollowUpDialog } from "./Addfollowupdialog";
import { CallLogDialog } from "./CallLogDialog";
import { PackageDetailsDialog } from "./Packagedetailsdialog";
import { CreatePackageDialog } from "./CreatePackageDialog";
import { SalesQueryDetailSheet } from "./Salesquerydetailsheet";
import { reopenSalesQuery, getSalesQueryById, getMyTeamMembers, reassignToTeamMember } from "./actions";
import { hasRequirements } from "./requirements";
import { mapCustomPackage } from "./package-status";
import { AssignQueryDropdown } from "../../(marketing)/queries/Assignquerydropdown";
import { QueryTimelineSheet } from "../../(marketing)/queries/QueryTimelineSheet";
import type { SalesQueryRow, CallLogStatus } from "./actions";
import type { PackageQueryType, CloseReason, RejectionReason, PackageRequirements, SalesMember } from "../../(marketing)/queries/actions";
import { SalesQueryStatus } from "./query-status";
import { StatCard, StatGrid } from "../../components/dashboard/Statcard";
import { cn } from "@/app/lib/utils";
import Image from "next/image";
import { TableEmptyState } from "../../components/dashboard/TableEmptyState";

// ── Types ─────────────────────────────────────────────────────────────────────

// Matches the color language CallLogDialog's status picker uses.
const CALL_STATUS_DOT: Record<CallLogStatus, string> = {
    CONNECTED:  "bg-green-500",
    NOT_PICKED: "bg-yellow-500",
    DECLINED:   "bg-red-500",
};

type SalesQueryWithDetails = SalesQueryRow & {
    // queryFollowUps from DB mapped to followUps for the sheet
    followUps: Array<{
        id: string;
        note: string;
        followUpAt: Date | null;
        createdAt: Date;
        createdById: string | null;
        createdByName: string | null;
    }>;
    notes: Array<{ id: string; content: string; createdAt: Date }>;
};

type Props = {
    queries: SalesQueryRow[];
    closeReasons: CloseReason[];
    rejectionReasons: RejectionReason[];
    /** The viewer's own SalesTeam roster — empty for anyone who isn't a Team
     * Leader. Feeds the "Assigned To" filter dropdown. */
    teamMembers?: SalesMember[];
    /** Active date range (YYYY-MM-DD), server-scoped — see page.tsx. */
    from: string;
    to: string;
    isAllTime: boolean;
    /** True when the viewer leads a SalesTeam — `queries` then spans the
     * whole team, so the table shows an "Assigned To" column. */
    isTeamLead?: boolean;
};

const PAGE_SIZE = 10;

function todayStr() {
    return new Date().toISOString().split("T")[0];
}
function firstOfMonthStr() {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
}

// ── Status helpers ────────────────────────────────────────────────────────────

function isActiveStatus(status: SalesQueryStatus) {
    return status === "IN_PROGRESS";
}

function isClosedStatus(status: SalesQueryStatus) {
    return status === "CLOSED";
}
function isConvertedStatus(status: SalesQueryStatus) {
    return status === "CONVERTED";
}

// ── Action Cell ───────────────────────────────────────────────────────────────

function ActionCell({
    query,
    onView,
    isTeamLead,
}: {
    query: PackageQueryType;
    onView: () => void;
    /** Shows the Timeline sheet, with its "add note" form enabled — a Team
     * Leader's way of updating a query's timeline directly, rather than only
     * reading it. */
    isTeamLead: boolean;
}) {
    const [isPendingReopen, startReopen] = useTransition();
    const closed = isClosedStatus(query.status as SalesQueryStatus);
    const converted = isConvertedStatus(query.status as SalesQueryStatus);
    function handleReopen(e: React.MouseEvent) {
        e.stopPropagation();
        startReopen(async () => {
            const r = await reopenSalesQuery(query.id);
            if (r.success) toast.success(r.message);
            else toast.error(r.message);
        });
    }

    return (
        <TooltipProvider delayDuration={300}>
            <div className="flex items-center justify-end gap-1">

                {/* A Team Leader oversees rather than builds — Package
                    Requirements/Follow-Up are the exec's own tools for
                    working a query, not theirs. Timeline is the reverse: it's
                    how a leader records something on a query without taking
                    it over, so it stays available even on a closed one. */}
                {!isTeamLead && !closed && !converted && (
                    <>
                                {/* Log Call */}
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span onClick={(e) => e.stopPropagation()}>
                                            <CallLogDialog queryId={query.id} leadName={query.name}>
                                                <Button
                                                    variant="ghost" size="icon"
                                                    className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-950/30"
                                                >
                                                    <PhoneCall className="h-3.5 w-3.5" />
                                                </Button>
                                            </CallLogDialog>
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent>Log Call</TooltipContent>
                                </Tooltip>

                                {/* Package Requirements */}
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span onClick={(e) => e.stopPropagation()}>
                                            <PackageDetailsDialog
                                                query={query}
                                                initialRequirements={query.requirements as PackageRequirements | null}
                                            >
                                                <Button
                                                    variant="ghost" size="icon"
                                                    className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                                                >
                                                    <ClipboardList className="h-3.5 w-3.5" />
                                                </Button>
                                            </PackageDetailsDialog>
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent>Fill Package Requirements</TooltipContent>
                                </Tooltip>

                                {/* Add Follow-Up */}
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span onClick={(e) => e.stopPropagation()}>
                                            <AddFollowUpDialog salesQueryId={query.id} leadName={query.name}>
                                                <Button
                                                    variant="ghost" size="icon"
                                                    className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-950/30"
                                                >
                                                    <CalendarClock className="h-3.5 w-3.5" />
                                                </Button>
                                            </AddFollowUpDialog>
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent>Add Follow-Up</TooltipContent>
                                </Tooltip>
                            </>
                )}

                {isTeamLead && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span onClick={(e) => e.stopPropagation()}>
                                <QueryTimelineSheet
                                    queryId={query.id}
                                    leadName={query.name}
                                    fetchQuery={getSalesQueryById}
                                    canAddNote
                                />
                            </span>
                        </TooltipTrigger>
                        <TooltipContent>View &amp; update timeline</TooltipContent>
                    </Tooltip>
                )}

                {/* Reopen — closed only */}
                {closed && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost" size="icon"
                                className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30"
                                onClick={handleReopen}
                                disabled={isPendingReopen}
                            >
                                <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Reopen Query</TooltipContent>
                    </Tooltip>
                )}
            </div>
        </TooltipProvider>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function SalesQueriesTable({
    queries, closeReasons, rejectionReasons, teamMembers = [], from, to, isAllTime, isTeamLead = false,
}: Props) {
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState<"all" | SalesQueryStatus>("all");
    const [filterAssignedTo, setFilterAssignedTo] = useState<"all" | "unassigned" | string>("all");
    const [filterDestination, setFilterDestination] = useState("all");
    const [minCost, setMinCost] = useState<number | null>(null);
    const [minGroupSize, setMinGroupSize] = useState<number | null>(null);
    const [page, setPage] = useState(1);

    // ── Focus Mode — hides Converted/Closed queries so the list is only
    // what still needs work. "Sticks" across visits via localStorage, since
    // the whole point is not having to re-enable it every time you land
    // here. Starts off on the server render to avoid a hydration mismatch,
    // then syncs to the stored value right after mount.
    const [focusMode, setFocusMode] = useState(false);
    useEffect(() => {
        try {
            if (localStorage.getItem("salesQuery.focusMode") === "1") setFocusMode(true);
        } catch { /* localStorage unavailable — focus mode just won't persist */ }
    }, []);
    function toggleFocusMode() {
        setFocusMode(prev => {
            const next = !prev;
            try { localStorage.setItem("salesQuery.focusMode", next ? "1" : "0"); } catch { /* ignore */ }
            return next;
        });
        setPage(1);
    }

    // ── Date range — server-driven via URL, same pattern as
    // LeadManagerAnalytics.tsx: router.replace inside a transition so the
    // page doesn't flash the Suspense fallback on every range change. ───────
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const isThisMonth = !isAllTime && from === firstOfMonthStr() && to === todayStr();

    function setRange(newFrom: string, newTo: string) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("from", newFrom);
        params.set("to", newTo);
        params.delete("range");
        startTransition(() => router.replace(`?${params.toString()}`));
    }
    function setAllTime() {
        const params = new URLSearchParams(searchParams.toString());
        params.set("range", "all");
        params.delete("from");
        params.delete("to");
        startTransition(() => router.replace(`?${params.toString()}`));
    }

    const rangeLabel = isAllTime
        ? "All time"
        : isThisMonth
            ? "This month"
            : from === to
                ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${from}T00:00:00`))
                : `${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(`${from}T00:00:00`))} – ${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${to}T00:00:00`))}`;

    // Detail sheet
    const [sheetOpen, setSheetOpen] = useState(false);
    const [detailQuery, setDetailQuery] = useState<SalesQueryWithDetails | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    async function openDetail(query: PackageQueryType) {
        setSheetOpen(true);
        setLoadingDetail(true);

        try {
            const full = await getSalesQueryById(query.id);
            if (!full) return;

            const normalized: SalesQueryWithDetails = {
                ...(full as unknown as SalesQueryRow),
                // Map queryFollowUps → followUps for the detail sheet
                followUps: (full as any).queryFollowUps ?? [],
                notes: (full as any).notes ?? [],
                customPackages: ((full as any).custom_packages ?? []).map(mapCustomPackage),
            };

            setDetailQuery(normalized);
        } finally {
            setLoadingDetail(false);
        }
    }

    // ── Filtering ─────────────────────────────────────────────────────────────
    const filtered = queries.filter(q => {
        const s = search.toLowerCase();
        const matchSearch = !search
            || q.name.toLowerCase().includes(s)
            || q.phone.includes(s)
            || (q.email ?? "").toLowerCase().includes(s)
            || (q.destination ?? "").toLowerCase().includes(s)
            || (q.packageName ?? "").toLowerCase().includes(s);

        const matchStatus = filterStatus === "all" || q.status === filterStatus;

        const matchAssignedTo = filterAssignedTo === "all"
            || (filterAssignedTo === "unassigned" ? !q.assignedTo : q.assignedTo === filterAssignedTo);

        const matchFocus = !focusMode
            || (!isClosedStatus(q.status as SalesQueryStatus) && !isConvertedStatus(q.status as SalesQueryStatus));

        const matchDestination = filterDestination === "all" || q.destination === filterDestination;
        // A query can carry several packages (e.g. budget options) — "cost
        // at least X" matches if any one of them clears the bar, same as
        // asking "does this lead have a package that costs at least X".
        const matchCost = minCost === null
            || q.customPackages.some((p) => p.totalPrice !== null && p.totalPrice >= minCost);
        const matchGroupSize = minGroupSize === null || (q.groupSize !== null && q.groupSize >= minGroupSize);

        return matchSearch && matchStatus && matchAssignedTo && matchFocus
            && matchDestination && matchCost && matchGroupSize;
    });

    const destinationOptions = useMemo(() => {
        const seen = new Set<string>();
        for (const q of queries) if (q.destination) seen.add(q.destination);
        return Array.from(seen).sort().map((d) => ({ label: d, value: d }));
    }, [queries]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
    const isFiltering = search !== "" || filterStatus !== "all" || filterAssignedTo !== "all" || focusMode
        || filterDestination !== "all" || minCost !== null || minGroupSize !== null;

    // Open = not Converted, not Closed — what Focus Mode narrows down to.
    // Computed off the full `queries` set (not `filtered`) so the count on
    // the toggle stays stable while other filters/search are in play.
    const openCount = queries.filter(q =>
        !isClosedStatus(q.status as SalesQueryStatus) && !isConvertedStatus(q.status as SalesQueryStatus),
    ).length;

    // ── Stats ─────────────────────────────────────────────────────────────────
    const totalCount = queries.length;
    // New today = assigned to this user today (or created today if no assignedAt)
    const newToday = queries.filter(q => {
        const dateToCheck = q.assignedAt ?? q.createdAt;
        return isToday(new Date(dateToCheck));
    }).length;

    const inProgress = queries.filter(q => isActiveStatus(q.status as SalesQueryStatus)).length;

    const followUpCount = queries.filter(q => q.status === "FOLLOW_UP").length;

    const submitted = queries.filter(q => q.status === "SUBMITTED").length;

    const closedCount = queries.filter(q => isClosedStatus(q.status as SalesQueryStatus)).length;

    const bookedCount = queries.filter((q) => q.status === "PAYMENT_INITIATED" || q.status === "CONVERTED").length;

    // Conversation % = closed queries that converted (booked) / total closed
    const convRate = totalCount > 0 ? Math.round((bookedCount / totalCount) * 100) : 0;

    // ── Columns ───────────────────────────────────────────────────────────────
    const columns: ColumnDef<SalesQueryRow>[] = [
        {
            header: "Lead",
            width: "w-[200px]",
            sortKey: (q) => q.name?.toLowerCase() ?? "",
            cell: (q) => (
                <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                        <p className="font-medium text-sm leading-tight">{q.name}</p>
                        {/* Green dot = requirements filled. Asked properly: a
                            bridge lead's `{ leadMeta }` is a non-null column
                            with nothing in it an exec ever filled, and the dot
                            told them the work was already done. */}
                        {hasRequirements(q.requirements) && (
                            <span
                                title="Requirements filled"
                                className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0"
                            />
                        )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <span>{q.phone}</span>
                    </div>
                    {q.email && (
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            <span className="truncate max-w-[160px]">{q.email}</span>
                        </div>
                    )}
                    {/* Call history, one dot per call — oldest to newest,
                        colored by that call's own status. Reading the row
                        says more at a glance than a bare count would (e.g.
                        "connected then two no-picks" vs. just "3 calls"),
                        and matches the color language CallLogDialog uses. */}
                    {q.callLogStatuses.length > 0 && (
                        <div
                            title={`${q.callLogStatuses.length} call${q.callLogStatuses.length !== 1 ? "s" : ""} logged`}
                            className="flex items-center gap-1"
                        >
                            {q.callLogStatuses.map((status, i) => (
                                <span
                                    key={i}
                                    className={cn("h-1.5 w-1.5 rounded-full shrink-0", CALL_STATUS_DOT[status])}
                                />
                            ))}
                        </div>
                    )}
                </div>
            ),
        },
        ...(isTeamLead ? [{
            header: "Assigned To",
            width: "w-[230px]",
            sortKey: (q) => q.assignedToName?.toLowerCase() ?? "",
            cell: (q) => (
                <div onClick={(e) => e.stopPropagation()}>
                    <AssignQueryDropdown
                        queryId={q.id}
                        assignedTo={q.assignedTo}
                        assignedToName={q.assignedToName}
                        fetchMembers={getMyTeamMembers}
                        assignFn={reassignToTeamMember}
                    />
                </div>
            ),
        } as ColumnDef<SalesQueryRow>] : []),
        {
            header: "Package / Destination",
            cell: (q) => (
                <div className="space-y-0.5">
                    {q.destination && (
                        <div className="flex items-center gap-1 text-sm font-medium">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {q.destination}
                        </div>
                    )}
                    {q.packageName && (
                        q.packageUrl ? (
                            <a
                                href={q.packageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs text-primary hover:underline truncate max-w-40 block"
                            >
                                {q.packageName}
                            </a>
                        ) : (
                            <p className="text-xs text-muted-foreground truncate max-w-40">{q.packageName}</p>
                        )
                    )}
                    {!q.destination && !q.packageName && (
                        <span className="text-xs text-muted-foreground italic">—</span>
                    )}
                </div>
            ),
        },
        {
            header: "Package",
            align: "center" as const,
            width: "w-[140px]",
            cell: (q) => {
                // A query can have several packages now — the "+" lets an exec
                // start another, e.g. a second budget option for the same
                // client. This picks which one the row represents.
                //
                // Newest-first alone hid the package that matters most: build a
                // second draft and the one sitting with costing disappeared
                // behind it, with nothing on the row to say anything of yours
                // was in review. Anything still with costing wins, then a
                // rejection waiting to be fixed, then the newest.
                const inReview = q.customPackages.find((p) => p.status === "READY" && !p.verified && !p.rejectedAt) ?? null;
                const needsRework = q.customPackages.find((p) => p.rejectedAt && p.status === "DRAFT") ?? null;
                const latest = inReview ?? needsRework ?? q.customPackages[0] ?? null;

                const statusBadges = (
                    <>
                        {q.customPackages.length > 1 && (
                            <Badge
                                variant="outline"
                                className="gap-1 text-[11px] font-medium py-0.5 rounded-md bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800"
                            >
                                <UserCheck className="h-3 w-3" />
                                {q.customPackages.filter((p) => p.verified).length}/{q.customPackages.length} Approved
                            </Badge>
                        )}
                        {(latest?.readyAt || latest?.hotelRequestStatus || latest?.libraryStatus) && (
                            <div className="flex flex-col items-center gap-1">
                                {latest.readyAt && (
                                    <>
                                        <PackageVerificationBadge pkg={latest} />
                                        <PackageSentBadge pkg={latest} />
                                    </>
                                )}
                                <HotelRequestBadge pkg={latest} />
                                <LibraryStatusBadge pkg={latest} />
                            </div>
                        )}
                    </>
                );

                // A Team Leader oversees rather than builds — no Create/+
                // package actions — but they can still open one: through the
                // costing review workspace (not the plain builder an exec
                // uses), which is what grants a leader reject-and-correct
                // rights on their team's package once it's with costing (see
                // workspace-caps.ts's "teamLead" role).
                if (isTeamLead) {
                    return (
                        <div onClick={(e) => e.stopPropagation()} className="flex flex-col items-center justify-center gap-1">
                            {!latest ? (
                                <span className="text-xs text-muted-foreground italic">No package</span>
                            ) : (
                                <div className="flex items-center justify-center gap-1.5">
                                    <a
                                        href={`/dashboard/package-builder/${latest.id}/review`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={cn(
                                            "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border transition-colors",
                                            latest.status === "SENT"
                                                ? "text-green-700 border-green-300 bg-green-50 hover:bg-green-100 dark:text-green-400 dark:border-green-900 dark:bg-green-950/30"
                                                : "text-amber-700 border-amber-300 bg-amber-50 hover:bg-amber-100 dark:text-amber-400 dark:border-amber-900 dark:bg-amber-950/20"
                                        )}
                                    >
                                        <Eye className="h-3 w-3" />
                                        View Package{q.customPackages.length > 1 ? ` (${q.customPackages.length})` : ""}
                                    </a>
                                    {inReview && (
                                        <span
                                            title="With costing for pricing review"
                                            className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400"
                                        >
                                            In review
                                        </span>
                                    )}
                                    {!inReview && needsRework && (
                                        <span
                                            title="Costing sent this back — needs fixing and resubmitting"
                                            className="inline-flex items-center rounded-full border border-red-300 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"
                                        >
                                            Rework
                                        </span>
                                    )}
                                </div>
                            )}
                            {statusBadges}
                        </div>
                    );
                }

                const dialogProps = {
                    queryId: q.id,
                    destination: q.destination,
                    packageUrl: q.packageUrl,
                    travelDate: q.travelDate ? q.travelDate.toISOString().slice(0, 10) : q.requirements?.journey?.travelDate ?? null,
                    travellers: q.requirements?.travellers ? {
                        adults: q.requirements.travellers.adults,
                        children: q.requirements.travellers.children,
                        infants: q.requirements.travellers.infants,
                    } : null,
                    budget: q.requirements?.budget && (q.requirements.budget.min != null || q.requirements.budget.max != null) ? {
                        min:  q.requirements.budget.min,
                        max:  q.requirements.budget.max,
                        type: q.requirements.budget.type,
                    } : null,
                    duration: q.requirements?.journey?.noOfDays ? {
                        days:   q.requirements.journey.noOfDays,
                        nights: q.requirements.journey.noOfNights,
                    } : null,
                    queryReceivedAt: q.createdAt,
                };
                return (
                    <div onClick={(e) => e.stopPropagation()} className="flex flex-col items-center justify-center gap-1">
                        <div className="flex items-center justify-center gap-1.5">
                            {!latest ? (
                                <CreatePackageDialog {...dialogProps}>
                                    <button
                                        type="button"
                                        className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border transition-colors cursor-pointer text-primary border-primary/30 bg-primary/5 hover:bg-primary/10"
                                    >
                                        <Package className="h-3 w-3" /> Create Package
                                    </button>
                                </CreatePackageDialog>
                            ) : (
                                <>
                                    <a
                                        href={`/dashboard/package-builder/${latest.id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={cn(
                                            "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border transition-colors",
                                            latest.status === "SENT"
                                                ? "text-green-700 border-green-300 bg-green-50 hover:bg-green-100 dark:text-green-400 dark:border-green-900 dark:bg-green-950/30"
                                                : "text-amber-700 border-amber-300 bg-amber-50 hover:bg-amber-100 dark:text-amber-400 dark:border-amber-900 dark:bg-amber-950/20"
                                        )}
                                    >
                                        <Eye className="h-3 w-3" />
                                        View Package{q.customPackages.length > 1 ? ` (${q.customPackages.length})` : ""}
                                    </a>
                                    {/* Says which of the several this row is
                                        showing, so "in review" isn't something
                                        you have to open the package to find. */}
                                    {inReview && (
                                        <span
                                            title="With costing for pricing review"
                                            className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400"
                                        >
                                            In review
                                        </span>
                                    )}
                                    {!inReview && needsRework && (
                                        <span
                                            title="Costing sent this back — needs fixing and resubmitting"
                                            className="inline-flex items-center rounded-full border border-red-300 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"
                                        >
                                            Rework
                                        </span>
                                    )}
                                    <CreatePackageDialog {...dialogProps} existingPackages={q.customPackages}>
                                        <button
                                            type="button"
                                            title="Create another package for this query"
                                            className="inline-flex items-center justify-center h-6.5 w-6.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
                                        >
                                            <Plus className="h-3 w-3" />
                                        </button>
                                    </CreatePackageDialog>
                                </>
                            )}
                        </div>
                        {statusBadges}
                    </div>
                );
            },
        },
        {
            header: "Status",
            sortKey: (q) => q.status?.toLowerCase() ?? "",
            cell: (q) => (
                <div className="space-y-1">
                    <SalesQueryStatusBadge status={q.status as SalesQueryStatus} />
                    {q.status === "CLOSED" && q.closeReasonId && (
                        <p className="text-[10px] text-muted-foreground max-w-[110px] truncate">
                            {closeReasons.find(r => r.id === q.closeReasonId)?.label ?? q.closeReasonId}
                        </p>
                    )}
                </div>
            ),
        },
        {
            header: "Group / Date",
            cell: (q) => (
                <div className="space-y-0.5 text-xs text-muted-foreground">
                    {q.groupSize != null && (
                        <div className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            <span>{q.groupSize} pax</span>
                        </div>
                    )}
                    {q.travelDate && (
                        <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>{format(new Date(q.travelDate), "dd MMM yy")}</span>
                        </div>
                    )}
                    {q.groupSize == null && !q.travelDate && <span className="italic">—</span>}
                </div>
            ),
        },
        ...(!isTeamLead ? [{
            header: "Follow-Ups",
            align: "center" as const,
            sortKey: (q) => q._count.queryFollowUps ?? 0,
            cell: (q) => (
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                    <StickyNote className="h-3 w-3" />
                    {q._count.queryFollowUps}
                </div>
            ),
        } as ColumnDef<SalesQueryRow>, {
            header: "Follow up",
            sortKey: (q) => q.nextFollowUpAt ? new Date(q.nextFollowUpAt).getTime() : 0,
            cell: (q) => (
                <div className="text-xs">
                    {q.nextFollowUpAt ? (
                        <span className={`font-medium ${new Date(q.nextFollowUpAt) < new Date()
                            ? "text-destructive"
                            : "text-amber-600"
                            }`}>
                            {format(new Date(q.nextFollowUpAt), "dd MMM, hh:mm a")}
                        </span>
                    ) : (
                        <span className="text-muted-foreground italic">—</span>
                    )}
                </div>
            ),
        } as ColumnDef<SalesQueryRow>] : []),
        {
            header: "Assigned",
            width: "w-[84px]",
            sortKey: (q) => q.assignedAt ? new Date(q.assignedAt).getTime() : 0,
            cell: (q) => (
                <div
                    className="space-y-0.5 text-xs leading-tight"
                    // Relative time ("2 hours ago") moved to a hover title instead of
                    // a third visible line — keeps the column from growing taller/wider.
                    title={q.assignedAt ? formatDistanceToNow(new Date(q.assignedAt), { addSuffix: true }) : undefined}
                >
                    {q.assignedAt ? (
                        <>
                            <p className="font-medium text-foreground text-[11px] whitespace-nowrap">
                                {format(new Date(q.assignedAt), "hh:mm a")}
                            </p>
                            <p className="text-muted-foreground whitespace-nowrap">
                                {format(new Date(q.assignedAt), "dd MMM yy")}
                            </p>
                        </>
                    ) : (
                        <span className="text-muted-foreground italic">—</span>
                    )}
                </div>
            ),
        },
        {
            header: "Actions",
            align: "right" as const,
            width: "w-[160px]",
            cell: (q) => (
                <ActionCell
                    query={q}
                    onView={() => openDetail(q)}
                    isTeamLead={isTeamLead}
                />
            ),
        },
    ];

    return (
        <>
            <div className="space-y-4">
                {/* ── Range controls + report download ─────────────────────────────── */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-2 justify-between">
                    <div className="flex items-center gap-1.5">
                        {[
                            { label: "This Month", active: isThisMonth, onClick: () => setRange(firstOfMonthStr(), todayStr()) },
                            { label: "All Time", active: isAllTime, onClick: setAllTime },
                        ].map((b) => (
                            <button
                                key={b.label}
                                type="button"
                                onClick={b.onClick}
                                className={cn(
                                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                                    b.active
                                        ? "bg-dashboard-primary text-dashboard-primary-content"
                                        : "bg-dashboard-base-200 text-dashboard-base-content/70 hover:bg-dashboard-base-300",
                                )}
                            >
                                {b.label}
                            </button>
                        ))}
                        {isPending && <span className="text-xs text-muted-foreground animate-pulse px-1">Updating…</span>}

                        <div className="w-px h-5 bg-dashboard-base-300 mx-0.5" />

                        <button
                            type="button"
                            onClick={toggleFocusMode}
                            title="Show only queries that aren't Converted or Closed"
                            className={cn(
                                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer border",
                                focusMode
                                    ? "bg-amber-500/15 text-amber-700 border-amber-300 dark:text-amber-400 dark:border-amber-800"
                                    : "bg-dashboard-base-200 text-dashboard-base-content/70 border-transparent hover:bg-dashboard-base-300",
                            )}
                        >
                            <Focus className="h-3.5 w-3.5" />
                            Focus Mode
                            <span className={cn(
                                "min-w-4.5 h-4.5 px-1 flex items-center justify-center text-[10px] font-semibold rounded-full tabular-nums",
                                focusMode ? "bg-amber-500 text-white" : "bg-dashboard-base-300 text-dashboard-base-content/60",
                            )}>
                                {openCount}
                            </span>
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <DateRangePicker
                            from={isAllTime ? "" : from}
                            to={isAllTime ? "" : to}
                            onFromChange={(v) => setRange(v || firstOfMonthStr(), isAllTime ? todayStr() : to)}
                            onToChange={(v) => setRange(isAllTime ? firstOfMonthStr() : from, v || todayStr())}
                        />
                    </div>
                </div>

                {/* Stats — matches requested: total, new today, in progress, closed, booked, conv% */}
                <StatGrid cols={7}>
                    <StatCard
                        label="Total Queries"
                        value={totalCount}
                        sub={rangeLabel}
                        icon={Inbox}
                        iconText="text-dashboard-primary"
                    />
                    <StatCard
                        label="New Today"
                        value={newToday}
                        icon={Send}
                        iconText="text-dashboard-info"
                        muted={submitted === 0}
                    />
                    <StatCard
                        label="In Progress"
                        value={inProgress}
                        icon={Clock}
                        iconText="text-dashboard-warning"
                    />
                    <StatCard
                        label="Follow Up"
                        value={followUpCount}
                        icon={CalendarClock}
                        iconText="text-amber-600"
                        muted={followUpCount === 0}
                    />
                    <StatCard
                        label="Closed"
                        value={closedCount}
                        icon={CircleX}
                        iconText="text-dashboard-success"
                    />
                    <StatCard
                        label="Converted"
                        value={bookedCount}
                        icon={UserCheck}
                        iconText="text-dashboard-secondary"
                    />
                    <StatCard
                        label="Conv. Rate"
                        value={`${convRate}%`}
                        icon={TrendingUp}
                        iconText="text-dashboard-accent"
                        trend={convRate > 0 ? { value: `${convRate}%`, positive: true } : undefined}
                    />
                </StatGrid>

                {/* Filters */}
                <TableFilters
                    collapsible
                    search={search}
                    onSearchChange={(v) => { setSearch(v); setPage(1); }}
                    searchPlaceholder="Search by name, phone, email, destination..."
                    filteredCount={isFiltering ? filtered.length : undefined}
                    totalCount={isFiltering ? queries.length : undefined}
                    filters={[
                        {
                            value: filterStatus,
                            onChange: (v) => {
                                setFilterStatus(v as "all" | SalesQueryStatus);
                                setPage(1);
                            },
                            placeholder: "All Statuses",
                            width: "w-52",
                            options: [
                                { label: "All Queries", value: "all" },
                                { label: "In Progress", value: "IN_PROGRESS" },
                                { label: "Follow Up", value: "FOLLOW_UP" },
                                { label: "Package Sent", value: "PACKAGE_SENT" },
                                { label: "Client Accepted", value: "CLIENT_ACCEPTED" },
                                { label: "Client Declined", value: "CLIENT_DECLINED" },
                                { label: "Payment Initiated", value: "PAYMENT_INITIATED" },
                                { label: "Converted", value: "CONVERTED" },
                                { label: "Closed", value: "CLOSED" },
                                { label: "Rejected", value: "REJECTED" },
                            ],
                        },
                        // Only a Team Leader has more than one assignee across
                        // `queries` in the first place — a solo exec's queries
                        // are all their own, so this filter would be a no-op.
                        ...(isTeamLead && teamMembers.length > 0 ? [{
                            value: filterAssignedTo,
                            onChange: (v: string) => {
                                setFilterAssignedTo(v);
                                setPage(1);
                            },
                            placeholder: "All Team Members",
                            width: "w-52",
                            options: [
                                { label: "Unassigned", value: "unassigned" },
                                ...teamMembers.map((m) => ({ label: m.name, value: m.id })),
                            ],
                        }] : []),
                        {
                            value: filterDestination,
                            onChange: (v) => { setFilterDestination(v); setPage(1); },
                            placeholder: "All Destinations",
                            width: "w-44",
                            options: destinationOptions,
                        },
                    ]}
                >
                    <MinNumberFilter
                        label="Cost ≥"
                        prefix="₹"
                        value={minCost}
                        onChange={(v) => { setMinCost(v); setPage(1); }}
                        placeholder="Any"
                    />
                    <MinNumberFilter
                        label="Persons ≥"
                        value={minGroupSize}
                        onChange={(v) => { setMinGroupSize(v); setPage(1); }}
                        placeholder="Any"
                        width="w-36"
                    />
                </TableFilters>

                {search && (
                    <div className="flex items-center gap-2 px-1">
                        <p className="text-xs text-muted-foreground">
                            Showing results for{" "}
                            <span className="font-medium text-foreground">{search}</span>
                        </p>
                        <button
                            type="button"
                            onClick={() => { setSearch(""); setPage(1); }}
                            className="text-xs text-primary hover:underline"
                        >
                            Clear
                        </button>
                    </div>
                )}

                {/* Table */}
                <DataTable
                    data={paginated}
                    columns={columns}
                    rowKey={(q) => q.id}
                    onRowClick={(q) => openDetail(q)}
                    rowClassName={(q) => {
                        if (isClosedStatus(q.status as SalesQueryStatus)) return "opacity-60 hover:opacity-80";
                        if (q.customPackages.some((p) => p.status === "SENT")) return "bg-green-50/60 dark:bg-green-950/20 hover:bg-green-100/70 dark:hover:bg-green-900/30";
                        if (q.status === "SUBMITTED") return "bg-amber-50/40 dark:bg-amber-950/10";
                        return "";
                    }}
                    emptyState={
                        <TableEmptyState
                            description={
                                focusMode
                                    ? "Nothing open — everything's Converted or Closed 🎉"
                                    : filterStatus === "CLOSED" || filterStatus === "CONVERTED" || filterStatus === "REJECTED"
                                        ? "No closed queries yet"
                                        : filterStatus === "IN_PROGRESS"
                                            ? "No active queries — you're all caught up!"
                                            : filterStatus === "SUBMITTED"
                                                ? "No new queries awaiting action"
                                                : "No queries found — go scroll some reels 😄"
                            }
                        />
                    }
                    pagination={{ currentPage: safePage, totalPages, onPageChange: setPage }}
                />
            </div>

            {/* Detail Sheet */}
            <SalesQueryDetailSheet
                query={loadingDetail ? null : detailQuery}
                closeReasons={closeReasons}
                rejectionReasons={rejectionReasons}
                open={sheetOpen}
                onOpenChange={setSheetOpen}
                onRefresh={() => openDetail(detailQuery as PackageQueryType)}
                isTeamLead={isTeamLead}
            />
        </>
    );
}