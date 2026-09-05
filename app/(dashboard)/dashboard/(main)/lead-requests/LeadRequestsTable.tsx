"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
    AlertTriangle, Ban, Check, CheckCheck, ChevronDown, ChevronUp,
    Clock, ClipboardList, MapPin, Phone, Mail, StickyNote, Save, XCircle,
} from "lucide-react";
import { DataTable, type ColumnDef } from "../components/dashboard/Datatable";
import { TableRow, TableCell } from "../components/ui/table";
import { TableFilters } from "../components/dashboard/Tablefilters";
import { TableEmptyState } from "../components/dashboard/TableEmptyState";
import { StatCard, StatGrid } from "../components/dashboard/Statcard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import {
    acceptAllLeadRequests, acceptLeadRequest, rejectLeadRequest,
    updateLeadRequestReviewNote, type LeadRequestRow, type LeadRequestsFilter, type LeadRequestStats,
} from "./actions";

const STATUS_STYLES: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
    ACCEPTED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
    REJECTED: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
};

const fmtDate = (d: Date) =>
    new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(d));

function DuplicateBanner({ duplicate }: { duplicate: LeadRequestRow["duplicate"] }) {
    if (!duplicate) return null;
    return (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p className="text-xs leading-relaxed">
                This number is already on file as{" "}
                <span className="font-semibold">{duplicate.name}</span> —{" "}
                {duplicate.assignedToName
                    ? <>assigned to <span className="font-semibold">{duplicate.assignedToName}</span>{" "}</>
                    : "not yet assigned "}
                {formatDistanceToNow(new Date(duplicate.createdAt), { addSuffix: true })}.
                Check it&apos;s not a duplicate before accepting.
            </p>
        </div>
    );
}

/**
 * A note either the lead manager or the costing manager can leave on a
 * request while it's still in the queue — saved independently of
 * accept/reject so it isn't lost, and carried onto the resulting query as a
 * QueryNote the moment the request is accepted.
 */
function ReviewNote({ request }: { request: LeadRequestRow }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [note, setNote] = useState(request.reviewNote ?? "");
    // Resets the draft when the saved note changes underneath us (e.g. this
    // row's router.refresh() after Save) without an effect — set during
    // render, per React's "adjusting state when a prop changes" pattern.
    const [syncedNote, setSyncedNote] = useState(request.reviewNote ?? "");
    if (syncedNote !== (request.reviewNote ?? "")) {
        setSyncedNote(request.reviewNote ?? "");
        setNote(request.reviewNote ?? "");
    }

    const dirty = note.trim() !== (request.reviewNote ?? "").trim();

    function save() {
        startTransition(async () => {
            const result = await updateLeadRequestReviewNote(request.id, note);
            if (result.success) {
                toast.success("Note saved");
                router.refresh();
            } else {
                toast.error(result.error ?? "Failed to save note");
            }
        });
    }

    return (
        <div className="rounded-lg border border-dashboard-base-300 bg-dashboard-base-200/30 p-2.5 space-y-2">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-dashboard-base-content/50">
                <StickyNote className="h-3 w-3" /> Reviewer note
            </p>
            <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note for whoever picks this up after approval…"
                rows={2}
                className="text-sm resize-none bg-dashboard-base-100"
            />
            {dirty && (
                <div className="flex justify-end">
                    <Button
                        type="button" size="sm" variant="outline"
                        className="h-7 text-xs gap-1"
                        disabled={isPending}
                        onClick={save}
                    >
                        <Save className="h-3 w-3" /> {isPending ? "Saving…" : "Save note"}
                    </Button>
                </div>
            )}
        </div>
    );
}

