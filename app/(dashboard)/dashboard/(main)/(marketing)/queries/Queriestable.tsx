// /(marketing)/queries/Queriestable.tsx


"use client";

import { useState, useTransition } from "react";
import { formatDistanceToNow, format } from "date-fns";
import {
    CheckCircle2, XCircle, PhoneCall, Eye,
    Phone, MapPin, StickyNote,
    Inbox, UserCheck, Send, Clock, TrendingUp
} from "lucide-react";

import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
    Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from "../../components/ui/tooltip";
import { DataTable, type ColumnDef } from "../../components/dashboard/Datatable";
import { TableFilters } from "../../components/dashboard/Tablefilters";
import { StatCard, StatGrid } from "../../components/dashboard/Statcard";
import {
    QueryStatusBadge,
    QuerySourceBadge,
    CallAttemptsDots,
} from "../../components/dashboard/CustomBadges";
import { RejectQueryDialog } from "./Rejectquerydialog";
import { QueryDetailSheet } from "./Querydetailsheet";
import { verifyQuery, markInProgress, getQueryById } from "./actions";
import type { PackageQuery, RejectionReason } from "./actions";
import { Pencil } from "lucide-react";
import { EditQueryDialog } from "./Editquerydialog";
import { AssignQueryDropdown } from "./Assignquerydropdown";

// ── Types ─────────────────────────────────────────────────────────────────────

type QueryWithDetails = PackageQuery & {
    notes: Array<{ id: string; authorId: string; content: string; createdAt: Date }>;
    timeline: Array<{ id: string; actorName: string | null; event: string; createdAt: Date }>;
};

type Props = {
    queries: PackageQuery[];
    reasons: RejectionReason[];
};

const PAGE_SIZE = 10;

