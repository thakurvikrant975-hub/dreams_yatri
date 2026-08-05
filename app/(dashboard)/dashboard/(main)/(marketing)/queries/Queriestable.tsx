"use client";

import { useState, useTransition } from "react";
import { formatDistanceToNow, formatDistanceStrict, format } from "date-fns";
import {
    CheckCircle2,
    Phone, MapPin, StickyNote,
    Inbox, UserCheck, Send, Clock, TrendingUp,
    Ticket, Users, CalendarDays,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "../../components/ui/tooltip";
import { DataTable, type ColumnDef } from "../../components/dashboard/Datatable";
import { TableFilters } from "../../components/dashboard/Tablefilters";
import { StatCard, StatGrid } from "../../components/dashboard/Statcard";
import { QueryStatusBadge, QuerySourceBadge } from "../../components/dashboard/CustomBadges";
import { QueryDetailSheet } from "./Querydetailsheet";
import { QueryTimelineSheet } from "./QueryTimelineSheet";
import { getQueryById } from "./actions";
import type { PackageQuery, RejectionReason } from "./actions";
import { Pencil } from "lucide-react";
import { EditQueryDialog } from "./Editquerydialog";
import { AssignQueryDropdown } from "./Assignquerydropdown";
import { TableEmptyState } from "../../components/dashboard/TableEmptyState";
import { TodaysAssignmentDialog } from "./TodaysAssignmentDialog";

// ── Types ─────────────────────────────────────────────────────────────────────

type QueryWithDetails = PackageQuery & {
    notes: Array<{ id: string; authorId: string; content: string; createdAt: Date }>;
    timeline: Array<{ id: string; actorName: string | null; event: string; createdAt: Date }>;
};

type Props = { queries: PackageQuery[]; reasons: RejectionReason[] };

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

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
    { label: "WhatsApp", value: "WHATSAPP" },
    { label: "Phone Call", value: "PHONE_CALL" },
    { label: "Referral", value: "REFERRAL" },
    { label: "Other", value: "OTHER" },
];

// ── Action Cell ───────────────────────────────────────────────────────────────

function ActionCell({
    query, onView,
}: { query: PackageQuery; onView: () => void }) {
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


            </div>
        </TooltipProvider>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function QueriesTable({ queries, reasons }: Props) {
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const [filterSource, setFilterSource] = useState("all");
    const [filterVerified, setFilterVerified] = useState("all");
    const [filterAssigned, setFilterAssigned] = useState("all");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

    const [sheetOpen, setSheetOpen] = useState(false);
    const [detailQuery, setDetailQuery] = useState<QueryWithDetails | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

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
        const matchAssigned = filterAssigned === "all"
            || (filterAssigned === "assigned" && !!q.assignedTo)
            || (filterAssigned === "unassigned" && !q.assignedTo);

        return matchSearch && matchStatus && matchSource && matchVerified && matchAssigned;
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

    function handlePageSizeChange(size: number) {
        setPageSize(size);
        setPage(1);
    }
    const isFiltering = search !== "" || filterStatus !== "all" || filterSource !== "all"
        || filterVerified !== "all" || filterAssigned !== "all";

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
                    {(q.groupSize || q.travelDate) && (
                        <div className="flex items-center gap-2 text-[11px] text-dashboard-base-content/60 pt-0.5">
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
                <div className="flex items-center justify-center gap-1 text-xs text-dashboard-base-content/75">
                    <StickyNote className="h-3 w-3" />
                    {q._count.notes}
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
                <ActionCell query={q} onView={() => openDetail(q)} />
            ),
        },
    ];

    return (
        <>
            <div className="space-y-5">

                {/* ── Stats ── */}
                <div className="flex items-center justify-end">
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
                            value: filterAssigned,
                            onChange: (v) => { setFilterAssigned(v); setPage(1); },
                            placeholder: "Assignment",
                            width: "w-36",
                            options: [
                                { label: "Assigned", value: "assigned" },
                                { label: "Unassigned", value: "unassigned" },
                            ],
                        },
                    ]}
                />

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
            />
        </>
    );
}