function RequestDetailPanel({ request }: { request: LeadRequestRow }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [rejecting, setRejecting] = useState(false);
    const [reason, setReason] = useState("");

    function accept() {
        startTransition(async () => {
            const result = await acceptLeadRequest(request.id);
            if (result.success) {
                toast.success(`${request.name} added as a query`);
                router.refresh();
            } else {
                toast.error(result.error ?? "Failed to accept");
            }
        });
    }

    function reject() {
        if (!reason.trim()) { toast.error("A reason is required to reject this request."); return; }
        startTransition(async () => {
            const result = await rejectLeadRequest(request.id, reason);
            if (result.success) {
                toast.success(`Request for ${request.name} rejected`);
                setRejecting(false);
                setReason("");
                router.refresh();
            } else {
                toast.error(result.error ?? "Failed to reject");
            }
        });
    }

    return (
        <div className="px-4 py-3.5 space-y-2.5 bg-dashboard-base-200/20">
            {request.notes && (
                <p className="flex items-start gap-1.5 rounded-md border-l-2 border-dashboard-primary/30 bg-dashboard-primary/5 px-2.5 py-1.5 text-xs text-dashboard-base-content/70">
                    <StickyNote className="h-3 w-3 mt-0.5 shrink-0 text-dashboard-base-content/40" />
                    <span>{request.notes}</span>
                </p>
            )}

            {request.status === "REJECTED" && request.rejectionReason && (
                <p className="text-xs text-red-700 dark:text-red-400">
                    Rejected by {request.decidedByName}: &quot;{request.rejectionReason}&quot;
                </p>
            )}
            {request.status === "ACCEPTED" && (
                <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <Check className="h-3 w-3" /> Accepted by {request.decidedByName}
                </p>
            )}
            {request.status !== "PENDING" && request.reviewNote && (
                <p className="flex items-start gap-1.5 rounded-md border-l-2 border-dashboard-base-content/20 bg-dashboard-base-200/40 px-2.5 py-1.5 text-xs text-dashboard-base-content/70">
                    <StickyNote className="h-3 w-3 mt-0.5 shrink-0 text-dashboard-base-content/40" />
                    <span>{request.reviewNote}</span>
                </p>
            )}

            <DuplicateBanner duplicate={request.duplicate} />

            {request.status === "PENDING" && <ReviewNote request={request} />}

            {request.status === "PENDING" && !rejecting && (
                <div className="flex items-center gap-2">
                    <Button
                        type="button" size="sm"
                        className="h-8 text-xs gap-1"
                        disabled={isPending}
                        onClick={accept}
                    >
                        <Check className="h-3.5 w-3.5" /> Accept
                    </Button>
                    <Button
                        type="button" size="sm" variant="outline"
                        className="h-8 text-xs gap-1 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                        disabled={isPending}
                        onClick={() => setRejecting(true)}
                    >
                        <Ban className="h-3.5 w-3.5" /> Reject
                    </Button>
                </div>
            )}

            {rejecting && (
                <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/20 p-3 space-y-2">
                    <Textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Why is this request being rejected?"
                        rows={2}
                        className="text-sm resize-none bg-white dark:bg-transparent"
                        autoFocus
                    />
                    <div className="flex items-center gap-2">
                        <Button
                            type="button" size="sm"
                            className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white"
                            disabled={isPending || !reason.trim()}
                            onClick={reject}
                        >
                            {isPending ? "Rejecting…" : "Confirm Reject"}
                        </Button>
                        <Button
                            type="button" size="sm" variant="ghost" className="h-8 text-xs"
                            onClick={() => { setRejecting(false); setReason(""); }}
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

export function LeadRequestsTable({
    requests,
    stats,
    currentPage,
    totalPages,
    totalCount,
    limit,
    search,
    filter,
}: {
    requests: LeadRequestRow[];
    stats: LeadRequestStats;
    currentPage: number;
    totalPages: number;
    totalCount: number;
    limit: number;
    search: string;
    filter: LeadRequestsFilter;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [, startTransition] = useTransition();
    const [isAcceptingAll, startAcceptAll] = useTransition();
    const [expandedId, setExpandedId] = useState<string | null>(null);

    function updateParam(key: string, value: string) {
        const params = new URLSearchParams(searchParams.toString());
        if (!value || value === "all") params.delete(key);
        else params.set(key, value);
        params.delete("page");
        startTransition(() => router.replace(`?${params.toString()}`));
    }

    function handleSearch(value: string) {
        updateParam("search", value);
    }

    function buildHref(p: number) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("page", String(p));
        return `?${params.toString()}`;
    }

    function toggleExpanded(id: string) {
        setExpandedId((prev) => (prev === id ? null : id));
    }

    function acceptAll() {
        startAcceptAll(async () => {
            const result = await acceptAllLeadRequests();
            if (result.success) {
                const parts = [`${result.accepted} accepted`];
                if (result.skipped > 0) parts.push(`${result.skipped} skipped (already duplicate/decided)`);
                toast.success(parts.join(", "));
                router.refresh();
            } else {
                toast.error(result.error ?? "Failed to accept all");
            }
        });
    }

    const from = totalCount === 0 ? 0 : (currentPage - 1) * limit + 1;
    const to = Math.min(currentPage * limit, totalCount);
    const paginationLabel = `Showing ${from}–${to} of ${totalCount} request${totalCount !== 1 ? "s" : ""}`;

    const columns: ColumnDef<LeadRequestRow>[] = [
        {
            header: "Lead",
            sortKey: (r) => r.name?.toLowerCase() ?? "",
            cell: (r) => (
                <div>
                    <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm text-dashboard-base-content line-clamp-1">{r.name}</span>
                        {r.duplicate && (
                            <span title="This number may already be on file — check before accepting." className="shrink-0">
                                <AlertTriangle className="size-3.5 text-amber-600" />
                            </span>
                        )}
                        {r.notes && (
                            <span title={r.notes} className="shrink-0">
                                <StickyNote className="size-3.5 text-dashboard-primary" />
                            </span>
                        )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-dashboard-neutral">
                        <MapPin className="size-3 shrink-0" /> {r.destination}
                    </div>
                    {r.duplicate && (
                        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400">
                            <AlertTriangle className="size-3 shrink-0" />
                            Duplicate of <span className="font-medium">{r.duplicate.name}</span> —{" "}
                            {r.duplicate.assignedToName
                                ? <>assigned to <span className="font-medium">{r.duplicate.assignedToName}</span></>
                                : "not yet assigned"}
                        </div>
                    )}
                </div>
            ),
        },
        {
            header: "Contact",
            sortKey: (r) => r.phone ?? "",
            cell: (r) => (
                <div>
                    <div className="flex items-center gap-1 text-sm text-dashboard-base-content">
                        <Phone className="size-3 text-dashboard-neutral shrink-0" /> {r.phone}
                    </div>
                    {r.email && (
                        <div className="flex items-center gap-1 text-xs text-dashboard-neutral mt-0.5">
                            <Mail className="size-3 shrink-0" /> {r.email}
                        </div>
                    )}
                </div>
            ),
        },
        {
            header: "Requested By",
            sortKey: (r) => new Date(r.createdAt).getTime(),
            cell: (r) => (
                <div>
                    <div className="text-sm font-medium text-dashboard-base-content">{r.requestedByName}</div>
                    <div className="text-xs text-dashboard-neutral mt-0.5" title={fmtDate(r.createdAt)}>
                        {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                    </div>
                </div>
            ),
        },
        {
            header: "Status",
            align: "center",
            width: "w-[130px]",
            cell: (r) => (
                <div className="flex flex-col items-center gap-1">
                    <Badge className={STATUS_STYLES[r.status]}>{r.status}</Badge>
                    {r.status === "REJECTED" && r.rejectionReason && (
                        <span
                            title={r.rejectionReason}
                            className="text-[10px] text-dashboard-base-content/45 max-w-[110px] truncate"
                        >
                            {r.rejectionReason}
                        </span>
                    )}
                </div>
            ),
        },
        {
            header: "Action",
            align: "right",
            width: "w-[160px]",
            cell: (r) => {
                const expanded = expandedId === r.id;
                return (
                    <div className="flex items-center justify-end gap-1.5">
                        {r.status === "PENDING" && (
                            <Button
                                type="button" size="sm"
                                className="h-8 text-xs gap-1"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    startTransition(async () => {
                                        const result = await acceptLeadRequest(r.id);
                                        if (result.success) {
                                            toast.success(`${r.name} added as a query`);
                                            router.refresh();
                                        } else {
                                            toast.error(result.error ?? "Failed to accept");
                                        }
                                    });
                                }}
                            >
                                <Check className="size-3.5" /> Accept
                            </Button>
                        )}
                        <Button
                            type="button" size="sm" variant="outline"
                            className="h-8 text-xs gap-1"
                            onClick={(e) => { e.stopPropagation(); toggleExpanded(r.id); }}
                        >
                            {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                            Details
                        </Button>
                    </div>
                );
            },
        },
    ];

    return (
        <div className="space-y-6">
            {/* Stats */}
            <StatGrid cols={4}>
                <StatCard label="Total"    value={stats.total}    icon={ClipboardList} />
                <StatCard label="Pending"  value={stats.pending}  icon={Clock} />
                <StatCard label="Accepted" value={stats.accepted} icon={CheckCheck} />
                <StatCard label="Rejected" value={stats.rejected} icon={XCircle} />
            </StatGrid>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <TableFilters
                    search={search}
                    onSearchChange={handleSearch}
                    searchPlaceholder="Search client name, phone or requester…"
                    className="flex-1"
                    filters={[
                        {
                            value: filter,
                            onChange: (v) => updateParam("filter", v),
                            placeholder: "All requests",
                            width: "w-40",
                            options: [
                                { label: "Pending",  value: "pending" },
                                { label: "Accepted", value: "accepted" },
                                { label: "Rejected", value: "rejected" },
                            ],
                        },
                    ]}
                />
                {stats.pending > 0 && (
                    <Button
                        type="button" size="sm" className="h-10 text-xs gap-1.5 shrink-0"
                        disabled={isAcceptingAll}
                        onClick={acceptAll}
                    >
                        <CheckCheck className="h-3.5 w-3.5" /> Accept All {stats.pending}
                    </Button>
                )}
                <Select
                    value={String(limit)}
                    onValueChange={(v) => {
                        const params = new URLSearchParams(searchParams.toString());
                        params.set("limit", v);
                        params.delete("page");
                        startTransition(() => router.replace(`?${params.toString()}`));
                    }}
                >
                    <SelectTrigger className="w-32 h-10 text-sm shrink-0 border-dashboard-base-300 bg-dashboard-base-100 text-dashboard-base-content/70 rounded-lg focus:ring-dashboard-primary/30 focus:border-dashboard-primary">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-dashboard-base-300 bg-dashboard-base-100">
                        {[10, 20, 50].map((n) => (
                            <SelectItem key={n} value={String(n)} className="text-sm text-dashboard-base-content focus:bg-dashboard-base-200 focus:text-dashboard-base-content rounded-lg cursor-pointer">
                                {n} / page
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Table */}
            <DataTable
                data={requests}
                columns={columns}
                rowKey={(r) => r.id}
                rowClassName={(r) =>
                    r.status === "ACCEPTED" ? "bg-emerald-50/40 hover:bg-emerald-50" :
                    r.status === "REJECTED" ? "bg-red-50/40 hover:bg-red-50" :
                    "hover:bg-dashboard-base-200"
                }
                renderSubRows={(r) =>
                    expandedId === r.id ? (
                        <TableRow className="border-b border-dashboard-base-300 hover:bg-transparent">
                            <TableCell colSpan={columns.length} className="p-0">
                                <RequestDetailPanel request={r} />
                            </TableCell>
                        </TableRow>
                    ) : null
                }
                emptyState={
                    <TableEmptyState
                        title="No lead requests found"
                        description="Requests appear here once a sales exec asks to add a lead."
                    />
                }
                pagination={{
                    currentPage,
                    totalPages,
                    buildHref,
                    label: paginationLabel,
                }}
            />
        </div>
    );
}
