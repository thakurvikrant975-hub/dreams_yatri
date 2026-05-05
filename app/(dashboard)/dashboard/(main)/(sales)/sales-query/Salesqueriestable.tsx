"use client";

import { useState, useTransition } from "react";
import { format, formatDistanceToNow } from "date-fns";
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
import { QuerySourceBadge } from "../../(marketing)/queries/QueryBadges";
import { AddFollowUpDialog } from "./Addfollowupdialog";
import { CloseQueryDialog } from "./Closequerydialog";
import { PackageDetailsDialog } from "./Packagedetailsdialog";
import { SalesQueryDetailSheet } from "./Salesquerydetailsheet";
import { reopenSalesQuery, getSalesQueryById } from "./actions";
import type { PackageQueryType, CloseReason, SalesQueryStatus, PackageRequirements } from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────────

// BUG FIX: Was "followUps" — Prisma relation name from QueryFollowUp model is "queryFollowUps"
type SalesQueryWithDetails = PackageQueryType & {
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
    queries: PackageQueryType[];
    closeReasons: CloseReason[];
};

const PAGE_SIZE = 10;

// ── Status helpers ────────────────────────────────────────────────────────────
// BUG FIX: Old isActive() checked for "VERIFIED" which is a marketing-module status
// and doesn't exist in the sales QueryStatus = "SUBMITTED" | "ACTIVE" | "CLOSED".
// Sales lifecycle: SUBMITTED (ops assigned it) → ACTIVE (sales is working it) → CLOSED

function isActiveStatus(status: SalesQueryStatus) {
    return status === "SUBMITTED" || status === "ACTIVE";
}

function isClosedStatus(status: SalesQueryStatus) {
    return status === "CLOSED";
}

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
    const closed = isClosedStatus(query.status);

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

                {!closed && (
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

                        {/* Add Follow-Up */}
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

export function SalesQueriesTable({ queries, closeReasons }: Props) {
    const [search, setSearch] = useState("");
    // BUG FIX: Default was "ACTIVE" — isFiltering then checked !== "all" which
    // was always true, permanently showing the filtered count. Default is now "ACTIVE"
    // but isFiltering logic correctly excludes this default from the count display.
    const [filterStatus, setFilterStatus] = useState<"all" | "ACTIVE" | "CLOSED">("ACTIVE");
    const [page, setPage] = useState(1);

    // Detail sheet
    const [sheetOpen, setSheetOpen] = useState(false);
    const [detailQuery, setDetailQuery] = useState<SalesQueryWithDetails | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

async function openDetail(query: PackageQueryType) {
    setSheetOpen(true);
    setLoadingDetail(true);

    try {
        const full = await getSalesQueryById(query.id);

        const normalized: SalesQueryWithDetails = {
            ...full,
            followUps: full.queryFollowUps,
        };

        setDetailQuery(normalized);
    } finally {
        setLoadingDetail(false);
    }
}

    // ── Filtering ─────────────────────────────────────────────────────────────
    // const filtered = queries.filter(q => {
    //     const s = search.toLowerCase();
    //     const matchSearch = !search
    //         || q.name.toLowerCase().includes(s)
    //         || q.phone.includes(s)
    //         || (q.email ?? "").toLowerCase().includes(s)
    //         || (q.destination ?? "").toLowerCase().includes(s)
    //         || (q.packageName ?? "").toLowerCase().includes(s);

    //     // BUG FIX: Old code mapped "ACTIVE" filter to isActive() which checked
    //     // SUBMITTED|VERIFIED — VERIFIED doesn't exist in this module.
    //     const matchStatus =
    //         filterStatus === "all"
    //         || (filterStatus === "ACTIVE" && isActiveStatus(q.status))
    //         || (filterStatus === "CLOSED" && isClosedStatus(q.status))
    //         || (filterStatus === "ACTIVE" && isClosedStatus(q.status));

    //     return matchSearch && matchStatus;
    // });

    const filtered = queries;
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    // BUG FIX: isFiltering now ignores the default "ACTIVE" filter so the
    // "X of Y results" count only shows when the user actively changes something.
    const isFiltering = search !== "" || filterStatus !== "ACTIVE";

    // ── Stats ─────────────────────────────────────────────────────────────────
    // BUG FIX: Old stats only counted status === "ACTIVE" but the active view
    // includes both SUBMITTED and ACTIVE. Now correctly split.
    const submitted = queries.filter(q => q.status === "SUBMITTED").length;
    const active = queries.filter(q => q.status === "ACTIVE").length;
    const closed = queries.filter(q => q.status === "CLOSED").length;
    const withFollowUp = queries.filter(q => q._count.queryFollowUps > 0).length;
    const closeRate = queries.length > 0 ? Math.round((closed / queries.length) * 100) : 0;

    // ── Columns ───────────────────────────────────────────────────────────────
    const columns: ColumnDef<PackageQueryType>[] = [
        {
            header: "Lead",
            width: "w-[200px]",
            cell: (q) => (
                <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                        <p className="font-medium text-sm leading-tight">{q.name}</p>
                        {/* Show if requirements have been filled */}
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
                    {q.status === "CLOSED" && q.closeReasonId && (
                        // BUG FIX: Old code used q.closeReason?.label — closeReason isn't
                        // a joined relation in PackageQueryType. We only have closeReasonId.
                        // Look up the label from the closeReasons prop in a parent-level column
                        // by passing closeReasons down. For now, show the raw ID humanized.
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
            header: "Follow-Ups",
            align: "center",
            cell: (q) => (
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                    <StickyNote className="h-3 w-3" />
                    {/* BUG FIX: was q._count.followUps — field is queryFollowUps */}
                    {q._count.queryFollowUps}
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
            width: "w-[140px]",
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
                        { label: "Total Queries", value: queries.length },
                        { label: "New / Submitted", value: submitted },
                        { label: "In Progress", value: active },
                        { label: "Closed", value: closed, muted: closed === 0 },
                        { label: "With Follow-Ups", value: withFollowUp },
                        { label: "Close Rate", value: `${closeRate}%` },
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
                            onChange: (v) => { setFilterStatus(v as "all" | "ACTIVE" | "CLOSED"); setPage(1); },
                            placeholder: "All Statuses",
                            width: "w-44",
                            options: [
                                { label: "All Queries", value: "all" },
                                { label: "Active Queries", value: "ACTIVE" },
                                { label: "Closed Queries", value: "CLOSED" },
                            ],
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
                    rowClassName={(q) =>
                        isClosedStatus(q.status) ? "opacity-60 hover:opacity-80" : ""
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