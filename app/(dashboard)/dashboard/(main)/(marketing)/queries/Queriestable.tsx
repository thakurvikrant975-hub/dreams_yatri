"use client";

import { useState, useTransition } from "react";
import { formatDistanceToNow, format } from "date-fns";
import {
    CheckCircle2, XCircle, PhoneCall, Eye,
    MessageSquare, Phone, MapPin, StickyNote,
    Inbox, Clock, ShieldCheck, TrendingUp,
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
import { QueryStatusBadge, QuerySourceBadge, CallAttemptsDots } from "./QueryBadges";
import { RejectQueryDialog } from "./Rejectquerydialog";
import { QueryDetailSheet } from "./Querydetailsheet";
import { verifyQuery, markInProgress, getQueryById } from "./actions";
import type { PackageQuery, RejectionReason } from "./actions";
import { Pencil } from "lucide-react";
import { EditQueryDialog } from "./Editquerydialog";


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
    { label: "In Progress", value: "IN_PROGRESS" },
    { label: "Verified", value: "VERIFIED" },
    { label: "Rejected", value: "REJECTED" },
];

const SOURCE_FILTER_OPTIONS = [
    { label: "Website Form", value: "WEBSITE_FORM" },
    { label: "Landing Page", value: "LANDING_PAGE" },
    { label: "WhatsApp", value: "WHATSAPP" },
    { label: "Phone Call", value: "PHONE_CALL" },
    { label: "Referral", value: "REFERRAL" },
    { label: "Other", value: "OTHER" },
];

// ── Inline action cells ───────────────────────────────────────────────────────

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

                {/* Mark In Progress — only if not terminal */}
                {!isTerminal && query.status === "SUBMITTED" && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost" size="icon"
                                className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                onClick={handleProgress}
                                disabled={isPendingP}
                            >
                                <PhoneCall className="h-3.5 w-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Mark In Progress</TooltipContent>
                    </Tooltip>
                )}

                {/* Verify */}
                {canVerify && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost" size="icon"
                                className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30"
                                onClick={handleVerify}
                                disabled={isPendingV}
                            >
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

                {/* Reject */}
                {!isTerminal && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span onClick={(e) => e.stopPropagation()}>
                                <RejectQueryDialog queryId={query.id} leadName={query.name} reasons={reasons}>
                                    <Button
                                        variant="ghost" size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    >
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
    const [page, setPage] = useState(1);

    // Detail sheet state
    const [sheetOpen, setSheetOpen] = useState(false);
    const [detailQuery, setDetailQuery] = useState<QueryWithDetails | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    async function openDetail(query: PackageQuery) {
        setSheetOpen(true);
        setLoadingDetail(true);
        try {
            // Fetch full query with notes + timeline
            const full = await getQueryById(query.id);
            setDetailQuery(full as unknown as QueryWithDetails);
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
        const matchSource = filterSource === "all" || q.source === filterSource;
        const matchVerified =
            filterVerified === "all"
            || (filterVerified === "verified" && q.verified)
            || (filterVerified === "unverified" && !q.verified);

        return matchSearch && matchStatus && matchSource && matchVerified;
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
    const isFiltering = search !== "" || filterStatus !== "all" || filterSource !== "all" || filterVerified !== "all";

    // ── Stats ─────────────────────────────────────────────────────────────────
    const submitted = queries.filter(q => q.status === "SUBMITTED").length;
    const inProgress = queries.filter(q => q.status === "IN_PROGRESS").length;
    const verified = queries.filter(q => q.verified).length;
    const rejected = queries.filter(q => q.status === "REJECTED").length;
    const convRate = queries.length > 0 ? Math.round((verified / queries.length) * 100) : 0;

    // ── Columns ───────────────────────────────────────────────────────────────
    const columns: ColumnDef<PackageQuery>[] = [
        {
            header: "Lead",
            width: "w-[220px]",
            cell: (q) => (
                <div className="space-y-0.5">
                    <p className="font-medium text-sm leading-tight">{q.name}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <span>{q.phone}</span>
                    </div>
                    {q.email && (
                        <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">{q.email}</p>
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
            width: "w-[140px]",
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
                <Stats
                    rows={[
                        { label: "Total Queries", value: queries.length },
                        { label: "Submitted", value: submitted, muted: submitted === 0 },
                        { label: "In Progress", value: inProgress },
                        { label: "Verified", value: verified },
                        { label: "Rejected", value: rejected, muted: true },
                        { label: "Conv. Rate", value: `${convRate}%` },
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
                    ]}
                />

                {/* Table */}
                <DataTable
                    data={paginated}
                    columns={columns}
                    rowKey={(q) => q.id}
                    onRowClick={(q) => openDetail(q)}
                    emptyState={
                        <div className="flex flex-col items-center gap-2">
                            <Inbox className="h-10 w-10 text-muted-foreground" />
                            <p className="text-sm font-medium text-muted-foreground">No queries found</p>
                            <p className="text-xs text-muted-foreground">
                                {isFiltering ? "Try adjusting your filters" : "Queries from your website will appear here"}
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