const STATUS_FILTER_OPTIONS = [
    { label: "Submitted", value: "SUBMITTED" },
    { label: "Verified", value: "VERIFIED" },
    { label: "Rejected", value: "REJECTED" },
    { label: "Assigned", value: "ASSIGNED" },
    { label: "In Progress", value: "IN_PROGRESS" },
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
    query,
    reasons,
    onView,
}: {
    query: PackageQuery;
    reasons: RejectionReason[];
    onView: () => void;
}) {
    const [isPendingV, startVerify] = useTransition();
    const [isPendingP, startProgress] = useTransition();

    const isTerminal = query.status === "VERIFIED" || query.status === "REJECTED";
    const canVerify = !query.verified && query.status !== "REJECTED";

    function handleVerify(e: React.MouseEvent) {
        e.stopPropagation();
        startVerify(async () => {
            const r = await verifyQuery(query.id);
            if (r.success) toast.success(r.message);
            else toast.error(r.message);
        });
    }

    function handleProgress(e: React.MouseEvent) {
        e.stopPropagation();
        startProgress(async () => {
            const r = await markInProgress(query.id);
            if (r.success) toast.success(r.message);
            else toast.error(r.message);
        });
    }

    return (
        <TooltipProvider delayDuration={300}>
            <div className="flex items-center justify-end gap-1">
                {/* Verify */}
                {canVerify && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon"
                                className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30"
                                onClick={handleVerify} disabled={isPendingV}>
                                <CheckCircle2 className="h-3.5 w-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Verify Lead</TooltipContent>
                    </Tooltip>
                )}

                {/* Edit Query */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span onClick={(e) => e.stopPropagation()}>
                            <EditQueryDialog query={query} onDone={() => { }}>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <Pencil className="h-3.5 w-3.5" />
                                </Button>
                            </EditQueryDialog>
                        </span>
                    </TooltipTrigger>
                    <TooltipContent>Edit Query</TooltipContent>
                </Tooltip>

                {/* Assign to Sales */}
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

                {/* Reject */}
                {!isTerminal && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span onClick={(e) => e.stopPropagation()}>
                                <RejectQueryDialog queryId={query.id} leadName={query.name} reasons={reasons}>
                                    <Button variant="ghost" size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                                        <XCircle className="h-3.5 w-3.5" />
                                    </Button>
                                </RejectQueryDialog>
                            </span>
                        </TooltipTrigger>
                        <TooltipContent>Reject Query</TooltipContent>
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

    // Detail sheet state
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
        const matchSearch = !search
            || q.name.toLowerCase().includes(s)
            || q.phone.includes(s)
            || (q.email ?? "").toLowerCase().includes(s)
            || (q.destination ?? "").toLowerCase().includes(s)
            || (q.packageName ?? "").toLowerCase().includes(s)
            || ((q as any).assignedToName ?? "").toLowerCase().includes(s);

        const matchStatus = filterStatus === "all" || q.status === filterStatus;
        const matchSource = filterSource === "all" || q.source === filterSource;
        const matchVerified =
            filterVerified === "all"
            || (filterVerified === "verified" && q.verified)
            || (filterVerified === "unverified" && !q.verified);
        const matchAssigned =
            filterAssigned === "all"
            || (filterAssigned === "assigned" && !!q.assignedTo)
            || (filterAssigned === "unassigned" && !q.assignedTo);

        return matchSearch && matchStatus && matchSource && matchVerified && matchAssigned;
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
    const isFiltering = search !== "" || filterStatus !== "all" || filterSource !== "all" || filterVerified !== "all" || filterAssigned !== "all";

    // ── Stats ─────────────────────────────────────────────────────────────────

    const submitted = queries.filter((q) => q.status === "SUBMITTED").length;
    const inProgress = queries.filter((q) => q.status === "IN_PROGRESS").length;
    const verified = queries.filter((q) => q.verified).length;
    const rejected = queries.filter((q) => q.status === "REJECTED").length;
    const assigned = queries.filter((q) => !!q.assignedTo).length;
    const convRate = queries.length > 0 ? Math.round((verified / queries.length) * 100) : 0;

    // ── Columns ───────────────────────────────────────────────────────────────

    const columns: ColumnDef<PackageQuery>[] = [
        {
            header: "Lead",
            width: "w-[220px]",
            cell: (q) => (
                <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                        <p className="font-medium text-sm leading-tight">{q.name}</p>
                        {q.totalLeadQueries > 1 && (
                            <Badge
                                variant="outline"
                                className="text-[10px] text-amber-600 border-amber-300 py-0 cursor-pointer hover:bg-amber-50"
                                onClick={(e) => { e.stopPropagation(); setSearch(q.phone); setPage(1); }}
                            >
                                {q.totalLeadQueries} queries
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <span>{q.phone}</span>
                    </div>
                    {q.email && (
                        <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">{q.email}</p>
                    )}
                    {/* Assigned To indicator */}
                    {q.assignedTo && (
                        <div className="flex items-center gap-1 text-[10px] text-primary mt-0.5">
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
                        <div className="flex items-center gap-1 text-sm font-medium">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {q.destination}
                        </div>
                    )}
                    {q.packageName && (
                        <p className="text-xs text-muted-foreground truncate max-w-[160px]">{q.packageName}</p>
                    )}
                    {!q.destination && !q.packageName && (
                        <span className="text-xs text-muted-foreground italic">—</span>
                    )}
                </div>
            ),
        },
        {
            header: "Status",
            cell: (q) => (
                <div className="space-y-1.5">
                    <QueryStatusBadge status={q.status} />
                    {q.status === "IN_PROGRESS" && q.callAttempts > 0 && (
                        <CallAttemptsDots count={q.callAttempts} />
                    )}
                    {q.status === "REJECTED" && q.rejectionReason && (
                        <p className="text-[10px] text-muted-foreground max-w-[120px] truncate">
                            {q.rejectionReason.label}
                        </p>
                    )}
                </div>
            ),
        },
        {
            header: "Source",
            cell: (q) => <QuerySourceBadge source={q.source} />,
        },
        {
            header: "Group / Date",
            cell: (q) => (
                <div className="space-y-0.5 text-xs text-muted-foreground">
                    {q.groupSize && <p>{q.groupSize} pax</p>}
                    {q.travelDate && <p>{format(new Date(q.travelDate), "dd MMM yy")}</p>}
                    {!q.groupSize && !q.travelDate && <span className="italic">—</span>}
                </div>
            ),
        },
        {
            header: "Notes",
            align: "center",
            cell: (q) => (
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                    <StickyNote className="h-3 w-3" />
                    {q._count.notes}
                </div>
            ),
        },
        {
            header: "Received",
            cell: (q) => (
                <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(q.createdAt), { addSuffix: true })}
                </span>
            ),
        },
        {
            header: "Actions",
            align: "right",
            width: "w-[160px]",
            cell: (q) => (
                <ActionCell
                    query={q}
                    reasons={reasons}
                    onView={() => openDetail(q)}
                />
            ),
        },
    ];

    return (
        <>
            <div className="space-y-4">

                {/* Stats */}

                <StatGrid cols={6}>
                    <StatCard
                        label="Total Queries"
                        value={queries.length}
                        icon={Inbox}
                        iconBg="bg-dashboard-primary/10"
                        iconText="text-dashboard-primary"
                    />
                    <StatCard
                        label="Submitted"
                        value={submitted}
                        icon={Send}
                        iconBg="bg-dashboard-info/10"
                        iconText="text-dashboard-info"
                        muted={submitted === 0}
                    />
                    <StatCard
                        label="In Progress"
                        value={inProgress}
                        icon={Clock}
                        iconBg="bg-dashboard-warning/10"
                        iconText="text-dashboard-warning"
                    />
                    <StatCard
                        label="Verified"
                        value={verified}
                        icon={CheckCircle2}
                        iconBg="bg-dashboard-success/10"
                        iconText="text-dashboard-success"
                        highlight={verified > 0}
                    />
                    <StatCard
                        label="Assigned"
                        value={assigned}
                        icon={UserCheck}
                        iconBg="bg-dashboard-secondary/10"
                        iconText="text-dashboard-secondary"
                    />
                    <StatCard
                        label="Conv. Rate"
                        value={`${convRate}%`}
                        icon={TrendingUp}
                        iconBg="bg-dashboard-accent/10"
                        iconText="text-dashboard-accent"
                        trend={convRate > 0 ? { value: `${convRate}%`, positive: true } : undefined}
                    />
                </StatGrid>

                {/* Filters */}
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
                            width: "w-44",
                            options: SOURCE_FILTER_OPTIONS,
                        },
                        {
                            value: filterVerified,
                            onChange: (v) => { setFilterVerified(v); setPage(1); },
                            placeholder: "Verification",
                            width: "w-40",
                            options: [
                                { label: "Verified Only", value: "verified" },
                                { label: "Unverified Only", value: "unverified" },
                            ],
                        },
                        {
                            value: filterAssigned,
                            onChange: (v) => { setFilterAssigned(v); setPage(1); },
                            placeholder: "Assignment",
                            width: "w-40",
                            options: [
                                { label: "Assigned", value: "assigned" },
                                { label: "Unassigned", value: "unassigned" },
                            ],
                        },
                    ]}
                />

                {search && (
                    <div className="flex items-center gap-2 px-1">
                        <p className="text-xs text-muted-foreground">
                            Showing queries for <span className="font-medium text-foreground">{search}</span>
                        </p>
                        <button
                            type="button"
                            onClick={() => { setSearch(""); setPage(1); }}
                            className="text-xs text-primary hover:underline"
                        >
                            Clear filter
                        </button>
                    </div>
                )}

                {/* Table */}
                <DataTable
                    data={paginated}
                    columns={columns}
                    rowKey={(q) => q.id}
                    onRowClick={(q) => openDetail(q)}
                    rowClassName={(q) =>
                        q.status === "IN_PROGRESS"
                            ? "bg-amber-50 dark:bg-amber-950/20 hover:bg-amber-100 dark:hover:bg-amber-950/30"
                            : ""
                    }
                    emptyState={
                        <div className="flex flex-col items-center gap-2">
                            <Inbox className="h-10 w-10 text-muted-foreground" />
                            <p className="text-sm font-medium text-muted-foreground">No queries found</p>
                            <p className="text-xs text-muted-foreground">
                                {isFiltering
                                    ? "Try adjusting your filters"
                                    : "Queries from your website will appear here"}
                            </p>
                        </div>
                    }
                    pagination={{ currentPage: safePage, totalPages, onPageChange: setPage }}
                />
            </div>

            {/* Detail Sheet */}
            <QueryDetailSheet
                query={loadingDetail ? null : detailQuery}
                reasons={reasons}
                open={sheetOpen}
                onOpenChange={setSheetOpen}
            />
        </>
    );
}