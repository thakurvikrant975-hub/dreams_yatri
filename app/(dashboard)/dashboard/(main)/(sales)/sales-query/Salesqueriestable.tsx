"use client";

import { useState, useTransition } from "react";
import { format, formatDistanceToNow, isToday } from "date-fns";
import {
    CalendarClock, Eye, Phone, Mail,
    MapPin, Users, Calendar, StickyNote, TrendingUp,
    RotateCcw, ClipboardList, Inbox, Send, Clock, UserCheck, CheckCircle2,
    CircleX, Package, FileText
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
import { AddFollowUpDialog } from "./Addfollowupdialog";
import { PackageDetailsDialog } from "./Packagedetailsdialog";
import { SalesQueryDetailSheet } from "./Salesquerydetailsheet";
import { reopenSalesQuery, getSalesQueryById } from "./actions";
import type { SalesQueryRow } from "./actions";
import type { PackageQueryType, CloseReason, RejectionReason, PackageRequirements } from "../../(marketing)/queries/actions";
import { SalesQueryStatus } from "./query-status";
import { StatCard, StatGrid } from "../../components/dashboard/Statcard";
import Image from "next/image";
import { TableEmptyState } from "../../components/dashboard/TableEmptyState";

// ── Types ─────────────────────────────────────────────────────────────────────

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
};

const PAGE_SIZE = 10;

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
}: {
    query: PackageQueryType;
    onView: () => void;
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

                {!closed && !converted && (
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

export function SalesQueriesTable({ queries, closeReasons, rejectionReasons }: Props) {
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState<"all" | SalesQueryStatus>("all");
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
            if (!full) return;

            const normalized: SalesQueryWithDetails = {
                ...(full as unknown as SalesQueryRow),
                // Map queryFollowUps → followUps for the detail sheet
                followUps: (full as any).queryFollowUps ?? [],
                notes: (full as any).notes ?? [],
                customPackage: (full as any).custom_packages ?? null,
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

        return matchSearch && matchStatus;
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
    const isFiltering = search !== "" || filterStatus !== "all";

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
                        {/* Green dot = requirements filled */}
                        {q.requirements && (
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
                    {!q.destination && !q.packageName && !q.customPackage && (
                        <span className="text-xs text-muted-foreground italic">—</span>
                    )}
                    {q.customPackage && (
                        <a
                            href={`/dashboard/package-builder/${q.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className={`flex items-center gap-1 text-[11px] font-medium mt-1 truncate max-w-44 hover:underline ${
                                q.customPackage.status === "SENT"
                                    ? "text-green-700 dark:text-green-400"
                                    : "text-muted-foreground"
                            }`}
                        >
                            {q.customPackage.status === "SENT" ? (
                                <CheckCircle2 className="h-3 w-3 shrink-0" />
                            ) : (
                                <Package className="h-3 w-3 shrink-0" />
                            )}
                            <span className="truncate">
                                {q.customPackage.status === "SENT" ? "Sent: " : "Draft: "}{q.customPackage.title}
                            </span>
                            {q.customPackage.pdfUrl && <FileText className="h-3 w-3 shrink-0" />}
                        </a>
                    )}
                </div>
            ),
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
        {
            header: "Follow-Ups",
            align: "center" as const,
            sortKey: (q) => q._count.queryFollowUps ?? 0,
            cell: (q) => (
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                    <StickyNote className="h-3 w-3" />
                    {q._count.queryFollowUps}
                </div>
            ),
        },
        {
            header: "Next Follow-Up",
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
        },
        {
            header: "Assigned",
            sortKey: (q) => q.assignedAt ? new Date(q.assignedAt).getTime() : 0,
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
                    onView={() => openDetail(q)}
                />
            ),
        },
    ];

    return (
        <>
            <div className="space-y-4">
                {/* Stats — matches requested: total, new today, in progress, closed, booked, conv% */}
                <StatGrid cols={7}>
                    <StatCard
                        label="Total Queries"
                        value={totalCount}
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
                        if (isClosedStatus(q.status as SalesQueryStatus)) return "opacity-60 hover:opacity-80";
                        if (q.customPackage?.status === "SENT") return "bg-green-50/60 dark:bg-green-950/20 hover:bg-green-100/70 dark:hover:bg-green-900/30";
                        if (q.status === "SUBMITTED") return "bg-amber-50/40 dark:bg-amber-950/10";
                        return "";
                    }}
                    emptyState={
                        <TableEmptyState
                            description={
                                filterStatus === "CLOSED" || filterStatus === "CONVERTED" || filterStatus === "REJECTED"
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
            />
        </>
    );
}