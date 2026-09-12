"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { formatDistanceToNow, formatDistanceStrict, format, parseISO } from "date-fns";
import { toast } from "sonner";
import {
    CheckCircle2,
    Phone, MapPin, StickyNote,
    Inbox, UserCheck, Send, Clock, TrendingUp,
    Ticket, Users, CalendarDays, MessageSquare,
    Download, FileText, FileSpreadsheet, Loader2, Moon,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "../../components/ui/tooltip";
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "../../components/ui/dropdown-menu";
import { DataTable, type ColumnDef } from "../../components/dashboard/Datatable";
import { TableFilters } from "../../components/dashboard/Tablefilters";
import { StatCard, StatGrid } from "../../components/dashboard/Statcard";
import { QueryStatusBadge, QuerySourceBadge, TicketIconBadge } from "../../components/dashboard/CustomBadges";
import { QueryDetailSheet } from "./Querydetailsheet";
import { QueryTimelineSheet } from "./QueryTimelineSheet";
import { getQueryById } from "./actions";
import type { PackageQuery, RejectionReason, CallLogStatus } from "./actions";
import { cn } from "@/app/lib/utils";
import { Pencil } from "lucide-react";
import { EditQueryDialog } from "./Editquerydialog";
import { AssignQueryDropdown } from "./Assignquerydropdown";
import { DeleteQueryDialog } from "./Deletequerydialog";
import { TableEmptyState } from "../../components/dashboard/TableEmptyState";
import { TodaysAssignmentDialog } from "./TodaysAssignmentDialog";
import { MinNumberFilter } from "../../components/dashboard/MinNumberFilter";
import { DateRangeFilter, describeRange, type DateRangeValue } from "../../components/ui/date-range-filter";

// ── Types ─────────────────────────────────────────────────────────────────────

type QueryWithDetails = PackageQuery & {
    notes: Array<{ id: string; authorId: string; content: string; createdAt: Date }>;
    timeline: Array<{ id: string; actorName: string | null; event: string; createdAt: Date }>;
};

type Props = { queries: PackageQuery[]; reasons: RejectionReason[] };

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// One dot per logged call, oldest first — same color language as sales-query's
// CallLogDialog (green=connected, yellow=not picked, red=declined).
const CALL_STATUS_DOT: Record<CallLogStatus, string> = {
    CONNECTED:  "bg-green-500",
    NOT_PICKED: "bg-yellow-500",
    DECLINED:   "bg-red-500",
};

const STATUS_FILTER_OPTIONS = [
    { label: "Submitted", value: "SUBMITTED" },
    { label: "Verified", value: "VERIFIED" },
    { label: "Rejected", value: "REJECTED" },
    { label: "Assigned", value: "ASSIGNED" },
    { label: "In Progress", value: "IN_PROGRESS" },
    { label: "Follow Up", value: "FOLLOW_UP" },
    { label: "Package Sent", value: "PACKAGE_SENT" },
    { label: "Client Accepted", value: "CLIENT_ACCEPTED" },
    { label: "Client Declined", value: "CLIENT_DECLINED" },
    { label: "Payment Initiated", value: "PAYMENT_INITIATED" },
    { label: "Converted", value: "CONVERTED" },
    { label: "Closed", value: "CLOSED" },
];

const SOURCE_FILTER_OPTIONS = [
    { label: "Website Form", value: "WEBSITE_FORM" },
    { label: "Landing Page", value: "LANDING_PAGE" },
    { label: "WhatsApp Meta", value: "WHATSAPP" },
    { label: "WhatsApp Google", value: "WHATSAPP_GOOGLE" },
    { label: "Phone Call", value: "PHONE_CALL" },
    { label: "Referral", value: "REFERRAL" },
    { label: "Other", value: "OTHER" },
];

// ── Action Cell ───────────────────────────────────────────────────────────────

function ActionCell({
    query, onView, onDeleted,
}: { query: PackageQuery; onView: () => void; onDeleted: (id: string) => void }) {
    const [isPendingP, startProgress] = useTransition();

    const isTerminal = query.status === "SUBMITTED";

    return (
        <TooltipProvider delayDuration={300}>
            <div className="flex items-center justify-end gap-1">

                {/* Timeline */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span onClick={(e) => e.stopPropagation()}>
                            <QueryTimelineSheet queryId={query.id} leadName={query.name} />
                        </span>
                    </TooltipTrigger>
                    <TooltipContent>View Timeline</TooltipContent>
                </Tooltip>

                {/* Edit */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span onClick={(e) => e.stopPropagation()}>
                            <EditQueryDialog query={query} onDone={() => { }}>
                                <Button
                                    variant="ghost" size="icon"
                                    className="h-8 w-8 text-dashboard-base-content/75 hover:text-dashboard-base-content hover:bg-dashboard-base-content/10"
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                </Button>
                            </EditQueryDialog>
                        </span>
                    </TooltipTrigger>
                    <TooltipContent>Edit Query</TooltipContent>
                </Tooltip>

                {/* Assign */}
                {!query.assignedTo && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span onClick={(e) => e.stopPropagation()}>
                                <AssignQueryDropdown
                                    queryId={query.id}
                                    assignedTo={query.assignedTo}
                                    compact
                                />
                            </span>
                        </TooltipTrigger>
                        <TooltipContent>
                            {query.assignedTo ? "Reassign" : "Assign to Sales"}
                        </TooltipContent>
                    </Tooltip>
                )}

                {/* Delete */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span onClick={(e) => e.stopPropagation()}>
                            <DeleteQueryDialog
                                queryId={query.id}
                                leadName={query.name}
                                onDone={() => onDeleted(query.id)}
                            />
                        </span>
                    </TooltipTrigger>
                    <TooltipContent>Delete Query</TooltipContent>
                </Tooltip>

            </div>
        </TooltipProvider>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function QueriesTable({ queries: initialQueries, reasons }: Props) {
    // Local copy of the server-provided list — `revalidatePath` in the delete
    // action refreshes the *route*, not this already-mounted client
    // component's props, so a deleted row is removed here directly rather
    // than staying (broken — reopening it 404s) until the next full reload.
    const [queries, setQueries] = useState(initialQueries);
    // useState only reads its argument on the very first render — the
    // Refresh button's router.refresh() re-runs the server component and
    // sends a fresh `initialQueries` prop, but without this effect that
    // prop update never reaches local state, so the table just sat on
    // whatever it first mounted with no matter how many times you refreshed.
    useEffect(() => {
        setQueries(initialQueries);
    }, [initialQueries]);
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const [filterSource, setFilterSource] = useState("all");
    const [filterVerified, setFilterVerified] = useState("all");
    const [filterMember, setFilterMember] = useState("all");
    const [filterDestination, setFilterDestination] = useState("all");
    const [minCost, setMinCost] = useState<number | null>(null);
    const [minGroupSize, setMinGroupSize] = useState<number | null>(null);
    const [minDays, setMinDays] = useState<number | null>(null);
    // null means "no date filter applied" — the button itself still needs
    // some range to display, so it falls back to `allTimeRange` below rather
    // than this being threaded through as an optional prop.
    const [dateRange, setDateRange] = useState<DateRangeValue | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
    const [downloadingReport, setDownloadingReport] = useState<"pdf" | "xlsx" | null>(null);

    const todayIso = format(new Date(), "yyyy-MM-dd");
    // Earliest "Received" date on file — lets the picker's "All time" preset
    // (and its calendar's start bound) mean the actual first query, not an
    // arbitrary two-year fallback.
    const earliestIso = useMemo(() => {
        if (queries.length === 0) return undefined;
        const earliest = queries.reduce(
            (min, q) => (q.createdAt < min ? q.createdAt : min),
            queries[0].createdAt,
        );
        return format(new Date(earliest), "yyyy-MM-dd");
    }, [queries]);
    const allTimeRange: DateRangeValue = { from: earliestIso ?? todayIso, to: todayIso };

    const [sheetOpen, setSheetOpen] = useState(false);
    const [detailQuery, setDetailQuery] = useState<QueryWithDetails | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    function handleDeleted(id: string) {
        setQueries((prev) => prev.filter((q) => q.id !== id));
        if (detailQuery?.id === id) setSheetOpen(false);
    }

    async function openDetail(query: PackageQuery) {
        setSheetOpen(true);
        setLoadingDetail(true);
        try {
            const full = await getQueryById(query.id);
            setDetailQuery(full as unknown as QueryWithDetails);
        } finally {
            setLoadingDetail(false);
        }
    }

    // ── Filtering ─────────────────────────────────────────────────────────────
    const filtered = queries.filter((q) => {
        const s = search.toLowerCase();
        const matchSearch =
            !search
            || q.name.toLowerCase().includes(s)
            || q.phone.includes(s)
            || (q.email ?? "").toLowerCase().includes(s)
            || (q.destination ?? "").toLowerCase().includes(s)
            || (q.packageName ?? "").toLowerCase().includes(s)
            || ((q as any).assignedToName ?? "").toLowerCase().includes(s);

        const matchStatus = filterStatus === "all" || q.status === filterStatus;
        const matchSource = filterSource === "all" || q.source === filterSource;
        const matchVerified = filterVerified === "all"
            || (filterVerified === "verified" && q.verified)
            || (filterVerified === "unverified" && !q.verified);
        const matchMember = filterMember === "all"
            || (filterMember === "unassigned" && !q.assignedTo)
            || q.assignedTo === filterMember;
        const matchDestination = filterDestination === "all" || q.destination === filterDestination;
        // No package/price on file yet never satisfies a "cost at least X"
        // ask — an unpriced query isn't "cheap", it just hasn't been quoted.
        const matchCost = minCost === null || (q.packagePrice !== null && q.packagePrice >= minCost);
        const matchGroupSize = minGroupSize === null || (q.groupSize !== null && q.groupSize >= minGroupSize);
        // Strictly greater than, per how this filter reads ("Days > X") — a
        // query with exactly X days isn't "more than X days".
        const matchDays = minDays === null
            || ((q.requirements?.journey?.noOfDays ?? 0) > minDays);
        // Compared as "YYYY-MM-DD" strings, inclusive of both ends, matching
        // DateRangeFilter's own convention — never raw Date instants, which
        // is how a query received late at night ends up on "the wrong day"
        // once a timezone is involved.
        const matchDate = dateRange === null || (() => {
            const received = format(new Date(q.createdAt), "yyyy-MM-dd");
            return received >= dateRange.from && received <= dateRange.to;
        })();

        return matchSearch && matchStatus && matchSource && matchVerified && matchMember
            && matchDestination && matchCost && matchGroupSize && matchDays && matchDate;
    });

    const destinationOptions = useMemo(() => {
        const seen = new Set<string>();
        for (const q of queries) if (q.destination) seen.add(q.destination);
        return Array.from(seen).sort().map((d) => ({ label: d, value: d }));
    }, [queries]);

    // Team members actually present in this query set, keyed by id so
    // duplicate names (rare, but possible) don't collapse into one filter row.
    const memberOptions = useMemo(() => {
        const seen = new Map<string, string>();
        for (const q of queries) {
            if (q.assignedTo) seen.set(q.assignedTo, q.assignedToName ?? "Unknown");
        }
        return [
            { label: "Unassigned", value: "unassigned" },
            ...Array.from(seen.entries())
                .sort((a, b) => a[1].localeCompare(b[1]))
                .map(([value, label]) => ({ label, value })),
        ];
    }, [queries]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

    function handlePageSizeChange(size: number) {
        setPageSize(size);
        setPage(1);
    }
    const isFiltering = search !== "" || filterStatus !== "all" || filterSource !== "all"
        || filterVerified !== "all" || filterMember !== "all" || filterDestination !== "all"
        || minCost !== null || minGroupSize !== null || minDays !== null || dateRange !== null;

    // Human-readable recap of whatever's currently narrowing the list, so an
    // exported report is self-explanatory once it's off-screen — "42 queries"
    // means something different depending on whether that's everything or a
    // filtered slice, and the PDF has no other way to say which.
    const filterSummary = [
        search && `Search: "${search}"`,
        filterStatus !== "all" && `Status: ${STATUS_FILTER_OPTIONS.find((o) => o.value === filterStatus)?.label ?? filterStatus}`,
        filterSource !== "all" && `Source: ${SOURCE_FILTER_OPTIONS.find((o) => o.value === filterSource)?.label ?? filterSource}`,
        filterVerified !== "all" && (filterVerified === "verified" ? "Verified only" : "Unverified only"),
        filterMember !== "all" && `Assigned: ${memberOptions.find((o) => o.value === filterMember)?.label ?? filterMember}`,
        filterDestination !== "all" && `Destination: ${filterDestination}`,
        minCost !== null && `Cost ≥ ₹${minCost.toLocaleString("en-IN")}`,
        minGroupSize !== null && `Persons ≥ ${minGroupSize}`,
        minDays !== null && `Days > ${minDays}`,
        dateRange !== null && `Received: ${describeRange(dateRange, parseISO(todayIso), earliestIso)}`,
    ].filter(Boolean).join(" · ");

    // Reports the currently FILTERED list, not just the current page — an
    // exec narrowing to "Days > 7" wants every matching query in the report,
    // not only the 10 shown on screen. Builder modules are dynamically
    // imported so jsPDF/xlsx never load into this page's initial bundle for
    // the (common) case nobody ever exports anything.
    async function handleDownloadPdf() {
        setDownloadingReport("pdf");
        try {
            const { buildQueriesReportPdf } = await import("./queriesReportPdf");
            const pdf = buildQueriesReportPdf(filtered, { filterSummary: filterSummary || undefined });
            pdf.save(`queries-report-${format(new Date(), "yyyy-MM-dd_HHmm")}.pdf`);
            toast.success("Report downloaded");
        } catch {
            toast.error("Couldn't generate the PDF. Try again.");
        } finally {
            setDownloadingReport(null);
        }
    }

    async function handleDownloadExcel() {
        setDownloadingReport("xlsx");
        try {
            const [{ buildQueriesReportXlsx }, XLSX] = await Promise.all([
                import("./queriesReportXlsx"),
                import("xlsx"),
            ]);
            const wb = buildQueriesReportXlsx(filtered);
            XLSX.writeFile(wb, `queries-report-${format(new Date(), "yyyy-MM-dd_HHmm")}.xlsx`);
            toast.success("Report downloaded");
        } catch {
            toast.error("Couldn't generate the Excel file. Try again.");
        } finally {
            setDownloadingReport(null);
        }
    }

    // ── Stats ─────────────────────────────────────────────────────────────────
    const submitted = queries.filter((q) => q.status === "SUBMITTED").length;
    const inProgress = queries.filter((q) => q.status === "IN_PROGRESS").length;
    const booked = queries.filter((q) => q.status === "PAYMENT_INITIATED" || q.status === "CONVERTED").length;
    const verified = queries.filter((q) => q.verified).length;
    const assigned = queries.filter((q) => !!q.assignedTo).length;
    const convRate = queries.length > 0 ? Math.round((booked / queries.length) * 100) : 0;
    

    // ── Columns ───────────────────────────────────────────────────────────────
    const columns: ColumnDef<PackageQuery>[] = [
        {
            header: "Lead",
            width: "w-[220px]",
            sortKey: (q) => q.name?.toLowerCase() ?? "",
            cell: (q) => (
                <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                        <p className="font-medium text-sm leading-tight text-dashboard-base-content">
                            {q.name}
                        </p>
                        {q.totalLeadQueries > 1 && (
                            <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 cursor-pointer border-dashboard-warning/40 text-dashboard-warning hover:bg-dashboard-warning/10"
                                onClick={(e) => { e.stopPropagation(); setSearch(q.phone); setPage(1); }}
                            >
                                {q.totalLeadQueries} queries
                            </Badge>
                        )}
                        {q.ticketBooked && (
                            <TicketIconBadge
                                ticketType={q.ticketType}
                                title={`${q.ticketType === "FLIGHT" ? "Flight" : "Train"} ticket booked${q.ticketFrom && q.ticketTo ? ` — ${q.ticketFrom} → ${q.ticketTo}` : ""}`}
                            />
                        )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-dashboard-base-content/80">
                        <Phone className="h-3 w-3 text-dashboard-success" />
                        <span>{q.phone}</span>
                    </div>
                    {q.email && (
                        <p className="text-[11px] text-dashboard-base-content/80 truncate max-w-[180px]">
                            {q.email}
                        </p>
                    )}
                    {q.callLogStatuses.length > 0 && (
                        <div
                            title={`${q.callLogStatuses.length} call${q.callLogStatuses.length > 1 ? "s" : ""} logged`}
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
                    {q.assignedTo && (
                        <div className="flex items-center gap-1 text-[10px] text-dashboard-primary mt-0.5">
                            <UserCheck className="h-2.5 w-2.5 shrink-0" />
                            <span className="font-medium truncate max-w-[130px]">
                                {(q as any).assignedToName ?? "Assigned"}
                            </span>
                        </div>
                    )}
                </div>
            ),
        },
        {
            header: "Package / Destination",
            cell: (q) => (
                <div className="space-y-0.5">
                    {q.destination && (
                        <div className="flex items-center gap-1 text-sm font-medium text-dashboard-base-content">
                            <MapPin className="h-3 w-3 text-dashboard-secondary" />
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
                                className="text-xs text-dashboard-primary hover:underline truncate max-w-40 block"
                            >
                                {q.packageName}
                            </a>
                        ) : (
                            <p className="text-xs text-dashboard-base-content/75 truncate max-w-40">
                                {q.packageName}
                            </p>
                        )
                    )}
                    {!q.destination && !q.packageName && (
                        <span className="text-xs text-dashboard-base-content/25 italic">—</span>
                    )}
                    {/* Folded in from the old standalone "Group / Date" column —
                        same info, shown as small icon chips instead of its own
                        column, to keep the table from scrolling horizontally. */}
                    {(q.requirements?.journey?.noOfDays || q.groupSize || q.travelDate || q.packagePrice) && (
                        <div className="flex items-center gap-2 text-[11px] text-dashboard-base-content/60 pt-0.5">
                            {!!q.requirements?.journey?.noOfDays && (
                                <span className="flex items-center gap-0.5" title="Trip duration">
                                    <Moon className="h-2.5 w-2.5" />
                                    {q.requirements.journey.noOfDays}D
                                    {q.requirements.journey.noOfNights != null && `/${q.requirements.journey.noOfNights}N`}
                                </span>
                            )}
                            {q.groupSize && (
                                <span className="flex items-center gap-0.5">
                                    <Users className="h-2.5 w-2.5" /> {q.groupSize}
                                </span>
                            )}
                            {q.travelDate && (
                                <span className="flex items-center gap-0.5">
                                    <CalendarDays className="h-2.5 w-2.5" /> {format(new Date(q.travelDate), "dd MMM yy")}
                                </span>
                            )}
                            {q.packagePrice && (
                                <span className="flex items-center gap-0.5">
                                    ₹{q.packagePrice.toLocaleString("en-IN")}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            ),
        },
        {
            header: "Status",
            sortKey: (q) => q.status?.toLowerCase() ?? "",
            cell: (q) => (
                <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                        <QueryStatusBadge status={q.status} />
                        {/* Folded in from the old standalone "Ticket booked or
                            not" column — a whole column for what's almost
                            always "—" was pure horizontal cost; a small icon
                            only shown when actually booked says the same
                            thing in a fraction of the width. */}
                        {(q.status === "CONVERTED" || q.status === "PAYMENT_INITIATED") && (
                            <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-dashboard-success/15">
                                            <Ticket className="h-2.5 w-2.5 text-dashboard-success" />
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent>Ticket booked</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                    </div>
                    {q.status === "REJECTED" && q.rejectionReason && (
                        <p className="text-[10px] text-dashboard-base-content/35 max-w-30 truncate">
                            {q.rejectionReason.label}
                        </p>
                    )}
                </div>
            ),
        },
        {
            header: "Source",
            sortKey: (q) => q.source?.toLowerCase() ?? "",
            cell: (q) => <QuerySourceBadge source={q.source} />,
        },
        {
            header: "Notes",
            align: "center",
            sortKey: (q) => q._count.notes ?? 0,
            cell: (q) => (
                <div className="flex items-center justify-center gap-2">
                    <div className="flex items-center gap-1 text-xs text-dashboard-base-content/75">
                        <StickyNote className="h-3 w-3" />
                        {q._count.notes}
                    </div>
                    {/* Client's own message/VOC — a separate field from the notes
                        above, so it gets its own icon rather than folding into
                        the count next to it. */}
                    {q.message && (
                        <span title={`"${q.message}"`}>
                            <MessageSquare className="h-3 w-3 text-violet-500" />
                        </span>
                    )}
                </div>
            ),
        },
        {
            header: "Received",
            sortKey: (q) => new Date(q.createdAt).getTime(),
            cell: (q) => (
                <TooltipProvider delayDuration={200}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="text-xs text-dashboard-base-content/75 whitespace-nowrap">
                                {formatDistanceToNow(new Date(q.createdAt), { addSuffix: true })}
                            </span>
                        </TooltipTrigger>
                        <TooltipContent>
                            {new Date(q.createdAt).toLocaleDateString("en-IN")}
                            {" "}
                            {new Date(q.createdAt).toLocaleTimeString("en-IN", {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: true,
                            })}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            ),
        },
        {
            header: "Time to Send",
            sortKey: (q) => (q.packageSentAt ? new Date(q.packageSentAt).getTime() : -1),
            cell: (q) => (
                q.packageSentAt
                    ? (
                        <TooltipProvider delayDuration={200}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="inline-flex items-center gap-1 text-xs text-dashboard-base-content/75 whitespace-nowrap">
                                        <Send className="h-3 w-3 text-dashboard-success" />
                                        {formatDistanceStrict(new Date(q.packageSentAt), new Date(q.createdAt))}
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                    Sent {new Date(q.packageSentAt).toLocaleDateString("en-IN")}
                                    {" "}
                                    {new Date(q.packageSentAt).toLocaleTimeString("en-IN", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        hour12: true,
                                    })}
                                    {" — "}
                                    {formatDistanceStrict(new Date(q.packageSentAt), new Date(q.createdAt))} after the query came in
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )
                    : <span className="text-xs text-dashboard-base-content/35">—</span>
            ),
        },
        {
            header: "Actions",
            align: "right",
            width: "w-[160px]",
            cell: (q) => (
                <ActionCell query={q} onView={() => openDetail(q)} onDeleted={handleDeleted} />
            ),
        },
    ];

    return (
        <>
            <div className="space-y-5">

                {/* ── Stats ── */}
                <div className="flex items-center justify-end gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={downloadingReport !== null}
                                className="gap-1.5"
                            >
                                {downloadingReport ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <Download className="h-3.5 w-3.5" />
                                )}
                                Export {isFiltering ? `${filtered.length}` : `${queries.length}`} {filtered.length === 1 ? "Query" : "Queries"}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={handleDownloadPdf} disabled={downloadingReport !== null}>
                                <FileText className="h-3.5 w-3.5 text-dashboard-error" />
                                Download as PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleDownloadExcel} disabled={downloadingReport !== null}>
                                <FileSpreadsheet className="h-3.5 w-3.5 text-dashboard-success" />
                                Download as Excel (.xlsx)
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <TodaysAssignmentDialog queries={queries} />
                </div>
                <StatGrid cols={6}>
                    <StatCard
                        label="Total Queries"
                        value={queries.length}
                        icon={Inbox}
                        iconColor="bg-dashboard-primary/10"
                        iconText="text-dashboard-primary"
                    />
                    <StatCard
                        label="Submitted"
                        value={submitted}
                        icon={Send}
                        iconColor="bg-dashboard-info/10"
                        iconText="text-dashboard-info"
                        muted={submitted === 0}
                    />
                    <StatCard
                        label="Assigned"
                        value={assigned}
                        icon={UserCheck}
                        iconColor="bg-dashboard-secondary/10"
                        iconText="text-dashboard-secondary"
                    />
                    <StatCard
                        label="In Progress"
                        value={inProgress}
                        icon={Clock}
                        iconColor="bg-dashboard-warning/10"
                        iconText="text-dashboard-warning"
                    />
                    <StatCard
                        label="Converted"
                        value={booked}
                        icon={CheckCircle2}
                        iconColor="bg-dashboard-success/10"
                        iconText="text-dashboard-success"
                        highlight={verified > 0}
                    />
                    <StatCard
                        label="Conv. Rate"
                        value={`${convRate}%`}
                        icon={TrendingUp}
                        iconColor="bg-dashboard-accent/10"
                        iconText="text-dashboard-accent"
                        trend={convRate > 0 ? { value: `${convRate}%`, positive: true } : undefined}
                    />
                </StatGrid>

                {/* ── Filters ── */}
                <TableFilters
                    collapsible
                    search={search}
                    onSearchChange={(v) => { setSearch(v); setPage(1); }}
                    searchPlaceholder="Search by name, phone, email, destination, assignee..."
                    filteredCount={isFiltering ? filtered.length : undefined}
                    totalCount={isFiltering ? queries.length : undefined}
                    filters={[
                        {
                            value: filterStatus,
                            onChange: (v) => { setFilterStatus(v); setPage(1); },
                            placeholder: "All Statuses",
                            width: "w-44",
                            options: STATUS_FILTER_OPTIONS,
                        },
                        {
                            value: filterSource,
                            onChange: (v) => { setFilterSource(v); setPage(1); },
                            placeholder: "All Sources",
                            width: "w-40",
                            options: SOURCE_FILTER_OPTIONS,
                        },
                        {
                            value: filterVerified,
                            onChange: (v) => { setFilterVerified(v); setPage(1); },
                            placeholder: "Verification",
                            width: "w-36",
                            options: [
                                { label: "Verified Only", value: "verified" },
                                { label: "Unverified Only", value: "unverified" },
                            ],
                        },
                        {
                            value: filterMember,
                            onChange: (v) => { setFilterMember(v); setPage(1); },
                            placeholder: "All Team Members",
                            width: "w-44",
                            options: memberOptions,
                        },
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
                    <MinNumberFilter
                        label="Days >"
                        value={minDays}
                        onChange={(v) => { setMinDays(v); setPage(1); }}
                        placeholder="Any"
                        width="w-32"
                    />
                    <DateRangeFilter
                        value={dateRange ?? allTimeRange}
                        onApply={(r) => { setDateRange(r); setPage(1); }}
                        today={todayIso}
                        earliest={earliestIso}
                    />
                </TableFilters>

                {/* ── Active search hint ── */}
                {search && (
                    <div className="flex items-center gap-2 px-1">
                        <p className="text-xs text-dashboard-base-content/45">
                            Showing results for{" "}
                            <span className="font-medium text-dashboard-base-content">
                                {search}
                            </span>
                        </p>
                        <button
                            type="button"
                            onClick={() => { setSearch(""); setPage(1); }}
                            className="text-xs text-dashboard-primary hover:underline"
                        >
                            Clear
                        </button>
                    </div>
                )}

                {/* ── Table ── */}
                <DataTable
                    data={paginated}
                    columns={columns}
                    rowKey={(q) => q.id}
                    onRowClick={(q) => openDetail(q)}
                    rowClassName={(q) => {
                        return q.status === "IN_PROGRESS" || q.status === "ASSIGNED"
                            ? "bg-dashboard-warning/20 hover:bg-dashboard-warning/25"
                            : "hover:bg-dashboard-base-200/50";
                    }}
                    emptyState={
                        <TableEmptyState
                            description={
                                filterStatus === "CLOSED" || filterStatus === "CONVERTED" || filterStatus === "REJECTED"
                                    ? "No queries found"
                                    : filterStatus === "IN_PROGRESS"
                                        ? "No active queries — you're all caught up!"
                                        : filterStatus === "SUBMITTED"
                                            ? "Try adjusting your filters"
                                            : "Queries from your website will appear here"
                            }
                        />
                    }
                    pagination={{
                        currentPage: safePage,
                        totalPages,
                        onPageChange: setPage,
                        pageSize,
                        onPageSizeChange: handlePageSizeChange,
                        pageSizeOptions: PAGE_SIZE_OPTIONS,
                    }}
                />
            </div>

            {/* ── Detail Sheet ── */}
            <QueryDetailSheet
                query={loadingDetail ? null : detailQuery}
                reasons={reasons}
                open={sheetOpen}
                onOpenChange={setSheetOpen}
                onDeleted={handleDeleted}
            />
        </>
    );
}