"use client";

import { useState, useTransition } from "react";
import { format, formatDistanceToNow, isToday } from "date-fns";
import {
    CalendarClock, XCircle, Eye, Phone, Mail,
    MapPin, Users, Calendar, StickyNote, TrendingUp,
    RotateCcw, ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import {
    Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from "../../components/ui/tooltip";
import { DataTable, type ColumnDef } from "../../components/dashboard/Datatable";
import { TableFilters } from "../../components/dashboard/Tablefilters";
import { Stats } from "../../components/dashboard/Stats";
import { SalesQueryStatusBadge } from "./Salesquerybadges";
import { AddFollowUpDialog } from "./Addfollowupdialog";
import { CloseQueryDialog } from "./Closequerydialog";
import { PackageDetailsDialog } from "./Packagedetailsdialog";
import { SalesQueryDetailSheet } from "./Salesquerydetailsheet";
import {
    reopenSalesQuery, getSalesQueryById,
} from "./actions";
import { isClosedQuery, isActiveQuery } from "./query-status";
import type {
    PackageQueryType, CloseReason, QueryStatus, PackageRequirements,
} from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────────

type SalesQueryWithDetails = PackageQueryType & {
    followUps: Array<{
        id: string;
        note: string;
        followUpAt: Date | null;
        createdAt: Date;
        createdById: string | null;
        createdByName: string | null;
    }>;
    notes: Array<{ id: string; content: string; createdAt: Date }>;
    timeline: Array<{ id: string; actorName: string | null; event: string; createdAt: Date }>;
};

type Props = {
    queries: PackageQueryType[];
    closeReasons: CloseReason[];
};

const PAGE_SIZE = 10;

// ── Action Cell ───────────────────────────────────────────────────────────────

function ActionCell({
    query,
    closeReasons,
    onView,
}: {
    query: PackageQueryType;
    closeReasons: CloseReason[];
    onView: () => void;
}) {
    const [isPendingReopen, startReopen] = useTransition();
    const closed = isClosedQuery(query.status);
    const active = isActiveQuery(query.status);

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

                {/* View Detail */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost" size="icon" className="h-8 w-8"
                            onClick={(e) => { e.stopPropagation(); onView(); }}
                        >
                            <Eye className="h-3.5 w-3.5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>View Details</TooltipContent>
                </Tooltip>

                {active && (
                    <>
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

                        {/* Add / Update Follow-Up */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span onClick={(e) => e.stopPropagation()}>
                                    <AddFollowUpDialog salesQueryId={query.id} leadName={query.name}>
                                        <Button
                                            variant="ghost" size="icon"
                                            className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                        >
                                            <CalendarClock className="h-3.5 w-3.5" />
                                        </Button>
                                    </AddFollowUpDialog>
                                </span>
                            </TooltipTrigger>
                            <TooltipContent>
                                {query._count.queryFollowUps > 0 ? "Update Follow-Up" : "Add Follow-Up"}
                            </TooltipContent>
                        </Tooltip>

                        {/* Close Query */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span onClick={(e) => e.stopPropagation()}>
                                    <CloseQueryDialog
                                        salesQueryId={query.id}
                                        leadName={query.name}
                                        closeReasons={closeReasons}
                                    >
                                        <Button
                                            variant="ghost" size="icon"
                                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                        >
                                            <XCircle className="h-3.5 w-3.5" />
                                        </Button>
                                    </CloseQueryDialog>
                                </span>
                            </TooltipTrigger>
                            <TooltipContent>Close Query</TooltipContent>
                        </Tooltip>
                    </>
                )}

                {/* Reopen — terminal only */}
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

// ── Filter options ─────────────────────────────────────────────────────────────

const STATUS_FILTER_OPTIONS = [
    { label: "All Queries", value: "all" },
    { label: "New / Assigned", value: "ASSIGNED" },
    { label: "In Progress", value: "IN_PROGRESS" },
    { label: "Package Sent", value: "PACKAGE_SENT" },
    { label: "Client Accepted", value: "CLIENT_ACCEPTED" },
    { label: "Client Declined", value: "CLIENT_DECLINED" },
    { label: "Payment Initiated", value: "PAYMENT_INITIATED" },
    { label: "Converted", value: "CONVERTED" },
    { label: "Closed", value: "CLOSED" },
];

// ── Main Component ────────────────────────────────────────────────────────────

export function SalesQueriesTable({ queries, closeReasons }: Props) {
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const [page, setPage] = useState(1);

    // Detail sheet state
    const [sheetOpen, setSheetOpen] = useState(false);
    const [detailQuery, setDetailQuery] = useState<SalesQueryWithDetails | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    async function openDetail(query: PackageQueryType) {
        setSheetOpen(true);
        setLoadingDetail(true);
        try {
            const full = await getSalesQueryById(query.id);
            if (!full) return;

            // Map queryFollowUps → followUps for the sheet
            const normalized: SalesQueryWithDetails = {
                ...(full as unknown as PackageQueryType),
                followUps: (full as any).queryFollowUps ?? [],
                notes: (full as any).notes ?? [],
                timeline: (full as any).timeline ?? [],
                // _count is now always included from getSalesQueryById
                _count: (full as any)._count ?? { queryFollowUps: 0, notes: 0 },
            };

            setDetailQuery(normalized);
        } finally {
            setLoadingDetail(false);
        }
    }

    // ── Filtering ─────────────────────────────────────────────────────────────
    const filtered = queries.filter(q => {
        const s = search.toLowerCase();
        const matchSearch =
            !search ||
            q.name.toLowerCase().includes(s) ||
            q.phone.includes(s) ||
            (q.email ?? "").toLowerCase().includes(s) ||
            (q.destination ?? "").toLowerCase().includes(s) ||
            (q.packageName ?? "").toLowerCase().includes(s);

        const matchStatus = filterStatus === "all" || q.status === filterStatus;

        return matchSearch && matchStatus;
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
    const isFiltering = search !== "" || filterStatus !== "all";

    // ── Stats ─────────────────────────────────────────────────────────────────
    const totalCount = queries.length;

    // New today = assigned today
    const newToday = queries.filter(q => {
        const d = q.assignedAt ?? q.createdAt;
        return isToday(new Date(d));
    }).length;

    // In progress = all active statuses (not yet terminal)
    const inProgressCount = queries.filter(q => isActiveQuery(q.status)).length;

    // Closed = CLOSED (without conversion)
    const closedCount = queries.filter(q => q.status === "CLOSED").length;

    // Booked / converted
    const convertedCount = queries.filter(q => q.status === "CONVERTED").length;

    // Conversion % = converted / (converted + closed)
    const terminal = convertedCount + closedCount;
    const convRate = terminal > 0 ? Math.round((convertedCount / terminal) * 100) : 0;

    // ── Columns ───────────────────────────────────────────────────────────────
    const columns: ColumnDef<PackageQueryType>[] = [
        {
            header: "Lead",
            width: "w-[200px]",
            cell: (q) => (
                <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                        <p className="font-medium text-sm leading-tight">{q.name}</p>
                        {/* Green dot = requirements filled */}
                        {q.requirements && (
                            <span title="Requirements filled" className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
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
                <div className="space-y-1">
                    <SalesQueryStatusBadge status={q.status} />
                    {isClosedQuery(q.status) && q.closeReasonId && (
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
        {
            header: "Follow-Up",
            align: "center" as const,
            cell: (q) => (
                <div className="flex flex-col items-center gap-0.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                        <StickyNote className="h-3 w-3" />
                        {q._count.queryFollowUps}
                    </div>
                    {q.nextFollowUpAt && (
                        <span className={`text-[10px] ${new Date(q.nextFollowUpAt) < new Date() ? "text-destructive" : "text-amber-600"}`}>
                            {format(new Date(q.nextFollowUpAt), "dd MMM")}
                        </span>
                    )}
                </div>
            ),
        },
        {
            header: "Assigned",
            cell: (q) => (
                <div className="space-y-0.5 text-xs text-muted-foreground">
                    {q.assignedAt ? (
                        <>
                            <p className="font-medium text-foreground text-[11px]">
                                {format(new Date(q.assignedAt), "dd MMM yy")}
                            </p>
                            <p>{formatDistanceToNow(new Date(q.assignedAt), { addSuffix: true })}</p>
                        </>
                    ) : (
                        <span className="italic">—</span>
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
                    closeReasons={closeReasons}
                    onView={() => openDetail(q)}
                />
            ),
        },
    ];

    return (
        <>
            <div className="space-y-4">
                {/* Stats */}
                <Stats
                    rows={[
                        { label: "Total Queries", value: totalCount },
                        { label: "New Today", value: newToday },
                        { label: "In Progress", value: inProgressCount },
                        { label: "Closed", value: closedCount, muted: closedCount === 0 },
                        { label: "Booked", value: convertedCount },
                        { label: "Conv. %", value: `${convRate}%` },
                    ]}
                />

                {/* Filters */}
                <TableFilters
                    search={search}
                    onSearchChange={(v) => { setSearch(v); setPage(1); }}
                    searchPlaceholder="Search by name, phone, email, destination..."
                    filteredCount={isFiltering ? filtered.length : undefined}
                    totalCount={isFiltering ? queries.length : undefined}
                    filters={[
                        {
                            value: filterStatus,
                            onChange: (v) => { setFilterStatus(v); setPage(1); },
                            placeholder: "All Statuses",
                            width: "w-48",
                            options: STATUS_FILTER_OPTIONS,
                        },
                    ]}
                />

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
                        if (isClosedQuery(q.status)) return "opacity-60 hover:opacity-80";
                        if (q.status === "CONVERTED") return "bg-emerald-50/40 dark:bg-emerald-950/10";
                        if (q.status === "ASSIGNED") return "bg-amber-50/40 dark:bg-amber-950/10";
                        return "";
                    }}
                    emptyState={
                        <div className="flex flex-col items-center gap-2">
                            <TrendingUp className="h-10 w-10 text-muted-foreground" />
                            <p className="text-sm font-medium text-muted-foreground">No queries found</p>
                            <p className="text-xs text-muted-foreground">
                                {filterStatus !== "all"
                                    ? `No queries with status "${STATUS_FILTER_OPTIONS.find(o => o.value === filterStatus)?.label ?? filterStatus}"`
                                    : search
                                        ? "No queries match your search"
                                        : "Queries assigned to you will appear here"}
                            </p>
                        </div>
                    }
                    pagination={{ currentPage: safePage, totalPages, onPageChange: setPage }}
                />
            </div>

            {/* Detail Sheet */}
            <SalesQueryDetailSheet
                query={loadingDetail ? null : detailQuery}
                closeReasons={closeReasons}
                open={sheetOpen}
                onOpenChange={setSheetOpen}
                onRefresh={() => {
                    if (detailQuery) openDetail(detailQuery);
                }}
            />
        </>
    );
}