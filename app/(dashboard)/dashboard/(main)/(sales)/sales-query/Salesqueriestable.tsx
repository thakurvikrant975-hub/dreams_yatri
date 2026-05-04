"use client";

import { useState, useTransition } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
    CalendarClock, XCircle, Eye, Phone, Mail,
    MapPin, Users, Calendar, StickyNote, TrendingUp,
    RotateCcw, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
    Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from "../../components/ui/tooltip";
import { DataTable, type ColumnDef } from "../../components/dashboard/Datatable";
import { TableFilters } from "../../components/dashboard/Tablefilters";
import { Stats } from "../../components/dashboard/Stats";
import { SalesQueryStatusBadge } from "./Salesquerybadges";
import { QuerySourceBadge } from "../../(marketing)/queries/QueryBadges";
import { AddFollowUpDialog } from "./Addfollowupdialog";
import { CloseQueryDialog } from "./Closequerydialog";
import { SalesQueryDetailSheet } from "./Salesquerydetailsheet";
import { reopenSalesQuery, getSalesQueryById } from "./actions";
import type { SalesQuery, CloseReason } from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────────

type SalesQueryWithDetails = SalesQuery & {
    followUps: Array<{
        id: string;
        note: string;
        followUpAt: Date | null;
        createdAt: Date;
        createdByName: string | null;
    }>;
    notes: Array<{ id: string; content: string; createdAt: Date }>;
    timeline: Array<{ id: string; actorName: string | null; event: string; createdAt: Date }>;
};

type Props = {
    queries:      SalesQuery[];
    closeReasons: CloseReason[];
};

const PAGE_SIZE = 10;

// ── Action Cell ───────────────────────────────────────────────────────────────

function ActionCell({
    query,
    closeReasons,
    onView,
}: {
    query:        SalesQuery;
    closeReasons: CloseReason[];
    onView:       () => void;
}) {
    const [isPendingReopen, startReopen] = useTransition();
    const isClosed = query.status === "CLOSED";

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
                            variant="ghost" size="icon"
                            className="h-8 w-8"
                            onClick={(e) => { e.stopPropagation(); onView(); }}
                        >
                            <Eye className="h-3.5 w-3.5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>View Details</TooltipContent>
                </Tooltip>

                {!isClosed && (
                    <>
                        {/* Add Follow-Up */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span onClick={(e) => e.stopPropagation()}>
                                    <AddFollowUpDialog
                                        salesQueryId={query.id}
                                        leadName={query.name}
                                    >
                                        <Button
                                            variant="ghost" size="icon"
                                            className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                                        >
                                            <CalendarClock className="h-3.5 w-3.5" />
                                        </Button>
                                    </AddFollowUpDialog>
                                </span>
                            </TooltipTrigger>
                            <TooltipContent>Add Follow-Up</TooltipContent>
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

                {/* Reopen (closed only) */}
                {isClosed && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost" size="icon"
                                className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
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

export function SalesQueriesTable({ queries, closeReasons }: Props) {
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState("ACTIVE"); // default: show active
    const [page, setPage] = useState(1);

    // Detail sheet
    const [sheetOpen, setSheetOpen] = useState(false);
    const [detailQuery, setDetailQuery] = useState<SalesQueryWithDetails | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    async function openDetail(query: SalesQuery) {
        setSheetOpen(true);
        setLoadingDetail(true);
        try {
            const full = await getSalesQueryById(query.id);
            setDetailQuery(full as unknown as SalesQueryWithDetails);
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
        return matchSearch && matchStatus;
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
    const isFiltering = search !== "" || filterStatus !== "all";

    // ── Stats ─────────────────────────────────────────────────────────────────
    const active     = queries.filter(q => q.status === "ACTIVE").length;
    const closed     = queries.filter(q => q.status === "CLOSED").length;
    const withFollowUp = queries.filter(q => q._count.followUps > 0).length;
    const convRate   = queries.length > 0 ? Math.round((closed / queries.length) * 100) : 0;

    // ── Columns ───────────────────────────────────────────────────────────────
    const columns: ColumnDef<SalesQuery>[] = [
        {
            header: "Lead",
            width: "w-[200px]",
            cell: (q) => (
                <div className="space-y-0.5">
                    <p className="font-medium text-sm leading-tight">{q.name}</p>
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
                    {q.status === "CLOSED" && q.closeReason && (
                        <p className="text-[10px] text-muted-foreground max-w-[110px] truncate">
                            {q.closeReason.label}
                        </p>
                    )}
                </div>
            ),
        },
        {
            header: "Group / Date",
            cell: (q) => (
                <div className="space-y-0.5 text-xs text-muted-foreground">
                    {q.groupSize && (
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
            header: "Assigned",
            cell: (q) => (
                <div className="space-y-0.5 text-xs text-muted-foreground">
                    {q.assignedAt ? (
                        <>
                            <p className="font-medium text-foreground text-[11px]">
                                {format(new Date(q.assignedAt), "dd MMM yy")}
                            </p>
                            <p>{format(new Date(q.assignedAt), "hh:mm a")}</p>
                        </>
                    ) : (
                        <span className="italic">—</span>
                    )}
                </div>
            ),
        },
        {
            header: "Actions",
            align: "right",
            width: "w-[120px]",
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
                        { label: "Total Queries",   value: queries.length },
                        { label: "Active",           value: active },
                        { label: "Closed",           value: closed,       muted: closed === 0 },
                        { label: "With Follow-Ups",  value: withFollowUp },
                        { label: "Close Rate",        value: `${convRate}%` },
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
                            width: "w-44",
                            options: [
                                { label: "Active Queries",  value: "ACTIVE" },
                                { label: "Closed Queries",  value: "CLOSED" },
                            ],
                        },
                    ]}
                />

                {search && (
                    <div className="flex items-center gap-2 px-1">
                        <p className="text-xs text-muted-foreground">
                            Showing results for <span className="font-medium text-foreground">{search}</span>
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
                    rowClassName={(q) =>
                        q.status === "CLOSED"
                            ? "opacity-60 hover:opacity-80"
                            : ""
                    }
                    emptyState={
                        <div className="flex flex-col items-center gap-2">
                            <TrendingUp className="h-10 w-10 text-muted-foreground" />
                            <p className="text-sm font-medium text-muted-foreground">No queries found</p>
                            <p className="text-xs text-muted-foreground">
                                {filterStatus === "CLOSED"
                                    ? "No closed queries yet"
                                    : filterStatus === "ACTIVE"
                                    ? "No active queries — you're all caught up!"
                                    : "No queries match your search"}
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
            />
        </>
    );
}